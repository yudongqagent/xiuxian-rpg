import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 相对路径 base，同时兼容 GitHub Pages 子路径与自定义域名
  base: './',
  plugins: [
    vue(),
    // M4：PWA —— 离线缓存 + 添加到主屏
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '凡人仙途',
        short_name: '凡人仙途',
        description: '仙路漫漫，凡躯亦可问长生 —— 六章可玩仙侠 RPG',
        lang: 'zh-CN',
        theme_color: '#1a120b',
        background_color: '#0d0906',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Phaser 等大资源体积可观：首次访问后全部预缓存会拖慢首装，
        // 采用运行时缓存（LRU）+ 预缓存应用外壳
        globPatterns: ['index.html', 'assets/*.css'],
        runtimeCaching: [
          {
            urlPattern: /assets\/.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'js-cache', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /assets\/.*\.(png|svg|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'asset-cache', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
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
