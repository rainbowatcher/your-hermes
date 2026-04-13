/**
 * 负责：提供类名合并工具。
 * 不负责：业务状态、样式主题定义。
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
