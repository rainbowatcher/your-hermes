/**
 * 负责：定义技能管理页面使用的只读技能类型。
 * 不负责：网络请求、状态管理与具体渲染。
 */
export interface SkillAnchor {
  id: string
  depth: 1 | 2 | 3
  text: string
}

export interface SkillLinkedFile {
  relativePath: string
  kind: 'file' | 'reference' | 'template' | 'script' | 'asset'
}

export interface SkillSummary {
  relativePath: string
  name: string
  title: string
  description: string
  tags: string[]
  linkedFileCount: number
}

export interface SkillDetail extends SkillSummary {
  frontmatter: Record<string, unknown>
  markdownBody: string
  anchors: SkillAnchor[]
  linkedFiles: SkillLinkedFile[]
}
