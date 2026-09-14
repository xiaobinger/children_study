/* ============ 手工课堂模块 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool } = CS;

  function craftsByAge() {
    const pool = agePool(state.age);
    return CS.DATA.crafts.filter((c) => pool.includes(c.age));
  }

  function render(view, params) {
    if (params && params.id) renderDetail(view, params);
    else renderList(view);
  }

  function renderList(view) {
    const crafts = craftsByAge();
    if (!crafts.length) {
      view.innerHTML = '<div class="empty-tip">这个年龄段暂时没有手工，敬请期待 ✂️</div>';
      return;
    }
    const cards = crafts.map((c) =>
      '<button class="list-card" data-id="' + c.id + '">' +
      '<span class="lc-icon">' + c.emoji + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(c.title) + '</span>' +
      '<span class="lc-sub">⏱ ' + esc(c.time) + ' · ' + c.steps.length + ' 个步骤</span></span>' +
      (state.done['craft_' + c.id] ? '<span class="done-badge">已完成 ✓</span>' : '') +
      '<span class="lc-arrow">›</span></button>'
    ).join('');

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">✂️</span>手工课堂</h2></div>' +
      '<p class="hint-text">跟着步骤一步一步做，做完一个步骤点一下它！<br>✂️ 使用剪刀时请爸爸妈妈陪同哦。</p>' +
      '<div class="card-list">' + cards + '</div>';

    view.querySelectorAll('.list-card').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate('craft', { id: btn.getAttribute('data-id') }); });
    });
  }

  function renderDetail(view, params) {
    const craft = CS.DATA.crafts.find((c) => c.id === params.id) || craftsByAge()[0];
    if (!craft) { view.innerHTML = '<div class="empty-tip">没有找到这个手工</div>'; return; }

    const steps = craft.steps.map((s, i) => ({
      ...s,
      key: 'craft_' + craft.id + '_step' + i,
      done: !!state.done['craft_' + craft.id + '_step' + i]
    }));

    view.innerHTML =
      '<div class="back-row"><button class="btn btn-ghost" id="craftBack">‹ 返回手工列表</button>' +
      '<span class="hint-text" style="margin:0">⏱ ' + esc(craft.time) + '</span></div>' +
      '<div class="quiz-area" style="text-align:center">' +
      '<div class="quiz-question"><span class="q-emoji">' + craft.emoji + '</span>' + esc(craft.title) + '</div>' +
      '<div class="section-title" style="justify-content:center;margin:0">🎒 准备材料</div>' +
      '<div class="materials">' + craft.materials.map((m) =>
        '<span class="material-chip">' + esc(m) + '</span>').join('') + '</div>' +
      '<p class="hint-text">💡 ' + esc(craft.tip) + '</p>' +
      '</div>' +

      '<div class="section-title">📝 跟着步骤做</div>' +
      '<div id="craftSteps">' + steps.map((s, i) =>
        '<div class="craft-step' + (s.done ? ' done' : '') + '" data-i="' + i + '">' +
        '<span class="cs-num">' + (s.done ? '✓' : i + 1) + '</span>' +
        '<span class="cs-body"><span class="cs-title">' + esc(s.title) + '</span>' +
        '<span class="cs-desc">' + esc(s.desc) + '</span></span>' +
        '<span class="cs-check">' + (s.done ? '✔' : '　') + '</span></div>'
      ).join('') + '</div>' +
      '<div class="progress-track" style="margin:1rem 0"><div class="progress-fill" id="craftProgress"></div></div>' +
      '<div class="hint-text" style="text-align:center" id="craftCount"></div>' +
      '<div class="play-controls"><button class="btn btn-warn btn-big" id="craftReset">↺ 重新开始</button></div>';

    const stepsBox = document.getElementById('craftSteps');

    function updateProgress() {
      const doneCount = steps.filter((s) => s.done).length;
      document.getElementById('craftProgress').style.width = (doneCount / steps.length * 100) + '%';
      document.getElementById('craftCount').textContent = '已完成 ' + doneCount + ' / ' + steps.length + ' 个步骤';
      if (doneCount === steps.length) celebrate();
    }

    function celebrate() {
      state.markDone('craft_' + craft.id);
      CS.showResult({
        emoji: craft.emoji,
        title: '手工完成，你真棒！',
        msg: '《' + esc(craft.title) + '》全部步骤完成啦！',
        stars: 3,
        onAgain: () => resetSteps(),
        onBack: () => navigate('craft')
      });
    }

    function resetSteps() {
      steps.forEach((s) => {
        s.done = false;
        delete state.done[s.key];
      });
      state.done['craft_' + craft.id] = false;
      CS.store.set('done', state.done);
      stepsBox.querySelectorAll('.craft-step').forEach((el, i) => {
        el.classList.remove('done');
        el.querySelector('.cs-num').textContent = i + 1;
        el.querySelector('.cs-check').textContent = '　';
      });
      updateProgress();
    }

    stepsBox.querySelectorAll('.craft-step').forEach((el) => {
      el.addEventListener('click', () => {
        const i = +el.getAttribute('data-i');
        const s = steps[i];
        s.done = !s.done;
        state.done[s.key] = s.done;
        CS.store.set('done', state.done);
        el.classList.toggle('done', s.done);
        el.querySelector('.cs-num').textContent = s.done ? '✓' : i + 1;
        el.querySelector('.cs-check').textContent = s.done ? '✔' : '　';
        CS.sfx[s.done ? 'correct' : 'tap']();
        updateProgress();
      });
    });

    document.getElementById('craftBack').onclick = () => navigate('craft');
    document.getElementById('craftReset').onclick = resetSteps;
    updateProgress();
  }

  CS.register('craft', render);
})(window.CS);
