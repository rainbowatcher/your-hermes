import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
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

afterEach(() => {
  vi.restoreAllMocks()
})

test('MemoryInspectView loads memory inspect snapshot and switches tabs', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => {
    return new Response(JSON.stringify(memoryResponse), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)

  const screen = await render(MemoryInspectView)

  await expect.element(screen.getByRole('heading', { name: 'Memory Inspect' })).toBeVisible()
  await expect.element(screen.getByLabelText('记忆文件').getByText('12 / 2200')).toBeVisible()
  await expect.element(screen.getByLabelText('容量阈值').getByText('2200')).toBeVisible()
  await expect.element(screen.getByLabelText('记忆条目').getByText('第一条记忆')).toBeVisible()
  await expect
    .element(screen.getByLabelText('原文内容').getByText('第一条记忆\n§\n第二条记忆'))
    .toBeVisible()
  expect(fetchMock).toHaveBeenCalledWith('/api/hermes/inspect/memory')

  await screen.getByRole('button', { name: /USER PROFILE/ }).click()

  await expect.element(screen.getByLabelText('记忆文件').getByText('4 / 1375')).toBeVisible()
  await expect.element(screen.getByLabelText('容量阈值').getByText('1375')).toBeVisible()
  await expect.element(screen.getByLabelText('记忆条目').getByText('用户偏好')).toBeVisible()
  await expect.element(screen.getByLabelText('原文内容').getByText('用户偏好')).toBeVisible()
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

  const screen = await render(MemoryInspectView)

  await expect
    .element(screen.getByText('未找到 MEMORY.md。缺失文件会以空快照展示，不影响页面使用。'))
    .toBeVisible()
})
