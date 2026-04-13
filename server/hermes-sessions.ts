/**
 * 负责：从 ~/.hermes 读取真实会话，并转换为前端所需的摘要与详情数据。
 * 不负责：UI 渲染、会话写回、消息发送。
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
const SESSIONS_DIR = path.join(HERMES_HOME, 'sessions')
const WEBUI_SESSIONS_DIR = path.join(HERMES_HOME, 'webui', 'sessions')
const INDEX_FILE = path.join(SESSIONS_DIR, 'sessions.json')
const CACHE_TTL_MS = 3_000

export type SessionStatus = 'active' | 'attention' | 'archived'
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

interface HermesIndexEntry {
  session_id: string
  created_at?: string
  updated_at?: string
  display_name?: string | null
  platform?: string | null
  chat_type?: string | null
  last_prompt_tokens?: number
  suspended?: boolean
  origin?: {
    chat_name?: string | null
    chat_type?: string | null
    user_id?: string | null
    user_name?: string | null
  }
}

interface HermesSessionFile {
  session_id: string
  model?: string
  platform?: string
  session_start?: string
  last_updated?: string
  message_count?: number
  messages?: Array<{
    role?: string
    content?: string | null
  }>
}

interface WebUiSessionFile {
  session_id: string
  title?: string
  workspace?: string
  pinned?: boolean
  archived?: boolean
  created_at?: string
  updated_at?: string
}

interface ToolCallMeta {
  name: string
  arguments: string
}

export interface SessionParticipant {
  id: string
  name: string
  shortName: string
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

let listCache: { loadedAt: number; sessions: SessionSummary[] } | null = null

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function truncate(value: string, max = 120) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function parseJsonSafe<T>(raw: string) {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function isMessageRole(value: string | undefined): value is MessageRole {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'tool'
}

function platformLabel(platform: string) {
  if (platform === 'discord') return 'Discord'
  if (platform === 'weixin') return '微信'
  if (platform === 'cli') return 'CLI'
  return platform || '未知来源'
}

function chatTypeLabel(chatType: string) {
  if (chatType === 'thread') return '线程'
  if (chatType === 'dm') return '私聊'
  if (chatType === 'group') return '群聊'
  if (chatType === 'cli') return '本地'
  return '历史存档'
}

function buildGroupLabel(platform: string, chatType: string) {
  return `${platformLabel(platform)} · ${chatTypeLabel(chatType)}`
}

function buildShortName(name: string) {
  const clean = normalizeText(name)
  if (!clean) return '??'
  return (
    clean
      .split(/[\s/_-]+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || clean.slice(0, 2).toUpperCase()
  )
}

function humanizeToolName(name: string | undefined) {
  const clean = normalizeText(name)
  if (!clean) return 'tool'
  return clean
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
}

function dedupeKey(summary: SessionSummary) {
  const normalizedChannel = normalizeText(summary.channel).toLowerCase()
  const channelPart = normalizedChannel === '未知会话来源' ? 'unknown-channel' : normalizedChannel
  return [summary.platform, channelPart, normalizeText(summary.title).toLowerCase()].join('::')
}

function deriveTitle(
  indexEntry: HermesIndexEntry | undefined,
  webuiEntry: WebUiSessionFile | undefined,
  sessionFile: HermesSessionFile,
) {
  const displayName = normalizeText(indexEntry?.display_name)
  if (displayName) {
    const parts = displayName
      .split(' / ')
      .map((part) => part.trim())
      .filter(Boolean)
    return parts.at(-1) || displayName
  }

  const webTitle = normalizeText(webuiEntry?.title)
  if (webTitle && webTitle !== 'Untitled') {
    return webTitle
  }

  const firstUser = sessionFile.messages?.find(
    (message) => message.role === 'user' && normalizeText(message.content),
  )
  if (firstUser?.content) {
    return truncate(normalizeText(firstUser.content), 72)
  }

  return sessionFile.session_id
}

function deriveChannel(indexEntry: HermesIndexEntry | undefined) {
  const displayName = normalizeText(indexEntry?.display_name || indexEntry?.origin?.chat_name)
  if (!displayName) {
    return '未知会话来源'
  }

  const parts = displayName
    .split(' / ')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts.slice(0, -1).join(' / ') : displayName
}

function deriveSummary(sessionFile: HermesSessionFile) {
  const messages = sessionFile.messages || []
  const latest = [...messages].reverse().find((message) => {
    const content = normalizeText(message.content)
    return (message.role === 'assistant' || message.role === 'user') && content
  })

  return latest?.content ? truncate(normalizeText(latest.content), 120) : '暂无可展示的摘要。'
}

function detectIssue(content: string) {
  const parsed = parseJsonSafe<Record<string, unknown>>(content)
  if (!parsed) {
    return /\berror\b/i.test(content)
  }

  const errorValue = parsed.error
  const exitCode = parsed.exit_code
  return Boolean(errorValue) || (typeof exitCode === 'number' && exitCode !== 0)
}

function deriveAvailableRoles(messages: HermesSessionFile['messages']) {
  const roles = new Set<MessageRole>()
  for (const message of messages || []) {
    if (isMessageRole(message.role)) {
      roles.add(message.role)
    }
  }
  return Array.from(roles)
}

function deriveParticipants(indexEntry: HermesIndexEntry | undefined, roles: MessageRole[]) {
  const participants: SessionParticipant[] = []
  const userName = normalizeText(indexEntry?.origin?.user_name) || 'User'

  if (roles.includes('user')) {
    participants.push({
      id: indexEntry?.origin?.user_id || 'user',
      name: userName,
      shortName: buildShortName(userName),
    })
  }

  if (roles.includes('assistant')) {
    participants.push({
      id: 'assistant',
      name: 'Hermes',
      shortName: 'HM',
    })
  }

  if (roles.includes('tool')) {
    participants.push({
      id: 'tool',
      name: 'Tool Runtime',
      shortName: 'TL',
    })
  }

  return participants
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function loadIndexMap() {
  return (await readJsonFile<Record<string, HermesIndexEntry>>(INDEX_FILE)) || {}
}

async function loadWebUiMap() {
  const map = new Map<string, WebUiSessionFile>()
  let files: string[] = []

  try {
    files = await fs.readdir(WEBUI_SESSIONS_DIR)
  } catch {
    return map
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const record = await readJsonFile<WebUiSessionFile>(path.join(WEBUI_SESSIONS_DIR, file))
    if (record?.session_id) {
      map.set(record.session_id, record)
    }
  }

  return map
}

async function listSessionFiles() {
  const files = await fs.readdir(SESSIONS_DIR)
  return files
    .filter((file) => /^session_.+\.json$/u.test(file))
    .sort()
    .reverse()
}

function summarizeSession(
  sessionFile: HermesSessionFile,
  indexEntry: HermesIndexEntry | undefined,
  webuiEntry: WebUiSessionFile | undefined,
): SessionSummary {
  const messages = sessionFile.messages || []
  const roles = deriveAvailableRoles(messages)
  const toolMessages = messages.filter(
    (message) => message.role === 'tool' && normalizeText(message.content),
  )
  const platform = normalizeText(sessionFile.platform || indexEntry?.platform) || 'unknown'
  const chatType =
    normalizeText(indexEntry?.chat_type || indexEntry?.origin?.chat_type) ||
    (platform === 'cli' ? 'cli' : 'unknown')
  const createdAt =
    webuiEntry?.created_at ||
    indexEntry?.created_at ||
    sessionFile.session_start ||
    sessionFile.last_updated ||
    new Date().toISOString()
  const updatedAt =
    webuiEntry?.updated_at || indexEntry?.updated_at || sessionFile.last_updated || createdAt

  let issueCount = 0
  for (const message of toolMessages) {
    if (message.content && detectIssue(message.content)) {
      issueCount += 1
    }
  }

  let status: SessionStatus = 'archived'
  if (webuiEntry?.archived === true || indexEntry?.suspended === true) {
    status = 'archived'
  } else if (issueCount > 0) {
    status = 'attention'
  } else if (indexEntry?.session_id) {
    status = 'active'
  }

  const tags = [
    platform,
    chatType,
    issueCount > 0 ? 'tool-error' : '',
    webuiEntry?.pinned ? 'pinned' : '',
  ].filter(Boolean)

  return {
    id: sessionFile.session_id,
    title: deriveTitle(indexEntry, webuiEntry, sessionFile),
    workspace: normalizeText(webuiEntry?.workspace) || '未记录工作区',
    channel: deriveChannel(indexEntry),
    sessionFilePath: path.join(SESSIONS_DIR, `${sessionFile.session_id}.jsonl`),
    status,
    summary: deriveSummary(sessionFile),
    tags,
    participants: deriveParticipants(indexEntry, roles),
    unreadCount: 0,
    pinned: Boolean(webuiEntry?.pinned),
    updatedAt,
    createdAt,
    model: normalizeText(sessionFile.model) || 'unknown',
    messageCount: sessionFile.message_count || messages.length,
    tokenCount: indexEntry?.last_prompt_tokens || 0,
    platform,
    chatType,
    platformLabel: platformLabel(platform),
    groupLabel: buildGroupLabel(platform, chatType),
    issueCount,
    toolMessageCount: toolMessages.length,
    availableRoles: roles,
  }
}

export async function loadSessionSummaries() {
  if (listCache && Date.now() - listCache.loadedAt < CACHE_TTL_MS) {
    return listCache.sessions
  }

  const [indexMap, webuiMap, sessionFiles] = await Promise.all([
    loadIndexMap(),
    loadWebUiMap(),
    listSessionFiles(),
  ])
  const indexBySessionId = new Map<string, HermesIndexEntry>()

  for (const entry of Object.values(indexMap)) {
    if (entry.session_id) {
      indexBySessionId.set(entry.session_id, entry)
    }
  }

  const deduped = new Map<string, SessionSummary>()
  for (const file of sessionFiles) {
    const sessionFile = await readJsonFile<HermesSessionFile>(path.join(SESSIONS_DIR, file))
    if (!sessionFile?.session_id) continue
    const summary = summarizeSession(
      sessionFile,
      indexBySessionId.get(sessionFile.session_id),
      webuiMap.get(sessionFile.session_id),
    )
    const key = dedupeKey(summary)
    const existing = deduped.get(key)
    if (!existing || +new Date(summary.updatedAt) > +new Date(existing.updatedAt)) {
      deduped.set(key, summary)
    }
  }

  const sessions = Array.from(deduped.values()).sort(
    (left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt),
  )
  listCache = { loadedAt: Date.now(), sessions }
  return sessions
}

function toolCallKind(name: string | undefined): ToolCallKind {
  if (!name) {
    return 'tool'
  }

  return /^skills?_/.test(name) ? 'skill' : 'tool'
}

function toolContentByKind(parsed: Record<string, unknown> | null, kind: ToolCallKind) {
  if (!parsed) {
    return ''
  }

  const segments: string[] = []

  if (kind === 'skill') {
    if (typeof parsed.content === 'string' && parsed.content.trim()) {
      segments.push(parsed.content)
    }
    if (typeof parsed.description === 'string' && parsed.description.trim() && !segments.length) {
      segments.push(parsed.description)
    }
  } else {
    if (typeof parsed.output === 'string' && parsed.output.trim()) {
      segments.push(parsed.output)
    }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      segments.push(parsed.error)
    }
    if (typeof parsed.message === 'string' && parsed.message.trim() && !segments.length) {
      segments.push(parsed.message)
    }
    if (typeof parsed.content === 'string' && parsed.content.trim() && !segments.length) {
      segments.push(parsed.content)
    }
  }

  return segments.join('\n\n').trim()
}

function deriveToolPreview(
  parsed: Record<string, unknown> | null,
  raw: string,
  kind: ToolCallKind,
) {
  if (parsed) {
    const previewKeys =
      kind === 'skill'
        ? ['description', 'name', 'summary', 'content']
        : ['message', 'output', 'error', 'summary', 'content']
    for (const key of previewKeys) {
      const value = parsed[key]
      if (typeof value === 'string' && normalizeText(value)) {
        return truncate(normalizeText(value), 140)
      }
    }

    const keys = Object.keys(parsed)
    if (keys.length) {
      return truncate(`{ ${keys.slice(0, 5).join(', ')} }`, 140)
    }
  }

  return truncate(normalizeText(raw) || '空工具输出', 140)
}

function parseToolArguments(argumentsText: string | undefined) {
  if (!argumentsText) {
    return null
  }

  return parseJsonSafe<Record<string, unknown>>(argumentsText)
}

function normalizeToolSubject(value: unknown, max = 140) {
  if (typeof value !== 'string') {
    return ''
  }

  const clean = normalizeText(value)
  return clean ? truncate(clean, max) : ''
}

function deriveToolEventLabel(name: string) {
  if (/^skills?_/.test(name)) {
    return 'skill'
  }

  return humanizeToolName(name)
}

function deriveToolSubject(name: string, args: Record<string, unknown> | null) {
  const pathValue = normalizeToolSubject(args?.path)
  const nameValue = normalizeToolSubject(args?.name)
  const commandValue = normalizeToolSubject(args?.command)
  const urlValue = normalizeToolSubject(args?.url)
  const queryValue = normalizeToolSubject(args?.query)
  const promptValue = normalizeToolSubject(args?.prompt)
  const keyValue = normalizeToolSubject(args?.key)
  const actionValue = normalizeToolSubject(args?.action)
  const targetValue = normalizeToolSubject(args?.target)
  const refValue = normalizeToolSubject(args?.ref)
  const directionValue = normalizeToolSubject(args?.direction)
  const goalValue = normalizeToolSubject(args?.goal)
  const filePathValue = normalizeToolSubject(args?.file_path)
  const oldTextValue = normalizeToolSubject(args?.old_text)
  const sessionIdValue = normalizeToolSubject(args?.session_id)
  const questionValue = normalizeToolSubject(args?.question)

  if (name === 'read_file' || name === 'write_file' || name === 'patch') {
    return pathValue || filePathValue || '未指定路径'
  }

  if (name === 'search_files') {
    const patternValue = normalizeToolSubject(args?.pattern)
    const scopeValue = normalizeToolSubject(args?.path)
    if (patternValue && scopeValue) {
      return `${patternValue} @ ${scopeValue}`
    }
    return patternValue || scopeValue || '未指定查询'
  }

  if (name === 'terminal') {
    return commandValue || '未指定命令'
  }

  if (name === 'execute_code') {
    return normalizeToolSubject(args?.code) || 'python'
  }

  if (name === 'todo') {
    const todos = Array.isArray(args?.todos) ? args.todos : []
    const firstTodo = todos[0]
    if (firstTodo && typeof firstTodo === 'object' && 'content' in firstTodo) {
      return normalizeToolSubject(firstTodo.content, 80) || '更新任务清单'
    }
    return '更新任务清单'
  }

  if (name === 'process') {
    return [actionValue, sessionIdValue].filter(Boolean).join(' · ') || '进程操作'
  }

  if (name === 'browser_navigate') {
    return urlValue || '未指定地址'
  }

  if (
    name === 'browser_click' ||
    name === 'browser_type' ||
    name === 'browser_press' ||
    name === 'browser_scroll'
  ) {
    return refValue || keyValue || directionValue || '浏览器交互'
  }

  if (name === 'browser_console' || name === 'browser_vision') {
    return normalizeToolSubject(args?.expression) || questionValue || '浏览器检查'
  }

  if (name === 'session_search') {
    return queryValue || 'recent sessions'
  }

  if (name === 'memory') {
    return [actionValue, targetValue || normalizeToolSubject(args?.content, 80)]
      .filter(Boolean)
      .join(' · ')
  }

  if (name === 'skill_view' || name === 'skill_manage') {
    return nameValue || filePathValue || actionValue || '未指定技能'
  }

  if (name === 'skills_list') {
    return normalizeToolSubject(args?.category) || 'all'
  }

  if (name === 'delegate_task') {
    return goalValue || '委派任务'
  }

  if (name === 'clarify') {
    return questionValue || '需要确认'
  }

  if (name === 'cronjob') {
    return [actionValue, normalizeToolSubject(args?.name) || promptValue]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    nameValue ||
    pathValue ||
    commandValue ||
    queryValue ||
    promptValue ||
    goalValue ||
    oldTextValue ||
    'details'
  )
}

function deriveToolTitle(name: string, argumentsText: string | undefined) {
  const args = parseToolArguments(argumentsText)
  const eventLabel = deriveToolEventLabel(name)
  const subject = deriveToolSubject(name, args)
  return `${eventLabel}: ${subject}`
}

function buildToolCallEntry(
  sessionId: string,
  index: number,
  content: string,
  meta?: ToolCallMeta,
  toolCallId?: string,
): ToolCallEntry {
  const parsed = parseJsonSafe<Record<string, unknown>>(content)
  const rawJson = parsed ? JSON.stringify(parsed, null, 2) : content
  const hasError = detectIssue(content)
  const name = meta?.name || 'tool'
  const kind = toolCallKind(name)
  const primaryContent = toolContentByKind(parsed, kind)

  return {
    id: `${sessionId}-tool-call-${index}`,
    title: deriveToolTitle(name, meta?.arguments),
    name,
    kind,
    preview: deriveToolPreview(parsed, content, kind),
    rawJson,
    primaryContent,
    toolArguments: meta?.arguments,
    toolCallId,
    hasError,
  }
}

function buildToolGroupMessage(
  sessionId: string,
  startIndex: number,
  timestamp: string,
  toolCalls: ToolCallEntry[],
): SessionMessage {
  return {
    id: `${sessionId}-tool-group-${startIndex}`,
    role: 'tool',
    author: `${toolCalls.length} 次工具调用`,
    timestamp,
    content: '',
    preview: truncate(toolCalls.map((call) => `${call.title}: ${call.preview}`).join(' · '), 180),
    hasError: toolCalls.some((call) => Boolean(call.hasError)),
    collapsedByDefault: true,
    toolCalls,
  }
}

export async function loadSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const summaries = await loadSessionSummaries()
  const summary = summaries.find((item) => item.id === sessionId)
  if (!summary) {
    return null
  }

  const jsonlFile = path.join(SESSIONS_DIR, `${sessionId}.jsonl`)
  const toolCallMeta = new Map<string, ToolCallMeta>()
  const messages: SessionMessage[] = []

  const flushToolBuffer = (buffer: ToolCallEntry[], startIndex: number, timestamp: string) => {
    if (!buffer.length) return
    messages.push(buildToolGroupMessage(sessionId, startIndex, timestamp, [...buffer]))
    buffer.length = 0
  }

  if (await fileExists(jsonlFile)) {
    const raw = await fs.readFile(jsonlFile, 'utf8')
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const toolBuffer: ToolCallEntry[] = []
    let toolBufferIndex = 0
    let toolBufferTimestamp = summary.updatedAt

    for (let index = 0; index < lines.length; index += 1) {
      const record = parseJsonSafe<Record<string, unknown>>(lines[index])
      if (!record) continue

      const role = record.role
      const timestamp = typeof record.timestamp === 'string' ? record.timestamp : summary.updatedAt

      if (role === 'assistant' && Array.isArray(record.tool_calls)) {
        for (const toolCall of record.tool_calls as Array<Record<string, unknown>>) {
          const id =
            typeof toolCall.call_id === 'string'
              ? toolCall.call_id
              : typeof toolCall.id === 'string'
                ? toolCall.id
                : null
          const functionMeta =
            typeof toolCall.function === 'object' && toolCall.function
              ? (toolCall.function as Record<string, unknown>)
              : null
          if (!id || !functionMeta) continue
          toolCallMeta.set(id, {
            name: typeof functionMeta.name === 'string' ? functionMeta.name : 'tool',
            arguments: typeof functionMeta.arguments === 'string' ? functionMeta.arguments : '',
          })
        }
      }

      if (role === 'session_meta') continue
      if (!isMessageRole(typeof role === 'string' ? role : undefined)) continue
      const normalizedRole = role as MessageRole
      const content = typeof record.content === 'string' ? record.content : ''
      const normalizedContent = normalizeText(content)

      if (
        (normalizedRole === 'assistant' ||
          normalizedRole === 'user' ||
          normalizedRole === 'system') &&
        !normalizedContent
      ) {
        continue
      }

      if (normalizedRole === 'tool') {
        const toolCallId = typeof record.tool_call_id === 'string' ? record.tool_call_id : undefined
        const meta = toolCallId ? toolCallMeta.get(toolCallId) : undefined
        if (!toolBuffer.length) {
          toolBufferIndex = index
          toolBufferTimestamp = timestamp
        }
        toolBuffer.push(buildToolCallEntry(sessionId, index, content, meta, toolCallId))
        continue
      }

      flushToolBuffer(toolBuffer, toolBufferIndex, toolBufferTimestamp)
      messages.push({
        id: `${sessionId}-${normalizedRole}-${index}`,
        role: normalizedRole,
        author:
          normalizedRole === 'assistant'
            ? 'Hermes'
            : normalizedRole === 'user'
              ? summary.participants[0]?.name || 'User'
              : 'System',
        timestamp,
        content,
        preview: truncate(normalizedContent, 140),
      })
    }

    flushToolBuffer(toolBuffer, toolBufferIndex, toolBufferTimestamp)
  }

  if (!messages.length) {
    const sessionFile = await readJsonFile<HermesSessionFile>(
      path.join(SESSIONS_DIR, `session_${sessionId}.json`),
    )
    const toolBuffer: ToolCallEntry[] = []
    let toolBufferIndex = 0

    const flushFallbackToolBuffer = () => {
      if (!toolBuffer.length) return
      messages.push(
        buildToolGroupMessage(sessionId, toolBufferIndex, summary.updatedAt, [...toolBuffer]),
      )
      toolBuffer.length = 0
    }

    for (const [index, message] of (sessionFile?.messages || []).entries()) {
      if (!isMessageRole(message.role)) continue
      const content = message.content || ''
      const normalizedContent = normalizeText(content)
      if (
        (message.role === 'assistant' || message.role === 'user' || message.role === 'system') &&
        !normalizedContent
      )
        continue

      if (message.role === 'tool') {
        if (!toolBuffer.length) {
          toolBufferIndex = index
        }
        toolBuffer.push(
          buildToolCallEntry(sessionId, index, content, { name: 'tool', arguments: '' }),
        )
        continue
      }

      flushFallbackToolBuffer()
      messages.push({
        id: `${sessionId}-${message.role}-${index}`,
        role: message.role,
        author:
          message.role === 'assistant'
            ? 'Hermes'
            : message.role === 'user'
              ? summary.participants[0]?.name || 'User'
              : 'System',
        timestamp: summary.updatedAt,
        content,
        preview: truncate(normalizedContent, 140),
      })
    }

    flushFallbackToolBuffer()
  }

  return {
    ...summary,
    messages,
  }
}
