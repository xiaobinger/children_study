# -*- coding: utf-8 -*-
"""儿歌音调自动校验：对渲染出的人声轨做 f0 提取，逐音符比对期望音高。

原理：按与前端/js 一致的时间轴算出每个音符的期望起止与频率，
用 librosa.pyin 从 audio/song/sNNN_v.mp3 提取实际基频，
取每个音符稳定段（15%~75% 占槽）的中位 f0，折算音分偏差（按八度折叠）。
|偏差| > threshold（默认 50 音分）的音符判为不准。

用法: python tools/verify-song-pitch.py [--ids s1,s2] [--threshold 50]
输出: 控制台摘要 + tools/song-pitch-report.json 全量报告
依赖: tools/pylibs310（librosa/numpy/soundfile）
"""
import sys
import json
import argparse
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools' / 'pylibs310'))

import numpy as np
import librosa

# 复用渲染器的曲谱解析与时间数学（唯一时间真相源）
_spec = importlib.util.spec_from_file_location('gen_song_svs', ROOT / 'tools' / 'gen-song-svs.py')
_gss = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gss)
parse_melody = _gss.parse_melody
line_duration = _gss.line_duration

SR = 22050
HOP = 256
FMIN = 180.0   # 童声基频下限
FMAX = 900.0   # 童声基频上限


def expected_events(song):
    """与 js computeSongTimeline 完全一致的期望音符时间轴。"""
    bpm = song.get('bpm') or 100
    beat = 60.0 / bpm
    t = 0.3
    out = []
    for li, notes in enumerate(song['melody']):
        evs = parse_melody(notes, bpm)
        for ev in evs:
            if ev.get('rest') or ev['freq'] <= 0:
                continue
            out.append({
                'line': li,
                'start': t + ev['start'],
                'slot_dur': ev['slot'] * beat,
                'freq': ev['freq'],
            })
        t = t + line_duration(evs, beat) + beat * 0.45
    return out


def fold_cents(c):
    """折算到 [-600, 600)，消除八度误判。"""
    return (c + 600.0) % 1200.0 - 600.0


def verify_song(song, threshold):
    vf = ROOT / 'audio' / 'song' / ('s%03d_v.mp3' % song['index'])
    if not vf.exists():
        return {'id': song['id'], 'title': song['title'], 'error': '人声文件缺失'}
    y, _ = librosa.load(str(vf), sr=SR, mono=True)
    f0, vflag, _vprob = librosa.pyin(
        y, fmin=FMIN, fmax=FMAX, sr=SR,
        frame_length=2048, hop_length=HOP)
    times = librosa.frames_to_time(np.arange(len(f0)), sr=SR, hop_length=HOP)

    notes = []
    for ev in expected_events(song):
        t0 = ev['start'] + ev['slot_dur'] * 0.15
        t1 = ev['start'] + ev['slot_dur'] * 0.75
        m = (times >= t0) & (times <= t1) & vflag
        seg = f0[m]
        seg = seg[~np.isnan(seg)]
        if seg.size < 4:
            notes.append({**ev, 'measured': None, 'cents': None, 'skip': '有声帧不足'})
            continue
        med = float(np.median(seg))
        cents = fold_cents(1200.0 * np.log2(med / ev['freq']))
        notes.append({**ev, 'measured': round(med, 2), 'cents': round(cents, 1)})

    valid = [n for n in notes if n['cents'] is not None]
    bad = [n for n in valid if abs(n['cents']) > threshold]
    skipped = [n for n in notes if n['cents'] is None]
    abs_dev = [abs(n['cents']) for n in valid]
    worst = sorted(valid, key=lambda n: -abs(n['cents']))[:5]
    return {
        'id': song['id'],
        'title': song['title'],
        'notes_total': len(notes),
        'notes_valid': len(valid),
        'notes_skipped': len(skipped),
        'notes_bad': len(bad),
        'bad_pct': round(100.0 * len(bad) / max(1, len(valid)), 1),
        'median_abs_cents': round(float(np.median(abs_dev)), 1) if abs_dev else None,
        'p90_abs_cents': round(float(np.percentile(abs_dev, 90)), 1) if abs_dev else None,
        'bad_notes': [{'line': n['line'], 'start': round(n['start'], 2),
                       'expect': round(n['freq'], 1), 'measured': n['measured'],
                       'cents': n['cents']} for n in bad],
        'worst': [{'line': n['line'], 'start': round(n['start'], 2),
                   'expect': round(n['freq'], 1), 'measured': n['measured'],
                   'cents': n['cents']} for n in worst],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='')
    ap.add_argument('--threshold', type=float, default=50.0)
    args = ap.parse_args()

    tasks = json.loads((ROOT / 'tools' / 'song-tasks.json').read_text(encoding='utf-8'))
    if args.ids:
        keep = set(args.ids.split(','))
        tasks = [s for s in tasks if s['id'] in keep]

    print('=' * 72)
    print('儿歌音调校验（阈值 ±%.0f 音分，按八度折叠）' % args.threshold)
    print('=' * 72)
    results = []
    for s in tasks:
        r = verify_song(s, args.threshold)
        results.append(r)
        if 'error' in r:
            print('%-4s %-14s %s' % (r['id'], r['title'], r['error']))
            continue
        flag = '✓' if r['notes_bad'] == 0 else ('△' if r['bad_pct'] <= 10 else '✗')
        print('%-4s %-14s %s 音符 %3d 个, 偏差中位 %5.1f¢, P90 %5.1f¢, 超阈 %2d (%.1f%%)'
              % (r['id'], r['title'], flag, r['notes_valid'],
                 r['median_abs_cents'] or -1, r['p90_abs_cents'] or -1,
                 r['notes_bad'], r['bad_pct']))
        for n in r['bad_notes'][:5]:
            print('      行%d @%.2fs 期望 %.1fHz 实测 %.1fHz 偏差 %+.1f¢'
                  % (n['line'] + 1, n['start'], n['expect'], n['measured'], n['cents']))

    out = ROOT / 'tools' / 'song-pitch-report.json'
    out.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding='utf-8')
    ok = sum(1 for r in results if 'error' not in r and r['notes_bad'] == 0)
    warn = sum(1 for r in results if 'error' not in r and 0 < r['bad_pct'] <= 10)
    bad = sum(1 for r in results if 'error' not in r and r['bad_pct'] > 10)
    print('-' * 72)
    print('汇总: %d 首受检, ✓全部达标 %d, △少量偏差 %d, ✗需返工 %d；报告 %s'
          % (len(results), ok, warn, bad, out))


if __name__ == '__main__':
    main()
