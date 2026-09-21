/* ============ 家长控制端 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { $, $$, esc, state, store } = CS;

  const AVATARS = ['🐣', '🐰', '🐼', '🐯', '🦊', '🐨', '🐷', '🐸', '🦄', '🐥', '🐳', '🦋'];

  function render(view) {
    if (!state.pin) renderSetPin(view);
    else renderPinEntry(view);
  }

  /* ---------- 首次设置 PIN ---------- */
  function renderSetPin(view) {
    let first = '';
    view.innerHTML =
      '<h2 class="page-title"><span class="pt-icon">🔐</span>家长中心</h2>' +
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🔒</span>设置家长密码</div>' +
      '<p class="hint-text">设置一个 4 位数字密码，防止小朋友自己改设置。<br>（密码仅保存在本机浏览器）</p>' +
      '<div class="pin-dots" id="pinDots"></div>' +
      '<div class="pin-pad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<button class="pin-key" data-n="' + n + '">' + n + '</button>').join('') +
      '<button class="pin-key" data-n="del">⌫</button>' +
      '<button class="pin-key" data-n="0">0</button>' +
      '<button class="pin-key" data-n="ok">✓</button>' +
      '</div><p class="hint-text" id="pinMsg"></p></div>';

    drawDots(first);
    view.querySelectorAll('.pin-key').forEach((btn) => {
      btn.addEventListener('click', () => {
        CS.sfx.tap();
        const n = btn.getAttribute('data-n');
        if (n === 'del') first = first.slice(0, -1);
        else if (n === 'ok') { trySave(); return; }
        else if (first.length < 4) first += n;
        drawDots(first);
      });
    });

    function drawDots(v) {
      $('#pinDots').innerHTML = Array.from({ length: 4 }, (_, i) =>
        '<span class="pin-dot' + (i < v.length ? ' on' : '') + '"></span>').join('');
    }

    function trySave() {
      if (first.length !== 4) { $('#pinMsg').textContent = '请输入 4 位数字'; return; }
      state.pin = first;
      store.set('pin', first);
      CS.toast('家长密码已设置');
      renderPanel(view);
    }
  }

  /* ---------- PIN 验证 ---------- */
  function renderPinEntry(view) {
    let input = '';
    view.innerHTML =
      '<h2 class="page-title"><span class="pt-icon">🔐</span>家长中心</h2>' +
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🔑</span>请输入家长密码</div>' +
      '<div class="pin-dots" id="pinDots"></div>' +
      '<div class="pin-pad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<button class="pin-key" data-n="' + n + '">' + n + '</button>').join('') +
      '<button class="pin-key" data-n="del">⌫</button>' +
      '<button class="pin-key" data-n="0">0</button>' +
      '<button class="pin-key" data-n="back">←</button>' +
      '</div><p class="hint-text" id="pinMsg">忘记密码？清除浏览器本站数据即可重置</p></div>';

    drawDots('');
    view.querySelectorAll('.pin-key').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = btn.getAttribute('data-n');
        if (n === 'back') { CS.navigate('home'); return; }
        CS.sfx.tap();
        if (n === 'del') input = input.slice(0, -1);
        else if (input.length < 4) input += n;
        drawDots(input);
        if (input.length === 4) {
          if (input === state.pin) { CS.toast('欢迎，家长'); renderPanel(view); }
          else {
            $('#pinMsg').textContent = '密码不对，再试一次吧';
            input = '';
            setTimeout(() => drawDots(''), 300);
          }
        }
      });
    });

    function drawDots(v) {
      $('#pinDots').innerHTML = Array.from({ length: 4 }, (_, i) =>
        '<span class="pin-dot' + (i < v.length ? ' on' : '') + '"></span>').join('');
    }
  }

  /* ---------- 主面板 ---------- */
  function renderPanel(view) {
    view.innerHTML =
      '<div class="back-row"><h2 class="page-title" style="margin:0"><span class="pt-icon">👨‍👩‍👧</span>家长中心</h2>' +
      '<button class="btn btn-ghost" id="pExit">退出</button></div>' +
      '<div class="tab-row">' +
      '<button class="tab-btn active" data-tab="profile">宝贝档案</button>' +
      '<button class="tab-btn" data-tab="reward">奖励与护眼</button>' +
      '<button class="tab-btn" data-tab="cartoons">动画库</button>' +
      '<button class="tab-btn" data-tab="ai">AI 伙伴</button>' +
      '<button class="tab-btn" data-tab="xiaoai">小爱音箱</button>' +
      '<button class="tab-btn" data-tab="report">学习报告</button></div>' +
      '<div id="parentBox"></div>';

    const box = $('#parentBox');
    view.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        view.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        CS.sfx.tap();
        const tab = btn.getAttribute('data-tab');
        if (tab === 'profile') tabProfile(box);
        else if (tab === 'reward') tabReward(box);
        else if (tab === 'cartoons') tabCartoons(box);
        else if (tab === 'ai') tabAI(box);
        else if (tab === 'xiaoai') tabXiaoai(box);
        else tabReport(box);
      });
    });
    tabProfile(box);
    $('#pExit').onclick = () => CS.navigate('home');
  }

  /* ---------- 档案 ---------- */
  function tabProfile(box) {
    const p = state.profile || { name: '', avatar: '🐣', birthday: '' };
    box.innerHTML =
      '<div class="quiz-area">' +
      '<div class="form-row"><label for="pfName">宝贝昵称</label>' +
      '<input class="form-input" id="pfName" maxlength="8" value="' + esc(p.name) + '" placeholder="比如：小豆丁"></div>' +
      '<div class="form-row"><label for="pfBirth">生日（自动定年龄难度）</label>' +
      '<input class="form-input" id="pfBirth" type="date" value="' + esc(p.birthday || '') + '"></div>' +
      '<div class="form-row"><label>选择头像</label><div class="avatar-grid">' +
      AVATARS.map((a) => '<button class="avatar-cell' + (a === p.avatar ? ' sel' : '') + '" data-a="' + a + '">' + a + '</button>').join('') +
      '</div></div>' +
      '<button class="btn btn-primary btn-big" id="pfSave">保存档案</button>' +
      '<button class="btn btn-ghost" id="pfPin" style="margin-top:.8rem">修改家长密码</button></div>';

    let avatar = p.avatar;
    box.querySelectorAll('.avatar-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        avatar = btn.getAttribute('data-a');
        box.querySelectorAll('.avatar-cell').forEach((b) => b.classList.remove('sel'));
        btn.classList.add('sel');
        CS.sfx.tap();
      });
    });
    $('#pfSave').onclick = () => {
      const name = $('#pfName').value.trim();
      const birthday = $('#pfBirth').value;
      const ag = CS.profile.save({ name, avatar, birthday });
      CS.toast('档案已保存' + (ag ? '，年龄难度：' + CS.AGE_GROUPS.find((g) => g.key === ag).range : ''));
      CS.render();
    };
    $('#pfPin').onclick = () => {
      state.pin = '';
      store.set('pin', '');
      CS.toast('密码已清空，请重新设置');
      renderSetPin(document.getElementById('view'));
    };
  }

  /* ---------- 奖励与护眼 ---------- */
  function tabReward(box) {
    const r = state.reward;
    box.innerHTML =
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🎁</span>星星兑换动画规则</div>' +
      '<div class="form-row"><label for="rwStars">所需星星数（颗）</label>' +
      '<input class="form-input" id="rwStars" type="number" min="1" max="999" value="' + r.stars + '"></div>' +
      '<div class="form-row"><label for="rwMins">兑换动画时长（分钟）</label>' +
      '<input class="form-input" id="rwMins" type="number" min="1" max="240" value="' + r.minutes + '"></div>' +
      '<p class="hint-text">当前剩余动画时间：' + Math.ceil(state.cartoonMins) + ' 分钟</p>' +
      '<button class="btn btn-primary" id="rwSave">保存规则</button>' +
      '<button class="btn btn-ghost" id="rwClearTime">清零动画时间</button></div>' +

      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">👀</span>护眼休息提醒</div>' +
      '<p class="hint-text">开启后，连续学习 20 分钟会提醒宝贝休息小眼睛</p>' +
      '<button class="btn ' + (state.restOn ? 'btn-primary' : 'btn-ghost') + '" id="rwRest">' +
      (state.restOn ? '已开启 ✓（点击关闭）' : '已关闭（点击开启）') + '</button></div>' +

      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">♻️</span>重置学习进度</div>' +
      '<p class="hint-text">清空星星、完成记录和动画时间（档案与密码保留）</p>' +
      '<button class="btn btn-ghost" id="rwReset" style="border-color:var(--err);color:var(--err)">全部重来</button></div>';

    $('#rwSave').onclick = () => {
      const s = Math.max(1, Math.min(999, +$('#rwStars').value || 20));
      const m = Math.max(1, Math.min(240, +$('#rwMins').value || 30));
      CS.reward.setRule(s, m);
      CS.toast('兑换规则已保存：' + s + ' ⭐ = ' + m + ' 分钟动画');
    };
    $('#rwClearTime').onclick = () => {
      state.cartoonMins = 0;
      CS.reward.saveMins();
      CS.toast('动画时间已清零');
      tabReward(box);
    };
    $('#rwRest').onclick = () => {
      state.restOn = !state.restOn;
      store.set('restOn', state.restOn);
      if (state.restOn) CS.rest.start(); else CS.rest.stop();
      CS.toast(state.restOn ? '休息提醒已开启' : '休息提醒已关闭');
      tabReward(box);
    };
    $('#rwReset').onclick = () => {
      if (!confirm('确定清空所有学习进度吗？星星和完成记录将全部重置！')) return;
      state.stars = 0; state.done = {}; state.cartoonMins = 0;
      store.set('stars', 0); store.set('done', {}); CS.reward.saveMins();
      const el = document.getElementById('starCount');
      if (el) el.textContent = '0';
      CS.toast('进度已重置');
      CS.render();
    };
  }

  /* ---------- 动画库管理 ---------- */
  function tabCartoons(box) {
    const customs = state.cartoons;
    box.innerHTML =
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">📺</span>添加动画链接</div>' +
      '<p class="hint-text">把想给宝贝看的动画/视频链接（B站、腾讯视频等）粘贴到这里，<br>小朋友只能在有动画时间时打开它们。</p>' +
      '<div class="form-row"><label for="ctTitle">动画名称</label>' +
      '<input class="form-input" id="ctTitle" maxlength="20" placeholder="比如：小猪佩奇学汉字"></div>' +
      '<div class="form-row"><label for="ctUrl">视频链接（https:// 开头）</label>' +
      '<input class="form-input" id="ctUrl" placeholder="https://..."></div>' +
      '<div class="form-row"><label>图标</label><div class="avatar-grid">' +
      ['📺', '🐱', '🐷', '🦕', '🚂', '🎵'].map((e, i) =>
        '<button class="avatar-cell' + (i === 0 ? ' sel' : '') + '" data-e="' + e + '">' + e + '</button>').join('') +
      '</div></div>' +
      '<button class="btn btn-primary" id="ctAdd">添加到动画库</button></div>' +

      (customs.length
        ? '<div class="section-title">已添加 ' + customs.length + ' 部动画</div><div class="card-list">' +
          customs.map((c) =>
            '<div class="list-card" style="cursor:default">' +
            '<span class="lc-icon">' + esc(c.emoji || '📺') + '</span>' +
            '<span class="lc-body"><span class="lc-title">' + esc(c.title) + '</span>' +
            '<span class="lc-sub" style="word-break:break-all">' + esc(c.url) + '</span></span>' +
            '<button class="icon-btn" data-del="' + c.id + '" title="删除">🗑️</button></div>').join('') + '</div>'
        : '<p class="hint-text">还没有添加自定义动画</p>') +
      '<div class="hint-text">内置的 3 个小剧场无需管理，始终可用。</div>';

    let emoji = '📺';
    box.querySelectorAll('.avatar-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        emoji = btn.getAttribute('data-e');
        box.querySelectorAll('.avatar-cell').forEach((b) => b.classList.remove('sel'));
        btn.classList.add('sel');
        CS.sfx.tap();
      });
    });
    $('#ctAdd').onclick = () => {
      const title = $('#ctTitle').value.trim();
      const url = $('#ctUrl').value.trim();
      if (!title) { CS.toast('请填写动画名称'); return; }
      if (!/^https:\/\//.test(url)) { CS.toast('链接需以 https:// 开头'); return; }
      state.cartoons.push({ id: 'u' + Date.now(), title, url, emoji });
      store.set('cartoons', state.cartoons);
      CS.toast('已添加：' + title);
      tabCartoons(box);
    };
    box.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.cartoons = state.cartoons.filter((c) => c.id !== btn.getAttribute('data-del'));
        store.set('cartoons', state.cartoons);
        CS.toast('已删除');
        tabCartoons(box);
      });
    });
  }

  /* ---------- AI 伙伴配置 ---------- */
  function tabAI(box) {
    const c = state.ai || { on: false, baseUrl: '', apiKey: '', model: '' };
    const masked = c.apiKey ? c.apiKey.slice(0, 3) + '****' + c.apiKey.slice(-4) : '';
    box.innerHTML =
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🤖</span>AI 学习伙伴</div>' +
      '<p class="hint-text">配置后，右下角的' + esc(CS.profile.avatar) + '就能和宝贝<b>真实对话</b>啦。<br>' +
      '支持 OpenAI 及任何兼容接口（DeepSeek、通义千问、智谱、Ollama 等）。</p>' +
      '<div class="form-row"><label>功能开关</label>' +
      '<button class="btn ' + (c.on ? 'btn-primary' : 'btn-ghost') + '" id="aiOn">' +
      (c.on ? '已开启 ✓（点击关闭）' : '已关闭（点击开启）') + '</button></div>' +
      '<div class="form-row"><label for="aiBase">接口地址 Base URL</label>' +
      '<input class="form-input" id="aiBase" placeholder="例如 https://api.deepseek.com" value="' + esc(c.baseUrl) + '">' +
      '<p class="hint-text" style="margin:.2rem 0 0">会自动在末尾拼接 <b>/chat/completions</b></p></div>' +
      '<div class="form-row"><label for="aiKey">API Key' + (masked ? '（当前：' + esc(masked) + '）' : '') + '</label>' +
      '<input class="form-input" id="aiKey" type="password" placeholder="sk-..." autocomplete="off"></div>' +
      '<div class="form-row"><label for="aiModel">模型 ID</label>' +
      '<input class="form-input" id="aiModel" placeholder="例如 deepseek-chat / qwen-plus / gpt-4o-mini" value="' + esc(c.model) + '"></div>' +
      '<div class="play-controls" style="margin:.4rem 0">' +
      '<button class="btn btn-primary" id="aiSave">保存设置</button>' +
      '<button class="btn btn-ghost" id="aiTest">测试连接</button></div>' +
      '<button class="btn btn-ghost" id="aiClearChat" style="border-color:var(--err);color:var(--err)">清空聊天记录</button>' +
      '<p class="hint-text" id="aiMsg" style="min-height:1.5em"></p></div>' +
      '<div class="hint-text">安全说明：API Key 仅保存在本机浏览器，不会上传。<br>' +
      'AI 会以宝贝头像的角色陪聊学习话题，回复已限制在 80 字内。<br>' +
      '本地 Ollama：手机上请填电脑的局域网地址，如 http://192.168.x.x:11434/v1</div>' +

      '<div class="quiz-area" style="margin-top:1rem">' +
      '<div class="quiz-question"><span class="q-emoji">🐾</span>宠物主动互动</div>' +
      '<p class="hint-text">开启后，右下角的' + esc(CS.profile.avatar) + '会<b>主动语音问候</b>小主人，<br>' +
      '比如问你在干嘛、提醒喝水、保护眼睛、起来活动活动等。</p>' +
      '<div class="form-row"><label>主动互动开关</label>' +
      '<button class="btn ' + (state.mascotAuto && state.mascotAuto.on ? 'btn-primary' : 'btn-ghost') + '" id="mascotAutoOn">' +
      (state.mascotAuto && state.mascotAuto.on ? '已开启 ✓（点击关闭）' : '已关闭（点击开启）') + '</button></div>' +
      '<div class="form-row"><label for="mascotAutoFreq">互动频率（每 N 分钟问候一次）</label>' +
      '<select class="form-input" id="mascotAutoFreq" style="width:100%">' +
      '<option value="3"' + ((state.mascotAuto && state.mascotAuto.interval === 3) ? ' selected' : '') + '>3 分钟（比较勤快）</option>' +
      '<option value="5"' + ((state.mascotAuto && state.mascotAuto.interval === 5) ? ' selected' : '') + '>5 分钟（默认）</option>' +
      '<option value="10"' + ((state.mascotAuto && state.mascotAuto.interval === 10) ? ' selected' : '') + '>10 分钟（比较安静）</option>' +
      '<option value="15"' + ((state.mascotAuto && state.mascotAuto.interval === 15) ? ' selected' : '') + '>15 分钟（很安静）</option>' +
      '</select></div>' +
      '<button class="btn btn-primary" id="mascotAutoSave">保存互动设置</button>' +
      '<button class="btn btn-ghost" id="mascotAutoTest" style="margin-left:.5rem">立即说一次（测试）</button>' +
      '<p class="hint-text" id="mascotAutoMsg" style="min-height:1.5em"></p></div>';

    function readForm() {
      const key = $('#aiKey').value.trim();
      const live = state.ai || {};
      return {
        on: live.on,
        baseUrl: $('#aiBase').value.trim(),
        apiKey: key || live.apiKey,
        model: $('#aiModel').value.trim()
      };
    }

    $('#aiOn').onclick = () => {
      const cur = readForm();
      if (!cur.on) {
        if (!cur.baseUrl || !cur.apiKey || !cur.model) {
          $('#aiMsg').textContent = '⚠ 开启前请先填好下面三项并保存';
          return;
        }
      }
      cur.on = !cur.on;
      CS.ai.save(cur);
      CS.toast(cur.on ? 'AI 伙伴已开启' : 'AI 伙伴已关闭');
      tabAI(box);
    };

    $('#aiSave').onclick = () => {
      const cur = readForm();
      if (cur.on && (!cur.baseUrl || !cur.apiKey || !cur.model)) {
        $('#aiMsg').textContent = '⚠ 已开启状态下，三项都不能为空';
        return;
      }
      CS.ai.save(cur);
      CS.sfx.tap();
      CS.toast('AI 设置已保存');
      tabAI(box);
    };

    $('#aiTest').onclick = async () => {
      const cur = readForm();
      if (!cur.baseUrl || !cur.apiKey || !cur.model) {
        $('#aiMsg').textContent = '⚠ 请先填完三项再测试';
        return;
      }
      CS.ai.save(cur);
      $('#aiMsg').textContent = '⏳ 正在连接，请稍等…';
      $('#aiTest').disabled = true;
      try {
        const r = await CS.aiTest();
        $('#aiMsg').textContent = '✓ 连接成功！它说：' + r.slice(0, 40);
      } catch (e) {
        $('#aiMsg').textContent = '✗ 连接失败：' + (e.message || e);
      }
      $('#aiTest').disabled = false;
    };

    $('#aiClearChat').onclick = () => {
    CS.aiClearHistory();
    CS.toast('聊天记录已清空');
  };

  $('#mascotAutoOn').onclick = () => {
    const cur = state.mascotAuto || { on: true, interval: 5 };
    cur.on = !cur.on;
    state.mascotAuto = cur;
    store.set('mascotAuto', cur);
    if (cur.on) { CS.mascotAuto && CS.mascotAuto.start(); CS.toast('宠物主动互动已开启'); }
    else { CS.mascotAuto && CS.mascotAuto.stop(); CS.toast('宠物主动互动已关闭'); }
    tabAI(box);
  };

  $('#mascotAutoSave').onclick = () => {
    const freq = Math.max(2, +$('#mascotAutoFreq').value || 5);
    const cur = state.mascotAuto || { on: true, interval: 5 };
    cur.interval = freq;
    state.mascotAuto = cur;
    store.set('mascotAuto', cur);
    CS.mascotAuto && CS.mascotAuto.start();
    $('#mascotAutoMsg').textContent = '✓ 已保存：每 ' + freq + ' 分钟主动问候一次';
    CS.sfx.tap();
    CS.toast('互动频率已保存');
  };

  $('#mascotAutoTest').onclick = () => {
    if (!CS.mascotAuto) return;
    if (CS.getMuted && CS.getMuted()) {
      $('#mascotAutoMsg').textContent = '⚠ 当前是静音状态，请先打开右上角的声音开关';
      return;
    }
    CS.mascotAuto.speak();
    $('#mascotAutoMsg').textContent = '✓ 已经让它打招呼啦，看看右下角～';
  };
}

  /* ---------- 小爱音箱 ---------- */
  function tabXiaoai(box) {
    if (!CS.xiaoai) {
      box.innerHTML = '<div class="quiz-area"><p class="hint-text">⚠ 小爱模块未加载，请检查 js/xiaoai.js 是否存在</p></div>';
      return;
    }
    const c = CS.xiaoai.cfg;
    const rt = c.remindTimes || [];
    box.innerHTML =
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">🔊</span>小爱音箱联动</div>' +
      '<p class="hint-text">让家里的小爱音箱为宝贝喝彩！<b>得星表扬、宠物升级、定时学习提醒</b>都能语音播报。<br>' +
      '首次使用：先在电脑上运行配套的 <b>xiaoai_bridge.py</b> 桥接程序（tools 文件夹内），<br>' +
      '再把窗口里提示的局域网地址填到下面即可。</p>' +
      '<div class="form-row"><label>功能开关</label>' +
      '<button class="btn ' + (c.on ? 'btn-primary' : 'btn-ghost') + '" id="xaOn">' +
      (c.on ? '已开启 ✓（点击关闭）' : '已关闭（点击开启）') + '</button></div>' +
      '<div class="form-row"><label for="xaUrl">桥接地址</label>' +
      '<input class="form-input" id="xaUrl" placeholder="例如 http://192.168.1.5:8899" value="' + esc(c.url) + '"></div>' +
      '<div class="form-row"><label for="xaDev">选择音箱</label>' +
      '<select class="form-input" id="xaDev" style="width:60%;display:inline-block">' +
      '<option value="">默认（账号下第一台音箱）</option>' +
      (c.device ? '<option value="' + esc(c.device) + '" selected>' + esc(c.deviceName || c.device) + '</option>' : '') +
      '</select>' +
      '<button class="btn btn-ghost" id="xaRefresh" style="margin-left:.5rem">🔄 获取设备列表</button></div>' +
      '<div class="form-row"><label>播报内容</label>' +
      '<button class="btn ' + (c.praise ? 'btn-primary' : 'btn-ghost') + '" id="xaPraise" style="margin-right:.5rem">⭐ 得星表扬</button>' +
      '<button class="btn ' + (c.levelup ? 'btn-primary' : 'btn-ghost') + '" id="xaLevelup">🎉 宠物升级</button></div>' +
      '<div class="form-row"><label>定时学习提醒</label>' +
      '<button class="btn ' + (c.remind ? 'btn-primary' : 'btn-ghost') + '" id="xaRemind">' +
      (c.remind ? '已开启 ✓（点击关闭）' : '已关闭（点击开启）') + '</button></div>' +
      '<div class="form-row"><label>提醒时间（到点喊宝贝来学习）</label>' +
      '<input class="form-input" id="xaT1" type="time" style="width:40%;display:inline-block" value="' + esc(rt[0] || '19:30') + '">' +
      '<input class="form-input" id="xaT2" type="time" style="width:40%;display:inline-block;margin-left:.5rem" value="' + esc(rt[1] || '') + '"></div>' +
      '<div class="play-controls" style="margin:.4rem 0">' +
      '<button class="btn btn-primary" id="xaSave">保存设置</button>' +
      '<button class="btn btn-ghost" id="xaTest">测试连接</button>' +
      '<button class="btn btn-ghost" id="xaSay">🔊 让音箱说一句</button></div>' +
      '<p class="hint-text" id="xaMsg" style="min-height:1.5em"></p></div>' +
      '<div class="hint-text">安全说明：小米账号只填在电脑上的桥接程序里，APP 这边不需要也不存储账号密码。<br>' +
      '手机 APP 需与运行桥接程序的电脑在<b>同一个 WiFi</b> 下。只想先体验？<br>' +
      '电脑上运行 <b>python xiaoai_bridge.py --mock</b>（演示模式，音箱不真响，适合试流程）。</div>';

    function readForm() {
      const sel = $('#xaDev');
      const live = CS.xiaoai.cfg;
      return {
        on: live.on,
        url: $('#xaUrl').value.trim(),
        device: sel.value,
        deviceName: sel.value ? sel.options[sel.selectedIndex].textContent : '',
        praise: live.praise,
        levelup: live.levelup,
        remind: live.remind,
        remindTimes: [$('#xaT1').value, $('#xaT2').value].filter(Boolean)
      };
    }

    $('#xaOn').onclick = () => {
      const cur = readForm();
      if (!cur.on && !cur.url) { $('#xaMsg').textContent = '⚠ 开启前请先填写桥接地址'; return; }
      cur.on = !cur.on;
      CS.xiaoai.update(cur);
      CS.toast(cur.on ? '小爱音箱联动已开启' : '小爱音箱联动已关闭');
      tabXiaoai(box);
    };

    $('#xaPraise').onclick = () => {
      const cur = readForm(); cur.praise = !cur.praise;
      CS.xiaoai.update(cur);
      CS.toast(cur.praise ? '得星表扬播报：开' : '得星表扬播报：关');
      tabXiaoai(box);
    };

    $('#xaLevelup').onclick = () => {
      const cur = readForm(); cur.levelup = !cur.levelup;
      CS.xiaoai.update(cur);
      CS.toast(cur.levelup ? '宠物升级播报：开' : '宠物升级播报：关');
      tabXiaoai(box);
    };

    $('#xaRemind').onclick = () => {
      const cur = readForm(); cur.remind = !cur.remind;
      if (cur.remind && !cur.remindTimes.length) cur.remindTimes = ['19:30'];
      CS.xiaoai.update(cur);
      CS.toast(cur.remind ? '定时学习提醒：开' : '定时学习提醒：关');
      tabXiaoai(box);
    };

    $('#xaRefresh').onclick = async () => {
      const cur = readForm();
      if (!cur.url) { $('#xaMsg').textContent = '⚠ 请先填写桥接地址再获取'; return; }
      $('#xaMsg').textContent = '⏳ 正在获取设备列表…';
      $('#xaRefresh').disabled = true;
      try {
        const r = await CS.xiaoai.devices(cur.url);
        const list = (r && r.devices) || [];
        if (!list.length) {
          $('#xaMsg').textContent = '✗ 该账号下没有找到小爱音箱设备';
        } else {
          const sel = $('#xaDev');
          sel.innerHTML = '<option value="">默认（账号下第一台音箱）</option>' +
            list.map((d) => '<option value="' + esc(d.deviceID) + '"' + (d.deviceID === cur.device ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('');
          $('#xaMsg').textContent = '✓ 找到 ' + list.length + ' 台设备' + (r.mock ? '（演示模式）' : '，请在下拉框中选择');
        }
      } catch (e) {
        $('#xaMsg').textContent = '✗ 获取失败：' + (e.message || e) + '，请检查桥接程序是否在运行';
      }
      $('#xaRefresh').disabled = false;
    };

    $('#xaSave').onclick = () => {
      const cur = readForm();
      if (cur.on && !cur.url) { $('#xaMsg').textContent = '⚠ 已开启状态下，桥接地址不能为空'; return; }
      if (cur.remind && !cur.remindTimes.length) cur.remindTimes = ['19:30'];
      CS.xiaoai.update(cur);
      CS.sfx.tap();
      CS.toast('小爱音箱设置已保存');
      tabXiaoai(box);
    };

    $('#xaTest').onclick = async () => {
      const cur = readForm();
      if (!cur.url) { $('#xaMsg').textContent = '⚠ 请先填写桥接地址再测试'; return; }
      $('#xaMsg').textContent = '⏳ 正在连接，请稍等…';
      $('#xaTest').disabled = true;
      try {
        const r = await CS.xiaoai.status(cur.url);
        $('#xaMsg').textContent = '✓ 连接成功！' + (r.mock ? '当前是演示模式（mock），音箱不会真的发声。' : '桥接服务运行正常。');
      } catch (e) {
        $('#xaMsg').textContent = '✗ 连接失败：' + (e.message || e) + '，请检查地址与桥接程序';
      }
      $('#xaTest').disabled = false;
    };

    $('#xaSay').onclick = async () => {
      const cur = readForm();
      if (!cur.url) { $('#xaMsg').textContent = '⚠ 请先填写桥接地址'; return; }
      CS.xiaoai.update(cur);
      $('#xaMsg').textContent = '⏳ 已发送，请听音箱…';
      try {
        const ok = await CS.xiaoai.say('小朋友你好呀！我是你的学习小伙伴，一起加油吧！', true);
        $('#xaMsg').textContent = ok ? '✓ 已让音箱说话，听到了吗？' : '✗ 播报失败，请检查设备选择或稍后再试';
      } catch (e) {
        $('#xaMsg').textContent = '✗ 播报失败：' + (e.message || e);
      }
    };
  }

  /* ---------- 学习报告 ---------- */
  function tabReport(box) {
    const done = state.done;
    const count = (prefix) => Object.keys(done).filter((k) => k.startsWith(prefix) && done[k]).length;
    const litSeen = Object.keys(done).filter((k) => k.startsWith('lit_seen_')).length;
    const rows = [
      ['⭐ 累计星星', state.stars + ' 颗'],
      ['📖 古诗闯关', count('poem_') + ' / ' + CS.DATA.poems.length + ' 首'],
      ['🔤 认识的字', litSeen + ' 个'],
      ['📚 课文完成', count('text_') + ' / ' + CS.DATA.texts.length + ' 篇'],
      ['🎵 儿歌唱完', count('song_') + ' / ' + CS.DATA.songs.length + ' 首'],
      ['✂️ 手工完成', count('craft_') + ' / ' + CS.DATA.crafts.length + ' 个'],
      ['🎬 剩余动画时间', Math.ceil(state.cartoonMins) + ' 分钟']
    ];
    box.innerHTML =
      '<div class="quiz-area">' +
      '<div class="quiz-question"><span class="q-emoji">📊</span>宝贝的学习成果</div>' +
      rows.map((r) =>
        '<div class="report-row"><span>' + r[0] + '</span><b>' + esc(String(r[1])) + '</b></div>').join('') +
      '</div>' +
      '<div class="hint-text">数据保存在本机浏览器，仅供家长参考～</div>';
  }

  CS.register('parent', render);
})(window.CS);
