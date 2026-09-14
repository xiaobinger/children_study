/* ============ 古诗模块 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool, shuffle, rand } = CS;

  const DISTRACT_POOL = '一二三四五六七八九十大小山水日月天人花草风云中白东西南北';

  function listByAge() {
    const pool = agePool(state.age);
    return CS.DATA.poems.filter((p) => pool.includes(p.age));
  }

  /* 扩展诗解锁：该年龄段核心诗全部闯关完成 */
  function extraUnlocked(ageKey) {
    const core = CS.DATA.poems.filter((p) => p.age === ageKey && p.tier !== 'extra');
    return core.length > 0 && core.every((p) => state.done['poem_' + p.id]);
  }

  function coreProgress(ageKey) {
    const core = CS.DATA.poems.filter((p) => p.age === ageKey && p.tier !== 'extra');
    const done = core.filter((p) => state.done['poem_' + p.id]).length;
    return { done, total: core.length };
  }

  /* ---------- 路由分发：列表 or 详情 ---------- */
  function render(view, params) {
    if (params && params.id) renderDetail(view, params);
    else renderList(view);
  }

  /* ---------- 列表页 ---------- */
  function renderList(view) {
    const all = listByAge();
    if (!all.length) {
      view.innerHTML = '<div class="empty-tip">这个年龄段暂时没有古诗，敬请期待 🌱</div>';
      return;
    }
    const unlocked = extraUnlocked(state.age);
    const prog = coreProgress(state.age);
    const poems = all.filter((p) => p.tier !== 'extra' || extraUnlocked(p.age));
    const lockedExtras = all.filter((p) => p.tier === 'extra' && p.age === state.age && !unlocked);

    const cards = poems.map((p) =>
      '<button class="list-card" data-id="' + p.id + '">' +
      '<span class="lc-icon">' + (p.tier === 'extra' ? '🌟' : '📖') + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(p.title) + '</span>' +
      '<span class="lc-sub">' + esc(p.dynasty + ' · ' + p.author) +
      (p.tier === 'extra' ? ' · 新解锁' : '') + '</span></span>' +
      (state.done['poem_' + p.id] ? '<span class="done-badge">已闯关 ✓</span>' : '') +
      '<span class="lc-arrow">›</span></button>'
    ).join('');

    const lockedHtml = lockedExtras.length
      ? '<div class="section-title">🔒 扩展诗（闯关后解锁）</div>' +
        '<p class="hint-text">当前年龄核心古诗闯关进度：' + prog.done + ' / ' + prog.total +
        ' 首全部完成后，自动解锁 ' + lockedExtras.length + ' 首新古诗！</p>' +
        '<div class="card-list" style="opacity:.55">' + lockedExtras.map((p) =>
          '<div class="list-card" style="cursor:default">' +
          '<span class="lc-icon">🔒</span>' +
          '<span class="lc-body"><span class="lc-title">？？？</span>' +
          '<span class="lc-sub">闯关解锁神秘新古诗</span></span></div>').join('') + '</div>'
      : '';

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">📖</span>古诗背诵</h2></div>' +
      '<p class="hint-text">点一首诗：先听朗读、看拼音，再去"填字闯关"赢星星！</p>' +
      (unlocked ? '<p class="hint-text" style="color:var(--ok)">🎉 恭喜！已解锁扩展古诗，共 ' +
        CS.DATA.poems.filter((p) => p.age === state.age && p.tier === 'extra').length + ' 首</p>' : '') +
      '<div class="card-list">' + cards + '</div>' + lockedHtml;

    view.querySelectorAll('.list-card[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate('poem', { id: btn.getAttribute('data-id') }); });
    });
  }

  /* ---------- 详情页 ---------- */
  function renderDetail(view, params) {
    const poem = CS.DATA.poems.find((p) => p.id === params.id) || listByAge()[0];
    if (!poem) { view.innerHTML = '<div class="empty-tip">没有找到这首诗</div>'; return; }

    const hasPy = Array.isArray(poem.pinyin);
    const linesHtml = poem.lines.map((line, i) => {
      if (!hasPy) {
        return '<div class="poem-line" style="letter-spacing:.15em">' + esc(line) + '</div>';
      }
      const chars = line.split('').filter((c) => !/[，。？！、]/.test(c));
      const py = poem.pinyin[i] || [];
      const rendered = chars.map((c, j) =>
        '<span class="ruby-char"><span class="ruby-py">' + esc(py[j] || '') + '</span><span class="char-base">' + esc(c) + '</span></span>'
      ).join('');
      return '<div class="poem-line">' + rendered + '</div>';
    }).join('');

    view.innerHTML =
      '<div class="back-row">' +
      '<button class="btn btn-ghost" id="poemBack">‹ 返回古诗列表</button></div>' +

      '<div class="poem-view">' +
      '<div class="poem-title">' + esc(poem.title) + '</div>' +
      '<div class="poem-author">[' + esc(poem.dynasty) + '] ' + esc(poem.author) + '</div>' +
      linesHtml +
      '</div>' +

      '<div class="play-controls">' +
      '<button class="play-btn main" id="poemSpeak" title="听朗读">🔊</button>' +
      '<button class="play-btn" id="poemExplain" title="看解释">💬</button>' +
      '<button class="btn btn-warn btn-big" id="poemGame">填字闯关 🚀</button>' +
      '</div>' +

      '<div id="poemExplainBox" class="quiz-area hidden">' +
      '<div class="quiz-question"><span class="q-emoji">💬</span>这首诗的意思</div>' +
      '<p style="line-height:2;text-align:center">' + esc(poem.desc) + '</p></div>' +

      '<div id="poemGameBox"></div>';

    document.getElementById('poemBack').onclick = () => { CS.stopSpeak(); navigate('poem'); };
    document.getElementById('poemSpeak').onclick = () => {
      const ok = CS.speak(poem.title + '，' + poem.author + '。' + poem.lines.join(''));
      if (!ok) CS.toast('当前浏览器不支持朗读');
    };
    document.getElementById('poemExplain').onclick = () => {
      document.getElementById('poemExplainBox').classList.toggle('hidden');
      CS.sfx.tap();
    };
    document.getElementById('poemGame').onclick = () => startGame(poem);
  }

  /* ---------- 填字闯关游戏 ---------- */
  function startGame(poem) {
    const box = document.getElementById('poemGameBox');
    const rounds = 5;
    let round = 0, score = 0, locked = false;

    const cleanLines = poem.lines.map((l) => l.split('').filter((c) => !/[，。？！、]/.test(c)));

    function nextRound() {
      if (round >= rounds) { finish(); return; }
      round++;
      const li = rand(cleanLines.length);
      const chars = cleanLines[li];
      if (!chars.length) { nextRound(); return; }
      const hi = rand(chars.length);
      const target = chars[hi];
      const pyLine = (poem.pinyin || [])[li] || [];
      const pyChar = pyLine[hi] || '';

      const lineHtml = chars.map((c, i) =>
        i === hi
          ? '<span class="poem-blank"><span class="blank-fill"></span></span>'
          : '<span class="ruby-char">' +
            (pyLine[i] ? '<span class="ruby-py">' + esc(pyLine[i]) + '</span>' : '') + '<span class="char-base">' + esc(c) + '</span></span>'
      ).join('');

      const opts = makeOptions(target, poem);

      box.innerHTML =
        '<div class="quiz-area">' +
        '<div class="score-bar"><span>第 ' + round + ' / ' + rounds + ' 题</span><span>答对 ' + score + ' 题</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + (round / rounds * 100) + '%"></div></div>' +
        '<div class="quiz-question"><span class="q-emoji">✏️</span>选一选，补全诗句</div>' +
        (pyChar ? '<p class="hint-text">提示：这个字读 <b>' + esc(pyChar) + '</b></p>' : '') +
        '<div class="poem-view" style="margin:0"><div class="poem-line">' + lineHtml + '</div></div>' +
        '<div class="opt-grid">' + opts.map((o) =>
          '<button class="opt-btn" data-opt="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div>' +
        '</div>';

      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      locked = false;

      box.querySelectorAll('.opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          const val = btn.getAttribute('data-opt');
          if (val === target) {
            locked = true;
            score++;
            btn.classList.add('correct');
            const blank = box.querySelector('.poem-blank');
            blank.classList.add('solved');
            blank.querySelector('.blank-fill').textContent = target;
            CS.sfx.correct();
            setTimeout(nextRound, 750);
          } else {
            btn.classList.add('wrong');
            CS.sfx.wrong();
            setTimeout(() => btn.classList.remove('wrong'), 500);
          }
        });
      });
    }

    function finish() {
      const stars = score >= rounds ? 3 : score >= rounds - 1 ? 2 : 1;
      state.markDone('poem_' + poem.id);
      CS.showResult({
        emoji: score >= rounds ? '🏆' : '👏',
        title: score >= rounds ? '全部答对，太厉害啦！' : '闯关完成！',
        msg: '《' + esc(poem.title) + '》答对 ' + score + '/' + rounds + ' 题',
        stars,
        onAgain: () => startGame(poem),
        onBack: () => { box.innerHTML = ''; navigate('poem'); }
      });
    }

    nextRound();
  }

  function makeOptions(target, poem) {
    const pool = new Set([target]);
    const poemChars = poem.lines.join('').replace(/[，。？！、\s]/g, '').split('');
    shuffle(poemChars).forEach((c) => { if (pool.size < 4 && c !== target) pool.add(c); });
    shuffle(DISTRACT_POOL.split('')).forEach((c) => { if (pool.size < 4) pool.add(c); });
    return shuffle(Array.from(pool)).slice(0, 4);
  }

  CS.register('poem', render);
})(window.CS);
