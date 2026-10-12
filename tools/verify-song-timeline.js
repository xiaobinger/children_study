/* 时间轴一致性校验：node tools/verify-song-timeline.js [--svs]
   对比渲染端记录的工具/song-meta.json（或 --svs 用 tools/song-svs-meta.json）
   与前端 computeSongTimeline 的计算结果——两者必须逐行一致（误差 < 2ms），
   KTV 高亮才能和音频对齐。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const useSvs = process.argv.includes('--svs');
const ctx = vm.createContext({ console });
ctx.window = ctx;
ctx.CS = { state: { sound: true } };

vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8'), ctx, { filename: 'audio.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data/songs.js'), 'utf8'), ctx, { filename: 'songs.js' });
const CS = ctx.CS;

const metaPath = path.join(ROOT, useSvs ? 'tools/song-svs-meta.json' : 'tools/song-meta.json');
if (!fs.existsSync(metaPath)) {
  console.log('缺少 ' + path.basename(metaPath) + '，请先运行相应渲染脚本');
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

let fail = 0;
let n = 0;
const EPS = 0.002;
for (const [id, m] of Object.entries(meta)) {
  const song = CS.DATA.songs.find((s) => s.id === id);
  if (!song) { fail++; console.log('meta 中的歌曲在 songs.js 里不存在: ' + id); continue; }
  n++;
  const tl = CS._computeSongTimeline(song);
  if (Math.abs(tl.span - m.span) > EPS) {
    fail++; console.log(id + ' 总时长不一致: js=' + tl.span.toFixed(4) + ' py=' + m.span.toFixed(4)); continue;
  }
  if (tl.lines.length !== m.lines.length) {
    fail++; console.log(id + ' 行数不一致: js=' + tl.lines.length + ' py=' + m.lines.length); continue;
  }
  for (let i = 0; i < tl.lines.length; i++) {
    if (Math.abs(tl.lines[i].lineStart - m.lines[i].start) > EPS ||
        Math.abs(tl.lines[i].lineDur - m.lines[i].dur) > EPS) {
      fail++;
      console.log(id + ' 第' + (i + 1) + '行不一致: js=[' + tl.lines[i].lineStart.toFixed(4) + ',' +
        tl.lines[i].lineDur.toFixed(4) + '] py=[' + m.lines[i].start.toFixed(4) + ',' + m.lines[i].dur.toFixed(4) + ']');
      break;
    }
  }
}
console.log('时间轴校验: ' + n + ' 首, ' + (fail ? '不一致 ' + fail + ' 处!' : '全部一致 ✓'));
process.exit(fail ? 1 : 0);
