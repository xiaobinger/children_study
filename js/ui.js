/* ============ UI 组件：顶栏 / 弹窗 / 提示 / 撒花 / 护眼休息提醒 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { $, $$, esc, store, state, AGE_GROUPS, navigate, render } = CS;

  /* ---------- 提示条 ---------- */
  let toastTimer = null;
  function toast(msg) {
    let el = document.querySelector('.toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  /* ---------- 弹窗 ---------- */
  function showModal(html) {
    const overlay = $('#modalOverlay');
    const box = $('#modalBox');
    box.innerHTML = html;
    overlay.classList.remove('hidden');
  }
  function hideModal() {
    $('#modalOverlay').classList.add('hidden');
    $('#modalBox').innerHTML = '';
  }
  $('#modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

  /* ---------- 撒花 ---------- */
  const canvas = $('#confettiCanvas');
  const cctx = canvas.getContext('2d');
  let confetti = [];
  let confettiRAF = null;
  function confettiBurst() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const colors = ['#f26d7d', '#ffd54f', '#4a90d9', '#3fbf7f', '#c77dff', '#38b6e0'];
    for (let i = 0; i < 90; i++) {
      confetti.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 120,
        y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 13 - 5,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    if (!confettiRAF) confettiLoop();
  }
  function confettiLoop() {
    confettiRAF = requestAnimationFrame(confettiLoop);
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    confetti = confetti.filter((p) => p.y < innerHeight + 30);
    if (!confetti.length) {
      cancelAnimationFrame(confettiRAF);
      confettiRAF = null;
      return;
    }
    confetti.forEach((p) => {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cctx.restore();
    });
  }

  /* ---------- 结算弹窗 ---------- */
  function showResult(opts) {
    const stars = opts.stars == null ? 3 : opts.stars;
    showModal(
      '<div class="result-emoji">' + opts.emoji + '</div>' +
      '<h3>' + esc(opts.title) + '</h3>' +
      '<p>' + (opts.msg || '') + '</p>' +
      '<div class="result-stars">' + Array.from({ length: 3 }, (_, i) =>
        '<span style="' + (i < stars ? '' : 'filter:grayscale(1);opacity:.35') + '">⭐</span>').join('') + '</div>' +
      '<button class="btn btn-primary btn-big" id="rsAgain">再玩一次</button>' +
      '<button class="btn btn-ghost" id="rsBack">返回列表</button>'
    );
    CS.sfx.finish();
    CS.state.addStars(stars);
    confettiBurst();
    $('#rsAgain').onclick = () => { hideModal(); opts.onAgain && opts.onAgain(); };
    $('#rsBack').onclick = () => { hideModal(); opts.onBack && opts.onBack(); };
  }

  /* ---------- 护眼休息提醒（20 分钟用眼 → 提醒休息） ---------- */
  const REST_EVERY = 20 * 60 * 1000;   // 提醒周期
  const REST_COUNT = 20;               // 倒计时秒数
  let restLast = Date.now();
  let restCheckTimer = null;
  let restCountdown = null;

  const rest = {
    activity() { restLast = Date.now(); },
    start() {
      this.stop();
      if (!state.restOn) return;
      restLast = Date.now();
      restCheckTimer = setInterval(() => {
        if (state.restOn && Date.now() - restLast >= REST_EVERY) showRest();
      }, 5000);
    },
    stop() {
      clearInterval(restCheckTimer);
      clearInterval(restCountdown);
    }
  };
  CS.rest = rest;

  function showRest() {
    const overlay = $('#restOverlay');
    overlay.classList.remove('hidden');
    CS.stopSpeak && CS.stopSpeak();
    let left = REST_COUNT;
    $('#restTimer').textContent = left;
    restLast = Date.now(); // 重置周期
    clearInterval(restCountdown);
    restCountdown = setInterval(() => {
      left--;
      const el = $('#restTimer');
      if (el) el.textContent = Math.max(0, left);
      if (left <= 0) {
        clearInterval(restCountdown);
        $('#restSkipBtn').textContent = '休息结束，继续学习 🎉';
      }
    }, 1000);
  }
  $('#restSkipBtn').addEventListener('click', () => {
    $('#restOverlay').classList.add('hidden');
    clearInterval(restCountdown);
    $('#restSkipBtn').textContent = '我休息好啦，继续玩';
    restLast = Date.now();
  });

  /* ---------- 顶栏：年龄选择 ---------- */
  function openAgeModal() {
    const cards = AGE_GROUPS.map((g) =>
      '<button class="age-card' + (state.age === g.key ? ' selected' : '') + '" data-age="' + g.key + '">' +
      '<div class="age-range">' + g.range + '</div>' +
      '<div class="age-label">' + g.label + ' · ' + g.desc + '</div></button>'
    ).join('');
    showModal(
      '<h3>🎂 选择宝贝的年龄</h3>' +
      '<p>不同年龄会展示不同难度的内容，<br>大孩子也能复习小年龄的内容哦</p>' +
      '<div class="age-grid">' + cards + '</div>' +
      '<div class="hint-text" style="margin-top:.9rem">护眼休息提醒：' +
      '<button class="tab-btn" id="restToggle">' + (state.restOn ? '已开启 ✓' : '已关闭') + '</button></div>'
    );
    $$('#modalBox .age-card').forEach((btn) => {
      btn.onclick = () => {
        state.age = btn.getAttribute('data-age');
        store.set('age', state.age);
        $('#ageBtnText').textContent = AGE_GROUPS.find((g) => g.key === state.age).range;
        CS.sfx.tap();
        hideModal();
        render(); // 重新渲染当前页，切换内容难度
        toast('已切换到 ' + AGE_GROUPS.find((g) => g.key === state.age).range + ' 内容');
      };
    });
    const rt = $('#restToggle');
    if (rt) rt.onclick = () => {
      state.restOn = !state.restOn;
      store.set('restOn', state.restOn);
      rt.textContent = state.restOn ? '已开启 ✓' : '已关闭';
      toast(state.restOn ? '已开启护眼休息提醒（每20分钟）' : '已关闭休息提醒');
    };
  }

  /* ---------- 顶栏初始化 ---------- */
  function initTopbar() {
    $('#ageBtn').addEventListener('click', openAgeModal);
    $('#ageBtnText').textContent = AGE_GROUPS.find((g) => g.key === state.age).range;
    $('#starCount').textContent = state.stars;

    const soundBtn = $('#soundBtn');
    const applySound = () => {
      soundBtn.textContent = CS.getMuted() ? '🔇' : '🔊';
      soundBtn.style.opacity = CS.getMuted() ? '.6' : '1';
    };
    soundBtn.addEventListener('click', () => {
      CS.setMuted(!CS.getMuted());
      state.sound = !CS.getMuted();
      store.set('sound', state.sound);
      applySound();
      if (!CS.getMuted()) CS.sfx.tap();
      toast(CS.getMuted() ? '声音已关闭' : '声音已开启');
    });
    applySound();

    const eyeBtn = $('#eyeBtn');
    const applyEye = () => {
      document.body.classList.toggle('eye-care', state.eyeCare);
      eyeBtn.textContent = state.eyeCare ? '🌞' : '🌙';
      eyeBtn.title = state.eyeCare ? '关闭护眼模式' : '开启护眼模式（暖色护眼）';
    };
    eyeBtn.addEventListener('click', () => {
      state.eyeCare = !state.eyeCare;
      store.set('eyeCare', state.eyeCare);
      applyEye();
      CS.sfx.tap();
      toast(state.eyeCare ? '护眼模式已开启，屏幕更柔和啦' : '护眼模式已关闭');
    });
    applyEye();

    const parentBtn = $('#parentBtn');
    parentBtn.addEventListener('click', () => {
      CS.sfx.tap();
      navigate('parent');
    });

    $$('.topbar-logo, .bottombar-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav');
        if (target) {
          CS.sfx.tap();
          navigate(target);
        }
      });
    });
  }

  Object.assign(CS, { toast, showModal, hideModal, confettiBurst, showResult, initTopbar });
})(window.CS);
