import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import SessionToolMessage from './SessionToolMessage.vue'
import type { SessionMessage, ToolCallEntry } from '@/types/history'

const toolCalls: ToolCallEntry[] = [
  {
    id: 'tool-1',
    title: 'Read file',
    name: 'Read',
    kind: 'tool',
    preview: 'read file',
    rawJson: '{"result":"ok"}',
    primaryContent: 'File output',
  },
  {
    id: 'tool-2',
    title: 'Search code',
    name: 'Grep',
    kind: 'tool',
    preview: 'search code',
    rawJson: '{"matches":2}',
    primaryContent: 'Search output',
  },
]

const message: SessionMessage = {
  id: 'tool-message',
  role: 'tool',
  author: '2 次工具调用',
  timestamp: '2026-04-15T12:34:56Z',
  content: '',
  preview: 'Read file · Search code',
  toolCalls,
}

test('SessionToolMessage shows per-tool collapsibles without repeated summary header', async () => {
  const screen = await render(SessionToolMessage, {
    props: {
      message,
      toolContent: (toolCall: ToolCallEntry) => toolCall.primaryContent,
      toolViewMode: () => 'output',
    },
  })

  expect(screen.container.textContent || '').not.toContain('2 次工具调用')
  expect(screen.container.textContent || '').not.toContain('Read file · Search code')

  const firstTrigger = screen.getByRole('button', { name: /Read file/ })
  await expect.element(firstTrigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.container.textContent || '').not.toContain('File output')

  await firstTrigger.click()

  await expect.element(firstTrigger).toHaveAttribute('aria-expanded', 'true')
  await expect.element(screen.getByText('File output')).toBeVisible()
})
