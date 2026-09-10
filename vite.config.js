import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'RAG Híbrido PWA Offline',
        short_name: 'RAG PWA',
        description: 'PWA RAG Híbrido Offline com IA de Borda e Ontologias OWL',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MiB para garantir cache offline de pacotes Edge AI
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'transformers-vendor': ['@xenova/transformers'],
          'n3-vendor': ['n3']
        }
      }
    },
    chunkSizeWarningLimit: 2500
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  }
})
