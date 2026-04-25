import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import SkillDetail from './SkillDetail.vue'
import type { SkillDetail as SkillDetailModel } from '@/types/skills'

function createSkill(): SkillDetailModel {
  return {
    relativePath: 'software-development/writing-plans',
    name: 'writing-plans',
    title: 'Writing Plans',
    description: 'Write plans well',
    tags: ['planning'],
    linkedFileCount: 1,
    frontmatter: {
      name: 'writing-plans',
      metadata: { hermes: { tags: ['planning'] } },
    },
    markdownBody: '# Intro\n\n## Usage\n\nBody',
    anchors: [
      { id: 'intro', depth: 1, text: 'Intro' },
      { id: 'usage', depth: 2, text: 'Usage' },
    ],
    linkedFiles: [{ relativePath: 'templates/plan.md', kind: 'template' }],
  }
}

test('SkillDetail renders markdown, metadata, anchors and linked files', async () => {
  const screen = await render(SkillDetail, {
    props: {
      skill: createSkill(),
      total: 1,
    },
  })

  await expect.element(screen.getByRole('heading', { name: 'Writing Plans' })).toBeVisible()
  await expect.element(screen.getByText('Write plans well')).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Metadata' })).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Intro' })).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Usage' })).toBeVisible()
  await expect.element(screen.getByText('templates/plan.md')).toBeVisible()

  expect(screen.container.querySelector('#intro')).not.toBeNull()
  expect(screen.container.querySelector('#usage')).not.toBeNull()
})

test('SkillDetail anchor click scrolls inside rendered body', async () => {
  const scrollIntoView = vi.fn<(arg?: ScrollIntoViewOptions | boolean) => void>()
  Element.prototype.scrollIntoView = scrollIntoView

  const screen = await render(SkillDetail, {
    props: {
      skill: createSkill(),
      total: 1,
    },
  })

  await screen.getByRole('button', { name: 'Usage' }).click()

  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
})
