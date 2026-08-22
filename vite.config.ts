import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
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
