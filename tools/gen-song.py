"""儿歌离线渲染器：把每首带旋律的儿歌离线渲染成 人声轨(_v) + 伴奏轨(_a) 两个 mp3。

为什么离线渲染：WebView 里实时 Web Audio 合成一首歌要创建上千个音频节点，
Android 低端机上声音会一卡一卡；且实时合成只能用最简单的算法。
离线渲染后 App 只需播放解码好的音频（绝不同步卡顿），还能用上
真人感更强的合成：按拼音韵母切换共振峰、辅音起音噪声、颤音渐入、音高滑音。

用法: python tools/gen-song.py [--ids s1,s2] [--force]
产出:
  audio/song/sXXX_v.mp3 / sXXX_a.mp3   人声轨 / 伴奏轨（前端 gain 实时混音）
  tools/song-meta.json                 每行起止时间（供与前端时间轴一致性校验）
  js/voice-map.js                      追加 song:<id>:v / song:<id>:a 映射
依赖: numpy scipy lameenc pypinyin（自动使用 tools/pylibs）
"""
import sys
import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "pylibs"))

import numpy as np
from scipy.signal import butter, sosfilt

SR = 32000
BITRATE = 80
VOCAL_VOL = 0.2
BASS_VOL = 0.05
CHORD_VOL = 0.032

NOTE_FREQ = {
    '1': 261.63, '2': 293.66, '3': 329.63, '4': 349.23, '5': 392.0, '6': 439.99, '7': 493.88,
    '1+': 523.25, '2+': 587.33, '3+': 659.25, '4+': 698.46, '5+': 783.99, '6+': 879.99, '7+': 987.77,
    '1_': 130.81, '2_': 146.83, '3_': 164.81, '4_': 174.61, '5_': 196.0, '6_': 220.0, '7_': 246.94,
    '0': 0.0,
}

HARMONICS = [(1, 0.5), (2, 0.26), (3, 0.16), (4, 0.09), (5, 0.055)]

FORMANTS = {
    'a': [(850, 1.0), (1220, 0.55), (2800, 0.22)],
    'o': [(500, 1.0), (900, 0.60), (2600, 0.22)],
    'e': [(550, 1.0), (1150, 0.55), (2700, 0.22)],
    'i': [(320, 1.0), (2200, 0.50), (3000, 0.25)],
    'u': [(330, 1.0), (750, 0.55), (2500, 0.20)],
    'v': [(320, 1.0), (1700, 0.50), (2700, 0.22)],
}

PUNCT = set('，。！？、,.!?；;：:…—·~ "“”‘’()（）[]【】《》')
VOWEL_ORDER = ('a', 'o', 'e', 'i', 'u', 'v')
_INITIALS = ('zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
             'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w')

rng = np.random.default_rng(20260927)
_sos_cache = {}


def bandpass(f0, q=6.0):
    key = (round(f0, 1), round(q, 2))
    if key not in _sos_cache:
        bw = f0 / q
        lo = max(40.0, f0 - bw / 2.0)
        hi = min(SR / 2.0 - 200.0, f0 + bw / 2.0)
        if hi <= lo:
            hi = lo + 50.0
        _sos_cache[key] = butter(2, [lo, hi], btype='bandpass', fs=SR, output='sos')
    return _sos_cache[key]


def parse_melody(notes, bpm):
    """与前端 js/audio.js parseMelody 完全一致。
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


def char_syllable(ch):
    """单字 → (韵母共振峰分类, 是否含声母)。解析失败返回 None。"""
    try:
        from pypinyin import lazy_pinyin
    except ImportError:
        return None
    py = lazy_pinyin(ch, errors='ignore')
    if not py:
        return None
    s = py[0].lower()
    final = s
    has_initial = False
    for ini in _INITIALS:
        if s.startswith(ini):
            final = s[len(ini):]
            has_initial = True
            break
    f = final or s
    v = 'a'
    for c in VOWEL_ORDER:
        if c in f or (c == 'v' and 'ü' in f):
            v = c
            break
    return v, has_initial


def add_to(buf, seg, start):
    s0 = int(round(start * SR))
    if s0 >= len(buf):
        return
    s1 = min(len(buf), s0 + len(seg))
    if s1 > s0:
        buf[s0:s1] += seg[:s1 - s0]


def sing_note(buf, freq, start, dur, vowel, prev_freq, has_initial):
    """唱一个音：声带谐波(带颤音渐入+起音滑音) + 元音共振峰 + 辅音起音噪声。"""
    if freq <= 0 or dur <= 0:
        return
    n = int(round(dur * SR))
    tail = int(0.06 * SR)
    total = n + tail
    if total < 16:
        return
    i = np.arange(total, dtype=np.float64) / SR
    vr = np.clip((i - 0.15) / 0.28, 0.0, 1.0)
    vib = 1.0 + 0.007 * vr * np.sin(2 * np.pi * 5.3 * i + rng.uniform(0.0, 6.28))
    if prev_freq and prev_freq > 0 and abs(prev_freq - freq) > 0.5:
        glide = 1.0 + (prev_freq / freq - 1.0) * np.exp(-i / 0.035)
    else:
        glide = 1.0
    phase = 2.0 * np.pi * np.cumsum(freq * vib * glide) / SR
    sig = np.zeros(total)
    for h, hv in HARMONICS:
        sig += hv * np.sin(phase * h)
    env = np.full(total, VOCAL_VOL)
    a = min(int(0.07 * SR), max(2, total // 3))
    env[:a] = VOCAL_VOL * np.exp(np.linspace(np.log(1e-4), 0.0, a))
    m = max(0, total - int(0.14 * SR))
    if m < total - 1:
        env[m:] = VOCAL_VOL * np.exp(np.linspace(0.0, np.log(1e-4), total - m))
    env[n:] = np.minimum(env[n:], 1e-4)
    voiced = sig * env
    out = voiced.copy()
    for f0, g in FORMANTS[vowel]:
        out += g * sosfilt(bandpass(f0), voiced)
    if has_initial:
        nn = min(int(0.025 * SR), total)
        if nn > 8:
            noise = rng.standard_normal(nn)
            nz = sosfilt(bandpass(3200.0, 1.4), noise)
            peak = float(np.max(np.abs(nz)))
            if peak > 1e-9:
                nz = nz / peak * 0.05
            nz *= np.exp(-np.arange(nn) / (0.010 * SR))
            out[:nn] += nz
    add_to(buf, out, start)


def pad_note(buf, freq, start, dur, vol, beat):
    """伴奏和弦音：三角波+泛音，琴键式衰减包络。"""
    if freq <= 0 or dur <= 0:
        return
    n = int(round(dur * SR)) + int(0.03 * SR)
    if n < 16:
        return
    i = np.arange(n, dtype=np.float64) / SR
    ph = 2.0 * np.pi * freq * i
    raw = 2.0 / np.pi * np.arcsin(np.sin(ph))
    raw += 0.30 * np.sin(2 * ph) + 0.10 * np.sin(3 * ph)
    tau = max(0.28, beat * 1.1)
    env = (1.0 - np.exp(-i / 0.008)) * np.exp(-i / tau)
    tail_n = int(0.04 * SR)
    if n > tail_n:
        env[-tail_n:] *= np.linspace(1.0, 0.0, tail_n)
    add_to(buf, raw * env * vol, start)


def bass_note(buf, freq, start, dur, vol):
    """伴奏低音：正弦持续音（与前端实时合成一致的长音包络）。"""
    if freq <= 0 or dur <= 0:
        return
    n = int(round(dur * SR)) + int(0.05 * SR)
    if n < 16:
        return
    i = np.arange(n, dtype=np.float64) / SR
    raw = np.sin(2.0 * np.pi * freq * i)
    env = np.full(n, vol)
    a = min(int(0.05 * SR), max(2, n // 3))
    env[:a] = vol * np.exp(np.linspace(np.log(1e-4), 0.0, a))
    m = max(0, n - int(0.12 * SR))
    if m < n - 1:
        env[m:] = vol * np.exp(np.linspace(0.0, np.log(1e-4), n - m))
    add_to(buf, raw * env, start)


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


def fade_edges(buf):
    fi = int(0.012 * SR)
    fo = int(0.30 * SR)
    buf[:fi] *= np.linspace(0.0, 1.0, fi)
    buf[-fo:] *= np.linspace(1.0, 0.0, fo)


def render_song(song):
    bpm = song.get('bpm') or 100
    beat = 60.0 / bpm
    lines = []
    t = 0.3
    for notes in song['melody']:
        evs = parse_melody(notes, bpm)
        last = evs[-1] if evs else None
        line_dur = (last['start'] + last.get('slot', 1.0) * beat) if last else beat * 2
        lines.append({'start': t, 'dur': line_dur, 'events': evs})
        t = t + line_dur + beat * 0.45
    span = t - 0.3
    total = int((0.3 + span + 0.55) * SR) + 1
    vocal = np.zeros(total)
    accomp = np.zeros(total)

    song_lines = song.get('lines') or []
    for li, ln in enumerate(lines):
        raw = song_lines[li] if li < len(song_lines) else ''
        chars = [c for c in raw if c not in PUNCT]
        sylls = [char_syllable(c) for c in chars]
        sung = [ev for ev in ln['events'] if ev['freq'] > 0]
        prev = None
        for si, ev in enumerate(sung):
            v, has_ini = 'a', False
            if sylls:
                ci = min(len(sylls) - 1, si * len(sylls) // max(1, len(sung)))
                info = sylls[ci]
                if info:
                    v, has_ini = info
            sing_note(vocal, ev['freq'], ln['start'] + ev['start'], ev['dur'] * 1.02, v, prev, has_ini)
            prev = ev['freq']

        chord, root = chord_of([ev['freq'] for ev in ln['events']])
        if root > 0:
            bass_note(accomp, root / 2.0, ln['start'], ln['dur'] * 0.98, BASS_VOL)
            bt = 0.0
            while bt < ln['dur'] - 1e-6:
                for f in chord:
                    pad_note(accomp, f, ln['start'] + bt, beat * 0.85, CHORD_VOL, beat)
                bt += beat

    pv = float(np.max(np.abs(vocal))) if vocal.size else 0.0
    pa = float(np.max(np.abs(accomp))) if accomp.size else 0.0
    peak = max(pv, pa, 1e-9)
    g = 0.85 / peak
    vocal *= g
    accomp *= g
    fade_edges(vocal)
    fade_edges(accomp)
    return vocal, accomp, span, lines


def encode_mp3(samples, path):
    import lameenc
    pcm = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm * 32767.0).astype('<i2')
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm16.tobytes())
    data += enc.flush()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(data))
    return path.stat().st_size


def update_voice_map(entries):
    """把 song:<id>:v/a 追加进 voice-map.js（保留清单外已有条目）。"""
    import re
    path = ROOT / 'js' / 'voice-map.js'
    mapping = {}
    if path.exists():
        for m in re.finditer(r'"([^"\n]+)":\s*"(audio/[^"]+)"', path.read_text(encoding='utf-8')):
            mapping[m.group(1)] = m.group(2)
    mapping.update(entries)
    out = ['/* ============ 预生成配音清单（gen-voice.py 自动生成） ============ */',
           'window.CS_VOICE = {']
    for k in sorted(mapping):
        out.append('  "%s": "%s",' % (k, mapping[k]))
    out.append('};')
    path.write_text('\n'.join(out) + '\n', encoding='utf-8')
    return len(mapping)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='', help='只渲染指定 id（逗号分隔）')
    ap.add_argument('--force', action='store_true', help='已存在也重新渲染')
    args = ap.parse_args()

    tasks_file = ROOT / 'tools' / 'song-tasks.json'
    if not tasks_file.exists():
        print('请先运行: node tools/export-song-tasks.js')
        sys.exit(1)
    songs = json.loads(tasks_file.read_text(encoding='utf-8'))
    if args.ids:
        want = set(x.strip() for x in args.ids.split(',') if x.strip())
        songs = [s for s in songs if s['id'] in want]

    meta_path = ROOT / 'tools' / 'song-meta.json'
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding='utf-8'))
        except Exception:
            meta = {}

    entries = {}
    new_kb = 0
    done = 0
    for s in songs:
        vrel = 'audio/song/s%03d_v.mp3' % s['index']
        arel = 'audio/song/s%03d_a.mp3' % s['index']
        vf = ROOT / vrel
        af = ROOT / arel
        ok = (not args.force and vf.exists() and af.exists()
              and vf.stat().st_size > 2048 and af.stat().st_size > 2048
              and s['id'] in meta)
        if ok:
            entries['song:%s:v' % s['id']] = vrel
            entries['song:%s:a' % s['id']] = arel
            continue
        vocal, accomp, span, lines = render_song(s)
        vs = encode_mp3(vocal, vf)
        asz = encode_mp3(accomp, af)
        new_kb += (vs + asz) // 1024
        meta[s['id']] = {
            'span': round(span, 6),
            'dur': round(len(vocal) / SR, 3),
            'lines': [{'start': round(l['start'], 6), 'dur': round(l['dur'], 6)} for l in lines],
        }
        entries['song:%s:v' % s['id']] = vrel
        entries['song:%s:a' % s['id']] = arel
        done += 1
        print('  %s %s: %.1fs 人声 %dKB 伴奏 %dKB' % (s['id'], s['title'], span, vs // 1024, asz // 1024))

    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    total_map = update_voice_map(entries)
    print('渲染完成: 本次新渲染 %d 首 (+%dKB), 共 %d 首入映射, voice-map 合计 %d 条'
          % (done, new_kb, len(songs), total_map))


if __name__ == '__main__':
    main()
