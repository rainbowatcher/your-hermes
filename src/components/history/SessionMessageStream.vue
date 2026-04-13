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
import { Card } from '@/components/ui/card'
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

function toggleToolMessage(messageId: string) {
  expandedToolIds.value = isToolExpanded(messageId)
    ? expandedToolIds.value.filter((id) => id !== messageId)
    : [...expandedToolIds.value, messageId]
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

function textViewMode(messageId: string) {
  return textViewModes.value[messageId] || 'render'
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
    <SessionMessageStreamToolbar
      :available-roles="availableRoles"
      :message-role-filter="messageRoleFilter"
      :role-labels="roleLabels"
      @update:message-role-filter="emits('update:message-role-filter', $event)"
    />

    <div class="min-h-0 flex-1 overflow-auto">
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
          :icon="roleIcon(message.role)"
          :message="message"
          :role-label="roleLabels[message.role]"
          :theme-class="roleTheme[message.role]"
        >
          <SessionToolMessage
            v-if="message.role === 'tool'"
            :expanded="isToolExpanded(message.id)"
            :message="message"
            :tool-content="(toolCall) => toolContent(message.id, toolCall)"
            :tool-view-mode="(toolCall) => toolViewMode(message.id, toolCall)"
            @toggle="toggleToolMessage(message.id)"
            @update:tool-view-mode="setToolViewMode(message.id, $event.toolCall, $event.mode)"
          />

          <SessionRichTextMessage
            v-else-if="message.role === 'user' || message.role === 'assistant'"
            :message="message"
            :mode="textViewMode(message.id)"
            @update:mode="setTextViewMode(message.id, $event)"
          />

          <p v-else class="mt-2 whitespace-pre-wrap text-sm leading-6">
            {{ message.content }}
          </p>
        </SessionMessageCard>
      </div>
    </div>
  </Card>
</template>
