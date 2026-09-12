import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// Limpa flags residuais e desregistra service workers concorrentes (ex: coi-serviceworker)
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.removeItem('coi_reload_attempt')
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
