<!--
  负责：展示用户消息导航与参与者侧栏。
  不负责：消息流渲染。
-->
<script setup lang="ts">
import { ItemGroup, Item, ItemTitle, ItemContent } from '@/components/ui/item'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SessionDetail, SessionMessage } from '@/types/history'

defineProps<{
  navigationItems: SessionMessage[]
  session: SessionDetail
}>()

const emits = defineEmits<{
  (event: 'jump', messageId: string): void
}>()
</script>

<template>
  <div class="grid min-h-0 content-start gap-3">
    <Card class="min-h-0 border-border/70">
      <CardHeader>
        <CardTitle class="text-xs font-medium">消息导航</CardTitle>
      </CardHeader>
      <ScrollArea class="max-h-80">
        <CardContent class="px-1">
          <ItemGroup class="gap-0">
            <Item
              v-for="message in navigationItems"
              :key="message.id"
              class="py-1 cursor-pointer rounded-md text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              @click="emits('jump', message.id)"
            >
              <ItemContent>
                <ItemTitle class="font-mono text-[10px] line-clamp-2">{{
                  message.preview
                }}</ItemTitle>
              </ItemContent>
            </Item>
            <div
              v-if="navigationItems.length === 0"
              class="px-2 py-6 text-center text-[11px] text-muted-foreground"
            >
              当前筛选下没有用户消息。
            </div>
          </ItemGroup>
        </CardContent>
      </ScrollArea>
    </Card>

    <Card class="border-border/70 bg-card/60 py-0">
      <CardHeader class="px-3 py-2">
        <CardTitle class="text-xs font-medium">会话文件</CardTitle>
      </CardHeader>
      <CardContent class="px-3 pb-3">
        <p
          class="break-all rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 font-mono text-[10px] text-muted-foreground"
        >
          {{ session.sessionFilePath }}
        </p>
      </CardContent>
    </Card>

    <Card class="border-border/70 bg-card/60 py-0">
      <CardHeader class="px-3 py-2">
        <CardTitle class="text-xs font-medium">参与者</CardTitle>
      </CardHeader>
      <CardContent class="space-y-2 px-3 pb-3">
        <div
          v-for="participant in session.participants"
          :key="participant.id"
          class="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2"
        >
          <Avatar size="sm" class="bg-linear-to-br from-sky-500 to-violet-600">
            <AvatarFallback class="bg-transparent text-[10px] font-semibold text-white">
              {{ participant.shortName }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <p class="truncate text-xs font-medium text-foreground">
              {{ participant.name }}
            </p>
            <p class="text-[10px] text-muted-foreground">
              {{ participant.id }}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
