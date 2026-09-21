"""Edge TTS 批量配音生成器
用法: python tools/gen-voice.py [--what poem,char,text] [--limit N] [--concurrency 5]
生成: audio/**/*.mp3 + js/voice-map.js
"""
import asyncio
import json
import argparse
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-10%"
PITCH = "+0Hz"

async def gen_one(task, sem, stats):
    out = ROOT / task["file"]
    if out.exists() and out.stat().st_size > 1024:
        stats["skip"] += 1
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(3):
            try:
                tts = edge_tts.Communicate(task["text"], VOICE, rate=RATE, pitch=PITCH)
                await tts.save(str(out))
                stats["ok"] += 1
                if stats["ok"] % 25 == 0:
                    print(f"  已生成 {stats['ok']} / {stats['total']}", flush=True)
                return
            except Exception as e:
                if attempt == 2:
                    stats["fail"] += 1
                    print(f"  [失败] {task['key']}: {e}", flush=True)
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--what", default="poem,char,text,story", help="生成哪些类别")
    parser.add_argument("--limit", type=int, default=0, help="限制条数(测试用)")
    parser.add_argument("--concurrency", type=int, default=5)
    args = parser.parse_args()

    tasks_file = ROOT / "tools" / "voice-tasks.json"
    if not tasks_file.exists():
        print("请先运行: node tools/export-voice-tasks.js")
        sys.exit(1)

    tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
    cats = set(args.what.split(","))
    tasks = [t for t in tasks if t["key"].split(":")[0] in cats]
    if args.limit:
        tasks = tasks[: args.limit]

    # 重新编号文件名（只对选中的类别，保持与全量生成时一致的排序）
    print(f"待生成: {len(tasks)} 条 (类别: {sorted(cats)})")
    stats = {"ok": 0, "skip": 0, "fail": 0, "total": len(tasks)}
    sem = asyncio.Semaphore(args.concurrency)
    await asyncio.gather(*(gen_one(t, sem, stats) for t in tasks))
    print(f"完成: 成功 {stats['ok']}  跳过(已存在) {stats['skip']}  失败 {stats['fail']}")

    # 生成 voice-map.js（只收录实际存在的文件）
    mapping = {}
    for t in json.loads(tasks_file.read_text(encoding="utf-8")):
        f = ROOT / t["file"]
        if f.exists() and f.stat().st_size > 1024:
            mapping[t["key"]] = t["file"]
    out_js = ROOT / "js" / "voice-map.js"
    lines = ["/* ============ 预生成配音清单（gen-voice.py 自动生成） ============ */",
             "window.CS_VOICE = {"]
    for k in sorted(mapping):
        lines.append(f'  "{k}": "{mapping[k]}",')
    lines.append("};")
    out_js.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"voice-map.js 已生成: {len(mapping)} 条映射")
    if stats["fail"] > 0:
        sys.exit(2)

if __name__ == "__main__":
    asyncio.run(main())
