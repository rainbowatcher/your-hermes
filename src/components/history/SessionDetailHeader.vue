<!--
  负责：展示详情头部与会话元信息。
  不负责：消息流与导航侧栏。
-->
<script setup lang="ts">
import { AlertTriangle, Bot, Clock3, FolderKanban, Hash, MessageSquareMore, PanelsTopLeft, TerminalSquare, TimerReset } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import type { SessionDetail } from '@/types/history'

defineProps<{
  createdLabel: string
  session: SessionDetail
  updatedLabel: string
}>()
</script>

<template>
  <div class="border-b border-border/70 px-3 py-2 lg:px-4">
    <div class="flex items-center gap-2">
      <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" :title="session.title">
        {{ session.title }}
      </h2>
      <Badge variant="outline" class="px-1.5 py-0 text-[10px] font-mono" :title="session.platformLabel">
        {{ session.platform }}
      </Badge>
      <Badge variant="outline" class="px-1.5 py-0 text-[10px] font-mono" :title="session.chatType">
        {{ session.chatType }}
      </Badge>
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1" :title="session.workspace">
        <FolderKanban class="size-3" />
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1" :title="session.channel">
        <PanelsTopLeft class="size-3" />
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1" :title="session.model">
        <Bot class="size-3" />
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1" :title="`开始 ${createdLabel}`">
        <TimerReset class="size-3" />
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1" :title="`更新 ${updatedLabel}`">
        <Clock3 class="size-3" />
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 font-mono" :title="`${session.messageCount} 条消息`">
        <MessageSquareMore class="size-3" />
        {{ session.messageCount }}
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 font-mono" :title="`${session.toolMessageCount} 条工具调用`">
        <TerminalSquare class="size-3" />
        {{ session.toolMessageCount }}
      </span>
      <span class="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 font-mono" :title="`last_prompt_tokens: ${session.tokenCount}`">
        <Hash class="size-3" />
        {{ session.tokenCount }}
      </span>
      <span
        v-if="session.issueCount"
        class="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/8 px-1.5 py-1 font-mono text-amber-100"
        :title="`${session.issueCount} 条异常工具输出`"
      >
        <AlertTriangle class="size-3" />
        {{ session.issueCount }}
      </span>
    </div>
  </div>
</template>
