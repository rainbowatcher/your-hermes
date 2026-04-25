/**
 * 负责：验证 Hermes skills 只读加载、frontmatter 解析与路径安全。
 * 不负责：HTTP 路由与前端渲染。
 */
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import {
  loadSkillDetail,
  loadSkillSummaries,
  parseSkillMarkdown,
  resolveSkillDirectory,
} from './hermes-skills'

async function createFixtureRoot() {
  return await mkdtemp(join(tmpdir(), 'your-hermes-skills-'))
}

async function writeSkill(root: string, relativePath: string, content: string) {
  const skillDir = join(root, ...relativePath.split('/'))
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), content)
  return skillDir
}

describe('Hermes skills loader', () => {
  test('解析 frontmatter、正文、标题回退、tags 与 markdown anchors', () => {
    const parsed = parseSkillMarkdown(
      'software-development/writing-plans',
      `---
name: writing-plans
description: Write plans well
metadata:
  hermes:
    tags:
      - planning
      - docs
---
# 中文 标题

## Usage

### Usage

#### Ignore me

# !!!

Body text
`,
    )

    expect(parsed.frontmatter.name).toBe('writing-plans')
    expect(parsed.markdownBody).toContain('# 中文 标题')
    expect(parsed.title).toBe('中文 标题')
    expect(parsed.description).toBe('Write plans well')
    expect(parsed.tags).toEqual(['planning', 'docs'])
    expect(parsed.anchors).toEqual([
      { id: '中文-标题', depth: 1, text: '中文 标题' },
      { id: 'usage', depth: 2, text: 'Usage' },
      { id: 'usage-2', depth: 3, text: 'Usage' },
      { id: 'heading-4', depth: 1, text: '!!!' },
    ])
  })

  test('无 frontmatter 或无标题时使用 skill name 作为兜底标题', () => {
    const parsed = parseSkillMarkdown('dogfood', 'Plain body only')

    expect(parsed.frontmatter).toEqual({})
    expect(parsed.markdownBody).toBe('Plain body only')
    expect(parsed.title).toBe('dogfood')
    expect(parsed.tags).toEqual([])
    expect(parsed.anchors).toEqual([])
  })

  test('只返回包含 SKILL.md 的目录摘要，且不暴露 markdown 正文重字段', async () => {
    const root = await createFixtureRoot()
    await writeSkill(
      root,
      'mlops/inference/llama-cpp',
      `---
name: llama-cpp
description: Local inference
tags: [llm, inference]
---
# llama.cpp
`,
    )
    await mkdir(join(root, 'empty-dir'), { recursive: true })

    const summaries = await loadSkillSummaries({ root })

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      relativePath: 'mlops/inference/llama-cpp',
      name: 'llama-cpp',
      title: 'llama.cpp',
      description: 'Local inference',
      tags: ['llm', 'inference'],
    })
    expect(summaries[0]).not.toHaveProperty('markdownBody')
    expect(summaries[0]).not.toHaveProperty('frontmatter')
    expect(summaries[0]).not.toHaveProperty('anchors')
  })

  test('详情返回 frontmatter、正文、anchors 与 linked files 索引', async () => {
    const root = await createFixtureRoot()
    const skillDir = await writeSkill(
      root,
      'creative/powerpoint',
      `---
name: powerpoint
description: Slides
---
# PowerPoint
`,
    )
    await writeFile(join(skillDir, 'README.md'), '# Readme')
    await mkdir(join(skillDir, 'templates'), { recursive: true })
    await writeFile(join(skillDir, 'templates', 'deck.md'), '# Deck')

    const detail = await loadSkillDetail('creative/powerpoint', { root })

    expect(detail).not.toBeNull()
    expect(detail?.frontmatter).toMatchObject({ name: 'powerpoint', description: 'Slides' })
    expect(detail?.markdownBody).toContain('# PowerPoint')
    expect(detail?.anchors).toEqual([{ id: 'powerpoint', depth: 1, text: 'PowerPoint' }])
    expect(detail?.linkedFiles).toEqual([
      { relativePath: 'README.md', kind: 'file' },
      { relativePath: 'templates/deck.md', kind: 'template' },
    ])
  })

  test('路径规范化拒绝越界、绝对路径和编码绕过', () => {
    const root = '/tmp/skills-root'

    expect(resolveSkillDirectory('safe/path', root)).toBe('/tmp/skills-root/safe/path')
    expect(() => resolveSkillDirectory('', root)).toThrow('非法 skill path')
    expect(() => resolveSkillDirectory('/absolute', root)).toThrow('非法 skill path')
    expect(() => resolveSkillDirectory('../escape', root)).toThrow('非法 skill path')
    expect(() => resolveSkillDirectory('safe/../../escape', root)).toThrow('非法 skill path')
    expect(() => resolveSkillDirectory('safe%2F..%2Fescape', root)).toThrow('非法 skill path')
  })

  test('不存在的 skill 详情返回 null', async () => {
    const root = await createFixtureRoot()

    await expect(loadSkillDetail('missing', { root })).resolves.toBeNull()
  })

  test('按显式 root 读取时不依赖进程级 HERMES_HOME', async () => {
    const root = await createFixtureRoot()
    await writeSkill(
      root,
      'dogfood',
      `---
name: dogfood
description: Inspect fixture
---
# Dogfood
`,
    )

    await expect(loadSkillSummaries({ root })).resolves.toHaveLength(1)
  })
})
