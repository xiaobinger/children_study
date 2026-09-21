/* ============ 识字模块 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, shuffle, rand, toast } = CS;

  function charList() {
    return CS.DATA.characters[state.age] || CS.DATA.characters.a1;
  }

  function render(view) {
    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">🔤</span>识字乐园</h2></div>' +
      '<div class="tab-row">' +
      '<button class="tab-btn active" data-tab="card">卡片学习</button>' +
      '<button class="tab-btn" data-tab="game">找字游戏</button></div>' +
      '<div id="litBox"></div>';

    const box = view.querySelector('#litBox');
    view.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        view.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        CS.sfx.tap();
        if (btn.getAttribute('data-tab') === 'card') renderCards(box);
        else renderGame(box);
      });
    });
    renderCards(box);
  }

  /* ---------- 字卡学习 ---------- */
  function renderCards(box) {
    const list = charList();
    let idx = 0;

    box.innerHTML =
      '<p class="hint-text">点卡片翻面看拼音和词句，🔊 听发音，共 ' + list.length + ' 张卡</p>' +
      '<div class="flashcard" id="fc"><div class="fc-inner">' +
      '<div class="fc-face"><div class="fc-emoji" id="fcEmoji"></div><div class="fc-char" id="fcChar"></div></div>' +
      '<div class="fc-face back"><div class="fc-pinyin" id="fcPy"></div><div class="fc-word" id="fcWord"></div>' +
      '<div class="fc-sentence" id="fcSent"></div></div></div></div>' +
      '<div class="play-controls">' +
      '<button class="play-btn" id="fcPrev">‹</button>' +
      '<button class="play-btn main" id="fcSpeak">🔊</button>' +
      '<button class="play-btn" id="fcNext">›</button></div>' +
      '<div class="progress-track"><div class="progress-fill" id="fcProgress"></div></div>' +
      '<p class="hint-text" style="text-align:center"><span id="fcCounter"></span></p>';

    const card = box.querySelector('#fc');
    const show = (i) => {
      idx = (i + list.length) % list.length;
      const c = list[idx];
      card.classList.remove('flipped');
      setTimeout(() => {
        box.querySelector('#fcEmoji').textContent = c.emoji;
        const charEl = box.querySelector('#fcChar');
        charEl.textContent = c.char;
        charEl.style.fontSize = c.char.length === 1 ? '5rem' : c.char.length === 2 ? '3.8rem' : '2.3rem';
        box.querySelector('#fcPy').textContent = c.py;
        box.querySelector('#fcWord').textContent = c.word;
        box.querySelector('#fcSent').textContent = c.sent;
      }, 180);
      box.querySelector('#fcProgress').style.width = ((idx + 1) / list.length * 100) + '%';
      box.querySelector('#fcCounter').textContent = (idx + 1) + ' / ' + list.length;
      state.markDone('lit_seen_' + c.char);
    };

    card.addEventListener('click', () => { card.classList.toggle('flipped'); CS.sfx.tap(); });
    box.querySelector('#fcPrev').onclick = () => { show(idx - 1); CS.sfx.tap(); };
    box.querySelector('#fcNext').onclick = () => { show(idx + 1); CS.sfx.tap(); };
    box.querySelector('#fcSpeak').onclick = () => {
      const c = list[idx];
      const text = c.char.length > 2 ? c.char + '。' + c.sent : c.char + '，' + c.word + '。' + c.sent;
      if (!CS.speak(text, { key: 'char:' + state.age + ':' + c.char })) toast('当前浏览器不支持朗读');
    };

    show(rand(list.length));
  }

  /* ---------- 找字游戏 ---------- */
  function renderGame(box) {
    const list = charList();
    const rounds = 8;
    let round = 0, score = 0, locked = false;

    function gridSize() {
      const s = list[0].char.length;
      return s === 1 ? 9 : 6; // 单字9宫格，词语6格
    }

    function nextRound() {
      if (round >= rounds) { finish(); return; }
      round++;
      const target = list[rand(list.length)];
      const size = gridSize();
      const others = shuffle(list.filter((c) => c.char !== target.char)).slice(0, size - 1);
      const cells = shuffle([target, ...others]);

      box.innerHTML =
        '<div class="quiz-area">' +
        '<div class="score-bar"><span>第 ' + round + ' / ' + rounds + ' 题</span><span>答对 ' + score + ' 题</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + (round / rounds * 100) + '%"></div></div>' +
        '<div class="quiz-question">' +
        '<span class="q-emoji">' + target.emoji + '</span>' +
        '找一找：<b style="font-size:1.4em;color:var(--primary)">' + esc(target.py) + '</b><br>' +
        '<span style="font-size:.85em;color:var(--muted)">' + (target.char.length > 2 ? '（成语）' : '（读作：' + esc(target.py) + '）') + '</span></div>' +
        '<div class="char-grid">' + cells.map((c) =>
          '<button class="char-cell" data-char="' + esc(c.char) + '">' + esc(c.char) + '</button>').join('') + '</div>' +
        '<div class="play-controls"><button class="play-btn" id="litHint">🔊 听一听</button></div>' +
        '</div>';

      locked = false;
      const voiceKey = 'char:' + state.age + ':' + target.char;
      box.querySelector('#litHint').onclick = () => CS.speak(target.char, { key: voiceKey });
      CS.speak(target.char, { key: voiceKey });

      box.querySelectorAll('.char-cell').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          if (btn.getAttribute('data-char') === target.char) {
            locked = true;
            score++;
            btn.classList.add('correct');
            CS.sfx.correct();
            CS.speak(target.char + '，' + (target.sent.split('：')[0] || ''));
            setTimeout(nextRound, 900);
          } else {
            btn.classList.add('wrong');
            CS.sfx.wrong();
            setTimeout(() => btn.classList.remove('wrong'), 500);
          }
        });
      });
    }

    function finish() {
      const stars = score >= rounds ? 3 : score >= Math.round(rounds * 0.7) ? 2 : 1;
      CS.showResult({
        emoji: score >= rounds ? '🏆' : '👏',
        title: score >= rounds ? '火眼金睛，全部找对！' : '找字完成！',
        msg: '共找到 ' + score + '/' + rounds + ' 个',
        stars,
        onAgain: () => renderGame(box),
        onBack: () => CS.navigate('literacy')
      });
    }

    nextRound();
  }

  function renderRoot(view) { render(view); }

  CS.register('literacy', renderRoot);
})(window.CS);
