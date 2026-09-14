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
        '<div class="hint-text">⏳ 暂无动画时间<br>学习赢星星，兑换后这里会开启动画小剧场！<br>家长也可先去「推荐动画库」选好动画备用哦。</div>';
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
      '<div class="list-card" style="cursor:default">' +
      '<span class="lc-icon">' + esc(c.emoji || '📺') + '</span>' +
      '<span class="lc-body"><span class="lc-title">' + esc(c.title) + '</span>' +
      '<span class="lc-sub" style="word-break:break-all">' + esc(c.url) + '</span></span>' +
      '<button class="icon-btn" data-url-open="' + esc(c.url) + '" title="打开" style="width:2rem;height:2rem;font-size:1rem">↗</button></div>'
    ).join('');

    const customCount = state.cartoons.length;
    box.innerHTML =
      '<div class="watch-banner" id="watchBanner">⏱ 剩余动画时间：<b id="watchTime"></b></div>' +
      '<div class="section-title">🎭 动画小剧场</div>' +
      '<div class="card-list">' + builtin + '</div>' +
      (custom ? '<div class="section-title">📺 我的动画（' + customCount + ' 部）</div><div class="card-list">' + custom + '</div>' : '') +
      '<p class="hint-text">想要更多动画？<button class="tab-btn" id="goRecs" style="margin-left:.4em">去推荐动画库 👉</button></p>';

    updateWatchTime();
    box.querySelectorAll('[data-scene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        openTheater(btn.getAttribute('data-scene'), btn.getAttribute('data-title'));
      });
    });
    box.querySelectorAll('[data-url-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        CS.sfx.tap();
        window.open(btn.getAttribute('data-url-open'), '_blank', 'noopener');
      });
    });
    const goRecs = document.getElementById('goRecs');
    if (goRecs) goRecs.onclick = () => { CS.sfx.tap(); renderRecs(document.getElementById('view')); };

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
        if (Math.random() < 0.1) CS.reward.saveMins();
        updateWatchTime();
        if (state.cartoonMins <= 0) {
          clearInterval(tickTimer); tickTimer = null;
          CS.reward.saveMins();
          timeUp();
        }
      }
    }, 1000);
  }

  /* ---------- 推荐动画库 + 全网搜索 ---------- */
  function renderRecs(view) {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    const recs = CS.DATA.cartoonRecs || [];
    const addedTitles = (state.cartoons || []).map((c) => c.title);

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">📚</span>推荐动画库</h2>' +
      '<button class="btn btn-ghost" id="recBack">‹ 返回</button></div>' +
      '<p class="hint-text">精选适合小朋友的热门动画，一键添加到我的动画库；<br>也可全网搜索，找到喜欢的视频后手动录入链接。</p>' +

      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🔍</span>全网搜索动画</div>' +
      '<div class="form-row"><label for="searchKw">输入想看的动画名称</label>' +
      '<input class="form-input" id="searchKw" placeholder="比如：小猪佩奇、汪汪队、恐龙动画..."></div>' +
      '<div class="play-controls">' +
      '<button class="btn btn-primary" id="searchBili">🔍 去哔哩哔哩搜索</button>' +
      '<button class="btn btn-ghost" id="searchYt">📺 去 YouTube 搜索</button></div>' +
      '<p class="hint-text">打开搜索页后复制视频链接，粘贴到下方录入</p>' +
      '<div class="form-row"><label for="searchUrl">粘贴视频链接（https:// 开头）</label>' +
      '<input class="form-input" id="searchUrl" placeholder="https://www.bilibili.com/video/..."></div>' +
      '<div class="form-row"><label for="searchTitle">给它起个名字</label>' +
      '<input class="form-input" id="searchTitle" maxlength="20" placeholder="比如：小猪佩奇 第一季"></div>' +
      '<button class="btn btn-warn" id="searchAdd">＋ 添加到我的动画库</button></div>' +

      '<div class="section-title">🌟 热门推荐（' + recs.length + ' 部，点一键添加）</div>' +
      '<div class="card-list">' + recs.map((r) => {
        const added = addedTitles.includes(r.title);
        return '<div class="list-card" style="cursor:default">' +
          '<span class="lc-icon">' + r.emoji + '</span>' +
          '<span class="lc-body"><span class="lc-title">' + esc(r.title) + '</span>' +
          '<span class="lc-sub">' + esc(r.desc) + '</span></span>' +
          (added ? '<span class="done-badge">已添加 ✓</span>' :
            '<button class="btn btn-primary" data-rec-add="' + esc(r.title) + '" style="padding:.4rem .9rem;font-size:.85rem">一键添加</button>') +
          '</div>';
      }).join('') + '</div>';

    document.getElementById('recBack').onclick = () => { CS.sfx.tap(); CS.navigate('cartoon'); };

    view.querySelectorAll('[data-rec-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-rec-add');
        const rec = recs.find((r) => r.title === title);
        if (!rec) return;
        if ((state.cartoons || []).some((c) => c.title === title)) return;
        const urlMap = {
          bilibili: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(rec.keyword || rec.title),
          youtube: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(rec.keyword || rec.title)
        };
        state.cartoons.push({
          id: 'rec' + Date.now() + Math.random().toString(36).slice(2, 6),
          title: rec.title, url: urlMap[rec.platform] || urlMap.bilibili, emoji: rec.emoji
        });
        store.set('cartoons', state.cartoons);
        CS.sfx.star();
        CS.toast('已添加：' + rec.title + ' 🎉');
        renderRecs(view);
      });
    });

    document.getElementById('searchBili').onclick = () => {
      const kw = (document.getElementById('searchKw').value.trim() || '儿童动画');
      window.open('https://search.bilibili.com/all?keyword=' + encodeURIComponent(kw), '_blank', 'noopener');
      CS.sfx.tap();
    };
    document.getElementById('searchYt').onclick = () => {
      const kw = (document.getElementById('searchKw').value.trim() || 'kids cartoon');
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(kw), '_blank', 'noopener');
      CS.sfx.tap();
    };

    document.getElementById('searchAdd').onclick = () => {
      const url = document.getElementById('searchUrl').value.trim();
      const title = document.getElementById('searchTitle').value.trim();
      if (!title) { CS.toast('请填写动画名字'); return; }
      if (!/^https:\/\//.test(url)) { CS.toast('链接需以 https:// 开头'); return; }
      state.cartoons.push({ id: 'u' + Date.now(), title, url, emoji: '📺' });
      store.set('cartoons', state.cartoons);
      CS.sfx.star();
      CS.toast('已添加：' + title + ' 🎉');
      document.getElementById('searchUrl').value = '';
      document.getElementById('searchTitle').value = '';
      renderRecs(view);
    };
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
