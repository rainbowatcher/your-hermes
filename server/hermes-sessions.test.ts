/**
 * 负责：验证 Hermes sessions 加载流程关键回归。
 * 不负责：真实文件系统集成与 HTTP 路由测试。
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'

const filesMock = vi.hoisted(() => ({
  loadIndexMap: vi.fn<() => Promise<Record<string, unknown>>>(),
  listSessionFiles: vi.fn<() => Promise<string[]>>(),
  readJsonFile: vi.fn<() => Promise<unknown>>(),
  fileExists: vi.fn<() => Promise<boolean>>(),
  sessionFilePath: vi.fn<(fileName: string) => string>((fileName: string) => fileName),
  sessionJsonFilePath: vi.fn<(sessionId: string) => string>(
    (sessionId: string) => `${sessionId}.json`,
  ),
  sessionJsonlFilePath: vi.fn<(sessionId: string) => string>(
    (sessionId: string) => `${sessionId}.jsonl`,
  ),
}))

vi.mock('./hermes-data/sessions/files.ts', () => filesMock)

import { loadSessionSummaries } from './hermes-sessions'

describe('Hermes session summaries', () => {
  beforeEach(() => {
    filesMock.loadIndexMap.mockReset()
    filesMock.listSessionFiles.mockReset()
    filesMock.readJsonFile.mockReset()
    filesMock.fileExists.mockReset()
  })

  test('存在 branch 时仍能返回会话列表', async () => {
    filesMock.loadIndexMap.mockResolvedValue({})
    filesMock.listSessionFiles.mockResolvedValue(['session_root.json', 'session_branch.json'])
    filesMock.fileExists.mockResolvedValue(true)
    filesMock.readJsonFile
      .mockResolvedValueOnce({
        session_id: 'root',
        platform: 'discord',
        session_start: '2026-04-13T10:00:00.000Z',
        last_updated: '2026-04-13T10:20:00.000Z',
        messages: Array.from({ length: 24 }, (_, index) => ({
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: `共同消息 ${index + 1}`,
        })).concat([
          { role: 'user', content: '主会话继续' },
          { role: 'assistant', content: '继续回答' },
          { role: 'user', content: '继续追问' },
          { role: 'assistant', content: '继续补充' },
        ]),
      })
      .mockResolvedValueOnce({
        session_id: 'branch',
        platform: 'discord',
        session_start: '2026-04-13T10:00:00.000Z',
        last_updated: '2026-04-13T10:15:00.000Z',
        messages: Array.from({ length: 24 }, (_, index) => ({
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: `共同消息 ${index + 1}`,
        })).concat([
          {
            role: 'user',
            content:
              'Review the conversation above and consider saving or updating a skill if appropriate.',
          },
          { role: 'assistant', content: 'skill branch output' },
        ]),
      })

    const sessions = await loadSessionSummaries()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('root')
    expect(sessions[0].branchCount).toBe(1)
  })
})
