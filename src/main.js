import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// Limpa flags residuais e desregistra service workers concorrentes (ex: coi-serviceworker)
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.removeItem('coi_reload_attempt')
}

// Wrapper global para WebGPU: garante compatibilidade em navegadores mobile (ex: Chrome no Android / Samsung)
// Se o requestAdapter padrão retornar null, tenta automaticamente com featureLevel: "compatibility"
if (typeof navigator !== 'undefined' && navigator.gpu && typeof navigator.gpu.requestAdapter === 'function') {
  const originalRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu)
  navigator.gpu.requestAdapter = async function (options = {}) {
    try {
      const adapter = await originalRequestAdapter(options)
      if (adapter) return adapter
    } catch (_) {
      // Ignora erro inicial para tentar fallback de compatibilidade
    }

    if (!options?.featureLevel) {
      try {
        const compatAdapter = await originalRequestAdapter({
          ...options,
          featureLevel: 'compatibility'
        })
        if (compatAdapter) {
          console.info('[WebGPU] Adaptador inicializado com sucesso via featureLevel: "compatibility"')
          return compatAdapter
        }
      } catch (compatErr) {
        console.warn('[WebGPU] Falha ao solicitar adaptador em compatibility mode:', compatErr)
      }
    }
    return null
  }
}

// Registra o Service Worker único do PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
      if (scriptURL.includes('coi-serviceworker')) {
        console.warn('Desregistrando Service Worker conflitante:', scriptURL)
        reg.unregister()
      }
    }
  }).catch(() => {})

  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('Nova versão do RAG PWA disponível!')
    },
    onOfflineReady() {
      console.log('Aplicativo pronto para operar offline!')
    }
  })
}

createApp(App).mount('#app')
