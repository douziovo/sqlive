import {createApp} from 'vue'
import './input.css' // 引入全局样式（包含 Tailwind）
import 'vue-stream-markdown/index.css'
import 'vue-stream-markdown/theme.css'
import RootLayout from './RootLayout.vue'
import { router } from './router'

const app = createApp(RootLayout)
app.use(router)
app.mount('#app')
