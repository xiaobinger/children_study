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
    ensureDefaultCartoons();
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
      '<span class="lc-sub" style="word-break:break-all">' + esc(c.url.slice(0, 40)) + (c.url.length > 40 ? '…' : '') + '</span></span>' +
      '<button class="btn btn-primary" data-vp="' + esc(c.title) + '" data-vpurl="' + esc(c.url) + '" data-vpem="' + esc(c.emoji || '📺') + '" style="padding:.4rem .9rem;font-size:.85rem">▶ 播放</button></div>'
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
        const url = btn.getAttribute('data-url-open');
        // APK 环境拦截跳转，改为提示录入直链
        if (typeof CsAudio !== 'undefined') {
          openVideoPlayer({ title: '粘贴的视频', url: url, emoji: '📺' });
        } else {
          window.open(url, '_blank', 'noopener');
        }
      });
    });
    box.querySelectorAll('[data-vp]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        CS.sfx.tap();
        openVideoPlayer({ title: btn.getAttribute('data-vp'), url: btn.getAttribute('data-vpurl'), emoji: btn.getAttribute('data-vpem') });
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

    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">📚</span>推荐动画库</h2>' +
      '<button class="btn btn-ghost" id="recBack">‹ 返回</button></div>' +
      '<p class="hint-text">精选适合小朋友的热门动画；点「找视频」自动填入关键词，<br>搜索打开后复制<b>视频页链接</b>，粘贴到下方录入，就能在应用内直接播放。</p>' +

      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🔍</span>全网搜索动画</div>' +
      '<div class="form-row"><label for="searchKw">输入想看的动画名称</label>' +
      '<input class="form-input" id="searchKw" placeholder="比如：小猪佩奇、汪汪队、恐龙动画..."></div>' +
      '<div class="play-controls">' +
      '<button class="btn btn-primary" id="searchBili">🔍 去哔哩哔哩搜索</button>' +
      '<button class="btn btn-ghost" id="searchYt">📺 去 YouTube 搜索</button></div>' +
      '<p class="hint-text">打开搜索页后复制视频链接，粘贴到下方录入</p>' +
      '<div class="form-row"><label for="searchUrl">粘贴视频链接（https:// 开头）</label>' +
      '<input class="form-input" id="searchUrl" placeholder="https://www.bilibili.com/video/BV..."></div>' +
      '<div class="form-row"><label for="searchTitle">给它起个名字</label>' +
      '<input class="form-input" id="searchTitle" maxlength="20" placeholder="比如：小猪佩奇 第一季"></div>' +
      '<button class="btn btn-warn" id="searchAdd">＋ 添加到我的动画库</button></div>' +

      '<div class="section-title">🌟 热门推荐（' + recs.length + ' 部）</div>' +
      '<div class="card-list">' + recs.map((r) =>
        '<div class="list-card" style="cursor:default">' +
        '<span class="lc-icon">' + r.emoji + '</span>' +
        '<span class="lc-body"><span class="lc-title">' + esc(r.title) + '</span>' +
        '<span class="lc-sub">' + esc(r.desc) + '</span></span>' +
        '<button class="btn btn-primary" data-rec-find="' + esc(r.title) + '" style="padding:.4rem .9rem;font-size:.85rem">🔍 找视频</button>' +
        '</div>'
      ).join('') + '</div>';

    document.getElementById('recBack').onclick = () => { CS.sfx.tap(); CS.navigate('cartoon'); };

    // 点推荐卡片 → 自动填入搜索关键词，引导家长找到视频页后录入真实链接
    view.querySelectorAll('[data-rec-find]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-rec-find');
        const rec = recs.find((r) => r.title === title);
        if (!rec) return;
        const kw = document.getElementById('searchKw');
        if (kw) { kw.value = rec.keyword || rec.title; kw.focus(); }
        CS.sfx.tap();
        CS.toast('已填入「' + (rec.keyword || rec.title) + '」，搜索找到视频后复制链接，粘贴到下方录入即可内嵌播放');
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
      CS.store.set('cartoons', state.cartoons);
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

  /* ---------- 内置视频播放器（支持直链mp4 / YouTube / Bilibili） ---------- */
  function openVideoPlayer(cartoon) {
    closeVideoPlayer();
    const wrap = document.createElement('div');
    wrap.className = 'video-player';
    wrap.id = 'videoPlayer';

    const urlInfo = parseVideoUrl(cartoon.url);
    const isApk = typeof CsAudio !== 'undefined';
    let inner = '';
    if (urlInfo.type === 'video') {
      inner = '<video id="vpVideo" src="' + esc(cartoon.url) + '" controls playsinline></video>';
    } else if (urlInfo.type === 'youtube') {
      inner = '<div class="vp-iframe-wrap"><iframe id="vpFrame" src="' + esc(urlInfo.embed) + '" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
    } else if (urlInfo.type === 'bilibili') {
      inner = '<div class="vp-iframe-wrap"><iframe id="vpFrame" src="' + esc(urlInfo.embed) + '" frameborder="0" allowfullscreen scrolling="no"></iframe></div>';
    } else if (isApk) {
      // APK 内不跳转，引导家长换可内嵌播放的视频链接
      inner = '<div class="vp-fallback"><div class="result-emoji">🔗</div><p>这个链接无法在应用内播放</p>' +
        '<p class="hint-text" style="color:#ffd98a">请爸爸妈妈到「家长中心 → 动画库」换个链接：<br>B站视频页（…/video/BV开头的链接）<br>或以 .mp4 结尾的视频直链</p></div>';
    } else {
      inner = '<div class="vp-fallback"><div class="result-emoji">🔗</div><p>这个链接无法内嵌播放</p>' +
        '<a class="btn btn-primary" href="' + esc(cartoon.url) + '" target="_blank" rel="noopener" style="margin-top:.8rem">在新窗口打开</a></div>';
    }

    wrap.innerHTML =
      '<div class="vp-overlay" id="vpOverlay">' +
      '<div class="vp-countdown" id="vpCountdown"></div></div>' +
      inner +
      '<div class="vp-bar">' +
      '<span class="vp-title">📺 ' + esc(cartoon.title) + '</span>' +
      '<button class="btn btn-ghost" id="vpClose">退出 ✕</button></div>';
    document.body.appendChild(wrap);

    document.getElementById('vpClose').onclick = () => { CS.sfx.tap(); closeVideoPlayer(); };

    // 检测嵌入加载失败（iframe 被拒绝/超时）
    if (urlInfo.type === 'youtube' || urlInfo.type === 'bilibili') {
      detectEmbedFailure();
    }

    // 启动播放计时
    startVideoTimer();
  }

  /* 检测 iframe 是否成功加载：以 load 事件为准，加载成功就撤掉提示；超时才提示（APK 网络慢给 8 秒） */
  function detectEmbedFailure() {
    const frame = document.getElementById('vpFrame');
    if (!frame) return;
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; hideEmbedHint(); });
    const isApk = typeof CsAudio !== 'undefined';
    const maxChecks = isApk ? 16 : 6;
    let checkCount = 0;
    const checker = setInterval(() => {
      checkCount++;
      if (!document.getElementById('vpFrame')) { clearInterval(checker); return; }
      if (loaded) { clearInterval(checker); return; }
      if (checkCount >= maxChecks) {
        clearInterval(checker);
        const overlay = document.getElementById('vpOverlay');
        if (overlay && !overlay.classList.contains('timeup')) showEmbedHint(overlay, isApk);
      }
    }, 500);
  }

  function showEmbedHint(overlay, isApk) {
    let hint = document.getElementById('vpEmbedHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'vpEmbedHint';
      hint.className = 'vp-embed-hint';
      overlay.appendChild(hint);
    }
    if (isApk) {
      // APK 内不提供跳转按钮，避免跳出应用
      hint.innerHTML = '⚠️ 视频加载不出来：可能是网络不好，或该视频不允许嵌入播放。<br>请退出后换个视频链接试试（B站视频页 / .mp4 直链）';
    } else {
      hint.innerHTML = '⚠️ 视频加载失败：直接打开 index.html 无法播放。<br>请在本地服务器下运行（见 README），或点下方按钮在新窗口打开。<br>' +
        '<button class="btn btn-primary" id="vpOpenExt" style="margin-top:.6rem">在新窗口打开 ↗</button>';
      document.getElementById('vpOpenExt').onclick = () => {
        const f = document.getElementById('vpFrame');
        if (f && f.src && f.src !== 'about:blank') {
          window.open(f.src.replace('embed/', 'watch?v=').replace(/\?.*/, ''), '_blank', 'noopener');
        }
      };
    }
  }

  function hideEmbedHint() {
    const hint = document.getElementById('vpEmbedHint');
    if (hint) hint.remove();
  }

  /* 解析视频链接 → {type, embed} */
  function parseVideoUrl(url) {
    if (!url) return { type: 'unknown' };
    // 直接视频文件
    if (/\.(mp4|m3u8|webm|ogg|mov)(\?|$)/i.test(url)) return { type: 'video' };
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (ytMatch) return { type: 'youtube', embed: 'https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=0&rel=0' };
    // Bilibili
    const bvMatch = url.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/i);
    if (bvMatch) return { type: 'bilibili', embed: 'https://player.bilibili.com/player.html?bvid=' + bvMatch[1] + '&page=1&high_quality=1&danmaku=0&autoplay=0' };
    const b2Match = url.match(/b23\.tv\/(BV[A-Za-z0-9A-Za-z]+)/i);
    if (b2Match) return { type: 'bilibili', embed: 'https://player.bilibili.com/player.html?bvid=' + b2Match[1] + '&page=1&high_quality=1&danmaku=0&autoplay=0' };
    return { type: 'unknown' };
  }

  let videoTimer = null;
  function startVideoTimer() {
    if (videoTimer) clearInterval(videoTimer);
    videoTimer = setInterval(() => {
      if (state.cartoonMins <= 0) {
        clearInterval(videoTimer); videoTimer = null;
        forceStopVideo();
        return;
      }
      if (!document.hidden) CS.reward.tickMins(1 / 60);
      updateCountdown();
      if (state.cartoonMins <= 0) {
        clearInterval(videoTimer); videoTimer = null;
        forceStopVideo();
      }
    }, 1000);
  }

  function updateCountdown() {
    const el = document.getElementById('vpCountdown');
    if (!el) return;
    const s = Math.ceil(state.cartoonMins * 60);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = '⏱ ' + mm + ':' + ss;
    const overlay = document.getElementById('vpOverlay');
    if (overlay) {
      overlay.classList.toggle('urgent', state.cartoonMins < 5);
      overlay.classList.toggle('timeup', state.cartoonMins <= 0);
    }
  }

  function forceStopVideo() {
    const v = document.getElementById('vpVideo');
    if (v) { v.pause(); v.src = ''; }
    const f = document.getElementById('vpFrame');
    if (f) f.src = 'about:blank';
    const overlay = document.getElementById('vpOverlay');
    if (overlay) {
      overlay.classList.add('timeup');
      overlay.innerHTML = '<div class="vp-timeup-card"><div class="result-emoji">⏰</div><h3>动画时间到啦</h3><p>今天的动画看完咯～<br>休息小眼睛，明天继续学习赢星星吧！</p><button class="btn btn-primary btn-big" id="vpTuOk">好的 👌</button></div>';
      document.getElementById('vpTuOk').onclick = () => { CS.hideModal && CS.hideModal(); closeVideoPlayer(); navigate('cartoon'); };
    }
  }

  function closeVideoPlayer() {
    if (videoTimer) { clearInterval(videoTimer); videoTimer = null; }
    const el = document.getElementById('videoPlayer');
    if (el) el.remove();
  }

  CS.stopVideo = closeVideoPlayer;

  /* 首次预填充动画库：旧版本预置过 YouTube/B站搜索页链接，这类链接无法内嵌播放（会跳转），统一清掉 */
  function ensureDefaultCartoons() {
    const before = state.cartoons.length;
    state.cartoons = state.cartoons.filter((c) =>
      !/^def\d+$/.test(c.id) &&
      !/search\.bilibili\.com|results\?search_query/.test(c.url || ''));
    if (state.cartoons.length !== before) CS.store.set('cartoons', state.cartoons);
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
