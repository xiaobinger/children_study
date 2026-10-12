"""儿歌简谱 → DiffSinger DS 文件转换器（童声演唱版）

把 js/data/songs.js 的 melody（简谱）+ lines（歌词）转成 DiffSinger 的 .ds
输入文件（每行歌词一个 section），供 gen-song-svs.py 用绮萱童声声库演唱。

音素映射说明（关键）：
绮萱 v2.7.0 使用全新的多语言音素集（zh/ en/ ja/ 前缀），例如
  星→xing→[zh/x, zh/ing]，许→xu→[zh/x, zh/v]，眼→yan→[zh/y, zh/ian]
旧版 DSTextReplacer（opencpop-extension）产出的是 y En / x v 等旧音素，
在 v2.7.0 声库里不存在，会直接 KeyError。因此这里改为：
  1) pypinyin 把每个汉字转成无调拼音（ü 写作 v，与声库一致）
  2) 用声库自带的 dsdict-zh.yaml（grapheme=拼音 → 音素列表）查表
  3) ph_num = 每个字（词）的音素个数，严格 1:1 对齐音符
这样既消除 KeyError，又修正了旧方案 ph_num 错位导致的“一卡一卡”。

时间轴与前端 js/audio.js computeSongTimeline 严格一致：
- 行起始 offset = lineStart
- 音符时长 note_dur = ev.dur / 0.9（JS 里音符间距是 dur/0.9）
这样 KTV 逐字高亮与歌声才能对齐。

用法: python tools/song2ds.py [--ids s1,s2]
输出: tools/song-ds/<id>.ds
"""
import sys
import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "pylibs310"))

from pypinyin import pinyin, Style

VB_DICT = (ROOT / 'tools' / 'qixuan_vb' / 'Qixuan_v2.7.0_DiffSinger_OpenUtau'
           / 'dsdur' / 'dsdict-zh.yaml')

# C 大调唱名 → 音名（与前端 NOTE_FREQ 相同的八度约定：1=C4）
NOTE_NAME = {
    '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4', '5': 'G4', '6': 'A4', '7': 'B4',
    '1+': 'C5', '2+': 'D5', '3+': 'E5', '4+': 'F5', '5+': 'G5', '6+': 'A5', '7+': 'B5',
    '1_': 'C3', '2_': 'D3', '3_': 'E3', '4_': 'F3', '5_': 'G3', '6_': 'A3', '7_': 'B3',
}

PUNCT = set('，。！？、,.!?；;：:…—·~ "“”‘’()（）[]【】《》')

# 多音字纠偏（pypinyin 默认读音不合儿歌语境的）
PINYIN_OVERRIDE = {
    '的': 'de', '了': 'le', '着': 'zhe', '和': 'he', '行': 'xing',
    '乐': 'le', '觉': 'jue', '长': 'chang', '重': 'chong', '数': 'shu',
    '曲': 'qu', '发': 'fa', '只': 'zhi', '种': 'zhong', '好': 'hao',
    '空': 'kong', '干': 'gan', '为': 'wei', '还': 'hai', '都': 'dou',
}


def load_grapheme_dict(path):
    """流式解析声库 dsdict-zh.yaml 的 entries 段：拼音 → 音素列表。"""
    d = {}
    cur = None
    started = False
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            if not started:
                if line.rstrip('\n').strip() == 'entries:':
                    started = True
                continue
            if line.startswith('- grapheme:'):
                cur = line.split(':', 1)[1].strip()
                d[cur] = []
            elif line.startswith('  - ') and cur is not None:
                d[cur].append(line.strip()[2:].strip())
    return d


_GDICT = None


def get_gdict():
    global _GDICT
    if _GDICT is None:
        _GDICT = load_grapheme_dict(VB_DICT)
    return _GDICT


def char_phonemes(ch, d):
    """单个汉字 → 音素列表（查不到返回 None）。"""
    if ch in PINYIN_OVERRIDE:
        p = PINYIN_OVERRIDE[ch]
    else:
        res = pinyin(ch, style=Style.NORMAL, errors=lambda x: [''])
        if not res or not res[0] or not res[0][0]:
            return None
        p = res[0][0]
    return d.get(p)


def text_to_words(text, d):
    """整行歌词 → 词列表，每个词是音素列表（跳过无读音字符）。"""
    words = []
    dropped = []
    for ch in text:
        ph = char_phonemes(ch, d)
        if ph:
            words.append(ph)
        else:
            dropped.append(ch)
    return words, dropped


def parse_melody(notes, bpm):
    """与前端 js/audio.js parseMelody 逐行对齐。
    语法：音高(1-7，_低八度 +高八度，0=休止) + 可选 *N 时值后缀(N 拍，默认 1，支持小数)。
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
            events.append({'freq': '', 'start': t, 'dur': slot_dur, 'slot': slot, 'rest': True})
            t += slot_dur
            continue
        freq = NOTE_NAME.get(key, '')
        events.append({'freq': freq, 'start': t, 'dur': slot_dur * 0.9, 'slot': slot})
        t += slot_dur
    return events


def slur_for(n_words, events):
    """字数 vs 可唱音符数 → note_slur 序列。slur=1 表示该音不新增词（拖腔/休止）。"""
    singable = [not ev.get('rest') for ev in events]
    m = sum(singable)
    slur = [0] * len(events)
    # 休止符一律标记为跟随（不发音、不占词位）
    for i, ev in enumerate(events):
        if ev.get('rest'):
            slur[i] = 1
    if m == n_words:
        return slur
    if m > n_words:
        # 多出的可唱音符依次作为前 (m-n_words) 个字的拖腔
        extra = m - n_words
        ci = 0          # 已分配的字数
        idx = [i for i, s in enumerate(singable) if s]
        for k, i in enumerate(idx):
            if extra <= 0 or ci >= n_words:
                break
            if k + 1 < len(idx):
                slur[idx[k + 1]] = 1
                extra -= 1
                ci += 1
    return slur


def song_to_ds(song):
    """整首歌 → DS section 列表（一行一个 section）。"""
    bpm = song.get('bpm') or 100
    d = get_gdict()
    sections = []
    t = 0.3
    for li, notes in enumerate(song['melody']):
        events = parse_melody(notes, bpm)
        last = events[-1] if events else None
        beat = 60.0 / bpm
        # 行时长按占槽总时长计（与前端 computeSongTimeline 一致）
        line_dur = (last['start'] + last['slot'] * beat) if last else beat * 2
        line_start = t
        t = line_start + line_dur + beat * 0.45

        raw = song['lines'][li] if li < len(song['lines']) else ''
        chars = [c for c in raw if c not in PUNCT]
        text = ''.join(chars)
        words, dropped = text_to_words(text, d)
        if dropped:
            print('  [warn] %s 行%d 丢弃无读音字符: %s' % (song['id'], li + 1, ''.join(dropped)))

        n_sing = sum(1 for ev in events if not ev.get('rest'))
        if n_sing < len(words):
            print('  [warn] %s 行%d 可唱音符(%d)少于字数(%d)，请补谱'
                  % (song['id'], li + 1, n_sing, len(words)))

        note_seq = [ev['freq'] if ev['freq'] else 'rest' for ev in events]
        # note_dur 用占槽时长，保证 sum(note_dur) == line_dur（时间轴严格一致）
        note_dur = [round(ev['slot'] * beat, 6) for ev in events]
        slur = slur_for(len(words), events)

        ph_seq = ' '.join(p for w in words for p in w)
        ph_num = ' '.join(str(len(w)) for w in words)

        sec = {
            'offset': round(line_start, 6),
            'text': text,
            'note_seq': ' '.join(note_seq),
            'note_dur': ' '.join(str(x) for x in note_dur),
            'note_slur': ' '.join(str(s) for s in slur),
            'ph_seq': ph_seq,
            'ph_num': ph_num,
        }
        sections.append(sec)
    return sections, t - 0.3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='', help='只转换指定 id（逗号分隔）')
    args = ap.parse_args()

    tasks_file = ROOT / 'tools' / 'song-tasks.json'
    if not tasks_file.exists():
        print('请先运行: node tools/export-song-tasks.js')
        sys.exit(1)
    songs = json.loads(tasks_file.read_text(encoding='utf-8'))
    if args.ids:
        want = set(x.strip() for x in args.ids.split(',') if x.strip())
        songs = [s for s in songs if s['id'] in want]

    out_dir = ROOT / 'tools' / 'song-ds'
    out_dir.mkdir(parents=True, exist_ok=True)
    for s in songs:
        sections, span = song_to_ds(s)
        out = out_dir / (s['id'] + '.ds')
        out.write_text(json.dumps(sections, ensure_ascii=False, indent=1), encoding='utf-8')
        n_notes = sum(len(sec['note_seq'].split()) for sec in sections)
        print('%s %s: %d 行, %d 音符, span=%.1fs' % (s['id'], s['title'], len(sections), n_notes, span))
    print('DS 文件已生成: %d 首 → tools/song-ds/' % len(songs))


if __name__ == '__main__':
    main()