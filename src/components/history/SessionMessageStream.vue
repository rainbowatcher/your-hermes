<!--
  负责：渲染稳定的消息流，并管理工具/文本消息的紧凑切换交互。
  不负责：详情头部与侧栏导航。
-->
<script setup lang="ts">
import {
  Bot,
  Braces,
  Brackets,
  ChevronRight,
  Eye,
  TerminalSquare,
  UserRound,
  Wrench,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import MessageMarkdown from '@/components/history/MessageMarkdown.vue'
import { cn } from '@/lib/utils'
import type {
  MessageRole,
  MessageRoleFilter,
  SessionMessage,
  ToolCallEntry,
  ToolMessageViewMode,
} from '@/types/history'

type TextMessageViewMode = 'render' | 'raw'

const props = defineProps<{
  availableRoles: MessageRole[]
  messageRoleFilter: MessageRoleFilter
  messages: SessionMessage[]
}>()

const emits = defineEmits<{
  (event: 'update:message-role-filter', value: MessageRoleFilter): void
}>()

const expandedToolIds = ref<string[]>([])
const toolViewModes = ref<Record<string, ToolMessageViewMode>>({})
const textViewModes = ref<Record<string, TextMessageViewMode>>({})

const roleTheme = {
  user: 'border-sky-500/20 bg-sky-500/8',
  assistant: 'border-violet-500/20 bg-violet-500/8',
  system: 'border-amber-500/20 bg-amber-500/8',
  tool: 'border-emerald-500/20 bg-emerald-500/8',
} as const

const roleLabels: Record<MessageRole, string> = {
  user: '用户',
  assistant: '助手',
  system: '系统',
  tool: '工具',
}

const filteredMessages = computed(() =>
  props.messages.filter(
    (message) => props.messageRoleFilter === 'all' || message.role === props.messageRoleFilter,
  ),
)

function isToolExpanded(messageId: string) {
  return expandedToolIds.value.includes(messageId)
}

function toggleToolMessage(message: SessionMessage) {
  expandedToolIds.value = isToolExpanded(message.id)
    ? expandedToolIds.value.filter((id) => id !== message.id)
    : [...expandedToolIds.value, message.id]
}

function toolViewKey(messageId: string, callId: string) {
  return `${messageId}:${callId}`
}

function setToolViewMode(messageId: string, toolCall: ToolCallEntry, mode: ToolMessageViewMode) {
  toolViewModes.value[toolViewKey(messageId, toolCall.id)] = mode
}

function toolViewMode(messageId: string, toolCall: ToolCallEntry) {
  return (
    toolViewModes.value[toolViewKey(messageId, toolCall.id)] ||
    (toolCall.primaryContent ? 'output' : 'raw')
  )
}

function toolContent(messageId: string, toolCall: ToolCallEntry) {
  if (toolViewMode(messageId, toolCall) === 'raw') {
    return toolCall.rawJson
  }
  return toolCall.primaryContent || toolCall.rawJson
}

function textViewMode(message: SessionMessage) {
  return textViewModes.value[message.id] || 'render'
}

function setTextViewMode(messageId: string, mode: TextMessageViewMode) {
  textViewModes.value[messageId] = mode
}

function roleIcon(role: MessageRole) {
  if (role === 'assistant') return Bot
  if (role === 'user') return UserRound
  if (role === 'system') return Braces
  return Wrench
}
</script>

<template>
  <Card class="flex min-h-0 flex-col border-border/70 bg-card/60 py-0">
    <CardHeader
      class="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <CardTitle class="text-xs font-medium">消息流</CardTitle>
        <CardDescription class="text-[11px]"
          >按真实消息顺序渲染，保留筛选与工具折叠。</CardDescription
        >
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <Button
          :variant="messageRoleFilter === 'all' ? 'secondary' : 'ghost'"
          size="sm"
          title="全部消息"
          @click="emits('update:message-role-filter', 'all')"
        >
          全部
        </Button>
        <Button
          v-for="role in availableRoles"
          :key="role"
          :variant="messageRoleFilter === role ? 'secondary' : 'ghost'"
          size="sm"
          :title="roleLabels[role]"
          @click="emits('update:message-role-filter', role)"
        >
          {{ roleLabels[role] }}
        </Button>
      </div>
    </CardHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <div
        v-if="filteredMessages.length === 0"
        class="px-4 py-8 text-center text-sm text-muted-foreground"
      >
        当前消息筛选下没有内容。
      </div>

      <div v-else class="space-y-3 px-3 py-2">
        <article
          v-for="message in filteredMessages"
          :id="message.id"
          :key="message.id"
          class="px-0 py-0"
        >
          <div :class="cn('relative rounded-md border p-2.5', roleTheme[message.role])">
            <div class="flex items-center justify-between gap-3 text-[11px] text-current/70">
              <div class="flex min-w-0 items-center gap-2 font-medium text-current">
                <component :is="roleIcon(message.role)" class="size-3" />
                <span class="truncate">{{ message.author }}</span>
                <Badge
                  variant="outline"
                  class="rounded-sm border-current/20 bg-transparent px-1.5 py-0 text-[10px] text-current"
                >
                  {{ roleLabels[message.role] }}
                </Badge>
                <Badge
                  v-if="message.role === 'tool' && message.hasError"
                  variant="outline"
                  class="rounded-sm border-current/20 bg-transparent px-1.5 py-0 text-[10px] text-current"
                >
                  error
                </Badge>
              </div>
              <span class="font-mono text-[10px]">
                {{ message.timestamp.slice(5, 16).replace('T', ' ') }}
              </span>
            </div>

            <template v-if="message.role === 'tool'">
              <button
                class="mt-2 flex w-full items-center gap-2 rounded-md bg-black/8 px-2 py-2 text-left text-[11px] text-current/80 hover:bg-black/12"
                :title="message.preview"
                @click="toggleToolMessage(message)"
              >
                <ChevronRight
                  :class="
                    cn(
                      'size-3 shrink-0 transition-transform',
                      isToolExpanded(message.id) && 'rotate-90',
                    )
                  "
                />
                <span class="shrink-0 font-medium text-current">{{ message.author }}</span>
                <span class="truncate">{{ message.preview }}</span>
              </button>

              <div v-if="isToolExpanded(message.id)" class="mt-2 rounded-md bg-black/8 px-2 py-2">
                <Accordion type="multiple" class="border-none bg-transparent">
                  <AccordionItem
                    v-for="toolCall in message.toolCalls || []"
                    :key="toolCall.id"
                    :value="toolCall.id"
                    class="border-b border-current/10 last:border-b-0"
                  >
                    <AccordionTrigger
                      class="gap-2 px-0 py-2 text-[11px] text-current/80 no-underline hover:no-underline"
                    >
                      <div class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="truncate font-medium text-current">{{ toolCall.title }}</span>
                        <span class="truncate">{{ toolCall.preview }}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent class="px-0 pb-2 pt-0 h-auto">
                      <div class="relative rounded-md bg-black/10 p-2.5">
                        <div class="absolute right-2 top-2 z-10 flex items-center gap-1">
                          <Button
                            :variant="
                              toolViewMode(message.id, toolCall) === 'output'
                                ? 'secondary'
                                : 'ghost'
                            "
                            size="icon-xs"
                            :disabled="!toolCall.primaryContent"
                            :title="toolCall.kind === 'skill' ? '显示技能内容' : '显示工具输出'"
                            @click.stop="setToolViewMode(message.id, toolCall, 'output')"
                          >
                            <TerminalSquare class="size-3" />
                          </Button>
                          <Button
                            :variant="
                              toolViewMode(message.id, toolCall) === 'raw' ? 'secondary' : 'ghost'
                            "
                            size="icon-xs"
                            title="显示 raw json"
                            @click.stop="setToolViewMode(message.id, toolCall, 'raw')"
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
                          >{{ toolContent(message.id, toolCall) }}</pre
                        >
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </template>

            <template v-else-if="message.role === 'user' || message.role === 'assistant'">
              <div class="relative mt-2 rounded-md bg-black/8 px-2.5 py-2.5">
                <div class="absolute right-2 top-2 z-10 flex items-center gap-1">
                  <Button
                    :variant="textViewMode(message) === 'render' ? 'secondary' : 'ghost'"
                    size="icon-xs"
                    title="显示渲染结果"
                    @click.stop="setTextViewMode(message.id, 'render')"
                  >
                    <Eye class="size-3" />
                  </Button>
                  <Button
                    :variant="textViewMode(message) === 'raw' ? 'secondary' : 'ghost'"
                    size="icon-xs"
                    title="显示原始消息"
                    @click.stop="setTextViewMode(message.id, 'raw')"
                  >
                    <Brackets class="size-3" />
                  </Button>
                </div>
                <MessageMarkdown
                  v-if="textViewMode(message) === 'render'"
                  class="pr-18"
                  :content="message.content"
                />
                <pre
                  v-else
                  class="overflow-x-auto whitespace-pre-wrap break-all pr-18 font-mono text-[11px] leading-5 text-current"
                  >{{ message.content }}</pre
                >
              </div>
            </template>

            <p v-else class="mt-2 whitespace-pre-wrap text-sm leading-6">
              {{ message.content }}
            </p>
          </div>
        </article>
      </div>
    </div>
  </Card>
</template>
