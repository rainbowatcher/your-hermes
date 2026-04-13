# Hermes 会话分支识别分析

## 背景

当前会话历史 UI 之前使用 `platform + channel + title` 的粗粒度规则去重。这会把两类不同对象混在一起：

1. 真实重复快照
2. 从主会话 fork 出来的系统派生会话

其中最典型的一类是 Hermes 自动发起的 skill review 会话：它们不是用户继续对话，而是后台拿主会话快照再追加固定 review prompt 的派生分支。

## Hermes 源码结论

### 1. 上下文压缩续写是显式分支

在 `~/.hermes/hermes-agent/run_agent.py` 中，context compression 会：

- 结束旧 session
- 新建新的 `session_id`
- 在 SQLite `sessions` 表里写入 `parent_session_id=old_session_id`

对应位置：

- `run_agent.py:6593-6603`
- `hermes_state.py` schema 中 `sessions.parent_session_id`

这类分支属于 Hermes 明确定义的 lineage，后续如果接入 `state.db`，应优先直接使用该关系。

### 2. skill / memory review 是隐式 fork

在 `run_agent.py` 的 `_spawn_background_review()` 中，Hermes 会：

- 基于主会话 `messages_snapshot`
- 新建一个 `AIAgent`
- 不复用原 `session_id`
- 追加固定 review prompt 作为下一条 user message

固定 prompt 包括：

- `Review the conversation above and consider saving or updating a skill if appropriate.`
- `Review the conversation above and consider saving to memory if appropriate.`
- `Review the conversation above and consider two things:`

这类 fork 没有显式 `parent_session_id`，但会形成非常长的共同消息前缀，并在分叉点出现固定系统 prompt。

## 当前实现策略

本仓库当前先落地“隐式 skill 分支识别”，不直接依赖 `state.db`：

1. 先按 `platform + channel + first user message` 做 coarse family 分桶
2. family 内按以下优先级选 root：
   - 在 `sessions.json` 索引中
   - 存在 `.jsonl`
   - 消息数更多
   - 更新时间更晚
3. 用消息前缀比较区分：
   - **branch**：共同前缀足够长，且分叉首条 user message 命中固定 review prompt
   - **duplicate**：几乎完全一致，但没有 review prompt 分叉
   - **new root**：其余情况
4. 左侧 session list 只显示 root
5. branch 只在详情侧栏显示，并可点击进入 branch 详情

## 当前已支持的 branch kind

- `skill-review`
- `memory-review`
- `combined-review`
- `unknown`

`compression` 已在类型中预留，但当前版本尚未从 `state.db` 读取显式 parent 关系。

## 为什么不再只靠 title 去重

只靠标题会误合并：

- 同频道、同标题但实际上是不同对话的 session
- 主会话与 skill review 分支
- 同一问题的多次独立重启会话

消息前缀 + 固定 review prompt 更接近 Hermes 自身的真实运行语义。

## 后续建议

下一步可进一步读取 `~/.hermes/state.db`：

- 若 `parent_session_id` 存在，直接标记为 `compression` branch
- 与当前隐式 fork 识别并行使用
- 优先信显式 lineage，再回退到内容启发式判断
