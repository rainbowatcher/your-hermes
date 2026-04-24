/**
 * 负责：验证工具调用异常识别与错误详情提取规则。
 * 不负责：会话文件读取集成与前端渲染。
 */
import { describe, expect, test } from 'vitest'
import { buildToolCallEntry, classifyToolCallIssue } from '../tool-calls'

describe('tool call issue classification', () => {
  test('terminal 非零退出码会识别为异常', () => {
    const issue = classifyToolCallIssue({
      name: 'terminal',
      argumentsText: '{"command":"git push origin main"}',
      content: JSON.stringify({
        output: 'fatal: unable to get password from user',
        exit_code: 128,
        error: null,
      }),
    })

    expect(issue.hasError).toBe(true)
    expect(issue.errorDetail).toContain('fatal: unable to get password from user')
  })

  test('terminal 旧语义下 rg=1 不会识别为异常', () => {
    const issue = classifyToolCallIssue({
      name: 'terminal',
      argumentsText: '{"command":"rg missing src"}',
      content: JSON.stringify({
        output: '',
        exit_code: 1,
        error: null,
      }),
    })

    expect(issue.hasError).toBe(false)
  })

  test('exit_code=0 但 output 内层 JSON 带 error 时仍识别为异常', () => {
    const issue = classifyToolCallIssue({
      name: 'terminal',
      argumentsText: '{"command":"python check.py"}',
      content: JSON.stringify({
        output: '{"error":"Missing API key"}',
        exit_code: 0,
        error: null,
      }),
    })

    expect(issue).toEqual({
      hasError: true,
      errorDetail: 'Missing API key',
    })
  })

  test('success=false 的技能调用会识别为异常', () => {
    const issue = classifyToolCallIssue({
      name: 'skill_view',
      content: JSON.stringify({
        success: false,
        error: 'Skill not found',
      }),
    })

    expect(issue).toEqual({
      hasError: true,
      errorDetail: 'Skill not found',
    })
  })

  test('status=error 的 execute_code 结果会识别为异常', () => {
    const issue = classifyToolCallIssue({
      name: 'execute_code',
      content: JSON.stringify({
        status: 'error',
        output: 'Traceback (most recent call last):\nValueError: bad json',
      }),
    })

    expect(issue.hasError).toBe(true)
    expect(issue.errorDetail).toContain('Traceback')
  })

  test('旧格式 read_file 文本里包含 error 单词时不算异常', () => {
    const issue = classifyToolCallIssue({
      name: 'read_file',
      content: '[read_file] read /tmp/demo.txt from line 1 (contains the word error in body)',
    })

    expect(issue.hasError).toBe(false)
  })

  test('重复占位文本不算异常', () => {
    const issue = classifyToolCallIssue({
      name: 'todo',
      content: '[Duplicate tool output — same content as a more recent call]',
    })

    expect(issue.hasError).toBe(false)
  })

  test('buildToolCallEntry 会复用统一分类器结果', () => {
    const toolCall = buildToolCallEntry({
      sessionId: 'session-1',
      index: 3,
      toolCallId: 'call-1',
      meta: {
        name: 'browser_navigate',
        arguments: '{"url":"https://example.com"}',
      },
      content: JSON.stringify({
        success: false,
        error: 'page.goto: net::ERR_CONNECTION_CLOSED',
      }),
    })

    expect(toolCall.hasError).toBe(true)
    expect(toolCall.errorDetail).toContain('ERR_CONNECTION_CLOSED')
  })
})
