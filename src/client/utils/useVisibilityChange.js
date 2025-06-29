import { useEffect, useRef } from 'react';

// Hook для отслеживания изменений видимости страницы
export const useVisibilityChange = (onVisible, onHidden, deps = []) => {
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Страница скрыта
        wasHiddenRef.current = true;
        if (onHidden) {
          onHidden();
        }
      } else {
        // Страница видна
        if (wasHiddenRef.current && onVisible) {
          onVisible();
        }
        wasHiddenRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, deps);

  return {
    isHidden: document.hidden,
    wasHidden: wasHiddenRef.current
  };
};

// Hook для управления геолокацией в PWA режиме
export const usePWAGeolocation = (geolocationManager, onLocationUpdate) => {
  const updateIntervalRef = useRef(null);
  const lastLocationRef = useRef(null);

  // Функция обновления геолокации в фоновом режиме
  const updateLocationInBackground = async () => {
    try {
      const position = await geolocationManager.getCurrentPosition();
      
      // Проверяем, изменилась ли позиция значительно
      if (lastLocationRef.current) {
        const distance = geolocationManager.calculateDistance(
          lastLocationRef.current.lat,
          lastLocationRef.current.lon,
          position.lat,
          position.lon
        );
        
        // Обновляем только если изменение больше 100 метров
        if (distance > 100) {
          lastLocationRef.current = position;
          if (onLocationUpdate) {
            onLocationUpdate(position);
          }
        }
      } else {
        lastLocationRef.current = position;
        if (onLocationUpdate) {
          onLocationUpdate(position);
        }
      }
    } catch (error) {
      console.warn('Background location update failed:', error);
    }
  };

  // Запуск фонового обновления
  const startBackgroundUpdates = () => {
    if (updateIntervalRef.current) return;
    
    // Обновляем геолокацию каждые 2 минуты в фоновом режиме
    updateIntervalRef.current = setInterval(() => {
      updateLocationInBackground();
    }, 2 * 60 * 1000); // 2 минуты
  };

  // Остановка фонового обновления
  const stopBackgroundUpdates = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };

  // Обработка изменений видимости
  const handleVisible = () => {
    console.log('PWA: Page became visible, updating location');
    stopBackgroundUpdates();
    // Немедленно обновляем геолокацию при возврате в приложение
    updateLocationInBackground();
  };

  const handleHidden = () => {
    console.log('PWA: Page became hidden, starting background updates');
    startBackgroundUpdates();
  };

  // Используем хук видимости
  useVisibilityChange(handleVisible, handleHidden, [onLocationUpdate]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopBackgroundUpdates();
    };
  }, []);

  return {
    startBackgroundUpdates,
    stopBackgroundUpdates,
    updateLocationInBackground
  };
}; 