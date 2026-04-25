<!--
  负责：展示 Hermes 本地持久记忆文件的只读 inspect 快照。
  不负责：编辑记忆、删除记忆、来源追踪或审计 diff。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Database, RefreshCw, Search } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchMemoryInspect } from '@/api/hermes'
import { cn } from '@/lib/utils'
import type { MemoryInspectFile, MemoryInspectResponse } from '@/types/memory'

interface MemorySection {
  key: keyof MemoryInspectResponse
  title: string
  description: string
  fileName: string
}

const sections: MemorySection[] = [
  {
    key: 'memory',
    title: 'MEMORY',
    description: '长期个人笔记，用于跨会话保留环境、项目和流程事实。',
    fileName: 'MEMORY.md',
  },
  {
    key: 'user',
    title: 'USER PROFILE',
    description: '用户画像与偏好，用于减少重复说明。',
    fileName: 'USER.md',
  },
]

const inspect = ref<MemoryInspectResponse | null>(null)
const activeKey = ref<keyof MemoryInspectResponse>('memory')
const loading = ref(false)
const error = ref<string | null>(null)
const searchTerm = ref('')
const contentMode = ref<'entries' | 'raw'>('entries')

const activeSection = computed(
  () => sections.find((section) => section.key === activeKey.value) ?? sections[0],
)
const activeFile = computed(() => inspect.value?.[activeSection.value.key] ?? null)

const totalEntries = computed(() => {
  if (!inspect.value) return 0
  return sections.reduce((count, section) => count + inspect.value![section.key].entries.length, 0)
})

const filteredEntries = computed(() => {
  const entries = activeFile.value?.entries ?? []
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return entries
  return entries.filter((entry) => entry.content.toLowerCase().includes(term))
})

const activeCharLimit = computed(() => activeFile.value?.charLimit ?? 0)

const metadataEntries = computed(() => [
  { label: 'file', value: activeSection.value.fileName },
  { label: 'status', value: activeFile.value?.exists ? 'exists' : 'missing' },
  { label: 'characters', value: charUsage(activeFile.value) },
  { label: 'capacity_limit', value: String(activeCharLimit.value || 'unknown') },
  { label: 'entries', value: String(activeFile.value?.entries.length ?? 0) },
  { label: 'filtered', value: String(filteredEntries.value.length) },
  { label: 'updated_at', value: formatDate(activeFile.value?.updatedAt ?? null) },
])

function formatDate(value: string | null) {
  if (!value) return '未更新'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function charUsage(file: MemoryInspectFile | null) {
  if (!file) return '0 / unknown'
  return `${file.charCount} / ${file.charLimit}`
}

function selectSection(key: keyof MemoryInspectResponse) {
  activeKey.value = key
}

async function loadInspect() {
  loading.value = true
  error.value = null
  try {
    inspect.value = await fetchMemoryInspect()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载 memory inspect 失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadInspect()
})
</script>

<template>
  <main class="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <header class="border-b border-border/70 px-3 py-2 lg:px-4">
      <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div class="relative min-w-0 xl:w-96">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchTerm"
            class="h-8 pl-8"
            placeholder="搜索记忆内容"
            aria-label="搜索记忆内容"
          />
        </div>

        <div class="flex items-center justify-between gap-2 xl:justify-end">
          <Badge variant="outline" class="font-mono text-[10px] uppercase tracking-wide">
            {{ totalEntries }} entries
          </Badge>
          <Button variant="ghost" size="sm" :disabled="loading" @click="loadInspect">
            <RefreshCw :class="cn('size-3.5', loading && 'animate-spin')" />
            {{ loading ? '刷新中…' : '刷新' }}
          </Button>
        </div>
      </div>
    </header>

    <div
      v-if="error"
      class="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
      role="alert"
    >
      {{ error }}
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <aside
        aria-label="记忆文件"
        class="flex min-h-0 w-full flex-col border-r border-border/70 bg-card/35 xl:w-80 xl:shrink-0"
      >
        <div class="border-b border-border/70 px-3 py-2">
          <div class="flex items-center justify-between">
            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              Memory Files
            </p>
            <Badge variant="outline" class="font-mono text-[10px] uppercase tracking-wide">
              {{ sections.length }}
            </Badge>
          </div>
        </div>

        <ScrollArea class="min-h-0 flex-1">
          <div class="p-2">
            <section class="overflow-hidden rounded-md border border-border/60 bg-muted/10">
              <button
                v-for="section in sections"
                :key="section.key"
                :class="
                  cn(
                    'flex w-full items-start gap-2 px-2 py-2 text-left transition-colors',
                    activeKey === section.key
                      ? 'bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]'
                      : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                  )
                "
                type="button"
                @click="selectSection(section.key)"
              >
                <Database class="mt-0.5 size-3.5 shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p class="truncate text-xs font-medium">{{ section.title }}</p>
                    <span class="font-mono text-[10px]">
                      {{ inspect?.[section.key].entries.length ?? 0 }}
                    </span>
                  </div>
                  <p class="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {{ section.fileName }}
                  </p>
                  <p class="mt-1 line-clamp-2 text-[11px] leading-4">
                    {{ section.description }}
                  </p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span
                      class="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
                    >
                      {{ inspect?.[section.key].exists ? 'exists' : 'missing' }}
                    </span>
                    <span
                      class="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
                    >
                      {{ charUsage(inspect?.[section.key] ?? null) }}
                    </span>
                  </div>
                </div>
              </button>
            </section>
          </div>
        </ScrollArea>
      </aside>

      <section class="flex min-h-0 flex-1 flex-col bg-background">
        <div class="border-b border-border/70 px-4 py-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Inspect / {{ activeSection.fileName }}
              </p>
              <h1 class="mt-1 truncate text-lg font-semibold text-foreground">Memory Inspect</h1>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ activeSection.title }} · {{ activeSection.description }}
              </p>
            </div>
            <div class="flex flex-wrap gap-1">
              <Badge variant="secondary" class="font-mono text-[10px]">
                {{ activeFile?.exists ? 'exists' : 'missing' }}
              </Badge>
              <Badge variant="secondary" class="font-mono text-[10px]">
                {{ activeFile?.entries.length ?? 0 }} entries
              </Badge>
              <Badge variant="secondary" class="font-mono text-[10px]"> read-only </Badge>
            </div>
          </div>
        </div>

        <div
          class="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-4"
        >
          <div class="min-h-0 overflow-hidden rounded-lg border border-border/70 bg-card/30">
            <ScrollArea class="h-full">
              <div class="p-4">
                <div
                  v-if="loading && !inspect"
                  class="py-10 text-center text-xs text-muted-foreground"
                >
                  正在加载记忆快照…
                </div>
                <div
                  v-else-if="activeFile && !activeFile.exists"
                  class="py-10 text-center text-xs text-muted-foreground"
                >
                  未找到 {{ activeSection.fileName }}。缺失文件会以空快照展示，不影响页面使用。
                </div>
                <template v-else-if="activeFile">
                  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div class="inline-flex rounded-md border border-border/70 bg-muted/20 p-1">
                      <button
                        :class="
                          cn(
                            'rounded px-3 py-1 text-xs font-medium transition-colors',
                            contentMode === 'entries'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )
                        "
                        type="button"
                        :aria-pressed="contentMode === 'entries'"
                        @click="contentMode = 'entries'"
                      >
                        条目
                      </button>
                      <button
                        :class="
                          cn(
                            'rounded px-3 py-1 text-xs font-medium transition-colors',
                            contentMode === 'raw'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )
                        "
                        type="button"
                        :aria-pressed="contentMode === 'raw'"
                        @click="contentMode = 'raw'"
                      >
                        原文
                      </button>
                    </div>
                    <Badge variant="outline" class="font-mono text-[10px]">
                      {{
                        contentMode === 'entries'
                          ? `${filteredEntries.length} entries`
                          : `${activeFile.charCount} chars`
                      }}
                    </Badge>
                  </div>

                  <section
                    v-show="contentMode === 'entries'"
                    class="space-y-2"
                    role="region"
                    aria-label="记忆条目"
                  >
                    <article
                      v-for="entry in filteredEntries"
                      :key="entry.index"
                      class="rounded-lg border border-border/60 bg-card/35 p-3"
                    >
                      <div
                        class="mb-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
                      >
                        <span class="font-mono">#{{ entry.index + 1 }}</span>
                        <span class="font-mono">{{ entry.charCount }} 字符</span>
                      </div>
                      <p class="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {{ entry.content }}
                      </p>
                    </article>
                    <div
                      v-if="filteredEntries.length === 0"
                      class="py-10 text-center text-xs text-muted-foreground"
                    >
                      当前筛选下没有记忆条目。
                    </div>
                  </section>

                  <section
                    v-show="contentMode === 'raw'"
                    class="rounded-lg border border-border/60 bg-card/35 p-3"
                    aria-label="原文内容"
                  >
                    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 class="text-xs font-medium text-muted-foreground">Raw Content</h2>
                      <Badge variant="outline" class="font-mono text-[10px]">
                        原文 · {{ activeFile.charCount }} 字符
                      </Badge>
                    </div>
                    <pre
                      class="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/20 p-3 text-xs leading-5 text-foreground"
                      >{{ activeFile.rawContent || '(空)' }}</pre
                    >
                  </section>
                </template>
              </div>
            </ScrollArea>
          </div>

          <aside class="min-h-0 overflow-auto rounded-lg border border-border/70 bg-card/35 p-3">
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Metadata
              </h2>
              <div class="mt-2 space-y-2">
                <div
                  v-for="entry in metadataEntries"
                  :key="entry.label"
                  class="rounded border border-border/60 p-2"
                >
                  <p class="font-mono text-[10px] text-muted-foreground">{{ entry.label }}</p>
                  <pre class="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">{{
                    entry.value
                  }}</pre>
                </div>
              </div>
            </section>

            <section class="mt-5" aria-label="容量阈值">
              <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Capacity
              </h2>
              <div class="mt-2 rounded border border-border/60 p-3">
                <p class="font-mono text-[10px] text-muted-foreground">char_limit</p>
                <p class="mt-1 font-mono text-lg font-semibold text-foreground">
                  {{ activeCharLimit || 'unknown' }}
                </p>
                <p class="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Hermes 会按该阈值控制 {{ activeSection.fileName }} 的可注入容量。
                </p>
              </div>
            </section>

            <section class="mt-5">
              <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Scope
              </h2>
              <div class="mt-2 space-y-1">
                <p
                  class="rounded bg-muted/20 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  local Hermes memory snapshot
                </p>
                <p
                  class="rounded bg-muted/20 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  no absolute paths exposed
                </p>
                <p
                  class="rounded bg-muted/20 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  no edit/delete actions
                </p>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  </main>
</template>
