/**
 * 负责：处理 Hermes 会话相关 HTTP API 路由。
 * 不负责：HTTP 服务监听、静态文件托管、前端状态管理。
 */
import type { ServerResponse } from 'node:http'
import { loadSkillDetail, loadSkillSummaries, isValidSkillPath } from '../hermes-skills.ts'
import { loadSessionDetail, loadSessionSummaries } from '../hermes-sessions.ts'
import { loadMemoryInspect } from '../hermes-memory.ts'

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parseRequestUrl(urlPath: string) {
  return new URL(urlPath, 'http://localhost')
}

export async function handleHermesApiRequest(urlPath: string, res: ServerResponse) {
  const requestUrl = parseRequestUrl(urlPath)

  if (requestUrl.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'your-hermes-server' })
    return true
  }

  if (requestUrl.pathname === '/api/hermes/sessions') {
    const sessions = await loadSessionSummaries()
    sendJson(res, 200, { sessions })
    return true
  }

  if (requestUrl.pathname.startsWith('/api/hermes/sessions/')) {
    const sessionId = decodeURIComponent(requestUrl.pathname.slice('/api/hermes/sessions/'.length))
    const session = await loadSessionDetail(sessionId)
    sendJson(res, session ? 200 : 404, { session })
    return true
  }

  if (requestUrl.pathname === '/api/hermes/inspect/memory') {
    const memoryInspect = await loadMemoryInspect()
    sendJson(res, 200, memoryInspect)
    return true
  }

  if (requestUrl.pathname === '/api/hermes/skills') {
    const skills = await loadSkillSummaries()
    sendJson(res, 200, { skills })
    return true
  }

  if (requestUrl.pathname === '/api/hermes/skills/detail') {
    const skillPath = requestUrl.searchParams.get('path') || ''
    if (!isValidSkillPath(skillPath)) {
      sendJson(res, 400, { error: 'invalid skill path' })
      return true
    }

    const skill = await loadSkillDetail(skillPath)
    if (!skill) {
      sendJson(res, 404, { error: 'skill not found' })
      return true
    }

    sendJson(res, 200, { skill })
    return true
  }

  return false
}

export function sendServerError(res: ServerResponse, error: unknown) {
  sendJson(res, 500, { error: error instanceof Error ? error.message : 'unknown error' })
}
