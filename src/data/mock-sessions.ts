/**
 * 负责：保留本地 mock 数据入口，供后续开发或离线调试使用。
 * 不负责：默认页面数据来源；当前页面优先读取 ~/.hermes API。
 */
import type { SessionRecord } from '@/types/history'

export const mockSessions: SessionRecord[] = []
