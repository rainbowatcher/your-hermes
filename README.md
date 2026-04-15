# your-hermes

本地 Hermes 资源工作台。

项目面向 Hermes 本地数据与资源的浏览、整理和扩展，当前重点支持会话历史，后续可继续承载 skills 等更多本地资源。

## 当前能力

- 浏览本地 Hermes 会话历史
- 按平台、会话类型和状态查看会话
- 搜索、排序和路由同步
- 查看消息流与工具调用
- 识别 root / branch / duplicate 关系
- 直接读取真实本地数据，不依赖 mock

## 后续方向

这个项目不局限于 sessions 查看。除了会话历史，后续还可以继续接入：

- skills
- 本地配置
- 资源索引
- 其他 Hermes 相关本地数据

## 技术栈

- Vue 3
- TypeScript
- Vue Router
- Pinia
- Tailwind CSS v4
- Node.js
- Bun
- Vite+

## 项目结构

```text
src/       前端界面与交互
server/    本地 API 与资源读取
public/    静态资源
```

## 数据来源

当前默认读取：

```text
~/.hermes/sessions
```

当前主要使用：

- `sessions.json`
- `session_<id>.json`
- `<id>.jsonl`

## 开发

安装依赖：

```bash
vp install
```

启动前端开发环境：

```bash
vp dev
```

默认地址：

```text
http://127.0.0.1:4175
```

如需同时启动独立后端与前端：

```bash
bun server/dev.ts
```

## 构建与预览

构建：

```bash
vp build
```

预览：

```bash
vp preview
```

## API

当前提供：

```http
GET /api/health
GET /api/hermes/sessions
GET /api/hermes/sessions/:id
```

## TypeScript

项目按前端、构建配置、后端拆分 TS 配置，保证 LSP 和检查结果一致。

## 检查与测试

```bash
vp check
vp test
```
