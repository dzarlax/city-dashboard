import geolocationManager from './utils/GeolocationManager';

let swRegistration = null;

// Регистрация service worker
export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // Регистрируем наш кастомный service worker
        const swUrl = '/sw-custom.js';
        swRegistration = await navigator.serviceWorker.register(swUrl);
        
        console.log('SW: Service Worker registered with scope:', swRegistration.scope);
        
        // Настраиваем обработчики событий
        setupServiceWorkerListeners();
        
        // НЕ регистрируем фоновую синхронизацию автоматически - только по запросу
        // Это может вызывать ошибки с уведомлениями на некоторых браузерах
        
        // НЕ запрашиваем разрешение автоматически - только по действию пользователя
        
        if (config && config.onSuccess) {
          config.onSuccess(swRegistration);
        }
        
      } catch (error) {
        console.error('SW: Service Worker registration failed:', error);
        if (config && config.onError) {
          config.onError(error);
        }
      }
    });
  }
}

// Настройка обработчиков сообщений от service worker
function setupServiceWorkerListeners() {
  if (!navigator.serviceWorker) return;
  
  // Слушаем сообщения от service worker
  navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
  
  // Слушаем обновления service worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('SW: Controller changed, reloading page');
    window.location.reload();
  });
}

// Обработка сообщений от service worker
async function handleServiceWorkerMessage(event) {
  const { type, data } = event.data;
  
  console.log('SW: Message received from service worker:', type, data);
  
  switch (type) {
    case 'BACKGROUND_LOCATION_UPDATE':
      // Service worker запрашивает обновление геолокации
      await handleBackgroundLocationUpdate();
      break;
      
    case 'GET_CURRENT_LOCATION':
      // Service worker запрашивает текущую геолокацию
      await sendCurrentLocationToSW();
      break;
      
    default:
      console.log('SW: Unknown message type:', type);
  }
}

// Обработка фонового обновления геолокации
async function handleBackgroundLocationUpdate() {
  try {
    console.log('SW: Handling background location update');
    
    // Обновляем геолокацию через наш менеджер
    const position = await geolocationManager.getCurrentPosition();
    console.log('SW: Location updated in background:', position);
    
    // Можем отправить уведомление в UI если приложение активно
    window.dispatchEvent(new CustomEvent('backgroundLocationUpdate', {
      detail: position
    }));
    
  } catch (error) {
    console.warn('SW: Background location update failed:', error);
  }
}

// Отправка текущей геолокации в service worker
async function sendCurrentLocationToSW() {
  try {
    const position = geolocationManager.getCurrentPositionSync();
    
    if (position && swRegistration && swRegistration.active) {
      swRegistration.active.postMessage({
        type: 'CURRENT_LOCATION_RESPONSE',
        location: position
      });
      
      console.log('SW: Current location sent to service worker:', position);
    } else {
      console.log('SW: No location available to send to service worker');
    }
    
  } catch (error) {
    console.error('SW: Failed to send location to service worker:', error);
  }
}

// Запрос разрешения на уведомления (только по действию пользователя)
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('SW: Notifications not supported');
    return false;
  }
  
  // Проверяем текущий статус разрешения
  if (Notification.permission === 'granted') {
    console.log('SW: Notification permission already granted');
    return true;
  }
  
  if (Notification.permission === 'denied') {
    console.log('SW: Notification permission denied');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    console.log('SW: Notification permission:', permission);
    
    return permission === 'granted';
  } catch (error) {
    // Эта ошибка ожидаема если вызвана не от пользовательского действия
    console.warn('SW: Failed to request notification permission (likely not user gesture):', error.message);
    return false;
  }
}

// Отправка сообщения в service worker
export function sendMessageToSW(message) {
  if (swRegistration && swRegistration.active) {
    swRegistration.active.postMessage(message);
  }
}

// Регистрация фоновой синхронизации
export async function registerBackgroundSync(tag) {
  if (swRegistration && 'sync' in swRegistration) {
    try {
      await swRegistration.sync.register(tag);
      console.log('SW: Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('SW: Failed to register background sync:', error);
      return false;
    }
  }
  return false;
}

// Отмена регистрации service worker
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('SW: Failed to unregister service worker:', error);
      });
  }
}

// Экспорт для ручного запроса уведомлений
export async function requestNotifications() {
  return await requestNotificationPermission();
}

// Проверка статуса уведомлений
export function getNotificationStatus() {
  if (!('Notification' in window)) {
    return 'not_supported';
  }
  return Notification.permission; // 'default', 'granted', 'denied'
}

// Проверка поддержки PWA функций
export function checkPWASupport() {
  return {
    serviceWorker: 'serviceWorker' in navigator,
    notifications: 'Notification' in window,
    backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
    geolocation: 'geolocation' in navigator,
    installPrompt: 'BeforeInstallPromptEvent' in window
  };
}