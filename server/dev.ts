/**
 * 负责：同时启动独立后端与 Vite 前端开发服务器。
 * 不负责：生产部署、后端业务逻辑。
 */
import { spawn, type ChildProcess } from 'node:child_process'

const backendPort = process.env.BACKEND_PORT || '4176'
const frontendPort = process.env.FRONTEND_PORT || '4175'

const children: ChildProcess[] = []

function startProcess(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env,
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (signal || (typeof code === 'number' && code !== 0)) {
      shutdown(typeof code === 'number' ? code : 1)
    }
  })
  return child
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }
  process.exit(exitCode)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

startProcess('bun', ['--watch', 'server/app.ts'], {
  ...process.env,
  BACKEND_PORT: backendPort,
  NODE_ENV: 'development',
})

startProcess('vp', ['dev', '--host', '127.0.0.1', '--port', frontendPort], {
  ...process.env,
  FRONTEND_PORT: frontendPort,
})
