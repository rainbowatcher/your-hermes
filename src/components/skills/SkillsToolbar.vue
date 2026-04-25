<!--
  负责：渲染技能管理页面头部工具栏。
  不负责：列表与详情具体展示。
-->
<script setup lang="ts">
import { MoonStar, Search, SunMedium } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  isDark: boolean
  search: string
  total: number
}>()

const emits = defineEmits<{
  (event: 'toggle-theme'): void
  (event: 'update:search', value: string): void
}>()
</script>

<template>
  <div class="px-3 py-2 lg:px-4">
    <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <div class="relative min-w-0 xl:w-96">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          :model-value="props.search"
          class="h-8 pl-8"
          placeholder="搜索技能名、路径、标签"
          @update:model-value="(value) => emits('update:search', String(value))"
        />
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

        <div class="font-mono text-[10px] text-muted-foreground" :title="`技能总数 ${props.total}`">
          {{ props.total }}
        </div>
      </div>
    </div>
  </div>
</template>
