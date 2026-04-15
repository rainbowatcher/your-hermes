import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@voidzero-dev/vite-plus-test/browser/providers/playwright'
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
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          setupFiles: ['vitest-browser-vue'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            headless: true,
          },
        },
      },
    ],
  },
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
