import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { STORAGE_KEYS } from './constants';

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
    now: 'Just now',
    arriving: 'Arriving',

    // Language
    selectLanguage: 'Select Language',
    language: 'Language',

    // iOS install prompt
    iosInstallTitle: 'Add to Home Screen',
    iosInstallBody: 'Tap {share} then "Add to Home Screen"',

    // Transit changes
    changes: 'Changes',
    changesTitle: 'Current Changes',
    tryAgain: 'Try again',
    readMore: 'Read more',
    previous: 'Previous',
    next: 'Next',

    // Schedule fallback
    scheduledData: 'Schedule',
    scheduledDataTitle: 'Scheduled data (not live)',
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
    now: 'Только что',
    arriving: 'Прибывает',

    // Language
    selectLanguage: 'Выберите язык',
    language: 'Язык',

    // iOS install prompt
    iosInstallTitle: 'Добавить на экран «Домой»',
    iosInstallBody: 'Нажмите {share} затем «На экран "Домой"»',

    // Transit changes
    changes: 'Изменения',
    changesTitle: 'Актуальные изменения',
    tryAgain: 'Попробовать снова',
    readMore: 'Подробнее',
    previous: 'Назад',
    next: 'Вперёд',

    // Schedule fallback
    scheduledData: 'Расписание',
    scheduledDataTitle: 'Данные по расписанию (не live)',
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
    now: 'Upravo',
    arriving: 'Stiže',

    // Language
    selectLanguage: 'Odaberite jezik',
    language: 'Jezik',

    // iOS install prompt
    iosInstallTitle: 'Dodaj na početni ekran',
    iosInstallBody: 'Tapnite {share} pa "Dodaj na početni ekran"',

    // Transit changes
    changes: 'Izmene',
    changesTitle: 'Aktuelne izmene',
    tryAgain: 'Pokušaj ponovo',
    readMore: 'Opširnije',
    previous: 'Prethodna',
    next: 'Sledeća',

    // Schedule fallback
    scheduledData: 'Raspored',
    scheduledDataTitle: 'Podaci po rasporedu (nije live)',
  }
};

const availableLanguages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'sr', name: 'Srpski', flag: '🇷🇸' }
];

function detectLanguage() {
  // Check localStorage first
  const savedLanguage = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
  if (savedLanguage && translations[savedLanguage]) {
    return savedLanguage;
  }

  // Fallback to browser language
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
  const [language, setLanguage] = useState(() => detectLanguage());

  const changeLanguage = (langCode) => {
    if (translations[langCode]) {
      setLanguage(langCode);
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, langCode);
    }
  };

  const t = useMemo(() => {
    return (key) => {
      return translations[language]?.[key] || translations.en[key] || key;
    };
  }, [language]);

  const value = useMemo(() => ({
    language,
    t,
    changeLanguage,
    availableLanguages
  }), [language, t]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
} 