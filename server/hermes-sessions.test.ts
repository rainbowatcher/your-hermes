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

import {
  clearSessionCacheForTest,
  loadSessionDetail,
  loadSessionSummaries,
} from './hermes-sessions'

describe('Hermes session summaries', () => {
  beforeEach(() => {
    clearSessionCacheForTest()
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

  test('消息内容为 input_text 数组时仍能返回会话列表', async () => {
    filesMock.loadIndexMap.mockResolvedValue({})
    filesMock.listSessionFiles.mockResolvedValue(['session_withauth.json'])
    filesMock.fileExists.mockResolvedValue(false)
    filesMock.readJsonFile.mockResolvedValueOnce({
      session_id: 'withauth',
      platform: 'cli',
      session_start: '2026-04-24T10:00:00.000Z',
      last_updated: '2026-04-24T10:01:00.000Z',
      messages: [
        { role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
        { role: 'assistant', content: 'hello' },
      ],
    })

    const sessions = await loadSessionSummaries()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('withauth')
    expect(sessions[0].title).toBe('hi')
  })

  test('tool 异常统计与详情标记保持一致', async () => {
    const sessionFile = {
      session_id: 'tooling',
      platform: 'cli',
      session_start: '2026-04-24T10:00:00.000Z',
      last_updated: '2026-04-24T10:05:00.000Z',
      messages: [
        { role: 'user', content: 'check tools' },
        { role: 'assistant', content: 'running checks' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-rg',
              call_id: 'call-rg',
              type: 'function',
              function: {
                name: 'terminal',
                arguments: '{"command":"rg missing src"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call-rg',
          content: '{"output":"","exit_code":1,"error":null}',
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-terminal-fail',
              call_id: 'call-terminal-fail',
              type: 'function',
              function: {
                name: 'terminal',
                arguments: '{"command":"git push origin main"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call-terminal-fail',
          content:
            '{"output":"fatal: unable to get password from user","exit_code":128,"error":null}',
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-skill-fail',
              call_id: 'call-skill-fail',
              type: 'function',
              function: {
                name: 'skill_view',
                arguments: '{"name":"missing-skill"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call-skill-fail',
          content: '{"success":false,"error":"Skill not found"}',
        },
      ],
    }

    filesMock.loadIndexMap.mockResolvedValue({})
    filesMock.listSessionFiles.mockResolvedValue(['session_tooling.json'])
    filesMock.fileExists.mockResolvedValue(false)
    filesMock.readJsonFile.mockResolvedValue(sessionFile)

    const sessions = await loadSessionSummaries()
    const detail = await loadSessionDetail('tooling')

    expect(sessions).toHaveLength(1)
    expect(sessions[0].issueCount).toBe(2)

    expect(detail).not.toBeNull()
    expect(detail?.issueCount).toBe(2)
    expect(detail?.messages.at(-1)?.role).toBe('tool')
    expect(detail?.messages.at(-1)?.hasError).toBe(true)
    expect(detail?.messages.at(-1)?.toolCalls?.map((toolCall) => toolCall.hasError)).toEqual([
      false,
      true,
      true,
    ])
    expect(detail?.messages.at(-1)?.toolCalls?.[1].errorDetail).toContain(
      'fatal: unable to get password from user',
    )
    expect(detail?.messages.at(-1)?.toolCalls?.[2].errorDetail).toBe('Skill not found')
  })
})
