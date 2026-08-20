import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'notification-events.js'],
      workbox: { importScripts: ['/notification-events.js'] },
      manifest: {
        name: 'evoria Secretaria IA',
        short_name: 'evoria',
        description: 'Organiza compromissos e pendências a partir das novas conversas da empresa.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ]
})
