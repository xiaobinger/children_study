/* ============ 音频引擎：音效 / 旋律 / 语音朗读 ============ */
/* 优先走 Android 原生 CsAudio 桥（SoundPool + TTS），不可用时回退 Web Audio API */
window.CS = window.CS || {};

(function (CS) {
  'use strict';

  const useNative = typeof CsAudio !== 'undefined'; // Android WebView 注入的原生桥
  let ctx = null;
  let muted = !CS.state.sound;

  /* ---------- 原生桥封装 ---------- */
  const nativePlayTone = useNative
    ? (freq, startMs, durMs, type, vol) => {
        try { CsAudio.playTone(freq, startMs, durMs, type || 'sine', vol == null ? 0.22 : vol); }
        catch (e) { /* 静默失败 */ }
      }
    : null;

  const nativeSpeak = useNative
    ? (text) => {
        try { return CsAudio.speak(text); }
        catch (e) { return '{"ok":false}'; }
      }
    : null;

  const nativeStopSpeak = useNative
    ? () => {
        try { CsAudio.stopSpeak(); } catch (e) {}
      }
    : null;

  const nativeStopTones = useNative
    ? () => {
        try { CsAudio.stopTones(); } catch (e) {}
      }
    : null;

  /* ---------- Web Audio 回退 ---------- */
  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function webPlayTone(freq, start, dur, type, vol) {
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const v = vol == null ? 0.22 : vol;
    gain.gain.setValueAtTime(0.0001, c.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(v, c.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime + start);
    osc.stop(c.currentTime + start + dur + 0.05);
  }

  /* ---------- 统一播放接口：用原生 bridge 时转为毫秒 ---------- */
  function playTone(freq, start, dur, type, vol) {
    if (useNative) {
      nativePlayTone(freq, Math.round(start * 1000), Math.round(dur * 1000), type, vol);
    } else {
      webPlayTone(freq, start, dur, type, vol);
    }
  }

  const sfx = {
    tap() { if (muted) return; playTone(600, 0, 0.08, 'triangle', 0.12); },
    correct() {
      if (muted) return;
      playTone(523.25, 0, 0.12, 'sine', 0.22);
      playTone(659.25, 0.1, 0.12, 'sine', 0.22);
      playTone(783.99, 0.2, 0.25, 'sine', 0.22);
    },
    wrong() {
      if (muted) return;
      playTone(220, 0, 0.18, 'triangle', 0.18);
      playTone(185, 0.15, 0.25, 'triangle', 0.18);
    },
    star() {
      if (muted) return;
      [784, 988, 1175, 1568].forEach((f, i) => playTone(f, i * 0.09, 0.15, 'sine', 0.18));
    },
    finish() {
      if (muted) return;
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => playTone(f, i * 0.13, 0.2, 'sine', 0.2));
    }
  };

  /* ---------- 旋律播放（简谱：数字=C大调唱名，时值单位=拍） ---------- */
  const NOTE_FREQ = {
    1: 261.63, 2: 293.66, 3: 329.63, 4: 349.23, 5: 392.0, 6: 439.99, 7: 493.88,
    '1+': 523.25, '2+': 587.33, '3+': 659.25, '4+': 698.46, '5+': 783.99, '6+': 879.99, '7+': 987.77,
    '1_': 130.81, '2_': 146.83, '3_': 164.81, '4_': 174.61, '5_': 196.0, '6_': 220.0, '7_': 246.94,
    0: 0
  };

  /**
   * notes: "1 1 5*0.5 5*0.5 6 6 5*2" 空格分词；
   * 音高：数字 1-7，"_"后缀低八度，"+"后缀高八度，"0"=休止符；
   * 时值："*N"后缀=N 拍（默认 1 拍，支持 0.5/1.5 等小数）；
   * 兼容旧语法：尾部 "-"=2拍、"--"=3拍、独立 "-"=1拍休止。
   * 返回 [{freq, start, dur, slotDur, rest?}]（秒）；slotDur=占槽总时长，dur=发声时长(0.9槽)
   */
  function parseMelody(notes, bpm) {
    const beat = 60 / (bpm || 100);
    const tokens = notes.trim().split(/\s+/).filter(Boolean);
    let t = 0;
    return tokens.map((tk) => {
      let slot = 1, key = tk;
      const star = tk.indexOf('*');
      if (star >= 0) {
        const b = parseFloat(tk.slice(star + 1));
        if (b > 0) slot = b;
        key = tk.slice(0, star);
      } else if (tk === '-') { key = '0'; }
      else if (tk.endsWith('--')) { slot = 3; key = tk.slice(0, -2); }
      else if (tk.endsWith('-')) { slot = 2; key = tk.slice(0, -1); }
      const slotDur = slot * beat;
      if (key === '0') {
        const ev = { freq: -1, start: t, dur: slotDur, slotDur, rest: true, at: t };
        t += slotDur;
        return ev;
      }
      const freq = NOTE_FREQ[key] || 0;
      const ev = { freq, start: t, dur: slotDur * 0.9, slotDur, at: t };
      t += slotDur;
      return ev;
    });
  }

  let melodyTimer = null;
  let melodyHandlers = { onNote: null, onEnd: null };

  function stopMelody() {
    if (melodyTimer) { clearTimeout(melodyTimer); melodyTimer = null; }
    melodyHandlers = { onNote: null, onEnd: null };
    if (useNative) nativeStopTones();
  }

  function playMelody(notes, bpm, onNote, onEnd) {
    stopMelody();
    if (muted) { onEnd && onEnd(); return }
    const c = useNative ? { currentTime: 0 } : ensureCtx();
    if (!c) { onEnd && onEnd(); return }
    const events = parseMelody(notes, bpm);
    const t0 = 0.15;
    events.forEach((ev, i) => {
      if (ev.freq > 0) {
        playTone(ev.freq, t0 + ev.start, ev.dur, 'triangle', 0.2);
        playTone(ev.freq / 2, t0 + ev.start, ev.dur, 'sine', 0.08);
      }
      melodyTimer = setTimeout(() => {
        onNote && onNote(i, events);
      }, (t0 + ev.start) * 1000);
    });
    const total = (events.length ? events[events.length - 1].start + events[events.length - 1].dur : 0) + t0;
    melodyTimer = setTimeout(() => {
      melodyTimer = null;
      onEnd && onEnd();
    }, total * 1000 + 200);
    return events;
  }

  /* ---------- 儿歌 KTV：演唱声部 + 伴奏声部 ---------- */
  /* 演唱声部用"声带谐波 + 颤音 + 元音共振峰"合成，听感是有人在唱"啊～"，不是电子琴音 */
  let vocalBus = null;
  let accompBus = null;
  let arrTimers = [];

  function makeBus(gain) {
    const c = ensureCtx();
    if (!c) return null;
    const g = c.createGain();
    g.gain.value = gain;
    g.connect(c.destination);
    return g;
  }

  function killBuses() {
    arrTimers.forEach(clearTimeout);
    arrTimers = [];
    if (vocalBus) { try { vocalBus.disconnect(); } catch (e) {} vocalBus = null; }
    if (accompBus) { try { accompBus.disconnect(); } catch (e) {} accompBus = null; }
  }

  /* 唱一个音：基频 + 5 个谐波模拟声带，LFO 颤音，三处共振峰塑形（/a/ 元音） */
  function singNote(bus, freq, start, dur, vol) {
    const c = ensureCtx();
    if (!c || !bus || !freq || freq <= 0 || dur <= 0) return;
    const t = c.currentTime + start;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.07);
    env.gain.setValueAtTime(vol, t + Math.max(0.09, dur - 0.14));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 0.5], [2, 0.26], [3, 0.16], [4, 0.09], [5, 0.055]].forEach(([h, gv]) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * h;
      const g = c.createGain();
      g.gain.value = gv;
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.3;
      const lg = c.createGain();
      lg.gain.value = freq * h * 0.007;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      osc.connect(g);
      g.connect(env);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + dur + 0.06);
      lfo.stop(t + dur + 0.06);
    });
    [[720, 1.0], [1240, 0.55], [2600, 0.22]].forEach(([f, gv]) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 6;
      const g = c.createGain();
      g.gain.value = gv;
      env.connect(bp);
      bp.connect(g);
      g.connect(bus);
    });
    env.connect(bus);
  }

  /* 伴奏一个音：柔和的三角波/正弦，带包络 */
  function padNote(bus, freq, start, dur, vol, type) {
    const c = ensureCtx();
    if (!c || !bus || !freq || freq <= 0 || dur <= 0) return;
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + Math.max(0.06, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /* 从一行的音里推出和弦（三个音；不足则补大三度 + 纯五度） */
  function chordOf(freqs) {
    const uniq = [];
    freqs.forEach((f) => { if (f > 0 && uniq.indexOf(f) === -1) uniq.push(f); });
    uniq.sort((a, b) => a - b);
    if (!uniq.length) return { chord: [], root: 0 };
    const root = uniq[0];
    if (uniq.length >= 3) {
      return { chord: [uniq[0], uniq[Math.floor(uniq.length / 2)], uniq[uniq.length - 1]], root };
    }
    return { chord: [root, root * 1.2599, root * 1.4983], root };
  }

  /* ---------- 儿歌时间轴（唯一时间真相源） ---------- */
  /* 实时合成（playArrangement）与离线渲染（gen-song.py）共用同一套时间数学，
     KTV 逐行/逐字高亮才能和音频严丝合缝。改这里必须同步改 gen-song.py。 */
  function computeSongTimeline(song) {
    const bpm = (song && song.bpm) || 100;
    const beat = 60 / bpm;
    const melody = (song && Array.isArray(song.melody)) ? song.melody : [];
    let t = 0.3;
    const lines = [];
    for (let li = 0; li < melody.length; li++) {
      const events = parseMelody(melody[li], bpm);
      const last = events[events.length - 1];
      // 行时长按"占槽总时长"计（含末音 10% 收尾间隙），保证行间衔接与曲谱一致
      const lineDur = last ? last.start + last.slotDur : beat * 2;
      lines.push({ lineStart: t, lineDur, events });
      t = t + lineDur + beat * 0.45;
    }
    return { lines, span: t - 0.3, beat, bpm };
  }

  /* 逐字高亮时刻：每个字点亮时间 = 对应音符的起唱时间（标点跟随前一个字）。
     字数多于音符时剩余字跟随末音；该行无音符时回退为均分。 */
  const SONG_PUNCT = /[，。！？、,.!?；;：:…—·~ "“”‘’()（）[\]【】《》]/;
  function charLightTimes(ln, lineText) {
    const chars = Array.from(lineText || '');
    const sing = ln.events.filter((e) => e.freq > 0);
    if (!sing.length) return chars.map((_, i) => ln.lineDur * (i + 1) / Math.max(1, chars.length));
    const times = [];
    let si = 0, last = 0;
    for (let i = 0; i < chars.length; i++) {
      if (!SONG_PUNCT.test(chars[i]) && si < sing.length) { last = sing[si].start; si++; }
      times.push(last);
    }
    return times;
  }

  /**
   * 播放整首儿歌（实时合成，作为预渲染音频缺失时的回退）：vocal 演唱声部 + accomp 伴奏声部
   * opts: {vocal:true, accomp:true}；cb: {onLine(li), onChar(li,ci,total), onEnd()}
   * 静音时只走时间轴（动画照常跟随），不出声。
   */
  function playArrangement(song, opts, cb) {
    stopArrangement();
    if (!song || !Array.isArray(song.melody) || !song.melody.length) {
      if (cb && cb.onEnd) setTimeout(cb.onEnd, 0);
      return null;
    }
    const o = opts || {};
    const wantVocal = o.vocal !== false;
    const wantAccomp = o.accomp !== false;
    const tl = computeSongTimeline(song);
    const beat = tl.beat;
    const c = ensureCtx();
    if (c && !muted) {
      vocalBus = makeBus(wantVocal ? 0.95 : 0);
      accompBus = makeBus(wantAccomp ? 0.95 : 0);
    }

    const total = song.melody.length;
    tl.lines.forEach((ln, li) => {
      const lineStart = ln.lineStart;
      const lineDur = ln.lineDur;
      ln.events.forEach((ev) => {
        if (ev.freq > 0) singNote(vocalBus, ev.freq, lineStart + ev.start, ev.dur * 1.02, 0.2);
      });

      const ch = chordOf(ln.events.map((e) => e.freq));
      padNote(accompBus, ch.root / 2, lineStart, lineDur * 0.98, 0.05, 'sine');
      for (let bt = 0; bt < lineDur - 1e-6; bt += beat) {
        ch.chord.forEach((f) => padNote(accompBus, f, lineStart + bt, beat * 0.85, 0.032, 'triangle'));
      }

      arrTimers.push(setTimeout(() => { cb && cb.onLine && cb.onLine(li); }, lineStart * 1000));
      const chars = (song.lines && song.lines[li]) ? song.lines[li].length : 0;
      if (chars > 0 && cb && cb.onChar) {
        const times = charLightTimes(ln, song.lines[li]);
        for (let ci = 1; ci <= chars; ci++) {
          arrTimers.push(setTimeout(
            () => cb.onChar(li, ci, chars),
            (lineStart + times[ci - 1]) * 1000
          ));
        }
      }
    });

    arrTimers.push(setTimeout(() => {
      killBuses();
      cb && cb.onEnd && cb.onEnd();
    }, tl.span * 1000 + 550));
    return { total, span: tl.span };
  }

  function stopArrangement() {
    killBuses();
    if (useNative) nativeStopTones();
  }

  /* ---------- 儿歌预渲染音频（人声/伴奏双轨 MP3，实时混音） ---------- */
  /* 整首人声/伴奏由 gen-song.py 离线渲染成 mp3（按拼音韵母共振峰合成人声，
     比实时合成更接近真唱）。播放解码后的 AudioBuffer，不在运行期创建上千个
     音频节点——低端 Android WebView 也绝不卡顿；两轨各走一个 gain，
     播放中可实时开关"原唱/伴奏"，切换不打断、不重播。 */

  const songBufCache = {};
  const songBufOrder = [];
  const SONG_BUF_MAX = 4;
  let songState = null; // { id, srcV, srcA, gV, gA, timers[], opts }

  function songAudioFiles(id) {
    if (typeof CS_VOICE === 'undefined') return null;
    const v = CS_VOICE['song:' + id + ':v'];
    const a = CS_VOICE['song:' + id + ':a'];
    return (v && a) ? { v: v, a: a } : null;
  }

  function hasSongAudio(song) {
    return !!(song && songAudioFiles(song.id));
  }

  function loadArrayBuffer(url) {
    return new Promise((resolve, reject) => {
      let xhr = null;
      try { xhr = new XMLHttpRequest(); } catch (e) { reject(e); return; }
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) resolve(xhr.response);
        else reject(new Error('http ' + xhr.status));
      };
      xhr.onerror = () => reject(new Error('network'));
      xhr.send();
    });
  }

  function loadSongBuffers(id) {
    if (songBufCache[id]) return Promise.resolve(songBufCache[id]);
    const files = songAudioFiles(id);
    const c = ensureCtx();
    if (!files || !c || !c.decodeAudioData) return Promise.reject(new Error('unavailable'));
    return Promise.all([loadArrayBuffer(files.v), loadArrayBuffer(files.a)]).then((raws) =>
      Promise.all(raws.map((raw) => new Promise((res, rej) => {
        try { c.decodeAudioData(raw, res, rej); } catch (e) { rej(e); }
      })))
    ).then((bufs) => {
      songBufCache[id] = { v: bufs[0], a: bufs[1] };
      songBufOrder.push(id);
      while (songBufOrder.length > SONG_BUF_MAX) {
        const old = songBufOrder.shift();
        if (old !== id) delete songBufCache[old];
      }
      return songBufCache[id];
    });
  }

  function prefetchSongAudio(song) {
    if (!hasSongAudio(song)) return;
    loadSongBuffers(song.id).catch(() => {});
  }

  function applySongMix() {
    if (!songState || !songState.gV) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    const v = (!muted && songState.opts.vocal) ? 0.95 : 0;
    const a = (!muted && songState.opts.accomp) ? 0.95 : 0;
    [[songState.gV, v], [songState.gA, a]].forEach((pair) => {
      try { pair[0].gain.setTargetAtTime(pair[1], t, 0.03); }
      catch (e) { try { pair[0].gain.value = pair[1]; } catch (e2) {} }
    });
  }

  function setSongMix(vocalOn, accompOn) {
    if (!songState) return;
    songState.opts.vocal = vocalOn !== false;
    songState.opts.accomp = accompOn !== false;
    applySongMix();
  }

  function stopSongAudio() {
    if (!songState) return;
    songState.timers.forEach(clearTimeout);
    ['srcV', 'srcA'].forEach((k) => {
      const s = songState[k];
      if (s) {
        try { s.stop(); } catch (e) {}
        try { s.disconnect(); } catch (e) {}
      }
    });
    ['gV', 'gA'].forEach((k) => {
      const g = songState[k];
      if (g) { try { g.disconnect(); } catch (e) {} }
    });
    songState = null;
  }

  /**
   * 播放预渲染儿歌：人声/伴奏双轨同起点播放，实时混音；
   * KTV 回调用 computeSongTimeline（与渲染端 gen-song.py 完全一致）。
   * cb: {onLine(li), onChar(li,ci,total), onEnd(), onFallback()}
   */
  function playSongAudio(song, opts, cb) {
    stopSongAudio();
    const c = ensureCtx();
    if (!c) return null;
    const state = {
      id: song.id,
      timers: [],
      opts: {
        vocal: !opts || opts.vocal !== false,
        accomp: !opts || opts.accomp !== false
      }
    };
    songState = state;
    loadSongBuffers(song.id).then((bufs) => {
      if (songState !== state) return;
      const t0 = c.currentTime + 0.12;
      const gV = c.createGain(); gV.gain.value = 0; gV.connect(c.destination);
      const gA = c.createGain(); gA.gain.value = 0; gA.connect(c.destination);
      const srcV = c.createBufferSource(); srcV.buffer = bufs.v; srcV.connect(gV); srcV.start(t0);
      const srcA = c.createBufferSource(); srcA.buffer = bufs.a; srcA.connect(gA); srcA.start(t0);
      state.gV = gV; state.gA = gA; state.srcV = srcV; state.srcA = srcA;
      applySongMix();

      const tl = computeSongTimeline(song);
      tl.lines.forEach((ln, li) => {
        state.timers.push(setTimeout(() => { cb && cb.onLine && cb.onLine(li); }, ln.lineStart * 1000 + 120));
        const chars = (song.lines && song.lines[li]) ? song.lines[li].length : 0;
        if (chars > 0 && cb && cb.onChar) {
          const times = charLightTimes(ln, song.lines[li]);
          for (let ci = 1; ci <= chars; ci++) {
            state.timers.push(setTimeout(
              () => cb.onChar(li, ci, chars),
              (ln.lineStart + times[ci - 1]) * 1000 + 120
            ));
          }
        }
      });
      const durMs = Math.max(bufs.v.duration, bufs.a.duration) * 1000 + 200;
      state.timers.push(setTimeout(() => {
        if (songState !== state) return;
        stopSongAudio();
        cb && cb.onEnd && cb.onEnd();
      }, durMs));
    }).catch(() => {
      if (songState !== state) return;
      stopSongAudio();
      cb && cb.onFallback && cb.onFallback();
    });
    return true;
  }

  /* ---------- 语音朗读（SpeechSynthesis） ---------- */
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    voice = voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
      voices.find((v) => /zh/i.test(v.lang)) || null;
    return voice;
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = pickVoice;
    pickVoice();
  }

  /* ---------- 预生成配音（Edge TTS 离线 mp3，音质远超系统 TTS） ---------- */
  let voiceEl = null;
  let nativeRetries = [];

  function hasVoice(key) {
    return !!(key && typeof CS_VOICE !== 'undefined' && CS_VOICE[key]);
  }

  function playVoiceFile(src) {
    if (!voiceEl) voiceEl = new Audio();
    voiceEl.src = src;
    voiceEl.onended = null;
    const pr = voiceEl.play();
    if (pr && pr.catch) pr.catch(() => {});
  }

  function stopVoiceFile() {
    if (voiceEl) {
      voiceEl.pause();
      voiceEl.currentTime = 0;
    }
  }

  /* ---------- 原生 TTS 异步就绪重试 ---------- */
  /* Android 的 TextToSpeech 初始化是异步的，开机瞬间调用会返回 tts_not_ready。
     此时把文本排队，等引擎就绪后自动补播，避免"宠物不发出声音"。 */
  let nativeRetryTimer = null;
  const NATIVE_RETRY_MAX = 6;
  const NATIVE_RETRY_GAP = 400;

  function queueNativeSpeak(text) {
    nativeRetries = [{ text: String(text), tries: 0 }];
    if (!nativeRetryTimer) nativeRetryTimer = setTimeout(runNativeRetries, NATIVE_RETRY_GAP);
  }

  function runNativeRetries() {
    nativeRetryTimer = null;
    if (muted || !nativeRetries.length) { nativeRetries = []; return; }
    const item = nativeRetries[0];
    let ok = false;
    try {
      const r = nativeSpeak(item.text);
      if (r) { try { const j = JSON.parse(r); ok = j && j.ok === true; } catch (_) { ok = true; } }
    } catch (_) { ok = false; }
    if (ok) { nativeRetries = []; return; }
    item.tries += 1;
    if (item.tries >= NATIVE_RETRY_MAX) { nativeRetries = []; return; }
    nativeRetryTimer = setTimeout(runNativeRetries, NATIVE_RETRY_GAP);
  }

  function clearNativeRetries() {
    nativeRetries = [];
    if (nativeRetryTimer) { clearTimeout(nativeRetryTimer); nativeRetryTimer = null; }
  }

  /* ---------- 首次用户手势解锁音频（绕过移动端 Autoplay 限制） ---------- */
  let unlocked = false;
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    const c = ensureCtx();
    if (c) { try { c.resume(); } catch (e) {} }
  }
  (function bindUnlock() {
    if (typeof document === 'undefined') return;
    const h = () => unlockAudio();
    ['pointerdown', 'touchstart', 'keydown'].forEach((ev) =>
      document.addEventListener(ev, h, { passive: true }));
  })();

  /* ---------- 语音朗读：配音文件 > 原生 TTS > Web Speech ---------- */
  function speak(text, opts) {
    // 静音 = 全局静音：朗读、音效、旋律统一不出声
    if (muted) { stopSpeak(); return true; }
    // 依次尝试多个配音 key，任意命中即播放离线 mp3（音质最好、最可靠）
    const keyList = [];
    if (opts && opts.keys) keyList.push.apply(keyList, opts.keys);
    if (opts && opts.key) keyList.push(opts.key);
    for (let i = 0; i < keyList.length; i++) {
      if (hasVoice(keyList[i])) {
        stopSpeak();
        playVoiceFile(CS_VOICE[keyList[i]]);
        return true;
      }
    }
    // 原生 TTS（Android 自带中文语音，无需网络）
    if (useNative) {
      clearNativeRetries();
      let ok = false;
      try {
        const r = nativeSpeak(text);
        if (r) {
          try { const j = JSON.parse(r); ok = j && j.ok === true; } catch (_) { ok = true; }
        }
      } catch (_) { ok = false; }
      if (ok) return true;
      // 引擎尚未就绪（tts_not_ready）→ 排队等就绪后自动补播（WebView 里 Web Speech 不出声，不再回退）
      queueNativeSpeak(text);
      return true;
    }
    if (!('speechSynthesis' in window)) { return false; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = opts && opts.rate || 0.85;
      u.pitch = 1.1;
      if (!voice) pickVoice();
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function stopSpeak() {
    stopVoiceFile();
    clearNativeRetries();
    if (useNative) {
      nativeStopSpeak();
      return;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function setMuted(m) {
    muted = m;
    if (m) { stopMelody(); stopSpeak(); }
    if (songState) applySongMix();
  }

  Object.assign(CS, {
    sfx, playTone, parseMelody, playMelody, stopMelody,
    playArrangement, stopArrangement, unlockAudio,
    playSongAudio, stopSongAudio, setSongMix, hasSongAudio, prefetchSongAudio,
    _computeSongTimeline: computeSongTimeline,
    speak, stopSpeak, setMuted, getMuted: () => muted,
    audioBackend: useNative ? 'native' : 'webaudio'
  });
})(window.CS);
