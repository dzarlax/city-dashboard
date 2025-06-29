// Custom Service Worker для City Dashboard PWA
const CACHE_NAME = 'city-dashboard-v1';
const SERVER_IP = 'https://transport-api.dzarlax.dev';

// Ресурсы для кэширования
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/dash.svg'
];

// API endpoints для кэширования
const API_CACHE_PATTERNS = [
  new RegExp(`${SERVER_IP}/api/env`),
  new RegExp(`${SERVER_IP}/api/stations/.*`)
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('SW: Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('SW: Claiming clients');
        return self.clients.claim();
      })
  );
});

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Стратегия для API запросов - Network First с fallback на Cache
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Стратегия для статических файлов - Cache First
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Для остальных запросов - Network First
  event.respondWith(networkFirstStrategy(request));
});

// Network First стратегия
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные ответы
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Network failed, trying cache:', error);
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Если нет кэша, возвращаем offline страницу или ошибку
    throw error;
  }
}

// Cache First стратегия
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('SW: Failed to fetch:', request.url, error);
    throw error;
  }
}

// Background Sync для фоновых обновлений геолокации
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync event:', event.tag);
  
  if (event.tag === 'background-location-update') {
    event.waitUntil(backgroundLocationUpdate());
  }
  
  if (event.tag === 'background-transit-update') {
    event.waitUntil(backgroundTransitUpdate());
  }
});

// Фоновое обновление геолокации
async function backgroundLocationUpdate() {
  try {
    console.log('SW: Starting background location update');
    
    // Отправляем сообщение всем клиентам для обновления геолокации
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_LOCATION_UPDATE'
      });
    });
    
  } catch (error) {
    console.error('SW: Background location update failed:', error);
  }
}

// Фоновое обновление транспорта
async function backgroundTransitUpdate() {
  try {
    console.log('SW: Starting background transit update');
    
    // Получаем сохраненную геолокацию
    const locationData = await getStoredLocation();
    if (!locationData) {
      console.log('SW: No stored location for background update');
      return;
    }
    
    // Загружаем данные о транспорте
    const transitData = await fetchTransitData(locationData);
    
    // Отправляем уведомления о критических обновлениях
    await checkForCriticalUpdates(transitData);
    
  } catch (error) {
    console.error('SW: Background transit update failed:', error);
  }
}

// Получение сохраненной геолокации
async function getStoredLocation() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Запрашиваем у клиента текущую геолокацию
      const client = clients[0];
      const response = await new Promise((resolve) => {
        client.postMessage({
          type: 'GET_CURRENT_LOCATION'
        });
        
        // Timeout через 5 секунд
        setTimeout(() => resolve(null), 5000);
        
        // Слушаем ответ
        const messageHandler = (event) => {
          if (event.data.type === 'CURRENT_LOCATION_RESPONSE') {
            self.removeEventListener('message', messageHandler);
            resolve(event.data.location);
          }
        };
        self.addEventListener('message', messageHandler);
      });
      
      return response;
    }
    
    return null;
  } catch (error) {
    console.error('SW: Failed to get stored location:', error);
    return null;
  }
}

// Загрузка данных транспорта
async function fetchTransitData(location) {
  try {
    const cities = ['bg', 'ns', 'nis'];
    const promises = cities.map(city => {
      const params = new URLSearchParams({
        lat: location.lat,
        lon: location.lon,
        rad: 1000
      });
      
      return fetch(`${SERVER_IP}/api/stations/${city}/all?${params.toString()}`);
    });
    
    const responses = await Promise.all(promises);
    const data = await Promise.all(responses.map(r => r.json()));
    
    return data.flat();
  } catch (error) {
    console.error('SW: Failed to fetch transit data:', error);
    return [];
  }
}

// Проверка критических обновлений
async function checkForCriticalUpdates(transitData) {
  try {
    // Находим транспорт с критичным временем прибытия (< 5 минут)
    const criticalTransit = transitData
      .filter(station => station.vehicles && station.vehicles.length > 0)
      .flatMap(station => 
        station.vehicles
          .filter(vehicle => vehicle.secondsLeft <= 300) // 5 минут
          .map(vehicle => ({
            ...vehicle,
            stationName: station.name,
            city: station.city
          }))
      );
    
    if (criticalTransit.length > 0) {
      console.log('SW: Found critical transit updates:', criticalTransit.length);
      
      // Отправляем push-уведомление (если разрешены)
      await showCriticalTransitNotification(criticalTransit[0]);
    }
    
  } catch (error) {
    console.error('SW: Failed to check critical updates:', error);
  }
}

// Показ уведомления о критическом времени прибытия
async function showCriticalTransitNotification(vehicle) {
  try {
    const permission = await self.registration.pushManager.permissionState({
      userVisibleOnly: true
    });
    
    if (permission === 'granted') {
      await self.registration.showNotification(
        `🚌 Скоро прибытие!`,
        {
          body: `${vehicle.route} прибудет через ${Math.ceil(vehicle.secondsLeft / 60)} мин на ${vehicle.stationName}`,
          icon: '/dash.svg',
          badge: '/dash.svg',
          tag: 'critical-transit',
          requireInteraction: false,
          actions: [
            {
              action: 'view',
              title: 'Открыть приложение'
            }
          ]
        }
      );
    }
  } catch (error) {
    console.error('SW: Failed to show notification:', error);
  }
}

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification click received.');
  
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  console.log('SW: Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'REGISTER_BACKGROUND_SYNC') {
    // Регистрируем фоновую синхронизацию
    self.registration.sync.register('background-transit-update');
  }
}); 