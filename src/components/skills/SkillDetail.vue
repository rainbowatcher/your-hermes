<!--
  负责：渲染技能详情、frontmatter metadata、linked files 与 markdown anchor 导航。
  不负责：列表筛选、路由同步与服务端解析。
-->
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import SkillMarkdown from '@/components/skills/SkillMarkdown.vue'
import type { SkillAnchor, SkillDetail as SkillDetailModel } from '@/types/skills'

const props = defineProps<{
  isLoading?: boolean
  skill: SkillDetailModel | null
}>()

const bodyRef = ref<HTMLElement | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)

const metadataEntries = computed(() => {
  if (!props.skill) return []
  return Object.entries(props.skill.frontmatter).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }))
})

function anchorPadding(anchor: SkillAnchor) {
  if (anchor.depth === 1) return 'pl-0'
  if (anchor.depth === 2) return 'pl-3'
  return 'pl-6'
}

async function jumpToAnchor(anchor: SkillAnchor) {
  await nextTick()
  const target = bodyRef.value?.querySelector<HTMLElement>(`[data-skill-anchor="${anchor.id}"]`)
  if (!target) return

  const scrollContainer = scrollContainerRef.value?.querySelector<HTMLElement>(
    '[data-radix-scroll-area-viewport]',
  )
  if (scrollContainer) {
    scrollContainer.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' })
    return
  }

  target.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
</script>

<template>
  <section class="flex min-h-0 flex-col bg-background">
    <div
      v-if="isLoading"
      class="flex h-full items-center justify-center p-8 text-sm text-muted-foreground"
    >
      正在读取技能详情…
    </div>

    <template v-else-if="skill">
      <header class="border-b border-border/70 px-4 py-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {{ skill.relativePath }}
            </p>
            <h1 class="mt-1 truncate text-lg font-semibold text-foreground">{{ skill.title }}</h1>
            <p v-if="skill.description" class="mt-1 text-sm text-muted-foreground">
              {{ skill.description }}
            </p>
          </div>
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="tag in skill.tags"
              :key="tag"
              variant="secondary"
              class="font-mono text-[10px]"
            >
              {{ tag }}
            </Badge>
          </div>
        </div>
      </header>

      <div
        class="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-4"
      >
        <div
          ref="scrollContainerRef"
          class="min-h-0 overflow-hidden rounded-lg border border-border/70 bg-card/30"
        >
          <ScrollArea class="h-full">
            <article ref="bodyRef" class="p-4">
              <SkillMarkdown :anchors="skill.anchors" :content="skill.markdownBody" />
            </article>
          </ScrollArea>
        </div>

        <aside class="min-h-0 overflow-auto rounded-lg border border-border/70 bg-card/35 p-3">
          <section>
            <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Metadata
            </h2>
            <div v-if="metadataEntries.length" class="mt-2 space-y-2">
              <div
                v-for="entry in metadataEntries"
                :key="entry.key"
                class="rounded border border-border/60 p-2"
              >
                <p class="font-mono text-[10px] text-muted-foreground">{{ entry.key }}</p>
                <pre class="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">{{
                  entry.value
                }}</pre>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-muted-foreground">没有 frontmatter metadata。</p>
          </section>

          <section class="mt-5">
            <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Anchors
            </h2>
            <div v-if="skill.anchors.length" class="mt-2 space-y-1">
              <button
                v-for="anchor in skill.anchors"
                :key="anchor.id"
                :class="[
                  'block w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  anchorPadding(anchor),
                ]"
                :title="anchor.text"
                @click="jumpToAnchor(anchor)"
              >
                {{ anchor.text }}
              </button>
            </div>
            <p v-else class="mt-2 text-xs text-muted-foreground">没有可导航的标题。</p>
          </section>

          <section class="mt-5">
            <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Linked Files
            </h2>
            <div v-if="skill.linkedFiles.length" class="mt-2 space-y-1">
              <p
                v-for="file in skill.linkedFiles"
                :key="file.relativePath"
                class="truncate rounded bg-muted/20 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                :title="`${file.kind}: ${file.relativePath}`"
              >
                {{ file.relativePath }}
              </p>
            </div>
            <p v-else class="mt-2 text-xs text-muted-foreground">没有附属文件。</p>
          </section>
        </aside>
      </div>
    </template>

    <div v-else class="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
      请选择左侧技能。
    </div>
  </section>
</template>
