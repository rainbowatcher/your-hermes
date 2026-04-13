<!--
  负责：渲染用户/助手消息的 Markdown 内容。
  不负责：消息切换按钮与消息列表编排。
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { renderMarkdown } from "@/lib/markdown";

const props = defineProps<{
  content: string;
}>();

const html = ref("");
const isLoading = ref(false);

watch(
  () => props.content,
  async (value) => {
    isLoading.value = true;
    html.value = await renderMarkdown(value);
    isLoading.value = false;
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="isLoading" class="text-sm text-current/70">渲染中…</div>
  <div v-else class="md-content text-sm leading-6 text-current" v-html="html" />
</template>

<style scoped>
.md-content :deep(p) {
  margin: 0.45rem 0;
}

.md-content :deep(p:first-child) {
  margin-top: 0;
}

.md-content :deep(p:last-child) {
  margin-bottom: 0;
}

.md-content :deep(ul),
.md-content :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.1rem;
}

.md-content :deep(li + li) {
  margin-top: 0.2rem;
}

.md-content :deep(code) {
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 0.35rem;
  background: rgb(0 0 0 / 0.12);
  padding: 0.1rem 0.3rem;
  font-size: 0.82em;
}

.md-content :deep(pre) {
  margin: 0.6rem 0 0;
  padding: 0.5rem;
  overflow: auto;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 0.5rem;
}

.md-content :deep(pre code) {
  border: 0;
  background: transparent;
  padding: 0;
}

.md-content :deep(blockquote) {
  margin: 0.6rem 0;
  border-left: 2px solid rgb(255 255 255 / 0.16);
  padding-left: 0.75rem;
  color: rgb(255 255 255 / 0.7);
}

.md-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
