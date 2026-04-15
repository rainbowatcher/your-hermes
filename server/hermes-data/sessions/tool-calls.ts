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
  detectIssue: (content: string) => boolean
  index: number
  meta?: ToolCallMeta
  sessionId: string
  toolCallId?: string
}): ToolCallEntryRecord {
  const { content, detectIssue, index, meta, sessionId, toolCallId } = input
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
