<!--
  负责：提供会话、技能、记忆三个主页面之间的全局导航。
  不负责：页面内业务筛选、数据加载或详情状态管理。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

interface NavigationItem {
  name: 'sessions' | 'skills' | 'memory-inspect'
  label: string
  to: { name: NavigationItem['name'] }
}

const route = useRoute()

const items: NavigationItem[] = [
  {
    name: 'sessions',
    label: '会话',
    to: { name: 'sessions' },
  },
  {
    name: 'skills',
    label: '技能',
    to: { name: 'skills' },
  },
  {
    name: 'memory-inspect',
    label: '记忆',
    to: { name: 'memory-inspect' },
  },
]

const activeName = computed(() => (typeof route.name === 'string' ? route.name : null))

function isActive(item: NavigationItem) {
  return activeName.value === item.name
}
</script>

<template>
  <nav
    aria-label="主导航"
    class="border-b border-border/70 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-4"
  >
    <ul class="flex items-center gap-2 overflow-x-auto">
      <li v-for="item in items" :key="item.name" class="shrink-0">
        <span
          v-if="isActive(item)"
          :aria-current="'page'"
          class="inline-flex items-center rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-border/70"
        >
          {{ item.label }}
        </span>
        <RouterLink
          v-else
          :to="item.to"
          class="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
