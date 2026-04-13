/**
 * 负责：管理真实会话历史列表、详情加载、筛选与选中状态。
 * 不负责：服务端文件读取与消息发送。
 */
import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { fetchSessionDetail, fetchSessions } from '@/api/hermes'
import type {
  MessageRoleFilter,
  SessionDetail,
  SessionStatusFilter,
  SessionSummary,
} from '@/types/history'

export type SessionSort = 'recent' | 'longest'

export interface SessionListGroup {
  key: string
  label: string
  description: string
  sessions: SessionSummary[]
}

function includesKeyword(session: SessionSummary, keyword: string) {
  if (!keyword) {
    return true
  }

  const haystack = [
    session.title,
    session.workspace,
    session.channel,
    session.summary,
    session.platform,
    session.chatType,
    session.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(keyword.toLowerCase())
}

export const useSessionHistoryStore = defineStore('session-history', () => {
  const sessions = ref<SessionSummary[]>([])
  const detailMap = reactive<Record<string, SessionDetail>>({})
  const isLoadingSessions = ref(false)
  const isLoadingDetail = ref(false)
  const loadError = ref('')
  const search = ref('')
  const statusFilter = useStorage<SessionStatusFilter>('history.status-filter', 'all')
  const sort = useStorage<SessionSort>('history.sort', 'recent')
  const messageRoleFilter = useStorage<MessageRoleFilter>('history.message-role-filter', 'all')
  const selectedId = useStorage<string | null>('history.selected-id', null)

  const filteredSessions = computed(() => {
    const filtered = sessions.value.filter((session) => {
      const matchesStatus = statusFilter.value === 'all' || session.status === statusFilter.value
      return matchesStatus && includesKeyword(session, search.value)
    })

    return [...filtered].sort((left, right) => {
      if (sort.value === 'longest') {
        return (
          right.messageCount - left.messageCount || right.toolMessageCount - left.toolMessageCount
        )
      }

      return +new Date(right.updatedAt) - +new Date(left.updatedAt)
    })
  })

  const groupedSessions = computed<SessionListGroup[]>(() => {
    const groups = new Map<string, SessionListGroup>()

    for (const session of filteredSessions.value) {
      const key = `${session.platform}:${session.chatType}`
      const existing = groups.get(key)
      if (existing) {
        existing.sessions.push(session)
        continue
      }

      groups.set(key, {
        key,
        label: session.groupLabel,
        description: `${session.platformLabel} / ${session.chatType}`,
        sessions: [session],
      })
    }

    return Array.from(groups.values())
  })

  const selectedSessionSummary = computed(
    () => sessions.value.find((session) => session.id === selectedId.value) || null,
  )
  const selectedSession = computed(() =>
    selectedId.value ? detailMap[selectedId.value] || null : null,
  )
  const availableMessageRoles = computed(() => selectedSession.value?.availableRoles || [])

  const stats = computed(() => ({
    total: sessions.value.length,
    attention: sessions.value.filter((session) => session.status === 'attention').length,
    active: sessions.value.filter((session) => session.status === 'active').length,
    issueMessages: sessions.value.reduce((count, session) => count + session.issueCount, 0),
  }))

  async function loadSessions() {
    isLoadingSessions.value = true
    loadError.value = ''

    try {
      const response = await fetchSessions()
      sessions.value = response.sessions
      if (!selectedId.value && response.sessions.length > 0) {
        selectedId.value = response.sessions[0].id
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '读取会话列表失败'
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function loadSession(id: string) {
    if (detailMap[id]) {
      return detailMap[id]
    }

    isLoadingDetail.value = true
    loadError.value = ''

    try {
      const response = await fetchSessionDetail(id)
      if (response.session) {
        detailMap[id] = response.session
        return response.session
      }
      return null
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '读取会话详情失败'
      return null
    } finally {
      isLoadingDetail.value = false
    }
  }

  function setSearch(value: string) {
    search.value = value
  }

  function setStatusFilter(value: SessionStatusFilter) {
    statusFilter.value = value
  }

  function setSort(value: SessionSort) {
    sort.value = value
  }

  function setMessageRoleFilter(value: MessageRoleFilter) {
    messageRoleFilter.value = value
  }

  function setSelectedId(value: string | null) {
    selectedId.value = value
  }

  return {
    sessions,
    search,
    sort,
    statusFilter,
    messageRoleFilter,
    selectedId,
    isLoadingSessions,
    isLoadingDetail,
    loadError,
    filteredSessions,
    groupedSessions,
    selectedSessionSummary,
    selectedSession,
    availableMessageRoles,
    stats,
    loadSessions,
    loadSession,
    setSearch,
    setSort,
    setStatusFilter,
    setMessageRoleFilter,
    setSelectedId,
  }
})
