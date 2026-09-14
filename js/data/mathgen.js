/* ============ 数学题目生成器（按年龄分层，程序化出题） ============ */
window.CS = window.CS || {};
CS.DATA = CS.DATA || {};

CS.DATA.mathGen = (function () {
  'use strict';
  const EMOJIS = ['🍎', '🍌', '🍓', '🌟', '🐥', '🐟', '🎈', '🌸', '🍭', '🚗'];
  const ri = (n) => 1 + Math.floor(Math.random() * n); // 1..n
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function countQ(max) {
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const n = ri(max);
    return {
      type: 'count',
      prompt: '数一数，一共有几个？',
      visual: Array(n).fill(emoji),
      options: makeNums(n, 1, max + 5),
      answer: n
    };
  }

  function moreQ(max) {
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const a = 1 + Math.floor(Math.random() * max);
    let b = 1 + Math.floor(Math.random() * max);
    if (b === a) b = a % max + 1;
    return {
      type: 'more',
      prompt: '哪一边更多？点一点多的那一组！',
      visualA: Array(a).fill(emoji),
      visualB: Array(b).fill(emoji),
      options: null,
      answerA: a > b ? 'A' : 'B'
    };
  }

  function addQ(max) {
    const a = ri(max), b = ri(max);
    return {
      type: 'expr',
      prompt: a + ' + ' + b + ' = ?',
      options: makeNums(a + b, 1, max * 2 + 6),
      answer: a + b
    };
  }

  function subQ(max) {
    const a = ri(max), b = ri(a);
    return {
      type: 'expr',
      prompt: a + ' - ' + b + ' = ?',
      options: makeNums(a - b, 0, max + 6),
      answer: a - b
    };
  }

  function mulQ() {
    const a = ri(9), b = ri(9);
    return {
      type: 'expr',
      prompt: a + ' × ' + b + ' = ?',
      options: makeNums(a * b, 1, 82),
      answer: a * b
    };
  }

  function divQ() {
    const b = ri(9), ans = ri(9);
    const a = b * ans;
    return {
      type: 'expr',
      prompt: a + ' ÷ ' + b + ' = ?',
      options: makeNums(ans, 1, 82),
      answer: ans
    };
  }

  function bigAddQ() {
    const a = 100 + Math.floor(Math.random() * 800);
    const b = 100 + Math.floor(Math.random() * 800);
    return {
      type: 'expr',
      prompt: a + ' + ' + b + ' = ?',
      options: makeNums(a + b, 100, 1900),
      answer: a + b
    };
  }

  /* 生成 4 个互不相同的选项（含正确答案），干扰项取答案附近的数 */
  function makeNums(ans, min, max) {
    const cand = [];
    for (let d = 1; d <= 5; d++) {
      [ans - d, ans + d].forEach((v) => {
        if (v >= min && v <= max) cand.push(v);
      });
    }
    const opts = shuffle(cand).slice(0, 3);
    opts.push(ans);
    let pad = 1;
    while (opts.length < 4) {
      const v = ans + 10 + pad++;
      if (!opts.includes(v)) opts.push(v);
    }
    return shuffle(opts);
  }

  /* 每个年龄段的游戏组合 */
  const RECIPES = {
    a1: [() => countQ(10), () => countQ(10), () => moreQ(6), () => addQ(5)],
    a2: [() => countQ(20), () => addQ(10), () => subQ(10), () => moreQ(12)],
    a3: [() => addQ(50), () => subQ(50), () => mulQ(), () => countQ(30)],
    a4: [() => mulQ(), () => divQ(), () => bigAddQ(), () => subQ(100)]
  };

  function makeRound(ageKey, count) {
    const list = [];
    const recipes = RECIPES[ageKey] || RECIPES.a1;
    for (let i = 0; i < count; i++) {
      list.push(recipes[i % recipes.length]());
    }
    return list;
  }

  return { makeRound };
})();
