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
