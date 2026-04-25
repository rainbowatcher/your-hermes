/**
 * 负责：验证 Hermes memory inspect 只读加载、条目解析与缺失文件回退。
 * 不负责：HTTP 路由与前端渲染。
 */
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import { loadMemoryInspect } from './hermes-memory'

async function createFixtureRoot() {
  return await mkdtemp(join(tmpdir(), 'your-hermes-memory-'))
}

describe('Hermes memory loader', () => {
  test('读取 MEMORY 与 USER 文件并按分隔符解析条目', async () => {
    const root = await createFixtureRoot()
    const memoriesDir = join(root, 'memories')
    await mkdir(memoriesDir, { recursive: true })
    await writeFile(
      join(memoriesDir, 'MEMORY.md'),
      ['第一条记忆', '§', '第二条记忆', '§', '第三条记忆'].join('\n'),
    )
    await writeFile(join(memoriesDir, 'USER.md'), ['偏好 A', '§', '偏好 B'].join('\n'))

    const inspect = await loadMemoryInspect({
      profileContext: { hermesHome: root, memoriesDir },
    })

    expect(inspect.memory.exists).toBe(true)
    expect(inspect.memory.rawContent).toContain('第一条记忆')
    expect(inspect.memory.entries).toEqual([
      { index: 0, content: '第一条记忆', charCount: 5 },
      { index: 1, content: '第二条记忆', charCount: 5 },
      { index: 2, content: '第三条记忆', charCount: 5 },
    ])
    expect(inspect.memory.charCount).toBe(inspect.memory.rawContent.length)
    expect(inspect.memory.charLimit).toBe(2200)
    expect(inspect.memory.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(inspect.user.exists).toBe(true)
    expect(inspect.user.charLimit).toBe(1375)
    expect(inspect.user.entries).toEqual([
      { index: 0, content: '偏好 A', charCount: 4 },
      { index: 1, content: '偏好 B', charCount: 4 },
    ])
  })

  test('缺失文件时返回 exists false 与空内容', async () => {
    const root = await createFixtureRoot()

    const inspect = await loadMemoryInspect({
      profileContext: { hermesHome: root, memoriesDir: join(root, 'memories') },
    })

    expect(inspect.memory).toEqual({
      exists: false,
      updatedAt: null,
      rawContent: '',
      charCount: 0,
      charLimit: 2200,
      entries: [],
    })
    expect(inspect.user).toEqual({
      exists: false,
      updatedAt: null,
      rawContent: '',
      charCount: 0,
      charLimit: 1375,
      entries: [],
    })
  })

  test('空文件保留 exists true 但不产生条目', async () => {
    const root = await createFixtureRoot()
    const memoriesDir = join(root, 'memories')
    await mkdir(memoriesDir, { recursive: true })
    await writeFile(join(memoriesDir, 'MEMORY.md'), '')

    const inspect = await loadMemoryInspect({
      profileContext: { hermesHome: root, memoriesDir },
    })

    expect(inspect.memory.exists).toBe(true)
    expect(inspect.memory.rawContent).toBe('')
    expect(inspect.memory.charCount).toBe(0)
    expect(inspect.memory.entries).toEqual([])
    expect(inspect.memory.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('分隔逻辑兼容 CRLF 与额外空白', async () => {
    const root = await createFixtureRoot()
    const memoriesDir = join(root, 'memories')
    await mkdir(memoriesDir, { recursive: true })
    await writeFile(join(memoriesDir, 'MEMORY.md'), 'Alpha\r\n  §  \r\n\r\nBeta\r\n\t§\r\nGamma')

    const inspect = await loadMemoryInspect({
      profileContext: { hermesHome: root, memoriesDir },
    })

    expect(inspect.memory.entries).toEqual([
      { index: 0, content: 'Alpha', charCount: 5 },
      { index: 1, content: 'Beta', charCount: 4 },
      { index: 2, content: 'Gamma', charCount: 5 },
    ])
  })
})
