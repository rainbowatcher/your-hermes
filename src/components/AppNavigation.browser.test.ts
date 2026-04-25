import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppNavigation from './AppNavigation.vue'
import { useThemeStore } from '@/stores/theme'

const routes = [
  {
    path: '/sessions/:sessionId?',
    name: 'sessions',
    component: { template: '<div>Sessions View</div>' },
  },
  {
    path: '/skills',
    name: 'skills',
    component: { template: '<div>Skills View</div>' },
  },
  {
    path: '/inspect/memory',
    name: 'memory-inspect',
    component: { template: '<div>Memory Inspect View</div>' },
  },
]

async function renderNavigation(
  initialPath: string,
  options: { searchValue?: string; searchPlaceholder?: string } = {},
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  await router.push(initialPath)
  await router.isReady()

  const screen = await render(AppNavigation, {
    props: options,
    global: {
      plugins: [createPinia(), router],
    },
  })

  const theme = useThemeStore()

  return { router, screen, theme }
}

test('AppNavigation renders as a lightweight app-level top bar with brand identity and preserves current-route context', async () => {
  const { router, screen } = await renderNavigation('/sessions/session-123', {
    searchValue: 'Alpha Session',
  })

  const navigation = screen.container.querySelector('nav[aria-label="主导航"]')
  const navInner = screen.container.querySelector('nav[aria-label="主导航"] > div')
  const tabList = screen.container.querySelector('nav[aria-label="主导航"] ul')

  expect(navigation).not.toBeNull()
  expect(navigation?.className).toContain('border-b')
  expect(navigation?.className).toContain('backdrop-blur')
  expect(navigation?.className).toContain('bg-background/80')
  expect(navInner).not.toBeNull()
  expect(navInner?.className).toContain('justify-between')
  await expect.element(screen.getByText('your-hermes')).toBeVisible()
  expect(tabList).not.toBeNull()
  expect(tabList?.className).not.toContain('rounded-xl')
  expect(tabList?.className).not.toContain('border')
  expect(tabList?.className).not.toContain('shadow-sm')
  await expect.element(screen.getByText('会话')).toHaveAttribute('aria-current', 'page')
  await expect.element(screen.getByText('技能')).not.toHaveAttribute('aria-current', 'page')
  await expect.element(screen.getByText('记忆')).not.toHaveAttribute('aria-current', 'page')
  await expect
    .element(screen.getByLabelText('搜索标题、平台、频道、标签'))
    .toHaveValue('Alpha Session')
  await expect.element(screen.getByRole('button', { name: '切换到浅色模式' })).toBeVisible()

  await screen.getByRole('link', { name: '技能' }).click()
  expect(router.currentRoute.value.fullPath).toBe('/skills')

  await screen.getByRole('link', { name: '记忆' }).click()
  expect(router.currentRoute.value.fullPath).toBe('/inspect/memory')
})

test('AppNavigation keeps active styling lightweight while separating brand and page navigation', async () => {
  const { router, screen, theme } = await renderNavigation(
    '/skills?path=software-development%2Fwriting-plans',
    {
      searchValue: 'plan',
      searchPlaceholder: '搜索技能名、路径、标签',
    },
  )

  const activeItem = screen.getByText('技能')
  await expect.element(screen.getByText('your-hermes')).toHaveClass(/font-semibold/)
  await expect.element(activeItem).toHaveAttribute('aria-current', 'page')
  await expect.element(activeItem).toHaveClass(/border-b-2/)
  await expect.element(activeItem).toHaveClass(/text-foreground/)
  await expect
    .element(screen.getByRole('link', { name: '会话' }))
    .toHaveClass(/hover:text-foreground/)
  await expect.element(screen.getByLabelText('搜索技能名、路径、标签')).toHaveValue('plan')

  await screen.getByRole('button', { name: '切换到浅色模式' }).click()
  expect(theme.isDark).toBe(false)

  await activeItem.click()

  expect(router.currentRoute.value.fullPath).toBe(
    '/skills?path=software-development%2Fwriting-plans',
  )
})
