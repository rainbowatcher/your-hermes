import { afterEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { createPinia } from 'pinia'
import SkillManagementView from './SkillManagementView.vue'
import { router } from '@/router'

const skillsResponse = [
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

afterEach(() => {
  vi.restoreAllMocks()
})

test('SkillManagementView keeps page identity in the detail header while global tools stay in the shared top bar', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/skills/detail')) {
      return new Response(JSON.stringify(detailResponse), { status: 200 })
    }
    return new Response(JSON.stringify({ skills: skillsResponse }), { status: 200 })
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

  const detailHeader = screen.container.querySelector('[aria-label="技能详情头部"]')
  const mergedSearch = detailHeader?.querySelector('input[placeholder="搜索技能名、路径、标签"]')
  const themeButton = detailHeader?.querySelector('button[title="切换到浅色模式"]')

  expect(detailHeader).not.toBeNull()
  expect(detailHeader?.textContent).toContain('Writing Plans')
  expect(mergedSearch).toBeNull()
  expect(themeButton).toBeNull()
  expect(fetchMock).toHaveBeenCalled()
  expect(router.currentRoute.value.query.path).toBe('software-development/writing-plans')
})

test('SkillManagementView keeps list filtering available even when no skill is selected', async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    if (url.includes('/api/hermes/skills/detail')) {
      return new Response(JSON.stringify(detailResponse), { status: 200 })
    }
    return new Response(JSON.stringify({ skills: skillsResponse }), { status: 200 })
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
