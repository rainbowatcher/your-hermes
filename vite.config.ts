import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite-plus'
import vueDevTools from 'vite-plugin-vue-devtools'
import { loadSessionDetail, loadSessionSummaries } from './server/hermes-sessions.ts'

/**
 * 负责：为本地开发/预览环境注入读取 ~/.hermes 会话的 API。
 * 不负责：前端状态管理与界面渲染。
 */
function hermesSessionsApiPlugin(): Plugin {
  const handleRequest = async (url: string, res: import('node:http').ServerResponse) => {
    if (url === '/api/hermes/sessions') {
      const sessions = await loadSessionSummaries()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ sessions }))
      return true
    }

    if (url.startsWith('/api/hermes/sessions/')) {
      const sessionId = decodeURIComponent(url.slice('/api/hermes/sessions/'.length))
      const session = await loadSessionDetail(sessionId)
      res.statusCode = session ? 200 : 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ session }))
      return true
    }

    return false
  }

  return {
    name: 'hermes-sessions-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || !url.startsWith('/api/hermes/')) {
          next()
          return
        }

        try {
          const handled = await handleRequest(url, res)
          if (!handled) {
            next()
          }
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({ error: error instanceof Error ? error.message : 'unknown error' }),
          )
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || !url.startsWith('/api/hermes/')) {
          next()
          return
        }

        try {
          const handled = await handleRequest(url, res)
          if (!handled) {
            next()
          }
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({ error: error instanceof Error ? error.message : 'unknown error' }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
  },
  plugins: [vue(), vueDevTools(), tailwindcss(), hermesSessionsApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
})
