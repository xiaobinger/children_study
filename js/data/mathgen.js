/* ============ 数学题目生成器（按年龄分层，程序化出题） ============ */
window.CS = window.CS || {};
CS.DATA = CS.DATA || {};

CS.DATA.mathGen = (function () {
  'use strict';

  const EMOJIS = ['🍎', '🍌', '🍓', '🌟', '🐥', '🐟', '🎈', '🌸', '🍭', '🚗'];
  const SHAPES = ['○', '△', '□', '▭'];
  const SHAPE_NAMES = ['圆形', '三角形', '正方形', '长方形'];
  const NAMES = ['小明', '小红', '小华', '小丽', '小军', '小芳'];
  const OBJECTS = ['苹果', '橘子', '铅笔', '本子', '气球', '糖果'];

  const ri = (n) => 1 + Math.floor(Math.random() * n);
  const ri0 = (n) => Math.floor(Math.random() * (n + 1));
  const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeNums(ans, min, max) {
    const cand = [];
    for (let d = 1; d <= 8; d++) {
      [ans - d, ans + d].forEach((v) => {
        if (v >= min && v <= max && v !== ans) cand.push(v);
      });
    }
    const opts = shuffle(cand).slice(0, 3);
    opts.push(ans);
    let pad = 1;
    while (opts.length < 4) {
      const v = ans + 10 + pad++;
      if (!opts.includes(v) && v >= min && v <= max) opts.push(v);
    }
    return shuffle(opts);
  }

  function makeNumsFromList(ans, candidates) {
    const filtered = candidates.filter((v) => v !== ans);
    const opts = shuffle(filtered).slice(0, 3);
    opts.push(ans);
    return shuffle(opts);
  }

  /* ======================== a1 (3-4岁) 题型 ======================== */

  function countQ(max) {
    const emoji = randItem(EMOJIS);
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
    const emoji = randItem(EMOJIS);
    const a = 1 + Math.floor(Math.random() * max);
    let b = 1 + Math.floor(Math.random() * max);
    if (b === a) b = a % max + 1;
    return {
      type: 'more',
      prompt: '哪一边更多？点一点多的那一组！',
      visualA: Array(a).fill(emoji),
      visualB: Array(b).fill(emoji),
      options: ['A', 'B'],
      answer: a > b ? 'A' : 'B'
    };
  }

  function lessQ(max) {
    const emoji = randItem(EMOJIS);
    const a = 1 + Math.floor(Math.random() * max);
    let b = 1 + Math.floor(Math.random() * max);
    if (b === a) b = (a % max) + 1;
    return {
      type: 'less',
      prompt: '哪一边更少？点一点少的那一组！',
      visualA: Array(a).fill(emoji),
      visualB: Array(b).fill(emoji),
      options: ['A', 'B'],
      answer: a < b ? 'A' : 'B'
    };
  }

  function matchQ() {
    const n = ri(10);
    const emoji = randItem(EMOJIS);
    const correct = n;
    const opts = [correct];
    while (opts.length < 4) {
      const v = ri(10);
      if (!opts.includes(v)) opts.push(v);
    }
    const shuffled = shuffle(opts);
    return {
      type: 'match',
      prompt: '数字 ' + n + ' 对应哪组物品？',
      visual: Array(correct).fill(emoji),
      options: shuffled.map((v) => ({ count: v, visual: Array(v).fill(emoji) })),
      answer: correct
    };
  }

  function bigSmallQ() {
    const sizes = [ri(10), ri(10), ri(10)];
    while (sizes[0] === sizes[1] || sizes[1] === sizes[2] || sizes[0] === sizes[2]) {
      sizes[1] = ri(10);
      sizes[2] = ri(10);
    }
    const askBig = Math.random() > 0.5;
    const correctIdx = askBig
      ? sizes.indexOf(Math.max(...sizes))
      : sizes.indexOf(Math.min(...sizes));
    return {
      type: 'big_small',
      prompt: askBig ? '哪个最大？点一点！' : '哪个最小？点一点！',
      visual: sizes.map((s) => '🟫'.repeat(s)),
      options: ['A', 'B', 'C'],
      answer: ['A', 'B', 'C'][correctIdx]
    };
  }

  function shapeQ() {
    const idx = Math.floor(Math.random() * SHAPES.length);
    const correctName = SHAPE_NAMES[idx];
    const opts = shuffle(SHAPE_NAMES);
    return {
      type: 'shape',
      prompt: '这是什么形状？',
      visual: SHAPES[idx],
      options: opts,
      answer: correctName
    };
  }

  /* ======================== a2 (5-6岁) 题型 ======================== */

  function add10Q() {
    const a = ri(9), b = ri(9);
    return {
      type: 'add_10',
      prompt: a + ' + ' + b + ' = ?',
      options: makeNums(a + b, 1, 20),
      answer: a + b
    };
  }

  function sub10Q() {
    const a = ri(10), b = ri(a);
    return {
      type: 'sub_10',
      prompt: a + ' - ' + b + ' = ?',
      options: makeNums(a - b, 0, 20),
      answer: a - b
    };
  }

  function add20Q() {
    const a = 10 + ri(9), b = ri(9);
    return {
      type: 'add_20',
      prompt: a + ' + ' + b + ' = ?',
      options: makeNums(a + b, 10, 30),
      answer: a + b
    };
  }

  function sub20Q() {
    const a = 11 + ri(9), b = 1 + ri(10);
    return {
      type: 'sub_20',
      prompt: a + ' - ' + b + ' = ?',
      options: makeNums(a - b, 1, 20),
      answer: a - b
    };
  }

  function compare20Q() {
    const a = ri(20), b = ri(20);
    const diff = Math.abs(a - b);
    return {
      type: 'compare_20',
      prompt: '○ 有 ' + a + ' 个，● 有 ' + b + ' 个，谁多几个？（或少几个）',
      visual: { a: a, b: b },
      options: makeNums(diff, 0, 20),
      answer: diff
    };
  }

  function sequenceQ() {
    const start = ri(5);
    const step = 1 + ri(5);
    const arr = [start, start + step, start + step * 2, start + step * 3];
    const correct = start + step * 4;
    return {
      type: 'sequence',
      prompt: '找规律填数：' + arr.join('  ') + '  ？',
      options: makeNums(correct, 1, 50),
      answer: correct
    };
  }

  /* ======================== a3 (7-8岁) 题型 ======================== */

  function add100Q() {
    const a = ri(99), b = ri(99);
    return {
      type: 'add_100',
      prompt: a + ' + ' + b + ' = ?',
      options: makeNums(a + b, 10, 200),
      answer: a + b
    };
  }

  function sub100Q() {
    const a = ri(100), b = ri(a);
    return {
      type: 'sub_100',
      prompt: a + ' - ' + b + ' = ?',
      options: makeNums(a - b, 0, 100),
      answer: a - b
    };
  }

  function multiplyQ() {
    const a = ri(9), b = ri(9);
    return {
      type: 'multiply',
      prompt: a + ' × ' + b + ' = ?',
      options: makeNums(a * b, 1, 81),
      answer: a * b
    };
  }

  function divideQ() {
    const b = ri(9), ans = ri(9);
    const a = b * ans;
    return {
      type: 'divide',
      prompt: a + ' ÷ ' + b + ' = ?',
      options: makeNums(ans, 1, 9),
      answer: ans
    };
  }

  function mixedQ() {
    const ops = ['+', '-'];
    const op = randItem(ops);
    let a, b, ans;
    if (op === '+') {
      a = ri(50), b = ri(50);
      ans = a + b;
    } else {
      a = ri(50) + 50, b = ri(50);
      ans = a - b;
    }
    return {
      type: 'mixed',
      prompt: a + ' ' + op + ' ' + b + ' = ?',
      options: makeNums(ans, 0, 150),
      answer: ans
    };
  }

  function wordProblemQ() {
    const name = randItem(NAMES);
    const obj = randItem(OBJECTS);
    const a = ri(10);
    const b = ri(10);
    const add = Math.random() > 0.5;
    let prompt, ans;
    if (add) {
      prompt = name + ' 有 ' + a + ' 个 ' + obj + '，妈妈又给了他 ' + b + ' 个，现在有几个？';
      ans = a + b;
    } else {
      prompt = name + ' 有 ' + (a + b) + ' 个 ' + obj + '，给了小红 ' + b + ' 个，还剩几个？';
      ans = a;
    }
    return {
      type: 'word_problem',
      prompt: prompt,
      options: makeNums(ans, 1, 25),
      answer: ans
    };
  }

  function clockQ() {
    const hour = ri(12);
    const isHalf = Math.random() > 0.5;
    const correct = isHalf ? hour + ':30' + '（' + hour + '时半）' : hour + ':00' + '（' + hour + '时）';
    const opts = shuffle([correct, (hour % 12 + 1) + ':00', (hour % 12 + 2) + ':30', hour + ':30']).slice(0, 4);
    if (!opts.includes(correct)) opts[0] = correct;
    return {
      type: 'clock',
      prompt: '现在钟面显示几点？',
      visual: isHalf ? '🕐 半' : '🕐 整',
      options: shuffle(opts),
      answer: correct
    };
  }

  /* ======================== a4 (9-12岁) 题型 ======================== */

  function addBigQ() {
    const a = 100 + Math.floor(Math.random() * 800);
    const b = 100 + Math.floor(Math.random() * 800);
    return {
      type: 'add_big',
      prompt: a + ' + ' + b + ' = ?',
      options: makeNums(a + b, 200, 1800),
      answer: a + b
    };
  }

  function subBigQ() {
    const a = 200 + Math.floor(Math.random() * 700);
    const b = 100 + Math.floor(Math.random() * 700);
    return {
      type: 'sub_big',
      prompt: a + ' - ' + b + ' = ?',
      options: makeNums(a - b, 10, 900),
      answer: a - b
    };
  }

  function multiDigitQ() {
    const a = 10 + ri(89), b = ri(9);
    return {
      type: 'multi_digit',
      prompt: a + ' × ' + b + ' = ?',
      options: makeNums(a * b, 100, 900),
      answer: a * b
    };
  }

  function divisionRemainderQ() {
    const divisor = 2 + ri(8);
    const quotient = ri(15);
    const remainder = ri(divisor - 1);
    const dividend = divisor * quotient + remainder;
    return {
      type: 'division',
      prompt: dividend + ' ÷ ' + divisor + ' = ?......?',
      options: shuffle([quotient + ' 余 ' + remainder, quotient + ' 余 ' + (remainder + 1), (quotient + 1) + ' 余 ' + remainder, quotient + ' 余 0']),
      answer: quotient + ' 余 ' + remainder
    };
  }

  function fractionQ() {
    const denom = 2 + ri(8);
    const n1 = 1 + ri(denom - 1);
    const n2 = 1 + ri(denom - 1);
    const add = Math.random() > 0.5;
    let ans;
    let prompt;
    if (add) {
      ans = n1 + n2;
      prompt = n1 + '/' + denom + ' + ' + n2 + '/' + denom + ' = ?';
    } else {
      const larger = Math.max(n1, n2);
      const smaller = Math.min(n1, n2);
      ans = larger - smaller;
      prompt = larger + '/' + denom + ' - ' + smaller + '/' + denom + ' = ?';
    }
    const display = ans + '/' + denom;
    return {
      type: 'fraction',
      prompt: prompt,
      options: shuffle([display, (ans + 1) + '/' + denom, ans + '/' + (denom + 1), (ans + 2) + '/' + denom]),
      answer: display
    };
  }

  function decimalQ() {
    const a = (ri(9) + Math.random()).toFixed(1);
    const b = (ri(9) + Math.random()).toFixed(1);
    const op = Math.random() > 0.5 ? '+' : '-';
    let ans;
    if (op === '+') ans = (parseFloat(a) + parseFloat(b)).toFixed(1);
    else {
      const larger = Math.max(parseFloat(a), parseFloat(b));
      const smaller = Math.min(parseFloat(a), parseFloat(b));
      ans = (larger - smaller).toFixed(1);
      return {
        type: 'decimal',
        prompt: larger.toFixed(1) + ' - ' + smaller.toFixed(1) + ' = ?',
        options: shuffle([ans, (parseFloat(ans) + 0.1).toFixed(1), (parseFloat(ans) - 0.1).toFixed(1), (parseFloat(ans) + 1).toFixed(1)]),
        answer: ans
      };
    }
    return {
      type: 'decimal',
      prompt: a + ' + ' + b + ' = ?',
      options: shuffle([ans, (parseFloat(ans) + 0.1).toFixed(1), (parseFloat(ans) - 0.1).toFixed(1), (parseFloat(ans) + 1).toFixed(1)]),
      answer: ans
    };
  }

  function logicQ() {
    const types = ['age_pattern', 'reverse', 'odd_even'];
    const t = randItem(types);
    if (t === 'age_pattern') {
      const a = ri(10), b = ri(10);
      const ans = a + b;
      return {
        type: 'logic',
        prompt: '小明今年 ' + a + ' 岁，小红比他大 ' + b + ' 岁，小红几岁？',
        options: makeNums(ans, 1, 25),
        answer: ans
      };
    } else if (t === 'reverse') {
      const n = 10 + ri(89);
      const reversed = parseInt(n.toString().split('').reverse().join(''));
      return {
        type: 'logic',
        prompt: '把 ' + n + ' 的数位颠倒后是几？',
        options: makeNums(reversed, 10, 99),
        answer: reversed
      };
    } else {
      const n = ri(10);
      const isOdd = n % 2 === 1;
      return {
        type: 'logic',
        prompt: n + ' 是奇数还是偶数？',
        options: ['奇数', '偶数'],
        answer: isOdd ? '奇数' : '偶数'
      };
    }
  }

  function geometryQ() {
    const isRect = Math.random() > 0.5;
    const askArea = Math.random() > 0.5;
    if (isRect) {
      const w = 2 + ri(8), h = 2 + ri(8);
      if (askArea) {
        return {
          type: 'geometry',
          prompt: '长方形长 ' + w + '，宽 ' + h + '，面积是多少？',
          options: makeNums(w * h, 1, 100),
          answer: w * h
        };
      } else {
        return {
          type: 'geometry',
          prompt: '长方形长 ' + w + '，宽 ' + h + '，周长是多少？',
          options: makeNums(2 * (w + h), 4, 50),
          answer: 2 * (w + h)
        };
      }
    } else {
      const s = 2 + ri(10);
      if (askArea) {
        return {
          type: 'geometry',
          prompt: '正方形边长 ' + s + '，面积是多少？',
          options: makeNums(s * s, 1, 121),
          answer: s * s
        };
      } else {
        return {
          type: 'geometry',
          prompt: '正方形边长 ' + s + '，周长是多少？',
          options: makeNums(4 * s, 4, 50),
          answer: 4 * s
        };
      }
    }
  }

  function ratioQ() {
    const ratio = 1 + ri(5);
    const base = 1 + ri(10);
    const total = base + base * ratio;
    return {
      type: 'ratio',
      prompt: '男生与女生的比是 1:' + ratio + '，男生有 ' + base + ' 人，女生几人？',
      options: makeNums(base * ratio, 1, 60),
      answer: base * ratio
    };
  }

  /* ======================== 题型池配置 ======================== */

  const RECIPES = {
    a1: [
      () => countQ(10),
      () => moreQ(6),
      () => lessQ(6),
      () => matchQ(),
      () => bigSmallQ(),
      () => shapeQ()
    ],
    a2: [
      () => add10Q(),
      () => sub10Q(),
      () => add20Q(),
      () => sub20Q(),
      () => compare20Q(),
      () => sequenceQ()
    ],
    a3: [
      () => add100Q(),
      () => sub100Q(),
      () => multiplyQ(),
      () => divideQ(),
      () => mixedQ(),
      () => wordProblemQ(),
      () => clockQ()
    ],
    a4: [
      () => addBigQ(),
      () => subBigQ(),
      () => multiDigitQ(),
      () => divisionRemainderQ(),
      () => fractionQ(),
      () => decimalQ(),
      () => logicQ(),
      () => geometryQ(),
      () => ratioQ()
    ]
  };

  function makeRound(ageKey, count) {
    const recipes = RECIPES[ageKey] || RECIPES.a1;
    const list = [];
    const shuffledRecipes = shuffle(recipes);
    for (let i = 0; i < count; i++) {
      list.push(shuffledRecipes[i % shuffledRecipes.length]());
    }
    return shuffle(list);
  }

  return { makeRound };
})();
