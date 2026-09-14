/* ============ 首页 & 更多页 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { esc, state, navigate, agePool } = CS;

  const MODULES = [
    { key: 'poem', icon: '📖', name: '古诗背诵', desc: '读诗、背诗、填字闯关', accent: 'poem' },
    { key: 'literacy', icon: '🔤', name: '识字乐园', desc: '字卡学习、找字游戏', accent: 'literacy' },
    { key: 'song', icon: '🎵', name: '儿歌欢唱', desc: '边弹边唱，歌词跟读', accent: 'song' },
    { key: 'text', icon: '📚', name: '课文阅读', desc: '读小故事，答理解题', accent: 'text' },
    { key: 'craft', icon: '✂️', name: '手工课堂', desc: '跟着步骤做手工', accent: 'craft' },
    { key: 'math', icon: '🔢', name: '数学闯关', desc: '数数、加减、乘除', accent: 'math' }
  ];

  function countFor(key) {
    const pool = agePool(state.age);
    if (key === 'poem') return CS.DATA.poems.filter((p) => pool.includes(p.age)).length + ' 首古诗';
    if (key === 'literacy') return CS.DATA.characters[state.age].length + ' 张字卡';
    if (key === 'song') return CS.DATA.songs.filter((s) => pool.includes(s.age)).length + ' 首儿歌';
    if (key === 'text') return CS.DATA.texts.filter((t) => pool.includes(t.age)).length + ' 篇课文';
    if (key === 'craft') return CS.DATA.crafts.filter((c) => pool.includes(c.age)).length + ' 个手工';
    if (key === 'math') return '无限题目';
    return '';
  }

  function ageGreeting() {
    const g = CS.AGE_GROUPS.find((x) => x.key === state.age);
    return g ? g.label : '';
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

    const badgeHtml = badges().map((b) =>
      '<div class="age-card" style="' + (b.got ? '' : 'filter:grayscale(.9);opacity:.55') + ';cursor:default">' +
      '<div class="age-range" style="font-size:2rem">' + b.emoji + '</div>' +
      '<div class="age-label">' + esc(b.name) + (b.got ? ' ✓' : '<br>还差 ' + b.left + ' ⭐') + '</div></div>'
    ).join('');

    view.innerHTML =
      '<section class="hero">' +
      '<span class="hero-emoji e1">☁️</span><span class="hero-emoji e2">🌈</span><span class="hero-emoji e3">✨</span>' +
      '<h1>你好呀，小朋友！🎈</h1>' +
      '<p>现在是 <b>' + esc(ageGreeting()) + '</b> · 已获得 <b>' + state.stars + '</b> 颗星星<br>' +
      '挑选一个乐园，开始今天的学习冒险吧！</p></section>' +

      '<div class="module-grid">' + cards + '</div>' +

      '<div class="section-title">🎖️ 我的荣誉墙</div>' +
      '<div class="age-grid">' + badgeHtml + '</div>' +

      '<div class="hint-text" style="margin-top:1.2rem">💡 给爸爸妈妈：右上角 🌙 开启护眼模式；顶栏可切换年龄难度；<br>每次学习 20 分钟记得让宝贝休息眼睛、活动身体哦。</div>';

    view.querySelectorAll('.module-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        navigate(btn.getAttribute('data-nav'));
      });
    });
  }

  function renderMore(view) {
    const list = [
      { key: 'song', icon: '🎵', name: '儿歌欢唱', desc: '电子琴伴奏 + 歌词逐行跟唱' },
      { key: 'text', icon: '📚', name: '课文阅读', desc: '原创小故事 + 阅读理解题' },
      { key: 'craft', icon: '✂️', name: '手工课堂', desc: '步骤打卡式手工教程' }
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
      '<div class="hint-text">更多内容持续添加中……</div>';
    view.querySelectorAll('.module-card').forEach((btn) => {
      btn.addEventListener('click', () => { CS.sfx.tap(); navigate(btn.getAttribute('data-nav')); });
    });
  }

  CS.register('home', renderHome);
  CS.register('more', renderMore);
})(window.CS);
