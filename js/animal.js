/* ============ 吉祥物动物：根据宝贝头像渲染对应的可爱小动物 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';

  /* ---------- 所有动物的共享渐变 + 眼睛/口/尾/爪等通用部件模板 ---------- */
  var SHARED_DEFS =
    '<defs>' +
      '<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#ffd090"/>' +
        '<stop offset="100%" stop-color="#f5a040"/>' +
      '</linearGradient>' +
      '<radialGradient id="gBlush" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#ffb3c1" stop-opacity=".8"/>' +
        '<stop offset="100%" stop-color="#ffb3c1" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="gEye"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#f0f0f0"/></radialGradient>' +
    '</defs>';

  /* 通用的开心眼、睡觉眼、张嘴、微笑嘴 */
  var FEELING_EYES_HAPPY =
    '<path class="pet-eye-happy" d="M 42 50 Q 48 42 54 50" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path class="pet-eye-happy" d="M 66 50 Q 72 42 78 50" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>';
  var FEELING_EYES_SLEEP =
    '<path class="pet-eye-sleep" d="M 42 50 Q 48 56 54 50" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path class="pet-eye-sleep" d="M 66 50 Q 72 56 78 50" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>';
  var FEELING_MOUTH_OPEN =
    '<ellipse class="pet-mouth-open" cx="60" cy="70" rx="5.5" ry="5" fill="#e06a6a"/>' +
    '<ellipse class="pet-tongue" cx="60" cy="73" rx="3.2" ry="2.2" fill="#ff9aa2"/>';
  var FEELING_MOUTH_SMILE =
    '<path class="pet-mouth-smile" d="M 50 64 Q 60 76 70 64 Z" fill="#e06a6a"/>' +
    '<path class="pet-mouth-smile" d="M 50 64 Q 60 76 70 64" fill="none" stroke="#b0632c" stroke-width="1.8" stroke-linecap="round"/>';

  /* 默认圆眼（带高光），用于所有动物 */
  function defaultEyes(cxL, cxR) {
    return (
      '<g class="pet-eye pet-eye-l">' +
        '<ellipse cx="' + cxL + '" cy="50" rx="5.4" ry="6.4" fill="#2d3748"/>' +
        '<circle cx="' + (cxL - 2.2) + '" cy="46.5" r="2" fill="white"/>' +
        '<circle cx="' + (cxL + 2.4) + '" cy="53" r="1" fill="white" opacity=".85"/>' +
      '</g>' +
      '<g class="pet-eye pet-eye-r">' +
        '<ellipse cx="' + cxR + '" cy="50" rx="5.4" ry="6.4" fill="#2d3748"/>' +
        '<circle cx="' + (cxR - 2.2) + '" cy="46.5" r="2" fill="white"/>' +
        '<circle cx="' + (cxR + 2.4) + '" cy="53" r="1" fill="white" opacity=".85"/>' +
      '</g>'
    );
  }

  /* 默认微笑嘴 ω，供各动物使用 */
  function defaultMouth() {
    return '<path class="pet-mouth" d="M 60 67.5 Q 54.5 73.5 49.5 68 M 60 67.5 Q 65.5 73.5 70.5 68" fill="none" stroke="#a0622c" stroke-width="2" stroke-linecap="round"/>';
  }

  /* 腮红椭圆 */
  function blush(cx) {
    return '<ellipse class="pet-blush" cx="' + cx + '" cy="60" rx="7.5" ry="5" fill="url(#gBlush)"/>';
  }

  /* 身体 + 肚子 + 前爪 */
  function body(cBody, cBelly) {
    return (
      '<ellipse class="pet-torso" cx="60" cy="87" rx="30" ry="25" fill="' + cBody + '"/>' +
      '<ellipse class="pet-belly" cx="60" cy="93" rx="18" ry="15" fill="' + cBelly + '"/>' +
      '<ellipse class="pet-paw pet-paw-l" cx="46" cy="111" rx="9.5" ry="6.5" fill="' + cBelly + '"/>' +
      '<ellipse class="pet-paw pet-paw-r" cx="74" cy="111" rx="9.5" ry="6.5" fill="' + cBelly + '"/>'
    );
  }

  /* 通用尾巴（可覆盖路径） */
  function tail(pathD) {
    return '<path class="pet-tail" d="' + pathD + '" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>';
  }

  /* ---------- 12 种动物的完整 SVG ---------- */
  var ANIMALS = {
    '🐣': function () {
      return SHARED_DEFS +
        /* 尾巴 */
        '<path class="pet-tail" d="M 84 96 C 104 92 108 74 96 62" fill="none" stroke="#ffd699" stroke-width="8.5" stroke-linecap="round"/>' +
        body('#ffe082', '#fff8e1') +
        /* 头：圆润小圆 */
        '<g class="pet-head">' +
          '<circle class="pet-face" cx="60" cy="47" r="33" fill="#ffe082"/>' +
          /* 小嘴 */
          defaultMouth() +
          blush(37) + blush(83) +
          defaultEyes(45, 75) +
          /* 小鸡特有：小喙 */
          '<path d="M 56 58 Q 60 63 64 58 Q 60 60 56 58 Z" fill="#ff9800"/>' +
          /* 小翅膀 */
          '<path class="pet-wing pet-wing-l" d="M 29 68 Q 19 60 26 52 Q 32 58 33 66 Z" fill="#ffcc02" opacity=".85"/>' +
          '<path class="pet-wing pet-wing-r" d="M 91 68 Q 101 60 94 52 Q 88 58 87 66 Z" fill="#ffcc02" opacity=".85"/>' +
          /* 小脚 */
          '<path d="M 50 111 L 48 118 M 50 111 L 52 118" stroke="#ff9800" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M 70 111 L 68 118 M 70 111 L 72 118" stroke="#ff9800" stroke-width="2" stroke-linecap="round"/>' +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐰': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 84 98 C 100 98 104 84 96 76 C 90 70 84 76 86 86" fill="#fff"/>' +
        body('#f5f5f5', '#fff') +
        '<g class="pet-head">' +
          /* 长耳朵 */
          '<ellipse class="pet-ear pet-ear-l" cx="44" cy="16" rx="9" ry="24" fill="#f5f5f5" transform="rotate(-8,44,16)"/>' +
          '<ellipse class="pet-ear pet-ear-r" cx="76" cy="16" rx="9" ry="24" fill="#f5f5f5" transform="rotate(8,76,16)"/>' +
          '<ellipse cx="44" cy="16" rx="5" ry="18" fill="#ffb3c1" opacity=".7" transform="rotate(-8,44,16)"/>' +
          '<ellipse cx="76" cy="16" rx="5" ry="18" fill="#ffb3c1" opacity=".7" transform="rotate(8,76,16)"/>' +
          '<circle class="pet-face" cx="60" cy="48" r="31" fill="#f5f5f5"/>' +
          defaultEyes(46, 74) +
          defaultMouth() +
          '<path class="pet-nose" d="M 57.5 56 Q 60 54.5 62.5 56 Q 61 58.5 60 58.5 Q 58.5 58.5 57.5 56 Z" fill="#ffb3c1"/>' +
          blush(38) + blush(82) +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐼': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 86 100 C 100 100 102 90 94 86 C 88 83 84 89 86 96" fill="#3d4654"/>' +
        body('#3d4654', '#fff') +
        '<g class="pet-head">' +
          '<circle class="pet-face" cx="60" cy="48" r="33" fill="#fff"/>' +
          /* 熊猫眼斑 */
          '<ellipse cx="45" cy="48" rx="11" ry="9.5" fill="#3d4654"/>' +
          '<ellipse cx="75" cy="48" rx="11" ry="9.5" fill="#3d4654"/>' +
          defaultEyes(45, 75) +
          /* 耳朵 */
          '<circle class="pet-ear pet-ear-l" cx="33" cy="26" r="11" fill="#3d4654"/>' +
          '<circle class="pet-ear pet-ear-r" cx="87" cy="26" r="11" fill="#3d4654"/>' +
          '<path class="pet-nose" d="M 56 59 Q 60 57 64 59 Q 62 63 60 63 Q 58 63 56 59 Z" fill="#3d4654"/>' +
          defaultMouth() +
          blush(36) + blush(84) +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐯': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 86 98 C 106 98 110 78 100 60" fill="none" stroke="#f5a040" stroke-width="9.5" stroke-linecap="round"/>' +
        /* 橙色条纹身体 */
        body('#f5a040', '#ffd090') +
        /* 条纹装饰 */
        '<path d="M 50 82 Q 60 86 70 82" fill="none" stroke="#d47020" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>' +
        '<path d="M 47 89 Q 60 93 73 89" fill="none" stroke="#d47020" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>' +
        '<g class="pet-head">' +
          '<circle class="pet-face" cx="60" cy="47" r="33" fill="#f5a040"/>' +
          /* 额头王字纹 */
          '<path d="M 52 33 L 68 33 M 60 28 L 60 38 M 54 37 L 66 37" stroke="#d47020" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>' +
          /* 耳朵圆 */
          '<circle class="pet-ear pet-ear-l" cx="31" cy="22" r="11" fill="#f5a040"/>' +
          '<circle class="pet-ear pet-ear-r" cx="89" cy="22" r="11" fill="#f5a040"/>' +
          '<circle cx="31" cy="22" r="6" fill="#ffd090"/>' +
          '<circle cx="89" cy="22" r="6" fill="#ffd090"/>' +
          defaultEyes(45, 75) +
          '<path class="pet-nose" d="M 56 57 Q 60 55 64 57 Q 62 62 60 62 Q 58 62 56 57 Z" fill="#fff"/>' +
          defaultMouth() +
          /* 脸颊 */
          '<ellipse class="pet-blush" cx="36" cy="60" rx="7.5" ry="5" fill="url(#gBlush)"/>' +
          '<ellipse class="pet-blush" cx="84" cy="60" rx="7.5" ry="5" fill="url(#gBlush)"/>' +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🦊': function () {
      return SHARED_DEFS +
        /* 狐狸蓬松尾 */
        '<path class="pet-tail" d="M 84 96 C 110 96 118 70 102 52 C 92 42 82 52 86 66" fill="#f57c20"/>' +
        '<path d="M 98 58 C 104 52 108 56 104 62" fill="white" opacity=".85"/>' +
        body('#f57c20', '#fff') +
        '<g class="pet-head">' +
          /* 三角耳 */
          '<path class="pet-ear pet-ear-l" d="M 32 30 L 22 4 L 54 20 Z" fill="#f57c20"/>' +
          '<path class="pet-ear pet-ear-r" d="M 88 30 L 98 4 L 66 20 Z" fill="#f57c20"/>' +
          '<path d="M 35 26 L 27 10 L 49 21 Z" fill="#fff"/>' +
          '<path d="M 85 26 L 93 10 L 71 21 Z" fill="#fff"/>' +
          /* 脸 */
          '<circle class="pet-face" cx="60" cy="48" r="32" fill="#f57c20"/>' +
          /* 白色脸颊区域 */
          '<ellipse cx="60" cy="60" rx="18" ry="13" fill="#fff"/>' +
          defaultEyes(44, 76) +
          '<path class="pet-nose" d="M 57 59.5 Q 60 58 63 59.5 Q 61.5 63 60 63 Q 58.5 63 57 59.5 Z" fill="#2d3748"/>' +
          defaultMouth() +
          blush(34) + blush(86) +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐨': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 86 100 C 98 100 100 92 94 88 C 88 84 84 92 86 98" fill="#9e9e9e" opacity=".4"/>' +
        body('#9e9e9e', '#f5f5f5') +
        '<g class="pet-head">' +
          /* 圆耳 */
          '<circle class="pet-ear pet-ear-l" cx="32" cy="24" r="13" fill="#9e9e9e"/>' +
          '<circle class="pet-ear pet-ear-r" cx="88" cy="24" r="13" fill="#9e9e9e"/>' +
          '<circle cx="32" cy="24" r="8" fill="#f5f5f5"/>' +
          '<circle cx="88" cy="24" r="8" fill="#f5f5f5"/>' +
          '<circle class="pet-face" cx="60" cy="48" r="33" fill="#9e9e9e"/>' +
          /* 眼圈 */
          '<ellipse cx="45" cy="48" rx="10" ry="9" fill="#f5f5f5"/>' +
          '<ellipse cx="75" cy="48" rx="10" ry="9" fill="#f5f5f5"/>' +
          defaultEyes(45, 75) +
          /* 大鼻子 */
          '<ellipse class="pet-nose" cx="60" cy="60" rx="8" ry="6" fill="#2d3748"/>' +
          '<path d="M 60 66 Q 56 71 52 67 M 60 66 Q 64 71 68 67" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round"/>' +
          blush(35) + blush(85) +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐷': function () {
      return SHARED_DEFS +
        /* 卷尾巴 */
        '<path class="pet-tail" d="M 88 98 C 102 98 104 88 98 84 C 93 81 90 87 94 90" fill="none" stroke="#f8bbd0" stroke-width="6.5" stroke-linecap="round"/>' +
        body('#f8bbd0', '#fce4ec') +
        '<g class="pet-head">' +
          /* 三角耳 */
          '<path class="pet-ear pet-ear-l" d="M 30 28 L 22 4 L 48 18 Z" fill="#f8bbd0"/>' +
          '<path class="pet-ear pet-ear-r" d="M 90 28 L 98 4 L 72 18 Z" fill="#f8bbd0"/>' +
          '<path d="M 33 24 L 27 10 L 44 19 Z" fill="#f48fb1" opacity=".6"/>' +
          '<path d="M 87 24 L 93 10 L 76 19 Z" fill="#f48fb1" opacity=".6"/>' +
          '<circle class="pet-face" cx="60" cy="48" r="32" fill="#f8bbd0"/>' +
          defaultEyes(44, 76) +
          /* 猪鼻子 */
          '<ellipse cx="60" cy="62" rx="12" ry="9" fill="#f48fb1"/>' +
          '<circle cx="55" cy="62" r="2.4" fill="#c2185b" opacity=".45"/>' +
          '<circle cx="65" cy="62" r="2.4" fill="#c2185b" opacity=".45"/>' +
          defaultMouth() +
          blush(36) + blush(84) +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐸': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 84 100 C 96 100 100 94 94 90 C 88 86 84 94 86 100" fill="#66bb6a" opacity=".5"/>' +
        body('#66bb6a', '#c8e6c9') +
        '<g class="pet-head">' +
          /* 鼓眼 */
          '<circle class="pet-ear pet-ear-l" cx="40" cy="22" r="11" fill="#66bb6a"/>' +
          '<circle class="pet-ear pet-ear-r" cx="80" cy="22" r="11" fill="#66bb6a"/>' +
          '<circle cx="40" cy="22" r="7" fill="#fff"/>' +
          '<circle cx="80" cy="22" r="7" fill="#fff"/>' +
          '<circle class="pet-face" cx="60" cy="48" r="33" fill="#66bb6a"/>' +
          /* 眼睛在头顶，所以默认眼移到头顶位置 */
          '<g class="pet-eye pet-eye-l" transform="translate(0, -14)">' +
            '<ellipse cx="40" cy="36" rx="5" ry="5.5" fill="#2d3748"/>' +
            '<circle cx="38" cy="33.5" r="1.8" fill="white"/>' +
          '</g>' +
          '<g class="pet-eye pet-eye-r" transform="translate(0, -14)">' +
            '<ellipse cx="80" cy="36" rx="5" ry="5.5" fill="#2d3748"/>' +
            '<circle cx="78" cy="33.5" r="1.8" fill="white"/>' +
          '</g>' +
          /* 宽嘴巴 */
          '<path d="M 42 58 Q 60 72 78 58" fill="none" stroke="#2e7d32" stroke-width="2.4" stroke-linecap="round"/>' +
          blush(34) + blush(86) +
          /* 腮红 */
          '<ellipse cx="32" cy="54" rx="6" ry="4" fill="url(#gBlush)"/>' +
          '<ellipse cx="88" cy="54" rx="6" ry="4" fill="url(#gBlush)"/>' +
        '</g>' +
        /* 青蛙开心闭眼、睡觉眼要对应头顶位置 */
        '<path class="pet-eye-happy" d="M 33 22 Q 40 15 47 22" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path class="pet-eye-happy" d="M 73 22 Q 80 15 87 22" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path class="pet-eye-sleep" d="M 33 22 Q 40 28 47 22" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path class="pet-eye-sleep" d="M 73 22 Q 80 28 87 22" fill="none" stroke="#2d3748" stroke-width="2.6" stroke-linecap="round"/>' +
        '<ellipse class="pet-mouth-open" cx="60" cy="64" rx="6" ry="6" fill="#e06a6a"/>' +
        '<ellipse class="pet-tongue" cx="60" cy="68" rx="4" ry="2.5" fill="#ff9aa2"/>' +
        '<path class="pet-mouth-smile" d="M 44 58 Q 60 74 76 58 Z" fill="#e06a6a"/>' +
        '<path class="pet-mouth-smile" d="M 44 58 Q 60 74 76 58" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round"/>';
    },
    '🦄': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 88 96 C 108 92 112 70 100 52 C 94 44 84 52 88 64" fill="none" stroke="#ce93d8" stroke-width="8" stroke-linecap="round"/>' +
        body('#fff9c4', '#ffffff') +
        '<g class="pet-head">' +
          /* 鬃毛渐变 */
          '<path d="M 28 30 Q 16 20 24 8 Q 32 14 30 24" fill="#ce93d8"/>' +
          '<path d="M 32 26 Q 20 14 30 4 Q 38 12 34 22" fill="#f48fb1"/>' +
          '<path d="M 88 30 Q 100 20 92 8 Q 84 14 86 24" fill="#f48fb1"/>' +
          '<path d="M 84 26 Q 96 14 86 4 Q 78 12 82 22" fill="#ce93d8"/>' +
          '<circle class="pet-face" cx="60" cy="48" r="32" fill="#fff9c4"/>' +
          /* 独角 */
          '<path d="M 57 18 L 60 -6 L 63 18 Z" fill="#ffb300"/>' +
          '<path d="M 58 10 L 62 10 M 57 5 L 63 5" stroke="#ff8f00" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>' +
          defaultEyes(44, 76) +
          defaultMouth() +
          blush(36) + blush(84) +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐥': function () {
      return SHARED_DEFS +
        '<path class="pet-tail" d="M 84 96 C 100 96 102 84 94 80 C 88 77 84 85 86 94" fill="#ffcc02"/>' +
        body('#ffcc02', '#fff9c4') +
        '<g class="pet-head">' +
          '<circle class="pet-face" cx="60" cy="48" r="32" fill="#ffcc02"/>' +
          /* 小冠 */
          '<path d="M 52 18 Q 56 10 60 16 Q 64 10 68 18" fill="#f44336"/>' +
          defaultEyes(44, 76) +
          /* 喙 */
          '<path d="M 56 58 L 60 67 L 64 58 Z" fill="#ff9800"/>' +
          blush(36) + blush(84) +
          /* 小翅膀 */
          '<path class="pet-wing pet-wing-l" d="M 28 64 Q 18 56 24 48 Q 30 54 32 62 Z" fill="#ffca28" opacity=".8"/>' +
          '<path class="pet-wing pet-wing-r" d="M 92 64 Q 102 56 96 48 Q 90 54 88 62 Z" fill="#ffca28" opacity=".8"/>' +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🐳': function () {
      return SHARED_DEFS +
        /* 鲸鱼喷水尾 */
        '<path class="pet-tail" d="M 88 96 C 108 96 114 76 104 60 C 96 50 88 60 92 76" fill="#5c6bc0"/>' +
        '<path d="M 96 64 C 100 58 106 60 104 68" fill="#fff" opacity=".4"/>' +
        body('#5c6bc0', '#9fa8da') +
        '<g class="pet-head">' +
          '<circle class="pet-face" cx="60" cy="48" r="33" fill="#5c6bc0"/>' +
          /* 圆耳状背鳍 */
          '<path class="pet-ear pet-ear-l" d="M 36 22 Q 30 8 44 16 Z" fill="#3949ab"/>' +
          '<path class="pet-ear pet-ear-r" d="M 84 22 Q 90 8 76 16 Z" fill="#3949ab"/>' +
          defaultEyes(44, 76) +
          '<path class="pet-nose" d="M 56 58 Q 60 56 64 58 Q 62 62 60 62 Q 58 62 56 58 Z" fill="#3949ab"/>' +
          defaultMouth() +
          /* 腮红 */
          blush(36) + blush(84) +
          /* 小水花装饰 */
          '<circle cx="30" cy="30" r="2.5" fill="#90caf9" opacity=".5"/>' +
          '<circle cx="90" cy="26" r="2" fill="#90caf9" opacity=".5"/>' +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    },
    '🦋': function () {
      return SHARED_DEFS +
        /* 蝴蝶身躯 */
        body('#ab47bc', '#e1bee7') +
        '<g class="pet-head">' +
          /* 大眼睛 */
          '<circle class="pet-face" cx="60" cy="47" r="28" fill="#ce93d8"/>' +
          /* 触角 */
          '<path class="pet-ear pet-ear-l" d="M 40 22 C 30 4 18 10 22 2" fill="none" stroke="#ab47bc" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="21" cy="1" r="3.5" fill="#ab47bc"/>' +
          '<path class="pet-ear pet-ear-r" d="M 80 22 C 90 4 102 10 98 2" fill="none" stroke="#ab47bc" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="99" cy="1" r="3.5" fill="#ab47bc"/>' +
          defaultEyes(48, 72) +
          defaultMouth() +
          blush(38) + blush(82) +
        '</g>' +
        /* 翅膀（成组包裹斑点，扇动时斑点跟着动） */
        '<g class="pet-wing pet-wing-l">' +
          '<path d="M 30 60 C 4 46 2 84 28 86 C 46 87 48 68 30 60 Z" fill="#ab47bc" opacity=".85"/>' +
          '<circle cx="20" cy="68" r="5" fill="#e1bee7" opacity=".5"/>' +
          '<circle cx="28" cy="78" r="3.5" fill="#e1bee7" opacity=".5"/>' +
        '</g>' +
        '<g class="pet-wing pet-wing-r">' +
          '<path d="M 90 60 C 116 46 118 84 92 86 C 74 87 72 68 90 60 Z" fill="#ab47bc" opacity=".85"/>' +
          '<circle cx="100" cy="68" r="5" fill="#e1bee7" opacity=".5"/>' +
          '<circle cx="92" cy="78" r="3.5" fill="#e1bee7" opacity=".5"/>' +
        '</g>' +
        FEELING_EYES_HAPPY + FEELING_EYES_SLEEP + FEELING_MOUTH_OPEN + FEELING_MOUTH_SMILE;
    }
  };

  /* ---------- 步态注册表：该飞的飞、该跳的跳、该慢走的慢走 ----------
     fly 滑翔 / flutter 扑翅小跳 / hop 蹦跳 / leap 蛙跳 / lumber 慢走摇晃
     trot 小跑 / run 奔跑 / gallop 疾驰 / swim 游动 */
  CS.ANIMAL_GAITS = {
    '🐣': 'flutter', '🐰': 'hop', '🐼': 'lumber', '🐯': 'run',
    '🦊': 'trot', '🐨': 'lumber', '🐷': 'trot', '🐸': 'leap',
    '🦄': 'gallop', '🐥': 'flutter', '🐳': 'swim', '🦋': 'fly'
  };

  /* ---------- 注册到 CS ---------- */
  CS.ANIMALS = ANIMALS;

  /* 根据 emoji 找到对应渲染器 */
  CS.renderMascotAnimal = function (svgEl, emoji) {
    if (!svgEl || !ANIMALS[emoji]) return;
    var factory = ANIMALS[emoji];
    svgEl.innerHTML = factory();
  };

})(CS);
