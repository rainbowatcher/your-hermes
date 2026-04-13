<!--
  负责：编排会话历史页面的真实数据加载、列表、详情与路由同步。
  不负责：服务端文件解析与消息发送。
-->
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HistoryToolbar from '@/components/history/HistoryToolbar.vue'
import SessionDetail from '@/components/history/SessionDetail.vue'
import SessionList from '@/components/history/SessionList.vue'
import { useSessionHistoryStore } from '@/stores/session-history'
import { useThemeStore } from '@/stores/theme'

const store = useSessionHistoryStore()
const theme = useThemeStore()
const route = useRoute()
const router = useRouter()

const filteredIds = computed(() => new Set(store.filteredSessions.map(session => session.id)))

function syncRouteSelection() {
  if (store.isLoadingSessions) {
    return
  }

  const sessionId = typeof route.params.sessionId === 'string' ? route.params.sessionId : null
  const targetId = sessionId && filteredIds.value.has(sessionId)
    ? sessionId
    : store.filteredSessions[0]?.id ?? null

  store.setSelectedId(targetId)

  if (targetId && !store.selectedSession) {
    void store.loadSession(targetId)
  }

  if (targetId !== sessionId) {
    router.replace(targetId
      ? { name: 'sessions', params: { sessionId: targetId } }
      : { name: 'sessions' })
  }
}

onMounted(async () => {
  await store.loadSessions()
  syncRouteSelection()
})

watch([() => route.params.sessionId, filteredIds, () => store.isLoadingSessions], () => {
  syncRouteSelection()
}, { immediate: true })

watch(() => store.selectedId, (sessionId) => {
  if (sessionId) {
    void store.loadSession(sessionId)
  }
})

function openSession(id: string) {
  store.setSelectedId(id)
  void store.loadSession(id)
  router.push({ name: 'sessions', params: { sessionId: id } })
}
</script>

<template>
  <div class="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <HistoryToolbar
      :active-count="store.stats.active"
      :attention-count="store.stats.attention"
      :is-dark="theme.isDark"
      :issue-count="store.stats.issueMessages"
      :search="store.search"
      :sort="store.sort"
      :total="store.stats.total"
      @toggle-theme="theme.toggleTheme"
      @update:search="store.setSearch"
      @update:sort="store.setSort"
    />

    <div v-if="store.loadError" class="border-b border-amber-500/20 bg-amber-500/8 px-5 py-2 text-xs text-amber-100">
      {{ store.loadError }}
    </div>

    <div class="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <SessionList
        :groups="store.groupedSessions"
        :is-loading="store.isLoadingSessions"
        :selected-id="store.selectedId"
        :status="store.statusFilter"
        @select="openSession"
        @update:status="store.setStatusFilter"
      />
      <SessionDetail
        :available-roles="store.availableMessageRoles"
        :is-loading="store.isLoadingDetail"
        :message-role-filter="store.messageRoleFilter"
        :session="store.selectedSession"
        @update:message-role-filter="store.setMessageRoleFilter"
      />
    </div>
  </div>
</template>
