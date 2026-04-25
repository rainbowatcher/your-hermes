/**
 * 负责：调用本地 Vite API 读取 Hermes 会话、技能、记忆与 profile 数据。
 * 不负责：状态缓存与界面派生逻辑。
 */
import type { SessionDetail, SessionSummary } from '@/types/history'
import type { MemoryInspectResponse } from '@/types/memory'
import type { HermesProfileSummary } from '@/types/profiles'
import type { SkillDetail, SkillSummary } from '@/types/skills'

function withProfile(url: string, profileId?: string) {
  if (!profileId) {
    return url
  }

  const requestUrl = new URL(url, 'http://localhost')
  requestUrl.searchParams.set('profile', profileId)
  return `${requestUrl.pathname}${requestUrl.search}`
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`请求失败：${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

export async function fetchHermesProfiles() {
  return await requestJson<{ profiles: HermesProfileSummary[] }>('/api/hermes/profiles')
}

export async function fetchSessions(profileId?: string) {
  return await requestJson<{ sessions: SessionSummary[] }>(withProfile('/api/hermes/sessions', profileId))
}

export async function fetchSessionDetail(sessionId: string, profileId?: string) {
  return await requestJson<{ session: SessionDetail | null }>(
    withProfile(`/api/hermes/sessions/${encodeURIComponent(sessionId)}`, profileId),
  )
}

export async function fetchMemoryInspect(profileId?: string) {
  return await requestJson<MemoryInspectResponse>(withProfile('/api/hermes/inspect/memory', profileId))
}

export async function fetchSkills(profileId?: string) {
  return await requestJson<{ skills: SkillSummary[] }>(withProfile('/api/hermes/skills', profileId))
}

export async function fetchSkillDetail(relativePath: string, profileId?: string) {
  return await requestJson<{ skill: SkillDetail }>(
    withProfile(`/api/hermes/skills/detail?path=${encodeURIComponent(relativePath)}`, profileId),
  )
}
