import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from './App.vue'

const SessionStub = {
  template:
    '<main class="flex h-full min-h-0 flex-col overflow-hidden"><h1>Sessions Stub</h1></main>',
}
const SkillsStub = {
  template:
    '<main class="flex h-full min-h-0 flex-col overflow-hidden"><h1>Skills Stub</h1></main>',
}
const MemoryStub = {
  template:
    '<main class="flex h-full min-h-0 flex-col overflow-hidden"><h1>Memory Stub</h1></main>',
}

const routes = [
  {
    path: '/sessions/:sessionId?',
    name: 'sessions',
    component: SessionStub,
  },
  {
    path: '/skills',
    name: 'skills',
    component: SkillsStub,
  },
  {
    path: '/inspect/memory',
    name: 'memory-inspect',
    component: MemoryStub,
  },
]

async function renderApp(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  await router.push(initialPath)
  await router.isReady()

  const screen = await render(App, {
    global: {
      plugins: [createPinia(), router],
    },
  })

  return { router, screen }
}

test('App only provides the outer shell and leaves page navigation to routed views', async () => {
  const { screen } = await renderApp('/sessions/session-123')

  const appShell = screen.container.firstElementChild
  expect(appShell).not.toBeNull()
  expect(appShell?.className).toContain('bg-background')
  expect(screen.container.querySelector('nav[aria-label="主导航"]')).toBeNull()
  await expect.element(screen.getByRole('heading', { name: 'Sessions Stub' })).toBeVisible()
})

test('App uses a screen-height column layout with a shared overflow-hidden content shell', async () => {
  const { screen } = await renderApp('/skills')

  const appShell = screen.container.firstElementChild
  expect(appShell).not.toBeNull()
  expect(appShell?.className).toContain('h-screen')
  expect(appShell?.className).toContain('flex-col')
  expect(appShell?.className).toContain('overflow-hidden')
  await expect.element(screen.getByRole('heading', { name: 'Skills Stub' })).toBeVisible()
})
