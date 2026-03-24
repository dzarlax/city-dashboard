import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapPin, Star } from 'lucide-react';
import Header from './components/Header';
import BusStation from './components/BusStation';
import { LoadingGrid } from './components/LoadingCard';
import LocationPermissionModal from './components/LocationPermissionModal';
import LocationStatus from './components/LocationStatus';
import LocationFallbackNotice from './components/LocationFallbackNotice';
import SettingsSheet from './components/SettingsSheet';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import ChangesModal from './components/ChangesModal';
import MaintenanceBanner from './components/MaintenanceBanner';
import geolocationManager from './utils/GeolocationManager';
import { usePWAGeolocation } from './utils/useVisibilityChange';
import {
  SERVER_URL,
  CITIES,
  POLLING_INTERVAL,
  DEFAULT_SEARCH_RADIUS,
  GEO_ERRORS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_BASE,
  RETRY_DELAY_MAX,
  STALE_DATA_THRESHOLD,
  STORAGE_KEYS,
  SORT_OPTIONS
} from './utils/constants';
import {
  isVehicleChanged,
  createStationKey,
  sortStationsByDistance,
  sortStationsByArrivalTime,
  sortStationsByName
} from './utils/helpers';

// Retry helper with exponential backoff
const fetchWithRetry = async (fetchFn, attempts = MAX_RETRY_ATTEMPTS) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (i === attempts - 1) throw error;

      const delay = Math.min(
        RETRY_DELAY_BASE * Math.pow(2, i),
        RETRY_DELAY_MAX
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const STOPS_SESSION_KEY = 'transit_stops_cache';

const BASE_POLL_INTERVAL = 15000;   // 15s — базовый интервал
const MAX_POLL_INTERVAL  = 60000;   // 60s — максимум при бэкофф
const BACKOFF_THRESHOLD  = 3;       // сколько пустых ответов до замедления
const BACKOFF_FACTOR     = 1.5;

// Modified transit data hook with correct state management
const useTransitData = (userLocation, config, isTabVisible = true) => {
  const [stationsMap, setStationsMap] = useState(() => {
    try {
      const cached = sessionStorage.getItem(STOPS_SESSION_KEY);
      if (cached) {
        const arr = JSON.parse(cached);
        return new Map(arr.map(s => [createStationKey(s.stopId, s.city.toLowerCase()), s]));
      }
    } catch {}
    return new Map();
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(STOPS_SESSION_KEY);
    } catch {
      return true;
    }
  });
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const previousVehicles = useRef(new Map());
  const pollIntervalRef = useRef(BASE_POLL_INTERVAL);
  const noChangeCount = useRef(0);

  const fetchStops = useCallback(async () => {
    if (!userLocation || !config.searchRad) return;

    try {
      let hasUpdates = false;
      const newStationsData = new Map();

      await Promise.all(CITIES.map(async city => {
        const params = new URLSearchParams({
          lat: userLocation.lat,
          lon: userLocation.lon,
          rad: config.searchRad,
        });

        const response = await fetchWithRetry(async () => {
          const res = await fetch(
            `${SERVER_URL}/api/stations/${city}/all?${params.toString()}`
          );
          if (!res.ok) {
            throw new Error(`Failed to fetch stations for ${city.toUpperCase()}`);
          }
          return res;
        });

        const data = await response.json();

        data.forEach(station => {
          const stationKey = createStationKey(station.stopId, city);
          const processedStation = {
            ...station,
            distance: `${Math.round(station.distance)}m`,
            city: city.toUpperCase(),
          };

          // Check if vehicles have changed
          const prevVehiclesForStation = previousVehicles.current.get(stationKey) || [];
          const vehiclesChanged = !prevVehiclesForStation.length ||
            processedStation.vehicles.some((vehicle, idx) => {
              const prevVehicle = prevVehiclesForStation[idx];
              return !prevVehicle || isVehicleChanged(prevVehicle, vehicle);
            });

          if (vehiclesChanged) {
            hasUpdates = true;
            previousVehicles.current.set(stationKey, [...processedStation.vehicles]);
          }

          newStationsData.set(stationKey, processedStation);
        });
      }));

      // Update stations map
      setStationsMap(newStationsData);

      // Persist to sessionStorage for instant display on next page load
      try {
        sessionStorage.setItem(STOPS_SESSION_KEY, JSON.stringify([...newStationsData.values()]));
      } catch {}

      // Adaptive polling: back off if nothing changed, reset on change
      if (hasUpdates) {
        noChangeCount.current = 0;
        pollIntervalRef.current = BASE_POLL_INTERVAL;
        setLastUpdated(new Date());
      } else {
        noChangeCount.current += 1;
        if (noChangeCount.current >= BACKOFF_THRESHOLD) {
          pollIntervalRef.current = Math.min(
            Math.round(pollIntervalRef.current * BACKOFF_FACTOR),
            MAX_POLL_INTERVAL
          );
        }
      }

      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load stations');
      setLoading(false);
    }
  }, [userLocation, config.searchRad]);

  useEffect(() => {
    if (!userLocation || !isTabVisible) return;

    let timeoutId;
    let cancelled = false;

    const schedule = async () => {
      await fetchStops();
      if (!cancelled) {
        timeoutId = setTimeout(schedule, pollIntervalRef.current);
      }
    };

    // Первый вызов немедленно, потом по динамическому интервалу
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      previousVehicles.current.clear();
      pollIntervalRef.current = BASE_POLL_INTERVAL;
      noChangeCount.current = 0;
    };
  }, [userLocation, fetchStops, isTabVisible]);

  const refresh = useCallback(() => {
    // Сброс бэкоффа при ручном обновлении
    pollIntervalRef.current = BASE_POLL_INTERVAL;
    noChangeCount.current = 0;
    return fetchStops();
  }, [fetchStops]);

  return {
    stops: Array.from(stationsMap.values()),
    loading,
    error,
    lastUpdated,
    refresh
  };
};

// Enhanced geolocation hook with proper mobile and PWA support
const useLocationManager = () => {
  const [state, setState] = useState({
    userLocation: null,
    config: { lat: null, lon: null, searchRad: null },
    error: null,
    isRequestingLocation: false,
    showPermissionModal: false,
    fallbackNotice: null, // { reason: string, show: boolean }
    locationStatus: {
      isUsingGPS: false,
      isStale: false,
      accuracy: null
    }
  });

  // Load environment config
  const loadEnvConfig = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/env`);
      const data = await response.json();
      return {
        lat: parseFloat(data.env.BELGRADE_LAT),
        lon: parseFloat(data.env.BELGRADE_LON),
        searchRad: parseInt(data.env.SEARCH_RAD, 10) || DEFAULT_SEARCH_RADIUS
      };
    } catch (error) {
      console.warn('Failed to fetch environment config:', error);
      return { searchRad: DEFAULT_SEARCH_RADIUS };
    }
  }, []);

  // Handle position updates from GeolocationManager
  const handlePositionUpdate = useCallback((position) => {
    setState(prev => ({
      ...prev,
      userLocation: { lat: position.lat, lon: position.lon },
      error: null,
      isRequestingLocation: false,
      showPermissionModal: false,
      locationStatus: {
        isUsingGPS: true,
        isStale: position.isStale || false,
        accuracy: position.accuracy || null
      }
    }));
  }, []);

  // Use default location (fallback)
  const useDefaultLocationInternal = useCallback(async (reason = null) => {
    const envConfig = await loadEnvConfig();
    setState(prev => ({
      ...prev,
      userLocation: envConfig.lat && envConfig.lon ? 
        { lat: envConfig.lat, lon: envConfig.lon } : null,
      config: envConfig,
      showPermissionModal: false,
      isRequestingLocation: false,
      fallbackNotice: reason ? { reason, show: true } : null,
      error: null, // Очищаем ошибку при успешном fallback
      locationStatus: {
        isUsingGPS: false,
        isStale: false,
        accuracy: null
      }
    }));
  }, [loadEnvConfig]);

  // Handle geolocation errors
  const handleLocationError = useCallback(async (error) => {
    console.warn('Geolocation error:', error);

    let shouldAutoFallback = false;
    let errorMessage = error.message || 'Geolocation failed';
    let fallbackReason = null;

    if (error.message?.includes(GEO_ERRORS.HTTPS_REQUIRED)) {
      errorMessage = 'HTTPS connection required for location access';
      fallbackReason = GEO_ERRORS.HTTPS_REQUIRED;
      shouldAutoFallback = true;
    } else if (error.message?.includes(GEO_ERRORS.NOT_SUPPORTED)) {
      errorMessage = 'Location services not supported';
      fallbackReason = GEO_ERRORS.NOT_SUPPORTED;
      shouldAutoFallback = true;
    } else if (error.code === 1) { // PERMISSION_DENIED
      errorMessage = 'Location access denied by user';
      fallbackReason = GEO_ERRORS.PERMISSION_DENIED;
      shouldAutoFallback = true;
    } else if (error.code === 2) { // POSITION_UNAVAILABLE
      errorMessage = 'Location information unavailable';
      fallbackReason = GEO_ERRORS.POSITION_UNAVAILABLE;
      shouldAutoFallback = true;
    } else if (error.code === 3) { // TIMEOUT
      errorMessage = 'Location request timed out';
      // Не делаем автофоллбек для таймаута, пользователь может повторить
    }

    // Автоматически используем default location для некритических ошибок
    if (shouldAutoFallback) {
      try {
        await useDefaultLocationInternal(fallbackReason);
        return;
      } catch (fallbackError) {
        console.error('Default location fallback failed:', fallbackError);
      }
    }

    setState(prev => ({
      ...prev,
      error: new Error(errorMessage),
      isRequestingLocation: false,
      locationStatus: {
        isUsingGPS: false,
        isStale: false,
        accuracy: null
      }
    }));
  }, [loadEnvConfig, useDefaultLocationInternal]);

  const useDefaultLocation = useDefaultLocationInternal;

  // Request location permission
  const requestLocationPermission = useCallback(async () => {
    setState(prev => ({ ...prev, isRequestingLocation: true, error: null }));
    
    try {
      await geolocationManager.requestPermission();
      // Success will be handled by handlePositionUpdate callback
    } catch (error) {
      handleLocationError(error);
    }
  }, [handleLocationError]);

  // Retry location request
  const retryLocationRequest = useCallback(() => {
    setState(prev => ({ ...prev, error: null, fallbackNotice: null }));
    requestLocationPermission();
  }, [requestLocationPermission]);

  // Dismiss fallback notice
  const dismissFallbackNotice = useCallback(() => {
    setState(prev => ({ ...prev, fallbackNotice: null }));
  }, []);

  // PWA geolocation for background updates
  const { updateLocationInBackground } = usePWAGeolocation(
    geolocationManager,
    handlePositionUpdate
  );

  // Setup effect
  useEffect(() => {
    const setupLocation = async () => {
      // Load environment config first
      const envConfig = await loadEnvConfig();
      setState(prev => ({ ...prev, config: envConfig }));

      // Set up geolocation callbacks
      const unsubscribePosition = geolocationManager.onPositionChange(handlePositionUpdate);
      const unsubscribeError = geolocationManager.onError(handleLocationError);

      // Check if geolocation is available
      const availability = geolocationManager.isGeolocationAvailable();
      
      // Check if we have a stored location
      const storedPosition = geolocationManager.getCurrentPositionSync();
      if (storedPosition) {
        handlePositionUpdate(storedPosition);
      } else if (!availability.available) {
        // Geolocation не доступна, используем default location

        await useDefaultLocationInternal(availability.reason);
      } else {
        // Try to get location automatically
        try {
          const permission = await geolocationManager.checkPermissions();
          if (permission === 'granted') {
            setState(prev => ({ ...prev, isRequestingLocation: true }));
            await geolocationManager.getCurrentPosition();
          } else {
            // Show permission modal if no permission
            setState(prev => ({ ...prev, showPermissionModal: true }));
          }
        } catch (error) {
          // If automatic request fails, handle error
          await handleLocationError(error);
        }
      }

      // Start watching position for PWA support
      geolocationManager.startWatching();

      return () => {
        unsubscribePosition();
        unsubscribeError();
        geolocationManager.stopWatching();
      };
    };

    setupLocation();
  }, [handlePositionUpdate, handleLocationError, loadEnvConfig]);

  return {
    ...state,
    requestLocationPermission,
    useDefaultLocation,
    retryLocationRequest,
    dismissFallbackNotice
  };
};

const TransitDashboard = () => {
  const {
    userLocation,
    config,
    error: setupError,
    showPermissionModal,
    isRequestingLocation,
    locationStatus,
    fallbackNotice,
    requestLocationPermission,
    useDefaultLocation,
    retryLocationRequest,
    dismissFallbackNotice
  } = useLocationManager();

  // Track tab visibility for polling optimization
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Settings sheet (mobile)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Transit changes modal
  const [isChangesOpen, setIsChangesOpen] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SORT_BY) || SORT_OPTIONS.DISTANCE;
  });

  // Favorites state
  const [favoriteStations, setFavoriteStations] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FAVORITE_STATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Search radius state
  const [searchRadius, setSearchRadius] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_RADIUS);
    return saved ? parseInt(saved, 10) : DEFAULT_SEARCH_RADIUS;
  });

  // Update config when radius changes
  const configWithRadius = useMemo(() => ({
    ...config,
    searchRad: searchRadius
  }), [config, searchRadius]);

  // Toggle favorite station
  const toggleFavorite = useCallback((stopId, city) => {
    const key = createStationKey(stopId, city);
    setFavoriteStations(prev => {
      const newFavorites = prev.includes(key)
        ? prev.filter(f => f !== key)
        : [...prev, key];

      localStorage.setItem(STORAGE_KEYS.FAVORITE_STATIONS, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  // Check if station is favorite
  const isStationFavorite = useCallback((stopId, city) => {
    const key = createStationKey(stopId, city);
    return favoriteStations.includes(key);
  }, [favoriteStations]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const { stops, loading, error, lastUpdated, refresh } = useTransitData(userLocation, configWithRadius, isTabVisible);

  // Apply sorting
  const sortedStops = useMemo(() => {
    switch (sortBy) {
      case SORT_OPTIONS.DISTANCE:
        return sortStationsByDistance(stops);
      case SORT_OPTIONS.ARRIVAL_TIME:
        return sortStationsByArrivalTime(stops);
      case SORT_OPTIONS.NAME:
        return sortStationsByName(stops);
      default:
        return stops;
    }
  }, [stops, sortBy]);

  // Collect all line numbers currently visible in the UI
  const activeLineNumbers = useMemo(() => {
    const nums = new Set();
    sortedStops.forEach(stop => {
      stop.vehicles?.forEach(v => { if (v.lineNumber) nums.add(v.lineNumber); });
    });
    return nums;
  }, [sortedStops]);

  // Separate favorite and non-favorite stations
  const { favoriteStops, otherStops } = useMemo(() => {
    const favorites = [];
    const others = [];

    sortedStops.forEach(stop => {
      const key = createStationKey(stop.stopId, stop.city);
      if (favoriteStations.includes(key)) {
        favorites.push(stop);
      } else {
        others.push(stop);
      }
    });

    return { favoriteStops: favorites, otherStops: others };
  }, [sortedStops, favoriteStations]);


  if (setupError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg">
          <div className="text-center text-red-600 dark:text-red-400">
            <p className="font-semibold">Configuration Error</p>
            <p className="text-sm mt-1">{setupError.message || setupError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!userLocation && !showPermissionModal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Setting up location...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <MaintenanceBanner />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

        {/* Sticky header */}
        <div className="px-2 sm:px-3 lg:px-4 pt-3 sm:pt-4">
          <Header
            lastUpdated={lastUpdated}
            onRefresh={refresh}
            loading={loading}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchRadius={searchRadius}
            onRadiusChange={setSearchRadius}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenChanges={() => setIsChangesOpen(true)}
            locationStatus={
              <LocationStatus
                isUsingGPS={locationStatus.isUsingGPS}
                isStale={locationStatus.isStale}
                accuracy={locationStatus.accuracy}
                onRequestLocation={requestLocationPermission}
                isRequesting={isRequestingLocation}
              />
            }
          />
        </div>

        {/* Scrollable content */}
        <div className="w-full px-2 sm:px-3 lg:px-4 pb-6 pt-4 space-y-4">

          {/* Fallback Notice */}
          {fallbackNotice?.show && (
            <LocationFallbackNotice
              reason={fallbackNotice.reason}
              onTryAgain={retryLocationRequest}
              onDismiss={dismissFallbackNotice}
            />
          )}

          {/* Main Content Area */}
          <main className="space-y-4" role="main" aria-label="Bus stations list">
            {!userLocation ? (
              <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-xl p-8 shadow-sm animate-fade-in">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">Location Required</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                    Please allow location access to see nearby bus stops
                  </p>
                  <button
                    onClick={requestLocationPermission}
                    disabled={isRequestingLocation}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {isRequestingLocation ? 'Requesting...' : 'Enable Location'}
                  </button>
                </div>
              </div>
            ) : loading ? (
              <LoadingGrid count={6} />
            ) : error ? (
              <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-sm animate-fade-in">
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
                  <button
                    onClick={refresh}
                    className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : sortedStops.length > 0 ? (
              <>
                {/* Favorites Section */}
                {favoriteStops.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-1">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Favorites ({favoriteStops.length})
                      </h2>
                    </div>

                    {/* Mobile: horizontal scroll */}
                    <div className="md:hidden flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {favoriteStops.map((stop) => (
                        <div key={`${stop.stopId}-${stop.city}`} className="flex-none w-[300px] snap-start">
                          <BusStation
                            {...stop}
                            isFavorite={true}
                            onToggleFavorite={toggleFavorite}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Desktop: grid */}
                    <div className="hidden md:grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {favoriteStops.map((stop) => (
                        <BusStation
                          key={`${stop.stopId}-${stop.city}`}
                          {...stop}
                          isFavorite={true}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* All Stations Section */}
                {otherStops.length > 0 && (
                  <>
                    {favoriteStops.length > 0 && (
                      <div className="flex items-center gap-2 px-1">
                        <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          All Stations ({otherStops.length})
                        </h2>
                      </div>
                    )}
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {otherStops.map((stop) => (
                        <BusStation
                          key={`${stop.stopId}-${stop.city}`}
                          {...stop}
                          isFavorite={false}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-sm animate-fade-in">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">No bus stops found</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                    Try moving closer to a bus stop or check your location
                  </p>
                  {locationStatus.isUsingGPS && (
                    <button
                      onClick={requestLocationPermission}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                    >
                      Refresh Location
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile settings sheet */}
      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sortBy={sortBy}
        onSortChange={setSortBy}
        searchRadius={searchRadius}
        onRadiusChange={setSearchRadius}
      />

      <IOSInstallPrompt />

      <ChangesModal
        isOpen={isChangesOpen}
        onClose={() => setIsChangesOpen(false)}
        activeLines={activeLineNumbers}
      />

      {/* Location Permission Modal */}
      <LocationPermissionModal
        isVisible={showPermissionModal}
        onRequestPermission={requestLocationPermission}
        onUseDefault={useDefaultLocation}
        onRetry={retryLocationRequest}
        error={setupError}
        isRequesting={isRequestingLocation}
      />
    </>
  );
};

export default TransitDashboard;