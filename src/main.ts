/**
 * 负责：启动应用并注册 Pinia、Router 与全局主题状态。
 * 不负责：页面业务逻辑。
 */
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import { useThemeStore } from '@/stores/theme'
import '@/style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

useThemeStore(pinia)
app.mount('#app')
