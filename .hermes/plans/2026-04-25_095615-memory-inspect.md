# Memory Inspect 实现计划

> **For Hermes:** 当前阶段只做计划，不实现代码；计划修订后如要执行，可按最小可执行版本落地，并在实现前再次做 Codex review。

**Goal:** 在 `your-hermes` 中增加一个只读的 Memory Inspect 页面，用于查看本地 Hermes 持久记忆文件的当前快照状态。

**Architecture:** 首版聚焦“读取当前文件快照并展示”，不做审计、diff 或编辑。后端新增最小 memory loader 与 inspect API，前端先以单个 view 承载页面状态，只在确有必要时再抽 store/更多组件。

**Tech Stack:** Vue 3、TypeScript、Vue Router、Vitest、Node/Bun、本地 Hermes 文件系统读取。

---

## 背景

`your-hermes` 当前已经能读取并展示本地 Hermes 会话历史与 skills 数据，但还没有面向 Hermes 持久记忆的 inspect 入口。

本机 Hermes agent 的持久记忆不是 `memory*.json*` 文件，而是位于 Hermes home 下的文件型 store：

```text
~/.hermes/memories/MEMORY.md
~/.hermes/memories/USER.md
```

其中：

- `MEMORY.md` 对应 agent personal notes / memory。
- `USER.md` 对应 user profile。
- gateway 会把它们注入为 `MEMORY (your personal notes)` 与 `USER PROFILE (who the user is)`。
- 会话历史侧已经能识别 `memory-review` 与 `combined-review` 分支，但这些分支在首版只能作为后续线索，不应进入当前实现范围。

## Data Source Findings

已对真实本地数据做额外结构确认，仅记录不涉及隐私内容的形状结论：

- 实际数据源确认为：
  - `~/.hermes/memories/MEMORY.md`
  - `~/.hermes/memories/USER.md`
- 两个文件当前都存在且可读。
- 当前样本均使用 LF 换行，不使用 CRLF。
- 当前样本都不以换行开头，也不以换行结尾。
- 当前样本都包含 `§` 分隔符。
- 当前样本中：
  - `MEMORY.md` 检测到 9 个 `§`，严格 `\n§\n` 分割与更宽松正则分割得到的 entry 数一致。
  - `USER.md` 检测到 8 个 `§`，严格 `\n§\n` 分割与更宽松正则分割得到的 entry 数一致。
- 这说明当前数据与“独立一行 `§` 分隔”假设一致，但首版解析仍应兼容 `\r?\n`，避免后续因换行差异返工。

这些发现支持首版直接做文件型 inspect，但不支持把“字符上限”“完整文件路径暴露”“复杂组件拆分”提前固化为不可变 API 契约。

## 目标

实现一个只读 Memory Inspect 页面，用于查看当前本地 Hermes 持久记忆状态。

首版需要展示：

1. `MEMORY.md` 当前内容。
2. `USER.md` 当前内容。
3. 按 `§` 切分后的条目列表。
4. 文件基础元信息：
   - 是否存在
   - 最后修改时间
   - 字符数
   - 条目数
5. 选中条目的全文内容。
6. 原始文件全文 raw view。

## 非目标

首版不做：

- 记忆编辑、删除、reset 或写回。
- 精确来源追踪。
- memory diff / audit timeline。
- 从 session tool call 重建历史。
- 修改 Hermes agent 的 memory 实现。
- Pinia store 抽象。
- 复杂的全局导航改造。
- 把字符上限固化为后端 API 字段。

## 关键设计决策

### 1. 路由保留 `/inspect/memory`

新增页面路由：

```text
/inspect/memory
```

命名建议：

```ts
name: 'memory-inspect'
```

原因：语义清晰，也为未来的 inspect 能力保留命名空间。

### 2. 首版仅注册路由，不强行增加全局导航入口

当前 `src/App.vue` 只有 `<RouterView />`，项目没有统一顶层导航容器。为了避免首版把范围从 memory inspect 扩大为导航系统设计，首版仅注册新路由，不在当前任务中改造全局导航。

如果后续用户希望 skills / sessions / inspect 统一切换，再单独规划导航层。

### 3. API 返回最小必要结构

新增：

```http
GET /api/hermes/inspect/memory
```

文件不存在或目录不存在时仍返回 `200`，并在对应对象上标记 `exists: false`。只有读取过程中出现无法恢复的异常时才返回 `500`。

推荐响应结构：

```ts
interface HermesMemoryEntryInspect {
  index: number
  content: string
  charCount: number
}

interface HermesMemoryFileInspect {
  exists: boolean
  updatedAt: string | null
  rawContent: string
  charCount: number
  entries: HermesMemoryEntryInspect[]
}

interface HermesMemoryInspectResponse {
  memory: HermesMemoryFileInspect
  user: HermesMemoryFileInspect
}
```

说明：

- 不把 `title`、`kind`、`fileName` 这类展示字段下放到 API。
- `entryCount` 由前端通过 `entries.length` 派生。
- `charLimit` 暂不进 API；如果未来确认存在稳定来源，可作为 UI 文案或附加字段后置接入。

### 4. 路径展示采用“受控暴露”策略

仓库约定倾向于避免无必要地暴露文件系统路径，因此首版默认 **不把绝对路径放进 API 响应**。

如果 UI 需要表达数据来源，可先在页面文案中说明“来源于 Hermes home 下 memories 目录”，而不是直接下发本机绝对路径。

如后续用户明确要求展示真实路径，可再作为受控扩展补上。

### 5. 前端先用单 View 承载状态

首版只有两个固定文件，数据结构远小于 skills 管理页；因此优先采用 view 内部状态，而不是先创建单独 Pinia store。

## 服务端设计

### 文件位置

首版新增：

```text
server/hermes-memory.ts
```

说明：

- 这与当前 `server/hermes-skills.ts` / `server/hermes-sessions.ts` 的放置方式一致，能以最小改动接入现有 API 层。
- 如果后续 memory 相关逻辑显著增长，再考虑下沉到 `server/hermes-data/memory/`。

### 职责

`server/hermes-memory.ts` 负责：

- 推导 Hermes memories 目录。
- 读取 `MEMORY.md` 与 `USER.md`。
- 把文件文本解析为 entry 列表。
- 返回稳定、可序列化的 inspect 数据。

不负责：

- HTTP 路由。
- session provenance 推导。
- 文件写回。

### 路径解析

```ts
const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
const MEMORIES_DIR = path.join(HERMES_HOME, 'memories')
```

需要注意 Hermes 运行环境中的默认 `HOME` 可能不是 `/Users/rainbowatcher`。开发服务启动时应继续遵守 `AGENTS.md` 中的约定，显式使用 `HOME=/Users/rainbowatcher`。

### 解析规则

#### 文件级别

- 文件不存在：返回空结构并标记 `exists: false`。
- 文件存在但内容为空：`exists: true`，`rawContent: ''`，`entries: []`。
- `updatedAt` 使用 ISO 字符串；不存在时为 `null`。
- `charCount` 使用 JavaScript 字符串长度。

#### entry 分割

不要把规则硬编码成仅支持 `\n§\n`。

推荐使用更稳健的分割规则：

```ts
const ENTRY_SEPARATOR_RE = /\r?\n\s*§\s*\r?\n/u
```

处理步骤：

1. 读取全文。
2. 保留原始全文为 `rawContent`。
3. 用 `ENTRY_SEPARATOR_RE` 分割。
4. 对每段执行 `trim()`。
5. 过滤空段。
6. 生成 entries：

```ts
entries.map((content, index) => ({
  index,
  content,
  charCount: content.length,
}))
```

说明：

- 当前真实样本下，严格和宽松分割都得到一致结果。
- 但实现层面仍应兼容 CRLF 和多余空白，避免未来文件格式轻微波动导致 UI 错误。

### API 接入

修改：

```text
server/api/hermes-api.ts
```

新增分支：

```ts
if (requestUrl.pathname === '/api/hermes/inspect/memory') {
  const inspect = await loadMemoryInspect()
  sendJson(res, 200, inspect)
  return true
}
```

## 前端设计

### 首版文件范围

首版建议最小改动为：

```text
src/types/memory.ts
src/api/hermes.ts
src/views/MemoryInspectView.vue
src/router/index.ts
```

可选：

```text
src/components/memory/MemoryEntryList.vue
```

### API client

修改：

```text
src/api/hermes.ts
```

新增：

```ts
export async function fetchMemoryInspect(): Promise<HermesMemoryInspectResponse>
```

风格与现有 `fetchSkills()`、`fetchSkillDetail()` 保持一致。

### 页面状态

`MemoryInspectView.vue` 内部维护：

```ts
const inspect = ref<HermesMemoryInspectResponse | null>(null)
const activeKind = ref<'memory' | 'user'>('memory')
const selectedIndex = ref<number | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
```

首版不做搜索；理由：

- 当前只有两个文件。
- 条目数量有限。
- 搜索会明显增加 view 状态、交互和 browser test 成本。

如果后续条目增多，再把搜索作为第二阶段增强。

### 页面布局

`MemoryInspectView.vue` 负责：

- onMounted 时加载 inspect 数据。
- 管理 MEMORY / USER 切换。
- 在切换 active file 时自动选择首个可用 entry。
- 渲染 loading / error / missing / empty 状态。

页面结构建议：

```text
Toolbar
└── grid
    ├── EntryList
    └── Detail
```

其中：

- Toolbar 先直接写在 view 内。
- Detail 也先写在 view 内。
- 如果列表模板显著变长，再抽 `MemoryEntryList.vue`。

### 展示内容

列表区域展示：

- entry 序号
- 内容预览
- 字符数

详情区域展示：

- 当前 entry 全文
- 文件存在状态
- 更新时间
- 当前文件字符数
- 当前文件条目数
- raw content

## 测试计划

### 服务端测试

新增：

```text
server/hermes-memory.test.ts
```

覆盖最小关键场景：

1. `MEMORY.md` 存在且包含多条 `§` 分隔内容。
2. 文件不存在时返回 `exists: false` 与空 entries。
3. 空文件返回 `exists: true` 但 entries 为空。
4. 分割逻辑兼容 LF / CRLF 至少一种构造样例。

为了避免依赖真实用户数据，测试应使用临时目录或可注入 root，不读取真实 `~/.hermes/memories`。

### API 测试

修改：

```text
server/api/hermes-api.test.ts
```

覆盖：

1. `/api/hermes/inspect/memory` 返回 200。
2. 返回 `memory` 与 `user` 两块数据。
3. service 抛错时走 server error 分支。

建议 mock `../hermes-memory.ts`，与当前 skills API 测试的 mock 风格保持一致。

### 浏览器测试

新增：

```text
src/views/MemoryInspectView.browser.test.ts
```

首版只覆盖两类高价值场景：

1. happy path：正常加载并显示 MEMORY 条目与详情。
2. empty / missing path：文件不存在或无条目时展示空态。

切换 USER、搜索过滤、更多交互细节都延后到第二阶段，以减少首版测试维护成本。

## 实现顺序

### Task 1: 补最小类型与服务端 loader

**Objective:** 提供只读 memory inspect 的最小服务端读取能力。

**Files:**

- Create: `server/hermes-memory.ts`
- Create: `server/hermes-memory.test.ts`
- Create: `src/types/memory.ts`

**Steps:**

1. 在 `server/hermes-memory.ts` 中实现 memories 目录推导、文件读取、entry 解析与 `loadMemoryInspect()`。
2. 让 loader 支持注入测试 root 或通过参数覆盖默认 memories 根目录。
3. 在 `src/types/memory.ts` 中定义前端响应类型。
4. 为服务端 loader 写最小测试，覆盖存在 / 不存在 / 空文件 / 分隔兼容性。

**Verify:**

- 运行：`bun run test:server -- server/hermes-memory.test.ts`
- 预期：新增服务端测试通过。

### Task 2: 接入 API 路由

**Objective:** 暴露读取能力给前端。

**Files:**

- Modify: `server/api/hermes-api.ts`
- Modify: `server/api/hermes-api.test.ts`

**Steps:**

1. 在 API 路由中接入 `GET /api/hermes/inspect/memory`。
2. 为新路由补充成功响应测试。
3. 补充 service 抛错时的错误路径测试。

**Verify:**

- 运行：`bun run test:server -- server/api/hermes-api.test.ts`
- 预期：API 测试通过。

### Task 3: 接入前端 API 与视图

**Objective:** 提供首版可访问的 Memory Inspect 页面。

**Files:**

- Modify: `src/api/hermes.ts`
- Modify: `src/router/index.ts`
- Create: `src/views/MemoryInspectView.vue`
- Optional Create: `src/components/memory/MemoryEntryList.vue`

**Steps:**

1. 在 `src/api/hermes.ts` 新增 `fetchMemoryInspect()`。
2. 在 `src/router/index.ts` 注册 `/inspect/memory` 路由。
3. 在 `MemoryInspectView.vue` 中实现加载、切换、选中与空态展示。
4. 如列表模板过长，再抽离 `MemoryEntryList.vue`，否则保留在 view 内。

**Verify:**

- 手动访问：`/inspect/memory`
- 预期：能看到 MEMORY / USER 的切换与条目详情。

### Task 4: 补最小 browser test 与回归验证

**Objective:** 为首版页面提供基础回归保护。

**Files:**

- Create: `src/views/MemoryInspectView.browser.test.ts`

**Steps:**

1. 编写 happy path browser test。
2. 编写 missing / empty state browser test。
3. 运行与改动范围相关的检查。

**Verify:**

- 运行：`bun run test:browser -- src/views/MemoryInspectView.browser.test.ts`
- 预期：browser test 通过。

## 验收标准

首版完成后应满足：

- 可以访问 `/inspect/memory`。
- 页面能展示 `MEMORY.md` 与 `USER.md` 的当前 inspect 信息。
- 能看到按 `§` 切分的条目列表。
- 能查看选中条目的完整内容。
- 能看到原始文件全文。
- 文件不存在、空文件均有明确空态。
- 新增后端与前端测试通过。

## 风险与取舍

### 1. 字符上限暂不进 API

优点：

- 避免把未确认稳定来源的约束变成 API 契约。
- 避免后续 Hermes 配置变化造成前后端返工。

代价：

- 首版页面暂不展示“当前/上限”形式的容量信息。

### 2. 暂不公开绝对路径

优点：

- 更符合仓库当前“尽量不暴露本机路径”的边界。
- 避免把本地实现细节硬编码进前端展示。

代价：

- 页面无法直接精确展示真实文件位置。

### 3. 暂不抽 store 与复杂组件

优点：

- 更符合首版规模。
- 减少文件数、状态同步点和测试成本。

代价：

- 若第二阶段加入搜索、来源线索、路由深链，后续可能需要再抽象一次。

## 后续扩展

后续可以基于 `server/hermes-sessions.ts` 的 branch 识别能力继续扩展：

- 识别 `memory-review` / `combined-review` 分支。
- 展示 memory tool call 时间线。
- 给当前 entry 提供候选来源会话。
- 在需要时增加搜索与 store 化。
- 如用户明确需要，再增加真实路径展示与字符上限展示。

但这些功能不应进入首版，以免把只读 inspect 扩大为审计系统。
