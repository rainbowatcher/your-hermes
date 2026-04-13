/**
 * 负责：定义会话历史查看所需的数据类型。
 * 不负责：数据获取、路由同步、界面渲染。
 */
export type SessionStatus = 'active' | 'attention' | 'archived'
export type SessionStatusFilter = 'all' | SessionStatus
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type MessageRoleFilter = 'all' | MessageRole
export type ToolMessageViewMode = 'output' | 'raw'

export interface SessionParticipant {
  id: string
  name: string
  shortName: string
  accent?: string
}

export type ToolCallKind = 'tool' | 'skill'

export interface ToolCallEntry {
  id: string
  title: string
  name: string
  kind: ToolCallKind
  preview: string
  rawJson: string
  primaryContent: string
  toolArguments?: string
  toolCallId?: string
  hasError?: boolean
}

export interface SessionMessage {
  id: string
  role: MessageRole
  author: string
  timestamp: string
  content: string
  preview: string
  hasError?: boolean
  collapsedByDefault?: boolean
  toolCalls?: ToolCallEntry[]
}

export interface SessionSummary {
  id: string
  title: string
  workspace: string
  channel: string
  sessionFilePath: string
  status: SessionStatus
  summary: string
  tags: string[]
  participants: SessionParticipant[]
  unreadCount: number
  pinned: boolean
  updatedAt: string
  createdAt: string
  model: string
  messageCount: number
  tokenCount: number
  platform: string
  chatType: string
  platformLabel: string
  groupLabel: string
  issueCount: number
  toolMessageCount: number
  availableRoles: MessageRole[]
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
}

export type SessionRecord = SessionDetail
