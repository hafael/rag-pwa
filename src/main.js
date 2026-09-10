import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// Registra o Service Worker do PWA com recarga automática sob nova versão
if ('serviceWorker' in navigator) {
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
