<!--
  负责：渲染工具消息的折叠面板与每个工具调用的内容切换。
  不负责：消息卡片头部、列表编排与外层状态存储。
-->
<script setup lang="ts">
import { Brackets, TerminalSquare } from 'lucide-vue-next'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SessionMessage, ToolCallEntry, ToolMessageViewMode } from '@/types/history'
import Badge from '../ui/badge/Badge.vue'

const props = defineProps<{
  message: SessionMessage
  toolContent: (toolCall: ToolCallEntry) => string
  toolViewMode: (toolCall: ToolCallEntry) => ToolMessageViewMode
}>()

const emits = defineEmits<{
  (
    event: 'update:tool-view-mode',
    payload: { toolCall: ToolCallEntry; mode: ToolMessageViewMode },
  ): void
}>()
</script>

<template>
  <div class="mt-2 rounded-md bg-black/8 px-2 py-2">
    <div class="space-y-2">
      <CollapsibleRoot
        v-for="toolCall in props.message.toolCalls || []"
        :key="toolCall.id"
        v-slot="{ open }"
        :default-open="false"
      >
        <CollapsibleTrigger
          as="button"
          class="flex w-full items-center gap-2 rounded-md px-0 py-2 text-left text-[11px] text-current/80"
        >
          <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span class="truncate font-medium text-current">{{ toolCall.title }}</span>
            <Badge
              variant="outline"
              v-if="toolCall.hasError"
              class="rounded-sm border-current/20 bg-transparent"
              >error</Badge
            >
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent as="div" class="px-0 pb-0 pt-0">
          <div :class="cn('relative rounded-md bg-black/10 p-2.5', !open && 'hidden')">
            <div class="absolute right-2 top-2 z-10 flex items-center gap-1">
              <Button
                :variant="props.toolViewMode(toolCall) === 'output' ? 'secondary' : 'ghost'"
                size="icon-xs"
                :disabled="!toolCall.primaryContent"
                :title="toolCall.kind === 'skill' ? '显示技能内容' : '显示工具输出'"
                @click.stop="emits('update:tool-view-mode', { toolCall, mode: 'output' })"
              >
                <TerminalSquare class="size-3" />
              </Button>
              <Button
                :variant="props.toolViewMode(toolCall) === 'raw' ? 'secondary' : 'ghost'"
                size="icon-xs"
                title="显示 raw json"
                @click.stop="emits('update:tool-view-mode', { toolCall, mode: 'raw' })"
              >
                <Brackets class="size-3" />
              </Button>
            </div>
            <pre
              v-if="toolCall.toolArguments"
              class="mb-2 overflow-x-auto whitespace-pre-wrap break-all pr-18 font-mono text-[10px] leading-5 text-current/75"
              >{{ toolCall.toolArguments }}</pre
            >
            <pre
              class="overflow-x-auto whitespace-pre-wrap break-all pr-18 font-mono text-[11px] leading-5 text-current"
              >{{ props.toolContent(toolCall) }}</pre
            >
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  </div>
</template>
