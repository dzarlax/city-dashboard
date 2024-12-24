import React, { useState, useEffect } from 'react';
import { MapPin, Bus, Repeat2 } from 'lucide-react';
import WeatherForecast from './WeatherForecast';

const SERVER_IP = "https://transport-api.dzarlax.dev";

const roundCoordinate = (coord, precision = 4) => {
  return parseFloat(coord.toFixed(precision));
};

const TransitDashboard = () => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [config, setConfig] = useState({ lat: null, lon: null, searchRad: null });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${SERVER_IP}/api/env`);
        if (!response.ok) {
          throw new Error('Failed to fetch config');
        }
        const data = await response.json();
        const { BELGRADE_LAT, BELGRADE_LON, SEARCH_RAD } = data.env;

        setConfig({
          lat: parseFloat(BELGRADE_LAT),
          lon: parseFloat(BELGRADE_LON),
          searchRad: parseInt(SEARCH_RAD, 10),
        });

        setUserLocation({
          lat: parseFloat(BELGRADE_LAT),
          lon: parseFloat(BELGRADE_LON),
        });
      } catch (err) {
        setError('Failed to fetch configuration');
        console.error(err);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lon: longitude });
          setError(null);
        },
        (err) => {
          console.error("Error fetching location:", err.message);
          setError("Unable to fetch your location. Using default location.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser. Using default location.");
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchStops(); // Первичная загрузка всех данных
      const interval = setInterval(fetchTransport, 10000); // Автообновление только транспорта
      return () => clearInterval(interval);
    }
  }, [userLocation]);

  const fetchStops = async () => {
    try {
      setUpdating(true);
      setError(null);

      const cities = ['bg', 'ns', 'nis'];
      const allStops = [];

      for (const city of cities) {
        const params = new URLSearchParams({
          lat: userLocation.lat,
          lon: userLocation.lon,
          rad: config.searchRad,
        });

        const url = `${SERVER_IP}/api/stations/${city}/all?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch stations for city ${city.toUpperCase()}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error(`Invalid response format for city ${city.toUpperCase()}`);
        }

        const processedStops = data.map((station) => ({
          ...station,
          distance: `${Math.round(station.distance)}m`,
          city: city.toUpperCase(),
        }));
        allStops.push(...processedStops);
      }

      setStops(allStops);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching stops:', err.message);
      setError(`Failed to fetch stops: ${err.message}`);
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  };

  const fetchTransport = async () => {
    try {
      setError(null);

      const cities = ['bg', 'ns', 'nis'];
      const allStops = stops.map((stop) => ({ ...stop, vehicles: [] })); // Сброс транспорта для обновления

      for (const city of cities) {
        const params = new URLSearchParams({
          lat: userLocation.lat,
          lon: userLocation.lon,
          rad: config.searchRad,
        });

        const url = `${SERVER_IP}/api/transport/${city}/updates?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch transport updates for city ${city.toUpperCase()}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error(`Invalid response format for transport updates`);
        }

        data.forEach((vehicle) => {
          const stopIndex = allStops.findIndex((stop) => stop.stopId === vehicle.stopId);
          if (stopIndex !== -1) {
            allStops[stopIndex].vehicles.push(vehicle);
          }
        });
      }

      setStops(allStops);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching transport updates:', err.message);
      setError('Failed to update transport');
    }
  };

  if (!userLocation) {
    return <div>Fetching your location...</div>;
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
              onClick={fetchStops} // Ручное обновление
              disabled={updating}
              className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Repeat2 className="w-5 h-5" />
              <span>{updating ? 'Updating...' : 'Refresh'}</span>
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
            <div>Loading...</div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : (
            stops.map((stop) => (
              <div key={stop.stopId}>
                <h3>{stop.name}</h3>
                {/* Additional details */}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TransitDashboard;