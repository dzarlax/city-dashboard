// serviceWorkerRegistration.js

// Регистрация сервис-воркера
export function register() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const swUrl = `https://transport-api.dzarlax.dev/service-worker.js`;
        navigator.serviceWorker
          .register(swUrl)
          .then((registration) => {
            console.log('Service Worker registered with scope: ', registration.scope);
          })
          .catch((error) => {
            console.error('Service Worker registration failed: ', error);
          });
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