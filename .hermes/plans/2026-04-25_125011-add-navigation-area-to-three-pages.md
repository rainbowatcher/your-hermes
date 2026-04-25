# 给三个页面加一个导航区

## Goal

在 `your-hermes` 前端的三个主页面之间增加一个统一的页面导航区，让用户可以从任一页面快速切换到：

- 会话历史：`/sessions/:sessionId?`
- 技能管理：`/skills`
- 记忆 inspect：`/inspect/memory`

本计划只描述实现方式，不执行代码修改。

## Current context / assumptions

- 当前仓库：`/Users/rainbowatcher/w/i/your-hermes`。
- Vue Router 已有三个页面路由：
  - `src/router/index.ts`：`sessions`、`skills`、`memory-inspect`。
- 三个页面入口分别是：
  - `src/views/SessionHistoryView.vue`
  - `src/views/SkillManagementView.vue`
  - `src/views/MemoryInspectView.vue`
- 现有根组件 `src/App.vue` 只渲染 `<RouterView />`，还没有全局布局。
- 会话历史与技能管理已有页面级工具栏：
  - `src/components/history/HistoryToolbar.vue`
  - `src/components/skills/SkillsToolbar.vue`
- `MemoryInspectView.vue` 自带 header，但目前没有使用全局 theme store 的明暗切换按钮。
- `MemoryInspectView.vue` 当前根节点是 `flex h-screen min-h-0 flex-col bg-background text-foreground`，未显式声明根级 `overflow-hidden`；实现时应一并确认改成 `h-full` 后的滚动约束仍然稳定。
- `src/style.css` 已对 `html` / `body` / `#app` 设置 `height: 100%` 与 `overflow: hidden`，因此全局布局可以把视口高度控制收敛到 `App.vue`。
- `src/components/ui/` 是 shadcn vendored 目录，按项目约定不要修改。
- “三个页面加一个导航区”默认理解为为这三个页面添加同一个跨页面导航，而不是每个页面内部再各自做不同的信息导航。

## Proposed approach

优先采用全局布局方案：在 `src/App.vue` 中增加一个位于页面顶部的全局导航区，继续由 `RouterView` 承载页面内容。这里的“顶部”是普通 flex 布局中的顶部 header，而不是 CSS `position: fixed`；这样只需维护一个导航组件，三个页面天然共享，也避免 fixed 定位带来的内容遮挡和 offset 处理。

导航区建议拆成独立组件，例如 `src/components/AppNavigation.vue`：

- 使用 `RouterLink` 与 `useRoute()` 判断当前路由，展示 active 状态。
- 导航项集中声明，包含 `name`、`label`、`description`、`to`。
- active 判断与 `aria-current="page"` 都显式基于 `route.name`（而不是依赖 Vue Router 默认 exact-active 逻辑），这样 `/sessions/:sessionId?` 仍能稳定高亮“会话历史”。
- 对 active 项采用明确的 MVP 策略：**当前页不可再次触发跳转**。
  - 这不是仅仅“样式高亮”，而是行为上阻止当前页链接再次导航，避免 `/sessions/:id` 或 `/skills?path=...` 被重置为默认路由态。
  - 实现上可用非导航元素渲染 active 项，或使用 `RouterLink custom` + click prevention；不建议仅靠普通 `RouterLink`。
- 使用语义化 `<nav aria-label="主导航">`。
- 导航根节点使用 `shrink-0`，保持顶部 header 稳定，不挤压内容区域。
- 保持紧凑高度，适配当前桌面工作台布局。

由于三个页面当前都使用 `h-screen`，直接在 `App.vue` 顶部加导航会导致内容总高度超过视口。建议把页面根容器的高度从 `h-screen` 改为 `h-full`，并让 `App.vue` 外层负责 `h-screen` 与 `overflow-hidden`。同时，不依赖给 `<RouterView>` 直接加 class 再透传到页面根节点，而是显式增加一层布局容器，降低对 RouterView attribute forwarding 的耦合：

```vue
<template>
  <div class="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <AppNavigation class="shrink-0" />
    <div class="min-h-0 flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
```

然后三个页面的根节点改为 `h-full` / `min-h-0` 语义，避免双重全屏高度；其中 `MemoryInspectView.vue` 建议在根节点补上或保留 `overflow-hidden`，进一步降低页面级溢出风险。

## Step-by-step plan

1. **新增导航组件**
   - 新建 `src/components/AppNavigation.vue`。
   - 组件职责注释：负责全局主页面导航；不负责页面业务筛选、详情展示或数据加载。
   - 导航项建议：
     - `会话` → 默认 `{ name: 'sessions' }`
     - `技能` → 默认 `{ name: 'skills' }`
     - `记忆` → `{ name: 'memory-inspect' }`
   - 使用 `useRoute()` 根据 `route.name` 计算 active 状态。
   - active 状态除视觉样式外，还要显式输出 `aria-current="page"`。
   - active 样式与可访问状态都不要依赖 Vue Router 默认 exact-active class，而是显式按 `route.name` 计算。
   - 使用 `RouterLink` 渲染非 active 项，不使用普通 `<a>`，避免整页刷新。
   - 样式使用现有 Tailwind token：`border-border/70`、`bg-background`、`text-muted-foreground`、`bg-primary/10`、`text-foreground` 等。
   - 不修改 `src/components/ui/`。

2. **把 active 点击策略落实为可执行实现**
   - 本次 MVP 固定采用**策略 A：active 项不可再次跳转**，不再把它作为待定项。
   - 实现要求：
     - 在 `/sessions/:id` 时点击 active 的“会话”，URL 与当前选中 session 不变。
     - 在 `/skills?path=...` 时点击 active 的“技能”，URL 与当前 `path` 不变。
   - 推荐实现方式二选一：
     - **方式 A：active 项渲染为非链接元素**（如 `<span>` / `<button type="button">`，但不触发导航）。
     - **方式 B：`RouterLink custom` + 明确阻止 active 点击导航**。
   - 不建议使用普通 `RouterLink` 再仅靠样式区分 active，因为那样仍可能触发路由重置。

3. **接入到全局 App 布局**
   - 修改 `src/App.vue`：
     - import `AppNavigation`。
     - 外层添加 `flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground`。
     - 在 `RouterView` 之前渲染 `<AppNavigation class="shrink-0" />`。
     - 使用额外容器包住 `RouterView`，例如 `div.min-h-0.flex-1.overflow-hidden`，明确承接剩余高度。

4. **调整三个页面根容器高度**
   - `src/views/SessionHistoryView.vue`
     - 根节点从 `h-screen` 改为 `h-full`，保留 `min-h-0 flex-col overflow-hidden`。
     - 可以移除重复的 `bg-background text-foreground`，或保留以降低风险；若保留需确认不会影响布局。
   - `src/views/SkillManagementView.vue`
     - 同上，从 `h-screen` 改为 `h-full`。
   - `src/views/MemoryInspectView.vue`
     - `<main>` 从 `h-screen` 改为 `h-full`。
     - 同时补上或保留根级 `overflow-hidden`，避免依赖内部子容器偶然维持滚动边界。

5. **明确导航与页面选择状态的关系**
   - 不把导航项塞进 `HistoryToolbar.vue` / `SkillsToolbar.vue`，因为这些组件是页面业务工具栏（搜索、排序、主题切换、统计），而导航是全局应用级职责。
   - `MemoryInspectView.vue` 的 header 继续保留搜索、刷新、统计等页面内操作。
   - 明确技能页与会话页的默认选择行为：
     - 从其他页面点击“会话”进入 `{ name: 'sessions' }` 时，不主动保留上一条 sessionId，沿用现有页面自动选择逻辑。
     - 从其他页面点击“技能”进入 `{ name: 'skills' }` 时，同样会丢失当前 `?path=` 并由页面自动选择第一项；这是可接受的 MVP 行为，但要在风险中明确说明。
   - 仅对“当前已激活项再次点击”做保护，避免无意重置；不扩展为“跨页面记住最近访问上下文”。
   - 如果后续想保留最近 session / skill 选择，应单独引入最近访问状态，而不是在本次导航区实现中顺带扩展。

6. **补充浏览器测试：组件级 + App 集成级**
   - 保留 `src/components/AppNavigation.browser.test.ts`（新增）用于覆盖：
     - 渲染三个导航项。
     - 当前路由为 `/sessions` 或 `/sessions/<id>` 时，“会话”高亮。
     - active 项具有 `aria-current="page"`。
     - active 项再次点击不会改变当前 URL（至少覆盖 `/sessions/some-id` 与 `/skills?path=x`）。
     - 点击非 active 的“技能”进入 `/skills`。
     - 点击非 active 的“记忆”进入 `/inspect/memory`。
   - 另外新增一个更高层的集成测试，优先命名为 `src/App.browser.test.ts`，覆盖：
     - `App.vue` 已接入导航组件，而不是只测导航组件单独渲染。
     - 在 `/sessions/:id`、`/skills?path=...`、`/inspect/memory` 三类路由下都能看到导航区。
     - active 状态在真实路由切换下正确变化。
     - 顶层布局不会因为 `h-screen -> h-full` 调整而破坏页面结构。
     - body / html / #app 不出现额外滚动。
   - App 集成测试需要提前确定策略，避免测试过重：
     - **方案 1：轻量 memory router + stub views（推荐）**
       - 在测试里用 memory router 挂载 `App.vue`。
       - 路由组件用轻量 stub view，专门验证导航接线、active 状态与布局容器，不触发真实 store / fetch。
       - 适合作为 App 布局集成验证。
     - **方案 2：真实页面 + fetch mock**
       - 若必须覆盖真实页面行为，需要 mock 相关 API 请求与 store 依赖。
       - 成本更高，适合作为后续补充，不是本次 MVP 首选。
   - 推荐优先采用**方案 1**，把“导航接线/布局正确”与“页面真实数据加载”分层验证。

7. **验证真实页面回归**
   - 由于 `SessionHistoryView.vue`、`SkillManagementView.vue`、`MemoryInspectView.vue` 的根容器都会改动，不能只依赖 stub view 的 App 集成测试。
   - 除新测试外，还应回归执行受影响的现有 browser tests，至少包括：
     - `bun run test:browser -- src/views/SkillManagementView.browser.test.ts`
     - `bun run test:browser -- src/views/MemoryInspectView.browser.test.ts`
   - 若后续补上 `SessionHistoryView` 对应 browser test，也应纳入该变更的回归集。

8. **手动/自动验证布局**
   - 启动开发服务器时使用项目约定命令：
     - `HOME=/Users/rainbowatcher bun run dev -- --host 127.0.0.1`
   - 浏览器检查三个页面：
     - `/sessions`
     - `/skills`
     - `/inspect/memory`
   - 同时补查以下交互路径：
     - `/sessions/<id>` 下导航高亮仍为“会话”。
     - `/skills?path=<relativePath>` 下导航高亮为“技能”。
     - 点击当前已激活导航项时，URL 与页面选择状态保持不变。
     - 点击其他导航后再回到技能页时，`path` 是否被重置为第一页技能，并确认这符合 MVP 预期。
   - 确认：
     - 导航区在三个页面都出现。
     - active 状态正确。
     - 页面下方列表/详情区域仍能在剩余高度内滚动。
     - 不出现双滚动条或底部内容被导航区遮挡。
     - 不引入 body 级别的意外滚动。
     - 三个真实页面的主滚动区高度与滚动行为正常，尤其是 `MemoryInspectView.vue`。

## Files likely to change

- `src/App.vue`
  - 接入全局布局与导航组件，并增加承接剩余高度的容器。
- `src/components/AppNavigation.vue`
  - 新增全局页面导航组件。
- `src/views/SessionHistoryView.vue`
  - 根容器高度从全屏调整为填满父级剩余空间。
- `src/views/SkillManagementView.vue`
  - 同上。
- `src/views/MemoryInspectView.vue`
  - 同上，并补强根级滚动约束。
- `src/components/AppNavigation.browser.test.ts`（新增）
  - 覆盖导航渲染、active 状态、`aria-current`、active 点击保护和跳转。
- `src/App.browser.test.ts`（新增，或等价集成测试文件）
  - 覆盖 `App.vue` 接线、真实/模拟路由下导航显示与布局行为。

## Tests / validation

建议实施后运行：

```bash
bun run test:browser -- src/components/AppNavigation.browser.test.ts
bun run test:browser -- src/App.browser.test.ts
bun run test:browser -- src/views/SkillManagementView.browser.test.ts
bun run test:browser -- src/views/MemoryInspectView.browser.test.ts
bun run test:browser
bun run fmt:check
bun run lint
bun run build
```

如果只做最小验证，至少运行：

```bash
bun run test:browser -- src/components/AppNavigation.browser.test.ts
bun run test:browser -- src/App.browser.test.ts
bun run test:browser -- src/views/SkillManagementView.browser.test.ts
bun run test:browser -- src/views/MemoryInspectView.browser.test.ts
bun run build
```

并通过浏览器手动检查三个路由的布局和滚动行为。

## Risks, tradeoffs, and open questions

- **高度布局风险**：三个页面原本都自己占用 `h-screen`，加全局导航后必须改为依赖父容器高度，否则可能出现页面溢出或双滚动条。
- **RouterView 布局承接风险**：若把 class 直接写在 `<RouterView>` 上，会隐式依赖 attribute forwarding 到页面根节点；显式增加包裹容器更稳妥。
- **App 测试复杂度风险**：若 App 级集成测试直接挂真实页面，会引入 store、lazy route 和 API mock 负担；更适合先用 memory router + stub views 做轻量布局验证。
- **真实页面回归盲区**：stub view 的 App 测试无法证明真实页面在 `h-screen -> h-full` 后仍能正确滚动，因此必须补真实页面回归与手动检查。
- **主题切换位置**：当前会话与技能页面的主题切换按钮在各自 toolbar 内；全局导航区可以暂不承载主题切换，避免扩大范围。若后续希望统一，也应单独规划。
- **导航命名**：导航 label 可用“会话 / 技能 / 记忆”，也可用更明确的“会话历史 / 技能管理 / 记忆 Inspect”。实现时可按 UI 宽度选择。
- **会话详情路由保留**：从其他页面点击“会话”默认回 `/sessions`，可能会自动选择第一条会话；如果希望回到上次打开的 session，需要额外保存最近 session path，本次不建议引入。
- **技能详情 query 保留**：从其他页面点击“技能”默认回 `/skills`，当前 `?path=` 会丢失，页面会自动选择第一条技能；这是本次可接受的 MVP 行为，但需明确告知，避免与用户预期不一致。
- **active 点击语义**：本计划已固定为“当前 active 项不可再次跳转”；若实现时偏离该约束，极易出现“点击当前 tab 导致内容重置”的体验问题。
- **移动端布局**：现有页面主要是桌面工作台布局；导航区应至少在窄屏下横向滚动或换行，不应挤压页面业务工具栏。
