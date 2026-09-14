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
- 现有模块：home / more / poem / literacy / song / text / craft / math / cartoon（动画小剧场）/ parent（家长中心）

## 内容数据规范（js/data/）

- 所有条目带 `age: 'a1'|'a2'|'a3'|'a4'` 标签，渲染时按 `CS.agePool(state.age)` 过滤
- **poems**：`{id, age, title, author, dynasty, lines[], pinyin[][]?, desc, tier?}`；pinyin 为每句逐字注音，a1/a2 提供；`tier: 'extra'` 为扩展诗，需同年龄核心诗全部闯关后才解锁显示，实现渐进式扩库
- **characters**：`{a1: [{char, py, word, emoji, sent}], a3/a4: 词/成语无 word}`
- **songs**：`{lines[], melody[]?, bpm}`；melody 每行一段简谱
- **texts**：`{passage[], quiz: [{q, opts[], ans}]}`（原创内容，避免教材版权）
- **crafts**：`{materials[], steps: [{title, desc, emoji}], tip}`
- **cartoons**：内置小剧场 `{id, type:'scene', scene, emoji, title, desc}`；自定义链接由家长在家长中心添加，存于 `state.cartoons`
- **mathgen**：程序化出题 `makeRound(ageKey, count)`，RECIPES 定义各年龄题型组合

## 新增内容指引

- 加一首古诗：在 `poems.js` 追加对象即可（低龄需提供 pinyin 数组）
- 加一首能弹的儿歌：`songs.js` 加 `melody`（简谱字符串数组，与 lines 等长）
- 加课目/手工：同上，保持 id 唯一、age 标签正确

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
