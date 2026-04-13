<!--
  负责：渲染消息流、工具调用分组与文本消息视图切换。
  不负责：详情头部与侧栏导航。
-->
<script setup lang="ts">
import { Bot, Braces, ChevronRight, UserRound, Wrench } from "lucide-vue-next";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageMarkdown from "@/components/history/MessageMarkdown.vue";
import { cn } from "@/lib/utils";
import type {
  MessageRole,
  MessageRoleFilter,
  SessionMessage,
  ToolCallEntry,
  ToolMessageViewMode,
} from "@/types/history";
import CardContent from "../ui/card/CardContent.vue";

type TextMessageViewMode = "render" | "raw";

const props = defineProps<{
  availableRoles: MessageRole[];
  messageRoleFilter: MessageRoleFilter;
  messages: SessionMessage[];
}>();

const emits = defineEmits<{
  (event: "update:message-role-filter", value: MessageRoleFilter): void;
}>();

const expandedToolIds = ref<string[]>([]);
const toolViewModes = ref<Record<string, ToolMessageViewMode>>({});
const textViewModes = ref<Record<string, TextMessageViewMode>>({});

const roleTheme = {
  user: "border-sky-500/20 bg-sky-500/8",
  assistant: "border-violet-500/20 bg-violet-500/8",
  system: "border-amber-500/20 bg-amber-500/8",
  tool: "border-emerald-500/20 bg-emerald-500/8",
} as const;

const roleLabels: Record<MessageRole, string> = {
  user: "用户",
  assistant: "助手",
  system: "系统",
  tool: "工具",
};

const filteredMessages = computed(() =>
  props.messages.filter(
    (message) => props.messageRoleFilter === "all" || message.role === props.messageRoleFilter,
  ),
);

function isToolExpanded(messageId: string) {
  return expandedToolIds.value.includes(messageId);
}

function toggleToolMessage(message: SessionMessage) {
  expandedToolIds.value = isToolExpanded(message.id)
    ? expandedToolIds.value.filter((id) => id !== message.id)
    : [...expandedToolIds.value, message.id];
}

function toolViewKey(messageId: string, callId: string) {
  return `${messageId}:${callId}`;
}

function toolViewMode(messageId: string, toolCall: ToolCallEntry) {
  return (
    toolViewModes.value[toolViewKey(messageId, toolCall.id)] ||
    (toolCall.commandOutput ? "output" : "raw")
  );
}

function setToolViewMode(messageId: string, toolCall: ToolCallEntry, mode: ToolMessageViewMode) {
  toolViewModes.value[toolViewKey(messageId, toolCall.id)] = mode;
}

function toolContent(messageId: string, toolCall: ToolCallEntry) {
  if (toolViewMode(messageId, toolCall) === "raw") {
    return toolCall.rawJson;
  }
  return toolCall.commandOutput || toolCall.rawJson;
}

function textViewMode(message: SessionMessage) {
  return textViewModes.value[message.id] || "render";
}

function setTextViewMode(messageId: string, mode: TextMessageViewMode) {
  textViewModes.value[messageId] = mode;
}

function roleIcon(role: MessageRole) {
  if (role === "assistant") return Bot;
  if (role === "user") return UserRound;
  if (role === "system") return Braces;
  return Wrench;
}
</script>

<template>
  <Card class="min-h-0 border-border/70 bg-card/60">
    <CardHeader class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <CardTitle>消息流</CardTitle>
      <CardAction>
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
      </CardAction>
    </CardHeader>
    <ScrollArea class="min-h-0 flex-1">
      <CardContent>
        <div class="space-y-2">
          <article
            v-for="message in filteredMessages"
            :id="message.id"
            :key="message.id"
            :class="cn('rounded-md border p-2.5', roleTheme[message.role])"
          >
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
                {{ message.timestamp.slice(5, 16).replace("T", " ") }}
              </span>
            </div>

            <template v-if="message.role === 'tool'">
              <button
                class="mt-2 flex w-full items-center gap-2 rounded-md border border-current/15 bg-black/10 px-2.5 py-2 text-left text-[11px] text-current/80"
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

              <div
                v-if="isToolExpanded(message.id)"
                class="mt-2 space-y-2 rounded-md border border-current/15 bg-black/10 p-2.5"
              >
                <section
                  v-for="toolCall in message.toolCalls || []"
                  :key="toolCall.id"
                  class="rounded-md border border-current/15 bg-black/10 p-2.5"
                >
                  <div class="flex items-center gap-2 text-[11px] text-current/80">
                    <span class="font-medium text-current">{{ toolCall.title }}</span>
                    <span class="truncate">{{ toolCall.preview }}</span>
                  </div>

                  <div class="mt-2 flex flex-wrap items-center gap-1.5">
                    <Button
                      :variant="
                        toolViewMode(message.id, toolCall) === 'output' ? 'secondary' : 'ghost'
                      "
                      size="sm"
                      :disabled="!toolCall.commandOutput"
                      @click="setToolViewMode(message.id, toolCall, 'output')"
                    >
                      output
                    </Button>
                    <Button
                      :variant="
                        toolViewMode(message.id, toolCall) === 'raw' ? 'secondary' : 'ghost'
                      "
                      size="sm"
                      @click="setToolViewMode(message.id, toolCall, 'raw')"
                    >
                      raw
                    </Button>
                    <span class="ml-auto text-[10px] text-current/60">
                      {{ toolCall.toolCallId }}
                    </span>
                  </div>

                  <pre
                    v-if="toolCall.toolArguments"
                    class="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-current/15 bg-black/15 p-2 font-mono text-[10px] leading-5"
                    >{{ toolCall.toolArguments }}</pre
                  >
                  <pre
                    class="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-current/15 bg-black/15 p-3 font-mono text-[11px] leading-5"
                    >{{ toolContent(message.id, toolCall) }}</pre
                  >
                </section>
              </div>
            </template>

            <template v-else-if="message.role === 'user' || message.role === 'assistant'">
              <div class="mt-2 flex items-center justify-end gap-1">
                <Button
                  :variant="textViewMode(message) === 'render' ? 'secondary' : 'ghost'"
                  size="sm"
                  @click="setTextViewMode(message.id, 'render')"
                >
                  render
                </Button>
                <Button
                  :variant="textViewMode(message) === 'raw' ? 'secondary' : 'ghost'"
                  size="sm"
                  @click="setTextViewMode(message.id, 'raw')"
                >
                  raw
                </Button>
              </div>
              <MessageMarkdown
                v-if="textViewMode(message) === 'render'"
                class="mt-2"
                :content="message.content"
              />
              <pre
                v-else
                class="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-black/10 p-3 font-mono text-[11px] leading-5"
                >{{ message.content }}</pre
              >
            </template>

            <p v-else class="mt-2 whitespace-pre-wrap text-sm leading-6">
              {{ message.content }}
            </p>
          </article>

          <div
            v-if="filteredMessages.length === 0"
            class="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground"
          >
            当前消息筛选下没有内容。
          </div>
        </div>
      </CardContent>
    </ScrollArea>
  </Card>
</template>
