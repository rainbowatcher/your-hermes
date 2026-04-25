<!--
  负责：渲染紧凑型头部工具栏。
  不负责：列表分组筛选与详情渲染。
-->
<script setup lang="ts">
import { ArrowDownWideNarrow, Clock3, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SessionSort } from '@/stores/session-history'

const props = defineProps<{
  search: string
  sort: SessionSort
}>()

const emits = defineEmits<{
  (event: 'update:search', value: string): void
  (event: 'update:sort', value: SessionSort): void
}>()
</script>

<template>
  <div class="px-3 py-2 lg:px-4">
    <div class="flex flex-col gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            :model-value="props.search"
            class="h-8 pl-8"
            placeholder="搜索"
            title="搜索标题、平台、频道、标签"
            @update:model-value="(value) => emits('update:search', String(value))"
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
    </div>
  </div>
</template>
