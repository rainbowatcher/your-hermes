/**
 * 负责：声明会话历史查看相关路由。
 * 不负责：页面级业务逻辑与状态管理。
 */
import { createRouter, createWebHistory } from 'vue-router'
import SessionHistoryView from '@/views/SessionHistoryView.vue'

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
      component: SessionHistoryView,
    },
  ],
})
