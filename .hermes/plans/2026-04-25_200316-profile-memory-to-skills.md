# Profile MEMORY.md 转技能实施计划

> **For Hermes:** 本计划仅用于后续执行，不在本回合实施代码或配置改动。
> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 把各 profile 的 `MEMORY.md` 中适合长期复用的“全局静态事实”和“跨 Profile 共享事实”迁移为可复用 skill，并收敛重复 memory / SOUL 表达，降低未来多 profile 漂移与重复维护成本。

**Architecture:** 先盘点 default / hetun / haibao 的 memory 与 SOUL，建立“事实分类矩阵”，再把稳定、可复用、非用户画像的事实抽成 1~2 个本地技能，最后精简各自 memory，仅保留 profile 特有、用户偏好或仍应由 memory 承载的条目。共享技能应放在全局技能目录 `~/.hermes/skills/`，避免在各 profile 下重复拷贝。

**Tech Stack:** Hermes memories (`MEMORY.md` / `USER.md`)、Hermes skills (`SKILL.md`)、Hermes SOUL/persona 文本、只读文件检查工具、`skill_manage`。

---

## 当前上下文 / 假设

- 当前活动工作区是 `your-hermes`，但这次计划针对的是用户本机 Hermes 配置目录，而不是仓库源码。
- 已确认相关真实路径：
  - `/Users/rainbowatcher/.hermes/memories/MEMORY.md`
  - `/Users/rainbowatcher/.hermes/profiles/hetun/memories/MEMORY.md`
  - `/Users/rainbowatcher/.hermes/profiles/haibao/memories/MEMORY.md`
  - `/Users/rainbowatcher/.hermes/SOUL.md`
  - `/Users/rainbowatcher/.hermes/profiles/hetun/SOUL.md`
  - `/Users/rainbowatcher/.hermes/profiles/haibao/SOUL.md`
- 已观察到：default / hetun / haibao 三份 `MEMORY.md` 高度重叠，包含环境静态事实、项目工作区事实、研究仓库事实、技能页实现决策、profile 调度约定等不同层级内容。
- 已观察到：profile 角色定义在 `SOUL.md` 中也存在分布不一致的问题：
  - default SOUL 同时定义了 default / hetun / haibao。
  - hetun SOUL 只保留语言规则。
  - haibao SOUL 包含 default 和 hetun 说明，但未看到对 haibao 自身的完整对称定义。
- 目标不是“把所有 memory 都转成 skill”，而是只迁移适合做成 procedural / reusable context 的那一部分；用户画像、临时线程上下文、特定项目决策不应硬塞进 skill。

## Data Source Findings

### 已检查的真实数据形态

1. `default MEMORY.md`
   - 10 条 `§` 分隔条目。
   - 混合了机器静态环境、项目路径、用户上下文限制、profile 调度约定、repo 约束。

2. `hetun MEMORY.md`
   - 9 条 `§` 分隔条目。
   - 与 default 高度重合，但末尾是 “计划写完后用 Codex 复核 your-hermes 计划” 这类工作流偏好，而不是通用静态事实。

3. `haibao MEMORY.md`
   - 10 条 `§` 分隔条目。
   - 与 default 高度重合，但仍包含“河豚=hetun”的跨 profile 事实，说明共享知识被复制进不同 profile memory。

4. `SOUL.md`
   - default SOUL 已包含“河豚/海豹”的 profile 映射与调用约定。
   - hetun / haibao SOUL 的覆盖范围不对称，说明“哪些事实放 SOUL、哪些放 memory、哪些应进 skill”目前没有明确边界。

### 初步分类结论

应先把现有 memory 条目分成四类：

1. **全局静态事实**
   - 机器环境、固定目录、工具状态等，长期稳定，可被多个 profile 共享引用。
   - 例：Hema Wiki 路径、Codex 状态目录、Hermes skills 真实目录。

2. **跨 Profile 共享事实 / 调度约定**
   - profile 别名、如何通过 default 调用 hetun / haibao、写自包含 prompt 的约束。
   - 这类内容更像共享工作流知识，适合 skill 或统一 persona 文档，而不是多份 memory 重复抄写。

3. **用户/项目特定事实**
   - 例：your-hermes 技能页 MVP 决策、某个 Discord 线程固定工作目录、研究仓库用途。
   - 这些未必适合做 skill，除非已沉淀为可复用流程；更可能继续留在 memory，或转为项目文档。

4. **临时工作流或偏好**
   - 例：计划写完后让 Codex 复核。
   - 更接近当前操作约定，若要复用，应抽成明确 skill；否则不应与静态事实混放。

### 关键边界判断

- `MEMORY.md` 更适合存“事实”。
- `SOUL.md` 更适合存 persona / 行为规则。
- `SKILL.md` 更适合存“何时使用 + 怎么做 + 有哪些共享背景/约束”。
- 因此本次迁移不应简单把 memory 原句机械复制进 skill，而应先重构信息边界。

### First-release cuts

首版只做以下最小闭环：

- 建立一份事实分类表。
- 新建共享 skill（建议 1 个主 skill，必要时最多拆成 2 个）。
- 从三份 `MEMORY.md` 中移除已被 skill / SOUL 吸收的重复共享事实。
- 仅在确有必要时补齐 default / haibao / hetun 的 SOUL 对 profile 调度定义。

### Deferred from v1

- 不做 memory 自动迁移脚本。
- 不做多 profile 全量审计 UI。
- 不把所有项目事实都技能化。
- 不处理 `USER.md`。
- 不引入新的配置加载机制或自动注入 skill 的运行时改造。

---

## 建议产物设计

### 方案 A：一个总技能 + 少量 SOUL 收敛（推荐）

创建一个全局共享技能，例如：

- `~/.hermes/skills/autonomous-ai-agents/hermes-shared-profile-facts/SKILL.md`

技能内容包括：

- 何时使用：涉及多 profile 协作、Hermes 本机目录、Codex/Hema Wiki/skills 目录定位时。
- 全局静态事实：固定路径、工具状态、已验证环境事实。
- 跨 profile 共享事实：河豚/海豹别名、default 调用约定、自包含 prompt 约束。
- 非目标：不包含用户偏好、特定线程临时上下文、具体项目实现决策。

同时：

- `SOUL.md` 只保留 profile 定义与行为约束。
- `MEMORY.md` 只保留不适合进 skill 的残余事实。

### 方案 B：拆成两个技能

若执行时发现内容过于混杂，则拆分为：

- `~/.hermes/skills/autonomous-ai-agents/hermes-local-static-facts/SKILL.md`
- `~/.hermes/skills/autonomous-ai-agents/hermes-profile-delegation-facts/SKILL.md`

拆分标准：

- 机器/目录/工具环境归 `local-static-facts`
- 河豚/海豹/默认 profile 调度约定归 `profile-delegation-facts`

除非执行时发现单技能明显失衡，否则优先保持一个技能，减少维护面。

---

## Step-by-step plan

### Task 1: 建立事实清单与归类表

**Objective:** 把现有 memory / SOUL 内容按“静态事实 / 共享事实 / 用户画像 / 项目事实 / 临时工作流”分类，得到可迁移范围。

**Files:**

- Read: `/Users/rainbowatcher/.hermes/memories/MEMORY.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/hetun/memories/MEMORY.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/haibao/memories/MEMORY.md`
- Read: `/Users/rainbowatcher/.hermes/SOUL.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/hetun/SOUL.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/haibao/SOUL.md`
- Create scratch note if needed: `/tmp/hermes-profile-memory-classification.md` 或仅在执行上下文中整理

**Step 1: 列出三份 MEMORY 的去重条目集合**

- 为每条事实标注来源：default / hetun / haibao / multiple。

**Step 2: 给每条事实打分类标签**

- `global-static`
- `cross-profile-shared`
- `project-specific`
- `thread-specific`
- `workflow-specific`
- `user-profile-like`

**Step 3: 标出候选迁移集合**

- 仅保留 `global-static` 与 `cross-profile-shared` 进入候选 skill。

**Verification:**

- 每条现存 memory 至少有一个分类。
- 能明确指出哪些条目不迁移，以及不迁移原因。

### Task 2: 定义信息边界与目标文件布局

**Objective:** 明确哪些内容应放 skill、哪些留 memory、哪些应移入/保留在 SOUL。

**Files:**

- Create: `~/.hermes/skills/autonomous-ai-agents/hermes-shared-profile-facts/SKILL.md`（或两个 skill 的文件路径）
- Modify: `/Users/rainbowatcher/.hermes/SOUL.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/hetun/SOUL.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/haibao/SOUL.md`
- Modify: `/Users/rainbowatcher/.hermes/memories/MEMORY.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/hetun/memories/MEMORY.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/haibao/memories/MEMORY.md`

**Step 1: 确认 skill 数量**

- 默认采用 1 个 skill。
- 仅当技能正文出现两组几乎独立的触发条件时才拆成 2 个。

**Step 2: 约定 SOUL / MEMORY / SKILL 分工**

- SOUL：profile 身份、语言规则、如何调度其他 profile 的行为约束。
- SKILL：共享可复用知识与调用背景。
- MEMORY：剩余的稳定事实，但不重复 skill / SOUL 已覆盖内容。

**Step 3: 写出迁移映射表**

- 例如：
  - “河豚=hetun / 海豹=haibao” → SOUL + shared skill
  - “Codex state/log path” → shared skill
  - “your-hermes skill management MVP 决策” → 暂留 memory
  - “Discord 某线程工作目录” → 暂留 memory 或后续移入项目文档

**Verification:**

- 每条候选迁移事实都有唯一落点。
- 不存在同一事实被要求同时留在三份 memory 且也完整复制到 skill 的情况。

### Task 3: 编写共享 skill 草案

**Objective:** 产出首个共享技能文稿，承载“全局静态事实 + 跨 Profile 共享事实”。

**Files:**

- Create: `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-shared-profile-facts/SKILL.md`
- Optional create if split: `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-local-static-facts/SKILL.md`
- Optional create if split: `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-profile-delegation-facts/SKILL.md`

**Step 1: 写 YAML frontmatter**
建议字段：

```yaml
---
name: hermes-shared-profile-facts
description: 本机 Hermes 的共享静态事实与多 profile 协作约定。
version: 0.1.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [hermes, profiles, memory, local-environment]
---
```

**Step 2: 写触发条件与非触发条件**

- 何时加载：涉及 profile 调度、本机 Hermes 路径、skills 目录、Codex 状态时。
- 何时不加载：纯项目实现、纯用户偏好、与本机环境无关的任务。

**Step 3: 组织正文结构**
建议章节：

- 概览
- 共享静态事实
- 跨 Profile 调度事实
- 已知边界 / 不要假设的内容
- 使用时检查清单

**Step 4: 只保留稳定且可复用内容**

- 以 declarative facts 为主，避免写成一次性操作指令。

**Verification:**

- skill 内容不包含线程级临时背景。
- skill 内容不复述用户画像。
- skill 能独立帮助 future agent 理解 profile 拓扑与本机 Hermes 路径事实。

### Task 4: 收敛 SOUL 中的 profile 定义

**Objective:** 让 profile 身份与调用约定只在该出现的位置出现，并减少与 memory 重复。

**Files:**

- Modify: `/Users/rainbowatcher/.hermes/SOUL.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/hetun/SOUL.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/haibao/SOUL.md`

**Step 1: 检查是否需要把“河豚/海豹”的映射只保留在 default SOUL**

- 如果 default 是统一调度入口，则映射主要应存在于 default SOUL。

**Step 2: 修正 haibao SOUL 的不对称性**

- 若 haibao SOUL 缺少对自身角色的清晰定义，补齐最小必要说明。

**Step 3: 避免在 SOUL 重复写路径型静态事实**

- 像 `.codex/log`、Hema Wiki 路径这类不应挤进 SOUL。

**Verification:**

- SOUL 更像 persona/行为约束，而不是杂项事实仓库。
- 三个 profile 的 role 关系表达一致，不自相矛盾。

### Task 5: 精简三份 MEMORY.md

**Objective:** 删除已被 skill / SOUL 固化的共享条目，只保留 memory 真正该存的稳定事实。

**Files:**

- Modify: `/Users/rainbowatcher/.hermes/memories/MEMORY.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/hetun/memories/MEMORY.md`
- Modify: `/Users/rainbowatcher/.hermes/profiles/haibao/memories/MEMORY.md`

**Step 1: 从 default MEMORY 删除已迁移共享事实**

- 例如 profile 调度约定、机器目录类静态事实，若已进 shared skill。

**Step 2: 从 hetun / haibao MEMORY 删除重复共享事实**

- 尤其是 default 已统一表达的跨 profile 内容。

**Step 3: 保留不能技能化的剩余事实**

- 例如明确项目实现决策、某工作区约束、仍需跨会话保留但不适合作为 skill 的内容。

**Step 4: 统一条目风格**

- 保持 declarative facts。
- 避免混入命令式指令或一次性任务说明。

**Verification:**

- 三份 memory 的重复度明显下降。
- 删除的每条内容都能在 skill 或 SOUL 中找到替代落点，或被确认不再需要。

### Task 6: 验证 skill 可发现性与信息完整性

**Objective:** 确认新 skill 能被 Hermes 发现，且 future agent 通过 skill 足以找回共享事实。

**Files:**

- Read: `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-shared-profile-facts/SKILL.md`
- Read: `/Users/rainbowatcher/.hermes/memories/MEMORY.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/hetun/memories/MEMORY.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/haibao/memories/MEMORY.md`
- Read: `/Users/rainbowatcher/.hermes/SOUL.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/hetun/SOUL.md`
- Read: `/Users/rainbowatcher/.hermes/profiles/haibao/SOUL.md`

**Step 1: 用 `skills_list` / `skill_view` 检查技能是否可见**

- 确认名称、描述、分类正确。

**Step 2: 回读 memory / SOUL / skill**

- 检查是否出现信息断裂。

**Step 3: 做一次情景验证**

- 例如模拟问题：
  - “河豚是什么 profile？”
  - “Codex 状态目录在哪？”
  - “本机真正的 Hermes skills 目录在哪？”
- 确认这些答案不再依赖三份重复 memory。

**Verification:**

- 共享事实至少能通过 skill 找回。
- profile 行为约定至少能通过 SOUL + skill 找回。
- memory 保留下来的内容更聚焦，不再是共享知识的重复副本。

---

## 候选迁移清单（基于当前已观察内容）

### 高优先级迁移到 skill 的候选

- `Hema Wiki is located at /Users/rainbowatcher/w/h/hema-wiki; ...`
- `In Hermes terminal subprocesses on this machine, Codex CLI works with the minimal override env HOME=/Users/rainbowatcher; ...`
- `On this machine, Codex CLI stores state under /Users/rainbowatcher/.codex ...`
- `On this machine, the real local Hermes skills source exists at /Users/rainbowatcher/.hermes/skills ...`
- “河豚/海豹”的 profile 别名与 default 调用约定（若不完全收敛进 SOUL，则至少在 skill 中保留共享说明）

### 更可能留在 memory 的内容

- `In the Discord thread “为什么项目启动后, 前端显示: 500 Internal Server Error”, the working directory is ...`
- `For the skill management page in your-hermes, user decided: first release should only cover ...`
- `User uses ~/w/h/hema-research as the destination repo for MLX/oMLX/Qwen research reports and notes.`
- `The research repo formerly named omlx-qwen-research is now hema-research ...`（是否迁移需看它更像环境事实还是项目事实）

### 需要二次判断的内容

- `For the user's WeCom/企业微信 context, the user currently lacks permissions ...`
  - 若常被不同 profile 复用，可考虑保留 memory；
  - 若已形成稳定工作流，可后续单独抽成 WeCom skill/notes，而不挤进本次 shared profile skill。

- `User wants implementation plans for your-hermes features to be reviewed by Codex after drafting ...`
  - 更像工作流偏好；若重复出现，可后续单独抽成 skill 或写入某个 planning skill patch。

---

## Files likely to change

优先级从高到低：

1. `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-shared-profile-facts/SKILL.md`
2. `/Users/rainbowatcher/.hermes/memories/MEMORY.md`
3. `/Users/rainbowatcher/.hermes/profiles/hetun/memories/MEMORY.md`
4. `/Users/rainbowatcher/.hermes/profiles/haibao/memories/MEMORY.md`
5. `/Users/rainbowatcher/.hermes/SOUL.md`
6. `/Users/rainbowatcher/.hermes/profiles/haibao/SOUL.md`
7. `/Users/rainbowatcher/.hermes/profiles/hetun/SOUL.md`

若拆成两个 skill，则还会新增：

- `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-local-static-facts/SKILL.md`
- `/Users/rainbowatcher/.hermes/skills/autonomous-ai-agents/hermes-profile-delegation-facts/SKILL.md`

---

## Tests / validation

本任务没有传统单元测试，验证应以配置可读性、一致性与可发现性为主：

1. 结构验证

- 新 skill 能被 `skills_list` 发现。
- `skill_view` 能正常读取新 skill。

2. 内容验证

- 对照迁移映射表，确认每条被删除的 memory 事实都有落点。
- 三份 memory 不再大面积重复。
- SOUL 中的 profile 关系表达对称且不冲突。

3. 场景验证

- 用 3~5 个模拟提问验证共享知识是否仍能找回。
- 确认 future agent 不需要依赖某个特定 profile 的 MEMORY 才能理解河豚/海豹和本机 Hermes 基础环境。

4. 回归检查

- 再次读取所有改动文件，确认没有把用户偏好错迁移进 skill。
- 确认没有把 thread-specific / project-specific 内容错误声明成“全局静态事实”。

---

## Risks, tradeoffs, open questions

### Risks

1. **误把项目事实当成全局静态事实**

- 例如 `hema-research` 仓库用途是否真的是跨 profile 基础事实，需要执行时再次判断。

2. **skill 与 SOUL 职责重叠**

- profile 调度约定既像 persona 规则，也像共享知识；如果边界不清，后面仍会继续漂移。

3. **过度迁移导致 memory 丢失上下文价值**

- 如果把仍然需要长期注入的事实都移走，future agent 可能反而更难立即获得上下文。

4. **单 skill 过重**

- 如果共享 skill 混入太多 unrelated facts，会降低触发精度；这时应及时拆分为两个 skill。

### Tradeoffs

- 单 skill 维护成本低，但可能过宽。
- 双 skill 边界更清晰，但初期维护面更大。
- 保留少量重复 memory 能提升即时注入命中率，但会牺牲一致性；本计划倾向于减少重复，接受少量手动 skill 加载成本。

### Open questions

1. `hema-research` 仓库相关两条事实，最终应归入 shared skill 还是继续留在 memory？
2. WeCom 权限限制应保留在 memory，还是后续抽成单独 skill / note？
3. Codex 复核 your-hermes 计划的约定，是否应作为 planning 工作流 skill 的 patch，而不是本次 shared facts skill 的一部分？
4. 是否需要让 haibao SOUL 明确补充“海豹=haibao”的自我说明，以消除当前不对称状态？

---

## 执行顺序建议

1. 先做 Task 1 / Task 2，冻结分类与边界。
2. 再落地 Task 3，先创建 skill，不急着删 memory。
3. 接着做 Task 4，收敛 SOUL。
4. 最后做 Task 5 / Task 6，清理 memory 并回归验证。

这样可以避免“先删 memory，后发现 skill / SOUL 还没覆盖完整”的回退成本。
