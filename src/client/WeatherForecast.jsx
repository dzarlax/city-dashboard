import React, { useState, useEffect } from 'react';

const SERVER_IP = "https://transport-api.dzarlax.dev";

// Updated utility function for consistent time formatting
const formatTime = (timestamp, isMobile = false) => {
  const date = new Date(timestamp * 1000);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12

  if (isMobile) {
    // Mobile: just hour + AM/PM
    return `${displayHours}${ampm}`;
  }
  
  // Desktop: hour + minutes + AM/PM
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${paddedMinutes}${ampm}`;
};

const WeatherForecast = ({ lat, lon }) => {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch(`${SERVER_IP}/api/env`);
        if (!response.ok) throw new Error('Failed to fetch API key');
        const data = await response.json();
        if (!data.env?.WEATHER_API_KEY) throw new Error('API key not found');
        setApiKey(data.env.WEATHER_API_KEY);
      } catch (err) {
        console.error('Error fetching API key:', err);
        setError('Failed to load weather data');
      }
    };
    fetchApiKey();
  }, []);

  useEffect(() => {
    if (!apiKey) return;

    const fetchForecast = async () => {
      try {
        setLoading(true);
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=12&appid=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch forecast');
        const data = await response.json();
        setForecast(data.list.slice(0, 12));
        setError(null);
      } catch (err) {
        console.error('Error fetching forecast:', err);
        setError('Unable to load forecast');
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [lat, lon, apiKey]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3">
        <div className="h-24 flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading weather...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3">
        <div className="h-24 flex items-center justify-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-2 sm:p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-800">Weather Forecast</h3>
          <span className="text-xs text-gray-500">
            Next {forecast.length} hours
          </span>
        </div>
        <div className="flex overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 sm:gap-3 pb-1">
            {forecast.map((hour, index) => (
              <div
                key={index}
                className="flex flex-col items-center justify-center min-w-[3.5rem] sm:min-w-[4.5rem]"
              >
                {/* Mobile time format */}
                <p className="text-[10px] text-gray-500 mb-0.5 sm:hidden">
                  {formatTime(hour.dt, true)}
                </p>
                {/* Desktop time format */}
                <p className="text-xs text-gray-500 mb-0.5 hidden sm:block">
                  {formatTime(hour.dt, false)}
                </p>
                <img
                  src={`https://openweathermap.org/img/wn/${hour.weather[0].icon}.png`}
                  alt={hour.weather[0].description}
                  className="w-8 h-8 sm:w-10 sm:h-10"
                  loading="lazy"
                />
                <p className="text-xs sm:text-sm font-medium text-gray-800">
                  {Math.round(hour.main.temp)}°
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherForecast;