import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createPinia } from 'pinia'
import SessionHistoryView from './SessionHistoryView.vue'
import { router } from '@/router'

const sessionsResponse = {
  sessions: [
    {
      id: 'session-123',
      title: 'Alpha Session',
      workspace: '/workspace/alpha',
      channel: '#general',
      sessionFilePath: '/tmp/session-123.json',
      status: 'active',
      summary: 'Alpha summary',
      tags: ['alpha'],
      participants: [],
      unreadCount: 0,
      pinned: false,
      updatedAt: '2026-04-25T10:00:00.000Z',
      createdAt: '2026-04-25T09:00:00.000Z',
      model: 'claude-sonnet-4',
      messageCount: 12,
      tokenCount: 3200,
      platform: 'discord',
      chatType: 'thread',
      platformLabel: 'Discord',
      groupLabel: 'Discord / Thread',
      issueCount: 1,
      toolMessageCount: 2,
      availableRoles: ['user', 'assistant', 'tool'],
      relationKind: 'root',
      rootSessionId: 'session-123',
      hiddenFromList: false,
      branchCount: 0,
    },
  ],
}

const sessionDetailResponse = {
  session: {
    ...sessionsResponse.sessions[0],
    messages: [
      {
        id: 'message-1',
        role: 'user',
        author: 'User',
        timestamp: '2026-04-25T09:01:00.000Z',
        content: 'Hello world',
        preview: 'Hello world',
      },
    ],
    branches: [],
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('SessionHistoryView keeps session filters in the list pane while detail header stays focused on session metadata', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/sessions/session-123')) {
      return new Response(JSON.stringify(sessionDetailResponse), { status: 200 })
    }
    return new Response(JSON.stringify(sessionsResponse), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)

  await router.push('/sessions/session-123')
  await router.isReady()

  const screen = await render(SessionHistoryView, {
    global: {
      plugins: [createPinia(), router],
    },
  })

  await expect.element(screen.getByRole('heading', { name: 'Alpha Session' })).toBeVisible()

  const listPane = screen.container.querySelector('[aria-label="会话列表栏"]')
  const searchInput = listPane?.querySelector('input[title="搜索标题、平台、频道、标签"]')
  const themeButton = listPane?.querySelector('button[title="切换到浅色模式"]')
  const sortButton = listPane?.querySelector('button[title="最近更新"]')

  expect(listPane).not.toBeNull()
  expect(searchInput).not.toBeNull()
  expect(themeButton).not.toBeNull()
  expect(sortButton).not.toBeNull()

  const detailHeader = screen.container.querySelector('[aria-label="会话详情头部"]')
  expect(detailHeader).not.toBeNull()
  expect(detailHeader?.textContent).toContain('Alpha Session')
})
