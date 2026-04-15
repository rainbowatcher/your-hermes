/**
 * 负责：定义 Hermes 会话 canonical source 规则，以及基于 canonical source 的状态/分组推导。
 * 不负责：文件读取、消息解析、分支识别、Vite API 挂载。
 */
export type CanonicalSessionStatus = 'active' | 'attention' | 'archived'

export interface CanonicalHermesIndexEntry {
  created_at?: string
  updated_at?: string
  platform?: string | null
  chat_type?: string | null
  last_prompt_tokens?: number
  suspended?: boolean
  origin?: {
    chat_type?: string | null
  }
}

export interface CanonicalHermesSessionFile {
  platform?: string
  session_start?: string
  last_updated?: string
}

export interface CanonicalSessionFields {
  createdAt: string
  updatedAt: string
  platform: string
  chatType: string
  platformLabel: string
  groupLabel: string
  status: CanonicalSessionStatus
  pinned: boolean
  workspace: string
  tokenCount: number
  tags: string[]
}

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function platformLabel(platform: string) {
  if (platform === 'discord') return 'Discord'
  if (platform === 'weixin') return '微信'
  if (platform === 'cli') return 'CLI'
  return platform || '未知来源'
}

export function chatTypeLabel(chatType: string) {
  if (chatType === 'thread') return '线程'
  if (chatType === 'dm') return '私聊'
  if (chatType === 'group') return '群聊'
  if (chatType === 'cli') return '本地'
  return '未知类型'
}

export function buildGroupLabel(platform: string, chatType: string) {
  return `${platformLabel(platform)} · ${chatTypeLabel(chatType)}`
}

export function buildSessionGroupKey(platform: string, chatType: string) {
  return `${platform}:${chatType}`
}

export function deriveCanonicalSessionFields(input: {
  indexEntry?: CanonicalHermesIndexEntry
  issueCount: number
  nowIso?: string
  sessionFile: CanonicalHermesSessionFile
}): CanonicalSessionFields {
  const { indexEntry, issueCount, nowIso, sessionFile } = input
  const platform = normalizeText(sessionFile.platform || indexEntry?.platform) || 'unknown'
  const chatType =
    normalizeText(indexEntry?.chat_type || indexEntry?.origin?.chat_type) ||
    (platform === 'cli' ? 'cli' : 'unknown')
  const createdAt =
    indexEntry?.created_at ||
    sessionFile.session_start ||
    sessionFile.last_updated ||
    nowIso ||
    new Date().toISOString()
  const updatedAt = indexEntry?.updated_at || sessionFile.last_updated || createdAt
  const status: CanonicalSessionStatus =
    indexEntry?.suspended === true ? 'archived' : issueCount > 0 ? 'attention' : 'active'

  return {
    createdAt,
    updatedAt,
    platform,
    chatType,
    platformLabel: platformLabel(platform),
    groupLabel: buildGroupLabel(platform, chatType),
    status,
    pinned: false,
    workspace: '未记录工作区',
    tokenCount: indexEntry?.last_prompt_tokens || 0,
    tags: [platform, chatType, issueCount > 0 ? 'tool-error' : ''].filter(Boolean),
  }
}
