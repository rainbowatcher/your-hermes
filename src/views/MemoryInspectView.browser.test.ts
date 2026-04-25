import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import MemoryInspectView from './MemoryInspectView.vue'

const memoryResponse = {
  memory: {
    exists: true,
    rawContent: '第一条记忆\n§\n第二条记忆',
    charCount: 12,
    charLimit: 2200,
    updatedAt: '2026-04-25T00:00:00.000Z',
    entries: [
      { index: 0, content: '第一条记忆', charCount: 5 },
      { index: 1, content: '第二条记忆', charCount: 5 },
    ],
  },
  user: {
    exists: true,
    rawContent: '用户偏好',
    charCount: 4,
    charLimit: 1375,
    updatedAt: '2026-04-25T01:00:00.000Z',
    entries: [{ index: 0, content: '用户偏好', charCount: 4 }],
  },
}

const routes = [
  {
    path: '/sessions/:sessionId?',
    name: 'sessions',
    component: { template: '<div>Sessions Stub</div>' },
  },
  {
    path: '/skills',
    name: 'skills',
    component: { template: '<div>Skills Stub</div>' },
  },
  {
    path: '/inspect/memory',
    name: 'memory-inspect',
    component: MemoryInspectView,
  },
]

async function renderMemoryInspect() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  await router.push('/inspect/memory')
  await router.isReady()

  return render(MemoryInspectView, {
    global: {
      plugins: [createPinia(), router],
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('MemoryInspectView keeps page identity in the detail header while inspect controls stay outside it', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => {
    return new Response(JSON.stringify(memoryResponse), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)

  const screen = await renderMemoryInspect()

  await expect.element(screen.getByRole('heading', { name: 'Memory Inspect' })).toBeVisible()
  await expect.element(screen.getByLabelText('搜索记忆内容')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '切换到浅色模式' })).toBeVisible()
  await expect.element(screen.getByLabelText('记忆文件').getByText('12 / 2200')).toBeVisible()
  await expect.element(screen.getByText('capacity_limit')).toBeVisible()
  await expect.element(screen.getByLabelText('记忆条目').getByText('第一条记忆')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '条目' })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: '原文' })).toBeVisible()

  const detailHeader = screen.container.querySelector('[aria-label="记忆详情头部"]')
  const mergedSearch = detailHeader?.querySelector('input[aria-label="搜索记忆内容"]')
  const refreshButton = detailHeader?.querySelector('button:last-of-type')

  expect(detailHeader).not.toBeNull()
  expect(detailHeader?.textContent).toContain('Memory Inspect')
  expect(mergedSearch).toBeNull()
  expect(refreshButton?.textContent).toContain('刷新')
  expect(fetchMock).toHaveBeenCalledWith('/api/hermes/inspect/memory')
})

test('MemoryInspectView shows missing file fallback', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => {
    return new Response(
      JSON.stringify({
        memory: {
          exists: false,
          rawContent: '',
          charCount: 0,
          charLimit: 2200,
          updatedAt: null,
          entries: [],
        },
        user: memoryResponse.user,
      }),
      { status: 200 },
    )
  })
  vi.stubGlobal('fetch', fetchMock)

  const screen = await renderMemoryInspect()

  await expect
    .element(screen.getByText('未找到 MEMORY.md。缺失文件会以空快照展示，不影响页面使用。'))
    .toBeVisible()
})
