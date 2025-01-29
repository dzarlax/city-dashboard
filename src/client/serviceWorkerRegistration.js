function isHomeAssistant() {
  return window.location.pathname.includes('/local/city_dashboard/');
}

export function register() {
  // Skip service worker registration entirely in Home Assistant
  if (isHomeAssistant()) {
    console.log('Skipping Service Worker registration in Home Assistant');
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = 'https://transport.dzarlax.dev/service-worker.js';
      
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('Service Worker registered with scope: ', registration.scope);
        })
        .catch((error) => {
          console.warn('Service Worker registration skipped:', error);
        });
    });
  }
}