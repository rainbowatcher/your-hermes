/**
 * 负责：用 markdown-it-async + shiki 渲染消息 Markdown。
 * 不负责：消息视图切换与界面状态。
 */
import { createMarkdownItAsync } from 'markdown-it-async'
import { codeToHtml, getSingletonHighlighter } from 'shiki'

const markdown = createMarkdownItAsync({
  breaks: true,
  linkify: true,
  typographer: false,
  highlight: async (code, lang) => {
    try {
      const highlighter = await getSingletonHighlighter({
        themes: ['github-dark'],
        langs: [lang || 'text'],
      })

      return highlighter.codeToHtml(code, {
        lang: lang || 'text',
        theme: 'github-dark',
      })
    }
    catch {
      return await codeToHtml(code, {
        lang: 'text',
        theme: 'github-dark',
      })
    }
  },
})

export async function renderMarkdown(content: string) {
  return await markdown.renderAsync(content)
}
