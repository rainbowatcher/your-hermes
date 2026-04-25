<!--
  负责：提供会话、技能、记忆三个主页面之间的全局导航与全局工具。
  不负责：页面内业务筛选、数据加载或详情状态管理。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MoonStar, Search, SunMedium } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useThemeStore } from '@/stores/theme'

interface NavigationItem {
  name: 'sessions' | 'skills' | 'memory-inspect'
  label: string
  to: { name: NavigationItem['name'] }
}

const props = defineProps<{
  searchPlaceholder?: string
  searchValue?: string
}>()

const emits = defineEmits<{
  (event: 'update:search', value: string): void
}>()

const route = useRoute()
const theme = useThemeStore()

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

const activeName = computed<NavigationItem['name'] | null>(() => {
  if (route.name === 'sessions') return 'sessions'
  if (route.name === 'skills') return 'skills'
  if (route.name === 'memory-inspect') return 'memory-inspect'
  return null
})

const searchPlaceholderByRoute: Record<NavigationItem['name'], string> = {
  sessions: '搜索标题、平台、频道、标签',
  skills: '搜索技能名、路径、标签',
  'memory-inspect': '搜索记忆内容',
}

const resolvedPlaceholder = computed(() => {
  if (props.searchPlaceholder) return props.searchPlaceholder
  if (activeName.value) return searchPlaceholderByRoute[activeName.value]
  return '搜索当前页面'
})

const resolvedSearchValue = computed(() => props.searchValue ?? '')
const showSearch = computed(() => Boolean(activeName.value && props.searchValue !== undefined))

function isActive(item: NavigationItem) {
  return activeName.value === item.name
}
</script>

<template>
  <nav
    aria-label="主导航"
    class="border-b border-border/70 bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-4"
  >
    <div class="flex min-h-13 flex-wrap items-center justify-between gap-3 py-2">
      <div class="flex min-w-0 items-center gap-4">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-sm font-semibold tracking-tight text-foreground">your-hermes</span>
          <span class="hidden text-xs text-muted-foreground md:inline">inspect workspace</span>
        </div>

        <ul class="flex items-center gap-1 overflow-x-auto">
          <li v-for="item in items" :key="item.name" class="shrink-0">
            <span
              v-if="isActive(item)"
              aria-current="page"
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

      <div class="flex min-w-0 flex-1 items-center justify-end gap-2 md:max-w-xl">
        <div v-if="showSearch" class="relative min-w-0 flex-1 md:max-w-sm">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            :model-value="resolvedSearchValue"
            :aria-label="resolvedPlaceholder"
            class="h-8 pl-8"
            :placeholder="resolvedPlaceholder"
            @update:model-value="(value) => emits('update:search', String(value))"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          :aria-label="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
          :title="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
          @click="theme.toggleTheme"
        >
          <MoonStar v-if="theme.isDark" class="size-3.5" />
          <SunMedium v-else class="size-3.5" />
        </Button>
      </div>
    </div>
  </nav>
</template>
