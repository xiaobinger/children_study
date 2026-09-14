/* ============ 动画小剧场：星星兑换 + 观看计时 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate } = CS;

  let tickTimer = null;

  CS.stopCartoon = function () {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    CS.reward.saveMins();
  };

  function render(view) {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    const reward = state.reward;
    const canExchange = state.stars >= reward.stars;

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">🎬</span>动画小剧场</h2></div>' +

      '<div class="quiz-area exchange-card">' +
      '<div class="quiz-question"><span class="q-emoji">🎁</span>星星换动画时间</div>' +
      '<div class="exchange-progress">' +
      '<div class="progress-track"><div class="progress-fill" style="width:' +
      Math.min(100, state.stars / reward.stars * 100) + '%"></div></div>' +
      '<p class="hint-text">当前 <b>' + state.stars + '</b> / ' + reward.stars + ' 颗星星 → 可换 <b>' +
      reward.minutes + ' 分钟</b>动画时间<br><small>（继续学习赢星星，攒够了就能兑换啦）</small></p></div>' +
      '<button class="btn ' + (canExchange ? 'btn-warn' : 'btn-ghost') + ' btn-big" id="exBtn"' +
      (canExchange ? '' : ' disabled') + '>' +
      (canExchange ? '兑换 ' + reward.stars + ' ⭐ → ' + reward.minutes + ' 分钟 🎉' : '星星还不够，先去学习吧') + '</button>' +
      '</div>' +

      '<div id="cartoonWatch"></div>';

    const exBtn = document.getElementById('exBtn');
    exBtn.onclick = () => {
      if (!CS.reward.exchange()) return;
      CS.sfx.star();
      CS.confettiBurst();
      CS.toast('兑换成功！动画时间 +' + reward.minutes + ' 分钟 🎉');
      render(view);
    };
    renderWatch();
  }

  function renderWatch() {
    const box = document.getElementById('cartoonWatch');
    if (state.cartoonMins <= 0) {
      box.innerHTML =
        '<div class="hint-text">⏳ 暂无动画时间<br>学习赢星星，兑换后这里会开启动画小剧场！</div>';
      return;
    }

    const builtin = CS.DATA.cartoons.map((c) =>
      '<button class="list-card" data-scene="' + c.scene + '" data-title="' + esc(c.title) + '">' +
      '<span class="lc-icon">' + c.emoji + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(c.title) + '</span>' +
      '<span class="lc-sub">' + esc(c.desc) + '</span></span>' +
      '<span class="lc-arrow">▶</span></button>'
    ).join('');

    const custom = state.cartoons.map((c) =>
      '<button class="list-card" data-url="' + esc(c.url) + '">' +
      '<span class="lc-icon">' + esc(c.emoji || '📺') + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(c.title) + '</span>' +
      '<span class="lc-sub">家长添加 · 点击观看</span></span>' +
      '<span class="lc-arrow">↗</span></button>'
    ).join('');

    box.innerHTML =
      '<div class="watch-banner" id="watchBanner">⏱ 剩余动画时间：<b id="watchTime"></b></div>' +
      '<div class="section-title">🎭 动画小剧场</div>' +
      '<div class="card-list">' + builtin + '</div>' +
      (custom ? '<div class="section-title">📺 家长添加的动画</div><div class="card-list">' + custom + '</div>' : '');

    updateWatchTime();
    box.querySelectorAll('[data-scene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        openTheater(btn.getAttribute('data-scene'), btn.getAttribute('data-title'));
      });
    });
    box.querySelectorAll('[data-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        window.open(btn.getAttribute('data-url'), '_blank', 'noopener');
      });
    });

    // 每秒倒计时（页面可见时才计时）
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (state.cartoonMins <= 0) {
        clearInterval(tickTimer); tickTimer = null;
        CS.reward.saveMins();
        timeUp();
        return;
      }
      if (!document.hidden) {
        CS.reward.tickMins(1 / 60);
        if (Math.random() < 0.1) CS.reward.saveMins(); // 时常持久化
        updateWatchTime();
        if (state.cartoonMins <= 0) {
          clearInterval(tickTimer); tickTimer = null;
          CS.reward.saveMins();
          timeUp();
        }
      }
    }, 1000);
  }

  function updateWatchTime() {
    const el = document.getElementById('watchTime');
    if (!el) return;
    const s = Math.ceil(state.cartoonMins * 60);
    el.textContent = Math.floor(s / 60) + ' 分 ' + String(s % 60).padStart(2, '0') + ' 秒';
    const banner = document.getElementById('watchBanner');
    if (banner) banner.classList.toggle('urgent', state.cartoonMins < 5);
  }

  function timeUp() {
    document.querySelector('.theater') && closeTheater();
    CS.showModal(
      '<div class="result-emoji">⏰</div>' +
      '<h3>动画时间到啦</h3>' +
      '<p>今天的动画看完咯～<br>休息一下小眼睛，明天继续学习赢星星吧！</p>' +
      '<button class="btn btn-primary btn-big" id="tuOk">好的 👌</button>'
    );
    document.getElementById('tuOk').onclick = () => { CS.hideModal(); navigate('cartoon'); };
  }

  /* ---------- 小剧场全屏场景 ---------- */
  function openTheater(scene, title) {
    closeTheater();
    const t = document.createElement('div');
    t.className = 'theater';
    t.id = 'theaterBox';
    t.innerHTML =
      '<div class="theater-stage scene-' + esc(scene) + '">' + sceneHtml(scene) + '</div>' +
      '<div class="theater-bar">' +
      '<span class="theater-title">🎭 ' + esc(title) + '</span>' +
      '<button class="btn btn-ghost" id="theaterClose">退出剧场 ✕</button></div>';
    document.body.appendChild(t);
    document.getElementById('theaterClose').onclick = closeTheater;
  }

  function sceneHtml(scene) {
    if (scene === 'space') {
      let stars = '';
      for (let i = 0; i < 18; i++) {
        stars += '<span class="t-star" style="left:' + (Math.random() * 95) + '%;top:' +
          (Math.random() * 85) + '%;animation-delay:' + (Math.random() * 2).toFixed(1) +
          's;font-size:' + (10 + Math.random() * 16) + 'px">✨</span>';
      }
      return stars +
        '<span class="t-planet">🪐</span><span class="t-planet2">🟡</span>' +
        '<span class="t-rocket">🚀</span><span class="t-rocket2">🛸</span>' +
        '<span class="t-astro" style="animation-delay:.6s">👨‍🚀</span>';
    }
    if (scene === 'ocean') {
      let bubbles = '';
      for (let i = 0; i < 14; i++) {
        bubbles += '<span class="t-bubble" style="left:' + (5 + Math.random() * 90) +
          '%;animation-delay:' + (Math.random() * 4).toFixed(1) + 's;animation-duration:' +
          (3 + Math.random() * 3).toFixed(1) + 's">🫧</span>';
      }
      let seaweed = '';
      for (let i = 0; i < 5; i++) {
        seaweed += '<span class="t-weed" style="left:' + (4 + i * 22) + '%">🌿</span>';
      }
      return bubbles + seaweed +
        '<span class="t-whale">🐳</span><span class="t-fish">🐠</span>' +
        '<span class="t-fish f2">🐟</span><span class="t-fish f3">🐡</span>' +
        '<span class="t-crab">🦀</span><span class="t-jelly" style="animation-delay:1.5s">🪼</span>';
    }
    // garden
    let petals = '';
    for (let i = 0; i < 10; i++) {
      petals += '<span class="t-petal" style="left:' + (Math.random() * 90) + '%;animation-delay:' +
        (Math.random() * 5).toFixed(1) + 's">🌸</span>';
    }
    return petals +
      '<span class="t-flower">🌻</span><span class="t-flower f2">🌷</span>' +
      '<span class="t-flower f3">🌼</span><span class="t-grass" style="left:10%">🌱</span>' +
      '<span class="t-butterfly">🦋</span><span class="t-butterfly b2" style="animation-delay:1s">🌈</span>' +
      '<span class="t-bee">🐝</span><span class="t-bee b2" style="animation-delay:.8s">🐞</span>' +
      '<span class="t-cloud">☁️</span><span class="t-sun">☀️</span>';
  }

  function closeTheater() {
    const t = document.getElementById('theaterBox');
    if (t) t.remove();
  }

  CS.register('cartoon', render);
})(window.CS);
