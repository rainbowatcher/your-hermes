<!--
  负责：渲染紧凑型头部工具栏。
  不负责：列表分组筛选与详情渲染。
-->
<script setup lang="ts">
import { ArrowDownWideNarrow, Clock3, MoonStar, Search, SunMedium } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SessionSort } from '@/stores/session-history'

const props = defineProps<{
  activeCount: number
  attentionCount: number
  issueCount: number
  isDark: boolean
  search: string
  sort: SessionSort
  total: number
}>()

const emits = defineEmits<{
  (event: 'toggle-theme'): void
  (event: 'update:search', value: string): void
  (event: 'update:sort', value: SessionSort): void
}>()
</script>

<template>
  <div class="border-b border-border/70 px-3 py-2 lg:px-4">
    <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <div class="flex min-w-0 items-center gap-2">
        <div class="relative min-w-0 flex-1 xl:w-80">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="props.search"
            class="h-8 pl-8"
            placeholder="搜索"
            title="搜索标题、平台、频道、标签"
            @update:model-value="value => emits('update:search', String(value))"
          />
        </div>

        <div class="flex items-center gap-1 rounded-md border border-border/70 bg-muted/25 p-1">
          <Button
            :variant="props.sort === 'recent' ? 'secondary' : 'ghost'"
            size="sm"
            title="最近更新"
            @click="emits('update:sort', 'recent')"
          >
            <Clock3 class="size-3.5" />
          </Button>
          <Button
            :variant="props.sort === 'longest' ? 'secondary' : 'ghost'"
            size="sm"
            title="长会话优先"
            @click="emits('update:sort', 'longest')"
          >
            <ArrowDownWideNarrow class="size-3.5" />
          </Button>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 xl:justify-end">
        <Button
          variant="ghost"
          size="sm"
          :title="props.isDark ? '切换到浅色模式' : '切换到深色模式'"
          @click="emits('toggle-theme')"
        >
          <MoonStar v-if="props.isDark" class="size-3.5" />
          <SunMedium v-else class="size-3.5" />
        </Button>

        <div class="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span :title="`全部 ${props.total}`">{{ props.total }}</span>
          <span class="text-border">/</span>
          <span :title="`活跃 ${props.activeCount}`">{{ props.activeCount }}</span>
          <span class="text-border">/</span>
          <span :title="`关注 ${props.attentionCount}`">{{ props.attentionCount }}</span>
          <span class="text-border">/</span>
          <span :title="`工具异常 ${props.issueCount}`">{{ props.issueCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
