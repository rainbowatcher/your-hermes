<!--
  负责：渲染技能分组列表与选中态。
  不负责：详情加载、Markdown 渲染与搜索状态维护。
-->
<script setup lang="ts">
import { BookOpen, FileText } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { SkillSummary } from '@/types/skills'

export interface SkillListGroup {
  key: string
  label: string
  skills: SkillSummary[]
}

const props = defineProps<{
  groups: SkillListGroup[]
  isLoading?: boolean
  selectedPath: string | null
}>()

const emits = defineEmits<{
  (event: 'select', relativePath: string): void
}>()
</script>

<template>
  <aside
    aria-label="技能列表"
    class="flex min-h-0 flex-col border-r border-border/70 bg-card/35 xl:min-w-[320px] xl:max-w-90"
  >
    <div class="border-b border-border/70 px-3 py-2">
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
          Skills
        </p>
        <Badge variant="outline" class="font-mono text-[10px] uppercase tracking-wide">
          {{ groups.reduce((count, group) => count + group.skills.length, 0) }}
        </Badge>
      </div>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="isLoading" class="p-4 text-xs text-muted-foreground">加载中...</div>

      <div v-else class="p-2">
        <section
          v-for="group in props.groups"
          :key="group.key"
          class="mb-2 overflow-hidden rounded-md border border-border/60 bg-muted/10"
        >
          <div class="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
            <BookOpen class="size-3.5" />
            <span class="min-w-0 flex-1 truncate font-medium text-foreground">{{
              group.label
            }}</span>
            <span class="font-mono text-[10px]">{{ group.skills.length }}</span>
          </div>

          <button
            v-for="skill in group.skills"
            :key="skill.relativePath"
            :class="
              cn(
                'flex w-full items-start gap-2 px-2 py-2 text-left transition-colors',
                selectedPath === skill.relativePath
                  ? 'bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
              )
            "
            :title="skill.relativePath"
            @click="emits('select', skill.relativePath)"
          >
            <FileText class="mt-0.5 size-3.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium">{{ skill.title }}</p>
              <p class="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                {{ skill.relativePath }}
              </p>
              <p v-if="skill.description" class="mt-1 line-clamp-2 text-[11px] leading-4">
                {{ skill.description }}
              </p>
              <div v-if="skill.tags.length" class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="tag in skill.tags.slice(0, 3)"
                  :key="tag"
                  class="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </button>
        </section>

        <div
          v-if="props.groups.length === 0"
          class="px-3 py-8 text-center text-xs text-muted-foreground"
        >
          当前筛选下没有技能。
        </div>
      </div>
    </ScrollArea>
  </aside>
</template>
