/**
 * 负责：只读加载 Hermes 本地持久记忆文件并转换为 inspect 数据。
 * 不负责：HTTP 路由、前端展示、编辑记忆或追踪记忆来源。
 */
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface MemoryInspectEntry {
  index: number
  content: string
  charCount: number
}

export interface MemoryInspectFile {
  exists: boolean
  updatedAt: string | null
  rawContent: string
  charCount: number
  entries: MemoryInspectEntry[]
}

export interface MemoryInspectResponse {
  memory: MemoryInspectFile
  user: MemoryInspectFile
}

interface LoadMemoryInspectOptions {
  hermesHome?: string
}

const EMPTY_MEMORY_FILE: MemoryInspectFile = {
  exists: false,
  updatedAt: null,
  rawContent: '',
  charCount: 0,
  entries: [],
}

function resolveHermesHome(hermesHome?: string) {
  return hermesHome || process.env.HERMES_HOME || join(homedir(), '.hermes')
}

function parseMemoryEntries(rawContent: string): MemoryInspectEntry[] {
  return rawContent
    .split(/\r?\n\s*§\s*\r?\n/g)
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content, index) => ({
      index,
      content,
      charCount: content.length,
    }))
}

async function loadMemoryFile(filePath: string): Promise<MemoryInspectFile> {
  try {
    const [fileStat, rawContent] = await Promise.all([stat(filePath), readFile(filePath, 'utf8')])

    return {
      exists: true,
      updatedAt: fileStat.mtime.toISOString(),
      rawContent,
      charCount: rawContent.length,
      entries: parseMemoryEntries(rawContent),
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { ...EMPTY_MEMORY_FILE }
    }
    throw error
  }
}

export async function loadMemoryInspect(
  options: LoadMemoryInspectOptions = {},
): Promise<MemoryInspectResponse> {
  const memoriesDir = join(resolveHermesHome(options.hermesHome), 'memories')

  const [memory, user] = await Promise.all([
    loadMemoryFile(join(memoriesDir, 'MEMORY.md')),
    loadMemoryFile(join(memoriesDir, 'USER.md')),
  ])

  return { memory, user }
}
