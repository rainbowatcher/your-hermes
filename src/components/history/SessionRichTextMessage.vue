<!--
  负责：渲染用户/助手消息的 Markdown 与原始文本切换。
  不负责：消息卡片头部、列表编排与工具消息展示。
-->
<script setup lang="ts">
import { Brackets, Eye } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import MessageMarkdown from '@/components/history/MessageMarkdown.vue'
import type { SessionMessage } from '@/types/history'

export type TextMessageViewMode = 'render' | 'raw'

const props = defineProps<{
  message: SessionMessage
  mode: TextMessageViewMode
}>()

const emits = defineEmits<{
  (event: 'update:mode', value: TextMessageViewMode): void
}>()
</script>

<template>
  <div class="relative group mt-2 rounded-md bg-black/8 px-2.5 py-2.5">
    <div
      class="hidden group-hover:flex bg-primary/40 px-1 rounded absolute right-2 top-2 z-10 items-center gap-1"
    >
      <Button
        :variant="props.mode === 'render' ? 'secondary' : 'ghost'"
        size="icon-xs"
        title="显示渲染结果"
        @click.stop="emits('update:mode', 'render')"
      >
        <Eye class="size-3" />
      </Button>
      <Button
        :variant="props.mode === 'raw' ? 'secondary' : 'ghost'"
        size="icon-xs"
        title="显示原始消息"
        @click.stop="emits('update:mode', 'raw')"
      >
        <Brackets class="size-3" />
      </Button>
    </div>

    <MessageMarkdown v-if="props.mode === 'render'" class="" :content="props.message.content" />
    <pre
      v-else
      class="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-current"
      >{{ props.message.content }}</pre
    >
  </div>
</template>
