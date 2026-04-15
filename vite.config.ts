import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite-plus'
import vueDevTools from 'vite-plugin-vue-devtools'
import { handleHermesApiRequest, sendServerError } from './server/api/hermes-api.ts'

const frontendPort = Number(process.env.FRONTEND_PORT || '4175')

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
  },
  plugins: [
    {
      name: 'hermes-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const urlPath = req.url?.split('?')[0]
          if (!urlPath?.startsWith('/api/')) {
            next()
            return
          }

          try {
            const handled = await handleHermesApiRequest(urlPath, res)
            if (!handled) {
              next()
            }
          } catch (error) {
            sendServerError(res, error)
          }
        })
      },
    },
    vue(),
    vueDevTools(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: frontendPort,
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
})
