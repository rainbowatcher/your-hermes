<!--
  负责：编排消息流列表，并管理工具/文本消息的本地展示状态。
  不负责：详情头部与侧栏导航。
-->
<script setup lang="ts">
import { Bot, Braces, UserRound, Wrench } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import SessionMessageCard from '@/components/history/SessionMessageCard.vue'
import SessionMessageStreamToolbar from '@/components/history/SessionMessageStreamToolbar.vue'
import SessionRichTextMessage, {
  type TextMessageViewMode,
} from '@/components/history/SessionRichTextMessage.vue'
import SessionToolMessage from '@/components/history/SessionToolMessage.vue'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  MessageRole,
  MessageRoleFilter,
  SessionMessage,
  ToolCallEntry,
  ToolMessageViewMode,
} from '@/types/history'

const props = defineProps<{
  availableRoles: MessageRole[]
  messageRoleFilter: MessageRoleFilter
  messages: SessionMessage[]
}>()

const emits = defineEmits<{
  (event: 'update:message-role-filter', value: MessageRoleFilter): void
}>()

const toolViewModes = ref<Record<string, ToolMessageViewMode>>({})
const textViewModes = ref<Record<string, TextMessageViewMode>>({})
const allExpanded = ref<boolean | null>(null)

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

function toolViewModeKey(messageId: string, toolCallId: string) {
  return `${messageId}:${toolCallId}`
}

function readToolViewMode(messageId: string, toolCall: ToolCallEntry) {
  return (
    toolViewModes.value[toolViewModeKey(messageId, toolCall.id)] ||
    (toolCall.primaryContent ? 'output' : 'raw')
  )
}

function writeToolViewMode(messageId: string, toolCall: ToolCallEntry, mode: ToolMessageViewMode) {
  toolViewModes.value[toolViewModeKey(messageId, toolCall.id)] = mode
}

function readToolContent(messageId: string, toolCall: ToolCallEntry) {
  return readToolViewMode(messageId, toolCall) === 'raw'
    ? toolCall.rawJson
    : toolCall.primaryContent || toolCall.rawJson
}

function readTextViewMode(messageId: string) {
  return textViewModes.value[messageId] || 'render'
}

function writeTextViewMode(messageId: string, mode: TextMessageViewMode) {
  textViewModes.value[messageId] = mode
}

function roleIcon(role: MessageRole) {
  if (role === 'assistant') return Bot
  if (role === 'user') return UserRound
  if (role === 'system') return Braces
  return Wrench
}

function isMessageExpanded(message: SessionMessage) {
  if (allExpanded.value === null) return message.role === 'user'
  return allExpanded.value
}

function toggleExpandAll() {
  allExpanded.value = allExpanded.value === true ? false : true
}
</script>

<template>
  <Card class="flex min-h-0 flex-col border-border/70 bg-card/60 py-0">
    <CardHeader class="border-b px-3 py-2">
      <CardTitle class="text-xs font-medium">消息流</CardTitle>
      <CardDescription class="text-[11px]">
        按真实消息顺序渲染，保留筛选与工具折叠。
      </CardDescription>
      <CardAction>
        <SessionMessageStreamToolbar
          :all-expanded="allExpanded === true"
          :available-roles="availableRoles"
          :message-role-filter="messageRoleFilter"
          :role-labels="roleLabels"
          @toggle-expand-all="toggleExpandAll"
          @update:message-role-filter="emits('update:message-role-filter', $event)"
        />
      </CardAction>
    </CardHeader>

    <CardContent class="min-h-0 flex-1 overflow-auto px-0">
      <div
        v-if="filteredMessages.length === 0"
        class="px-4 py-8 text-center text-sm text-muted-foreground"
      >
        当前消息筛选下没有内容。
      </div>

      <div v-else class="space-y-3 px-3 py-2">
        <SessionMessageCard
          v-for="message in filteredMessages"
          :key="message.id"
          :expanded="isMessageExpanded(message)"
          :icon="roleIcon(message.role)"
          :message="message"
          :role-label="roleLabels[message.role]"
          :theme-class="roleTheme[message.role]"
        >
          <SessionToolMessage
            v-if="message.role === 'tool'"
            :message="message"
            :tool-content="(toolCall) => readToolContent(message.id, toolCall)"
            :tool-view-mode="(toolCall) => readToolViewMode(message.id, toolCall)"
            @update:tool-view-mode="writeToolViewMode(message.id, $event.toolCall, $event.mode)"
          />

          <SessionRichTextMessage
            v-else-if="message.role === 'user' || message.role === 'assistant'"
            :message="message"
            :mode="readTextViewMode(message.id)"
            @update:mode="writeTextViewMode(message.id, $event)"
          />

          <p v-else class="mt-2 whitespace-pre-wrap text-sm leading-6">
            {{ message.content }}
          </p>
        </SessionMessageCard>
      </div>
    </CardContent>
  </Card>
</template>
