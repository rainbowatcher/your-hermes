import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import SessionMessageStream from './SessionMessageStream.vue'
import type { SessionMessage } from '@/types/history'

const messages: SessionMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    author: 'Rain',
    timestamp: '2026-04-15T12:34:56Z',
    content: 'user text',
    preview: 'user text',
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    author: 'Claude',
    timestamp: '2026-04-15T12:35:56Z',
    content: 'assistant text',
    preview: 'assistant text',
  },
]

test('SessionMessageStream toolbar renders filter as select icon button', async () => {
  const screen = await render(SessionMessageStream, {
    props: {
      availableRoles: ['user', 'assistant'],
      messageRoleFilter: 'all',
      messages,
    },
  })

  const filterSelect = screen.getByRole('combobox', { name: /过滤消息/ })
  await expect.element(filterSelect).toBeVisible()
  await filterSelect.click()

  const optionTexts = Array.from(document.body.querySelectorAll('[role="option"]')).map(
    (item) => item.textContent?.trim() || '',
  )
  expect(optionTexts).toContain('全部消息')
  expect(optionTexts).toContain('用户')
  expect(optionTexts).toContain('助手')
})

test('SessionMessageStream collapse button toggles all message cards', async () => {
  const screen = await render(SessionMessageStream, {
    props: {
      availableRoles: ['user', 'assistant'],
      messageRoleFilter: 'all',
      messages,
    },
  })

  const articles = Array.from(screen.container.querySelectorAll('article'))
  expect(articles).toHaveLength(2)
  expect(articles[0]?.getAttribute('data-state')).toBe('open')
  expect(articles[1]?.getAttribute('data-state')).toBe('closed')

  const expandAllButton = screen.getByRole('button', { name: /展开全部消息/ })
  await expect.element(expandAllButton).toBeVisible()
  await expandAllButton.click()

  expect(articles.every((article) => article.getAttribute('data-state') === 'open')).toBe(true)

  const collapseAllButton = screen.getByRole('button', { name: /折叠全部消息/ })
  await expect.element(collapseAllButton).toBeVisible()
  await collapseAllButton.click()

  expect(articles.every((article) => article.getAttribute('data-state') === 'closed')).toBe(true)
})
