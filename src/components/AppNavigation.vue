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
    class="border-b border-border/70 bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-4"
  >
    <div class="flex min-h-13 items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-2 py-2">
        <span class="text-sm font-semibold tracking-tight text-foreground">your-hermes</span>
        <span class="hidden text-xs text-muted-foreground md:inline">inspect workspace</span>
      </div>

      <ul class="flex items-center gap-1 overflow-x-auto">
        <li v-for="item in items" :key="item.name" class="shrink-0">
          <span
            v-if="isActive(item)"
            :aria-current="'page'"
            class="inline-flex items-center border-b-2 border-foreground px-3 py-3 text-sm font-medium text-foreground"
          >
            {{ item.label }}
          </span>
          <RouterLink
            v-else
            :to="item.to"
            class="inline-flex items-center border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
