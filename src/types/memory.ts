/**
 * 负责：定义 Memory Inspect 页面和 API 使用的数据类型。
 * 不负责：文件读取、HTTP 请求与界面渲染。
 */
export interface MemoryInspectEntry {
  index: number
  content: string
  charCount: number
}

export interface MemoryInspectFile {
  exists: boolean
  updatedAt: string | null
  rawContent: string
  charCount: number
  entries: MemoryInspectEntry[]
}

export interface MemoryInspectResponse {
  memory: MemoryInspectFile
  user: MemoryInspectFile
}
