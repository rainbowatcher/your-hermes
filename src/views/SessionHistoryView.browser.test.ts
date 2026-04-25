import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createPinia } from 'pinia'
import SessionHistoryView from './SessionHistoryView.vue'
import { router } from '@/router'

const profilesResponse = {
  profiles: [
    { id: 'default', label: 'Default', isDefault: true, available: true },
    { id: 'hetun', label: 'hetun', isDefault: false, available: true },
  ],
}

const defaultSessionsResponse = {
  sessions: [
    {
      id: 'session-123',
      title: 'Alpha Session',
      workspace: '/workspace/alpha',
      channel: '#general',
      sessionFilePath: 'session-123.jsonl',
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

const hetunSessionsResponse = {
  sessions: [
    {
      id: 'session-hetun',
      title: 'Hetun Session',
      workspace: '/workspace/hetun',
      channel: '#hetun',
      sessionFilePath: 'session-hetun.jsonl',
      status: 'active',
      summary: 'Hetun summary',
      tags: ['hetun'],
      participants: [],
      unreadCount: 0,
      pinned: false,
      updatedAt: '2026-04-25T11:00:00.000Z',
      createdAt: '2026-04-25T10:30:00.000Z',
      model: 'claude-haiku',
      messageCount: 6,
      tokenCount: 900,
      platform: 'discord',
      chatType: 'thread',
      platformLabel: 'Discord',
      groupLabel: 'Discord / Thread',
      issueCount: 0,
      toolMessageCount: 1,
      availableRoles: ['user', 'assistant'],
      relationKind: 'root',
      rootSessionId: 'session-hetun',
      hiddenFromList: false,
      branchCount: 0,
    },
  ],
}

const defaultSessionDetailResponse = {
  session: {
    ...defaultSessionsResponse.sessions[0],
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

const hetunSessionDetailResponse = {
  session: {
    ...hetunSessionsResponse.sessions[0],
    messages: [
      {
        id: 'message-hetun-1',
        role: 'user',
        author: 'Hetun',
        timestamp: '2026-04-25T10:31:00.000Z',
        content: 'Hetun world',
        preview: 'Hetun world',
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
    if (url.includes('/api/hermes/profiles')) {
      return new Response(JSON.stringify(profilesResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/sessions/session-123')) {
      return new Response(JSON.stringify(defaultSessionDetailResponse), { status: 200 })
    }
    return new Response(JSON.stringify(defaultSessionsResponse), { status: 200 })
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
  await expect.element(screen.getByRole('combobox', { name: '当前 Hermes profile' })).toHaveValue(
    'default',
  )

  const listPane = screen.container.querySelector('[aria-label="会话列表栏"]')
  const searchInput = screen.container.querySelector(
    'nav[aria-label="主导航"] input[aria-label="搜索标题、平台、频道、标签"]',
  )
  const themeButton = screen.container.querySelector(
    'nav[aria-label="主导航"] button[title="切换到浅色模式"]',
  )
  const listStats = listPane?.textContent ?? ''
  const sortButton = listPane?.querySelector('button[title="最近更新"]')

  expect(listPane).not.toBeNull()
  expect(searchInput).not.toBeNull()
  expect(themeButton).not.toBeNull()
  expect(sortButton).not.toBeNull()
  expect(listStats).toContain('1')

  const detailHeader = screen.container.querySelector('[aria-label="会话详情头部"]')
  expect(detailHeader).not.toBeNull()
  expect(detailHeader?.textContent).toContain('Alpha Session')
})

test('SessionHistoryView reloads list and detail when switching profile', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/profiles')) {
      return new Response(JSON.stringify(profilesResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/sessions/session-hetun') && url.includes('profile=hetun')) {
      return new Response(JSON.stringify(hetunSessionDetailResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/sessions/session-123')) {
      return new Response(JSON.stringify(defaultSessionDetailResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/sessions?profile=hetun')) {
      return new Response(JSON.stringify(hetunSessionsResponse), { status: 200 })
    }
    return new Response(JSON.stringify(defaultSessionsResponse), { status: 200 })
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
  await screen.getByRole('combobox', { name: '当前 Hermes profile' }).selectOptions('hetun')

  await expect.element(screen.getByRole('combobox', { name: '当前 Hermes profile' })).toHaveValue(
    'hetun',
  )
  await expect.element(screen.getByRole('heading', { name: 'Hetun Session' })).toBeVisible()
  expect(fetchMock).toHaveBeenCalledWith('/api/hermes/sessions?profile=hetun')
  expect(fetchMock).toHaveBeenCalledWith('/api/hermes/sessions/session-hetun?profile=hetun')
})
