import {createApp} from 'vue'
import './input.css' // 引入全局样式（包含 Tailwind）
import 'vue-stream-markdown/index.css'
import 'vue-stream-markdown/theme.css'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
