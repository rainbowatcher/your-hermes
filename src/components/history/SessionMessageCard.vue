<!--
  负责：渲染单条消息的公共卡片壳层、角色元信息与锚点。
  不负责：具体文本消息、工具消息的内部展示逻辑。
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SessionMessage } from '@/types/history'

const props = defineProps<{
  expanded?: boolean
  icon: Component
  message: SessionMessage
  roleLabel: string
  themeClass: string
}>()

const defaultExpanded = computed(() => props.message.role === 'user')
const open = ref(props.expanded ?? defaultExpanded.value)

watch(
  () => props.expanded,
  (expanded) => {
    if (expanded !== undefined) {
      open.value = expanded
      return
    }

    open.value = defaultExpanded.value
  },
)
</script>

<template>
  <CollapsibleRoot
    v-slot="{ open: opened }"
    as="article"
    :id="props.message.id"
    class="px-0 py-0"
    v-model:open="open"
  >
    <div :class="cn('relative rounded-md border p-2.5', props.themeClass)">
      <div class="flex items-center justify-between gap-3 text-[11px] text-current/70">
        <CollapsibleTrigger
          as="button"
          class="flex min-w-0 flex-1 items-center gap-2 font-medium text-current text-left"
        >
          <ChevronRight
            data-testid="message-collapse-icon"
            :class="cn('size-3 shrink-0 transition-transform', opened && 'rotate-90')"
          />
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
        </CollapsibleTrigger>

        <span class="font-mono text-[10px]">
          {{ props.message.timestamp.slice(5, 16).replace('T', ' ') }}
        </span>
      </div>
      <CollapsibleContent
        as="div"
        data-testid="message-content"
        class="mt-2 max-h-145 overflow-auto px-0 pb-0 pt-0"
      >
        <slot />
      </CollapsibleContent>
    </div>
  </CollapsibleRoot>
</template>
