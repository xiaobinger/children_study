/* ============ 首页 & 更多页 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool, pick, shuffle } = CS;

  const MODULES = [
    { key: 'poem', icon: '📖', name: '古诗背诵', desc: '读诗、背诗、填字闯关', accent: 'poem' },
    { key: 'literacy', icon: '🔤', name: '识字乐园', desc: '字卡学习、找字游戏', accent: 'literacy' },
    { key: 'song', icon: '🎵', name: '儿歌欢唱', desc: '边弹边唱，歌词跟读', accent: 'song' },
    { key: 'text', icon: '📚', name: '课文阅读', desc: '读小故事，答理解题', accent: 'text' },
    { key: 'story', icon: '🏰', name: '童话城堡', desc: '原创童话，答题明理', accent: 'story' },
    { key: 'craft', icon: '✂️', name: '手工课堂', desc: '跟着步骤做手工', accent: 'craft' },
    { key: 'math', icon: '🔢', name: '数学闯关', desc: '数数、加减、乘除', accent: 'math' }
  ];

  function countFor(key) {
    const pool = agePool(state.age);
    if (key === 'poem') return CS.DATA.poems.filter((p) => pool.includes(p.age)).length + ' 首古诗';
    if (key === 'literacy') return CS.DATA.characters[state.age].length + ' 张字卡';
    if (key === 'song') return CS.DATA.songs.filter((s) => pool.includes(s.age)).length + ' 首儿歌';
    if (key === 'text') return CS.DATA.texts.filter((t) => pool.includes(t.age)).length + ' 篇课文';
    if (key === 'story') return CS.DATA.stories.filter((s) => pool.includes(s.age)).length + ' 篇童话';
    if (key === 'craft') return CS.DATA.crafts.filter((c) => pool.includes(c.age)).length + ' 个手工';
    if (key === 'math') return '无限题目';
    if (key === 'cartoon') return state.cartoonMins > 0 ? '有 ' + Math.ceil(state.cartoonMins) + ' 分钟' : '攒星换动画';
    return '';
  }

  function heroGreeting() {
    const name = CS.profile.name;
    const hour = new Date().getHours();
    const greet = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    return name ? greet + '，' + name + '！' : '你好呀，小朋友！';
  }

  function ageLabel() {
    const g = CS.AGE_GROUPS.find((x) => x.key === state.age);
    return g ? g.label : '';
  }

  /* 今日推荐：挑 3 个未完成的当前年龄内容 */
  function recommendations() {
    const pool = agePool(state.age);
    const items = [];
    CS.DATA.poems.filter((p) => pool.includes(p.age) && p.tier !== 'extra' && !state.done['poem_' + p.id])
      .forEach((p) => items.push({ icon: '📖', name: p.title, sub: '古诗闯关', nav: 'poem', params: { id: p.id } }));
    CS.DATA.texts.filter((t) => pool.includes(t.age) && !state.done['text_' + t.id])
      .forEach((t) => items.push({ icon: t.emoji, name: t.title, sub: '课文阅读', nav: 'text', params: { id: t.id } }));
    CS.DATA.stories.filter((s) => pool.includes(s.age) && !state.done['story_' + s.id])
      .forEach((s) => items.push({ icon: s.emoji, name: s.title, sub: '童话城堡', nav: 'story', params: { id: s.id } }));
    CS.DATA.crafts.filter((c) => pool.includes(c.age) && !state.done['craft_' + c.id])
      .forEach((c) => items.push({ icon: c.emoji, name: c.title, sub: '手工时间', nav: 'craft', params: { id: c.id } }));
    CS.DATA.songs.filter((s) => pool.includes(s.age) && !state.done['song_' + s.id])
      .forEach((s) => items.push({ icon: s.emoji, name: s.title, sub: '儿歌欢唱', nav: 'song', params: { id: s.id } }));
    if (items.length < 3) {
      items.push({ icon: '🔢', name: '数学闯关', sub: '练一练', nav: 'math', params: {} });
      items.push({ icon: '🔤', name: '识字乐园', sub: '认新字', nav: 'literacy', params: {} });
    }
    return shuffle(items).slice(0, 3);
  }

  function badges() {
    const thresholds = [
      { n: 10, emoji: '🥉', name: '初来乍到' },
      { n: 30, emoji: '🥈', name: '学习小将' },
      { n: 60, emoji: '🥇', name: '学习达人' },
      { n: 100, emoji: '🏆', name: '全能冠军' },
      { n: 200, emoji: '👑', name: '小小学霸' }
    ];
    return thresholds.map((t) => ({
      ...t,
      got: state.stars >= t.n,
      left: Math.max(0, t.n - state.stars)
    }));
  }

  function renderHome(view) {
    const cards = MODULES.map((m) =>
      '<button class="module-card" data-accent="' + m.accent + '" data-nav="' + m.key + '">' +
      '<span class="mc-count">' + esc(countFor(m.key)) + '</span>' +
      '<span class="mc-icon">' + m.icon + '</span>' +
      '<span class="mc-name">' + esc(m.name) + '</span>' +
      '<span class="mc-desc">' + esc(m.desc) + '</span></button>'
    ).join('');

    const recs = recommendations();
    const recHtml = recs.length
      ? '<div class="section-title">🌟 今日推荐</div>' +
        '<div class="card-list">' + recs.map((r) =>
          '<button class="list-card" data-rec="' + esc(r.nav) + '" data-recid="' + esc(r.params && r.params.id || '') + '">' +
          '<span class="lc-icon">' + r.icon + '</span>' +
          '<span class="lc-body"><span class="lc-title">' + esc(r.name) + '</span>' +
          '<span class="lc-sub">' + esc(r.sub) + '</span></span>' +
          '<span class="lc-arrow">›</span></button>').join('') + '</div>'
      : '';

    const reward = state.reward;
    const petLine = CS.pet ? ' · 伙伴 <b>Lv.' + CS.pet.level + ' ' + esc(CS.pet.title) + '</b>' : '';
    const cartoonCard =
      '<button class="module-card reward-card" data-nav="cartoon">' +
      '<span class="mc-count">' + esc(countFor('cartoon')) + '</span>' +
      '<span class="mc-icon">🎬</span>' +
      '<span class="mc-name">动画小剧场</span>' +
      '<span class="mc-desc">学习攒星星，兑换看动画</span></button>';

    const badgeHtml = badges().map((b) =>
      '<div class="age-card" style="' + (b.got ? '' : 'filter:grayscale(.9);opacity:.55') + ';cursor:default">' +
      '<div class="age-range" style="font-size:2rem">' + b.emoji + '</div>' +
      '<div class="age-label">' + esc(b.name) + (b.got ? ' ✓' : '<br>还差 ' + b.left + ' ⭐') + '</div></div>'
    ).join('');

    view.innerHTML =
      '<section class="hero">' +
      '<span class="hero-emoji e1">☁️</span><span class="hero-emoji e2">🌈</span><span class="hero-emoji e3">✨</span>' +
      '<h1><span class="hero-avatar">' + CS.profile.avatar + '</span> ' + esc(heroGreeting()) + '</h1>' +
      '<p>现在是 <b>' + esc(ageLabel()) + '</b> · 已获得 <b>' + state.stars + '</b> 颗星星' + petLine +
      (state.cartoonMins > 0 ? ' · 动画时间还剩 <b>' + Math.ceil(state.cartoonMins) + '</b> 分钟' : '') + '<br>' +
      '攒满 <b>' + reward.stars + '</b> 颗星星可以换 <b>' + reward.minutes + '</b> 分钟动画哦！</p></section>' +

      recHtml +

      '<div class="module-grid">' + cards + cartoonCard + '</div>' +

      '<div class="section-title">🎖️ 我的荣誉墙</div>' +
      '<div class="age-grid">' + badgeHtml + '</div>' +

      '<div class="hint-text" style="margin-top:1.2rem">💡 给爸爸妈妈：右上角 🌙 开启护眼模式；⚙️ 进入家长中心；<br>每次学习 20 分钟记得让宝贝休息眼睛、活动身体哦。</div>';

    view.querySelectorAll('.module-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        navigate(btn.getAttribute('data-nav'));
      });
    });
    view.querySelectorAll('[data-rec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        const nav = btn.getAttribute('data-rec');
        const id = btn.getAttribute('data-recid');
        navigate(nav, id ? { id } : undefined);
      });
    });
  }

  function renderMore(view) {
    const list = [
      { key: 'literacy', icon: '🔤', name: '识字乐园', desc: '字卡学习、找字游戏' },
      { key: 'song', icon: '🎵', name: '儿歌欢唱', desc: '电子琴伴奏 + 歌词逐行跟唱' },
      { key: 'text', icon: '📚', name: '课文阅读', desc: '原创小故事 + 阅读理解题' },
      { key: 'story', icon: '🏰', name: '童话城堡', desc: '原创童话 + 道理揭晓' },
      { key: 'craft', icon: '✂️', name: '手工课堂', desc: '步骤打卡式手工教程' },
      { key: 'cartoon', icon: '🎬', name: '动画小剧场', desc: '星星兑换动画时间' }
    ];
    view.innerHTML =
      '<h2 class="page-title"><span class="pt-icon">✨</span>更多乐园</h2>' +
      '<div class="module-grid">' + list.map((m) =>
        '<button class="module-card" data-accent="' + m.key + '" data-nav="' + m.key + '">' +
        '<span class="mc-count">' + esc(countFor(m.key)) + '</span>' +
        '<span class="mc-icon">' + m.icon + '</span>' +
        '<span class="mc-name">' + esc(m.name) + '</span>' +
        '<span class="mc-desc">' + esc(m.desc) + '</span></button>'
      ).join('') + '</div>' +
      '<div class="section-title">👨‍👩‍👧 家长中心</div>' +
      '<button class="btn btn-ghost btn-big" id="moreParent" style="width:100%;justify-content:flex-start;gap:.6rem;border-radius:18px">' +
      '<span style="font-size:1.5rem">⚙️</span><span>家长中心 · 管理档案、奖励规则、动画库</span></button>' +
      '<div class="hint-text">更多内容持续添加中……</div>';
    view.querySelectorAll('.module-card').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate(btn.getAttribute('data-nav')); });
    });
    document.getElementById('moreParent').onclick = () => { CS.sfx.tap(); navigate('parent'); };
  }

  CS.register('home', renderHome);
  CS.register('more', renderMore);
})(window.CS);
