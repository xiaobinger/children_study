/* ============ 遥控器焦点导航（Android TV 十字键空间导航） ============
 * 行为：
 *  - 按下任意方向键即进入遥控器模式（body.tv-nav，CSS 显示显眼焦点环）
 *  - 方向键：按几何最近原则在可见可交互元素间移动焦点
 *  - 确定键（Enter/DPAD_CENTER）：交给原生 click；无焦点时聚焦第一个元素
 *  - 返回键（Escape/Backspace/遥控器 Back）：关弹层 → 关 KTV → 后退一步
 *  - 切页（hashchange）后自动聚焦视图内第一个可交互元素
 * 设计：桌面/触屏设备不受影响（方向键才激活）；弹层打开时焦点限制在弹层内。
 */
window.CS = window.CS || {};

(function (CS) {
  'use strict';

  const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]';
  let tvMode = false;

  function enableTvMode() {
    if (tvMode) return;
    tvMode = true;
    document.body.classList.add('tv-nav');
  }

  /* ---------- 顶层作用域：弹层/KTV 舞台/伙伴聊天打开时焦点锁在里面 ---------- */
  function topScope() {
    const stage = document.getElementById('ktvStage');
    if (stage) return stage;
    const rest = document.getElementById('restOverlay');
    if (rest && !rest.classList.contains('hidden')) return rest;
    const modal = document.getElementById('modalOverlay');
    if (modal && !modal.classList.contains('hidden')) return modal;
    const chat = document.querySelector('.mascot-chat');
    if (chat) return chat;
    return document.body;
  }

  function visible(el) {
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }

  function candidates() {
    const scope = topScope();
    return Array.from(scope.querySelectorAll(FOCUSABLE)).filter(visible);
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* 方向打分：主轴距离 + 次轴偏移重罚，必须落在方向半平面内 */
  function score(from, to, dir) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    switch (dir) {
      case 'left': if (dx >= -4) return Infinity; return adx + ady * 2.6;
      case 'right': if (dx <= 4) return Infinity; return adx + ady * 2.6;
      case 'up': if (dy >= -4) return Infinity; return ady + adx * 2.6;
      case 'down': if (dy <= 4) return Infinity; return ady + adx * 2.6;
    }
    return Infinity;
  }

  /* 首选聚焦目标：正文 #view 内的第一个元素；没有才退到顶栏等全局元素 */
  function preferredFirst() {
    const list = candidates();
    if (!list.length) return null;
    const scope = topScope();
    if (scope === document.body) {
      const view = document.getElementById('view');
      const inView = list.filter((el) => view && view.contains(el));
      if (inView.length) return firstInReadingOrder(inView);
    }
    return firstInReadingOrder(list);
  }

  function move(dir) {
    const list = candidates();
    if (!list.length) return;
    const cur = document.activeElement && list.includes(document.activeElement)
      ? document.activeElement : null;
    if (!cur) { focusEl(preferredFirst()); return; }
    const from = center(cur.getBoundingClientRect());
    /* 焦点在正文 #view 里时，优先只在正文内移动（防止漂浮吉祥物等全局元素挡路）；
       该方向正文无元素时才落到全局元素 */
    const view = document.getElementById('view');
    const inView = view && view.contains(cur);
    const pools = inView && topScope() === document.body
      ? [list.filter((el) => view.contains(el)), list]
      : [list];
    for (let p = 0; p < pools.length; p++) {
      let best = null, bestScore = Infinity;
      pools[p].forEach((el) => {
        if (el === cur) return;
        const s = score(from, center(el.getBoundingClientRect()), dir);
        if (s < bestScore) { bestScore = s; best = el; }
      });
      if (best) { focusEl(best); return; }   // 找到即停；该方向没有元素：保持当前焦点不动
    }
  }

  function firstInReadingOrder(list) {
    return list.slice().sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    })[0];
  }

  function focusEl(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* 切页/弹层后自动聚焦第一个元素（仅遥控器模式，避免桌面端出现焦点环） */
  function autoFocusFirst() {
    if (!tvMode) return;
    setTimeout(() => {
      const cur = document.activeElement;
      if (cur && cur !== document.body && visible(cur)) return;
      focusEl(preferredFirst());
    }, 80);
  }

  function goBack() {
    const stage = document.getElementById('ktvStage');
    if (stage) { const x = stage.querySelector('#ktvExit'); if (x) { x.click(); return; } }
    const modal = document.getElementById('modalOverlay');
    if (modal && !modal.classList.contains('hidden')) { CS.hideModal && CS.hideModal(); autoFocusFirst(); return; }
    const chatClose = document.querySelector('.mascot-chat .mchat-close');
    if (chatClose) { chatClose.click(); autoFocusFirst(); return; }
    if ((location.hash || '#/home') !== '#/home') { history.back(); return; }
    // 已在首页：交给系统（Android TV 上会退出 App）
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const inText = tag === 'INPUT' || tag === 'TEXTAREA';

    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      if (inText) return;               // 输入框里方向键归光标
      enableTvMode();
      e.preventDefault();
      move(k.slice(5).toLowerCase());
      return;
    }
    if (k === 'Enter' || k === 'NumpadEnter') {
      if (!tvMode) return;
      const cur = document.activeElement;
      if (!cur || cur === document.body) {
        e.preventDefault();
        focusEl(preferredFirst());
      }
      // 已有焦点：交给原生 click 行为
      return;
    }
    if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack') {
      if (inText) return;
      enableTvMode();
      e.preventDefault();
      goBack();
    }
  }, true);

  /* 鼠标/触摸一旦使用，退出遥控器模式（焦点环只对遥控器显示） */
  ['pointerdown', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, () => {
      if (!tvMode) return;
      tvMode = false;
      document.body.classList.remove('tv-nav');
    }, { capture: true, passive: true })
  );

  window.addEventListener('hashchange', autoFocusFirst);
  document.addEventListener('DOMContentLoaded', autoFocusFirst);

  /* 弹层是 innerHTML 注入的，打开/关闭后需要刷新焦点 */
  if (CS.showModal) {
    const _show = CS.showModal, _hide = CS.hideModal;
    CS.showModal = function (h) { const r = _show(h); autoFocusFirst(); return r; };
    CS.hideModal = function () { const r = _hide(); autoFocusFirst(); return r; };
  }

  CS.tvnav = { move, goBack, get active() { return tvMode; } };
})(window.CS);
