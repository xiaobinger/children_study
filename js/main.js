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

    // 首次使用引导
    if (!CS.store.get('welcomed', false)) {
      CS.showModal(
        '<h3>🎈 欢迎来到学习乐园</h3>' +
        '<p>这里有<b>古诗、识字、儿歌、课文、手工、数学</b>六大乐园，<br>' +
        '先选择宝贝的年龄，就能开始快乐学习啦！<br><br>' +
        '右上角 🌙 可开启<b>护眼模式</b>，<br>' +
        '每学习 20 分钟会提醒宝贝休息小眼睛 👀</p>' +
        '<button class="btn btn-primary btn-big" id="welcomeGo">开始学习 🚀</button>'
      );
      const goBtn = document.getElementById('welcomeGo');
      goBtn.onclick = () => {
        CS.store.set('welcomed', true);
        CS.hideModal();
        document.getElementById('ageBtn').click();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.CS);
