/**
 * 负责：验证 Hermes API 路由在开发服务器内可直接处理。
 * 不负责：独立 HTTP 服务监听与前端界面行为。
 */
import { describe, expect, test } from 'vite-plus/test'
import { handleHermesApiRequest } from './hermes-api'
import viteConfig from '../../vite.config'

describe('Hermes API route', () => {
  test('开发服务器配置应直接处理 API，不能只反代独立后端', () => {
    expect(viteConfig.server?.proxy).toBeUndefined()
  })

  test('处理健康检查路由', async () => {
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

    const handled = await handleHermesApiRequest('/api/health', response as never)

    expect(handled).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(JSON.parse(body)).toEqual({ ok: true, service: 'your-hermes-server' })
  })
})
