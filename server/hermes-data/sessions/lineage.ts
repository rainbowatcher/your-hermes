/**
 * 负责：识别会话 family、branch 与 duplicate 关系。
 * 不负责：文件读取、字段归一化、消息渲染。
 */
export type SessionRelationKind = 'root' | 'branch' | 'duplicate'
export type SessionBranchKind =
  | 'skill-review'
  | 'memory-review'
  | 'combined-review'
  | 'compression'
  | 'unknown'

export interface RawComparableMessage {
  role?: string
  content?: string | null
}

export interface SessionLineageSummary {
  id: string
  title: string
  summary: string
  createdAt: string
  updatedAt: string
  messageCount: number
  toolMessageCount: number
  platform: string
  rootSessionId: string
  branchKind?: SessionBranchKind
  branchLabel?: string
}

export interface SessionCandidate<TSummary extends SessionLineageSummary> {
  summary: TSummary
  rawMessages: RawComparableMessage[]
  messageKeys: string[]
  hasIndex: boolean
  hasJsonl: boolean
}

export interface SessionFamily<TSummary extends SessionLineageSummary> {
  root: SessionCandidate<TSummary>
  branches: Array<{ candidate: SessionCandidate<TSummary>; branchKind: SessionBranchKind }>
  duplicates: SessionCandidate<TSummary>[]
}

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function buildMessageKey(message: RawComparableMessage) {
  const role = typeof message.role === 'string' ? message.role : 'unknown'
  const content = normalizeText(message.content)
  return content ? `${role}:${content}` : ''
}

export function firstUserMessage(messages: RawComparableMessage[]) {
  for (const message of messages) {
    if (message.role !== 'user') continue
    const content = normalizeText(message.content)
    if (content) {
      return content.toLowerCase()
    }
  }
  return ''
}

export function toComparableMessages(messages: RawComparableMessage[]) {
  return messages.map(buildMessageKey).filter(Boolean)
}

export function coarseFamilyKey<TSummary extends SessionLineageSummary>(
  summary: TSummary,
  firstUser: string,
) {
  const firstUserPart = firstUser || normalizeText(summary.title).toLowerCase()
  return [summary.platform, firstUserPart].join('::')
}

function sessionPriority<TSummary extends SessionLineageSummary>(
  candidate: SessionCandidate<TSummary>,
) {
  return [
    candidate.hasIndex ? 1 : 0,
    candidate.hasJsonl ? 1 : 0,
    candidate.summary.messageCount,
    candidate.summary.toolMessageCount,
    +new Date(candidate.summary.updatedAt),
  ]
}

export function comparePriority<TSummary extends SessionLineageSummary>(
  left: SessionCandidate<TSummary>,
  right: SessionCandidate<TSummary>,
) {
  const leftPriority = sessionPriority(left)
  const rightPriority = sessionPriority(right)
  for (let index = 0; index < leftPriority.length; index += 1) {
    const delta = rightPriority[index] - leftPriority[index]
    if (delta !== 0) {
      return delta
    }
  }
  return right.summary.id.localeCompare(left.summary.id)
}

function commonPrefixLength(left: string[], right: string[]) {
  const max = Math.min(left.length, right.length)
  let index = 0
  while (index < max && left[index] === right[index]) {
    index += 1
  }
  return index
}

export function branchKindLabel(branchKind: SessionBranchKind) {
  if (branchKind === 'skill-review') return 'skill 提炼'
  if (branchKind === 'memory-review') return 'memory 提炼'
  if (branchKind === 'combined-review') return 'memory / skill 提炼'
  if (branchKind === 'compression') return '压缩续写'
  return '派生分支'
}

export function detectReviewBranchKindFromKey(
  messageKey: string | undefined,
  prompts: {
    skillReviewPrompt: string
    memoryReviewPrompt: string
    combinedReviewPrompt: string
  },
): SessionBranchKind | null {
  if (!messageKey || !messageKey.startsWith('user:')) {
    return null
  }

  const content = messageKey.slice('user:'.length)
  if (!content) {
    return null
  }

  if (content.startsWith(prompts.skillReviewPrompt)) {
    return 'skill-review'
  }
  if (content.startsWith(prompts.memoryReviewPrompt)) {
    return 'memory-review'
  }
  if (content.startsWith(prompts.combinedReviewPrompt)) {
    return 'combined-review'
  }
  return null
}

export function classifyRelation<TSummary extends SessionLineageSummary>(
  root: SessionCandidate<TSummary>,
  candidate: SessionCandidate<TSummary>,
  prompts: {
    skillReviewPrompt: string
    memoryReviewPrompt: string
    combinedReviewPrompt: string
  },
): { type: SessionRelationKind; branchKind?: SessionBranchKind } | null {
  const shorterLength = Math.min(root.messageKeys.length, candidate.messageKeys.length)
  if (shorterLength < 4) {
    return null
  }

  const prefixLength = commonPrefixLength(root.messageKeys, candidate.messageKeys)
  const prefixRatio = prefixLength / shorterLength
  const divergenceKey = candidate.messageKeys[prefixLength]
  const reviewBranchKind = detectReviewBranchKindFromKey(divergenceKey, prompts)

  if (reviewBranchKind && prefixLength >= 20 && prefixRatio >= 0.8) {
    return { type: 'branch', branchKind: reviewBranchKind }
  }

  if (prefixRatio >= 0.95 && prefixLength >= shorterLength - 1) {
    return { type: 'duplicate' }
  }

  return null
}

export function buildFamilies<TSummary extends SessionLineageSummary>(
  candidates: SessionCandidate<TSummary>[],
  prompts: {
    skillReviewPrompt: string
    memoryReviewPrompt: string
    combinedReviewPrompt: string
  },
) {
  const families: SessionFamily<TSummary>[] = []

  for (const candidate of [...candidates].sort(comparePriority)) {
    let assigned = false
    for (const family of families) {
      const relation = classifyRelation(family.root, candidate, prompts)
      if (!relation) {
        continue
      }

      if (relation.type === 'branch') {
        family.branches.push({ candidate, branchKind: relation.branchKind || 'unknown' })
        assigned = true
        break
      }

      family.duplicates.push(candidate)
      assigned = true
      break
    }

    if (!assigned) {
      families.push({ root: candidate, branches: [], duplicates: [] })
    }
  }

  return families
}
