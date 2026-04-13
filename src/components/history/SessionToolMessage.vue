<!--
  负责：渲染工具消息的折叠面板与每个工具调用的内容切换。
  不负责：消息卡片头部、列表编排与外层状态存储。
-->
<script setup lang="ts">
import { Brackets, ChevronRight, TerminalSquare } from 'lucide-vue-next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SessionMessage, ToolCallEntry, ToolMessageViewMode } from '@/types/history'
import Badge from '../ui/badge/Badge.vue'

const props = defineProps<{
  expanded: boolean
  message: SessionMessage
  toolContent: (toolCall: ToolCallEntry) => string
  toolViewMode: (toolCall: ToolCallEntry) => ToolMessageViewMode
}>()

const emits = defineEmits<{
  (event: 'toggle'): void
  (
    event: 'update:tool-view-mode',
    payload: { toolCall: ToolCallEntry; mode: ToolMessageViewMode },
  ): void
}>()
</script>

<template>
  <div class="mt-2">
    <button
      class="flex w-full items-center gap-2 rounded-md bg-black/8 px-2 py-2 text-left text-[11px] text-current/80 hover:bg-black/12"
      :title="props.message.preview"
      @click="emits('toggle')"
    >
      <ChevronRight
        :class="cn('size-3 shrink-0 transition-transform', props.expanded && 'rotate-90')"
      />
      <span class="shrink-0 font-medium text-current">{{ props.message.author }}</span>
      <span class="truncate">{{ props.message.preview }}</span>
    </button>

    <div v-if="props.expanded" class="mt-2 rounded-md bg-black/8 px-2 py-2">
      <Accordion type="multiple" class="border-none bg-transparent">
        <AccordionItem
          v-for="toolCall in props.message.toolCalls || []"
          :key="toolCall.id"
          :value="toolCall.id"
          class="border-b border-current/10 last:border-b-0"
        >
          <AccordionTrigger
            class="gap-2 px-0 py-2 text-[11px] text-current/80 no-underline hover:no-underline"
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
          </AccordionTrigger>
          <AccordionContent class="h-auto px-0 pb-2 pt-0">
            <div class="relative rounded-md bg-black/10 p-2.5">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </div>
</template>
