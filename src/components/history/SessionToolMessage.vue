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
  <div class="rounded-md">
    <div class="space-y-2">
      <CollapsibleRoot
        v-for="toolCall in props.message.toolCalls || []"
        :key="toolCall.id"
        v-slot="{ open }"
        :default-open="false"
      >
        <CollapsibleTrigger
          as="button"
          class="flex w-full items-center sticky top-0 z-11 bg-black/15 border gap-2 rounded-md px-4 py-2 text-left text-[11px] text-current/80"
          :class="{ 'rounded-b-none border-b-0': open }"
        >
          <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span class="truncate font-medium text-current">{{ toolCall.title }}</span>
            <Badge
              variant="outline"
              v-if="toolCall.hasError"
              :title="toolCall.errorDetail || undefined"
              class="rounded-sm border-current/20 bg-transparent"
              >error</Badge
            >
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent as-child>
          <div
            class="relative bg-black/15 border rounded-md p-2.5"
            :class="{ 'rounded-t-none border-t-0': open }"
          >
            <div
              class="absolute right-2 top-2 z-10 flex items-center bg-foreground/10 rounded-lg px-1 gap-1"
            >
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
