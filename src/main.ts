import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './ui/inkTheme.css'
// @ts-expect-error vite-plugin-pwa 虚拟模块
import { registerSW } from 'virtual:pwa-register'

// M4：PWA —— 离线缓存自动更新
window.addEventListener('load', () => registerSW({ immediate: true }))

createApp(App).mount('#app')
