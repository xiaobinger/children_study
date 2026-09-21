/* ============ 应用启动 ============ */
(function (CS) {
  'use strict';

  function boot() {
    CS.initTopbar();
    CS.rest.start();
    if (!location.hash) {
      const last = CS.store.get('lastPage', 'home');
      location.hash = '#/' + (last === 'more' ? 'home' : last);
    }
    CS.render();

    // 首次使用引导：建档 → 年龄
    if (!CS.store.get('welcomed', false)) {
      CS.showModal(
        '<h3>🎈 欢迎来到学习乐园</h3>' +
        '<p>这里有<b>古诗、识字、儿歌、课文、手工、数学</b>六大乐园，<br>' +
        '先告诉我宝贝的小名，就可以开始快乐学习啦！<br><br>' +
        '右上角 🌙 可开启<b>护眼模式</b>，⚙️ 是家长中心；<br>' +
        '每学习 20 分钟会提醒宝贝休息小眼睛 👀</p>' +
        '<button class="btn btn-primary btn-big" id="welcomeGo">开始建档 🚀</button>'
      );
      document.getElementById('welcomeGo').onclick = () => {
        CS.store.set('welcomed', true);
        CS.hideModal();
        openProfileModal(true);
      };
    }
  }

  /* 首次建档弹窗 */
  function openProfileModal(first) {
    const avatars = ['🐣', '🐰', '🐼', '🐯', '🦊', '🐨', '🐷', '🐸', '🦄', '🐥', '🐳', '🦋'];
    CS.showModal(
      '<h3>' + (first ? '🎂 认识一下宝贝' : '✏️ 修改宝贝档案') + '</h3>' +
      '<div class="form-row"><label for="pmName">宝贝昵称</label>' +
      '<input class="form-input" id="pmName" maxlength="8" placeholder="比如：小豆丁"></div>' +
      '<div class="form-row"><label for="pmBirth">生日（选填，自动定难度）</label>' +
      '<input class="form-input" id="pmBirth" type="date"></div>' +
      '<div class="form-row"><label>选一个头像</label><div class="avatar-grid">' +
      avatars.map((a, i) => '<button class="avatar-cell' + (i === 0 ? ' sel' : '') + '" data-a="' + a + '">' + a + '</button>').join('') +
      '</div></div>' +
      '<button class="btn btn-primary btn-big" id="pmSave">开始学习 🚀</button>'
    );
    let avatar = avatars[0];
    document.querySelectorAll('#modalBox .avatar-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        avatar = btn.getAttribute('data-a');
        document.querySelectorAll('#modalBox .avatar-cell').forEach((b) => b.classList.remove('sel'));
        btn.classList.add('sel');
        CS.sfx.tap();
      });
    });
    document.getElementById('pmSave').onclick = () => {
      const name = document.getElementById('pmName').value.trim();
      const birthday = document.getElementById('pmBirth').value;
      const ag = CS.profile.save({ name, avatar, birthday });
      CS.hideModal();
      CS.sfx.star();
      CS.toast('你好呀，' + (name || '小朋友') + ' ' + avatar);
      CS.render();
      if (!ag) {
        setTimeout(() => document.getElementById('ageBtn').click(), 250);
      } else {
        document.getElementById('ageBtnText').textContent =
          CS.AGE_GROUPS.find((g) => g.key === ag).range;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 吉祥物：跟随宝贝头像；AI 开启时真实对话，未开启时离线伙伴模式
  const mascot = document.getElementById('mascot');
  const mascotBubble = document.getElementById('mascotBubble');
  const petSvg = document.getElementById('petSvg');
  let mascotTimer = null;
  const _prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function applyMascot() {
    if (!petSvg) return;
    CS.renderMascotAnimal(petSvg, CS.profile.avatar);
    // 按动物习性设置步态（飞/游/跳/慢走/奔跑），CSS 据此切换动画
    if (mascot) mascot.dataset.gait = (CS.ANIMAL_GAITS && CS.ANIMAL_GAITS[CS.profile.avatar]) || 'walk';
    petSvg.classList.remove('pet-swap');
    void petSvg.offsetWidth;
    petSvg.classList.add('pet-swap');
    // 宠物等级徽章
    if (CS.pet) CS.pet.updateBadge();
  }
  applyMascot();
  document.addEventListener('cs:profile-saved', applyMascot);
  // 宠物升级时刷新首页的伙伴等级显示
  document.addEventListener('cs:pet-levelup', () => {
    const cur = location.hash.replace(/^#\/?/, '').split('?')[0];
    if (cur === 'home' || cur === '') CS.render();
  });

  /* ---------- 宠物表情状态管理 ---------- */
  function setPetState(state) {
    if (!mascot) return;
    ['pet-walking','pet-sleeping','pet-talking','pet-happy','pet-surprised'].forEach(s => {
      mascot.classList.remove(s);
    });
    if (state) mascot.classList.add('pet-' + state);
  }
  function resetPetState() { setPetState(null); }

  /* ---------- 气泡显示 ---------- */
  function showBubble(msg, ms) {
    if (!mascotBubble || !mascot) return;
    mascotBubble.textContent = msg;
    // 重新触发动画
    mascotBubble.style.animation = 'none';
    void mascotBubble.offsetWidth;
    mascotBubble.style.animation = '';
    mascotBubble.style.display = 'block';
    clearTimeout(mascotTimer);
    mascotTimer = setTimeout(() => { mascotBubble.style.display = ''; }, ms || 3000);
  }

  /* ---------- 行走系统：按动物步态移动（飞/游/跳/慢走/奔跑） ---------- */
  let walkTimeout = null;
  let walkDir = 1; // -1 left, 1 right
  let isWalking = false;
  let walkX = 65; // 初始位置（屏幕右侧 65% 处）

  /* 各步态的移动参数：一步的距离(屏幕%) / 时长 / 缓动 */
  const GAIT_PARAMS = {
    walk:    { dist: [5, 15],  dur: [1500, 3500], ease: 'ease-in-out' },
    fly:     { dist: [8, 18],  dur: [3600, 6000], ease: 'ease-in-out' },  // 蝴蝶慢慢飘
    flutter: { dist: [4, 9],   dur: [1800, 3000], ease: 'ease-in-out' },  // 小鸡小碎步扑腾
    hop:     { dist: [6, 12],  dur: [2000, 3200], ease: 'linear' },       // 兔子连跳
    leap:    { dist: [8, 16],  dur: [2000, 3000], ease: 'linear' },       // 青蛙连跃
    lumber:  { dist: [4, 8],   dur: [3400, 5200], ease: 'ease-in-out' },  // 熊猫考拉慢吞吞
    trot:    { dist: [6, 13],  dur: [1600, 2600], ease: 'ease-in-out' },  // 狐狸小猪小跑
    run:     { dist: [8, 16],  dur: [1400, 2200], ease: 'ease-in-out' },  // 老虎跑得快
    gallop:  { dist: [10, 18], dur: [1300, 2000], ease: 'linear' },       // 独角兽疾驰
    swim:    { dist: [5, 11],  dur: [3000, 4500], ease: 'ease-in-out' }   // 鲸鱼慢悠悠游
  };

  function startWalking() {
    if (_prefersReduced() || isWalking || !mascot) return;
    if (document.visibilityState === 'hidden') return;
    // 拖动后可能处于 left/top 定位体系，统一换算回 right/bottom（无视觉跳变）
    if (mascot.style.left || mascot.style.top) {
      const r = mascot.getBoundingClientRect();
      walkX = Math.max(12, Math.min(88, (r.left + r.width / 2) / window.innerWidth * 100));
      mascot.style.left = 'auto';
      mascot.style.top = 'auto';
      mascot.style.right = (100 - walkX) + '%';
    }
    isWalking = true;
    setPetState('walking');
    // 到达边界则掉头；否则 30% 概率随机换向
    if (walkX <= 14 && walkDir === -1 || walkX >= 86 && walkDir === 1) {
      walkDir = -walkDir;
    } else if (Math.random() < 0.3) {
      walkDir = Math.random() < 0.5 ? -1 : 1;
    }
    mascot.classList.toggle('pet-flip', walkDir === -1);
    const gp = GAIT_PARAMS[mascot.dataset.gait] || GAIT_PARAMS.walk;
    const rand = (arr) => arr[0] + Math.random() * (arr[1] - arr[0]);
    // 随机行走距离（按步态），范围限制在 12%-88%
    const stepDeg = rand(gp.dist) * walkDir;
    walkX = Math.max(12, Math.min(88, walkX + stepDeg));
    mascot.style.right = (100 - walkX) + '%';
    // 位移时长与步态同步：飞得慢、跑得快，视觉上不"漂移"
    const duration = rand(gp.dur);
    mascot.style.transition = 'right ' + duration + 'ms ' + gp.ease + ', filter .25s';
    walkTimeout = setTimeout(() => {
      isWalking = false;
      resetPetState();
      mascot.style.transition = '';
      // 停留一段时间后可能再次行走
      const nextDelay = 5000 + Math.random() * 10000;
      walkTimeout = setTimeout(startWalking, nextDelay);
    }, duration);
  }

  function stopWalking() {
    if (walkTimeout) { clearTimeout(walkTimeout); walkTimeout = null; }
    isWalking = false;
    if (mascot) mascot.style.transition = '';
    resetPetState();
  }

  /* ---------- 鼠标/触摸拖动宠物 ---------- */
  let dragging = false;      // 正在拖动
  let dragMoved = false;     // 本次按下是否真的拖动了（用于抑制 click）
  let dragStartX = 0, dragStartY = 0;   // 指针起点
  let petStartX = 0, petStartY = 0;     // 宠物左上角起点
  const DRAG_MSGS = ['哇～飞起来啦！🛫', '小主人要带我去哪呀？', '好高好高呀～😆', '嘿嘿，真好玩！再来一次～'];
  // 地面线距底部距离（初始化时读一次 CSS，避免拖动后 bottom:auto 读不到）
  const groundBottomPx = mascot ? (parseFloat(getComputedStyle(mascot).bottom) || 89.6) : 89.6;

  if (mascot && mascot.setPointerCapture) {
    mascot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const r = mascot.getBoundingClientRect();
      petStartX = r.left;
      petStartY = r.top;
      // 抓起来：暂停行走；打盹中被抓会醒
      stopWalking();
      if (walkTimeout) { clearTimeout(walkTimeout); walkTimeout = null; }
      if (mascot.classList.contains('pet-sleeping')) wakeUp();
      try { mascot.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      mascot.classList.add('pet-dragging');
      mascot.style.transition = 'none';
    });

    mascot.addEventListener('pointermove', (e) => {
      if (!dragging || !mascot) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (!dragMoved) {
        if (Math.hypot(dx, dy) < 6) return; // 位移小于 6px 视为普通点击
        dragMoved = true;
        setPetState('surprised'); // 被拎起来吓一跳
      }
      // 切换到 left/top 定位（px），限制在屏幕内
      const w = mascot.offsetWidth;
      const h = mascot.offsetHeight;
      const x = Math.max(4, Math.min(window.innerWidth - w - 4, petStartX + dx));
      const y = Math.max(4, Math.min(window.innerHeight - h - 4, petStartY + dy));
      mascot.style.left = x + 'px';
      mascot.style.top = y + 'px';
      mascot.style.right = 'auto';
      mascot.style.bottom = 'auto';
    });

    function endDrag() {
      if (!dragging || !mascot) return;
      dragging = false;
      mascot.classList.remove('pet-dragging');
      if (dragMoved) {
        // 平滑落回地面线（x 保持松手处），并同步 walkX
        const r = mascot.getBoundingClientRect();
        const xPct = Math.max(8, Math.min(92, (r.left + r.width / 2) / window.innerWidth * 100));
        walkX = xPct;
        const groundTop = window.innerHeight - mascot.offsetHeight - groundBottomPx;
        mascot.style.transition = 'top .55s cubic-bezier(.34,1.4,.64,1)';
        mascot.style.left = 'calc(' + xPct + '% - ' + (r.width / 2) + 'px)';
        mascot.style.right = 'auto';
        mascot.style.top = Math.max(4, groundTop) + 'px';
        // 开心地说句话
        setPetState('happy');
        const dm = DRAG_MSGS[Math.floor(Math.random() * DRAG_MSGS.length)];
        showBubble(dm, 3000);
        CS.speak && CS.speak(dm);
        setTimeout(resetPetState, 1600);
        scheduleSleep();
        // 抑制标志稍后自动复位（以防 click 未触发）
        setTimeout(() => { dragMoved = false; }, 80);
        // 稍后从落点继续溜达
        if (walkTimeout) clearTimeout(walkTimeout);
        walkTimeout = setTimeout(() => {
          walkTimeout = null;
          startWalking();
        }, 5000 + Math.random() * 8000);
      } else {
        mascot.style.transition = '';
      }
    }
    mascot.addEventListener('pointerup', endDrag);
    mascot.addEventListener('pointercancel', endDrag);
  }

  /* ---------- 空闲困倦：长时间无操作后打盹 ---------- */
  const sleepMessages = ['（打个小盹…）💤', 'zzZ… 我睡一会儿哦~', '小主人叫我我就醒～ 💤'];
  let idleTimer = null;
  const IDLE_MS = 90000;

  function goSleep() {
    if (!mascot || isWalking || _prefersReduced()) return;
    setPetState('sleeping');
    mascot.classList.remove('pet-flip');
    mascotBubble.textContent = sleepMessages[Math.floor(Math.random() * sleepMessages.length)];
    mascotBubble.classList.add('z-sleeping');
    mascotBubble.style.display = 'block';
  }

  function wakeUp() {
    if (!mascot) return;
    mascotBubble.classList.remove('z-sleeping');
    if (mascot.classList.contains('pet-sleeping')) {
      resetPetState();
      mascotBubble.style.display = '';
    }
    scheduleSleep();
  }

  function scheduleSleep() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(goSleep, IDLE_MS);
  }

  // 记录小主人操作，刷新空闲计时
  ['click', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, wakeUp, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopWalking();
    } else if (!mascot.classList.contains('pet-sleeping')) {
      scheduleSleep();
    }
  });

  /* 初始化点击行为 */
  if (mascot) {
    // 首次展示欢迎气泡（APK 原生 TTS 会同步朗读；网页首次无手势时静默，不影响）
    setTimeout(() => {
      const hello = CS.profile.name
        ? CS.profile.name + '，你好呀！' + CS.profile.avatar
        : '你好呀！跟我一起玩吧~ ' + CS.profile.avatar;
      showBubble(hello, 4000);
      CS.speak && CS.speak(hello);
    }, 1200);

    // 点击交互：随时打开伙伴对话（不配置 AI 也能离线聊）
    mascot.addEventListener('click', () => {
      if (dragMoved) { dragMoved = false; return; } // 刚拖完，不算点击
      if (mascot.classList.contains('pet-sleeping')) {
        wakeUp();
        showBubble('啊～我醒啦！小主人想我了吗？😊', 3000);
        CS.sfx && CS.sfx.tap();
        CS.speak && CS.speak('啊～我醒啦！小主人想我了吗？');
        return;
      }
      CS.sfx && CS.sfx.tap();
      CS.openMascotChat();
    });

    // 初始化随机行走（延迟启动）与空闲打盹
    setTimeout(startWalking, 5000);
    scheduleSleep();
  }

  /* ---------- 宠物自主语音互动 ---------- */
  // 按场景分类的主动问候语
  const AUTO_MSGS = {
    greeting: [
      '小主人，你在干嘛呀？',
      '小主人，今天过得开心吗？',
      '小主人，我在这儿等你好久啦~',
      '小主人，要不要跟我聊聊天呀？'
    ],
    water: [
      '小主人，该喝水啦！喝口水休息一下~',
      '小主人，记得喝水哦，小身体才有力气！',
      '小主人，你的小水杯空了吗？快喝口水吧~'
    ],
    eye: [
      '小主人，小眼睛累不累呀？看看远处休息一下吧 👀',
      '小主人，保护小眼睛很重要哦，眨眨眼睛休息下~',
      '小主人，看窗外远一点的地方，让眼睛放松放松~'
    ],
    activity: [
      '小主人，要不要起来活动活动呀？伸个懒腰~',
      '小主人，坐了好久啦，起来走两步吧！',
      '小主人，站起来拍拍手，活动活动小身体~'
    ],
    encourage: [
      '小主人，你今天学了好多东西呀，真棒！⭐',
      '小主人，你越来越厉害了，加油加油！💪',
      '小主人，每学一点新东西，星星就多一点哦~'
    ],
    fun: [
      '小主人，要不要跟我背首诗呀？📖',
      '小主人，来唱首儿歌吧！🎵',
      '小主人，要不要玩个数学小游戏呀？🔢'
    ]
  };

  // 根据时间段选择合适的话题
  function pickAutoMsg() {
    const hour = new Date().getHours();
    // 上午偏问候/鼓励，下午偏喝水/护眼，晚上偏休息
    let pool;
    if (hour < 12) {
      pool = ['greeting', 'encourage', 'fun', 'activity'];
    } else if (hour < 18) {
      pool = ['water', 'eye', 'activity', 'encourage', 'fun'];
    } else {
      pool = ['eye', 'water', 'activity', 'greeting'];
    }
    const cat = pool[Math.floor(Math.random() * pool.length)];
    const msgs = AUTO_MSGS[cat];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  // 判断是否适合主动说话（页面可见 + 非家长中心 + 无聊天面板 + 未被拖动）
  function canAutoSpeak() {
    if (!document || document.visibilityState === 'hidden') return false;
    if (dragging) return false;
    // 家长中心不主动打扰
    if (location.hash && location.hash.indexOf('#/parent') === 0) return false;
    // 聊天面板已打开则不重复
    if (document.querySelector('.mascot-chat')) return false;
    // 休息提醒弹层显示时不重复
    const restOverlay = document.getElementById('restOverlay');
    if (restOverlay && !restOverlay.classList.contains('hidden')) return false;
    return true;
  }

  let autoTimer = null;

  function doAutoSpeak() {
    if (!canAutoSpeak()) return;
    // 声音关闭时不主动说话
    if (CS.getMuted && CS.getMuted()) return;
    const msg = pickAutoMsg();
    // 说话时切换到"正在说话"表情
    setPetState('talking');
    showBubble(msg, 6000);
    CS.speak && CS.speak(msg);
    // 说完后恢复默认表情
    setTimeout(resetPetState, 5800);
  }

  function startAutoTimer() {
    stopAutoTimer();
    const cfg = CS.state.mascotAuto;
    if (!cfg || !cfg.on) return;
    const intervalMs = Math.max(2, cfg.interval || 5) * 60 * 1000;
    // 首次延迟 60 秒（避免刚打开就说话）
    const firstDelay = Math.min(intervalMs, 60 * 1000);
    autoTimer = setInterval(doAutoSpeak, intervalMs);
    // 首次 60 秒后触发一次
    setTimeout(doAutoSpeak, firstDelay);
  }

  function stopAutoTimer() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  // 页面可见性变化时暂停/恢复
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startAutoTimer();
    } else {
      stopAutoTimer();
    }
  });

  // 启动自主互动
  startAutoTimer();

  // 暴露给家长中心控制
  CS.mascotAuto = {
    start: startAutoTimer,
    stop: stopAutoTimer,
    speak: doAutoSpeak
  };
})(window.CS);
