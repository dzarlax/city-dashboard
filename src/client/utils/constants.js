// API Configuration
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://transport-api.dzarlax.dev';

// Polling intervals (milliseconds)
export const POLLING_INTERVAL = 10000; // 10 seconds
export const BACKGROUND_LOCATION_INTERVAL = 2 * 60 * 1000; // 2 minutes
export const STALE_DATA_THRESHOLD = 30000; // 30 seconds

// Geolocation
export const GEOLOCATION_TIMEOUT = 15000; // 15 seconds
export const GEOPOSITION_MAX_AGE = 60000; // 1 minute cache
export const WATCH_POSITION_TIMEOUT = 30000; // 30 seconds
export const CACHED_POSITION_MAX_AGE = 10 * 60 * 1000; // 10 minutes
export const POSITION_CHANGE_THRESHOLD = 50; // meters
export const BACKGROUND_UPDATE_THRESHOLD = 100; // meters

// Time thresholds (seconds)
export const NOW_ARRIVAL_THRESHOLD = 120; // 2 minutes
export const UPCOMING_ARRIVAL_THRESHOLD = 300; // 5 minutes
export const NOTIFY_BEFORE_ARRIVAL = 300; // 5 minutes before

// Display limits
export const MAX_ARRIVALS_PER_ROUTE = 5;
export const DEFAULT_SEARCH_RADIUS = 500; // meters

// Cities
export const CITIES = ['bg', 'ns', 'nis', 'kg', 'su', 'ue'];

// City display names and colors
export const CITY_INFO = {
  BG: {
    name: 'Belgrade',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700'
  },
  NS: {
    name: 'Novi Sad',
    badge: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700'
  },
  NIS: {
    name: 'Niš',
    badge: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-700'
  },
  KG: {
    name: 'Kragujevac',
    badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700'
  },
  SU: {
    name: 'Subotica',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700'
  },
  UE: {
    name: 'Užice',
    badge: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-700'
  }
};

// Geolocation error reasons
export const GEO_ERRORS = {
  HTTPS_REQUIRED: 'HTTPS_REQUIRED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT'
};

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_BASE = 1000; // 1 second
export const RETRY_DELAY_MAX = 10000; // 10 seconds

// LocalStorage keys
export const STORAGE_KEYS = {
  THEME: 'theme',
  LANGUAGE: 'language',
  FAVORITE_STATIONS: 'favoriteStations',
  SEARCH_RADIUS: 'searchRadius',
  SORT_BY: 'sortBy',
  LAST_KNOWN_POSITION: 'lastKnownPosition'
};

// Sort options
export const SORT_OPTIONS = {
  DISTANCE: 'distance',
  ARRIVAL_TIME: 'arrivalTime',
  NAME: 'name'
};
