/* 预渲染儿歌播放引擎冒烟测试：node tools/smoke-song-audio.js
   在 VM 中加载真实 audio.js，用桩 XMLHttpRequest / AudioContext 驱动
   playSongAudio 全流程：双轨加载→混音→KTV 回调→实时开关→静音→停止→缓存重播→解码失败回退。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, cond) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name);
  if (!cond) failures++;
}

function makeEnv(decodeOk) {
  const env = { console };
  env.window = env;
  env.CS = { state: { sound: true } };
  env.CS_VOICE = {
    'song:s1:v': 'audio/song/s001_v.mp3',
    'song:s1:a': 'audio/song/s001_a.mp3'
  };
  const pending = [];
  let timerId = 1;
  env.setTimeout = (fn, ms) => { pending.push({ id: timerId, fn, ms }); return timerId++; };
  env.clearTimeout = (id) => { const i = pending.findIndex((t) => t.id === id); if (i >= 0) pending.splice(i, 1); };
  env.XMLHttpRequest = function () {
    this.status = 0;
    this.open = () => {};
    this.send = () => { setTimeout(() => this.onload(), 0); };
  };
  const gainCalls = [];
  const started = [];
  class FakeGain {
    constructor() { this.gain = { value: 0, setTargetAtTime: (v) => gainCalls.push(Math.round(v * 100) / 100) }; }
    connect() {} disconnect() {}
  }
  class FakeSrc {
    constructor() { this.buffer = null; }
    connect() {} start() { started.push(this); } stop() {} disconnect() {}
  }
  class FakeAC {
    constructor() { this.currentTime = 0; this.destination = {}; }
    resume() {}
    createGain() { return new FakeGain(); }
    createBufferSource() { return new FakeSrc(); }
    decodeAudioData(raw, ok, err) { (decodeOk ? ok : err)({ duration: 37.0 }); }
  }
  env.window.AudioContext = FakeAC;
  return {
    env, pending, gainCalls, started,
    fireTimers: (ms) => {
      pending.filter((t) => t.ms <= ms).forEach((t) => { env.clearTimeout(t.id); t.fn(); });
    },
    timersLeft: () => pending.length
  };
}

function loadAudio(env) {
  vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8'), env, { filename: 'audio.js' });
  return env.CS;
}

const song = {
  id: 's1', bpm: 84,
  lines: ['一闪一闪亮晶晶', '满天都是小星星', '挂在天上放光明', '好像许多小眼睛', '一闪一闪亮晶晶', '满天都是小星星'],
  melody: ['1 1 5 5 6 6 5 -', '4 4 3 3 2 2 1 -', '5 5 4 4 3 3 2 -', '5 5 4 4 3 3 2 -', '1 1 5 5 6 6 5 -', '4 4 3 3 2 2 1 -']
};

async function main() {
  /* --- 场景 1：正常播放 + KTV 时间轴回调 --- */
  console.log('场景1: 双轨加载 + KTV 回调 + 自然结束');
  {
    const kit = makeEnv(true);
    const CS = loadAudio(kit.env);
    check('hasSongAudio 识别到双轨', CS.hasSongAudio(song) === true);
    check('无文件的歌回退判定', CS.hasSongAudio({ id: 'sX' }) === false);

    const fired = { line: 0, char: 0, end: 0, fallback: 0 };
    CS.playSongAudio(song, { vocal: true, accomp: true }, {
      onLine: () => fired.line++,
      onChar: () => fired.char++,
      onEnd: () => fired.end++,
      onFallback: () => fired.fallback++
    });
    await sleep(20);
    check('两轨同时启动（样本级同步的前提）', kit.started.length === 2);
    const init = kit.gainCalls.slice(0, 2).sort();
    check('初始混音 vocal/accomp=0.95', init[0] === 0.95 && init[1] === 0.95);

    kit.fireTimers(500);
    check('第一句在 ~420ms 高亮（0.3s 前奏 + 120ms 启动延迟）', fired.line === 1 && fired.char === 0);
    kit.fireTimers(1400);
    check('逐字高亮开始推进', fired.char >= 1);
    kit.fireTimers(40000);
    check('全部 6 句高亮、37.2s 自然结束', fired.line === 6 && fired.end === 1 && fired.fallback === 0);
    check('结束后无残留定时器', kit.timersLeft() === 0);
  }

  /* --- 场景 2：播放中实时开关 + 静音联动 --- */
  console.log('场景2: 实时开关原唱/伴奏 + 静音');
  {
    const kit = makeEnv(true);
    const CS = loadAudio(kit.env);
    const fired = { line: 0, char: 0, end: 0, fallback: 0 };
    CS.playSongAudio(song, { vocal: true, accomp: true }, {
      onLine: () => fired.line++, onChar: () => fired.char++,
      onEnd: () => fired.end++, onFallback: () => fired.fallback++
    });
    await sleep(20);

    CS.setSongMix(false, true); // 关原唱只留伴奏（卡拉OK）
    let last = kit.gainCalls.slice(-2).sort();
    check('关原唱: vocal→0 / accomp→0.95', last[0] === 0 && last[1] === 0.95);
    CS.setMuted(true);
    last = kit.gainCalls.slice(-2).sort();
    check('全局静音: 双轨→0', last[0] === 0 && last[1] === 0);
    CS.setMuted(false);
    CS.setSongMix(false, true);
    last = kit.gainCalls.slice(-2).sort();
    check('解除静音后恢复伴奏', last[0] === 0 && last[1] === 0.95);
    check('混音操作不打断播放（无新启动）', kit.started.length === 2);
    CS.stopSongAudio();
    kit.fireTimers(99999);
    check('停止后不再触发任何回调', fired.end === 0 && fired.line === 0);
  }

  /* --- 场景 3：缓存重播（再来一次即时起播） --- */
  console.log('场景3: 停止后立即重播走缓存');
  {
    const kit = makeEnv(true);
    const CS = loadAudio(kit.env);
    const cb = { onLine() {}, onChar() {}, onEnd() {} };
    CS.playSongAudio(song, {}, cb);
    await sleep(20);
    CS.stopSongAudio();
    CS.playSongAudio(song, {}, cb);
    await sleep(10);
    check('重播无需重新下载解码（新起两轨）', kit.started.length === 4);
  }

  /* --- 场景 4：解码失败回退实时合成 --- */
  console.log('场景4: 解码失败触发 onFallback');
  {
    const kit = makeEnv(false);
    const CS = loadAudio(kit.env);
    const fired = { fallback: 0, end: 0 };
    CS.playSongAudio(song, {}, {
      onLine() {}, onChar() {},
      onEnd: () => fired.end++,
      onFallback: () => fired.fallback++
    });
    await sleep(20);
    check('解码失败 → onFallback（前端回退实时合成）', fired.fallback === 1);
    check('失败后不触发 onEnd', fired.end === 0);
  }

  console.log(failures ? '\n冒烟测试失败 ' + failures + ' 项!' : '\n冒烟测试全部通过 ✓');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
