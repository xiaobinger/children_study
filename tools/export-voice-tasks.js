/* 导出朗读任务清单：给 gen-voice.py 生成 mp3 用
   用法: node tools/export-voice-tasks.js
   输出: tools/voice-tasks.json  [{key, text, file}] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;

const files = [
  'js/data/poems.js', 'js/data/poems-a1.js', 'js/data/poems-a2.js', 'js/data/poems-a3.js', 'js/data/poems-a4.js',
  'js/data/characters.js', 'js/data/chars-a1.js', 'js/data/chars-a2.js', 'js/data/chars-a3.js', 'js/data/chars-a4.js',
  'js/data/texts.js', 'js/data/stories.js'
];
files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const D = ctx.CS.DATA;
const tasks = [];
const pad = (n, w) => String(n).padStart(w, '0');

D.poems.forEach((p, i) => {
  tasks.push({
    key: 'poem:' + p.id,
    text: p.title + '，' + p.author + '。' + p.lines.join(''),
    file: 'audio/poem/p' + pad(i + 1, 3) + '.mp3'
  });
});

['a1', 'a2', 'a3', 'a4'].forEach((age) => {
  (D.characters[age] || []).forEach((c, i) => {
    const text = c.char.length > 2
      ? c.char + '。' + c.sent
      : c.char + '，' + c.word + '。' + c.sent;
    tasks.push({
      key: 'char:' + age + ':' + c.char,
      text,
      file: 'audio/char/' + age + '_c' + pad(i + 1, 3) + '.mp3'
    });
  });
});

D.texts.forEach((t, i) => {
  tasks.push({
    key: 'text:' + t.id,
    text: t.title + '。' + t.passage.join(''),
    file: 'audio/text/t' + pad(i + 1, 3) + '.mp3'
  });
});

D.stories.forEach((s, i) => {
  tasks.push({
    key: 'story:' + s.id,
    text: s.title + '。' + s.passage.join(''),
    file: 'audio/story/s' + pad(i + 1, 3) + '.mp3'
  });
});

fs.mkdirSync(path.join(ROOT, 'tools'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/voice-tasks.json'), JSON.stringify(tasks, null, 1), 'utf8');
console.log('导出完成: ' + tasks.length + ' 条朗读任务');
console.log('  古诗: ' + D.poems.length + '  字卡: ' + (D.characters.a1.length + D.characters.a2.length + D.characters.a3.length + D.characters.a4.length) + '  课文: ' + D.texts.length + '  童话: ' + D.stories.length);
