import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolveFirebaseWebConfig, validateFirebaseBuild } from './src/lib/firebase-config.ts'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build') validateFirebaseBuild(env)
  return {
    define: { __SOLEKASIR_FIREBASE_CONFIG__: JSON.stringify(resolveFirebaseWebConfig(env)) },
    plugins: [vue(), tailwindcss(), VitePWA({
      registerType: 'prompt', includeAssets: ['icons/*.png'],
      manifest: {
        name: 'SoleKasir', short_name: 'SoleKasir',
        description: 'Kasir dan pengelolaan usaha cuci sepatu',
        theme_color: '#155b48', background_color: '#f6f7f4', display: 'standalone', start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallbackDenylist: [/^\/__/], cleanupOutdatedCaches: true },
    })],
    build: { chunkSizeWarningLimit: 650 },
    server: { port: 5173 },
  }
})
