export function getHomeAssistantConfig() {
  // Проверяем, что мы в Home Assistant
  if (window.location.pathname.includes('city-dashboard')) {
    // Получаем hass объект из window
    const hassConnection = window.hassConnection;
    if (hassConnection) {
      return hassConnection.then((conn) => {
        return conn.config;
      });
    }
  }
  return Promise.reject('Not in Home Assistant');
}

export function getHomeAssistantAuth() {
  if (window.location.pathname.includes('city-dashboard')) {
    return window.hassConnection.then((conn) => {
      return conn.auth;
    });
  }
  return Promise.reject('Not in Home Assistant');
}

export function getHomeAssistantConnection() {
  if (window.location.pathname.includes('city-dashboard')) {
    return window.hassConnection;
  }
  return Promise.reject('Not in Home Assistant');
} 