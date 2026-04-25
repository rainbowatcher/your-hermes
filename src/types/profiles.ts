/**
 * 负责：定义 Hermes profile 选择与展示所需的前端类型。
 * 不负责：HTTP 请求、状态管理与界面渲染。
 */
export interface HermesProfileSummary {
  id: string
  label: string
  isDefault: boolean
  available: boolean
}
