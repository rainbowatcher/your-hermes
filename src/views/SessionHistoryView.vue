<!--
  负责：编排会话历史页面的真实数据加载、列表、详情与路由同步。
  不负责：服务端文件解析与消息发送。
-->
<script setup lang="ts">
import { MoonStar, SunMedium } from 'lucide-vue-next'
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HistoryToolbar from '@/components/history/HistoryToolbar.vue'
import SessionDetail from '@/components/history/SessionDetail.vue'
import SessionList from '@/components/history/SessionList.vue'
import { Button } from '@/components/ui/button'
import { useSessionHistoryStore } from '@/stores/session-history'
import { useThemeStore } from '@/stores/theme'

const store = useSessionHistoryStore()
const theme = useThemeStore()
const route = useRoute()
const router = useRouter()

function syncRouteSelection() {
  if (store.isLoadingSessions) {
    return
  }

  const sessionId = typeof route.params.sessionId === 'string' ? route.params.sessionId : null
  const targetId = sessionId || store.filteredSessions[0]?.id || null

  store.setSelectedId(targetId)

  if (targetId && !store.selectedSession) {
    void store.loadSession(targetId)
  }

  if (!sessionId && targetId) {
    router.replace({ name: 'sessions', params: { sessionId: targetId } })
  }
}

onMounted(async () => {
  await store.loadSessions()
  syncRouteSelection()
})

watch(
  [
    () => route.params.sessionId,
    () => store.filteredSessions.length,
    () => store.isLoadingSessions,
  ],
  () => {
    syncRouteSelection()
  },
  { immediate: true },
)

watch(
  () => store.selectedId,
  (sessionId) => {
    if (sessionId) {
      void store.loadSession(sessionId)
    }
  },
)

function openSession(id: string) {
  store.setSelectedId(id)
  void store.loadSession(id)
  router.push({ name: 'sessions', params: { sessionId: id } })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <div
      v-if="store.loadError"
      class="border-b border-amber-500/20 bg-amber-500/8 px-5 py-2 text-xs text-amber-100"
    >
      {{ store.loadError }}
    </div>

    <div class="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <div
        aria-label="会话列表栏"
        class="flex min-h-0 flex-col border-r border-border/70 bg-card/35 xl:min-w-[320px] xl:max-w-90"
      >
        <div
          class="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2 lg:px-4"
        >
          <Button
            variant="ghost"
            size="sm"
            :title="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
            @click="theme.toggleTheme"
          >
            <MoonStar v-if="theme.isDark" class="size-3.5" />
            <SunMedium v-else class="size-3.5" />
          </Button>

          <div class="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span :title="`全部 ${store.stats.total}`">{{ store.stats.total }}</span>
            <span class="text-border">/</span>
            <span :title="`活跃 ${store.stats.active}`">{{ store.stats.active }}</span>
            <span class="text-border">/</span>
            <span :title="`关注 ${store.stats.attention}`">{{ store.stats.attention }}</span>
            <span class="text-border">/</span>
            <span :title="`工具异常 ${store.stats.issueMessages}`">{{
              store.stats.issueMessages
            }}</span>
          </div>
        </div>
        <HistoryToolbar
          :search="store.search"
          :sort="store.sort"
          @update:search="store.setSearch"
          @update:sort="store.setSort"
        />
        <SessionList
          :groups="store.groupedSessions"
          :is-loading="store.isLoadingSessions"
          :selected-id="store.selectedId"
          :status="store.statusFilter"
          @select="openSession"
          @update:status="store.setStatusFilter"
        />
      </div>
      <SessionDetail
        :available-roles="store.availableMessageRoles"
        :is-loading="store.isLoadingDetail"
        :message-role-filter="store.messageRoleFilter"
        :session="store.selectedSession"
        @open-branch="openSession"
        @update:message-role-filter="store.setMessageRoleFilter"
      />
    </div>
  </div>
</template>
