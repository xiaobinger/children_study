/* ============ 儿歌模块：真实演唱（原唱/伴奏）+ KTV 动画跟唱 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool } = CS;

  let timers = [];
  let playing = false;
  let handle = null;
  let cur = null;
  const opt = { vocal: true, accomp: true, anim: false };

  try {
    const saved = JSON.parse(localStorage.getItem('cs_song_opt') || 'null');
    if (saved) {
      opt.vocal = saved.vocal !== false;
      opt.accomp = saved.accomp !== false;
      opt.anim = !!saved.anim;
    }
  } catch (e) {}
  function saveOpt() {
    try { localStorage.setItem('cs_song_opt', JSON.stringify(opt)); } catch (e) {}
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function stopPlayback() {
    clearTimers();
    playing = false;
    handle = null;
    cur = null;
    if (CS.stopSongAudio) CS.stopSongAudio();
    if (CS.stopArrangement) CS.stopArrangement();
    closeStage();
  }

  function songsByAge() {
    const pool = agePool(state.age);
    return CS.DATA.songs.filter((s) => pool.includes(s.age));
  }

  function render(view, params) {
    stopPlayback();
    if (params && params.id) renderDetail(view, params);
    else renderList(view);
  }

  /* ---------- 列表页 ---------- */
  function renderList(view) {
    const songs = songsByAge();
    if (!songs.length) {
      view.innerHTML = '<div class="empty-tip">这个年龄段暂时没有儿歌，敬请期待 🎵</div>';
      return;
    }
    const cards = songs.map((s) =>
      '<button class="list-card" data-id="' + s.id + '">' +
      '<span class="lc-icon">' + s.emoji + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(s.title) + '</span>' +
      '<span class="lc-sub">' + s.lines[0] + '</span></span>' +
      (s.melody ? '<span class="done-badge" style="background:#f0e8ff;color:#7b57d8">♪ 会唱</span>' : '') +
      '<span class="lc-arrow">›</span></button>'
    ).join('');

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">🎵</span>儿歌欢唱</h2></div>' +
      '<p class="hint-text">带 ♪ 的儿歌有原唱和伴奏：可以关掉原唱只留伴奏，自己跟着唱；打开动画就是 KTV 模式啦！</p>' +
      '<div class="card-list">' + cards + '</div>';

    view.querySelectorAll('.list-card').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate('song', { id: btn.getAttribute('data-id') }); });
    });
  }

  /* ---------- 详情页 ---------- */
  function renderDetail(view, params) {
    const song = CS.DATA.songs.find((s) => s.id === params.id) || songsByAge()[0];
    if (!song) { view.innerHTML = '<div class="empty-tip">没有找到这首儿歌</div>'; return; }
    const hasMelody = Array.isArray(song.melody);

    view.innerHTML =
      '<div class="back-row"><button class="btn btn-ghost" id="songBack">‹ 返回儿歌列表</button></div>' +
      '<div class="quiz-area" style="text-align:center">' +
      '<div class="quiz-question"><span class="q-emoji">' + song.emoji + '</span>' + esc(song.title) + '</div>' +
      (hasMelody ? togglesHTML() : '') +
      '<div class="song-lines" id="songLines">' +
      song.lines.map((l, i) => lineHTML(l, i)).join('') +
      '</div>' +
      '<div class="play-controls">' +
      (hasMelody ? '<button class="play-btn main" id="songPlay">▶</button>' : '') +
      (hasMelody ? '<button class="play-btn" id="songStop" title="停止">⏹</button>' : '') +
      '<button class="play-btn ' + (hasMelody ? '' : 'main') + '" id="songRead" title="朗读歌词">🔊</button>' +
      '</div>' +
      (hasMelody ? '<p class="hint-text">点 ▶ 开唱：🎤 原唱可关掉只留 🎹 伴奏自己唱，🎬 动画打开就是 KTV 跟唱</p>'
                 : '<p class="hint-text">点击 🔊 跟着朗读学唱这首歌吧</p>') +
      '</div>';

    document.getElementById('songBack').onclick = () => { stopPlayback(); navigate('song'); };
    const readBtn = document.getElementById('songRead');
    if (readBtn) readBtn.onclick = () => {
      stopPlayback();
      highlightReset(view);
      const ok = CS.speak(song.lines.join('，'), { key: 'song:' + song.id + ':read' });
      if (!ok) CS.toast('当前设备不支持朗读');
    };

    // 预取预渲染双轨（人声/伴奏 mp3），点 ▶ 时即点即播
    if (hasMelody && CS.prefetchSongAudio) CS.prefetchSongAudio(song);

    if (hasMelody) {
      view.querySelectorAll('.ktv-toggle').forEach((b) => {
        b.addEventListener('click', () => {
          const k = b.getAttribute('data-k');
          opt[k] = !opt[k];
          b.classList.toggle('on', opt[k]);
          saveOpt();
          CS.sfx.tap();
          if (playing && cur && (k === 'vocal' || k === 'accomp')) {
            // 预渲染双轨：直接调 gain 实时开关，不打断不重播
            if (useRendered && CS.setSongMix) CS.setSongMix(opt.vocal, opt.accomp);
            else playSong(cur.song, cur.view);
          } else if (playing && cur && k === 'anim' && opt.anim) openStage(cur.song);
          else if (k === 'anim' && !opt.anim) closeStage();
        });
      });
      document.getElementById('songPlay').onclick = () => playSong(song, view);
      document.getElementById('songStop').onclick = () => { stopPlayback(); highlightReset(view); };
    }
  }

  function togglesHTML() {
    return '<div class="ktv-toggles">' +
      '<button class="ktv-toggle' + (opt.vocal ? ' on' : '') + '" data-k="vocal">🎤 原唱</button>' +
      '<button class="ktv-toggle' + (opt.accomp ? ' on' : '') + '" data-k="accomp">🎹 伴奏</button>' +
      '<button class="ktv-toggle' + (opt.anim ? ' on' : '') + '" data-k="anim">🎬 动画</button>' +
      '</div>';
  }

  function lineHTML(l, i) {
    const chars = Array.from(l).map((ch) => '<span class="ch">' + esc(ch) + '</span>').join('');
    return '<div class="song-line" data-i="' + i + '">' + chars + '</div>';
  }

  function highlightReset(view) {
    view.querySelectorAll('.song-line').forEach((el) => {
      el.classList.remove('active', 'done');
      el.querySelectorAll('.ch').forEach((c) => c.classList.remove('lit'));
    });
  }

  function highlightDone(lineEls) {
    lineEls.forEach((el) => {
      el.classList.remove('active');
      el.classList.add('done');
      el.querySelectorAll('.ch').forEach((c) => c.classList.add('lit'));
    });
  }

  /* ---------- 播放：预渲染双轨优先（原唱/伴奏可实时开关），无文件回退实时合成 ---------- */
  let useRendered = false;

  function playSong(song, view) {
    stopPlayback();
    highlightReset(view);
    playing = true;
    cur = { song, view };
    const lineEls = view.querySelectorAll('.song-line');
    let stage = null;
    let stageSpans = null;
    let stageBar = null;
    if (opt.anim) { stage = openStage(song); stageBar = stage.querySelector('.ktv-bar-fill'); }

    const cbs = {
      onLine(li) {
        lineEls.forEach((el) => {
          const i = +el.getAttribute('data-i');
          el.classList.toggle('active', i === li);
          if (i < li) el.classList.add('done');
        });
        if (stage) {
          stageSpans = renderStageLyric(stage, song.lines[li] || '');
          const nxt = stage.querySelector('.ktv-next');
          if (nxt) nxt.textContent = song.lines[li + 1] ? '下一句：' + song.lines[li + 1] : '';
        }
      },
      onChar(li, ci, total) {
        const el = lineEls[li];
        if (el) {
          const chs = el.querySelectorAll('.ch');
          for (let k = 0; k < ci && k < chs.length; k++) chs[k].classList.add('lit');
        }
        if (stageSpans) {
          for (let k = 0; k < ci && k < stageSpans.length; k++) stageSpans[k].classList.add('lit');
        }
        if (stageBar) {
          stageBar.style.width = Math.min(100, ((li + ci / total) / song.lines.length) * 100) + '%';
        }
      },
      onEnd() {
        playing = false;
        handle = null;
        clearTimers();
        highlightDone(lineEls);
        closeStage();
        CS.sfx.finish();
        state.markDone('song_' + song.id);
        CS.showResult({
          emoji: '🎤',
          title: '唱得真好听！',
          msg: '《' + esc(song.title) + '》唱完啦，奖励一颗小星星',
          stars: 1,
          onAgain: () => { if (cur) playSong(cur.song, cur.view); },
          onBack: () => navigate('song')
        });
      }
    };

    useRendered = !!(CS.playSongAudio && CS.hasSongAudio && CS.hasSongAudio(song));
    if (useRendered) {
      handle = CS.playSongAudio(song, { vocal: opt.vocal, accomp: opt.accomp }, {
        onLine: cbs.onLine,
        onChar: cbs.onChar,
        onEnd: cbs.onEnd,
        onFallback() {
          useRendered = false;
          handle = CS.playArrangement(song, { vocal: opt.vocal, accomp: opt.accomp }, cbs);
        }
      });
    } else {
      handle = CS.playArrangement(song, { vocal: opt.vocal, accomp: opt.accomp }, cbs);
    }
  }

  /* ---------- KTV 舞台 ---------- */
  const THEME = {
    '⭐': ['⭐', '✨', '💫', '🌙'], '✨': ['✨', '⭐', '💫', '🌙'],
    '🐯': ['🐯', '🍃', '🌿', '⭐'], '🎂': ['🎂', '🎈', '🎉', '✨'],
    '🥕': ['🥕', '🥬', '🌱', '✨'], '🐰': ['🐰', '🥕', '🌸', '✨'],
    '🐛': ['🐛', '🌙', '✨', '🍃'], '🐭': ['🐭', '🧀', '⭐', '✨'],
    '🖐️': ['🖐️', '🎵', '✨', '💫'], '🐝': ['🐝', '🌸', '🌼', '✨'],
    '🦆': ['🦆', '💧', '🌊', '✨'], '🐑': ['🐑', '☁️', '🌿', '✨'],
    '🐱': ['🐱', '🐾', '✨', '💫'], '🐶': ['🐶', '🦴', '✨', '💫'],
    '🐔': ['🐔', '🌾', '✨', '💫'], '🌈': ['🌈', '☁️', '✨', '💫']
  };

  function particlesHTML(song) {
    const set = THEME[song.emoji] || ['🎵', '✨', '💫', '🎶'];
    let html = '';
    for (let i = 0; i < 16; i++) {
      const e = set[i % set.length];
      const left = Math.round((i * 6.4 + (i % 3) * 4.3) % 100);
      const delay = ((i * 0.7) % 6).toFixed(1);
      const dur = (5 + (i % 4) * 1.7).toFixed(1);
      const size = (1.6 + (i % 3) * 0.9).toFixed(1);
      html += '<span class="ktv-p" style="left:' + left + '%;animation-delay:-' + delay +
        's;animation-duration:' + dur + 's;font-size:' + size + 'rem">' + e + '</span>';
    }
    return html;
  }

  function openStage(song) {
    closeStage();
    const el = document.createElement('div');
    el.className = 'ktv-stage';
    el.id = 'ktvStage';
    el.innerHTML =
      '<div class="ktv-bg">' + particlesHTML(song) + '</div>' +
      '<div class="ktv-top">' +
      '<span class="ktv-title">' + song.emoji + ' ' + esc(song.title) + '</span>' +
      '<button class="ktv-exit" id="ktvExit" title="退出动画">✕</button>' +
      '</div>' +
      '<div class="ktv-center">' +
      '<div class="ktv-lyric" id="ktvLyric"></div>' +
      '<div class="ktv-next" id="ktvNext"></div>' +
      '</div>' +
      '<div class="ktv-bar"><div class="ktv-bar-fill" id="ktvBar"></div></div>';
    document.body.appendChild(el);
    el.querySelector('#ktvExit').addEventListener('click', () => { stopPlayback(); });
    requestAnimationFrame(() => el.classList.add('show'));
    return el;
  }

  function closeStage() {
    const el = document.getElementById('ktvStage');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }

  function renderStageLyric(stage, text) {
    const box = stage.querySelector('#ktvLyric');
    if (!box) return [];
    box.innerHTML = '';
    const spans = [];
    Array.from(text).forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'kch';
      s.textContent = ch;
      box.appendChild(s);
      spans.push(s);
    });
    return spans;
  }

  CS.register('song', render);
})(window.CS);