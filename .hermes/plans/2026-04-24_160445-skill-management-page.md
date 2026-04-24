# 技能管理页面实现计划（首版只读）

> **For Hermes:** 当前为纯规划模式，只输出计划，不执行实现。计划完成后，使用 Codex CLI 对计划文档做一次 review，重点检查范围控制、路径准确性、测试覆盖与潜在遗漏。

**Goal:** 在 `your-hermes` 中实现一个首版只读“技能管理页面”，用于浏览本地 Hermes skills、查看 `SKILL.md` 正文、阅读 frontmatter 元信息，并在右侧提供 markdown anchor 导航。

**Architecture:** 复用当前会话历史页的前后端分层：服务端从本地 skills 目录递归读取并归一化 skill 数据，通过 `/api/hermes/skills` 暴露只读 API；前端继续沿用 `src/api` + Pinia store + View/Component 分层实现列表、详情、路由同步与右侧侧栏。首版只支持单一本地来源 `/Users/rainbowatcher/.hermes/skills`，使用 `gray-matter` 解析 frontmatter，正文使用现有 markdown 渲染能力，anchor 导航基于 markdown 标题自动生成。

**Tech Stack:** Vue 3、TypeScript、Vue Router、Pinia、Vite、Vitest（server + browser）、Bun、`gray-matter`。

---

## 1. 数据源探索结论（已确认）

### 1.1 单一真实来源

首版真实来源为：

```text
/Users/rainbowatcher/.hermes/skills
```

实现时不要把该绝对路径散落在业务逻辑、测试或前端中；应在服务端 skills 模块内集中定义/解析，例如：

```ts
const DEFAULT_SKILLS_ROOT = join(homedir(), '.hermes', 'skills')
```

如需测试，应通过临时 fixture root 注入，而不是依赖开发者机器上的真实目录。

不读取：

- `/Users/rainbowatcher/.hermes/home/skills`（不存在）
- 其他系统/插件来源（后续再扩展）

### 1.2 真实路径形态

当前 skills 真实路径不是固定两层，至少包含：

- 一级：`dogfood`
- 二级：`software-development/writing-plans`
- 三级：`mlops/inference/llama-cpp`

因此首版的技能唯一标识不能假设为 `category/name`，而应基于 `relativePath`。

### 1.3 `SKILL.md` 真实结构

已确认：

- 每个 skill 目录都含 `SKILL.md`
- `SKILL.md` 全量包含 frontmatter
- `name`、`description` 可稳定依赖
- `title` 不是必填，很多标题来自 markdown 一级标题
- tags 可能在：
  - `metadata.hermes.tags`
  - 顶层 `tags`

因此：

```ts
tags = metadata?.hermes?.tags ?? frontmatter.tags ?? []
```

### 1.4 linked files 真实形态

真实 linked files 不只在固定目录下，也可能直接位于 skill 根目录：

- 常见目录：`references/`、`templates/`、`scripts/`
- 根目录文件示例：`pptxgenjs.md`、`editing.md`、`README.md`、`LICENSE.txt`

首版只展示 linked files 索引，不做内容预览。

### 1.5 解析策略结论

frontmatter 存在如下复杂形态：

- inline array
- block list
- nested object
- folded multiline string (`>`)
- quoted long string

因此首版同意引入 `gray-matter`，不要手写最小 YAML 解析器。

---

## 2. 产品范围与非目标

## 2.1 本次迭代目标

交付一个**只读技能管理页面**，包含：

- 技能列表
- 搜索（按名称、描述、tags、路径）
- 技能详情
- markdown 正文渲染
- 右侧 metadata 面板
- 右侧 markdown anchor 导航
- linked files 列表索引
- 路由直达
- 加载态 / 空态 / 错误态

## 2.2 明确不做

本次不做：

- readiness / setup 分析
- 缺失命令、缺失环境变量检测
- 多来源聚合（用户 / 系统 / 插件）
- 新建 / 编辑 / 删除 skill
- linked file 内容预览或编辑
- 暴露绝对文件路径到前端
- 复杂权限控制

---

## 3. 页面信息架构

建议采用“三栏式”布局，贴近当前会话页的使用习惯。

### 3.1 左栏：技能列表

展示内容：

- 标题（`title ?? firstHeading ?? name`）
- 描述
- path / 分类信息
- tags
- linked files 数量（可选）

交互：

- 搜索框
- 点击选中技能
- 与路由联动

### 3.2 中栏：正文详情

展示内容：

- 顶部标题
- 简短 description
- markdown 正文渲染

说明：

- 正文展示 markdown body，不把 frontmatter 混进正文
- 使用现有 `src/lib/markdown.ts` 渲染能力，避免重复造轮子

### 3.3 右栏：辅助信息栏

拆成两个块：

#### A. Metadata 面板

展示常见 frontmatter 字段：

- `name`
- `relativePath`
- `version`
- `author`
- `license`
- `tags`
- `related_skills`
- `dependencies`
- `platforms`
- `prerequisites`
- `linked files`

未知字段处理：

- 常见字段优先格式化展示
- 其余字段以结构化 JSON / key-value 兜底展示

#### B. Markdown Anchor 导航

展示正文中的标题锚点目录：

- 支持 `h1` / `h2` / `h3`（首版最多到 `h3` 即可）
- 点击后滚动到正文对应位置
- 首版不做当前阅读位置高亮 / 滚动监听，高亮能力明确延期到后续迭代

---

## 4. 路由与标识设计

## 4.1 路由建议

因为真实 skill path 含 `/`，首版不建议先做 `/skills/:skillId` 这种单段参数路由。

推荐路由：

```text
/skills?path=mlops/inference/llama-cpp
```

新增路由：

- `/skills`

使用 query：

- `path`：当前选中的 skill 相对路径

### 4.2 技能 ID 设计

前后端统一使用：

```ts
relativePath: string
```

例如：

- `dogfood`
- `software-development/writing-plans`
- `mlops/inference/llama-cpp`

可额外派生内部 ID：

```ts
id = `local:${relativePath}`
```

但前端路由与 API 查询优先直接使用 `relativePath`，避免无意义编码层。

---

## 5. 数据模型设计

新增：`src/types/skills.ts`

### 5.1 列表项类型

```ts
export interface SkillSummary {
  id: string
  source: 'local'
  relativePath: string
  pathSegments: string[]

  name: string
  title: string
  description: string
  tags: string[]

  category?: string
  subcategory?: string

  hasLinkedFiles: boolean
  linkedFileCount: number
}
```

说明：

- `id` 可为 `local:${relativePath}`
- `category = pathSegments[0]`
- `subcategory = pathSegments.length > 2 ? pathSegments.slice(1, -1).join('/') : undefined`

### 5.2 详情类型

```ts
export interface SkillLinkedFile {
  relativePath: string
  kind: 'references' | 'templates' | 'scripts' | 'assets' | 'root' | 'other'
  extension: string
  sizeBytes: number
  isProbablyText: boolean
}

export interface SkillAnchorItem {
  id: string
  depth: 1 | 2 | 3
  text: string
}

export interface SkillDetail extends SkillSummary {
  frontmatter: Record<string, unknown>
  markdownBody: string
  linkedFiles: SkillLinkedFile[]
  anchors: SkillAnchorItem[]
}
```

### 5.3 不向前端暴露的字段

不要暴露：

- 绝对路径（如 `/Users/rainbowatcher/...`）
- 原始文件系统实现细节
- readiness 相关字段
- setup / 缺失命令等运行环境分析字段

---

## 6. 服务端实现设计

## 6.1 目录与文件建议

新增文件：

- `server/hermes-data/skills/index.ts`
- `server/hermes-data/skills/types.ts`
- `server/hermes-data/skills/parse-skill.ts`
- `server/hermes-data/skills/list-skills.ts`
- `server/hermes-data/skills/load-skill-detail.ts`
- `server/hermes-data/skills/tests/parse-skill.test.ts`
- `server/hermes-data/skills/tests/list-skills.test.ts`
- `server/hermes-data/skills/tests/load-skill-detail.test.ts`

修改文件：

- `server/api/hermes-api.ts`

## 6.2 服务端职责分解

### `parse-skill.ts`

负责：

- 用 `gray-matter` 拆分 frontmatter 和 markdown body
- 派生 `title`
- 归一化 `tags`
- 从 markdown body 中提取 anchors

建议导出：

```ts
export function parseSkillDocument(raw: string): {
  frontmatter: Record<string, unknown>
  markdownBody: string
  title: string
  tags: string[]
  anchors: SkillAnchorItem[]
}
```

### `list-skills.ts`

负责：

- 遍历 `/Users/rainbowatcher/.hermes/skills`
- 递归匹配 `**/SKILL.md`
- 生成 `SkillSummary[]`

注意：

- 忽略 `.hub`、`.bundled_manifest` 等非 skill 项
- 路径逻辑基于 `relativePath`
- 列表阶段不要读取所有 linked file 内容

### `load-skill-detail.ts`

负责：

- 根据 `relativePath` 读取单个 `SKILL.md`
- 统计 linked files
- 生成 `SkillDetail`

linked file 规则：

- `SKILL.md` 本身不计入 linked files
- 根目录文件记为 `root`
- 已知目录映射到固定 kind
- 其他目录归类为 `other`

## 6.3 API 设计

修改 `server/api/hermes-api.ts`，新增：

### 列表接口

```http
GET /api/hermes/skills
```

返回：

```ts
{ skills: SkillSummary[] }
```

### 详情接口

推荐：

```http
GET /api/hermes/skills/detail?path=mlops/inference/llama-cpp
```

返回：

```ts
{
  skill: SkillDetail
}
```

语义约定：

- `path` 缺失或非法：400
- `path` 合法但 skill 不存在：404
- 成功时始终返回非空 `skill`
- 不使用 `200 + { skill: null }` 这一套语义，避免客户端分支复杂化

为什么不建议 `/api/hermes/skills/:path`：

- path 本身含 `/`
- query 参数更简单、更稳
- 与首版单来源模式更匹配

### path 规范化规则

服务端必须在读取前统一规范化 `path`：

- 拒绝空串
- 拒绝绝对路径
- 拒绝 `.`、`..`
- 拒绝 normalize 后仍含越界片段的路径
- 拒绝重复斜杠归一化后为空的情况
- 接受 URL 编码后的 `/`（如 `%2F`），但必须在 decode 后再做统一校验

### 列表接口边界

`GET /api/hermes/skills` 只返回轻量 summary：

- 不返回完整 frontmatter
- 不返回 markdown body
- 不返回 anchors

避免列表页响应过重。

### 错误处理

- path 缺失/非法：400
- path 不存在：404
- 解析失败 / 文件损坏：500（或返回结构化错误消息）

---

## 7. 前端实现设计

## 7.1 API 封装

修改：`src/api/hermes.ts`

新增：

```ts
import type { SkillDetail, SkillSummary } from '@/types/skills'

export async function fetchSkills() {
  return await requestJson<{ skills: SkillSummary[] }>('/api/hermes/skills')
}

export async function fetchSkillDetail(path: string) {
  return await requestJson<{ skill: SkillDetail | null }>(
    `/api/hermes/skills/detail?path=${encodeURIComponent(path)}`,
  )
}
```

## 7.2 Store

新增：`src/stores/skills.ts`

建议状态：

```ts
const skills = ref<SkillSummary[]>([])
const detailMap = reactive<Record<string, SkillDetail>>({})
const selectedPath = useStorage<string | null>('skills.selected-path', null)
const search = ref('')
const isLoadingSkills = ref(false)
const isLoadingDetail = ref(false)
const loadError = ref('')
```

建议能力：

- `loadSkills()`
- `loadSkill(path)`
- `setSearch()`
- `setSelectedPath()`
- `filteredSkills`
- `selectedSkillSummary`
- `selectedSkillDetail`

搜索范围：

- `title`
- `name`
- `description`
- `tags`
- `relativePath`

## 7.3 View 与组件拆分

新增：

- `src/views/SkillManagementView.vue`
- `src/components/skills/SkillList.vue`
- `src/components/skills/SkillDetail.vue`
- `src/components/skills/SkillMetadataPanel.vue`
- `src/components/skills/SkillAnchorNav.vue`
- `src/components/skills/SkillMarkdownContent.vue`

### `SkillManagementView.vue`

负责：

- 初始化加载列表
- 读取/写入路由 query
- 协调选中 skill 与详情加载
- 编排三栏布局

### `SkillList.vue`

负责：

- 搜索框
- 列表渲染
- 选中态
- 空态 / 加载态

### `SkillDetail.vue`

负责：

- 顶部标题
- 描述
- 中间 markdown 正文
- 右栏组合 `SkillMetadataPanel` + `SkillAnchorNav`

### `SkillMarkdownContent.vue`

负责：

- 渲染 markdown body
- 给标题节点挂稳定锚点 id
- 作为 anchor 跳转落点容器

这里是本次实现的关键点：

> 现有 `MessageMarkdown.vue` 只负责把 markdown 转成 HTML，并没有“提取 anchors + 给标题 id + 暴露滚动定位”这一组能力，因此技能正文建议单独做一个 skill 专用 markdown 组件，而不是硬复用消息组件。

### `SkillAnchorNav.vue`

负责：

- 展示 anchor 列表
- 点击后滚动定位到正文对应标题
- 当前项高亮（若首版时间不够，可先不做滚动监听高亮）

---

## 8. Markdown 与 Anchor 方案

## 8.1 Anchor 数据来源

首版建议**服务端生成 anchors**，前端只消费：

优点：

- 列表 / 详情数据稳定
- 测试更容易
- 不必在浏览器端重复解析 markdown 标题

anchor 提取规则：

- 只提取 ATX 标题：`#`、`##`、`###`
- 忽略四级以下标题
- 首版不支持 Setext 标题；如后续发现 skills 大量使用 Setext，再单独补
- 清理多余空白
- 生成 slug 风格 id
- 重复标题必须去重：`usage`、`usage-2`、`usage-3`
- 中文和非 ASCII 标题必须生成稳定 id；可优先保留 Unicode 字符并移除空白/危险符号，避免全部折叠为空
- 纯符号标题若 slug 为空，回退为 `heading-{index}`

示例：

```markdown
# Powerpoint Skill

## Quick Reference

## Reading Content

### Editing Workflow
```

输出：

```ts
;[
  { id: 'powerpoint-skill', depth: 1, text: 'Powerpoint Skill' },
  { id: 'quick-reference', depth: 2, text: 'Quick Reference' },
  { id: 'reading-content', depth: 2, text: 'Reading Content' },
  { id: 'editing-workflow', depth: 3, text: 'Editing Workflow' },
]
```

## 8.2 正文标题节点注入 id

首版实现建议：

- 扩展 `src/lib/markdown.ts`，增加一个“可选标题 anchor 插件”模式；或
- 新增 skill 专用 markdown 渲染函数，例如：`renderSkillMarkdown(content, anchors)`

建议后者，影响更小。

新增：

- `src/lib/skill-markdown.ts`

职责：

- 渲染 markdown body
- 给匹配标题注入 `id`

这样 `SkillMarkdownContent.vue` 不需要在浏览器端再解析 markdown AST。

## 8.3 滚动定位策略

点击 anchor 后：

- 不直接用全局 `document.getElementById()` 作为唯一实现
- 应优先在正文容器 `ref` 内查找对应标题节点
- 再对正文滚动容器执行定位，避免三栏布局下滚错到 `window`

如果正文在内部滚动容器中，需要：

- 保证标题 id 存在于正文容器内
- 优先对局部滚动容器定位，而不是整个 window

实现前要先查看最终布局容器是否为内部滚动区；若是，则在组件内使用 `ref` + `querySelector` 定位。

---

## 9. 测试计划

## 9.1 服务端测试

新增：

- `server/hermes-data/skills/tests/parse-skill.test.ts`
- `server/hermes-data/skills/tests/list-skills.test.ts`
- `server/hermes-data/skills/tests/load-skill-detail.test.ts`
- 可选：`server/api/hermes-api.test.ts` 增补 skills 路由测试

### `parse-skill.test.ts`

覆盖：

1. 正常 frontmatter + markdown body 拆分
2. `title` 回退逻辑：`frontmatter.title -> firstHeading -> name`
3. `tags` 回退逻辑：`metadata.hermes.tags -> top-level tags -> []`
4. anchors 提取（`h1/h2/h3`）
5. folded string / block list 能被 `gray-matter` 正确解析
6. 重复 heading slug 去重
7. 中文 / 非 ASCII heading slug 稳定生成
8. 无 frontmatter 但有正文时能安全解析
9. 无 heading 时 anchors 返回空数组
10. 纯符号 heading 使用 `heading-{index}` 回退

### `list-skills.test.ts`

覆盖：

1. 一级路径 skill：`dogfood`
2. 二级路径 skill：`software-development/writing-plans`
3. 三级路径 skill：`mlops/inference/llama-cpp`
4. summary 不暴露绝对路径
5. linked file 数量统计正确

### `load-skill-detail.test.ts`

覆盖：

1. 正确返回 frontmatter、markdownBody、anchors
2. linked files 包含根目录文件与已知目录文件
3. 不把 `SKILL.md` 算进 linked files
4. path 不存在时返回 not found 结果，并由 API 映射为 404
5. 越界 path 被拒绝：`../x`、绝对路径、`.`、`..`、空串、重复斜杠归一化异常
6. URL 编码绕过被拒绝：例如 decode 后含 `../` 的路径

### API 路由测试

覆盖：

1. `GET /api/hermes/skills` 返回 200
2. `GET /api/hermes/skills/detail?path=...` 返回 200
3. path 缺失或非法返回 400
4. skill 不存在返回 404
5. 列表接口不返回 `frontmatter` / `markdownBody` / `anchors` 等重字段

## 9.2 前端 browser 测试

新增：

- `src/components/skills/SkillAnchorNav.browser.test.ts`
- `src/components/skills/SkillDetail.browser.test.ts`
- 可选：`src/views/SkillManagementView.browser.test.ts`

覆盖：

1. 列表渲染与搜索过滤
2. 点击 skill 后展示标题、描述、markdown 正文
3. metadata 面板显示常见 frontmatter 字段
4. 未知 frontmatter 结构能以兜底方式展示
5. anchor 导航正确渲染层级
6. 点击 anchor 在正文容器内调用滚动定位逻辑
7. 空态 / 错误态可见
8. `SkillManagementView` 路由联动：首次加载读取 `query.path`
9. 切换 skill 后更新 query
10. 无效 `query.path` 时回退到安全状态或首个可用 skill

---

## 10. 实施任务拆分（bite-sized）

### Task 1：引入 `gray-matter`

**Objective:** 为服务端 frontmatter 解析建立可靠基础。

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`（安装后自动更新）

**Steps:**

1. 添加 `gray-matter` 依赖。
2. 运行安装命令。
3. 确认 lockfile 更新。

**Run:**

```bash
bun add gray-matter
```

**Verify:**

```bash
bun run build
```

预期：TypeScript 仍可通过。

---

### Task 2：新增技能类型定义

**Objective:** 建立 skills 列表/详情/anchor 的统一前后端类型。

**Files:**

- Create: `src/types/skills.ts`
- Create: `server/hermes-data/skills/types.ts`

**Steps:**

1. 定义 `SkillSummary`、`SkillDetail`、`SkillLinkedFile`、`SkillAnchorItem`。
2. 保证字段名与 API 返回一致。
3. 只保留首版需要字段。

**Verify:**

```bash
bun run build
```

---

### Task 3：实现 `parseSkillDocument`

**Objective:** 用 `gray-matter` 解析 `SKILL.md`，并产出 title/tags/anchors。

**Files:**

- Create: `server/hermes-data/skills/parse-skill.ts`
- Create: `server/hermes-data/skills/tests/parse-skill.test.ts`

**Steps:**

1. 写 failing tests，覆盖 frontmatter、title、tags、anchors。
2. 实现 parser。
3. 运行 server 测试直到通过。

**Run:**

```bash
bun run test:server
```

---

### Task 4：实现 skills 列表扫描

**Objective:** 从真实 skills 目录生成只读 `SkillSummary[]`。

**Files:**

- Create: `server/hermes-data/skills/list-skills.ts`
- Create: `server/hermes-data/skills/tests/list-skills.test.ts`

**Steps:**

1. 递归扫描 `**/SKILL.md`。
2. 派生 `relativePath`、`pathSegments`、`category`、`subcategory`。
3. 统计 linked file 数量。
4. 确保不暴露绝对路径。

**Run:**

```bash
bun run test:server
```

---

### Task 5：实现 skills 详情加载

**Objective:** 为选中的 skill 返回完整只读详情。

**Files:**

- Create: `server/hermes-data/skills/load-skill-detail.ts`
- Create: `server/hermes-data/skills/tests/load-skill-detail.test.ts`

**Steps:**

1. 根据 `relativePath` 校验并定位目录。
2. 读取 `SKILL.md`。
3. 统计 linked files。
4. 返回 `SkillDetail`。

**Run:**

```bash
bun run test:server
```

---

### Task 6：接入 HTTP API

**Objective:** 暴露 `/api/hermes/skills` 与 `/api/hermes/skills/detail`。

**Files:**

- Modify: `server/api/hermes-api.ts`
- Modify: `server/api/hermes-api.test.ts`

**Steps:**

1. 增加列表与详情路由。
2. 实现 400/404/500 分支。
3. 补 API 测试。

**Run:**

```bash
bun run test:server
```

---

### Task 7：前端 API 与 store

**Objective:** 让前端具备加载 skills 列表与详情的状态能力。

**Files:**

- Modify: `src/api/hermes.ts`
- Create: `src/stores/skills.ts`
- Create: `src/types/skills.ts`（若未在 Task 2 完成）

**Steps:**

1. 新增 `fetchSkills` / `fetchSkillDetail`。
2. 新建 `useSkillsStore`。
3. 实现搜索、选中、详情缓存。

**Verify:**

```bash
bun run build
```

---

### Task 8：新增 `/skills` 路由与页面骨架

**Objective:** 建立技能页面入口与路由同步。

**Files:**

- Modify: `src/router/index.ts`
- Create: `src/views/SkillManagementView.vue`

**Steps:**

1. 新增 `/skills` 路由。
2. 页面初始化加载 skills 列表。
3. `query.path` 与 `selectedPath` 双向同步。

**Verify:**

```bash
bun run build
```

---

### Task 9：实现技能列表栏

**Objective:** 完成左栏列表与搜索交互。

**Files:**

- Create: `src/components/skills/SkillList.vue`
- Create: `src/components/skills/SkillList.browser.test.ts`

**Steps:**

1. 渲染 summary 列表。
2. 支持搜索过滤。
3. 处理加载态、空态、错误态。

**Run:**

```bash
bun run test:browser
```

---

### Task 10：实现技能正文详情

**Objective:** 完成中栏 skill title + description + markdown body 展示。

**Files:**

- Create: `src/components/skills/SkillDetail.vue`
- Create: `src/components/skills/SkillMarkdownContent.vue`
- Create: `src/lib/skill-markdown.ts`
- Create: `src/components/skills/SkillDetail.browser.test.ts`

**Steps:**

1. 渲染 skill 标题与描述。
2. 用 skill 专用 markdown 渲染正文。
3. 为标题节点注入 anchor id。

**Run:**

```bash
bun run test:browser
```

---

### Task 11：实现右栏 metadata 面板

**Objective:** 展示 frontmatter 元信息与 linked files 索引。

**Files:**

- Create: `src/components/skills/SkillMetadataPanel.vue`
- Create: `src/components/skills/SkillMetadataPanel.browser.test.ts`

**Steps:**

1. 优先格式化展示常见字段。
2. 用兜底结构展示未知字段。
3. 展示 linked files 列表索引。

**Run:**

```bash
bun run test:browser
```

---

### Task 12：实现 markdown anchor 导航

**Objective:** 在右栏提供正文标题导航。

**Files:**

- Create: `src/components/skills/SkillAnchorNav.vue`
- Create: `src/components/skills/SkillAnchorNav.browser.test.ts`
- Modify: `src/components/skills/SkillDetail.vue`

**Steps:**

1. 渲染 anchor 层级列表。
2. 点击后滚动定位正文标题。
3. 若成本可控，再补当前项高亮；否则留到后续。

**Run:**

```bash
bun run test:browser
```

---

### Task 13：整体验证

**Objective:** 确保服务端、前端、样式与路由整体通过。

**Files:**

- Modify: 按实际问题修正相关文件

**Run:**

```bash
bun run test:server
bun run test:browser
bun run build
bun run lint
```

预期：全部通过。

---

### Task 14：提交实现计划文档 review

**Objective:** 在真正实现前，让 Codex 对本计划做一次补漏 review。

**Files:**

- Modify: `.hermes/plans/2026-04-24_160445-skill-management-page.md`（如 review 后需修订）

**Steps:**

1. 使用 Codex CLI 读取当前计划文档。
2. 要求 review 范围控制、路径准确性、接口设计、anchor 方案与测试遗漏。
3. 若 Codex 提出有效问题，再更新本计划。

**Run:**

```bash
env HOME=/Users/rainbowatcher codex exec "Review the implementation plan in .hermes/plans/2026-04-24_160445-skill-management-page.md. Focus on scope control, file-path accuracy, API design, anchor navigation risks, and missing tests. Return concise review findings in Chinese."
```

---

## 11. 验收标准

实现完成后，以下条件全部满足才算首版完成：

1. 访问 `/skills` 能看到技能列表。
2. 选中任意 skill 后可看到：
   - 标题
   - 描述
   - markdown 正文
   - metadata 面板
   - linked files 索引
   - markdown anchor 导航
3. `dogfood`、`software-development/writing-plans`、`mlops/inference/llama-cpp` 三类路径都能正确打开。
4. 前端不暴露绝对路径。
5. frontmatter 由 `gray-matter` 正确解析。
6. browser / server / build / lint 全部通过。

---

## 12. 风险与控制

### 风险 1：markdown anchor 与渲染 HTML 不一致

控制：

- 统一由服务端生成 anchor 数据
- 前端 skill markdown 渲染时按相同 slug 规则注入标题 id

### 风险 2：path query 被非法构造导致越界读取

控制：

- 服务端只允许在 skills 根目录下解析
- 用 `relativePath` 校验与 normalize，拒绝 `..`、绝对路径、空路径

### 风险 3：某些 frontmatter 字段形态不规则

控制：

- 所有元信息字段在 UI 展示前都做类型收敛
- metadata panel 对未知结构使用兜底展示

### 风险 4：linked files 太多导致详情过重

控制：

- 首版只返回索引，不返回 linked file 内容
- 后续若要预览，再拆独立接口

---

## 13. 最终建议

请按以下顺序执行：

1. `gray-matter` + 服务端解析
2. 服务端列表/详情 API
3. 前端 store + 路由
4. 正文渲染
5. metadata 面板
6. anchor 导航
7. 测试与收尾
8. Codex review

这样可以先把“数据链路”打通，再叠加右侧能力，返工最少。
