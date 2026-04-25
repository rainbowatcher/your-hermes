/**
 * 负责：验证 Hermes skills API 路由可返回列表、详情与错误码。
 * 不负责：真实文件系统读取与前端界面行为。
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { handleHermesApiRequest } from './hermes-api'
import viteConfig from '../../vite.config'

const skillsMock = vi.hoisted(() => ({
  loadSkillSummaries: vi.fn<() => Promise<unknown[]>>(),
  loadSkillDetail: vi.fn<() => Promise<unknown | null>>(),
  isValidSkillPath: vi.fn<(path: string) => boolean>(),
}))

const memoryMock = vi.hoisted(() => ({
  loadMemoryInspect: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('../hermes-skills.ts', () => skillsMock)
vi.mock('../hermes-memory.ts', () => memoryMock)

function createResponse() {
  let body = ''
  const headers = new Map<string, string>()
  const response = {
    statusCode: 0,
    setHeader(name: string, value: string) {
      headers.set(name, value)
    },
    end(value: string) {
      body = value
    },
  }

  return { body: () => body, headers, response }
}

describe('Hermes API route', () => {
  beforeEach(() => {
    skillsMock.loadSkillSummaries.mockReset()
    skillsMock.loadSkillDetail.mockReset()
    skillsMock.isValidSkillPath.mockReset()
    memoryMock.loadMemoryInspect.mockReset()
  })

  test('开发服务器配置应直接处理 API，不能只反代独立后端', () => {
    expect(viteConfig.server?.proxy).toBeUndefined()
  })

  test('处理健康检查路由', async () => {
    const { body, headers, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/health', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(JSON.parse(body())).toEqual({ ok: true, service: 'your-hermes-server' })
  })

  test('返回 memory inspect 快照', async () => {
    memoryMock.loadMemoryInspect.mockResolvedValue({
      memory: {
        exists: true,
        rawContent: '记忆',
        charCount: 2,
        charLimit: 2200,
        updatedAt: '2026-04-25T00:00:00.000Z',
        entries: [],
      },
      user: {
        exists: false,
        rawContent: '',
        charCount: 0,
        charLimit: 1375,
        updatedAt: null,
        entries: [],
      },
    })
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/hermes/inspect/memory', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(memoryMock.loadMemoryInspect).toHaveBeenCalledTimes(1)
    expect(JSON.parse(body())).toEqual({
      memory: {
        exists: true,
        rawContent: '记忆',
        charCount: 2,
        charLimit: 2200,
        updatedAt: '2026-04-25T00:00:00.000Z',
        entries: [],
      },
      user: {
        exists: false,
        rawContent: '',
        charCount: 0,
        charLimit: 1375,
        updatedAt: null,
        entries: [],
      },
    })
  })

  test('返回技能列表', async () => {
    skillsMock.loadSkillSummaries.mockResolvedValue([{ relativePath: 'dogfood', title: 'Dogfood' }])
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/hermes/skills', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(body())).toEqual({ skills: [{ relativePath: 'dogfood', title: 'Dogfood' }] })
  })

  test('返回技能详情', async () => {
    skillsMock.isValidSkillPath.mockReturnValue(true)
    skillsMock.loadSkillDetail.mockResolvedValue({ relativePath: 'dogfood', title: 'Dogfood' })
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest(
      '/api/hermes/skills/detail?path=dogfood',
      response as never,
    )

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(skillsMock.loadSkillDetail).toHaveBeenCalledWith('dogfood')
    expect(JSON.parse(body())).toEqual({ skill: { relativePath: 'dogfood', title: 'Dogfood' } })
  })

  test('path 缺失或非法时返回 400', async () => {
    skillsMock.isValidSkillPath.mockReturnValue(false)

    const missing = createResponse()
    const invalid = createResponse()

    await handleHermesApiRequest('/api/hermes/skills/detail', missing.response as never)
    await handleHermesApiRequest(
      '/api/hermes/skills/detail?path=..%2Fescape',
      invalid.response as never,
    )

    expect(missing.response.statusCode).toBe(400)
    expect(JSON.parse(missing.body())).toEqual({ error: 'invalid skill path' })
    expect(invalid.response.statusCode).toBe(400)
    expect(JSON.parse(invalid.body())).toEqual({ error: 'invalid skill path' })
  })

  test('skill 不存在时返回 404', async () => {
    skillsMock.isValidSkillPath.mockReturnValue(true)
    skillsMock.loadSkillDetail.mockResolvedValue(null)
    const { body, response } = createResponse()

    await handleHermesApiRequest('/api/hermes/skills/detail?path=missing', response as never)

    expect(response.statusCode).toBe(404)
    expect(JSON.parse(body())).toEqual({ error: 'skill not found' })
  })
})
