/**
 * 负责：处理 Hermes 会话相关 HTTP API 路由。
 * 不负责：HTTP 服务监听、静态文件托管、前端状态管理。
 */
import type { ServerResponse } from 'node:http'
import { loadSessionDetail, loadSessionSummaries } from '../hermes-sessions.ts'

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export async function handleHermesApiRequest(urlPath: string, res: ServerResponse) {
  if (urlPath === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'your-hermes-server' })
    return true
  }

  if (urlPath === '/api/hermes/sessions') {
    const sessions = await loadSessionSummaries()
    sendJson(res, 200, { sessions })
    return true
  }

  if (urlPath.startsWith('/api/hermes/sessions/')) {
    const sessionId = decodeURIComponent(urlPath.slice('/api/hermes/sessions/'.length))
    const session = await loadSessionDetail(sessionId)
    sendJson(res, session ? 200 : 404, { session })
    return true
  }

  return false
}

export function sendServerError(res: ServerResponse, error: unknown) {
  sendJson(res, 500, { error: error instanceof Error ? error.message : 'unknown error' })
}
