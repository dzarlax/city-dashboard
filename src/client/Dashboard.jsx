import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Bus, Repeat2 } from 'lucide-react';
import WeatherForecast from './WeatherForecast';

const SERVER_IP = "https://transport-api.dzarlax.dev";

// Custom debounce implementation
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const formatMinutes = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}min`;
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-blue-100"></div>
      <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
    </div>
  </div>
);

const BusStation = React.memo(({ name, distance, stopId, vehicles = [] }) => {
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
});

const useTransitData = (userLocation, config) => {
  const [state, setState] = useState({
    stops: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  const fetchStops = useCallback(async () => {
    if (!userLocation || !config.searchRad) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const cities = ['bg', 'ns', 'nis'];
      const fetchPromises = cities.map(async city => {
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
        return data.map(station => ({
          ...station,
          distance: `${Math.round(station.distance)}m`,
          city: city.toUpperCase(),
        }));
      });

      const results = await Promise.all(fetchPromises);
      const allStops = results.flat();

      setState(prev => ({
        ...prev,
        stops: allStops,
        lastUpdated: new Date(),
        loading: false,
        error: null
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err.message || 'Failed to load stations',
        loading: false
      }));
    }
  }, [userLocation, config.searchRad]);

  const debouncedFetch = useMemo(() => 
    debounce(fetchStops, 1000),
    [fetchStops]
  );

  useEffect(() => {
    if (userLocation) {
      fetchStops();
      const interval = setInterval(fetchStops, 10000);
      return () => {
        clearInterval(interval);
        // Clean up debounced function
        if (debouncedFetch.cancel) {
          debouncedFetch.cancel();
        }
      };
    }
  }, [userLocation, fetchStops, debouncedFetch]);

  return {
    ...state,
    refresh: debouncedFetch
  };
};

const useInitialSetup = () => {
  const [state, setState] = useState({
    userLocation: null,
    config: { lat: null, lon: null, searchRad: null },
    error: null
  });

  useEffect(() => {
    const setupPromises = [
      // Fetch config
      fetch(`${SERVER_IP}/api/env`)
        .then(response => response.json())
        .then(data => {
          const { BELGRADE_LAT, BELGRADE_LON, SEARCH_RAD } = data.env;
          return {
            lat: parseFloat(BELGRADE_LAT),
            lon: parseFloat(BELGRADE_LON),
            searchRad: parseInt(SEARCH_RAD, 10)
          };
        }),
      // Get geolocation
      new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            position => resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude
            }),
            error => reject(error)
          );
        } else {
          reject(new Error("Geolocation not supported"));
        }
      })
    ];

    Promise.allSettled(setupPromises)
      .then(([configResult, locationResult]) => {
        const config = configResult.status === 'fulfilled' ? configResult.value : null;
        const location = locationResult.status === 'fulfilled' 
          ? locationResult.value
          : config 
            ? { lat: config.lat, lon: config.lon }
            : null;

        setState({
          config: config || state.config,
          userLocation: location,
          error: !config ? 'Failed to load configuration' : null
        });
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-50 p-3 rounded-full">
                <MapPin className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Nearby Bus Stops</h2>
                <p className="text-sm text-gray-500">Real-time public transport information</p>
              </div>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Repeat2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {lastUpdated && (
          <div className="text-sm text-gray-500 text-center">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        <WeatherForecast lat={userLocation.lat} lon={userLocation.lon} />

        <div className="space-y-6">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="text-center bg-white border border-red-200 rounded-xl p-8 shadow-sm">
              <p className="text-red-500 text-lg font-medium">{error}</p>
            </div>
          ) : stops.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stops.map((stop, index) => (
                <BusStation key={index} {...stop} />
              ))}
            </div>
          ) : (
            <div className="text-center bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <p className="text-gray-500 text-lg font-medium">No bus stops found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransitDashboard;