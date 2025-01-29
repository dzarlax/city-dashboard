import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapPin, Bus, Repeat2 } from 'lucide-react';
import WeatherForecast from './WeatherForecast';

const SERVER_IP = "https://transport-api.dzarlax.dev";

// Utility functions
const formatMinutes = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}min`;
};

const isVehicleChanged = (oldVehicle, newVehicle) => {
  return oldVehicle.secondsLeft !== newVehicle.secondsLeft ||
         oldVehicle.stationsBetween !== newVehicle.stationsBetween;
};

// UI Components remain the same
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-blue-100"></div>
      <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
    </div>
  </div>
);

// Memoized BusStation component
const BusStation = React.memo(({ name, distance, stopId, vehicles = [], city }) => {
  const groupedVehicles = useMemo(() => {
    return vehicles.reduce((acc, vehicle) => {
      const directionKey = `${stopId}-${vehicle.lineNumber}-${vehicle.lineName || 'unknown'}-${vehicle.stationName || ''}`;
      if (!acc[directionKey]) {
        acc[directionKey] = {
          lineNumber: vehicle.lineNumber,
          lineName: vehicle.lineName,
          stationName: vehicle.stationName,
          arrivals: [],
        };
      }
      acc[directionKey].arrivals.push({
        secondsLeft: vehicle.secondsLeft,
        stationsBetween: vehicle.stationsBetween,
        garageNo: vehicle.garageNo,
      });
      return acc;
    }, {});
  }, [vehicles, stopId]);

  const sortedGroups = useMemo(() => 
    Object.values(groupedVehicles).sort(
      (a, b) => parseInt(a.lineNumber) - parseInt(b.lineNumber)
    ),
    [groupedVehicles]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <Bus className="w-5 h-5 text-blue-500 opacity-70 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-base font-medium text-gray-800">
              {name} <span className="text-gray-500 text-sm">(# {stopId})</span>
            </h3>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {distance}
          </span>
        </div>
        {sortedGroups.length > 0 && (
          <div className="space-y-2 border-t border-gray-100 pt-2 mt-2">
            {sortedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="flex-shrink-0 text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {group.lineNumber} {group.lineName ? `- ${group.lineName}` : ''}
                  </span>
                  {group.stationName && (
                    <span className="text-xs text-gray-500 truncate">
                      → {group.stationName}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pl-8 text-xs text-gray-500">
                  {group.arrivals
                    .sort((a, b) => a.secondsLeft - b.secondsLeft)
                    .map((arrival, arrivalIndex) => (
                      <span key={arrivalIndex} className="whitespace-nowrap">
                        {formatMinutes(arrival.secondsLeft)}
                        {arrival.stationsBetween > 0 && ` (${arrival.stationsBetween})`}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.vehicles.length !== nextProps.vehicles.length) return false;
  return prevProps.vehicles.every((vehicle, index) => {
    const nextVehicle = nextProps.vehicles[index];
    return !isVehicleChanged(vehicle, nextVehicle);
  });
});

// Modified transit data hook with correct state management
const useTransitData = (userLocation, config) => {
  const [stationsMap, setStationsMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const previousVehicles = useRef(new Map());

  const fetchStops = useCallback(async () => {
    if (!userLocation || !config.searchRad) return;

    try {
      const cities = ['bg', 'ns', 'nis'];
      let hasUpdates = false;

      const newStationsData = new Map();
      
      await Promise.all(cities.map(async city => {
        const params = new URLSearchParams({
          lat: userLocation.lat,
          lon: userLocation.lon,
          rad: config.searchRad,
        });

        const response = await fetch(
          `${SERVER_IP}/api/stations/${city}/all?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch stations for ${city.toUpperCase()}`);
        }

        const data = await response.json();
        
        data.forEach(station => {
          const stationKey = `${station.stopId}-${city}`;
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
      
      if (hasUpdates) {
        setLastUpdated(new Date());
      }
      
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load stations');
      setLoading(false);
    }
  }, [userLocation, config.searchRad]);

  useEffect(() => {
    if (userLocation) {
      fetchStops();
      const interval = setInterval(fetchStops, 10000);
      return () => {
        clearInterval(interval);
        previousVehicles.current.clear();
      };
    }
  }, [userLocation, fetchStops]);

  return {
    stops: Array.from(stationsMap.values()),
    loading,
    error,
    lastUpdated,
    refresh: fetchStops
  };
};

// Initial setup hook remains the same
const useInitialSetup = () => {
  const [state, setState] = useState({
    userLocation: null,
    config: { lat: null, lon: null, searchRad: null },
    error: null
  });

  useEffect(() => {
    const setupData = async () => {
      let haConfig = null;
      let envConfig = null;
      let browserLocation = null;

      try {
        // 1️⃣ Получаем координаты из Home Assistant
        haConfig = await getHomeAssistantConfig();
      } catch (error) {
        console.warn('Failed to fetch Home Assistant config:', error);
      }

      try {
        // 2️⃣ Получаем координаты из API (резервный вариант)
        const response = await fetch(`${SERVER_IP}/api/env`);
        const data = await response.json();
        envConfig = {
          lat: parseFloat(data.env.BELGRADE_LAT),
          lon: parseFloat(data.env.BELGRADE_LON),
          searchRad: parseInt(data.env.SEARCH_RAD, 10)
        };
      } catch (error) {
        console.warn('Failed to fetch environment config:', error);
      }

      try {
        // 3️⃣ Запрашиваем координаты из браузера (только если НЕ Home Assistant)
        if ("geolocation" in navigator && !window.location.pathname.includes('/local/city_dashboard/')) {
          browserLocation = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              position => resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude
              }),
              error => {
                console.warn('Geolocation error:', error);
                reject(error);
              }
            );
          });
        }
      } catch (error) {
        console.warn('Failed to get browser location:', error);
      }

      // 🏆 Выбираем приоритетное значение
      setState({
        config: envConfig || { searchRad: 1000 },
        userLocation: haConfig 
          ? { lat: haConfig.latitude, lon: haConfig.longitude } 
          : browserLocation 
            ? { lat: browserLocation.lat, lon: browserLocation.lon } 
            : envConfig,
        error: !envConfig && !haConfig && !browserLocation ? 'Failed to load configuration' : null
      });
    };

    setupData();
  }, []);

  return state;
};

const TransitDashboard = () => {
  const { userLocation, config, error: setupError } = useInitialSetup();
  const { stops, loading, error, lastUpdated, refresh } = useTransitData(userLocation, config);

  if (setupError) {
    return <div className="text-center p-4 text-red-500">{setupError}</div>;
  }

  if (!userLocation) {
    return <div className="text-center p-4">Fetching your location...</div>;
  }

// Replace the return statement in TransitDashboard with this:

return (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 lg:p-6">
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-blue-50 p-2 rounded-lg">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 leading-tight">
                Nearby Stops
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                Real-time transport info
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <p className="text-xs text-gray-500 hidden sm:block">
                Updated: {lastUpdated.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit'
                })}
              </p>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2 py-1.5 sm:px-3 sm:py-2 rounded-md transition-colors disabled:opacity-50 text-sm"
            >
              <Repeat2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-gray-500 text-center sm:hidden">
          Updated: {lastUpdated.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
          })}
        </div>
      )}

      {/* Weather Widget */}
        <WeatherForecast lat={userLocation.lat} lon={userLocation.lon} />

      {/* Main Content Area */}
      <div className="space-y-4 sm:space-y-6">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="text-center bg-white border border-red-200 rounded-lg p-4 sm:p-6 shadow-sm">
            <p className="text-red-500 text-sm sm:text-base font-medium">{error}</p>
          </div>
        ) : stops.length > 0 ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {stops.map((stop) => (
              <BusStation 
                key={`${stop.stopId}-${stop.city}`} 
                {...stop} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
            <p className="text-gray-500 text-sm sm:text-base font-medium">
              No bus stops found
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default TransitDashboard;