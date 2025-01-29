export const isHomeAssistant = () => {
    return window.location.pathname.includes('/local/city_dashboard/');
  };
  
  export const getServiceWorkerUrl = () => {
    return isHomeAssistant()
      ? `${window.location.origin}/local/city_dashboard/service-worker.js`
      : 'https://transport.dzarlax.dev/service-worker.js';
  };