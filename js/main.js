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

  // 吉祥物互动
  const mascotMessages = ['你真棒！⭐', '加油加油！💪', '今天学了什么呀？', '星星越多越好玩哦~', '记得休息小眼睛 👀', '背首诗给我听吧！📖', '你好呀！✨'];
  const mascot = document.getElementById('mascot');
  const mascotBubble = document.getElementById('mascotBubble');
  let mascotTimer = null;
  if (mascot) {
    // 首次展示欢迎气泡
    setTimeout(() => {
      mascotBubble.textContent = CS.profile.name ? CS.profile.name + '，你好呀！🐱' : '你好呀！跟我一起玩吧~ 🐱';
      mascotBubble.style.display = 'block';
      mascotTimer = setTimeout(() => { mascotBubble.style.display = ''; }, 4000);
    }, 1200);
    mascot.addEventListener('click', () => {
      const msg = mascotMessages[Math.floor(Math.random() * mascotMessages.length)];
      mascotBubble.textContent = msg;
      mascotBubble.style.display = 'block';
      mascot.style.animation = 'none';
      void mascot.offsetWidth;
      mascot.style.animation = '';
      CS.sfx && CS.sfx.tap();
      clearTimeout(mascotTimer);
      mascotTimer = setTimeout(() => { mascotBubble.style.display = ''; }, 3000);
    });
  }
})(window.CS);
