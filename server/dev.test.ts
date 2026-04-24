/**
 * 负责：验证开发启动脚本环境变量约束。
 * 不负责：真实子进程生命周期。
 */
/// <reference types="node" />
import { describe, expect, test } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { branchKindLabel } from './hermes-data/sessions/lineage'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

describe('server review regressions', () => {
  test('buildBranchSummary 默认 branch kind 必须来自 SessionBranchKind', async () => {
    const source = await fs.readFile(path.join(currentDir, 'hermes-sessions.ts'), 'utf8')

    expect(source.includes("branchKind: summary.branchKind || 'unknown'")).toBe(true)
    expect(branchKindLabel('unknown')).toBe('派生分支')
  })

  test('开发脚本不再注入旧代理环境变量', async () => {
    const source = await fs.readFile(path.join(currentDir, 'dev.ts'), 'utf8')

    expect(source.includes('VITE_BACKEND_ORIGIN')).toBe(false)
  })
})
