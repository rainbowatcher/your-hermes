/**
 * 负责：声明会话历史与技能管理相关路由。
 * 不负责：页面级业务逻辑与状态管理。
 */
import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/sessions',
    },
    {
      path: '/sessions/:sessionId?',
      name: 'sessions',
      component: () => import('@/views/SessionHistoryView.vue'),
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('@/views/SkillManagementView.vue'),
    },
    {
      path: '/inspect/memory',
      name: 'memory-inspect',
      component: () => import('@/views/MemoryInspectView.vue'),
    },
  ],
})
