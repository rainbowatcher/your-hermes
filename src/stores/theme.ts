/**
 * 负责：管理全局明暗模式状态并同步到 documentElement。
 * 不负责：具体页面布局与视觉实现。
 */
import { computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export type ThemeMode = 'dark' | 'light'

export const useThemeStore = defineStore('theme', () => {
  const mode = useStorage<ThemeMode>('ui.theme', 'dark')

  const isDark = computed(() => mode.value === 'dark')

  watch(
    mode,
    (value) => {
      document.documentElement.classList.toggle('dark', value === 'dark')
      document.documentElement.dataset.theme = value
    },
    { immediate: true },
  )

  function toggleTheme() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  return {
    mode,
    isDark,
    toggleTheme,
  }
})
