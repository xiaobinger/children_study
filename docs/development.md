# 开发文档

## 架构概览

单页应用（SPA），hash 路由，零依赖经典脚本（非 ES Module，保证 `file://` 协议直接打开可用）。所有模块挂载在全局命名空间 `window.CS` 下。

```
index.html
  └─ 依序加载：
     js/data/*.js   → CS.DATA.*（纯内容数据）
     js/core.js     → 工具/存储/状态/路由
     js/audio.js    → 音频引擎
     js/ui.js       → 共享 UI 组件
     js/xiaoai.js   → 小爱音箱联动（配置/播报/提醒计时器）
     js/modules/*.js→ CS.register('路由名', 渲染函数)
     js/main.js     → 启动
```

## 核心机制

### 路由（core.js）
- `CS.register(name, renderFn)` 注册路由；`CS.navigate(name, params)` 跳转
- hash 形如 `#/poem?id=p1`；`render()` 解析后调用对应渲染函数
- 每次切换路由会统一 `CS.stopMelody()` + `CS.stopSpeak()`，防止声音残留
- 路由名与模块页面一一对应；模块内部列表/详情由同一 renderFn 按 `params.id` 分发

### 状态与存储（core.js）
- `CS.state`：`age`（a1-a4）、`stars`、`sound`、`eyeCare`、`restOn`、`done`（完成标记字典）、`profile`（宝贝档案）、`reward`（兑换规则 `{stars, minutes}`）、`cartoonMins`（剩余动画分钟）、`cartoons`（自定义动画链接）、`pin`（家长密码）
- `CS.xiaoai`：小爱音箱联动（`cfg` 配置对象、`update(patch)`、`say(text)`、`praise(n)`、`levelup()`、`status()`、`devices()`），配置存于 `cs_xiaoai` localStorage 键
- 奖励辅助 `CS.reward`：`exchange()` 扣星加时长、`setRule()` 改规则、`tickMins()` 倒计时；`CS.profile.save()` 建档（填生日自动算年龄组）
- localStorage 前缀 `cs_`

### 音频（audio.js）
- `CS.sfx.*`：tap/correct/wrong/star/finish 短音效（Web Audio 合成）
- `CS.parseMelody('1 1 5 5 6 6 5 -', bpm)`：简谱字符串 → 事件列表；`1+` 高八度、`5_` 低八度、`-` 延长
- 旋律调度实际由 song.js 自行完成（需要逐行高亮，故逐行 parseMelody 后累加偏移）
- `CS.speak(text)`：SpeechSynthesis 中文朗读；`CS.getMuted()/setMuted()` 控制全局静音

### 共享 UI（ui.js）
- `CS.showModal / hideModal / toast / confettiBurst`
- `CS.showResult({emoji, title, msg, stars, onAgain, onBack})`：统一结算弹窗，**内部负责加星星**——模块不要再手动 `addStars`（曾因此出现儿歌双倍星星 bug）
- `CS.rest`：护眼休息提醒（20 分钟周期，5 秒粒度轮询）
- `CS.initTopbar()`：顶栏四件套 + 底部导航绑定

### 模块约定（js/modules/）
- 渲染函数签名 `(view, params)`，直接写 `view.innerHTML`
- 数据均为静态作者内容，动态值一律过 `CS.esc()` 转义
- 游戏通用模式：轮次循环 → 锁 `locked` 防连点 → 正误反馈动画（.correct/.wrong）→ 结束调 `CS.showResult`
- 现有模块：home / more / poem / literacy / song / text / story（童话城堡）/ craft / math / cartoon（动画小剧场）/ parent（家长中心，含小爱音箱配置卡）

## 内容数据规范（js/data/）

- 所有条目带 `age: 'a1'|'a2'|'a3'|'a4'` 标签，渲染时按 `CS.agePool(state.age)` 过滤
- **poems**：`{id, age, title, author, dynasty, lines[], pinyin[][]?, desc, tier?}`；pinyin 为每句逐字注音，a1/a2 提供；`tier: 'extra'` 为扩展诗，需同年龄核心诗全部闯关后才解锁显示，实现渐进式扩库
- **characters**：`{a1: [{char, py, word, emoji, sent}], a3/a4: 词/成语无 word}`
- **songs**：`{lines[], melody[]?, bpm}`；melody 每行一段简谱
- **texts**：`{passage[], quiz: [{q, opts[], ans}]}`（原创内容，避免教材版权）
- **stories**：`{id, age, emoji, title, passage[], quiz: [{q, opts[], ans}], moral}`（原创童话；moral 道理框在答完题前锁定显示 🔒）
- **crafts**：`{materials[], steps: [{title, desc, emoji}], tip}`
- **cartoons**：内置小剧场 `{id, type:'scene', scene, emoji, title, desc}`；自定义链接由家长在家长中心添加，存于 `state.cartoons`
- **mathgen**：程序化出题 `makeRound(ageKey, count)`，RECIPES 定义各年龄题型组合
- **fun**：趣味内容库 `{riddles[], jokes[], tongueTwisters[], brainTeasers[], antonyms[], idioms[], animalSounds[]}`，每项含 `age` 标签和内容字段，按年龄分层供 `ai.js` 抽取

## 宠物系统（animal.js / pet.js / ai.js）

- **animal.js**：12 种动物 SVG 渲染器 + 9 种步态（ANIMAL_GAITS），宠物在页面底部随机漫步
- **pet.js**：等级成长系统，`CS.pet` 暴露 `info()/gainExp(n)/feed(idx)/barHTML()/bindBar()/updateBadge()`
  - 10 级成长线：蛋宝宝 → 破壳啦 → … → 传说伙伴；`expNeed(level) = level * 20`
  - 投喂食物：🍎 苹果 3⭐=15exp、🍪 饼干 5⭐=30exp、🎂 蛋糕 10⭐=60exp
  - 学习得星自动涨经验：`core.js` 的 `state.addStars()` 内部调用 `CS.pet.gainExp(n)`
  - 升级触发撒花 + 语音播报 + `cs:pet-levelup` 事件（首页监听刷新）
- **ai.js**：离线对话大脑（无需配置 AI）——意图识别支持算术问答（多轮追问）、讲童话、背古诗、唱儿歌、出数学题、问候/告别、情感陪伴；配置 AI 后自动切换为真 AI 问答模式
  - 语音输入：Web Speech Recognition（`browser_click` 麦克风按钮切换监听，`mic-on` 类显示脉冲动画）
  - 语音输出：复用 `CS.speak()`，与 Edge TTS 预生成音频管线兼容
- **点击热区**：`.mascot` 容器 `pointer-events: none`（避免漫步的宠物挡住页面按钮），内部 `.pet-hit` 圆形热区 `pointer-events: auto` 接收点击

## 小爱音箱联动（xiaoai.js / xiaoai_bridge.py）

### 桥接服务（tools/xiaoai_bridge.py）
- Python HTTP 服务（`ThreadingHTTPServer`），默认端口 8899
- 底层用 `miservice_fork` 库登录小米账号并调用小爱 TTS；浏览器直连小米云受 CORS 限制，必须经本机桥接转发
- 接口：`GET /status`（服务状态）、`GET /devices`（音箱列表）、`GET /say?text=…&device=…`（播报）
- 演示模式 `--mock`：无需账号，播报内容只打印到窗口；真实模式需 `--user/--password` 或环境变量 `MI_USER/MI_PASS`
- 首次登录生成 `~/.mi.token` 缓存，后续免密

### 前端模块（js/xiaoai.js）
- 配置项：`on`（总开关）、`url`（桥接地址）、`device`（指定音箱 ID）、`praise`（得星表扬）、`levelup`（升级播报）、`remind`（定时提醒）、`remindTimes`（提醒时间数组）
- `update(patch)` 每次替换整个 `cfg` 对象（`Object.assign({}, cfg, patch)`），**闭包捕获旧引用会过期**——`readForm()` 必须实时读取 `CS.xiaoai.cfg`
- 得星表扬：900ms 防刷屏合并，语音含宝贝昵称（`CS.profile.name`）
- 宠物升级：监听 `cs:pet-levelup` 事件自动播报
- 定时提醒：每 20 秒检查 HH:mm，`fired` 字典按天去重
- 播报失败静默（`catch(() => false)`），不弹窗打扰孩子

### 家长中心配置卡（parent.js → tabXiaoai）
- 桥接地址输入、音箱下拉（`CS.xiaoai.devices()` 拉取）、三个独立开关、两个提醒时间输入
- `readForm()` 实时读取 `CS.xiaoai.cfg`，toggle 处理器用 `readForm()` 返回值取反

## 闭包过期变量修复（v1.5.0）

**问题**：`tabXiaoai()` 和 `tabAI()` 的 `readForm()` 在渲染时捕获了 `cfg` 对象引用，但 `update()` / `save()` 每次更新都替换整个对象，导致闭包持有旧引用读到过期状态。

**修复**：
- `readForm()` 内改为每次实时读取 `CS.xiaoai.cfg` / `state.ai`
- toggle 处理器改用 `readForm()` 返回的 `cur` 取反（`!cur.praise` 而非 `!c.praise`）
- `parent.js` 加 `?v=1.5.0` 查询字符串强制浏览器加载修复版

## 新增内容指引

- 加一首古诗：在 `poems.js` 追加对象即可（低龄需提供 pinyin 数组）
- 加一首能弹的儿歌：`songs.js` 加 `melody`（简谱字符串数组，与 lines 等长）
- 加课目/手工：同上，保持 id 唯一、age 标签正确
- 加一篇童话：`stories.js` 追加对象（id 唯一、2-3 道理解题、一句 moral）；语音任务导出工具已支持 story 分类

## 已知限制

- SpeechSynthesis 音色依系统而异；file:// 协议下 Firefox 朗读可能不可用
- 伴奏为单音轨合成音，非原曲录音（版权考虑）
- IE 不支持（使用了 CSS 变量、grid、optional chaining 等 modern 特性）

## 本地验证清单（发布前）

1. 双击 `index.html` 能正常打开，控制台无报错
2. 顶栏：年龄切换 → 内容数量变化；护眼开关 → 暖色主题且刷新后保持
3. 六模块各跑一局：正确/错误路径、结算弹窗、星星累加
4. 儿歌：伴奏播放、逐行高亮、播完结算仅加 1 星
5. 手机宽度（≤600px）：底部导航出现、无横向滚动
6. 连续 20 分钟后休息提醒弹出、可关闭
7. 小爱音箱：家长中心配置卡渲染正常，外部修改 `cfg` 后 toggle 读取实时值（v1.5.0 闭包修复验证）
8. 学习小伙伴：12 类互动场景各触发一次，快捷按钮点击正常
