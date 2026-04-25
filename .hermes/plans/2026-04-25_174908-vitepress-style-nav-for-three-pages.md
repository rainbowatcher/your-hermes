# 给三个页面加一个导航区（参考 VitePress 格局）计划

## 目标

为 `your-hermes` 的三个主页面补一个共享导航区，覆盖：

- `/sessions/:sessionId?`
- `/skills`
- `/inspect/memory`

导航的设计方向参考 VitePress 首页首屏顶部的格局，但要结合当前应用的 inspect/workbench 属性，避免变成一个过重、过高、抢占内容空间的“第二条工具栏”。

## 最新用户反馈

1. 设计方向上，希望更接近 **VitePress 的格局**，而不是随意加一排 tab。
2. UI 评审时不要再发“巨长”的整页截图；后续验收应优先：
   - 浏览器首屏观察
   - 聚焦顶部局部的视觉判断
   - 文字化结论
   - 如确需截图，只截顶部局部视口

## 已检查的上下文

### 1. 当前代码结构

- 全局壳层：`src/App.vue`
- 共享导航组件：`src/components/AppNavigation.vue`
- 路由：`src/router/index.ts`
- 三个目标页面：
  - `src/views/SessionHistoryView.vue`
  - `src/views/SkillManagementView.vue`
  - `src/views/MemoryInspectView.vue`
- 现有上层 browser test：`src/App.browser.test.ts`

### 2. 当前已落地方案的现状

当前仓库里已经有一个轻量导航条雏形：

- 放在 `src/App.vue` 顶部
- 导航本体在 `src/components/AppNavigation.vue`
- 采用内容区 tab strip 风格：
  - `bg-transparent`
  - `border-b`
  - active 项用 `border-b-2`
- 三个页面根容器都已是 `h-full`，没有继续使用内层 `h-screen`

这说明“共享导航放在全局壳层，而不是各页面各写一份”这个方向已经成立。

### 3. 浏览器观察结论

#### VitePress 首页

对 `https://vitepress.dev/` 的首屏顶部观察后，可提炼出这些特征：

- 顶栏是**全站级结构**，不是页面内局部 tab
- 视觉上很轻：
  - 高度克制
  - 品牌、导航、右侧操作分区明确
  - 不用厚重卡片感去抢正文
- 它之所以像“站点头部”，关键不在复杂装饰，而在：
  - 横跨全宽
  - 信息层级稳定
  - 与正文之间有明确但克制的分隔
  - 导航文字本身比容器更重要

#### 当前 your-hermes 页面首屏

以 `/skills`、`/sessions` 的首屏顶部结构为准：

- 共享导航高度约 51px
- 下方页面工具栏（如搜索框）距离导航底部约 8px
- 当前观感更像“**内容区内的轻量 tab strip**”，而不是“**VitePress 式站点头部**”
- 原因不是组件错了，而是当前导航：
  - 没有品牌/应用身份锚点
  - 没有把“全站级导航”和“页面级工具栏”做出足够清晰的层级区分
  - 与下方工具栏距离太近，容易读成“第一条筛选栏”而非“应用导航”

## 设计判断

如果直接照搬 VitePress 官网头部，会有两个风险：

1. **过度站点化**：your-hermes 是工作台/inspect 应用，不是文档站首页。
2. **双层头部冲突**：三个页面本身已经有搜索、筛选、刷新、主题切换等工具栏，再叠一个重头部会压缩首屏有效内容。

因此更合适的方向是：

> 借 VitePress 的“全局头部层级感”，但保持当前导航的“轻量、克制、低高度”。

也就是说，不做完整文档站 masthead，而是做一个 **VitePress 风格的轻量全局顶栏**：

- 全局性明确
- 视觉尽量薄
- 不与页面内 toolbar 抢层级
- 让用户一眼知道这是“页面切换导航”，不是“当前页筛选器”

## 建议方案

### 方案核心

在现有 `src/components/AppNavigation.vue` 基础上，向 **VitePress 风格的轻量站点头部** 微调，而不是推翻重做。

### 应抽取的 VitePress 布局特征

1. **全宽顶部区**
   - 导航应明确是全局 app shell 的一部分
   - 横跨应用宽度，而非嵌在某个页面局部卡片里

2. **左侧应用身份 + 中间/右侧导航项**
   - 可增加一个非常轻的品牌位，例如：
     - `your-hermes`
     - 或一个极简 product label
   - 这样能把它从“单纯 tab”提升为“应用顶栏”

3. **弱背景 / 细分隔 / 低高度**
   - 仍保持透明或近透明背景
   - 使用细底边或轻微毛玻璃/浅层背景，而不是厚重卡片边框
   - 控制高度，避免占据首屏

4. **active 状态以文字/下划线为主**
   - 保持当前 `border-b-2` 这一类低干扰表达
   - 不建议改成高饱和胶囊按钮

5. **页面工具栏退回内容层**
   - 导航表达“去哪儿”
   - 下方 toolbar 表达“在这里做什么”
   - 两层语义要分清

## 分步实施计划

### 第 1 步：重新定义导航层级目标

明确共享导航的定位：

- 它是 **app-level navigation**，不是 page-level filter bar
- 视觉目标是“VitePress 风格的轻量站点头部”
- 不是复制 VitePress 文档站首页的完整结构

### 第 2 步：调整 `src/components/AppNavigation.vue`

重点改这里，而不是分散到三个页面。

预期调整点：

- 在导航内加入轻量品牌区/标题区
- 将三项导航组织成更像“站点导航”的横向结构
- 保持 active 下划线表达
- 优化内边距、对齐和间距，让它更像顶栏而不是内容前置 tab
- 如果需要，引入一个内层 wrapper：
  - 控制最大宽度/左右对齐
  - 让顶栏结构更接近 VitePress

### 第 3 步：微调 `src/App.vue`

确认全局壳层是否需要：

- 为导航和 RouterView 之间建立更稳定的层级关系
- 必要时让导航容器承担顶层背景/分隔
- 保持内容区 `overflow-hidden` 和 `h-screen` 外壳不变

### 第 4 步：检查三个页面顶部工具栏的衔接

目标文件：

- `src/views/SessionHistoryView.vue`
- `src/views/SkillManagementView.vue`
- `src/views/MemoryInspectView.vue`

检查项：

- 导航下方是否仍显得过挤
- 首个 toolbar/header 是否需要微调顶部 spacing
- 是否存在重复分隔线
- 是否有页面看起来像“导航 + 工具栏 + 又一条工具栏”

这里只做为导航让位的最小必要样式协调，不扩散修改页面业务结构。

### 第 5 步：更新上层 browser test

目标文件：

- `src/App.browser.test.ts`

需要更新/补充的断言：

- 导航仍存在且可跨路由切换
- active 状态仍正确
- 新的品牌区/标题区可见（如果采用）
- 断言应匹配“轻量站点头部”风格，而不是旧的纯 tab-strip 结构

### 第 6 步：浏览器验收

验收方式应改为“局部首屏观察 + 文字结论”，避免再输出长截图。

必看页面：

- `/sessions`
- `/skills`
- `/inspect/memory`
- 必要时对照 `https://vitepress.dev/`

验收重点：

- 是否一眼能识别为全局导航
- 是否没有压缩主要工作区
- 是否仍保留 inspect/workbench 应用的轻量感
- 是否避免与页面内搜索栏、筛选栏混淆

## 可能改动的文件

高概率：

- `src/App.vue`
- `src/components/AppNavigation.vue`
- `src/App.browser.test.ts`

低到中概率（仅在需要轻微衔接调整时）：

- `src/views/SessionHistoryView.vue`
- `src/views/SkillManagementView.vue`
- `src/views/MemoryInspectView.vue`

## 测试与验证

代码完成后建议执行：

```bash
npm run fmt:check
npm run lint
npm run build
git diff --check
npm test
npm run test:browser
```

如果只是小幅 class 调整，重点关注：

- `src/App.browser.test.ts`
- 受导航影响的 browser tests
- 实际浏览器首屏观感

## 风险与权衡

### 风险 1：做得太像站点头部

会让工作台应用显得“文档站化”，削弱工具属性。

**控制方式：**
只借鉴层级和布局语言，不复制 hero/header 装饰。

### 风险 2：做得太轻，用户仍觉得只是 tab

即便结构上是全局导航，视觉上仍可能被读成页面局部切换。

**控制方式：**
通过品牌位、对齐方式、分隔层级来增强“app shell”感。

### 风险 3：与页面 toolbar 叠层

导航和页面头部距离太近，会像两条工具栏。

**控制方式：**
重点校正导航底部与页面 header 的 spacing、边界和视觉职责。

## 开放问题

1. 左侧品牌位是否只显示 `your-hermes` 文本，还是需要一个更产品化的标题？
2. 顶栏是否保留完全透明背景，还是增加极轻的背景层/模糊层来强化全局头部身份？
3. 右侧是否需要承载全局操作（例如主题切换），还是继续保留在各页面 toolbar 内？
   - 按当前低风险原则，第一轮更建议 **先不搬全局操作**，只处理导航层级。

## 推荐执行顺序

1. 先改 `AppNavigation.vue`
2. 再看是否需要补 `App.vue` 的壳层调整
3. 最后只对三个页面做最小衔接修正
4. 更新 `App.browser.test.ts`
5. 用浏览器逐页首屏验收，不发长截图
