/* 配音集成最终验证：node tools/verify-voice.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

for (const root of [ROOT, path.join(ROOT, '..', 'children_study_android', 'app', 'src', 'main', 'assets', 'www')]) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.endsWith('.js'));
  const missing = srcs.filter((s) => !fs.existsSync(path.join(root, s)));
  console.log((root.includes('android') ? 'Android' : '网页') + ' 端: ' + srcs.length + ' 个脚本, 缺失: ' + (missing.length ? missing.join(',') : '无'));
}

const map = fs.readFileSync(path.join(ROOT, 'js/voice-map.js'), 'utf8');
const keys = [...map.matchAll(/"([^"]+)":/g)].map((m) => m[1]);
console.log('voice-map: poem=' + keys.filter((k) => k.startsWith('poem:')).length +
  ' char=' + keys.filter((k) => k.startsWith('char:')).length +
  ' text=' + keys.filter((k) => k.startsWith('text:')).length +
  ' 合计=' + keys.length);

let fail = 0;
keys.forEach((k) => {
  const m = /: "(audio\/[^"]+)"/.exec(map.slice(map.indexOf('"' + k + '"')));
  if (!m || !fs.existsSync(path.join(ROOT, m[1]))) { fail++; console.log('缺文件: ' + k); }
});
console.log(fail === 0 ? '全部映射文件存在 ✓' : '缺失 ' + fail + ' 个文件!');

const poemJs = fs.readFileSync(path.join(ROOT, 'js/modules/poem.js'), 'utf8');
const litJs = fs.readFileSync(path.join(ROOT, 'js/modules/literacy.js'), 'utf8');
const textJs = fs.readFileSync(path.join(ROOT, 'js/modules/text.js'), 'utf8');
const audioJs = fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8');
console.log('poem.js 传key: ' + poemJs.includes("{ key: 'poem:' + poem.id }"));
console.log('literacy.js 字卡传key: ' + litJs.includes("{ key: 'char:' + state.age + ':' + c.char }"));
console.log('literacy.js 游戏传key: ' + litJs.includes('{ key: voiceKey }'));
console.log('text.js 传key: ' + textJs.includes("{ key: 'text:' + text.id }"));
console.log('audio.js 文件优先: ' + audioJs.includes('hasVoice(key)'));
console.log('audio.js 停止播文件: ' + /function stopSpeak\(\) \{\s*stopVoiceFile\(\);/.test(audioJs));
