/**
 * 负责：从 ~/.hermes 读取真实会话，并转换为前端所需的摘要与详情数据。
 * 不负责：UI 渲染、会话写回、消息发送。
 */
import fs from 'node:fs/promises'
import {
  deriveCanonicalSessionFields,
  type CanonicalHermesIndexEntry,
  type CanonicalHermesSessionFile,
} from './hermes-data/sessions/canonical-source.ts'
import {
  fileExists,
  listSessionFiles,
  loadIndexMap,
  readJsonFile,
  sessionFilePath,
  sessionJsonFilePath,
  sessionJsonlFilePath,
} from './hermes-data/sessions/files.ts'
import { buildSessionGraph, type SessionGraph } from './hermes-data/sessions/graph.ts'
import {
  branchKindLabel,
  coarseFamilyKey,
  firstUserMessage,
  toComparableMessages,
  type SessionBranchKind,
  type SessionCandidate,
  type SessionRelationKind,
} from './hermes-data/sessions/lineage.ts'
import {
  buildToolCallEntry,
  buildToolGroupMessage,
  classifyToolCallIssue,
  type ToolCallKind as NormalizedToolCallKind,
  type ToolCallMeta,
} from './hermes-data/sessions/tool-calls.ts'
import type { HermesProfileContext } from './hermes-profiles.ts'

const CACHE_TTL_MS = 3_000

const SKILL_REVIEW_PROMPT =
  'Review the conversation above and consider saving or updating a skill if appropriate.'
const MEMORY_REVIEW_PROMPT =
  'Review the conversation above and consider saving to memory if appropriate.'
const COMBINED_REVIEW_PROMPT = 'Review the conversation above and consider two things:'

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

interface RawHermesMessage {
  role?: string
  content?: unknown
  tool_call_id?: unknown
  tool_calls?: unknown
}

interface HermesSessionFile {
  session_id: string
  model?: string
  platform?: string
  session_start?: string
  last_updated?: string
  message_count?: number
  messages?: RawHermesMessage[]
}

export interface SessionParticipant {
  id: string
  name: string
  shortName: string
}

export type ToolCallKind = NormalizedToolCallKind

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
  errorDetail?: string
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
  relationKind: SessionRelationKind
  rootSessionId: string
  hiddenFromList: boolean
  branchKind?: SessionBranchKind
  branchLabel?: string
  branchCount: number
}

export interface SessionBranchSummary {
  id: string
  title: string
  summary: string
  createdAt: string
  updatedAt: string
  messageCount: number
  branchKind: SessionBranchKind
  branchLabel: string
  rootSessionId: string
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
  branches: SessionBranchSummary[]
}

interface LoadSessionOptions {
  profileContext: Pick<HermesProfileContext, 'summary' | 'sessionsDir'>
}

type SessionGraphRecord = SessionGraph<SessionSummary, SessionBranchSummary>

type ProfileSessionCacheRecord = {
  loadedAt: number
  graph: SessionGraphRecord
}

const listCache = new Map<string, ProfileSessionCacheRecord>()

function profileCacheKey(profileContext: Pick<HermesProfileContext, 'summary' | 'sessionsDir'>) {
  return `${profileContext.summary.id}:${profileContext.sessionsDir}`
}

function normalizeContent(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

function normalizeText(value: unknown) {
  return normalizeContent(value).replace(/\s+/g, ' ').trim()
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

function deriveTitle(indexEntry: HermesIndexEntry | undefined, sessionFile: HermesSessionFile) {
  const displayName = normalizeText(indexEntry?.display_name)
  if (displayName) {
    const parts = displayName
      .split(' / ')
      .map((part) => part.trim())
      .filter(Boolean)
    return parts.at(-1) || displayName
  }

  const firstUser = sessionFile.messages?.find(
    (message) => message.role === 'user' && normalizeText(message.content),
  )
  const firstUserContent = normalizeText(firstUser?.content)
  if (firstUserContent) {
    return truncate(firstUserContent, 72)
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

  const latestContent = normalizeText(latest?.content)
  return latestContent ? truncate(latestContent, 120) : '暂无可展示的摘要。'
}

function collectToolCallMeta(toolCalls: unknown, toolCallMeta: Map<string, ToolCallMeta>) {
  if (!Array.isArray(toolCalls)) {
    return
  }

  for (const toolCall of toolCalls) {
    if (!toolCall || typeof toolCall !== 'object') {
      continue
    }

    const record = toolCall as Record<string, unknown>
    const id =
      typeof record.call_id === 'string'
        ? record.call_id
        : typeof record.id === 'string'
          ? record.id
          : null
    const functionMeta =
      typeof record.function === 'object' && record.function
        ? (record.function as Record<string, unknown>)
        : null

    if (!id || !functionMeta) {
      continue
    }

    toolCallMeta.set(id, {
      name: typeof functionMeta.name === 'string' ? functionMeta.name : 'tool',
      arguments: typeof functionMeta.arguments === 'string' ? functionMeta.arguments : '',
    })
  }
}

function countToolIssues(messages: HermesSessionFile['messages']) {
  const toolCallMeta = new Map<string, ToolCallMeta>()
  let issueCount = 0

  for (const message of messages || []) {
    if (message.role === 'assistant') {
      collectToolCallMeta(message.tool_calls, toolCallMeta)
      continue
    }

    if (message.role !== 'tool') {
      continue
    }

    const content = normalizeContent(message.content)
    if (!normalizeText(content)) {
      continue
    }

    const toolCallId = typeof message.tool_call_id === 'string' ? message.tool_call_id : undefined
    const meta = toolCallId ? toolCallMeta.get(toolCallId) : undefined
    const issue = classifyToolCallIssue({
      content,
      name: meta?.name,
      argumentsText: meta?.arguments,
    })
    if (issue.hasError) {
      issueCount += 1
    }
  }

  return issueCount
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

function buildBranchSummary(summary: SessionSummary): SessionBranchSummary {
  return {
    id: summary.id,
    title: summary.title,
    summary: summary.summary,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    messageCount: summary.messageCount,
    branchKind: summary.branchKind || 'unknown',
    branchLabel: summary.branchLabel || branchKindLabel(summary.branchKind || 'unknown'),
    rootSessionId: summary.rootSessionId,
  }
}

function summarizeSession(
  profileContext: Pick<HermesProfileContext, 'sessionsDir'>,
  sessionFile: HermesSessionFile,
  indexEntry: HermesIndexEntry | undefined,
): SessionSummary {
  const messages = sessionFile.messages || []
  const roles = deriveAvailableRoles(messages)
  const toolMessages = messages.filter(
    (message) => message.role === 'tool' && normalizeText(message.content),
  )
  const issueCount = countToolIssues(messages)

  const canonical = deriveCanonicalSessionFields({
    sessionFile: sessionFile satisfies CanonicalHermesSessionFile,
    indexEntry: indexEntry satisfies CanonicalHermesIndexEntry | undefined,
    issueCount,
  })

  return {
    id: sessionFile.session_id,
    title: deriveTitle(indexEntry, sessionFile),
    workspace: canonical.workspace,
    channel: deriveChannel(indexEntry),
    sessionFilePath: `${sessionFile.session_id}.jsonl`,
    status: canonical.status,
    summary: deriveSummary(sessionFile),
    tags: canonical.tags,
    participants: deriveParticipants(indexEntry, roles),
    unreadCount: 0,
    pinned: canonical.pinned,
    updatedAt: canonical.updatedAt,
    createdAt: canonical.createdAt,
    model: normalizeText(sessionFile.model) || 'unknown',
    messageCount: sessionFile.message_count || messages.length,
    tokenCount: canonical.tokenCount,
    platform: canonical.platform,
    chatType: canonical.chatType,
    platformLabel: canonical.platformLabel,
    groupLabel: canonical.groupLabel,
    issueCount,
    toolMessageCount: toolMessages.length,
    availableRoles: roles,
    relationKind: 'root',
    rootSessionId: sessionFile.session_id,
    hiddenFromList: false,
    branchCount: 0,
  }
}

async function loadSessionGraph(options: LoadSessionOptions): Promise<SessionGraphRecord> {
  const cacheKey = profileCacheKey(options.profileContext)
  const cached = listCache.get(cacheKey)
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.graph
  }

  const [indexMap, sessionFiles] = await Promise.all([
    loadIndexMap<HermesIndexEntry>(options.profileContext.sessionsDir),
    listSessionFiles(options.profileContext.sessionsDir),
  ])
  const indexBySessionId = new Map<string, HermesIndexEntry>()

  for (const entry of Object.values(indexMap)) {
    if (entry.session_id) {
      indexBySessionId.set(entry.session_id, entry)
    }
  }

  const familyBuckets = new Map<string, SessionCandidate<SessionSummary>[]>()

  for (const file of sessionFiles) {
    const sessionFile = await readJsonFile<HermesSessionFile>(
      sessionFilePath(options.profileContext.sessionsDir, file),
    )
    if (!sessionFile?.session_id) continue
    const rawMessages = sessionFile.messages || []
    const summary = summarizeSession(
      options.profileContext,
      sessionFile,
      indexBySessionId.get(sessionFile.session_id),
    )
    const candidate: SessionCandidate<SessionSummary> = {
      summary,
      rawMessages,
      messageKeys: toComparableMessages(rawMessages),
      hasIndex: indexBySessionId.has(sessionFile.session_id),
      hasJsonl: await fileExists(
        sessionJsonlFilePath(options.profileContext.sessionsDir, sessionFile.session_id),
      ),
    }
    const familyKey = coarseFamilyKey(summary, firstUserMessage(rawMessages))
    const bucket = familyBuckets.get(familyKey)
    if (bucket) {
      bucket.push(candidate)
    } else {
      familyBuckets.set(familyKey, [candidate])
    }
  }

  const graph = buildSessionGraph<SessionSummary, SessionBranchSummary>({
    familyBuckets: familyBuckets.values(),
    prompts: {
      skillReviewPrompt: SKILL_REVIEW_PROMPT,
      memoryReviewPrompt: MEMORY_REVIEW_PROMPT,
      combinedReviewPrompt: COMBINED_REVIEW_PROMPT,
    },
    createRootSummary(summary, branchCount) {
      return {
        ...summary,
        relationKind: 'root',
        rootSessionId: summary.id,
        hiddenFromList: false,
        branchCount,
      }
    },
    createBranchRecords(summary, rootId, branchKind) {
      const branchSummary: SessionSummary = {
        ...summary,
        relationKind: 'branch',
        rootSessionId: rootId,
        hiddenFromList: true,
        branchKind,
        branchLabel: branchKindLabel(branchKind),
        branchCount: 0,
      }
      return {
        summary: branchSummary,
        branchSummary: buildBranchSummary(branchSummary),
      }
    },
  })
  listCache.set(cacheKey, { loadedAt: Date.now(), graph })
  return graph
}

export function clearSessionCacheForTest() {
  listCache.clear()
}

export async function loadSessionSummaries(options: LoadSessionOptions) {
  const graph = await loadSessionGraph(options)
  return graph.sessions
}

export async function loadSessionDetail(
  sessionId: string,
  options: LoadSessionOptions,
): Promise<SessionDetail | null> {
  const graph = await loadSessionGraph(options)
  const summary = graph.summariesById.get(sessionId)
  if (!summary) {
    return null
  }

  const jsonlFile = sessionJsonlFilePath(options.profileContext.sessionsDir, sessionId)
  const toolCallMeta = new Map<string, ToolCallMeta>()
  const messages: SessionMessage[] = []

  const flushToolBuffer = (buffer: ToolCallEntry[], startIndex: number, timestamp: string) => {
    if (!buffer.length) return
    messages.push(
      buildToolGroupMessage({ sessionId, startIndex, timestamp, toolCalls: [...buffer] }),
    )
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
        collectToolCallMeta(record.tool_calls, toolCallMeta)
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
        toolBuffer.push(buildToolCallEntry({ sessionId, index, content, meta, toolCallId }))
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
      sessionJsonFilePath(options.profileContext.sessionsDir, sessionId),
    )
    const toolBuffer: ToolCallEntry[] = []
    let toolBufferIndex = 0

    const flushFallbackToolBuffer = () => {
      if (!toolBuffer.length) return
      messages.push(
        buildToolGroupMessage({
          sessionId,
          startIndex: toolBufferIndex,
          timestamp: summary.updatedAt,
          toolCalls: [...toolBuffer],
        }),
      )
      toolBuffer.length = 0
    }

    for (const [index, message] of (sessionFile?.messages || []).entries()) {
      if (message.role === 'assistant') {
        collectToolCallMeta(message.tool_calls, toolCallMeta)
      }
      if (!isMessageRole(message.role)) continue
      const content = normalizeContent(message.content)
      const normalizedContent = normalizeText(content)
      if (
        (message.role === 'assistant' || message.role === 'user' || message.role === 'system') &&
        !normalizedContent
      )
        continue

      if (message.role === 'tool') {
        const toolCallId =
          typeof message.tool_call_id === 'string' ? message.tool_call_id : undefined
        const meta = toolCallId ? toolCallMeta.get(toolCallId) : undefined
        if (!toolBuffer.length) {
          toolBufferIndex = index
        }
        toolBuffer.push(
          buildToolCallEntry({
            sessionId,
            index,
            content,
            meta,
            toolCallId,
          }),
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
    branches: graph.branchesByRootId.get(summary.rootSessionId) || [],
  }
}
