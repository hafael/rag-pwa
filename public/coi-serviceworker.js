/*! coi-serviceworker uninstaller - safely unregisters any legacy coi-serviceworker */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      self.registration.unregister().then(() => {
        return self.clients.matchAll();
      })
    );
  });
} else {
  try {
    sessionStorage.removeItem('coi_reload_attempt');
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          if (reg.active?.scriptURL?.includes('coi-serviceworker')) {
            reg.unregister();
          }
        }
      });
    }
  } catch (e) {}
}