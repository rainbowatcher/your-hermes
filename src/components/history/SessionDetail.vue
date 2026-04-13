<!--
  负责：编排详情头部、消息流与侧栏组件。
  不负责：会话列表筛选与服务端数据解析。
-->
<script setup lang="ts">
import { useDateFormat } from '@vueuse/core'
import { computed, nextTick } from 'vue'
import SessionDetailHeader from '@/components/history/SessionDetailHeader.vue'
import SessionDetailSidebar from '@/components/history/SessionDetailSidebar.vue'
import SessionMessageStream from '@/components/history/SessionMessageStream.vue'
import type {
  MessageRole,
  MessageRoleFilter,
  SessionDetail as SessionDetailModel,
} from '@/types/history'

const props = defineProps<{
  availableRoles: MessageRole[]
  isLoading?: boolean
  messageRoleFilter: MessageRoleFilter
  session: SessionDetailModel | null
}>()

const emits = defineEmits<{
  (event: 'update:message-role-filter', value: MessageRoleFilter): void
  (event: 'open-branch', branchId: string): void
}>()

const updatedLabel = computed(() =>
  props.session ? useDateFormat(props.session.updatedAt, 'YYYY-MM-DD HH:mm').value : '',
)
const createdLabel = computed(() =>
  props.session ? useDateFormat(props.session.createdAt, 'YYYY-MM-DD HH:mm').value : '',
)
const userNavigationItems = computed(
  () => props.session?.messages.filter((message) => message.role === 'user') || [],
)

async function jumpToMessage(messageId: string) {
  await nextTick()
  document.getElementById(messageId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <section class="flex min-h-0 flex-col bg-background">
    <div
      v-if="isLoading"
      class="flex h-full items-center justify-center p-8 text-sm text-muted-foreground"
    >
      正在读取会话详情…
    </div>

    <template v-else-if="session">
      <SessionDetailHeader
        :created-label="createdLabel"
        :session="session"
        :updated-label="updatedLabel"
      />

      <div
        class="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:p-4"
      >
        <SessionMessageStream
          :available-roles="availableRoles"
          :message-role-filter="messageRoleFilter"
          :messages="session.messages"
          @update:message-role-filter="emits('update:message-role-filter', $event)"
        />

        <SessionDetailSidebar
          :navigation-items="userNavigationItems"
          :selected-session-id="session.id"
          :session="session"
          @jump="jumpToMessage"
          @open-branch="emits('open-branch', $event)"
        />
      </div>
    </template>

    <div v-else class="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
      请选择左侧会话。
    </div>
  </section>
</template>
