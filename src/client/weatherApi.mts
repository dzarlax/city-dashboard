export type WeatherCondition = {
  icon: string;
  description: string;
};

export type WeatherCurrent = {
  main: { temp: number };
  weather: WeatherCondition[];
};

export type WeatherForecastItem = {
  dt: number;
  main: { temp: number };
  pop: number;
  weather: WeatherCondition[];
};

export type WeatherForecast = { list: WeatherForecastItem[] };

const SERVER_URL = 'https://transport-api.dzarlax.dev';

async function requestJSON<T>(url: string, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error('Weather service unavailable');
  return response.json() as Promise<T>;
}

function coordinates(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Invalid weather coordinates');
  }
  return `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
}

export function getCurrentWeather(lat: number, lon: number, fetcher: typeof fetch = fetch): Promise<WeatherCurrent> {
  return requestJSON(`${SERVER_URL}/api/weather/current?${coordinates(lat, lon)}`, fetcher);
}

export function getWeatherForecast(lat: number, lon: number, count: 6 | 12, fetcher: typeof fetch = fetch): Promise<WeatherForecast> {
  return requestJSON(`${SERVER_URL}/api/weather/forecast?${coordinates(lat, lon)}&cnt=${count}`, fetcher);
}
