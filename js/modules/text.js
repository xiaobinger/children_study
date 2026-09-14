/* ============ 课文阅读模块 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool, shuffle } = CS;

  function textsByAge() {
    const pool = agePool(state.age);
    return CS.DATA.texts.filter((t) => pool.includes(t.age));
  }

  function render(view, params) {
    if (params && params.id) renderDetail(view, params);
    else renderList(view);
  }

  function renderList(view) {
    const texts = textsByAge();
    if (!texts.length) {
      view.innerHTML = '<div class="empty-tip">这个年龄段暂时没有课文，敬请期待 📚</div>';
      return;
    }
    const cards = texts.map((t) =>
      '<button class="list-card" data-id="' + t.id + '">' +
      '<span class="lc-icon">' + t.emoji + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(t.title) + '</span>' +
      '<span class="lc-sub">' + esc(t.passage[0].slice(0, 18)) + '…</span></span>' +
      (state.done['text_' + t.id] ? '<span class="done-badge">已读完 ✓</span>' : '') +
      '<span class="lc-arrow">›</span></button>'
    ).join('');

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">📚</span>课文阅读</h2></div>' +
      '<p class="hint-text">先听朗读或自己读，再答题检验读没读懂！</p>' +
      '<div class="card-list">' + cards + '</div>';

    view.querySelectorAll('.list-card').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate('text', { id: btn.getAttribute('data-id') }); });
    });
  }

  function renderDetail(view, params) {
    const text = CS.DATA.texts.find((t) => t.id === params.id) || textsByAge()[0];
    if (!text) { view.innerHTML = '<div class="empty-tip">没有找到这篇课文</div>'; return; }

    view.innerHTML =
      '<div class="back-row"><button class="btn btn-ghost" id="textBack">‹ 返回课文列表</button></div>' +
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">' + text.emoji + '</span>' + esc(text.title) + '</div>' +
      '<div class="read-controls" style="justify-content:center">' +
      '<button class="btn btn-primary" id="textSpeak">🔊 听朗读</button>' +
      '<button class="btn btn-ghost" id="textStop">⏹ 停止</button></div>' +
      '</div>' +
      '<div class="text-passage">' + text.passage.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>' +
      '<div class="play-controls" style="margin-top:1rem">' +
      '<button class="btn btn-warn btn-big" id="textQuiz">开始答题 🚀</button></div>' +
      '<div id="textQuizBox"></div>';

    document.getElementById('textBack').onclick = () => { CS.stopSpeak(); navigate('text'); };
    document.getElementById('textSpeak').onclick = () => {
      if (!CS.speak(text.title + '。' + text.passage.join(''))) CS.toast('当前浏览器不支持朗读');
    };
    document.getElementById('textStop').onclick = () => CS.stopSpeak();
    document.getElementById('textQuiz').onclick = () => startQuiz(text);
  }

  function startQuiz(text) {
    const box = document.getElementById('textQuizBox');
    const questions = shuffle(text.quiz.map((q, i) => ({ ...q, id: i })));
    let qi = 0, score = 0, locked = false;

    function nextQ() {
      if (qi >= questions.length) { finish(); return; }
      const q = questions[qi];
      const opts = q.opts.map((o, i) => ({ o, i }));
      const shuffled = shuffle(opts);

      box.innerHTML =
        '<div class="quiz-area">' +
        '<div class="score-bar"><span>第 ' + (qi + 1) + ' / ' + questions.length + ' 题</span><span>答对 ' + score + ' 题</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + (qi / questions.length * 100) + '%"></div></div>' +
        '<div class="quiz-question">' + esc(q.q) + '</div>' +
        '<div class="opt-grid">' + shuffled.map((s) =>
          '<button class="opt-btn" data-ans="' + s.i + '">' + esc(s.o) + '</button>').join('') + '</div>' +
        '</div>';

      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      locked = false;

      box.querySelectorAll('.opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          locked = true;
          if (+btn.getAttribute('data-ans') === q.ans) {
            score++;
            btn.classList.add('correct');
            CS.sfx.correct();
            setTimeout(() => { qi++; nextQ(); }, 700);
          } else {
            btn.classList.add('wrong');
            CS.sfx.wrong();
            const right = box.querySelector('[data-ans="' + q.ans + '"]');
            if (right) right.classList.add('correct');
            setTimeout(() => { qi++; nextQ(); }, 1300);
          }
        });
      });
    }

    function finish() {
      const total = questions.length;
      const stars = score >= total ? 3 : score >= Math.ceil(total * 0.7) ? 2 : 1;
      state.markDone('text_' + text.id);
      CS.showResult({
        emoji: score >= total ? '🏆' : '👏',
        title: score >= total ? '阅读小达人，全对！' : '完成阅读理解！',
        msg: '《' + esc(text.title) + '》答对 ' + score + '/' + total + ' 题',
        stars,
        onAgain: () => startQuiz(text),
        onBack: () => { box.innerHTML = ''; navigate('text'); }
      });
    }

    nextQ();
  }

  CS.register('text', render);
})(window.CS);
