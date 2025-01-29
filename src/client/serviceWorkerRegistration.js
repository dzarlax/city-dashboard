function isHomeAssistant() {
  return window.location.pathname.includes('/local/city_dashboard/');
}

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Determine the correct service worker URL based on environment
      const swUrl = isHomeAssistant()
        ? `${window.location.origin}/local/city_dashboard/service-worker.js`
        : 'https://transport.dzarlax.dev/service-worker.js';

      // Determine the correct scope based on environment
      const options = isHomeAssistant()
        ? { scope: '/local/city_dashboard/' }
        : undefined;

      navigator.serviceWorker
        .register(swUrl, options)
        .then((registration) => {
          console.log('Service Worker registered with scope: ', registration.scope);

          // Add update checking
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('Service Worker update found!');

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New content is available; please refresh.');
              }
            });
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed: ', error);
        });

      // Add update checking on page load
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.addEventListener('statechange', () => {
          if (navigator.serviceWorker.controller.state === 'activated') {
            console.log('Service Worker activated after update.');
          }
        });
      }
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Service Worker unregister failed: ', error);
      });
  }
}

export function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        console.error('Service Worker update check failed: ', error);
      });
  }
}