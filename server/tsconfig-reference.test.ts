/**
 * 负责：验证 server 目录已纳入 TypeScript project references。
 * 不负责：运行真实 tsc。
 */
/// <reference types="node" />
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vite-plus/test'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..')

describe('TypeScript server config', () => {
  test('根 tsconfig 应只引用 app 和 server tsconfig', async () => {
    const source = await fs.readFile(path.join(rootDir, 'tsconfig.json'), 'utf8')

    expect(source.includes('./tsconfig.app.json')).toBe(true)
    expect(source.includes('./tsconfig.server.json')).toBe(true)
    expect(source.includes('./tsconfig.node.json')).toBe(false)
  })

  test('server tsconfig 应覆盖 server 目录和 vite 配置并启用 node 类型', async () => {
    const source = await fs.readFile(path.join(rootDir, 'tsconfig.server.json'), 'utf8')

    expect(source.includes('"types": ["node"]')).toBe(true)
    expect(source.includes('"include": ["server/**/*.ts", "vite.config.ts"]')).toBe(true)
  })
})
