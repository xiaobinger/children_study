/* ============ AI 学习伙伴：配置 / 对话 / 聊天面板 / 离线对话大脑 ============ */
window.CS = window.CS || {};

(function (CS) {
  'use strict';
  const { $, esc, store, state, pick, agePool } = CS;

  /* ---------- 配置（家长端设置） ---------- */
  CS.ai = {
    get cfg() { return state.ai || { on: false, baseUrl: '', apiKey: '', model: '' }; },
    get on() {
      const c = this.cfg;
      return !!(c.on && c.baseUrl && c.apiKey && c.model);
    },
    save(cfg) {
      state.ai = {
        on: !!cfg.on,
        baseUrl: String(cfg.baseUrl || '').trim().replace(/\/+$/, ''),
        apiKey: String(cfg.apiKey || '').trim(),
        model: String(cfg.model || '').trim()
      };
      store.set('ai', state.ai);
    }
  };

  /* ---------- 对话历史 ---------- */
  let history = store.get('aiHistory', []);

  function clearHistory() {
    history = [];
    store.set('aiHistory', []);
  }

  /* ---------- 系统提示词：角色扮演 + 儿童安全边界 ---------- */
  function systemPrompt() {
    const avatar = CS.profile.avatar;
    const name = CS.profile.name || '小朋友';
    const g = CS.AGE_GROUPS.find((x) => x.key === state.age);
    const ageInfo = g ? (g.range + '·' + g.label) : '3-12岁';
    return [
      '你是"儿童益智学习乐园"里宝贝的学习伙伴，外形是一只' + avatar + '，平时用这个emoji代表自己。',
      '宝贝叫' + name + '，年龄约' + ageInfo + '，请用符合这个年龄的简单中文对话。',
      '必须遵守：',
      '1.每次回复不超过80字，语气活泼可爱，可以带emoji。',
      '2.只聊学习相关：古诗、识字、数学、儿歌、课文、童话、手工、好习惯。',
      '3.不讨论暴力、恐怖、恋爱话题；宝贝问起就温柔地引导回学习。',
      '4.不说长句英文，不提"我是AI/程序/大模型"。',
      '5.多鼓励多表扬，不知道答案就和宝贝一起猜。',
      '6.宝贝连续玩很久时，提醒休息小眼睛。'
    ].join('\n');
  }

  /* ---------- 调用 OpenAI 兼容接口（/chat/completions） ---------- */
  async function callAI(userText, maxTokens) {
    const cfg = CS.ai.cfg;
    const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const messages = [{ role: 'system', content: systemPrompt() }]
      .concat(history.slice(-12))
      .concat([{ role: 'user', content: userText }]);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({
          model: cfg.model,
          messages: messages,
          temperature: 0.8,
          max_tokens: maxTokens || 200
        }),
        signal: ctrl.signal
      });
      if (!res.ok) {
        let detail = '';
        try {
          const j = await res.json();
          detail = (j.error && j.error.message) || '';
        } catch (e) { /* 忽略 */ }
        throw new Error('HTTP ' + res.status + (detail ? '：' + detail : ''));
      }
      const data = await res.json();
      const reply = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
      if (!reply) throw new Error('接口没有返回内容');
      return String(reply).trim();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- 聊天（写入历史） ---------- */
  async function chat(userText) {
    const reply = await callAI(userText);
    history.push({ role: 'user', content: userText });
    history.push({ role: 'assistant', content: reply });
    if (history.length > 40) history = history.slice(-40);
    store.set('aiHistory', history);
    return reply;
  }

  /* ---------- 测试连接（家长端） ---------- */
  CS.aiTest = function () { return callAI('你好', 20); };
  CS.aiClearHistory = clearHistory;

  /* ================================================================
     离线对话大脑：不配置 AI 也能聊（意图识别 + 内容库应答）
     ================================================================ */
  let game = null;   // 统一游戏状态机 { type, ... }

  function poolPoems() {
    const pool = agePool(state.age);
    return CS.DATA.poems.filter((p) => pool.includes(p.age));
  }
  function poolSongs() {
    const pool = agePool(state.age);
    return CS.DATA.songs.filter((s) => pool.includes(s.age));
  }
  function poolStories() {
    const pool = agePool(state.age);
    return CS.DATA.stories.filter((s) => pool.includes(s.age));
  }
  function poolRiddles() {
    const pool = agePool(state.age);
    return CS.DATA.fun.riddles.filter((r) => pool.includes(r.age));
  }
  function poolJokes() {
    const pool = agePool(state.age);
    return CS.DATA.fun.jokes.filter((j) => pool.includes(j.age));
  }
  function poolTongueTwisters() {
    const pool = agePool(state.age);
    return CS.DATA.fun.tongueTwisters.filter((t) => pool.includes(t.age));
  }
  function poolBrainTeasers() {
    const pool = agePool(state.age);
    return CS.DATA.fun.brainTeasers.filter((b) => pool.includes(b.age));
  }
  function poolAntonyms() {
    const pool = agePool(state.age);
    return CS.DATA.fun.antonyms.filter((a) => pool.includes(a.age));
  }
  function poolIdioms() {
    const pool = agePool(state.age);
    return CS.DATA.fun.idioms.filter((i) => pool.includes(i.age));
  }
  function poolAnimalSounds() {
    const pool = agePool(state.age);
    return CS.DATA.fun.animalSounds.filter((a) => pool.includes(a.age));
  }

  /* 按年龄出算术题 */
  function genMathQ() {
    const ri = (n) => Math.floor(Math.random() * n);
    let text, answer;
    if (state.age === 'a1') {
      const n = 2 + ri(4);
      text = pick(['🍎', '⭐', '🐟', '🍭', '🎈', '🧸']).repeat(n) + ' 数一数，一共有几个呀？';
      answer = n;
    } else if (state.age === 'a2') {
      if (Math.random() < 0.5) {
        const a = 1 + ri(8), b = 1 + ri(9 - a);
        text = a + ' 加 ' + b + ' 等于几呀？'; answer = a + b;
      } else {
        const a = 3 + ri(7), b = 1 + ri(a - 1);
        text = a + ' 减 ' + b + ' 等于几呀？'; answer = a - b;
      }
    } else if (state.age === 'a3') {
      if (Math.random() < 0.5) {
        const a = 2 + ri(8), b = 2 + ri(8);
        text = a + ' 乘 ' + b + ' 等于几呀？'; answer = a * b;
      } else {
        const a = 15 + ri(75), b = 10 + ri(60);
        text = a + ' 加 ' + b + ' 等于几呀？'; answer = a + b;
      }
    } else {
      if (Math.random() < 0.5) {
        const a = 12 + ri(80), b = 3 + ri(7);
        text = a + ' 乘 ' + b + ' 等于几呀？'; answer = a * b;
      } else {
        const a = 120 + ri(800), b = 60 + ri(400);
        text = a + ' 加 ' + b + ' 等于几呀？'; answer = a + b;
      }
    }
    return { text, answer };
  }

  /* ---------- 游戏启动器 ---------- */
  function startRiddle() {
    const riddles = poolRiddles();
    if (!riddles.length) return null;
    const r = pick(riddles);
    game = { type: 'riddle', answer: r.answer, hint: r.hint, tries: 0 };
    return '好呀，猜谜语！听好哦：' + r.q + '\n（猜不出来就说"提示"）';
  }

  function startNumberGame() {
    game = { type: 'number', target: 1 + Math.floor(Math.random() * 100), min: 1, max: 100, tries: 0 };
    return '好呀，我们来猜数字！我心里想了一个 1 到 100 的数字，你来猜！\n（猜不出来就说"提示"）';
  }

  function startRPS() {
    game = { type: 'rps', wins: 0, losses: 0, rounds: 0 };
    return '好呀，石头剪刀布！你说"石头""剪刀"或"布"，我们开始吧！';
  }

  function startAntonym() {
    const antonyms = poolAntonyms();
    if (!antonyms.length) return null;
    const a = pick(antonyms);
    game = { type: 'antonym', word: a.word, answer: a.answer, tries: 0 };
    return '好呀，反义词对对碰！我说一个词，你说它的反义词！\n第一个词：「' + a.word + '」的反义词是什么？';
  }

  function startIdiom() {
    const idioms = poolIdioms();
    if (!idioms.length) return null;
    const i = pick(idioms);
    game = { type: 'idiom', emoji: i.emoji, answer: i.answer, hint: i.hint, tries: 0 };
    return '好呀，看emoji猜成语！' + i.emoji + ' 这是什么成语呢？\n（猜不出来就说"提示"）';
  }

  /* ---------- 游戏作答判定 ---------- */
  function handleGameAnswer(t) {
    const g = game;
    if (/不玩|退出|结束|算了|不猜/.test(t)) {
      game = null;
      return '好的，不玩啦！想玩的时候随时叫我哦！';
    }

    if (g.type === 'math') {
      const n = extractNum(t);
      if (n !== null) {
        if (Math.abs(n - g.answer) < 0.001) {
          game = null;
          return pick([
            '答对啦！' + g.text.replace('呀？', '') + ' 就是 ' + g.answer + '，你真棒！⭐ 再来一题吗？说"出题"就行！',
            '哇，全对！' + g.answer + ' 完全正确！你是不是小数学家呀？😄 想继续就说"出题"！'
          ]);
        }
        g.tries = (g.tries || 0) + 1;
        if (g.tries >= 2) {
          game = null;
          return '没关系！答案是 ' + g.answer + ' 哦。数学闯关里能练好多题，我们一起加油！💪';
        }
        return '再想一想～' + g.text;
      }
      game = null;
    }

    if (g.type === 'riddle') {
      if (/提示|不知道|不会/.test(t)) {
        return '提示：' + g.hint + '\n再想想看！';
      }
      if (t.includes(g.answer) || (g.answer.length > 1 && g.answer.includes(t))) {
        game = null;
        return '猜对啦！谜底就是「' + g.answer + '」，你真聪明！⭐ 还想玩吗？说"猜谜语"！';
      }
      g.tries = (g.tries || 0) + 1;
      if (g.tries >= 2) {
        game = null;
        return '没关系！谜底是「' + g.answer + '」哦。还想玩吗？说"猜谜语"！';
      }
      return '再想想～提示：' + g.hint;
    }

    if (g.type === 'number') {
      if (/提示|不知道|不会/.test(t)) {
        return '提示：在 ' + g.min + ' 到 ' + g.max + ' 之间哦！';
      }
      const n = extractNum(t);
      if (n !== null) {
        if (n === g.target) {
          game = null;
          return '猜对啦！就是 ' + g.target + '！你用了 ' + (g.tries + 1) + ' 次，真厉害！⭐ 还想玩吗？说"猜数字"！';
        }
        g.tries = (g.tries || 0) + 1;
        if (n < g.target) {
          g.min = Math.max(g.min, n + 1);
          return '太小啦！再大一点试试！（已经猜了 ' + g.tries + ' 次）';
        }
        g.max = Math.min(g.max, n - 1);
        return '太大啦！再小一点试试！（已经猜了 ' + g.tries + ' 次）';
      }
      game = null;
    }

    if (g.type === 'rps') {
      let userChoice = null;
      if (/石头|锤/.test(t)) userChoice = '石头';
      else if (/剪刀/.test(t)) userChoice = '剪刀';
      else if (/布/.test(t)) userChoice = '布';
      if (userChoice) {
        const choices = ['石头', '剪刀', '布'];
        const aiChoice = pick(choices);
        g.rounds = (g.rounds || 0) + 1;
        if (userChoice === aiChoice) {
          return '我出' + aiChoice + '，平局！再来一次？';
        }
        const win = (userChoice === '石头' && aiChoice === '剪刀') ||
                    (userChoice === '剪刀' && aiChoice === '布') ||
                    (userChoice === '布' && aiChoice === '石头');
        if (win) {
          g.wins = (g.wins || 0) + 1;
          return '我出' + aiChoice + '，你赢啦！🎉 比分 ' + g.wins + ':' + (g.losses || 0) + '，再来？';
        }
        g.losses = (g.losses || 0) + 1;
        return '我出' + aiChoice + '，我赢啦！😄 比分 ' + g.wins + ':' + g.losses + '，再来？';
      }
      game = null;
    }

    if (g.type === 'antonym') {
      if (t.includes(g.answer) || (g.answer.length > 1 && g.answer.includes(t))) {
        game = null;
        return '对啦！「' + g.word + '」的反义词就是「' + g.answer + '」，你真棒！⭐ 还想玩吗？说"反义词"！';
      }
      g.tries = (g.tries || 0) + 1;
      if (g.tries >= 2) {
        game = null;
        return '没关系！「' + g.word + '」的反义词是「' + g.answer + '」哦。还想玩吗？说"反义词"！';
      }
      return '再想想～「' + g.word + '」的反义词是什么呢？';
    }

    if (g.type === 'idiom') {
      if (/提示|不知道|不会/.test(t)) {
        return '提示：' + g.hint + '\n再想想看！';
      }
      if (t.includes(g.answer) || (g.answer.length > 1 && g.answer.includes(t))) {
        game = null;
        return '猜对啦！就是「' + g.answer + '」，你真厉害！⭐ 还想玩吗？说"成语"！';
      }
      g.tries = (g.tries || 0) + 1;
      if (g.tries >= 2) {
        game = null;
        return '没关系！答案是「' + g.answer + '」哦。还想玩吗？说"成语"！';
      }
      return '再想想～提示：' + g.hint;
    }

    if (g.type === 'teaser') {
      if (/提示|不知道|不会|放弃|答案/.test(t)) {
        game = null;
        return '哈哈，答案是：' + g.answer + ' 是不是很意外？还想玩吗？说"急转弯"！';
      }
      const a = normAns(g.answer), u = normAns(t);
      if (a && (u.includes(a) || (a.length > 1 && a.includes(u)))) {
        game = null;
        return '答对啦！答案就是' + g.answer + '你的小脑瓜转得真快！⭐ 还想玩吗？说"急转弯"！';
      }
      g.tries = (g.tries || 0) + 1;
      if (g.tries >= 2) {
        game = null;
        return '哈哈，答案是' + g.answer + '哦！脑筋急转弯就是要跳出常规想～还想玩吗？说"急转弯"！';
      }
      return '不对哦，再转转小脑筋试试！（说"不知道"可以看答案）';
    }

    /* 输入不是本游戏的有效作答（如玩着石头剪刀布却说"反义词"）：
       退出当前游戏，把这句话交还意图识别，让孩子无缝切换 */
    game = null;
    return localReply(t);
  }

  /* 从回答里抠数字（支持阿拉伯数字和 一~十） */
  function extractNum(t) {
    const m = /(-?\d+(?:\.\d+)?)/.exec(t);
    if (m) return parseFloat(m[1]);
    const zh = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const zhOnly = /^[\s，。！呀啊呢哦!]*(零|一|二|两|三|四|五|六|七|八|九|十)[\s，。！呀啊呢哦!]*$/.exec(t.trim());
    if (zhOnly) return zh[zhOnly[1]];
    return null;
  }

  /* 答案比对前清洗：去掉标点、emoji、空白，只留文字（急转弯答案带"水！💧"这类后缀） */
  function normAns(s) {
    return String(s || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  }

  /* 离线应答：返回字符串 */
  function localReply(text) {
    const t = String(text || '').trim();
    const name = CS.profile.name || '小朋友';
    const g = CS.AGE_GROUPS.find((x) => x.key === state.age);
    const ageLabel = g ? g.label : '';

    /* 1. 游戏作答判定（优先级最高） */
    if (game) {
      return handleGameAnswer(t);
    }

    /* 2. 讲故事 / 童话 */
    if (/讲|说.*(故事|童话)|故事|童话|睡前/.test(t)) {
      const stories = poolStories();
      if (stories.length) {
        const undone = stories.filter((s) => !state.done['story_' + s.id]);
        const s = pick(undone.length ? undone : stories);
        return '好呀！给你讲《' + s.title + '》：\n' + s.passage.join('\n') +
          '\n——讲完啦！这个故事告诉我们：' + s.moral + '\n去童话城堡答题还能赢星星哦 🏰';
      }
      return '我还在攒故事呢～先背首诗好不好？说"背诗"！📖';
    }

    /* 3. 背古诗 */
    if (/背|念.*(诗|古诗)|古诗|读诗|诗/.test(t)) {
      const poems = poolPoems();
      if (poems.length) {
        const p = pick(poems);
        return '我背《' + p.title + '》给你听，' + p.author + '写的：\n' + p.lines.join('，') + '。\n你会背这首吗？加油哦！📖';
      }
      return '古诗书还在路上呢～我们先唱首儿歌吧，说"唱歌"！🎵';
    }

    /* 4. 唱儿歌 */
    if (/唱|儿歌|歌/.test(t)) {
      const songs = poolSongs();
      if (songs.length) {
        const s = pick(songs);
        // 有简谱的真的弹起来 🎹
        if (s.melody && CS.playMelody) {
          CS.playMelody(s.melody.join(' '), s.bpm || 100);
        }
        return '我唱《' + s.title + '》给你听：\n' + s.lines.join('\n') + '\n🎵 好听吗？跟着一起唱吧！';
      }
      return '我的歌本还空着呢～要不我给你讲个童话？说"讲故事"！🏰';
    }

    /* 5. 数学出题 */
    if (/数学|算术|出题|考考我|加法|减法|乘法|除法|题目|算/.test(t)) {
      const q = genMathQ();
      game = { type: 'math', text: q.text, answer: q.answer, tries: 0 };
      return '好呀，听题！' + q.text + '\n大声告诉我答案吧！';
    }

    /* 5.5 猜谜语 */
    if (/谜语|猜谜|灯谜/.test(t)) {
      return startRiddle() || '我还在攒谜语呢～先玩别的吧！';
    }

    /* 5.6 猜数字 */
    if (/猜数字|猜数/.test(t)) {
      return startNumberGame();
    }

    /* 5.7 石头剪刀布 */
    if (/石头剪刀布|剪刀石头布/.test(t)) {
      return startRPS();
    }

    /* 5.8 反义词 */
    if (/反义词|对对碰/.test(t)) {
      return startAntonym() || '我还在攒反义词呢～先玩别的吧！';
    }

    /* 5.9 看emoji猜成语 */
    if (/成语|猜成语/.test(t)) {
      return startIdiom() || '我还在攒成语呢～先玩别的吧！';
    }

    /* 6. 问候 / 告别 / 感谢 */
    if (/^(你好|您好|嗨|哈喽|hi|hello|早上好|上午好|中午好|下午好|晚上好|早安|早呀)/i.test(t)) {
      return pick([
        '你好呀' + name + '！我是你的学习伙伴 ' + CS.profile.avatar + '，想聊天就点我，想喂我就给我吃的哦！',
        name + '你好！今天想背古诗、唱儿歌还是听童话呀？',
        '嗨，' + name + '！见到你真开心！😄'
      ]);
    }
    if (/再见|拜拜|晚安|睡觉/.test(t)) {
      return '再见啦！记得想我哦～ 睡前听个童话最舒服了，说"讲故事"！👋';
    }
    if (/谢谢|感谢/.test(t)) {
      return '不客气！能陪到你，我开心得尾巴都翘起来啦！😊';
    }

    /* 7. 关于我 / 宠物等级 / 投喂 */
    if (/你是谁|你叫什么|自我介绍|介绍.*自己/.test(t)) {
      return '我是你的学习伙伴 ' + CS.profile.avatar + ' 呀！会背古诗、唱儿歌、讲童话、算数学。你学习我就涨经验，喂我吃的我还能升级哦！';
    }
    if (/等级|升级|几级|经验|长大/.test(t)) {
      if (CS.pet) {
        const i = CS.pet.info();
        return '我现在是 Lv.' + i.level + ' ' + i.title + '！' +
          (i.max ? '已经是传说伙伴啦，谢谢你！🎉' : '再攒 ' + Math.max(1, i.need - i.exp) + ' 点经验就能升级，学习和投喂都涨经验哦！');
      }
      return '我们一起长大呀！';
    }
    if (/饿|饿不饿|吃什么|吃点|喂/.test(t)) {
      return '我的小肚子有点饿啦～聊天框上面有🍎🍪🎂，用星星喂我吧！学习赢星星，喂我涨经验！';
    }

    /* 8. 关于宝贝 */
    if (/我叫什么|我的名字|我是谁/.test(t)) {
      return CS.profile.name
        ? '你叫' + CS.profile.name + '呀，这个名字我最喜欢啦！'
        : '我还不知道你的名字呢，让爸爸妈妈在家长中心帮你建档吧！';
    }
    if (/几岁|多大|上.*年级|几年级/.test(t)) {
      return '你现在在读' + ageLabel + '呢，正是学本领的黄金时间！加油加油！💪';
    }
    if (/星星|多少星/.test(t)) {
      return '你现在有 ' + state.stars + ' 颗星星！⭐ 攒够了能换动画时间，也能用来喂我哦～';
    }

    /* 9. 情感互动 */
    if (/爱你|喜欢你|想你|抱抱/.test(t)) {
      return '我也超级超级喜欢你！陪你学习就是我最大的快乐！💕';
    }
    if (/难过|伤心|不开心|生气|委屈|哭/.test(t)) {
      return '抱抱你～ 不开心的时候，深呼吸三次，再听我讲个甜甜的童话好不好？说"讲故事"！🤗';
    }
    if (/棒|厉害|聪明|好乖/.test(t)) {
      return '嘿嘿，你也很棒呀！我们都是好样的！🌟';
    }

    /* 10. 趣味内容 */
    if (/笑话|搞笑|逗我笑/.test(t)) {
      const jokes = poolJokes();
      if (jokes.length) {
        const j = pick(jokes);
        return '好呀，给你讲个笑话：\n' + j.q + '\n' + j.a + '\n还想听吗？说"笑话"！';
      }
      return '我的笑话本还空着呢～要不我给你讲个童话？说"讲故事"！🏰';
    }

    if (/绕口令|舌头/.test(t)) {
      const tts = poolTongueTwisters();
      if (tts.length) {
        const tt = pick(tts);
        if (CS.speak) CS.speak(tt.text, { rate: 0.7 });
        return '好呀，绕口令来啦！慢慢读哦：\n' + tt.text + '\n你读对了吗？😄';
      }
      return '我的绕口令本还空着呢～要不我给你讲个笑话？说"笑话"！😂';
    }

    if (/动物.*叫|叫声|什么.*叫/.test(t)) {
      const animals = poolAnimalSounds();
      if (animals.length) {
        const a = pick(animals);
        return '听！' + a.animal + '在叫：' + a.sound + '\n你还知道什么动物的叫声吗？';
      }
      return '我的动物叫声本还空着呢～要不我给你讲个童话？说"讲故事"！🏰';
    }

    if (/脑筋急转弯|急转弯|动脑筋/.test(t)) {
      const teasers = poolBrainTeasers();
      if (teasers.length) {
        const b = pick(teasers);
        game = { type: 'teaser', answer: b.a, tries: 0 };
        return '好呀，脑筋急转弯！听好哦：' + b.q + '\n（想好了告诉我答案，猜不出来说"不知道"）';
      }
      return '我的脑筋急转弯本还空着呢～要不我给你讲个笑话？说"笑话"！😂';
    }

    /* 11. 生活小助手 */
    if (/几号|今天.*日期|日期|星期几|星期/.test(t)) {
      const now = new Date();
      const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return '今天是 ' + now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日，' + weekDays[now.getDay()] + ' 哦！📅';
    }

    if (/几点|现在.*时间|时间|钟/.test(t)) {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      return '现在是 ' + h + ' 点 ' + (m < 10 ? '0' + m : m) + ' 分！⏰';
    }

    if (/天气|下雨|晴天|温度/.test(t)) {
      return '我没办法直接看到外面的天气呢～你推开窗户看一看吧！如果下雨了记得带伞哦！☔';
    }

    if (/刷牙|洗脸|洗手|起床|喝水|好习惯|保护眼睛/.test(t)) {
      const h = new Date().getHours();
      if (h >= 21 || h < 6) {
        return '这么晚啦，该睡觉觉了哦！睡前刷牙洗脸，做个好梦！🌙';
      }
      if (h >= 19) {
        return '天快黑了，该吃晚饭啦！吃完饭记得刷牙哦！🦷';
      }
      if (h >= 15) {
        return '下午啦，记得喝点水，休息一下小眼睛！👀💧';
      }
      if (h >= 11) {
        return '快到中午啦，该吃午饭了！吃饭前要洗手哦！🍚🧼';
      }
      return '早上好呀！新的一天开始啦，记得刷牙洗脸吃早餐哦！🌞';
    }

    /* 12. 纯数字（没题却报数） */
    const n = extractNum(t);
    if (n !== null && t.replace(/[\s，。！呀啊呢哦0-9]/g, '').length === 0) {
      return '考我数学吗？还是想做题？说"出题"我就考你一道！🔢';
    }

    /* 11. 兜底 */
    return pick([
      '这个问题有点难倒我啦～不过我可是古诗、儿歌、童话、数学样样都会！想听哪个？',
      '嗯……让我想想……还是先给你讲个童话吧？说"讲故事"！🏰',
      '嘿嘿，我脑袋瓜里装满了古诗和童话～说"背诗"或"讲故事"试试！',
      '要不要休息一下小眼睛？然后我们背首诗，说"背诗"就行！👀'
    ]);
  }

  /* 离线聊天（模拟一点点思考时间，写入同一份历史） */
  async function chatLocal(userText) {
    await new Promise((r) => setTimeout(r, 450));
    const reply = localReply(userText);
    history.push({ role: 'user', content: userText });
    history.push({ role: 'assistant', content: reply });
    if (history.length > 40) history = history.slice(-40);
    store.set('aiHistory', history);
    return reply;
  }

  /* ---------- 语音输入（麦克风） ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let listening = false;

  function setMicUI(on) {
    const btn = $('#mchatMic');
    if (!btn) return;
    btn.classList.toggle('mic-on', on);
    btn.setAttribute('aria-label', on ? '正在听你说' : '按一下说话');
  }

  function toggleMic() {
    if (listening) {
      try { rec && rec.stop(); } catch (e) { /* 忽略 */ }
      return;
    }
    if (!SR) { CS.toast('当前浏览器不支持语音输入'); return; }
    rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    listening = true;
    setMicUI(true);
    CS.sfx && CS.sfx.tap();
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      const input = $('#mchatInput');
      if (input && said) { input.value = said; send(); }
    };
    rec.onerror = () => { listening = false; setMicUI(false); };
    rec.onend = () => { listening = false; setMicUI(false); };
    try { rec.start(); } catch (e) { listening = false; setMicUI(false); }
  }

  /* ---------- 聊天面板 ---------- */
  function quickList() {
    return CS.ai.on
      ? ['讲个有趣的小知识', '陪我背古诗', '给我出道数学题', '唱首儿歌吧', '猜谜语', '讲个笑话', '石头剪刀布', '今天几号']
      : ['讲个童话故事', '背首古诗', '给我出道数学题', '唱首儿歌', '猜谜语', '讲个笑话', '石头剪刀布', '今天几号'];
  }

  let chatEl = null;
  let busy = false;

  function bubble(who, text) {
    return '<div class="mchat-msg ' + (who === 'me' ? 'mchat-me' : 'mchat-ai') + '">' +
      esc(text).replace(/\n/g, '<br>') + '</div>';
  }

  function renderMsgs() {
    const box = $('#mchatMsgs');
    if (!box) return;
    let html = '';
    if (!history.length) {
      html += bubble('ai', CS.ai.on
        ? '你好呀！我是你的学习伙伴' + CS.profile.avatar + '，\n问我问题、让我讲故事都可以哦！'
        : '你好呀' + (CS.profile.name ? '，' + CS.profile.name : '') + '！我会讲童话、背古诗、唱儿歌、出数学题！\n按 🎤 对我说话，或点下面的按钮～');
    }
    history.forEach(function (m) {
      html += bubble(m.role === 'user' ? 'me' : 'ai', m.content);
    });
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }

  function setThinking(on) {
    const box = $('#mchatMsgs');
    if (!box) return;
    const t = $('#mchatThink');
    if (on && !t) {
      box.insertAdjacentHTML('beforeend',
        '<div class="mchat-msg mchat-ai mchat-think" id="mchatThink">' +
        CS.profile.avatar + ' 正在思考…</div>');
      box.scrollTop = box.scrollHeight;
    } else if (!on && t) t.remove();
  }

  async function send() {
    if (busy) return;
    const input = $('#mchatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const box = $('#mchatMsgs');
    box.insertAdjacentHTML('beforeend', bubble('me', text));
    box.scrollTop = box.scrollHeight;
    busy = true;
    setThinking(true);
    try {
      const reply = CS.ai.on ? await chat(text) : await chatLocal(text);
      setThinking(false);
      box.insertAdjacentHTML('beforeend', bubble('ai', reply));
      box.scrollTop = box.scrollHeight;
      CS.sfx && CS.sfx.star();
      // 语音播报回复（去掉 markdown 符号，方便 TTS 朗读）
      CS.speak && CS.speak(String(reply).replace(/[*#`_>~|]/g, ''));
    } catch (e) {
      setThinking(false);
      let hint;
      if (e && e.name === 'AbortError') hint = '请求超时了';
      else if (/Failed to fetch|NetworkError/i.test(String(e && e.message))) hint = '网络连不上';
      else hint = (e && e.message) || String(e);
      const errMsg = '哎呀，我脑子转不动啦（' + hint + '）。\n请爸爸妈妈到家长中心检查 AI 设置哦';
      box.insertAdjacentHTML('beforeend', bubble('ai', errMsg));
      box.scrollTop = box.scrollHeight;
      CS.speak && CS.speak('哎呀，我脑子转不动啦，请爸爸妈妈到家长中心检查一下设置哦');
    } finally {
      busy = false;
    }
  }

  function closeChat() {
    if (chatEl) chatEl.remove();
    chatEl = null;
    if (listening) { try { rec && rec.stop(); } catch (e) { /* 忽略 */ } }
    CS.stopSpeak && CS.stopSpeak();
  }

  function openChat() {
    if (chatEl) { closeChat(); return; }
    chatEl = document.createElement('div');
    chatEl.className = 'mascot-chat';
    chatEl.innerHTML =
      '<div class="mchat-head">' +
      '<span class="mchat-avatar">' + CS.profile.avatar + '</span>' +
      '<span class="mchat-title">我的学习伙伴' +
      '<i class="mchat-mode">' + (CS.ai.on ? 'AI 问答' : '伙伴模式') + '</i></span>' +
      '<button class="mchat-close" id="mchatClose" aria-label="关闭聊天">✕</button></div>' +
      (CS.pet ? CS.pet.barHTML() : '') +
      '<div class="mchat-msgs" id="mchatMsgs"></div>' +
      '<div class="mchat-quick" id="mchatQuick">' +
      quickList().map(function (q) {
        return '<button class="tab-btn" data-q="' + esc(q) + '">' + esc(q) + '</button>';
      }).join('') + '</div>' +
      '<div class="mchat-input-row">' +
      (SR ? '<button class="mchat-mic" id="mchatMic" aria-label="按一下说话" title="按一下说话">🎤</button>' : '') +
      '<input class="form-input" id="mchatInput" maxlength="100" ' +
      'placeholder="和' + CS.profile.avatar + '说点什么…">' +
      '<button class="btn btn-primary" id="mchatSend">发送</button></div>';
    document.body.appendChild(chatEl);
    renderMsgs();
    CS.pet && CS.pet.bindBar();
    $('#mchatClose').onclick = closeChat;
    $('#mchatSend').onclick = send;
    if (SR) $('#mchatMic').onclick = toggleMic;
    $('#mchatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') send();
    });
    chatEl.querySelectorAll('#mchatQuick [data-q]').forEach(function (b) {
      b.onclick = function () {
        $('#mchatInput').value = b.getAttribute('data-q');
        send();
      };
    });
    // TV/遥控器环境才自动聚焦（手机上自动弹键盘体验差）
    if (window.matchMedia && matchMedia('(pointer: none)').matches) {
      setTimeout(function () { $('#mchatInput').focus(); }, 120);
    }
  }

  CS.openMascotChat = openChat;
  CS.closeMascotChat = closeChat;
})(window.CS);
