<!--
  负责：渲染消息流标题与角色筛选工具栏。
  不负责：消息列表编排与消息内容展示。
-->
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { MessageRole, MessageRoleFilter } from '@/types/history'

const props = defineProps<{
  availableRoles: MessageRole[]
  messageRoleFilter: MessageRoleFilter
  roleLabels: Record<MessageRole, string>
}>()

const emits = defineEmits<{
  (event: 'update:message-role-filter', value: MessageRoleFilter): void
}>()
</script>

<template>
  <div class="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 class="text-xs font-medium">消息流</h3>
      <p class="text-[11px] text-muted-foreground">按真实消息顺序渲染，保留筛选与工具折叠。</p>
    </div>
    <div class="flex flex-wrap items-center gap-1">
      <Button
        :variant="props.messageRoleFilter === 'all' ? 'secondary' : 'ghost'"
        size="sm"
        title="全部消息"
        @click="emits('update:message-role-filter', 'all')"
      >
        全部
      </Button>
      <Button
        v-for="role in props.availableRoles"
        :key="role"
        :variant="props.messageRoleFilter === role ? 'secondary' : 'ghost'"
        size="sm"
        :title="props.roleLabels[role]"
        @click="emits('update:message-role-filter', role)"
      >
        {{ props.roleLabels[role] }}
      </Button>
    </div>
  </div>
</template>
