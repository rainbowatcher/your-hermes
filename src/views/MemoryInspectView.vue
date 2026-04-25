<!--
  负责：展示 Hermes 本地持久记忆文件的只读 inspect 快照。
  不负责：编辑记忆、删除记忆、来源追踪或审计 diff。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchMemoryInspect } from '@/api/hermes'
import type { MemoryInspectFile, MemoryInspectResponse } from '@/types/memory'

interface MemorySection {
  key: keyof MemoryInspectResponse
  title: string
  description: string
  fileName: string
  charLimit: number
}

const sections: MemorySection[] = [
  {
    key: 'memory',
    title: 'MEMORY',
    description: '长期个人笔记，用于跨会话保留环境、项目和流程事实。',
    fileName: 'MEMORY.md',
    charLimit: 2200,
  },
  {
    key: 'user',
    title: 'USER PROFILE',
    description: '用户画像与偏好，用于减少重复说明。',
    fileName: 'USER.md',
    charLimit: 1375,
  },
]

const inspect = ref<MemoryInspectResponse | null>(null)
const activeKey = ref<keyof MemoryInspectResponse>('memory')
const loading = ref(false)
const error = ref<string | null>(null)

const activeSection = computed(
  () => sections.find((section) => section.key === activeKey.value) ?? sections[0],
)
const activeFile = computed(() => inspect.value?.[activeSection.value.key] ?? null)

function formatDate(value: string | null) {
  if (!value) return '未更新'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function charUsage(file: MemoryInspectFile | null, section: MemorySection) {
  if (!file) return '0 / ' + section.charLimit
  return `${file.charCount} / ${section.charLimit}`
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
  <main class="memory-inspect-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Inspect</p>
        <h1>Memory Inspect</h1>
        <p class="subtitle">
          只读查看本机 Hermes 持久记忆快照。此页面不展示绝对路径，也不提供编辑能力。
        </p>
      </div>
      <button class="refresh-button" type="button" :disabled="loading" @click="loadInspect">
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </header>

    <div v-if="error" class="error-banner" role="alert">
      {{ error }}
    </div>

    <section class="tabs" aria-label="记忆文件">
      <button
        v-for="section in sections"
        :key="section.key"
        class="tab-button"
        :class="{ active: activeKey === section.key }"
        type="button"
        @click="activeKey = section.key"
      >
        <span>{{ section.title }}</span>
        <small>{{ section.fileName }}</small>
      </button>
    </section>

    <section class="summary-grid" aria-label="记忆摘要">
      <article class="summary-card">
        <span class="summary-label">文件</span>
        <strong>{{ activeSection.fileName }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">状态</span>
        <strong>{{ activeFile?.exists ? '存在' : '缺失' }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">字符数</span>
        <strong>{{ charUsage(activeFile, activeSection) }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">条目数</span>
        <strong>{{ activeFile?.entries.length ?? 0 }}</strong>
      </article>
      <article class="summary-card wide">
        <span class="summary-label">更新时间</span>
        <strong>{{ formatDate(activeFile?.updatedAt ?? null) }}</strong>
      </article>
    </section>

    <section class="content-panel">
      <div class="panel-header">
        <div>
          <h2>{{ activeSection.title }}</h2>
          <p>{{ activeSection.description }}</p>
        </div>
      </div>

      <div v-if="loading && !inspect" class="empty-state">正在加载记忆快照…</div>
      <div v-else-if="activeFile && !activeFile.exists" class="empty-state">
        未找到 {{ activeSection.fileName }}。缺失文件会以空快照展示，不影响页面使用。
      </div>
      <template v-else-if="activeFile">
        <div class="entries" role="region" aria-label="记忆条目">
          <article v-for="entry in activeFile.entries" :key="entry.index" class="entry-card">
            <div class="entry-meta">
              <span>#{{ entry.index + 1 }}</span>
              <span>{{ entry.charCount }} 字符</span>
            </div>
            <p>{{ entry.content }}</p>
          </article>
          <div v-if="activeFile.entries.length === 0" class="empty-state">
            文件为空或没有可解析条目。
          </div>
        </div>

        <details class="raw-content">
          <summary>查看 raw content</summary>
          <pre>{{ activeFile.rawContent || '(空)' }}</pre>
        </details>
      </template>
    </section>
  </main>
</template>

<style scoped>
.memory-inspect-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  padding: 32px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.eyebrow {
  color: #38bdf8;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  font-size: 2.25rem;
  margin-bottom: 8px;
}

.subtitle,
.panel-header p {
  color: #94a3b8;
}

.refresh-button,
.tab-button {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
}

.refresh-button {
  padding: 10px 16px;
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error-banner {
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.45);
  border-radius: 16px;
  color: #fecaca;
  margin-bottom: 20px;
  padding: 14px 16px;
}

.tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.tab-button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 18px;
  text-align: left;
}

.tab-button.active {
  background: rgba(14, 165, 233, 0.18);
  border-color: rgba(56, 189, 248, 0.72);
}

.tab-button small,
.summary-label,
.entry-meta {
  color: #94a3b8;
  font-size: 0.78rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.summary-card,
.content-panel,
.entry-card,
.raw-content {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
}

.summary-card.wide {
  grid-column: span 2;
}

.content-panel {
  padding: 22px;
}

.panel-header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  margin-bottom: 18px;
  padding-bottom: 16px;
}

.entries {
  display: grid;
  gap: 12px;
}

.entry-card {
  padding: 16px;
}

.entry-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.entry-card p {
  line-height: 1.75;
  margin-bottom: 0;
  white-space: pre-wrap;
}

.empty-state {
  color: #94a3b8;
  padding: 28px;
  text-align: center;
}

.raw-content {
  margin-top: 16px;
  padding: 14px 16px;
}

.raw-content summary {
  cursor: pointer;
  font-weight: 700;
}

.raw-content pre {
  color: #cbd5e1;
  overflow-x: auto;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .memory-inspect-page {
    padding: 20px;
  }

  .page-header,
  .tabs {
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .summary-card.wide {
    grid-column: auto;
  }
}
</style>
