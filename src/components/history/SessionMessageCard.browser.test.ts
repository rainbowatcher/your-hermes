import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import { h, markRaw } from 'vue'
import type { Component } from 'vue'
import SessionMessageCard from './SessionMessageCard.vue'
import type { SessionMessage } from '@/types/history'

const TestIcon: Component = markRaw({
  render: () => h('div'),
})

function createMessage(role: SessionMessage['role']): SessionMessage {
  return {
    id: `msg-${role}`,
    role,
    author: role === 'user' ? 'Rain' : 'Claude',
    timestamp: '2026-04-15T12:34:56Z',
    content: 'hello',
    preview: 'hello',
  }
}

test('SessionMessageCard respects expanded prop control', async () => {
  const expandedScreen = await render(SessionMessageCard, {
    props: {
      expanded: true,
      icon: TestIcon,
      message: createMessage('user'),
      roleLabel: 'User',
      themeClass: 'text-sky-500',
    },
    slots: {
      default: () => h('div', { 'data-testid': 'user-body' }, 'User body'),
    },
  })

  const expandedArticle = expandedScreen.container.querySelector('article')
  expect(expandedArticle).not.toBeNull()
  await expect.element(expandedArticle!).toHaveAttribute('data-state', 'open')
  await expect.element(expandedScreen.getByTestId('user-body')).toHaveTextContent('User body')

  const collapsedScreen = await render(SessionMessageCard, {
    props: {
      expanded: false,
      icon: TestIcon,
      message: createMessage('assistant'),
      roleLabel: 'Assistant',
      themeClass: 'text-violet-500',
    },
    slots: {
      default: () => h('div', { 'data-testid': 'assistant-body' }, 'Assistant body'),
    },
  })

  const collapsedArticle = collapsedScreen.container.querySelector('article')
  expect(collapsedArticle).not.toBeNull()
  await expect.element(collapsedArticle!).toHaveAttribute('data-state', 'closed')
  expect(collapsedScreen.container.querySelector('[data-testid="assistant-body"]')).toBeNull()
})

test('SessionMessageCard shows collapse arrow and scrollable content area', async () => {
  const screen = await render(SessionMessageCard, {
    props: {
      icon: TestIcon,
      message: createMessage('assistant'),
      roleLabel: 'Assistant',
      themeClass: 'text-violet-500',
    },
    slots: {
      default: () => h('div', { 'data-testid': 'body' }, 'Body content'),
    },
  })

  const article = screen.container.querySelector('article')
  expect(article).not.toBeNull()

  const icon = screen.container.querySelector('[data-testid="message-collapse-icon"]')
  expect(icon).not.toBeNull()

  const trigger = screen.getByRole('button', { name: /Claude/ })
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()

  const content = screen.container.querySelector('[data-testid="message-content"]')
  expect(content).not.toBeNull()
  expect(content?.getAttribute('class') || '').toContain('max-h-145')
  expect(content?.getAttribute('class') || '').toContain('overflow-auto')
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect.element(screen.getByTestId('body')).toHaveTextContent('Body content')
})
