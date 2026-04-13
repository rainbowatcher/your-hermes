<!--
  负责：渲染单条消息的公共卡片壳层、角色元信息与锚点。
  不负责：具体文本消息、工具消息的内部展示逻辑。
-->
<script setup lang="ts">
import type { Component } from 'vue'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SessionMessage } from '@/types/history'

const props = defineProps<{
  icon: Component
  message: SessionMessage
  roleLabel: string
  themeClass: string
}>()
</script>

<template>
  <article :id="props.message.id" class="px-0 py-0">
    <div :class="cn('relative rounded-md border p-2.5', props.themeClass)">
      <div class="flex items-center justify-between gap-3 text-[11px] text-current/70">
        <div class="flex min-w-0 items-center gap-2 font-medium text-current">
          <component :is="props.icon" class="size-3" />
          <span class="truncate">{{ props.message.author }}</span>
          <Badge
            variant="outline"
            class="rounded-sm border-current/20 bg-transparent px-1.5 py-0 text-[10px] text-current"
          >
            {{ props.roleLabel }}
          </Badge>
          <Badge
            v-if="props.message.role === 'tool' && props.message.hasError"
            variant="outline"
            class="rounded-sm border-current/20 bg-transparent px-1.5 py-0 text-[10px] text-current"
          >
            error
          </Badge>
        </div>
        <span class="font-mono text-[10px]">
          {{ props.message.timestamp.slice(5, 16).replace('T', ' ') }}
        </span>
      </div>

      <slot />
    </div>
  </article>
</template>
