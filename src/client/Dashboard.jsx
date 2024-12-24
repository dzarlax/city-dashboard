import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Bus, Repeat2 } from 'lucide-react';
import WeatherForecast from './WeatherForecast';
import { debounce } from 'lodash';

const SERVER_IP = "https://transport-api.dzarlax.dev";

// Moved to separate component for better performance
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
      {/* Rest of the BusStation component remains the same */}
    </div>
  );
});

// Separate data fetching logic
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

  // Debounced refresh function
  const debouncedFetch = useMemo(
    () => debounce(fetchStops, 1000),
    [fetchStops]
  );

  useEffect(() => {
    if (userLocation) {
      fetchStops();
      const interval = setInterval(fetchStops, 10000);
      return () => {
        clearInterval(interval);
        debouncedFetch.cancel();
      };
    }
  }, [userLocation, fetchStops, debouncedFetch]);

  return {
    ...state,
    refresh: debouncedFetch
  };
};

// Separate location and config fetching
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
      {/* Rest of the JSX remains the same, but use refresh instead of handleRefresh */}
    </div>
  );
};

export default TransitDashboard;