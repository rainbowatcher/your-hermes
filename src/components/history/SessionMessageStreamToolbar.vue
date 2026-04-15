<!--
  负责：渲染消息流头部右侧筛选与折叠控制。
  不负责：消息列表编排与标题文案展示。
-->
<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown, Filter } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { MessageRole, MessageRoleFilter } from '@/types/history'
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from 'reka-ui'

const props = defineProps<{
  allExpanded: boolean
  availableRoles: MessageRole[]
  messageRoleFilter: MessageRoleFilter
  roleLabels: Record<MessageRole, string>
}>()

const emits = defineEmits<{
  (event: 'toggle-expand-all'): void
  (event: 'update:message-role-filter', value: MessageRoleFilter): void
}>()
</script>

<template>
  <div class="flex items-center gap-1">
    <SelectRoot
      :model-value="props.messageRoleFilter"
      @update:model-value="emits('update:message-role-filter', $event as MessageRoleFilter)"
    >
      <SelectTrigger as-child aria-label="过滤消息">
        <Button variant="ghost" size="icon-sm" title="过滤消息">
          <Filter class="size-3.5" />
          <SelectValue class="sr-only" placeholder="过滤消息" />
        </Button>
      </SelectTrigger>
      <SelectContent position="popper" side="bottom" align="end" class="min-w-28">
        <SelectItem value="all">
          <SelectItemText>全部消息</SelectItemText>
        </SelectItem>
        <SelectItem v-for="role in props.availableRoles" :key="role" :value="role">
          <SelectItemText>{{ props.roleLabels[role] }}</SelectItemText>
        </SelectItem>
      </SelectContent>
    </SelectRoot>
    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="props.allExpanded ? '折叠全部消息' : '展开全部消息'"
      :title="props.allExpanded ? '折叠全部消息' : '展开全部消息'"
      @click="emits('toggle-expand-all')"
    >
      <ChevronsDownUp v-if="props.allExpanded" class="size-3.5" />
      <ChevronsUpDown v-else class="size-3.5" />
    </Button>
  </div>
</template>
