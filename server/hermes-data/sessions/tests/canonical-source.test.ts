/**
 * 负责：验证 Hermes 会话 canonical source 规则与分组/状态推导护栏。
 * 不负责：文件读取集成、Vite API 路由测试。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vite-plus/test'
import {
  buildSessionGroupKey,
  chatTypeLabel,
  deriveCanonicalSessionFields,
} from '../canonical-source'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../../..')

describe('Hermes session canonical source', () => {
  test('@impl-spec hermes-session-data-sources/canonical_source_rule_1 只接受 sessions canonical source 字段', () => {
    const result = deriveCanonicalSessionFields({
      sessionFile: {
        platform: 'discord',
        session_start: '2026-04-13T10:00:00.000Z',
        last_updated: '2026-04-13T10:05:00.000Z',
        // 模拟调用方误传的非 canonical 字段
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      indexEntry: {
        created_at: '2026-04-13T09:59:00.000Z',
        updated_at: '2026-04-13T10:06:00.000Z',
        platform: 'discord',
        chat_type: 'thread',
        last_prompt_tokens: 42,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      issueCount: 0,
    })

    expect(result.workspace).toBe('未记录工作区')
    expect(result.pinned).toBe(false)
    expect(result.createdAt).toBe('2026-04-13T09:59:00.000Z')
    expect(result.updatedAt).toBe('2026-04-13T10:06:00.000Z')
    expect(result.tokenCount).toBe(42)
  })

  test('@impl-spec hermes-session-data-sources/canonical_source_rule_3 只有显式归档状态才会得到 archived', () => {
    const active = deriveCanonicalSessionFields({
      sessionFile: { platform: 'discord', session_start: '2026-04-13T10:00:00.000Z' },
      indexEntry: { chat_type: 'thread', suspended: false },
      issueCount: 0,
    })
    const attention = deriveCanonicalSessionFields({
      sessionFile: { platform: 'discord', session_start: '2026-04-13T10:00:00.000Z' },
      indexEntry: { chat_type: 'thread', suspended: false },
      issueCount: 2,
    })
    const archived = deriveCanonicalSessionFields({
      sessionFile: { platform: 'discord', session_start: '2026-04-13T10:00:00.000Z' },
      indexEntry: { chat_type: 'thread', suspended: true },
      issueCount: 0,
    })

    expect(active.status).toBe('active')
    expect(attention.status).toBe('attention')
    expect(archived.status).toBe('archived')
  })

  test('@impl-spec hermes-session-data-sources/canonical_source_rule_4 分组 key 不受 archived 状态影响', () => {
    const active = deriveCanonicalSessionFields({
      sessionFile: { platform: 'discord', session_start: '2026-04-13T10:00:00.000Z' },
      indexEntry: { chat_type: 'thread', suspended: false },
      issueCount: 0,
    })
    const archived = deriveCanonicalSessionFields({
      sessionFile: { platform: 'discord', session_start: '2026-04-13T10:00:00.000Z' },
      indexEntry: { chat_type: 'thread', suspended: true },
      issueCount: 0,
    })

    expect(buildSessionGroupKey(active.platform, active.chatType)).toBe(
      buildSessionGroupKey(archived.platform, archived.chatType),
    )
  })

  test('@impl-spec hermes-session-data-sources/canonical_source_rule_5 unknown chatType 文案必须保持未知语义', () => {
    expect(chatTypeLabel('unknown')).toBe('未知类型')
  })

  test('@impl-spec hermes-session-data-sources/canonical_source_rule_2 源码中不能重新引入 webui source', async () => {
    const source = await fs.readFile(path.join(repoRoot, 'server/hermes-sessions.ts'), 'utf8')

    expect(source.includes('WEBUI_SESSIONS_DIR')).toBe(false)
    expect(source.includes('loadWebUiMap(')).toBe(false)
    expect(source.includes("path.join(HERMES_HOME, 'webui'")).toBe(false)
  })
})
