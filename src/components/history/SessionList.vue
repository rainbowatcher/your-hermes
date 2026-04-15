<!--
  负责：展示按真实平台/会话类型分组的折叠会话列表，并承载状态过滤。
  不负责：详情渲染与消息展示。
-->
<script setup lang="ts">
import { useDateFormat } from '@vueuse/core'
import { AlertTriangle, Bot, Clock3, Layers3, Pin, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { SessionListGroup } from '@/stores/session-history'
import type { SessionStatusFilter } from '@/types/history'

const props = defineProps<{
  groups: SessionListGroup[]
  isLoading?: boolean
  selectedId: string | null
  status: SessionStatusFilter
}>()

const emits = defineEmits<{
  (event: 'select', id: string): void
  (event: 'update:status', value: SessionStatusFilter): void
}>()

const decoratedGroups = computed(() =>
  props.groups.map((group) => ({
    ...group,
    sessions: group.sessions.map((session) => ({
      ...session,
      updatedLabel: useDateFormat(session.updatedAt, 'MM-DD HH:mm').value,
    })),
  })),
)

const openGroupValues = ref<string[]>([])

watch(
  () => decoratedGroups.value.map((group) => group.key),
  (keys) => {
    openGroupValues.value = keys
  },
  { immediate: true },
)

function updateOpenGroupValues(value: string[] | string | undefined) {
  if (Array.isArray(value)) {
    openGroupValues.value = value
    return
  }

  openGroupValues.value = value ? [value] : []
}

const statusMeta = {
  active: { icon: Sparkles, title: '活跃' },
  attention: { icon: AlertTriangle, title: '异常' },
  archived: { icon: Clock3, title: '归档' },
} as const

const statusItems = [
  { value: 'all', icon: Layers3, title: '全部会话' },
  { value: 'active', icon: Clock3, title: '活跃会话' },
  { value: 'attention', icon: AlertTriangle, title: '需关注会话' },
  { value: 'archived', icon: Pin, title: '已归档会话' },
] as const
</script>

<template>
  <aside
    class="flex min-h-0 flex-col border-r border-border/70 bg-card/35 xl:min-w-[320px] xl:max-w-90"
  >
    <div class="border-b border-border/70 px-3 py-2">
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
          Sessions
        </p>
        <Badge
          variant="outline"
          class="font-mono text-[10px] uppercase tracking-wide"
          title="真实数据源：~/.hermes"
        >
          {{ groups.reduce((count, group) => count + group.sessions.length, 0) }}
        </Badge>
      </div>

      <Tabs
        :model-value="props.status"
        class="mt-2 gap-0"
        @update:model-value="(value) => emits('update:status', value as SessionStatusFilter)"
      >
        <TabsList variant="line" class="w-full justify-start gap-1 rounded-none px-0">
          <TabsTrigger
            v-for="item in statusItems"
            :key="item.value"
            :value="item.value"
            class="px-1.5"
            :title="item.title"
          >
            <component :is="item.icon" class="size-3.5" />
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="isLoading" class="p-4 text-xs text-muted-foreground">加载中...</div>

      <div v-else class="p-2">
        <Accordion
          type="multiple"
          :model-value="openGroupValues"
          class="gap-0 border-none"
          @update:model-value="updateOpenGroupValues"
        >
          <AccordionItem
            v-for="group in decoratedGroups"
            :key="group.key"
            :value="group.key"
            class="mb-2 overflow-hidden rounded-md border border-border/60 bg-muted/10 not-last:border-b"
          >
            <AccordionTrigger
              class="px-2.5 py-2 text-xs text-muted-foreground no-underline hover:no-underline"
              :title="group.description"
            >
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="truncate font-medium text-foreground">{{ group.label }}</span>
                <span class="ml-auto font-mono text-[10px] text-muted-foreground">{{
                  group.sessions.length
                }}</span>
              </div>
            </AccordionTrigger>

            <AccordionContent class="h-auto">
              <button
                v-for="session in group.sessions"
                :key="session.id"
                :class="
                  cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    selectedId === session.id
                      ? 'bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]'
                      : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                  )
                "
                :title="session.title"
                @click="emits('select', session.id)"
              >
                <component
                  :is="statusMeta[session.status].icon"
                  class="size-3.5"
                  :class="session.status === 'attention' ? 'text-amber-300' : ''"
                  :title="statusMeta[session.status].title"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium">
                    {{ session.title }}
                  </p>
                  <div
                    class="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"
                  >
                    <span :title="session.model"><Bot class="size-3 inline" /></span>
                    <span>{{ session.messageCount }}</span>
                    <span>{{ session.updatedLabel }}</span>
                  </div>
                </div>
                <Pin v-if="session.pinned" class="size-3 shrink-0 text-primary" title="已置顶" />
              </button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div
          v-if="decoratedGroups.length === 0"
          class="px-3 py-8 text-center text-xs text-muted-foreground"
        >
          当前筛选下没有会话。
        </div>
      </div>
    </ScrollArea>
  </aside>
</template>
