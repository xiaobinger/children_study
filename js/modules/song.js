/* ============ 儿歌模块：电子琴伴奏 + 歌词逐行跟唱 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool, shuffle } = CS;

  let timers = [];
  let playing = false;

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    playing = false;
  }

  function songsByAge() {
    const pool = agePool(state.age);
    return CS.DATA.songs.filter((s) => pool.includes(s.age));
  }

  function render(view, params) {
    clearTimers();
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
      (s.melody ? '<span class="done-badge" style="background:#f0e8ff;color:#7b57d8">♪ 可弹奏</span>' : '') +
      '<span class="lc-arrow">›</span></button>'
    ).join('');

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">🎵</span>儿歌欢唱</h2></div>' +
      '<p class="hint-text">带 ♪ 的儿歌有电子琴伴奏，歌词会一行一行亮起来跟着唱哦！</p>' +
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
      '<div class="quiz-question"><span class="q-emoji">' + song.emoji + '</span>' + esc(song.title) +
      (hasMelody ? ' <span class="done-badge" style="background:#f0e8ff;color:#7b57d8">♪ 有伴奏</span>' : '') + '</div>' +
      '<div class="song-lines" id="songLines">' +
      song.lines.map((l, i) => '<div class="song-line" data-i="' + i + '">' + esc(l) + '</div>').join('') +
      '</div>' +
      '<div class="play-controls">' +
      (hasMelody ? '<button class="play-btn main" id="songPlay">▶</button>' : '') +
      (hasMelody ? '<button class="play-btn" id="songStop" title="停止">⏹</button>' : '') +
      '<button class="play-btn ' + (hasMelody ? '' : 'main') + '" id="songRead" title="朗读歌词">🔊</button>' +
      '</div>' +
      (hasMelody ? '<p class="hint-text">点击 ▶ 听伴奏跟唱，亮起的句子就是正在唱的歌词</p>'
                 : '<p class="hint-text">点击 🔊 跟着朗读学唱这首歌吧</p>') +
      '</div>';

    document.getElementById('songBack').onclick = () => { clearTimers(); navigate('song'); };
    const readBtn = document.getElementById('songRead');
    if (readBtn) readBtn.onclick = () => {
      highlightReset();
      const ok = CS.speak(song.lines.join('，'));
      if (!ok) CS.toast('当前浏览器不支持朗读');
    };

    if (hasMelody) {
      document.getElementById('songPlay').onclick = () => playSong(song);
      document.getElementById('songStop').onclick = () => { clearTimers(); highlightReset(); };
    }

    function highlightReset() {
      view.querySelectorAll('.song-line').forEach((el) => el.classList.remove('active', 'done'));
    }

    function playSong(song) {
      clearTimers();
      highlightReset();
      playing = true;
      const lineEls = view.querySelectorAll('.song-line');
      const beat = 60 / song.bpm;
      let offset = 0;

      song.melody.forEach((notesStr, li) => {
        const events = CS.parseMelody(notesStr, song.bpm);
        // 当前行开始时间
        const startAt = offset + 0.2;
        timers.push(setTimeout(() => {
          lineEls.forEach((el) => {
            el.classList.toggle('active', +el.getAttribute('data-i') === li);
            if (+el.getAttribute('data-i') < li) el.classList.add('done');
          });
        }, startAt * 1000));

        events.forEach((ev) => {
          if (ev.freq > 0) {
            CS.playTone(ev.freq, startAt + ev.start, ev.dur, 'triangle', 0.2);
            CS.playTone(ev.freq / 2, startAt + ev.start, ev.dur, 'sine', 0.07);
          }
        });
        const last = events[events.length - 1];
        offset = startAt + (last ? last.start + last.dur : 0) + beat * 0.3;
      });

      const total = offset * 1000 + 400;
      timers.push(setTimeout(() => {
        clearTimers();
        highlightDone(lineEls);
        CS.sfx.finish();
        state.markDone('song_' + song.id);
        CS.showResult({
          emoji: '🎤',
          title: '唱得真好听！',
          msg: '《' + esc(song.title) + '》唱完啦，奖励一颗小星星',
          stars: 1,
          onAgain: () => playSong(song),
          onBack: () => navigate('song')
        });
      }, total));
    }

    function highlightDone(els) {
      els.forEach((el) => { el.classList.remove('active'); el.classList.add('done'); });
    }
  }

  CS.register('song', render);
})(window.CS);
