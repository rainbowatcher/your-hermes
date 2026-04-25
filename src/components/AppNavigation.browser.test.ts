import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppNavigation from './AppNavigation.vue'

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

async function renderNavigation(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  await router.push(initialPath)
  await router.isReady()

  const screen = await render(AppNavigation, {
    global: {
      plugins: [router],
    },
  })

  return { router, screen }
}

test('AppNavigation renders as a lightweight app-level top bar with brand identity and preserves current-route context', async () => {
  const { router, screen } = await renderNavigation('/sessions/session-123')

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

  await screen.getByRole('link', { name: '技能' }).click()
  expect(router.currentRoute.value.fullPath).toBe('/skills')

  await screen.getByRole('link', { name: '记忆' }).click()
  expect(router.currentRoute.value.fullPath).toBe('/inspect/memory')
})

test('AppNavigation keeps active styling lightweight while separating brand and page navigation', async () => {
  const { router, screen } = await renderNavigation(
    '/skills?path=software-development%2Fwriting-plans',
  )

  const activeItem = screen.getByText('技能')
  await expect.element(screen.getByText('your-hermes')).toHaveClass(/font-semibold/)
  await expect.element(activeItem).toHaveAttribute('aria-current', 'page')
  await expect.element(activeItem).toHaveClass(/border-b-2/)
  await expect.element(activeItem).toHaveClass(/text-foreground/)
  await expect
    .element(screen.getByRole('link', { name: '会话' }))
    .toHaveClass(/hover:text-foreground/)

  await activeItem.click()

  expect(router.currentRoute.value.fullPath).toBe(
    '/skills?path=software-development%2Fwriting-plans',
  )
})
