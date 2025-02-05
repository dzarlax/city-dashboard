export function isHomeAssistant() {
  return window.location.pathname.includes('city-dashboard');
}

export function getLocation() {
  if (isHomeAssistant()) {
    // В Home Assistant используем координаты из конфигурации
    return window.hassConnection.then((conn) => {
      const config = conn.config;
      return {
        coords: {
          latitude: config.latitude,
          longitude: config.longitude,
        }
      };
    });
  }
  
  // В браузере используем геолокацию
  return new Promise((resolve, reject) => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    } else {
      reject(new Error("Geolocation is not supported"));
    }
  });
}

export const getServiceWorkerUrl = () => {
  return isHomeAssistant()
    ? `${window.location.origin}/local/city_dashboard/service-worker.js`
    : 'https://transport.dzarlax.dev/service-worker.js';
};