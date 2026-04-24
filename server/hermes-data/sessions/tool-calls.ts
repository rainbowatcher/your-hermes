/**
 * 负责：归一化 Hermes 会话中的工具调用与工具分组消息。
 * 不负责：会话文件读取、branch 识别、前端渲染。
 */
export type ToolCallKind = 'tool' | 'skill'

export interface ToolCallMeta {
  name: string
  arguments: string
}

export interface ToolCallEntryRecord {
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

export interface ToolGroupMessageRecord {
  id: string
  role: 'tool'
  author: string
  timestamp: string
  content: string
  preview: string
  hasError?: boolean
  collapsedByDefault?: boolean
  toolCalls: ToolCallEntryRecord[]
}

export interface ToolCallIssueRecord {
  hasError: boolean
  errorDetail?: string
}

const DUPLICATE_TOOL_OUTPUT_PLACEHOLDER = '[Duplicate tool output — same content as a more recent call]'
const EXPECTED_EXIT_CODE_MEANING_RE = /\b(?:not an error|expected)\b/i
const LEGACY_EXPECTED_EXIT_CODES = new Map<string, Set<number>>([
  ['grep', new Set([1])],
  ['egrep', new Set([1])],
  ['fgrep', new Set([1])],
  ['rg', new Set([1])],
  ['ag', new Set([1])],
  ['ack', new Set([1])],
  ['diff', new Set([1])],
  ['colordiff', new Set([1])],
  ['test', new Set([1])],
  ['[', new Set([1])],
])

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

function parseJsonRecord(raw: string) {
  const parsed = parseJsonSafe<unknown>(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  return parsed as Record<string, unknown>
}

export function toolCallKind(name: string | undefined): ToolCallKind {
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

function stringifyErrorValue(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || undefined
  }

  if (Array.isArray(value)) {
    return value.length ? JSON.stringify(value, null, 2) : undefined
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length ? JSON.stringify(value, null, 2) : undefined
  }

  return undefined
}

function summarizeText(value: string | undefined, maxLines = 3, maxLength = 320) {
  if (!value) {
    return undefined
  }

  const lines = value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
  if (!lines.length) {
    return undefined
  }

  const summary = lines.slice(0, maxLines).join('\n').trim()
  return truncate(summary, maxLength)
}

function extractCommandBase(argumentsText: string | undefined) {
  const args = parseToolArguments(argumentsText)
  const command = typeof args?.command === 'string' ? args.command.trim() : ''
  if (!command) {
    return undefined
  }

  const segments = command.split(/\s*(?:\|\||&&|[|;])\s*/)
  const lastSegment = (segments.at(-1) || command).trim()
  if (!lastSegment) {
    return undefined
  }

  const words = lastSegment.split(/\s+/)
  for (const word of words) {
    if (word.includes('=') && !word.startsWith('-')) {
      continue
    }
    return word.split('/').at(-1)
  }

  return undefined
}

function isLegacyExpectedExitCode(name: string | undefined, argumentsText: string | undefined, exitCode: number) {
  if (name !== 'terminal') {
    return false
  }

  const commandBase = extractCommandBase(argumentsText)
  if (!commandBase) {
    return false
  }

  return LEGACY_EXPECTED_EXIT_CODES.get(commandBase)?.has(exitCode) || false
}

function extractNestedOutputIssue(output: unknown) {
  if (typeof output !== 'string' || !output.trim()) {
    return undefined
  }

  const nested = parseJsonRecord(output)
  if (!nested) {
    return undefined
  }

  const nestedError = stringifyErrorValue(nested.error)
  if (nestedError) {
    return nestedError
  }

  if (nested.status === 'error') {
    return (
      summarizeText(typeof nested.message === 'string' ? nested.message : undefined) ||
      summarizeText(typeof nested.output === 'string' ? nested.output : undefined) ||
      summarizeText(output)
    )
  }

  return undefined
}

function classifyPlainTextIssue(content: string, name: string | undefined): ToolCallIssueRecord {
  const normalized = content.trim()
  if (!normalized || normalized === DUPLICATE_TOOL_OUTPUT_PLACEHOLDER) {
    return { hasError: false }
  }

  if ((name === 'terminal' || /^\[terminal\]/i.test(normalized)) && /->\s*exit\s*(-?\d+)\b/i.test(normalized)) {
    const match = normalized.match(/->\s*exit\s*(-?\d+)\b/i)
    if (match && Number(match[1]) !== 0) {
      return { hasError: true, errorDetail: normalized }
    }
  }

  if (/^(?:\[[^\]]+\]\s*(?:error|failed)\b|Traceback\b)/i.test(normalized)) {
    return { hasError: true, errorDetail: normalized }
  }

  return { hasError: false }
}

export function classifyToolCallIssue(input: {
  argumentsText?: string
  content: string
  name?: string
}): ToolCallIssueRecord {
  const { argumentsText, content, name } = input
  const parsed = parseJsonRecord(content)
  if (!parsed) {
    return classifyPlainTextIssue(content, name)
  }

  const topLevelError = stringifyErrorValue(parsed.error)
  if (topLevelError) {
    return {
      hasError: true,
      errorDetail: topLevelError,
    }
  }

  if (parsed.success === false) {
    return {
      hasError: true,
      errorDetail:
        summarizeText(typeof parsed.message === 'string' ? parsed.message : undefined) ||
        summarizeText(typeof parsed.output === 'string' ? parsed.output : undefined) ||
        summarizeText(content),
    }
  }

  if (parsed.status === 'error') {
    return {
      hasError: true,
      errorDetail:
        summarizeText(typeof parsed.message === 'string' ? parsed.message : undefined) ||
        summarizeText(typeof parsed.output === 'string' ? parsed.output : undefined) ||
        summarizeText(content),
    }
  }

  const exitCode = typeof parsed.exit_code === 'number' ? parsed.exit_code : undefined
  if (exitCode !== undefined && exitCode !== 0) {
    const exitCodeMeaning =
      typeof parsed.exit_code_meaning === 'string' ? parsed.exit_code_meaning : undefined

    if (
      (exitCodeMeaning && EXPECTED_EXIT_CODE_MEANING_RE.test(exitCodeMeaning)) ||
      isLegacyExpectedExitCode(name, argumentsText, exitCode)
    ) {
      return { hasError: false }
    }

    return {
      hasError: true,
      errorDetail:
        summarizeText(typeof parsed.output === 'string' ? parsed.output : undefined) ||
        summarizeText(content),
    }
  }

  if (exitCode === 0) {
    const nestedIssue = extractNestedOutputIssue(parsed.output)
    if (nestedIssue) {
      return {
        hasError: true,
        errorDetail: nestedIssue,
      }
    }
  }

  return { hasError: false }
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

  return (
    normalizeText(name)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .toLowerCase() || 'tool'
  )
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

export function buildToolCallEntry(input: {
  content: string
  index: number
  meta?: ToolCallMeta
  sessionId: string
  toolCallId?: string
}): ToolCallEntryRecord {
  const { content, index, meta, sessionId, toolCallId } = input
  const parsed = parseJsonRecord(content)
  const rawJson = parsed ? JSON.stringify(parsed, null, 2) : content
  const name = meta?.name || 'tool'
  const kind = toolCallKind(name)
  const primaryContent = toolContentByKind(parsed, kind)
  const issue = classifyToolCallIssue({
    content,
    name,
    argumentsText: meta?.arguments,
  })

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
    hasError: issue.hasError,
    errorDetail: issue.errorDetail,
  }
}

export function buildToolGroupMessage(input: {
  sessionId: string
  startIndex: number
  timestamp: string
  toolCalls: ToolCallEntryRecord[]
}): ToolGroupMessageRecord {
  const { sessionId, startIndex, timestamp, toolCalls } = input
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
