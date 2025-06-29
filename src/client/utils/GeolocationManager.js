class GeolocationManager {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
    this.callbacks = new Set();
    this.errorCallbacks = new Set();
    this.isWatching = false;
    this.lastKnownPosition = null;
    
    // Загружаем последнюю известную позицию из localStorage
    this.loadLastKnownPosition();
  }

  // Загрузка последней известной позиции
  loadLastKnownPosition() {
    try {
      const stored = localStorage.getItem('lastKnownPosition');
      if (stored) {
        this.lastKnownPosition = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load last known position:', error);
    }
  }

  // Сохранение позиции в localStorage
  saveLastKnownPosition(position) {
    try {
      const positionData = {
        lat: position.lat,
        lon: position.lon,
        timestamp: Date.now()
      };
      localStorage.setItem('lastKnownPosition', JSON.stringify(positionData));
      this.lastKnownPosition = positionData;
    } catch (error) {
      console.warn('Failed to save position:', error);
    }
  }

  // Добавление колбэка для получения позиции
  onPositionChange(callback) {
    this.callbacks.add(callback);
    
    // Если у нас уже есть позиция, сразу её отправляем
    if (this.currentPosition) {
      callback(this.currentPosition);
    }
    
    return () => this.callbacks.delete(callback);
  }

  // Добавление колбэка для ошибок
  onError(callback) {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  // Уведомление всех колбэков о новой позиции
  notifyPositionCallbacks(position) {
    this.currentPosition = position;
    this.saveLastKnownPosition(position);
    this.callbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        console.error('Error in position callback:', error);
      }
    });
  }

  // Уведомление всех колбэков об ошибке
  notifyErrorCallbacks(error) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  // Проверка доступности геолокации
  isGeolocationAvailable() {
    // Проверяем базовую поддержку
    if (!navigator.geolocation) {
      return { available: false, reason: 'NOT_SUPPORTED' };
    }

    // Проверяем HTTPS требование (кроме localhost)
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isHTTPS = location.protocol === 'https:';
    
    if (!isHTTPS && !isLocalhost) {
      return { available: false, reason: 'HTTPS_REQUIRED' };
    }

    return { available: true };
  }

  // Запрос единовременной геолокации с улучшенными параметрами
  async getCurrentPosition() {
    const availability = this.isGeolocationAvailable();
    if (!availability.available) {
      throw new Error(`Geolocation unavailable: ${availability.reason}`);
    }

    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: true,
        timeout: 15000, // 15 секунд timeout
        maximumAge: 60000 // Кэш на 1 минуту
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          
          this.notifyPositionCallbacks(pos);
          resolve(pos);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          
          // Если есть последняя известная позиция, используем её
          if (this.lastKnownPosition) {
            const age = Date.now() - this.lastKnownPosition.timestamp;
            // Используем если позиция не старше 10 минут
            if (age < 10 * 60 * 1000) {
              const pos = {
                lat: this.lastKnownPosition.lat,
                lon: this.lastKnownPosition.lon,
                isStale: true
              };
              this.notifyPositionCallbacks(pos);
              resolve(pos);
              return;
            }
          }
          
          this.notifyErrorCallbacks(error);
          reject(error);
        },
        options
      );
    });
  }

  // Начало отслеживания позиции для PWA и мобильных
  startWatching() {
    if (!navigator.geolocation || this.isWatching) {
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 30000, // Больший timeout для watchPosition
      maximumAge: 30000 // Кэш на 30 секунд
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        // Проверяем, действительно ли позиция изменилась значительно
        if (this.hasPositionChanged(newPos)) {
          this.notifyPositionCallbacks(newPos);
        }
      },
      (error) => {
        console.warn('Watch position error:', error);
        this.notifyErrorCallbacks(error);
        
        // При ошибке можем попробовать перезапустить отслеживание
        if (error.code === error.TIMEOUT) {
          setTimeout(() => {
            if (this.isWatching) {
              this.stopWatching();
              this.startWatching();
            }
          }, 5000);
        }
      },
      options
    );

    this.isWatching = true;
  }

  // Проверка значительного изменения позиции
  hasPositionChanged(newPos) {
    if (!this.currentPosition) return true;
    
    // Вычисляем расстояние между старой и новой позицией
    const distance = this.calculateDistance(
      this.currentPosition.lat, 
      this.currentPosition.lon,
      newPos.lat, 
      newPos.lon
    );
    
    // Обновляем если изменение больше 50 метров
    return distance > 50;
  }

  // Расчет расстояния между двумя точками (в метрах)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Радиус Земли в метрах
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Остановка отслеживания
  stopWatching() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isWatching = false;
    }
  }

  // Проверка разрешений для геолокации
  async checkPermissions() {
    if (!navigator.permissions) {
      // Если Permissions API не поддерживается, проверяем через попытку получения позиции
      try {
        await this.getCurrentPosition();
        return 'granted';
      } catch (error) {
        if (error.code === 1) return 'denied';
        return 'prompt';
      }
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state; // 'granted', 'denied', 'prompt'
    } catch (error) {
      console.warn('Permission check failed:', error);
      return 'unknown';
    }
  }

  // Запрос разрешения с хорошим UX
  async requestPermission() {
    const permission = await this.checkPermissions();
    
    if (permission === 'granted') {
      return this.getCurrentPosition();
    }
    
    if (permission === 'denied') {
      throw new Error('Geolocation permission was denied. Please enable it in browser settings.');
    }
    
    // Если состояние 'prompt' или 'unknown', пытаемся получить позицию
    return this.getCurrentPosition();
  }

  // Очистка всех колбэков и остановка отслеживания
  destroy() {
    this.stopWatching();
    this.callbacks.clear();
    this.errorCallbacks.clear();
    this.currentPosition = null;
  }

  // Получение текущей позиции (синхронно)
  getCurrentPositionSync() {
    return this.currentPosition || this.lastKnownPosition;
  }
}

// Создаем глобальный экземпляр
const geolocationManager = new GeolocationManager();

export default geolocationManager; 