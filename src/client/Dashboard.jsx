import React, { useState, useEffect } from 'react';
import { MapPin, Bus, Repeat2 } from 'lucide-react';
import WeatherForecast from './WeatherForecast';

const BELGRADE_LAT = parseFloat(import.meta.env.VITE_BELGRADE_LAT);
const BELGRADE_LON = parseFloat(import.meta.env.VITE_BELGRADE_LON);
const SEARCH_RAD = parseInt(import.meta.env.VITE_SEARCH_RAD, 10);
const SERVER_IP = import.meta.env.VITE_SERVER
const DEFAULT_LOCATION = { lat: BELGRADE_LAT, lon: BELGRADE_LON }; // Координаты Белграда



const formatMinutes = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}min`;
};

const BusStation = ({ name, distance, stopId, vehicles = [] }) => {
  const groupedVehicles = vehicles.reduce((acc, vehicle) => {
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

  const sortedGroups = Object.values(groupedVehicles).sort(
    (a, b) => parseInt(a.lineNumber) - parseInt(b.lineNumber)
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <Bus className="w-5 h-5 text-blue-500 opacity-70 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-base font-medium text-gray-800">{name}</h3>
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
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-blue-100"></div>
      <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
    </div>
  </div>
);

const TransitDashboard = () => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lon: longitude });
          setError(null); // Очистить ошибку, если местоположение получено успешно
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
      fetchStops();
      const interval = setInterval(fetchStops, 10000);
      return () => clearInterval(interval);
    }
  }, [userLocation]);

  const fetchStops = async () => {
    try {
      setError(null);
      setLoading(true);
  
      const cities = ['bg', 'ns', 'nis']; // Список городов: Белград, Нови-Сад, Ниш
      const allStops = [];
  
      for (const city of cities) {
        const params = new URLSearchParams({
          lat: userLocation.lat,
          lon: userLocation.lon,
          rad: SEARCH_RAD,
        });
  
        const response = await fetch(`${SERVER_IP}/api/stations/${city}/all?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch stations for city ${city.toUpperCase()}`);
        }
  
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error(`Invalid response format for city ${city.toUpperCase()}`);
        }
  
        // Обработать данные и добавить их в общий список
        const processedStops = data.map((station) => ({
          ...station,
          distance: `${Math.round(station.distance)}m`,
          city: city.toUpperCase(), // Добавить информацию о городе
        }));
        allStops.push(...processedStops);
      }
  
      // Установить общий список остановок
      setStops(allStops);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching stops:', err);
      setError(err.message || 'Failed to load stations');
    } finally {
      setLoading(false);
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
              onClick={fetchStops}
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