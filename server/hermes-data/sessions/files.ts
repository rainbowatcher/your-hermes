/**
 * 负责：定位并读取 Hermes sessions 目录下的 canonical source 文件。
 * 不负责：业务字段归一化、branch 识别、Vite API 挂载。
 */
import fs from 'node:fs/promises'
import path from 'node:path'

export function sessionIndexFilePath(sessionsDir: string) {
  return path.join(sessionsDir, 'sessions.json')
}

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

export async function loadIndexMap<T>(sessionsDir: string) {
  return (await readJsonFile<Record<string, T>>(sessionIndexFilePath(sessionsDir))) || {}
}

export async function listSessionFiles(sessionsDir: string) {
  const files = await fs.readdir(sessionsDir)
  return files
    .filter((file) => /^session_.+\.json$/u.test(file))
    .sort()
    .reverse()
}

export function sessionJsonFilePath(sessionsDir: string, sessionId: string) {
  return path.join(sessionsDir, `session_${sessionId}.json`)
}

export function sessionJsonlFilePath(sessionsDir: string, sessionId: string) {
  return path.join(sessionsDir, `${sessionId}.jsonl`)
}

export function sessionFilePath(sessionsDir: string, fileName: string) {
  return path.join(sessionsDir, fileName)
}
