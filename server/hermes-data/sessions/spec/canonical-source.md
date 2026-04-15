# Hermes Session Data Sources 实现约束

## 范围

本约束适用于 `server/hermes-data/sessions/` 及其调用方中与会话 canonical source、状态推导、分组语义相关的实现。

## 规则

### canonical_source_rule_1

会话 summary/detail 的 canonical source 仅允许来自：

- `~/.hermes/sessions/sessions.json`
- `~/.hermes/sessions/session_*.json`
- `~/.hermes/sessions/*.jsonl`

### canonical_source_rule_2

`~/.hermes/webui/**` 不能参与以下字段的补源或覆盖：

- `title`
- `workspace`
- `pinned`
- `archived`
- `createdAt`
- `updatedAt`

### canonical_source_rule_3

`archived` 只能由显式 canonical source 状态推导；`unknown chatType`、fallback 文案、缺失索引都不能把会话推导为 `archived`。

### canonical_source_rule_4

会话列表分组 key 只能由 `platform + chatType` 决定；`archived` 仅作为会话状态展示与筛选条件，不能参与分组语义。

### canonical_source_rule_5

未知 `chatType` 的展示文案必须表达“未知类型”语义，不能使用“历史存档”之类会混淆状态语义的文案。
