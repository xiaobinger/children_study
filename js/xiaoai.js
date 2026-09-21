/* ============ 小爱音箱联动：配置 / 播报 / 得星表扬 / 定时提醒 ============
   依赖 tools/xiaoai_bridge.py 桥接服务（局域网内运行）
   配置入口：家长中心 → 小爱音箱 */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { store } = CS;

  const DEFAULTS = {
    on: false,          // 总开关
    url: '',            // 桥接地址，如 http://192.168.1.5:8899
    device: '',         // 指定音箱 deviceID（空 = 第一台）
    deviceName: '',
    praise: true,       // 得星表扬播报
    levelup: true,      // 宠物升级庆祝播报
    remind: false,      // 定时学习提醒
    remindTimes: ['19:30', '20:30']
  };

  let cfg = Object.assign({}, DEFAULTS, store.get('xiaoai', {}));
  const fired = {};   // { '19:30': '2026-09-21' } 当天已提醒过的时间点

  function save() { store.set('xiaoai', cfg); }

  function base() { return String(cfg.url || '').replace(/\/+$/, ''); }

  /* 带超时的 GET 请求桥接接口；baseOverride 用于"测试连接"（先测后存） */
  function api(path, timeout, baseOverride) {
    const url = (baseOverride || base()).replace(/\/+$/, '') + path;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout || 6000);
    return fetch(url, { signal: ctl.signal })
      .then((r) => r.json())
      .finally(() => clearTimeout(t));
  }

  /* 让小爱音箱说话（fire-and-forget，失败静默不弹窗打扰孩子） */
  function say(text, force) {
    if ((!cfg.on && !force) || !base()) return Promise.resolve(false);
    const q = '/say?text=' + encodeURIComponent(text) +
      (cfg.device ? '&device=' + encodeURIComponent(cfg.device) : '');
    return api(q, 8000).then((r) => !!(r && r.ok)).catch(() => false);
  }

  /* 得星表扬：短时间多次得星合并播一条，避免刷屏 */
  let buf = 0, bufT = null;
  function praise(n) {
    if (!cfg.on || !cfg.praise) return;
    buf += n;
    clearTimeout(bufT);
    bufT = setTimeout(() => {
      const got = buf; buf = 0;
      const name = CS.profile.name || '小朋友';
      say(got > 1
        ? name + '太棒啦！一下得到了' + got + '颗小星星，继续加油！'
        : name + '得到一颗小星星，真棒！继续加油哦！');
    }, 900);
  }

  /* 宠物升级庆祝播报 */
  function levelup(level, title) {
    if (!cfg.on || !cfg.levelup) return;
    const name = CS.profile.name || '小朋友';
    say('好消息！' + name + '的学习小伙伴升级啦，现在是' + title + '，' + level + '级！为他鼓掌吧！');
  }

  /* 定时学习提醒：每 20 秒检查一次 HH:mm，到点且当天未播过才播 */
  function checkRemind() {
    if (!cfg.on || !cfg.remind) return;
    const now = new Date();
    const p2 = (v) => ('0' + v).slice(-2);
    const hm = p2(now.getHours()) + ':' + p2(now.getMinutes());
    const today = now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate());
    (cfg.remindTimes || []).forEach((t) => {
      if (t === hm && fired[t] !== today) {
        fired[t] = today;
        const name = CS.profile.name || '小朋友';
        say('到学习时间啦！' + name + '，快来学习乐园读古诗、赢小星星吧！');
      }
    });
  }
  setInterval(checkRemind, 20000);

  /* 宠物升级：监听 pet.js 派发的 cs:pet-levelup 事件，自动播报庆祝 */
  document.addEventListener('cs:pet-levelup', (e) => {
    const lv = (e.detail && e.detail.level) || 1;
    const t = (CS.pet && CS.pet.TITLES) ? CS.pet.TITLES[Math.min(CS.pet.TITLES.length, Math.max(1, lv)) - 1] : '';
    levelup(lv, t);
  });

  CS.xiaoai = {
    get cfg() { return cfg; },
    save,
    say,
    praise,
    levelup,
    status(baseOverride) { return api('/status', 5000, baseOverride); },
    devices(baseOverride) { return api('/devices', 8000, baseOverride); },
    update(patch) {
      cfg = Object.assign({}, cfg, patch);
      save();
      return cfg;
    }
  };
})(window.CS);
