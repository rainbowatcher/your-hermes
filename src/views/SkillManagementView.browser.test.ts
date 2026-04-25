import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createPinia } from 'pinia'
import SkillManagementView from './SkillManagementView.vue'
import { router } from '@/router'

const profilesResponse = {
  profiles: [
    { id: 'default', label: 'Default', isDefault: true, available: true },
    { id: 'hetun', label: 'hetun', isDefault: false, available: true },
  ],
}

const defaultSkillsResponse = [
  {
    relativePath: 'software-development/writing-plans',
    name: 'writing-plans',
    title: 'Writing Plans',
    description: 'Write plans well',
    tags: ['planning'],
    linkedFileCount: 1,
  },
  {
    relativePath: 'creative/ascii-art',
    name: 'ascii-art',
    title: 'ASCII Art',
    description: 'Make ascii art',
    tags: ['art'],
    linkedFileCount: 0,
  },
]

const hetunSkillsResponse = [
  {
    relativePath: 'autonomous-ai-agents/hermes-agent',
    name: 'hermes-agent',
    title: 'Hermes Agent',
    description: 'Profile specific agent workflow',
    tags: ['agent'],
    linkedFileCount: 2,
  },
]

const detailResponse = {
  skill: {
    relativePath: 'software-development/writing-plans',
    name: 'writing-plans',
    title: 'Writing Plans',
    description: 'Write plans well',
    tags: ['planning'],
    linkedFileCount: 1,
    frontmatter: { name: 'writing-plans' },
    markdownBody: '# Intro\n\nBody',
    anchors: [{ id: 'intro', depth: 1, text: 'Intro' }],
    linkedFiles: [{ relativePath: 'templates/plan.md', kind: 'template' }],
  },
}

const hetunDetailResponse = {
  skill: {
    relativePath: 'autonomous-ai-agents/hermes-agent',
    name: 'hermes-agent',
    title: 'Hermes Agent',
    description: 'Profile specific agent workflow',
    tags: ['agent'],
    linkedFileCount: 2,
    frontmatter: { name: 'hermes-agent' },
    markdownBody: '# Hermes Agent\n\nHetun body',
    anchors: [{ id: 'hermes-agent', depth: 1, text: 'Hermes Agent' }],
    linkedFiles: [{ relativePath: 'templates/task.md', kind: 'template' }],
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('SkillManagementView keeps page identity in the detail header while global tools stay in the shared top bar', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/profiles')) {
      return new Response(JSON.stringify(profilesResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/skills/detail')) {
      return new Response(JSON.stringify(detailResponse), { status: 200 })
    }
    return new Response(JSON.stringify({ skills: defaultSkillsResponse }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)

  await router.push('/skills?path=software-development%2Fwriting-plans')
  await router.isReady()

  const screen = await render(SkillManagementView, {
    global: {
      plugins: [createPinia(), router],
    },
  })

  await expect.element(screen.getByRole('heading', { name: 'Writing Plans' })).toBeVisible()
  await expect.element(screen.getByText('templates/plan.md')).toBeVisible()
  await expect.element(screen.getByRole('combobox', { name: '当前 Hermes profile' })).toHaveValue(
    'default',
  )

  const detailHeader = screen.container.querySelector('[aria-label="技能详情头部"]')
  const mergedSearch = detailHeader?.querySelector('input[placeholder="搜索技能名、路径、标签"]')
  const themeButton = detailHeader?.querySelector('button[title="切换到浅色模式"]')

  expect(detailHeader).not.toBeNull()
  expect(detailHeader?.textContent).toContain('Writing Plans')
  expect(mergedSearch).toBeNull()
  expect(themeButton).toBeNull()
  expect(fetchMock).toHaveBeenCalledWith('/api/hermes/profiles')
  expect(fetchMock).toHaveBeenCalled()
  expect(router.currentRoute.value.query.path).toBe('software-development/writing-plans')
})

test('SkillManagementView reloads list and detail when switching profile', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/profiles')) {
      return new Response(JSON.stringify(profilesResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/skills/detail') && url.includes('profile=hetun')) {
      return new Response(JSON.stringify(hetunDetailResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/skills/detail')) {
      return new Response(JSON.stringify(detailResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/skills?profile=hetun')) {
      return new Response(JSON.stringify({ skills: hetunSkillsResponse }), { status: 200 })
    }
    return new Response(JSON.stringify({ skills: defaultSkillsResponse }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)

  await router.push('/skills?path=software-development%2Fwriting-plans')
  await router.isReady()

  const screen = await render(SkillManagementView, {
    global: {
      plugins: [createPinia(), router],
    },
  })

  await expect.element(screen.getByRole('heading', { name: 'Writing Plans' })).toBeVisible()
  await screen.getByRole('combobox', { name: '当前 Hermes profile' }).selectOptions('hetun')

  await expect.element(screen.getByRole('combobox', { name: '当前 Hermes profile' })).toHaveValue(
    'hetun',
  )
  await expect
    .element(screen.getByLabelText('技能详情头部').getByRole('heading', { name: 'Hermes Agent' }))
    .toBeVisible()
  await expect.element(screen.getByText('templates/task.md')).toBeVisible()
  expect(fetchMock).toHaveBeenCalledWith('/api/hermes/skills?profile=hetun')
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/hermes/skills/detail?path=autonomous-ai-agents%2Fhermes-agent&profile=hetun',
  )
})

test('SkillManagementView keeps list filtering available even when no skill is selected', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/profiles')) {
      return new Response(JSON.stringify(profilesResponse), { status: 200 })
    }
    if (url.includes('/api/hermes/skills/detail')) {
      return new Response(JSON.stringify(detailResponse), { status: 200 })
    }
    return new Response(JSON.stringify({ skills: defaultSkillsResponse }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)

  await router.push('/skills')
  await router.isReady()

  const screen = await render(SkillManagementView, {
    global: {
      plugins: [createPinia(), router],
    },
  })

  const detailHeader = await screen.getByLabelText('技能详情头部').element()
  const input = screen.getByLabelText('搜索技能名、路径、标签')
  const themeButton = detailHeader.querySelector('button[aria-label="切换到浅色模式"]')

  expect(detailHeader.textContent || '').toContain('请选择左侧技能。')
  expect(themeButton).toBeNull()

  await input.fill('ascii')

  await expect.element(screen.getByRole('button', { name: /ASCII Art/ })).toBeVisible()
  const skillList = await screen.getByLabelText('技能列表').element()
  expect(skillList.textContent || '').not.toContain('Writing Plans')
})
