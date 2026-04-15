/**
 * 负责：启动独立后端应用，提供 Hermes API，并在生产模式下托管前端 dist。
 * 不负责：前端构建、Vite 开发服务器生命周期管理。
 */
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleHermesApiRequest, sendServerError } from './api/hermes-api.ts'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDir, '..')
const distDir = path.join(projectRoot, 'dist')
const publicHost = process.env.HOST || '127.0.0.1'
const publicPort = Number(process.env.PORT || process.env.BACKEND_PORT || '4176')
const isProduction = process.env.NODE_ENV === 'production'

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function sendStaticFile(filePath: string) {
  const content = await fs.readFile(filePath)
  const extension = path.extname(filePath)
  return {
    content,
    contentType: mimeTypes[extension] || 'application/octet-stream',
  }
}

function resolveStaticFile(urlPath: string) {
  const normalizedPath = urlPath === '/' ? '/index.html' : urlPath
  const safePath = path.normalize(normalizedPath).replace(/^([.][.][/\\])+/, '')
  return path.join(distDir, safePath)
}

const server = createServer(async (req, res) => {
  const urlPath = req.url?.split('?')[0] || '/'

  try {
    const handledApi = await handleHermesApiRequest(urlPath, res)
    if (handledApi) {
      return
    }

    if (!isProduction) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: `Unknown route: ${urlPath}` }))
      return
    }

    try {
      const targetFile = resolveStaticFile(urlPath)
      const file = await sendStaticFile(targetFile)
      res.statusCode = 200
      res.setHeader('Content-Type', file.contentType)
      res.end(file.content)
      return
    } catch {
      const indexFile = await sendStaticFile(path.join(distDir, 'index.html'))
      res.statusCode = 200
      res.setHeader('Content-Type', indexFile.contentType)
      res.end(indexFile.content)
    }
  } catch (error) {
    sendServerError(res, error)
  }
})

server.listen(publicPort, publicHost, () => {
  console.log(
    `[your-hermes-server] listening on http://${publicHost}:${publicPort} (${isProduction ? 'prod' : 'dev'})`,
  )
})
