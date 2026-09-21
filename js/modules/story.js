/* ============ 童话故事模块 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool, shuffle } = CS;

  function storiesByAge() {
    const pool = agePool(state.age);
    return CS.DATA.stories.filter((s) => pool.includes(s.age));
  }

  function render(view, params) {
    if (params && params.id) renderDetail(view, params);
    else renderList(view);
  }

  function renderList(view) {
    const stories = storiesByAge();
    if (!stories.length) {
      view.innerHTML = '<div class="empty-tip">这个年龄段暂时没有童话，敬请期待 🏰</div>';
      return;
    }
    const cards = stories.map((s) =>
      '<button class="list-card" data-id="' + s.id + '">' +
      '<span class="lc-icon">' + s.emoji + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(s.title) + '</span>' +
      '<span class="lc-sub">' + esc(s.passage[0].slice(0, 18)) + '…</span></span>' +
      (state.done['story_' + s.id] ? '<span class="done-badge">已读完 ✓</span>' : '') +
      '<span class="lc-arrow">›</span></button>'
    ).join('');

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">🏰</span>童话城堡</h2></div>' +
      '<p class="hint-text">读一读原创小童话，答对题目，看看故事里藏着什么道理！</p>' +
      '<div class="card-list">' + cards + '</div>';

    view.querySelectorAll('.list-card').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate('story', { id: btn.getAttribute('data-id') }); });
    });
  }

  /* 道理框：答完题后揭晓 */
  function moralBox(story) {
    const done = !!state.done['story_' + story.id];
    return done
      ? '<div class="story-moral"><span class="sm-icon">💡</span><b>故事的道理：</b>' + esc(story.moral) + '</div>'
      : '<div class="story-moral story-moral-locked"><span class="sm-icon">🔒</span>答完阅读题，就能看到故事里藏着的道理哦！</div>';
  }

  function renderDetail(view, params) {
    const story = CS.DATA.stories.find((s) => s.id === params.id) || storiesByAge()[0];
    if (!story) { view.innerHTML = '<div class="empty-tip">没有找到这篇童话</div>'; return; }

    view.innerHTML =
      '<div class="back-row"><button class="btn btn-ghost" id="storyBack">‹ 返回童话列表</button></div>' +
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">' + story.emoji + '</span>' + esc(story.title) + '</div>' +
      '<div class="read-controls" style="justify-content:center">' +
      '<button class="btn btn-primary" id="storySpeak">🔊 听朗读</button>' +
      '<button class="btn btn-ghost" id="storyStop">⏹ 停止</button></div>' +
      '</div>' +
      '<div class="text-passage">' + story.passage.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>' +
      moralBox(story) +
      '<div class="play-controls" style="margin-top:1rem">' +
      '<button class="btn btn-warn btn-big" id="storyQuiz">开始答题 🚀</button></div>' +
      '<div id="storyQuizBox"></div>';

    document.getElementById('storyBack').onclick = () => { CS.stopSpeak(); navigate('story'); };
    document.getElementById('storySpeak').onclick = () => {
      if (!CS.speak(story.title + '。' + story.passage.join(''), { key: 'story:' + story.id })) CS.toast('当前浏览器不支持朗读');
    };
    document.getElementById('storyStop').onclick = () => CS.stopSpeak();
    document.getElementById('storyQuiz').onclick = () => startQuiz(story);
  }

  function startQuiz(story) {
    const box = document.getElementById('storyQuizBox');
    const questions = shuffle(story.quiz.map((q, i) => ({ ...q, id: i })));
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
      state.markDone('story_' + story.id);
      // 答完题揭晓道理
      const moralEl = document.querySelector('.story-moral');
      if (moralEl) {
        moralEl.className = 'story-moral';
        moralEl.innerHTML = '<span class="sm-icon">💡</span><b>故事的道理：</b>' + esc(story.moral);
      }
      CS.showResult({
        emoji: score >= total ? '👑' : '📖',
        title: score >= total ? '童话小达人，全对！' : '读完一篇好童话！',
        msg: '《' + esc(story.title) + '》答对 ' + score + '/' + total + ' 题',
        stars,
        onAgain: () => startQuiz(story),
        onBack: () => { box.innerHTML = ''; navigate('story'); }
      });
    }

    nextQ();
  }

  CS.register('story', render);
})(window.CS);
