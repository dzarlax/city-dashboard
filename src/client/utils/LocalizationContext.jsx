import React, { createContext, useContext, useMemo } from 'react';

const LocalizationContext = createContext();

const translations = {
  en: {
    // Header
    nearbyTransit: 'Nearby Transit',
    realtimeTransportInfo: 'Real-time transport information',
    updated: 'Updated',
    lastUpdated: 'Last updated',
    refresh: 'Refresh',
    
    // Bus Station
    noArrivalsScheduled: 'No arrivals scheduled',
    distance: 'Distance',
    minutes: 'min',
    
    // Loading
    loading: 'Loading...',
    
    // Location
    locationRequired: 'Location access required',
    enableLocation: 'Enable Location',
    locationPermissionDenied: 'Location permission denied',
    locationError: 'Location error',
    
    // Theme
    switchToDarkMode: 'Switch to dark mode',
    switchToLightMode: 'Switch to light mode',
    
    // Time
    now: 'Now',
    arriving: 'Arriving'
  },
  
  ru: {
    // Header
    nearbyTransit: 'Ближайший транспорт',
    realtimeTransportInfo: 'Информация о транспорте в реальном времени',
    updated: 'Обновлено',
    lastUpdated: 'Последнее обновление',
    refresh: 'Обновить',
    
    // Bus Station
    noArrivalsScheduled: 'Рейсов не запланировано',
    distance: 'Расстояние',
    minutes: 'мин',
    
    // Loading
    loading: 'Загрузка...',
    
    // Location
    locationRequired: 'Требуется доступ к местоположению',
    enableLocation: 'Включить геолокацию',
    locationPermissionDenied: 'Доступ к геолокации запрещен',
    locationError: 'Ошибка геолокации',
    
    // Theme
    switchToDarkMode: 'Переключить на темную тему',
    switchToLightMode: 'Переключить на светлую тему',
    
    // Time
    now: 'Сейчас',
    arriving: 'Прибывает'
  },
  
  sr: {
    // Header
    nearbyTransit: 'Prevoz u blizini',
    realtimeTransportInfo: 'Informacije o prevozu u realnom vremenu',
    updated: 'Ažurirano',
    lastUpdated: 'Poslednje ažuriranje',
    refresh: 'Osveži',
    
    // Bus Station
    noArrivalsScheduled: 'Nema zakazanih dolazaka',
    distance: 'Udaljenost',
    minutes: 'min',
    
    // Loading
    loading: 'Učitavanje...',
    
    // Location
    locationRequired: 'Potreban je pristup lokaciji',
    enableLocation: 'Omogući lokaciju',
    locationPermissionDenied: 'Pristup lokaciji je odbačen',
    locationError: 'Greška lokacije',
    
    // Theme
    switchToDarkMode: 'Prebaci na tamnu temu',
    switchToLightMode: 'Prebaci na svetlu temu',
    
    // Time
    now: 'Sada',
    arriving: 'Stiže'
  }
};

function detectLanguage() {
  const browserLanguage = navigator.language || navigator.languages[0];
  
  if (browserLanguage.startsWith('ru')) {
    return 'ru';
  } else if (browserLanguage.startsWith('sr')) {
    return 'sr';
  } else {
    return 'en'; // default
  }
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}

export function LocalizationProvider({ children }) {
  const language = useMemo(() => detectLanguage(), []);
  
  const t = useMemo(() => {
    return (key) => {
      return translations[language]?.[key] || translations.en[key] || key;
    };
  }, [language]);

  const value = useMemo(() => ({
    language,
    t
  }), [language, t]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
} 