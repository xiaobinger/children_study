"""儿歌童声演唱渲染器：DiffSinger SVS 推理（绮萱童声声库）

人声轨用开源童声声库"绮萱"（qixuan, DiffSinger v2.7.0）按 DS 文件演唱，
伴奏轨沿用 gen-song.py 的离线伴奏（已验证），二者组成前端已有的双轨结构。
由于前端混音逻辑不变，只需把 audio/song/sNNN_v.mp3 替换为童声演唱即可。

用法: python tools/gen-song-svs.py [--ids s1,s2] [--force] [--steps 20]
输出:
  audio/song/sNNN_v.mp3   童声演唱人声轨（替换旧合成人声）
  audio/song/sNNN_a.mp3   伴奏轨（不存在时才生成）
  tools/song-svs-meta.json 每首的行起始时间（与 JS 时间轴核对）
依赖: tools/pylibs310（onnxruntime/numpy/scipy/torch/lameenc/diffsinger-utau/pypinyin）
声库: tools/qixuan_vb/Qixuan_v2.7.0_DiffSinger_OpenUtau（绮萱 v2.7.0 + PC-NSF-HiFiGAN 声码器）
"""
import sys
import json
import time
import shutil
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "pylibs310"))

import numpy as np
from scipy.signal import butter, sosfilt

SR_OUT = 44100
BITRATE = 128
VB_PATH = ROOT / "tools" / "qixuan_vb" / "Qixuan_v2.7.0_DiffSinger_OpenUtau"

# 伴奏（与 gen-song.py 相同的时间数学与音色，保证双轨结构不变）
NOTE_FREQ = {
    '1': 261.63, '2': 293.66, '3': 329.63, '4': 349.23, '5': 392.0, '6': 439.99, '7': 493.88,
    '1+': 523.25, '2+': 587.33, '3+': 659.25, '4+': 698.46, '5+': 783.99, '6+': 879.99, '7+': 987.77,
    '1_': 130.81, '2_': 146.83, '3_': 164.81, '4_': 174.61, '5_': 196.0, '6_': 220.0, '7_': 246.94,
    '0': 0.0,
}
BASS_VOL = 0.05
CHORD_VOL = 0.032


def parse_melody(notes, bpm):
    """与前端 js/audio.js parseMelody、tools/song2ds.py 完全一致。
    语法：音高(1-7，_低八度 +高八度，0=休止) + 可选 *N 时值后缀(N 拍，默认 1)。
    兼容旧语法：尾缀 -=2拍、--=3拍、独立 -=1拍休止。"""
    beat = 60.0 / bpm
    tokens = [t for t in notes.strip().split() if t]
    t = 0.0
    events = []
    for tk in tokens:
        slot = 1.0
        key = tk
        if '*' in tk:
            key, _, bs = tk.partition('*')
            try:
                b = float(bs)
                if b > 0:
                    slot = b
            except ValueError:
                pass
        elif tk == '-':
            key = '0'
        elif tk.endswith('--'):
            slot = 3.0
            key = tk[:-2]
        elif tk.endswith('-'):
            slot = 2.0
            key = tk[:-1]
        slot_dur = slot * beat
        if key == '0':
            events.append({'freq': -1.0, 'start': t, 'dur': slot_dur, 'slot': slot, 'rest': True})
            t += slot_dur
            continue
        events.append({'freq': NOTE_FREQ.get(key, 0.0), 'start': t,
                       'dur': slot_dur * 0.9, 'slot': slot})
        t += slot_dur
    return events


def line_duration(events, beat):
    """行时长 = 末音起始 + 末音占槽（与前端 computeSongTimeline 一致）。"""
    if not events:
        return beat * 2
    last = events[-1]
    return last['start'] + last.get('slot', 1.0) * beat


def chord_of(freqs):
    uniq = []
    for f in freqs:
        if f > 0 and f not in uniq:
            uniq.append(f)
    uniq.sort()
    if not uniq:
        return [], 0.0
    root = uniq[0]
    if len(uniq) >= 3:
        return [uniq[0], uniq[len(uniq) // 2], uniq[-1]], root
    return [root, root * 1.2599, root * 1.4983], root


def add_to(buf, seg, start):
    s0 = int(round(start * SR_OUT))
    if s0 >= len(buf):
        return
    s1 = min(len(buf), s0 + len(seg))
    if s1 > s0:
        buf[s0:s1] += seg[:s1 - s0]


def pad_note(buf, freq, start, dur, vol, beat):
    if freq <= 0 or dur <= 0:
        return
    n = int(round(dur * SR_OUT)) + int(0.03 * SR_OUT)
    if n < 16:
        return
    i = np.arange(n, dtype=np.float64) / SR_OUT
    ph = 2.0 * np.pi * freq * i
    raw = 2.0 / np.pi * np.arcsin(np.sin(ph))
    raw += 0.30 * np.sin(2 * ph) + 0.10 * np.sin(3 * ph)
    tau = max(0.28, beat * 1.1)
    env = (1.0 - np.exp(-i / 0.008)) * np.exp(-i / tau)
    tail_n = int(0.04 * SR_OUT)
    if n > tail_n:
        env[-tail_n:] *= np.linspace(1.0, 0.0, tail_n)
    add_to(buf, raw * env * vol, start)


def bass_note(buf, freq, start, dur, vol):
    if freq <= 0 or dur <= 0:
        return
    n = int(round(dur * SR_OUT)) + int(0.05 * SR_OUT)
    if n < 16:
        return
    i = np.arange(n, dtype=np.float64) / SR_OUT
    raw = np.sin(2.0 * np.pi * freq * i)
    env = np.full(n, vol)
    a = min(int(0.05 * SR_OUT), max(2, n // 3))
    env[:a] = vol * np.exp(np.linspace(np.log(1e-4), 0.0, a))
    m = max(0, n - int(0.12 * SR_OUT))
    if m < n - 1:
        env[m:] = vol * np.exp(np.linspace(0.0, np.log(1e-4), n - m))
    add_to(buf, raw * env, start)


def render_accomp(song, total_sec):
    bpm = song.get('bpm') or 100
    beat = 60.0 / bpm
    buf = np.zeros(int((total_sec + 0.1) * SR_OUT))
    t = 0.3
    for notes in song['melody']:
        evs = parse_melody(notes, bpm)
        line_dur = line_duration(evs, beat)
        chord, root = chord_of([e['freq'] for e in evs])
        if root > 0:
            bass_note(buf, root / 2.0, t, line_dur * 0.98, BASS_VOL)
            bt = 0.0
            while bt < line_dur - 1e-6:
                for f in chord:
                    pad_note(buf, f, t + bt, beat * 0.85, CHORD_VOL, beat)
                bt += beat
        t = t + line_dur + beat * 0.45
    return buf


def encode_mp3(samples, path):
    import lameenc
    pcm = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm * 32767.0).astype('<i2')
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(SR_OUT)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm16.tobytes()) + enc.flush()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(data))
    return path.stat().st_size


def resample_to(x, sr_from, sr_to):
    if sr_from == sr_to:
        return x
    n_out = int(round(len(x) * sr_to / sr_from))
    if n_out < 2:
        return np.zeros(1)
    idx = np.arange(n_out) * (sr_from / sr_to)
    i0 = np.floor(idx).astype(np.int64)
    i1 = np.minimum(i0 + 1, len(x) - 1)
    frac = idx - i0
    return x[i0] * (1 - frac) + x[i1] * frac


def update_voice_map(entries):
    import re
    path = ROOT / 'js' / 'voice-map.js'
    mapping = {}
    if path.exists():
        for m in re.finditer(r'"([^"\n]+)":\s*"(audio/[^"]+)"', path.read_text(encoding='utf-8')):
            mapping[m.group(1)] = m.group(2)
    mapping.update(entries)
    lines = ['/* ============ 预生成配音清单（gen-voice.py 自动生成） ============ */',
             'window.CS_VOICE = {']
    for k in sorted(mapping):
        lines.append('  "%s": "%s",' % (k, mapping[k]))
    lines.append('};')
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return len(mapping)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='', help='只渲染指定 id（逗号分隔）')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--steps', type=int, default=64, help='声学模型扩散步数（默认64，越高越细腻）')
    ap.add_argument('--variance-steps', type=int, default=20)
    ap.add_argument('--pitch-steps', type=int, default=20, help='音高模型步数（音准关键，默认20）')
    args = ap.parse_args()

    if not VB_PATH.exists():
        print('声库不存在: %s' % VB_PATH)
        print('请先下载 Qixuan_v2.7.0_DiffSinger_OpenUtau.zip 并解压到 tools/qixuan_vb/')
        sys.exit(1)

    from diffsinger_utau.voice_bank import PredAll
    from diffsinger_utau.voice_bank.commons.ds_reader import DSReader

    tasks_file = ROOT / 'tools' / 'song-tasks.json'
    songs = json.loads(tasks_file.read_text(encoding='utf-8'))
    if args.ids:
        want = set(x.strip() for x in args.ids.split(',') if x.strip())
        songs = [s for s in songs if s['id'] in want]

    ds_dir = ROOT / 'tools' / 'song-ds'
    meta_path = ROOT / 'tools' / 'song-svs-meta.json'
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding='utf-8'))
        except Exception:
            meta = {}

    print('加载绮萱童声声库（首次约 1-2 分钟）...')
    t0 = time.time()
    pred = PredAll(VB_PATH)
    print('模型加载完成: %.1fs' % (time.time() - t0))

    tmp_dir = ROOT / 'tools' / '_svs_tmp'
    entries = {}
    done = 0
    for s in songs:
        vrel = 'audio/song/s%03d_v.mp3' % s['index']
        arel = 'audio/song/s%03d_a.mp3' % s['index']
        vf = ROOT / vrel
        af = ROOT / arel
        ds_file = ds_dir / (s['id'] + '.ds')
        if not ds_file.exists():
            print('%s 缺少 DS 文件，跳过（先跑 song2ds.py）' % s['id'])
            continue
        if not args.force and vf.exists() and vf.stat().st_size > 2048 and s['id'] in meta:
            entries['song:%s:v' % s['id']] = vrel
            entries['song:%s:a' % s['id']] = arel
            continue

        sections = DSReader(str(ds_file)).read_ds()
        t_start = time.time()
        # 计算总时长（与 JS 时间轴一致）
        bpm = s.get('bpm') or 100
        beat = 60.0 / bpm
        t = 0.3
        line_infos = []
        for li, notes in enumerate(s['melody']):
            evs = parse_melody(notes, bpm)
            line_dur = line_duration(evs, beat)
            line_infos.append({'start': t, 'dur': line_dur})
            t = t + line_dur + beat * 0.45
        span = t - 0.3
        total_sec = 0.3 + span + 0.55

        vocal = np.zeros(int(total_sec * SR_OUT) + 1)
        for sec in sections:
            offset = float(sec.get('offset', 0.0))
            if tmp_dir.exists():
                shutil.rmtree(tmp_dir, ignore_errors=True)
            res = pred.predict_full_pipeline(
                ds=sec,
                lang='zh',
                speaker=None,
                key_shift=0,
                pitch_steps=args.pitch_steps,
                variance_steps=args.variance_steps,
                acoustic_steps=args.steps,
                gender=0.0,
                output_dir=str(tmp_dir),
                save_intermediate=False,
            )
            wav = np.asarray(res['wav'], dtype=np.float64).flatten()
            if wav.size and np.max(np.abs(wav)) > 1e-6:
                wav = wav / max(1e-9, np.max(np.abs(wav))) * 0.9
            wav16 = resample_to(wav, pred.dsvocoder.sample_rate, SR_OUT)
            add_to(vocal, wav16, offset)

        peak = float(np.max(np.abs(vocal))) if vocal.size else 0.0
        if peak > 1e-9:
            vocal = vocal / peak * 0.85
        fi = int(0.012 * SR_OUT)
        fo = int(0.30 * SR_OUT)
        vocal[:fi] *= np.linspace(0.0, 1.0, fi)
        vocal[-fo:] *= np.linspace(1.0, 0.0, fo)

        vs = encode_mp3(vocal, vf)
        if not af.exists() or args.force:
            accomp = render_accomp(s, total_sec)
            pk = float(np.max(np.abs(accomp)))
            if pk > 1e-9:
                accomp = accomp / pk * 0.85
            accomp[:fi] *= np.linspace(0.0, 1.0, fi)
            accomp[-fo:] *= np.linspace(1.0, 0.0, fo)
            encode_mp3(accomp, af)

        meta[s['id']] = {
            'span': round(span, 6),
            'dur': round(len(vocal) / SR_OUT, 3),
            'lines': [{'start': round(l['start'], 6), 'dur': round(l['dur'], 6)} for l in line_infos],
        }
        entries['song:%s:v' % s['id']] = vrel
        entries['song:%s:a' % s['id']] = arel
        done += 1
        print('%s %s: %.1fs 人声 %dKB 伴奏 %dKB (%.0fs)'
              % (s['id'], s['title'], span, vs // 1024, af.stat().st_size // 1024, time.time() - t_start))

    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    total_map = update_voice_map(entries)
    print('渲染完成: 本次 %d 首, 共 %d 首入映射, voice-map 合计 %d 条' % (done, len(songs), total_map))


if __name__ == '__main__':
    main()
