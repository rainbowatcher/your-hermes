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
  isValidSkillPath: vi.fn<(path: string, options?: unknown) => boolean>(),
}))

const memoryMock = vi.hoisted(() => ({
  loadMemoryInspect: vi.fn<() => Promise<unknown>>(),
}))

const sessionsMock = vi.hoisted(() => ({
  loadSessionSummaries: vi.fn<() => Promise<unknown[]>>(),
  loadSessionDetail: vi.fn<() => Promise<unknown | null>>(),
}))

const profilesMock = vi.hoisted(() => ({
  InvalidHermesProfileError: class InvalidHermesProfileError extends Error {
    constructor() {
      super('非法 profile')
      this.name = 'InvalidHermesProfileError'
    }
  },
  listHermesProfiles: vi.fn<() => Promise<unknown[]>>(),
  resolveHermesProfileContext: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('../hermes-skills.ts', () => skillsMock)
vi.mock('../hermes-memory.ts', () => memoryMock)
vi.mock('../hermes-sessions.ts', () => sessionsMock)
vi.mock('../hermes-profiles.ts', () => profilesMock)

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

const defaultProfileContext = {
  summary: { id: 'default', label: 'Default', isDefault: true, available: true },
  hermesHome: '/Users/test/.hermes',
  sessionsDir: '/Users/test/.hermes/sessions',
  skillsRoot: '/Users/test/.hermes/skills',
  memoriesDir: '/Users/test/.hermes/memories',
}

describe('Hermes API route', () => {
  beforeEach(() => {
    skillsMock.loadSkillSummaries.mockReset()
    skillsMock.loadSkillDetail.mockReset()
    skillsMock.isValidSkillPath.mockReset()
    memoryMock.loadMemoryInspect.mockReset()
    sessionsMock.loadSessionSummaries.mockReset()
    sessionsMock.loadSessionDetail.mockReset()
    profilesMock.listHermesProfiles.mockReset()
    profilesMock.resolveHermesProfileContext.mockReset()
    profilesMock.resolveHermesProfileContext.mockResolvedValue(defaultProfileContext)
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

  test('返回 profile 列表', async () => {
    profilesMock.listHermesProfiles.mockResolvedValue([
      { id: 'default', label: 'Default', isDefault: true, available: true },
      { id: 'hetun', label: 'hetun', isDefault: false, available: true },
    ])
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/hermes/profiles', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(body())).toEqual({
      profiles: [
        { id: 'default', label: 'Default', isDefault: true, available: true },
        { id: 'hetun', label: 'hetun', isDefault: false, available: true },
      ],
    })
  })

  test('返回 sessions 列表并透传 profile context', async () => {
    sessionsMock.loadSessionSummaries.mockResolvedValue([{ id: 'session-1' }])
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/hermes/sessions?profile=hetun', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(profilesMock.resolveHermesProfileContext).toHaveBeenCalledWith('hetun')
    expect(sessionsMock.loadSessionSummaries).toHaveBeenCalledWith({
      profileContext: defaultProfileContext,
    })
    expect(JSON.parse(body())).toEqual({ sessions: [{ id: 'session-1' }] })
  })

  test('返回 session 详情并透传 profile context', async () => {
    sessionsMock.loadSessionDetail.mockResolvedValue({ id: 'session-1' })
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest(
      '/api/hermes/sessions/session-1?profile=haibao',
      response as never,
    )

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(profilesMock.resolveHermesProfileContext).toHaveBeenCalledWith('haibao')
    expect(sessionsMock.loadSessionDetail).toHaveBeenCalledWith('session-1', {
      profileContext: defaultProfileContext,
    })
    expect(JSON.parse(body())).toEqual({ session: { id: 'session-1' } })
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

    const handled = await handleHermesApiRequest(
      '/api/hermes/inspect/memory?profile=default',
      response as never,
    )

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(memoryMock.loadMemoryInspect).toHaveBeenCalledTimes(1)
    expect(memoryMock.loadMemoryInspect).toHaveBeenCalledWith({
      profileContext: defaultProfileContext,
    })
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

    const handled = await handleHermesApiRequest('/api/hermes/skills?profile=default', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(skillsMock.loadSkillSummaries).toHaveBeenCalledWith({
      profileContext: defaultProfileContext,
    })
    expect(JSON.parse(body())).toEqual({ skills: [{ relativePath: 'dogfood', title: 'Dogfood' }] })
  })

  test('返回技能详情', async () => {
    skillsMock.isValidSkillPath.mockReturnValue(true)
    skillsMock.loadSkillDetail.mockResolvedValue({ relativePath: 'dogfood', title: 'Dogfood' })
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest(
      '/api/hermes/skills/detail?path=dogfood&profile=hetun',
      response as never,
    )

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(skillsMock.isValidSkillPath).toHaveBeenCalledWith('dogfood', {
      profileContext: defaultProfileContext,
    })
    expect(skillsMock.loadSkillDetail).toHaveBeenCalledWith('dogfood', {
      profileContext: defaultProfileContext,
    })
    expect(JSON.parse(body())).toEqual({ skill: { relativePath: 'dogfood', title: 'Dogfood' } })
  })

  test('path 缺失或非法时返回 400', async () => {
    skillsMock.isValidSkillPath.mockReturnValue(false)

    const missing = createResponse()
    const invalid = createResponse()

    await handleHermesApiRequest('/api/hermes/skills/detail?profile=default', missing.response as never)
    await handleHermesApiRequest(
      '/api/hermes/skills/detail?path=..%2Fescape&profile=default',
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

    await handleHermesApiRequest(
      '/api/hermes/skills/detail?path=missing&profile=default',
      response as never,
    )

    expect(response.statusCode).toBe(404)
    expect(JSON.parse(body())).toEqual({ error: 'skill not found' })
  })

  test('非法 profile 返回 400', async () => {
    profilesMock.resolveHermesProfileContext.mockRejectedValue(
      new profilesMock.InvalidHermesProfileError(),
    )
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/hermes/sessions?profile=bad/name', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(body())).toEqual({ error: 'invalid profile' })
  })

  test('空 profile 查询参数返回 400', async () => {
    profilesMock.resolveHermesProfileContext.mockRejectedValue(
      new profilesMock.InvalidHermesProfileError(),
    )
    const { body, response } = createResponse()

    const handled = await handleHermesApiRequest('/api/hermes/sessions?profile=', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(body())).toEqual({ error: 'invalid profile' })
  })

  test('缺省 profile 按 default 解析', async () => {
    sessionsMock.loadSessionSummaries.mockResolvedValue([])
    const { response } = createResponse()

    await handleHermesApiRequest('/api/hermes/sessions', response as never)

    expect(profilesMock.resolveHermesProfileContext).toHaveBeenCalledWith('default')
  })
})
