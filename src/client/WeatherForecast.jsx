import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, CloudSnow } from 'lucide-react';

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

const WeatherIcon = ({ iconCode, alt, className = "w-8 h-8 sm:w-10 sm:h-10" }) => {
  // Fallback icons based on weather condition
  const getIconComponent = (code) => {
    const baseIconProps = { className: `${className} text-gray-600 dark:text-gray-300` };
    if (code.includes('01')) return <Sun className={`${className} text-yellow-500`} />;
    if (code.includes('02') || code.includes('03') || code.includes('04')) return <Cloud {...baseIconProps} />;
    if (code.includes('09') || code.includes('10') || code.includes('11')) return <CloudRain className={`${className} text-blue-500`} />;
    if (code.includes('13')) return <CloudSnow {...baseIconProps} />;
    return <Sun {...baseIconProps} />;
  };

  return (
    <div className="relative">
      <img
        src={`https://openweathermap.org/img/wn/${iconCode}.png`}
        alt={alt}
        className={className}
        loading="lazy"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'block';
        }}
      />
      <div style={{ display: 'none' }} className="flex items-center justify-center">
        {getIconComponent(iconCode)}
      </div>
    </div>
  );
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm animate-fade-in">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full"></div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Weather Forecast</h3>
            </div>
            <div className="animate-pulse">
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
            </div>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col items-center min-w-[4rem] animate-pulse">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-12 mb-2"></div>
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-8"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl shadow-sm animate-fade-in">
        <div className="p-4">
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              <Cloud className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden animate-fade-in">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Weather Forecast
            </h3>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            Next {forecast.length}h
          </span>
        </div>
        
        <div className="flex overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 sm:gap-4 pb-1">
            {forecast.map((hour, index) => (
              <div
                key={index}
                className="flex flex-col items-center justify-center min-w-[3.5rem] sm:min-w-[4.5rem] group"
              >
                {/* Mobile time format */}
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 sm:hidden font-medium">
                  {formatTime(hour.dt, true)}
                </p>
                {/* Desktop time format */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 hidden sm:block font-medium">
                  {formatTime(hour.dt, false)}
                </p>
                
                <div className="mb-2 transform group-hover:scale-110 transition-transform duration-200">
                  <WeatherIcon 
                    iconCode={hour.weather[0].icon}
                    alt={hour.weather[0].description}
                  />
                </div>
                
                <div className="text-center">
                  <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">
                    {Math.round(hour.main.temp)}°
                  </p>
                  {hour.pop > 0.3 && (
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">
                      {Math.round(hour.pop * 100)}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherForecast;