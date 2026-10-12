/* 导出儿歌渲染任务清单：给 gen-song.py 离线渲染人声轨/伴奏轨 mp3 用
   用法: node tools/export-song-tasks.js
   输出: tools/song-tasks.json  [{index, id, title, bpm, lines, melody}]
   index 与 export-voice-tasks.js 的儿歌朗读编号保持一致（按 songs 总表顺序） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;

vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data/songs.js'), 'utf8'), ctx, { filename: 'songs.js' });
const songs = ctx.CS.DATA.songs;

const tasks = [];
songs.forEach((s, i) => {
  if (!Array.isArray(s.melody) || !s.melody.length) return;
  tasks.push({
    index: i + 1,
    id: s.id,
    title: s.title,
    bpm: s.bpm || 100,
    lines: s.lines,
    melody: s.melody
  });
});

fs.writeFileSync(path.join(ROOT, 'tools/song-tasks.json'), JSON.stringify(tasks, null, 1), 'utf8');
console.log('导出完成: ' + tasks.length + ' 首带旋律儿歌');
