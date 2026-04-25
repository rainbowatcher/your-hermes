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
  charLimit: number
  entries: MemoryInspectEntry[]
}

export interface MemoryInspectResponse {
  memory: MemoryInspectFile
  user: MemoryInspectFile
}

interface LoadMemoryInspectOptions {
  hermesHome?: string
}

const MEMORY_CHAR_LIMIT = 2200
const USER_CHAR_LIMIT = 1375

function createEmptyMemoryFile(charLimit: number): MemoryInspectFile {
  return {
    exists: false,
    updatedAt: null,
    rawContent: '',
    charCount: 0,
    charLimit,
    entries: [],
  }
}

function resolveCharLimit(kind: keyof MemoryInspectResponse) {
  return kind === 'memory' ? MEMORY_CHAR_LIMIT : USER_CHAR_LIMIT
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

async function loadMemoryFile(
  filePath: string,
  kind: keyof MemoryInspectResponse,
): Promise<MemoryInspectFile> {
  const charLimit = resolveCharLimit(kind)

  try {
    const [fileStat, rawContent] = await Promise.all([stat(filePath), readFile(filePath, 'utf8')])

    return {
      exists: true,
      updatedAt: fileStat.mtime.toISOString(),
      rawContent,
      charCount: rawContent.length,
      charLimit,
      entries: parseMemoryEntries(rawContent),
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return createEmptyMemoryFile(charLimit)
    }
    throw error
  }
}

export async function loadMemoryInspect(
  options: LoadMemoryInspectOptions = {},
): Promise<MemoryInspectResponse> {
  const memoriesDir = join(resolveHermesHome(options.hermesHome), 'memories')

  const [memory, user] = await Promise.all([
    loadMemoryFile(join(memoriesDir, 'MEMORY.md'), 'memory'),
    loadMemoryFile(join(memoriesDir, 'USER.md'), 'user'),
  ])

  return { memory, user }
}
