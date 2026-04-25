<!--
  负责：展示 Hermes 本地持久记忆文件的只读 inspect 快照。
  不负责：编辑记忆、删除记忆、来源追踪或审计 diff。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Database, RefreshCw } from 'lucide-vue-next'
import AppNavigation from '@/components/AppNavigation.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchMemoryInspect } from '@/api/hermes'
import { useProfileStore } from '@/stores/profile'
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

const profileStore = useProfileStore()
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
    inspect.value = await fetchMemoryInspect(profileStore.selectedProfileId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载 memory inspect 失败'
  } finally {
    loading.value = false
  }
}

watch(
  () => profileStore.selectedProfileId,
  () => {
    inspect.value = null
    error.value = null
    contentMode.value = 'entries'
    activeKey.value = 'memory'
    void loadInspect()
  },
)

onMounted(() => {
  void loadInspect()
})
</script>

<template>
  <main class="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <AppNavigation
      class="shrink-0"
      :search-value="searchTerm"
      search-placeholder="搜索记忆内容"
      @update:search="searchTerm = $event"
    />

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
        <header aria-label="记忆详情头部" class="border-b border-border/70 px-4 py-3">
          <div class="flex flex-col gap-3">
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
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant="outline" class="font-mono text-[10px] uppercase tracking-wide">
                  {{ totalEntries }} entries
                </Badge>
                <Button variant="ghost" size="sm" :disabled="loading" @click="loadInspect">
                  <RefreshCw :class="cn('size-3.5', loading && 'animate-spin')" />
                  {{ loading ? '刷新中…' : '刷新' }}
                </Button>
              </div>
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
        </header>

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
                        <span class="font-mono">{{ entry.charCount }} chars</span>
                      </div>
                      <p class="text-sm leading-6 whitespace-pre-wrap text-foreground">
                        {{ entry.content }}
                      </p>
                    </article>
                    <p
                      v-if="!filteredEntries.length"
                      class="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      没有匹配“{{ searchTerm }}”的条目。
                    </p>
                  </section>

                  <section
                    v-show="contentMode === 'raw'"
                    aria-label="记忆原文"
                    class="rounded-lg border border-border/60 bg-black/70 p-4 font-mono text-xs leading-6 text-emerald-100"
                  >
                    <pre class="whitespace-pre-wrap">{{ activeFile.rawContent || '(空)' }}</pre>
                  </section>
                </template>
              </div>
            </ScrollArea>
          </div>

          <aside class="min-h-0 overflow-hidden rounded-lg border border-border/70 bg-card/30">
            <ScrollArea class="h-full">
              <div class="space-y-3 p-4">
                <section>
                  <p
                    class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80"
                  >
                    Snapshot
                  </p>
                  <dl class="mt-3 space-y-2 font-mono text-xs">
                    <div
                      v-for="item in metadataEntries"
                      :key="item.label"
                      class="rounded-md border border-border/60 bg-muted/15 px-3 py-2"
                    >
                      <dt class="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {{ item.label }}
                      </dt>
                      <dd class="mt-1 break-all text-foreground">{{ item.value }}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <p
                    class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80"
                  >
                    Notes
                  </p>
                  <div class="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                    <p>只读 inspect 直接读取本地 memory/user 文件，用于核对当前注入上下文。</p>
                    <p>
                      条目模式展示解析后的 bullets；原文模式保留 markdown 原样，便于复制与排查。
                    </p>
                    <p>容量信息基于后端返回的字符统计，接近阈值时应优先清理冗余记忆。</p>
                  </div>
                </section>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </section>
    </div>
  </main>
</template>
