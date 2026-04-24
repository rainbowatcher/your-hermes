# Hermes 会话数据来源实现约束

## 范围

本约束适用于 `server/hermes-data/sessions/` 及其调用方中与会话规范来源、状态推导、分组语义相关的实现。

## 规则

### 规范来源规则 1

会话摘要/详情的规范来源仅允许来自：

- `~/.hermes/sessions/sessions.json`
- `~/.hermes/sessions/session_*.json`
- `~/.hermes/sessions/*.jsonl`

### 规范来源规则 2

`~/.hermes/webui/**` 不能参与以下字段的补源或覆盖：

- `title`
- `workspace`
- `pinned`
- `archived`
- `createdAt`
- `updatedAt`

### 规范来源规则 3

`archived` 只能由显式规范来源状态推导；`unknown chatType`、fallback 文案、缺失索引都不能把会话推导为 `archived`。

### 规范来源规则 4

会话列表分组键只能由 `platform + chatType` 决定；`archived` 仅作为会话状态展示与筛选条件，不能参与分组语义。

### 规范来源规则 5

未知 `chatType` 的展示文案必须表达“未知类型”语义，不能使用“历史存档”之类会混淆状态语义的文案。
