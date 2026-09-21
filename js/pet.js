/* ============ 宠物成长系统：等级 / 经验 / 投喂 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { store, state } = CS;

  const MAX_LEVEL = 10;
  const TITLES = ['蛋宝宝', '破壳啦', '小不点', '小可爱', '好伙伴', '小学学霸', '大朋友', '小超人', '小巨人', '传说伙伴'];

  /* 投喂食物：消耗星星 → 获得经验 */
  const FOODS = [
    {
      id: 'apple', emoji: '🍎', name: '苹果', cost: 3, exp: 15,
      thanks: ['真甜呀！谢谢你！🍎', '咔嚓咔嚓，真好吃！谢谢你～', '脆脆的大苹果，我一口就吃光啦！']
    },
    {
      id: 'cookie', emoji: '🍪', name: '饼干', cost: 5, exp: 30,
      thanks: ['香喷喷的饼干！我最爱啦！🍪', '嗷呜一口，太幸福啦！', '饼干圆圆，我也圆圆，哈哈！']
    },
    {
      id: 'cake', emoji: '🎂', name: '蛋糕', cost: 10, exp: 60,
      thanks: ['哇！大蛋糕！今天是节日吗？🎂', '甜甜的蛋糕，我感动得要转圈圈啦！', '这是世界上最好吃的蛋糕！']
    }
  ];

  /* 升到下一级需要的经验 */
  function expNeed(level) { return level * 20; }

  function load() {
    const p = store.get('pet', null);
    return (p && p.level) ? { level: Math.min(MAX_LEVEL, p.level | 0), exp: Math.max(0, p.exp | 0) } : { level: 1, exp: 0 };
  }
  function save(p) { store.set('pet', p); }

  function title(level) { return TITLES[Math.min(TITLES.length, Math.max(1, level)) - 1]; }

  /* ---------- 徽章（宠物身上的 Lv 挂牌） ---------- */
  function updateBadge() {
    const el = document.getElementById('petBadge');
    if (!el) return;
    const p = load();
    el.textContent = 'Lv.' + p.level;
    el.hidden = false;
  }

  /* ---------- 宠物说话（气泡 + 语音，不依赖 main.js 内部函数） ---------- */
  function petSay(msg, ms) {
    const bubble = document.getElementById('mascotBubble');
    if (bubble) {
      bubble.textContent = msg;
      bubble.classList.remove('z-sleeping');
      bubble.style.animation = 'none';
      void bubble.offsetWidth;
      bubble.style.animation = '';
      bubble.style.display = 'block';
      clearTimeout(petSay._t);
      petSay._t = setTimeout(() => { bubble.style.display = ''; }, ms || 4000);
    }
    CS.speak && CS.speak(String(msg).replace(/[*#`_>~|]/g, ''));
  }

  /* ---------- 升级庆祝 ---------- */
  function celebrate(newLevel) {
    CS.confettiBurst && CS.confettiBurst();
    CS.sfx && CS.sfx.finish();
    const msg = '叮！我升级啦！现在是' + title(newLevel) + ' Lv.' + newLevel + '，谢谢你一直陪我学习！🎉';
    // 结算弹窗可能正开着，稍等一下再开口
    setTimeout(() => petSay(msg, 5000), 1500);
    document.dispatchEvent(new CustomEvent('cs:pet-levelup', { detail: { level: newLevel } }));
  }

  /* ---------- 加经验（学习得星 +1，投喂加更多） ---------- */
  function gainExp(n) {
    if (!(n > 0)) return { leveledUp: false };
    const p = load();
    if (p.level >= MAX_LEVEL) {
      p.exp = expNeed(MAX_LEVEL); // 满级封顶
      save(p);
      return { leveledUp: false };
    }
    p.exp += n;
    let ups = 0;
    while (p.level < MAX_LEVEL && p.exp >= expNeed(p.level)) {
      p.exp -= expNeed(p.level);
      p.level++;
      ups++;
    }
    save(p);
    updateBadge();
    if (ups > 0) celebrate(p.level);
    return { leveledUp: ups > 0, level: p.level };
  }

  /* ---------- 投喂 ---------- */
  function spendStars(n) {
    if (state.stars < n) return false;
    state.stars -= n;
    store.set('stars', state.stars);
    const el = document.getElementById('starCount');
    if (el) el.textContent = state.stars;
    return true;
  }

  function feed(foodIdx) {
    const food = FOODS[foodIdx];
    if (!food) return { ok: false, msg: '没有这种食物哦' };
    if (state.stars < food.cost) {
      return { ok: false, msg: '星星不够啦！还差 ' + (food.cost - state.stars) + ' 颗，去学习赢星星吧！⭐' };
    }
    spendStars(food.cost);
    const r = gainExp(food.exp);
    const thanks = food.thanks[Math.floor(Math.random() * food.thanks.length)];
    let msg = thanks;
    if (r.leveledUp) msg = thanks + ' 而且我升级成' + title(r.level) + '啦！🎉';
    petSay(msg, 4500);
    CS.sfx && CS.sfx.correct();
    return { ok: true, msg, level: load().level };
  }

  /* ---------- 聊天面板里的宠物状态条 ---------- */
  function info() {
    const p = load();
    const need = expNeed(p.level);
    const pct = p.level >= MAX_LEVEL ? 100 : Math.min(100, Math.round(p.exp / need * 100));
    return {
      level: p.level, exp: p.exp, need, pct, title: title(p.level),
      max: p.level >= MAX_LEVEL, stars: state.stars
    };
  }

  function barHTML() {
    const i = info();
    const foods = FOODS.map((f, idx) =>
      '<button class="pet-food" data-feed="' + idx + '" title="' + f.name + ' ' + f.cost + '颗星星">' +
      '<span class="pf-emoji">' + f.emoji + '</span><span class="pf-cost">' + f.cost + '⭐</span></button>'
    ).join('');
    return '<div class="mchat-petbar" id="mchatPetbar">' +
      '<div class="mp-top">' +
      '<span class="mp-avatar">' + CS.profile.avatar + '</span>' +
      '<div class="mp-info">' +
      '<div class="mp-title">Lv.' + i.level + ' · ' + i.title + (i.max ? '（满级）' : '') + '</div>' +
      '<div class="progress-track mp-track"><div class="progress-fill" style="width:' + i.pct + '%"></div></div>' +
      '<div class="mp-exp">' + (i.max ? '经验已满 ✨' : '经验 ' + i.exp + ' / ' + i.need + '（学习得星也涨经验）') + '</div>' +
      '</div></div>' +
      '<div class="mp-foods">' +
      '<span class="mp-foods-label">喂点好吃的：</span>' + foods +
      '<span class="mp-stars">我有 ' + i.stars + ' ⭐</span></div></div>';
  }

  function bindBar() {
    const bar = document.getElementById('mchatPetbar');
    if (!bar) return;
    bar.querySelectorAll('[data-feed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = feed(+btn.getAttribute('data-feed'));
        if (!r.ok) CS.toast(r.msg);
        // 刷新状态条（替换自身）
        const box = document.getElementById('mchatPetbar');
        if (box) {
          box.outerHTML = barHTML();
          bindBar();
        }
      });
    });
  }

  Object.assign(CS, {
    pet: {
      MAX_LEVEL, TITLES, FOODS,
      info, gainExp, feed,
      barHTML, bindBar,
      updateBadge, expNeed,
      get level() { return load().level; },
      get title() { return title(load().level); }
    }
  });
})(window.CS);
