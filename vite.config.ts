import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 相对路径 base，同时兼容 GitHub Pages 子路径与自定义域名
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vue: ['vue'],
        },
      },
    },
  },
})
