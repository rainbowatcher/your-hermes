/**
 * 负责：调用本地 Vite API 读取 Hermes 会话与技能数据。
 * 不负责：状态缓存与界面派生逻辑。
 */
import type { SessionDetail, SessionSummary } from '@/types/history'
import type { MemoryInspectResponse } from '@/types/memory'
import type { SkillDetail, SkillSummary } from '@/types/skills'

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`请求失败：${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

export async function fetchSessions() {
  return await requestJson<{ sessions: SessionSummary[] }>('/api/hermes/sessions')
}

export async function fetchSessionDetail(sessionId: string) {
  return await requestJson<{ session: SessionDetail | null }>(
    `/api/hermes/sessions/${encodeURIComponent(sessionId)}`,
  )
}

export async function fetchMemoryInspect() {
  return await requestJson<MemoryInspectResponse>('/api/hermes/inspect/memory')
}

export async function fetchSkills() {
  return await requestJson<{ skills: SkillSummary[] }>('/api/hermes/skills')
}

export async function fetchSkillDetail(relativePath: string) {
  return await requestJson<{ skill: SkillDetail }>(
    `/api/hermes/skills/detail?path=${encodeURIComponent(relativePath)}`,
  )
}
