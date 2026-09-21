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
   * notes: "1 1 5 5 6 6 5 -" 每个空格一个音；数字支持低八度下划线/高八度+；
   * "-" 延长半拍；"" 跳过。
   * 返回 [{freq, start, dur}]（秒）
   */
  function parseMelody(notes, bpm) {
    const beat = 60 / (bpm || 100);
    const tokens = notes.trim().split(/\s+/).filter(Boolean);
    let t = 0;
    return tokens.map((tk) => {
      let dur = beat * 0.9;
      let key = tk;
      if (tk === '-') { return { freq: -1, start: t, dur: beat, rest: true, at: t }; }
      if (tk.endsWith('--')) { dur = beat * 2.9; key = tk.slice(0, -2); }
      else if (tk.endsWith('-')) { dur = beat * 1.9; key = tk.slice(0, -1); }
      const freq = NOTE_FREQ[key] || 0;
      const ev = { freq, start: t, dur, at: t };
      t += dur / 0.9;
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

  /* ---------- 语音朗读：配音文件 > 原生 TTS > Web Speech ---------- */
  function speak(text, opts) {
    // 静音 = 全局静音：朗读、音效、旋律统一不出声
    if (muted) { stopSpeak(); return true; }
    const key = opts && opts.key;
    if (hasVoice(key)) {
      stopSpeak();
      playVoiceFile(CS_VOICE[key]);
      return true;
    }
    // 原生 TTS（Android 自带中文语音，无需网络）；失败时回退 Web Speech
    if (useNative) {
      let ok = false;
      try {
        const r = nativeSpeak(text);
        if (r) {
          try { const j = JSON.parse(r); ok = j && j.ok === true; } catch (_) { ok = true; }
        }
      } catch (_) { ok = false; }
      if (ok) return true;
      // 原生 TTS 不可用（未初始化/无语言数据），回退 Web Speech
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
    if (useNative) {
      nativeStopSpeak();
      return;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function setMuted(m) {
    muted = m;
    if (m) { stopMelody(); stopSpeak(); }
  }

  Object.assign(CS, {
    sfx, playTone, parseMelody, playMelody, stopMelody,
    speak, stopSpeak, setMuted, getMuted: () => muted,
    audioBackend: useNative ? 'native' : 'webaudio'
  });
})(window.CS);
