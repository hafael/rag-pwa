import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // Permite hospedagem em subdiretórios no GitHub Pages sem erros de assets
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'EdgeRAG AI',
        short_name: 'EdgeRAG',
        description: 'RAG Híbrido com processamento de IA direto no dispositivo (Edge AI).',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MiB para garantir cache offline de pacotes Edge AI e WebLLM
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'webllm-vendor': ['@mlc-ai/web-llm'],
          'transformers-vendor': ['@xenova/transformers'],
          'n3-vendor': ['n3']
        }
      }
    },
    chunkSizeWarningLimit: 6500
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
