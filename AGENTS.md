# AGENTS.md

本文件为参与 `your-hermes` 的 AI 编码代理提供项目级工作约定。优先遵循离当前文件最近的 `AGENTS.md`；子目录中的指引会覆盖本文件的同名规则。

## 项目定位

`your-hermes` 是一个本地 Hermes 资源工作台，用于浏览、整理和扩展本机 Hermes 数据。当前核心是会话历史浏览，后续可继续接入技能、本地配置、资源索引等 Hermes 相关资源。

## 技术栈与运行时

- 前端：Vue 3、TypeScript、Vue Router、Pinia、Tailwind CSS v4。
- 后端：Node.js / Bun 上的本地 API 与 Hermes 数据读取逻辑。
- 构建与测试：Vite、Vitest、Playwright browser mode、Oxlint、Oxfmt、vue-tsc。
- 包管理器：`bun@1.3.12`（见 `package.json#packageManager`）。

## 目录导览

- `src/`：前端界面、状态管理、路由、浏览器端测试。
- `src/api/`：前端调用本地 Hermes API 的客户端封装。
- `src/components/history/`：会话历史、消息流、工具调用展示相关组件。
- `src/components/ui/`：通用 UI 组件；该目录还有更近的 `AGENTS.md`，修改时必须同时遵守。
- `src/stores/`：Pinia store。
- `src/types/`：前端共享类型。
- `server/`：本地 API、开发服务器、Hermes 数据解析与服务端测试。
- `server/hermes-data/sessions/`：会话数据读取、规范来源、谱系、工具调用等领域逻辑。
- `docs/analysis/`：分析文档。
- `dist/`：构建产物；通常不要手改。

## 数据与边界

- 默认读取真实本地数据：`~/.hermes/sessions`。
- 主要数据文件包括：`sessions.json`、`session_<id>.json`、`<id>.jsonl`。
- 代码应把本地数据视为不完全可信：字段可能缺失、历史格式可能不一致、JSONL 行可能异常。
- 读取与归一化逻辑优先放在 `server/hermes-data/**`，避免把 Hermes 原始数据格式细节泄漏到 Vue 组件里。

## 常用命令

优先使用 `bun` / `package.json` 中已有脚本，不要引入新的包管理器或锁文件。

```bash
bun install
HOME=/Users/rainbowatcher bun run dev
bun run build
bun run test
bun run test:server
bun run test:browser
bun run fmt
bun run fmt:check
bun run lint
```

启动开发服务时必须显式声明 `HOME=/Users/rainbowatcher`，例如 `HOME=/Users/rainbowatcher bun run dev -- --host 127.0.0.1`。Hermes 运行环境中的默认 `HOME` 可能指向 `/Users/rainbowatcher/.hermes/home`，会导致本地 Hermes 数据目录解析到错误位置，例如技能目录被解析为不存在的 `/Users/rainbowatcher/.hermes/home/.hermes/skills`。

也可以使用 Vite+ 包装命令：

```bash
vp install
vp dev
vp build
vp test
```

注意：当前 `package.json` 明确使用 Bun，除非任务明确要求迁移工具链，否则不要用 npm、pnpm 或 Yarn 修改依赖。

## 开发工作流

1. 开始前查看 `git status --short --branch`，确认是否存在用户未提交修改。
2. 只修改完成任务所需文件；不要顺手重构无关代码、格式化全仓库或更新构建产物。
3. 依赖变更必须同步更新 `package.json` 与对应 lockfile，并说明原因。
4. 修改前端交互时，优先补充或更新 `src/**/*.browser.test.ts`。
5. 修改服务端数据解析、API 或文件系统读取时，优先补充或更新 `server/**/*.test.ts`。
6. 完成后至少运行与改动范围相关的检查；无法运行时在最终说明中写明原因。

## 测试策略

- 服务端单元/集成测试：`bun run test:server`。
- 浏览器组件测试：`bun run test:browser`。
- 全量测试：`bun run test`。
- 类型、构建与格式/静态检查：根据改动范围运行 `bun run build`、`bun run lint`、`bun run fmt:check`。
- 对 Hermes 会话数据处理的改动，应覆盖：缺失字段、重复/分支关系、规范来源、JSONL 消息流与工具调用等边界。
- 避免依赖真实用户数据的脆弱断言；测试中使用最小化 fixture 或临时目录。

## 代码约定

- 使用 TypeScript，避免 `any`；需要处理未知数据时先建类型守卫或归一化函数。
- Vue 组件保持展示职责，复杂数据推导放入 store、API 层或纯函数。
- API 返回值应稳定、可序列化，并尽量屏蔽文件系统路径和原始错误细节。
- 文件系统访问集中在服务端层；前端不得直接假设本机 Hermes 目录结构。
- 保持现有代码风格：单引号、无分号、组合式 API、路径别名 `@` 指向 `src`。
- 代码注释只解释非显然约束、数据兼容性或设计原因，不要复述代码。

## UI 与可访问性

- 优先复用 `src/components/ui/` 中已有组件和变体。
- 修改 UI 组件时遵守 `src/components/ui/AGENTS.md`。
- 保持键盘可访问性、语义化结构、合理的加载 / 空内容 / 错误状态。
- 会话和消息列表可能很长，避免引入明显的重复重渲染或同步重计算。

## 本地 API 约定

当前公开 API 包括：

```http
GET /api/health
GET /api/hermes/sessions
GET /api/hermes/sessions/:id
```

- 新增 API 时，把路由处理放在 `server/api/hermes-api.ts`，业务读取和转换放在 `server/hermes-data/**`。
- 错误响应应可诊断但不暴露不必要的本机细节。
- 前端调用入口优先集中在 `src/api/hermes.ts`。

## Git 与提交

- 不要覆盖、删除或回滚用户已有改动，除非任务明确要求。
- 若仓库已有 merge/rebase 状态，先确认当前状态并避免破坏正在进行的操作。
- 提交信息使用简洁英文 Conventional Commit 风格，例如：`docs: rewrite agent guide`。
- 若只改文档，提交前通常不需要运行完整测试，但应检查 Markdown 内容和 `git diff`。

## 代理最终回复清单

完成任务后说明：

- 修改了哪些文件。
- 运行了哪些检查/测试及结果。
- 是否提交以及提交哈希。
- 若有未处理的既有工作区状态，明确标注为非本次修改。
