/* ============ 核心工具 / 状态 / 路由 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';

  /* ---------- 工具 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];

  /* ---------- 本地存储 ---------- */
  const store = {
    get(key, def) {
      try {
        const v = localStorage.getItem('cs_' + key);
        return v === null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('cs_' + key, JSON.stringify(val)); } catch (e) { /* 隐身模式等 */ }
    }
  };

  /* ---------- 年龄分层 ---------- */
  const AGE_GROUPS = [
    { key: 'a1', range: '3-4岁', label: '启蒙小小班', desc: '认知启蒙' },
    { key: 'a2', range: '5-6岁', label: '学前准备班', desc: '幼小衔接' },
    { key: 'a3', range: '7-8岁', label: '小学低年级', desc: '一二年级' },
    { key: 'a4', range: '9-12岁', label: '小学高年级', desc: '三四五六年级' }
  ];
  // 向上兼容：高年龄也能看到低年龄内容
  const AGE_ORDER = ['a1', 'a2', 'a3', 'a4'];
  const agePool = (ageKey) => {
    const idx = AGE_ORDER.indexOf(ageKey);
    return AGE_ORDER.slice(0, idx + 1);
  };

  /* ---------- 全局状态 ---------- */
  const state = {
    age: store.get('age', 'a1'),
    stars: store.get('stars', 0),
    sound: store.get('sound', true),
    eyeCare: store.get('eyeCare', false),
    restOn: store.get('restOn', true),
    done: store.get('done', {}),   // { poem_1: true, craft_1: true ... }
    startPage() {
      const p = store.get('lastPage', null);
      return p || 'home';
    },
    addStars(n) {
      state.stars += n;
      store.set('stars', state.stars);
      const el = document.getElementById('starCount');
      if (el) {
        el.textContent = state.stars;
        el.parentElement.classList.remove('star-bump');
        void el.parentElement.offsetWidth;
        el.parentElement.classList.add('star-bump');
      }
    },
    markDone(id) {
      state.done[id] = true;
      store.set('done', state.done);
    },
    ageKey() { return state.age; }
  };

  /* ---------- 路由（hash） ---------- */
  const routes = {};
  let currentPage = null;

  function register(name, renderFn) { routes[name] = renderFn; }

  function navigate(name, params) {
    let hash = '#/' + name;
    if (params) {
      const qs = Object.keys(params)
        .map((k) => k + '=' + encodeURIComponent(params[k]))
        .join('&');
      if (qs) hash += '?' + qs;
    }
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { name: 'home', params: {} };
    const [name, qs] = raw.split('?');
    const params = {};
    (qs || '').split('&').forEach((pair) => {
      if (!pair) return;
      const [k, v] = pair.split('=');
      params[k] = decodeURIComponent(v || '');
    });
    return { name: name || 'home', params };
  }

  function render() {
    const { name, params } = parseHash();
    const view = document.getElementById('view');
    if (currentPage && routes[currentPage] && routes[currentPage].destroy) {
      routes[currentPage].destroy();
    }
    currentPage = name in routes ? name : 'home';
    store.set('lastPage', currentPage);
    CS.stopMelody && CS.stopMelody();
    CS.stopSpeak && CS.stopSpeak();
    view.innerHTML = '';
    view.className = 'view view-enter';
    requestAnimationFrame(() => { view.classList.remove('view-enter'); });
    routes[currentPage](view, params || {});
    updateNav(currentPage);
    window.scrollTo(0, 0);
    // 继续累计护眼用眼时间
    CS.rest && CS.rest.activity();
  }

  function updateNav(name) {
    $$('.bottombar-item').forEach((btn) => {
      const target = btn.getAttribute('data-nav');
      const on = target === name || (target === 'more' && ['song', 'text', 'craft'].includes(name)) ||
        (target === 'home' && name === 'home');
      btn.classList.toggle('active', on);
    });
  }

  window.addEventListener('hashchange', render);

  /* ---------- 导出 ---------- */
  Object.assign(CS, {
    $, $$, esc, shuffle, rand, pick, store,
    AGE_GROUPS, agePool, state, register, navigate, render
  });
})(window.CS);
