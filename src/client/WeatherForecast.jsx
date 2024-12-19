import React, { useState, useEffect } from 'react';

const WeatherForecast = ({ lat, lon }) => {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiKey = import.meta.env.VITE_WEATHER_API_KEY; // Замените на ваш API-ключ
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=12&appid=${apiKey}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch weather forecast');
        }

        const data = await response.json();
        setForecast(data.list.slice(0, 14)); // Берем только 12 часов прогноза
      } catch (err) {
        console.error('Error fetching forecast:', err);
        setError(err.message || 'Failed to load weather forecast');
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [lat, lon]);

  if (loading) {
    return <p>Loading weather forecast...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Hourly Weather Forecast</h3>
      <div className="flex overflow-x-auto space-x-4">
        {forecast.map((hour, index) => (
          <div
            key={index}
            className="flex flex-col items-center justify-center w-16 text-center space-y-2"
          >
            <p className="text-xs text-gray-500">
              {new Date(hour.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <img
              src={`https://openweathermap.org/img/wn/${hour.weather[0].icon}@2x.png`}
              alt={hour.weather[0].description}
              className="w-8 h-8"
            />
            <p className="text-sm font-medium text-gray-800">{Math.round(hour.main.temp)}°C</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherForecast;