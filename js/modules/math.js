/* ============ 数学闯关模块 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate } = CS;

  function render(view) {
    const rounds = 10;
    const questions = CS.DATA.mathGen.makeRound(state.age, rounds);
    let qi = 0, score = 0, locked = false;

    function renderQ() {
      if (qi >= rounds) { finish(); return; }
      const q = questions[qi];
      let body = '';

      if (q.type === 'count') {
        body =
          '<div class="math-visual">' + q.visual.map((e) => '<span>' + e + '</span>').join('') + '</div>' +
          '<div class="opt-grid">' + q.options.map((o) =>
            '<button class="opt-btn" data-val="' + o + '">' + o + '</button>').join('') + '</div>';
      } else if (q.type === 'more') {
        body =
          '<div class="opt-grid" style="grid-template-columns:repeat(2,1fr)">' +
          '<button class="opt-btn math-group" data-val="A" style="font-size:1.6rem;line-height:1.7;white-space:normal">' +
          q.visualA.join('') + '</button>' +
          '<button class="opt-btn math-group" data-val="B" style="font-size:1.6rem;line-height:1.7;white-space:normal">' +
          q.visualB.join('') + '</button></div>';
      } else {
        body =
          '<div class="math-expr">' + esc(q.prompt) + '</div>' +
          '<div class="opt-grid">' + q.options.map((o) =>
            '<button class="opt-btn" data-val="' + o + '">' + o + '</button>').join('') + '</div>';
      }

      view.innerHTML =
        '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">🔢</span>数学闯关</h2></div>' +
        '<div class="quiz-area">' +
        '<div class="score-bar"><span>第 ' + (qi + 1) + ' / ' + rounds + ' 题</span><span>答对 ' + score + ' 题</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + (qi / rounds * 100) + '%"></div></div>' +
        '<div class="quiz-question"><span class="q-emoji">🧮</span>' + esc(q.prompt) + '</div>' +
        body +
        '</div>';

      locked = false;
      view.querySelectorAll('.opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          const val = btn.getAttribute('data-val');
          const correct = q.type === 'more' ? val === q.answerA : +val === +q.answer;
          if (correct) {
            locked = true;
            score++;
            btn.classList.add('correct');
            CS.sfx.correct();
            setTimeout(() => { qi++; renderQ(); }, 650);
          } else {
            btn.classList.add('wrong');
            CS.sfx.wrong();
            view.querySelectorAll('.opt-btn').forEach((b2) => {
              const v2 = b2.getAttribute('data-val');
              const ok2 = q.type === 'more' ? v2 === q.answerA : +v2 === +q.answer;
              if (ok2) b2.classList.add('correct');
            });
            locked = true;
            setTimeout(() => { qi++; renderQ(); }, 1300);
          }
        });
      });
    }

    function finish() {
      const stars = score >= rounds ? 3 : score >= Math.round(rounds * 0.8) ? 2 : 1;
      CS.showResult({
        emoji: score >= rounds ? '🏆' : '👏',
        title: score >= rounds ? '数学小天才，满分！' : '闯关完成！',
        msg: '共答对 ' + score + '/' + rounds + ' 题',
        stars,
        onAgain: () => render(view),
        onBack: () => navigate('home')
      });
    }

    renderQ();
  }

  CS.register('math', render);
})(window.CS);
