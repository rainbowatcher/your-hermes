/**
 * 负责：验证会话 lineage / family 识别规则。
 * 不负责：文件读取集成与 Vite API 挂载。
 */
import { describe, expect, test } from 'vitest'
import {
  branchKindLabel,
  buildFamilies,
  buildMessageKey,
  coarseFamilyKey,
  firstUserMessage,
  toComparableMessages,
  type SessionCandidate,
  type SessionLineageSummary,
} from '../lineage'

const prompts = {
  skillReviewPrompt:
    'Review the conversation above and consider saving or updating a skill if appropriate.',
  memoryReviewPrompt: 'Review the conversation above and consider saving to memory if appropriate.',
  combinedReviewPrompt: 'Review the conversation above and consider two things:',
}

function createCandidate(input: {
  id: string
  messages: string[]
  updatedAt?: string
}): SessionCandidate<SessionLineageSummary> {
  const rawMessages = input.messages.map((content, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content,
  }))

  return {
    summary: {
      id: input.id,
      title: input.messages[0] || input.id,
      summary: input.messages.at(-1) || input.id,
      createdAt: '2026-04-13T10:00:00.000Z',
      updatedAt: input.updatedAt || '2026-04-13T10:10:00.000Z',
      messageCount: rawMessages.length,
      toolMessageCount: 0,
      platform: 'discord',
      rootSessionId: input.id,
    },
    rawMessages,
    messageKeys: toComparableMessages(rawMessages),
    hasIndex: true,
    hasJsonl: true,
  }
}

describe('Hermes session lineage', () => {
  test('同 family 中的 review prompt 分叉会识别为 branch', () => {
    const rootMessages = Array.from({ length: 20 }, (_, index) => `共同消息 ${index + 1}`)
    const root = createCandidate({
      id: 'root',
      messages: [...rootMessages, '主会话继续', '继续回答', '继续追问', '继续补充'],
      updatedAt: '2026-04-13T10:20:00.000Z',
    })
    const branch = createCandidate({
      id: 'branch',
      messages: [...rootMessages, prompts.skillReviewPrompt, 'skill branch output'],
      updatedAt: '2026-04-13T10:15:00.000Z',
    })

    const families = buildFamilies([root, branch], prompts)

    expect(families).toHaveLength(1)
    expect(families[0].branches).toHaveLength(1)
    expect(families[0].branches[0].branchKind).toBe('skill-review')
    expect(branchKindLabel(families[0].branches[0].branchKind)).toBe('skill 提炼')
  })

  test('几乎完全一致的会话会识别为 duplicate', () => {
    const base = createCandidate({ id: 'root', messages: ['a', 'b', 'c', 'd', 'e', 'f'] })
    const duplicate = createCandidate({
      id: 'dup',
      messages: ['a', 'b', 'c', 'd', 'e', 'f'],
      updatedAt: '2026-04-13T10:09:00.000Z',
    })

    const families = buildFamilies([base, duplicate], prompts)

    expect(families).toHaveLength(1)
    expect(families[0].duplicates).toHaveLength(1)
    expect(families[0].branches).toHaveLength(0)
  })

  test('family key 由平台与首条用户消息决定', () => {
    const candidate = createCandidate({ id: 'root', messages: ['第一条用户消息', 'assistant'] })

    expect(firstUserMessage(candidate.rawMessages)).toBe('第一条用户消息')
    expect(buildMessageKey(candidate.rawMessages[0])).toBe('user:第一条用户消息')
    expect(coarseFamilyKey(candidate.summary, firstUserMessage(candidate.rawMessages))).toBe(
      'discord::第一条用户消息',
    )
  })
})
