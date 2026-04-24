<!--
  负责：渲染技能 Markdown 正文并为标题注入 anchor id。
  不负责：anchor 目录提取与列表布局。
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { renderMarkdown } from '@/lib/markdown'
import type { SkillAnchor } from '@/types/skills'

const props = defineProps<{
  anchors: SkillAnchor[]
  content: string
}>()

const html = ref('')
const isLoading = ref(false)

function injectHeadingIds(rawHtml: string, anchors: SkillAnchor[]) {
  let index = 0
  return rawHtml.replace(/<h([1-3])>(.*?)<\/h\1>/g, (fullMatch, level, innerHtml) => {
    const anchor = anchors[index]
    index += 1
    if (!anchor || anchor.depth !== Number(level)) {
      return fullMatch
    }
    return `<h${level} id="${anchor.id}" data-skill-anchor="${anchor.id}">${innerHtml}</h${level}>`
  })
}

watch(
  () => [props.content, props.anchors] as const,
  async ([content, anchors]) => {
    isLoading.value = true
    const rendered = await renderMarkdown(content)
    html.value = injectHeadingIds(rendered, anchors)
    isLoading.value = false
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div v-if="isLoading" class="text-sm text-current/70">渲染中…</div>
  <div v-else class="skill-md-content text-sm leading-6 text-current" v-html="html" />
</template>

<style scoped>
.skill-md-content :deep(h1),
.skill-md-content :deep(h2),
.skill-md-content :deep(h3) {
  scroll-margin-top: 1rem;
  margin-top: 1.1rem;
  margin-bottom: 0.55rem;
  font-weight: 700;
}

.skill-md-content :deep(h1:first-child),
.skill-md-content :deep(h2:first-child),
.skill-md-content :deep(h3:first-child) {
  margin-top: 0;
}

.skill-md-content :deep(p) {
  margin: 0.45rem 0;
}

.skill-md-content :deep(p:first-child) {
  margin-top: 0;
}

.skill-md-content :deep(p:last-child) {
  margin-bottom: 0;
}

.skill-md-content :deep(ul),
.skill-md-content :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.1rem;
}

.skill-md-content :deep(li + li) {
  margin-top: 0.2rem;
}

.skill-md-content :deep(code) {
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 0.35rem;
  background: rgb(0 0 0 / 0.12);
  padding: 0.1rem 0.3rem;
  font-size: 0.82em;
}

.skill-md-content :deep(pre) {
  margin: 0.6rem 0 0;
  padding: 0.5rem;
  overflow: auto;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 0.5rem;
}

.skill-md-content :deep(pre code) {
  border: 0;
  background: transparent;
  padding: 0;
}

.skill-md-content :deep(blockquote) {
  margin: 0.6rem 0;
  border-left: 2px solid rgb(255 255 255 / 0.16);
  padding-left: 0.75rem;
  color: rgb(255 255 255 / 0.7);
}

.skill-md-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
