/**
 * 负责：定位并读取 Hermes sessions 目录下的 canonical source 文件。
 * 不负责：业务字段归一化、branch 识别、Vite API 挂载。
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
export const SESSIONS_DIR = path.join(HERMES_HOME, 'sessions')
const INDEX_FILE = path.join(SESSIONS_DIR, 'sessions.json')

export async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function loadIndexMap<T>() {
  return (await readJsonFile<Record<string, T>>(INDEX_FILE)) || {}
}

export async function listSessionFiles() {
  const files = await fs.readdir(SESSIONS_DIR)
  return files
    .filter((file) => /^session_.+\.json$/u.test(file))
    .sort()
    .reverse()
}

export function sessionJsonFilePath(sessionId: string) {
  return path.join(SESSIONS_DIR, `session_${sessionId}.json`)
}

export function sessionJsonlFilePath(sessionId: string) {
  return path.join(SESSIONS_DIR, `${sessionId}.jsonl`)
}

export function sessionFilePath(fileName: string) {
  return path.join(SESSIONS_DIR, fileName)
}
