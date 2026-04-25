/**
 * 负责：从本地 Hermes skills 目录读取只读技能摘要与详情。
 * 不负责：HTTP 路由、前端渲染、skill 写回或 readiness 分析。
 */
import { readdir, readFile } from 'node:fs/promises'
import type { HermesProfileContext } from './hermes-profiles.ts'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import matter from 'gray-matter'

export const DEFAULT_SKILLS_ROOT = join(process.env.HERMES_HOME || '', 'skills')

export interface SkillAnchor {
  id: string
  depth: 1 | 2 | 3
  text: string
}

export interface SkillLinkedFile {
  relativePath: string
  kind: 'file' | 'reference' | 'template' | 'script' | 'asset'
}

export interface SkillSummary {
  relativePath: string
  name: string
  title: string
  description: string
  tags: string[]
  linkedFileCount: number
}

export interface ParsedSkillMarkdown {
  relativePath: string
  name: string
  title: string
  description: string
  tags: string[]
  frontmatter: Record<string, unknown>
  markdownBody: string
  anchors: SkillAnchor[]
}

export interface SkillDetail extends SkillSummary {
  frontmatter: Record<string, unknown>
  markdownBody: string
  anchors: SkillAnchor[]
  linkedFiles: SkillLinkedFile[]
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function tagsFromFrontmatter(frontmatter: Record<string, unknown>) {
  const metadata = frontmatter.metadata
  if (metadata && typeof metadata === 'object' && 'hermes' in metadata) {
    const hermes = (metadata as { hermes?: unknown }).hermes
    if (hermes && typeof hermes === 'object' && 'tags' in hermes) {
      const tags = normalizeStringArray((hermes as { tags?: unknown }).tags)
      if (tags.length > 0) return tags
    }
  }

  return normalizeStringArray(frontmatter.tags)
}

function firstHeading(markdownBody: string) {
  for (const line of markdownBody.split('\n')) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line.trim())
    if (match) return match[2].trim()
  }
  return ''
}

function slugifyHeading(text: string, fallback: string) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\](){}<>"']/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || fallback
}

function buildAnchors(markdownBody: string): SkillAnchor[] {
  const anchors: SkillAnchor[] = []
  const seen = new Map<string, number>()

  for (const line of markdownBody.split('\n')) {
    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line.trim())
    if (!match) continue

    const text = match[2].trim()
    const baseId = slugifyHeading(text, `heading-${anchors.length + 1}`)
    const count = seen.get(baseId) || 0
    seen.set(baseId, count + 1)

    anchors.push({
      id: count === 0 ? baseId : `${baseId}-${count + 1}`,
      depth: match[1].length as 1 | 2 | 3,
      text,
    })
  }

  return anchors
}

export function parseSkillMarkdown(relativePath: string, rawMarkdown: string): ParsedSkillMarkdown {
  const parsed = matter(rawMarkdown)
  const frontmatter = parsed.data as Record<string, unknown>
  const markdownBody = parsed.content.trimStart()
  const fallbackName = relativePath.split('/').at(-1) || relativePath
  const name = normalizeString(frontmatter.name) || fallbackName
  const title = normalizeString(frontmatter.title) || firstHeading(markdownBody) || name
  const description = normalizeString(frontmatter.description)

  return {
    relativePath,
    name,
    title,
    description,
    tags: tagsFromFrontmatter(frontmatter),
    frontmatter,
    markdownBody,
    anchors: buildAnchors(markdownBody),
  }
}

export interface LoadSkillOptions {
  root?: string
  profileContext?: Pick<HermesProfileContext, 'skillsRoot'>
}

function resolveSkillsRoot(options: LoadSkillOptions = {}) {
  const root = options.profileContext?.skillsRoot || options.root || DEFAULT_SKILLS_ROOT

  if (!root) {
    throw new Error('缺少 skills root')
  }

  return root
}

export function isValidSkillPath(value: string, options: LoadSkillOptions = {}) {
  try {
    resolveSkillDirectory(value, resolveSkillsRoot(options))
    return true
  } catch {
    return false
  }
}

export function resolveSkillDirectory(relativePath: string, root = DEFAULT_SKILLS_ROOT) {
  let decoded = relativePath
  try {
    decoded = decodeURIComponent(relativePath)
  } catch {
    throw new Error('非法 skill path')
  }

  if (!decoded || isAbsolute(decoded) || decoded.includes('\\')) {
    throw new Error('非法 skill path')
  }

  const segments = decoded.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('非法 skill path')
  }

  const rootPath = resolve(root)
  const target = resolve(rootPath, ...segments)
  const relativeToRoot = relative(rootPath, target)

  if (!relativeToRoot || relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
    throw new Error('非法 skill path')
  }

  return target
}

function toPosixPath(value: string) {
  return value.split(sep).join('/')
}

async function findSkillPaths(root: string, currentDir = root): Promise<string[]> {
  let entries
  try {
    entries = await readdir(currentDir, { withFileTypes: true })
  } catch {
    return []
  }

  const hasSkill = entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')
  if (hasSkill) {
    return [toPosixPath(relative(root, currentDir))]
  }

  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => findSkillPaths(root, join(currentDir, entry.name))),
  )

  return nested.flat()
}

function linkedFileKind(relativePath: string): SkillLinkedFile['kind'] {
  const firstSegment = relativePath.split('/')[0]
  if (firstSegment === 'references') return 'reference'
  if (firstSegment === 'templates') return 'template'
  if (firstSegment === 'scripts') return 'script'
  if (firstSegment === 'assets') return 'asset'
  return 'file'
}

async function collectLinkedFiles(
  skillDir: string,
  currentDir = skillDir,
): Promise<SkillLinkedFile[]> {
  let entries
  try {
    entries = await readdir(currentDir, { withFileTypes: true })
  } catch {
    return []
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        return await collectLinkedFiles(skillDir, absolutePath)
      }
      if (!entry.isFile() || entry.name === 'SKILL.md') {
        return []
      }
      const relativePath = toPosixPath(relative(skillDir, absolutePath))
      return [{ relativePath, kind: linkedFileKind(relativePath) }]
    }),
  )

  return nested.flat().sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

export async function loadSkillDetail(relativePath: string, options: LoadSkillOptions = {}) {
  const root = resolveSkillsRoot(options)
  const skillDir = resolveSkillDirectory(relativePath, root)
  let rawMarkdown
  try {
    rawMarkdown = await readFile(join(skillDir, 'SKILL.md'), 'utf8')
  } catch {
    return null
  }

  const parsed = parseSkillMarkdown(relativePath, rawMarkdown)
  const linkedFiles = await collectLinkedFiles(skillDir)

  return {
    ...parsed,
    linkedFiles,
    linkedFileCount: linkedFiles.length,
  } satisfies SkillDetail
}

export async function loadSkillSummaries(options: LoadSkillOptions = {}) {
  const root = resolveSkillsRoot(options)
  const relativePaths = await findSkillPaths(root)
  const details = await Promise.all(relativePaths.map((path) => loadSkillDetail(path, { root })))

  return details
    .filter((detail): detail is SkillDetail => Boolean(detail))
    .map(({ relativePath, name, title, description, tags, linkedFileCount }) => ({
      relativePath,
      name,
      title,
      description,
      tags,
      linkedFileCount,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}
