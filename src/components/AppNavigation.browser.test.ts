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

test('AppNavigation highlights sessions route by route name and navigates to other pages', async () => {
  const { router, screen } = await renderNavigation('/sessions/session-123')

  await expect.element(screen.getByText('会话')).toHaveAttribute('aria-current', 'page')
  await expect.element(screen.getByText('技能')).not.toHaveAttribute('aria-current', 'page')
  await expect.element(screen.getByText('记忆')).not.toHaveAttribute('aria-current', 'page')

  await screen.getByRole('link', { name: '技能' }).click()
  expect(router.currentRoute.value.fullPath).toBe('/skills')

  await screen.getByRole('link', { name: '记忆' }).click()
  expect(router.currentRoute.value.fullPath).toBe('/inspect/memory')
})

test('AppNavigation does not reset current route when clicking the active item', async () => {
  const { router, screen } = await renderNavigation('/skills?path=software-development%2Fwriting-plans')

  const activeItem = screen.getByText('技能')
  await expect.element(activeItem).toHaveAttribute('aria-current', 'page')

  await activeItem.click()

  expect(router.currentRoute.value.fullPath).toBe('/skills?path=software-development%2Fwriting-plans')
})
