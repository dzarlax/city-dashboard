// API Configuration
export const SERVER_URL = 'https://transport-api.dzarlax.dev';

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
export const CITIES = ['bg', 'ns', 'nis'];

// City display names and colors
export const CITY_INFO = {
  BG: {
    name: 'Belgrade',
    gradient: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200 dark:from-emerald-900/50 dark:to-green-900/50 dark:text-emerald-200 dark:border-emerald-700'
  },
  NS: {
    name: 'Novi Sad',
    gradient: 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-200 dark:from-blue-900/50 dark:to-cyan-900/50 dark:text-blue-200 dark:border-blue-700'
  },
  NIS: {
    name: 'Niš',
    gradient: 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 border-purple-200 dark:from-purple-900/50 dark:to-violet-900/50 dark:text-purple-200 dark:border-purple-700'
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
