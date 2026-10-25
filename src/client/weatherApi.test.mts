import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentWeather, getWeatherForecast } from './weatherApi.mts';

test('current weather calls the fixed proxy endpoint without a key', async () => {
  let requestedURL = '';
  const result = await getCurrentWeather(44.8, 20.4, async (input) => {
    requestedURL = String(input);
    return Response.json({ main: { temp: 18 }, weather: [{ icon: '01d', description: 'clear sky' }] });
  });

  assert.equal(requestedURL, 'https://transport-api.dzarlax.dev/api/weather/current?lat=44.8&lon=20.4');
  assert.equal(result.main.temp, 18);
  assert.equal(result.weather[0].icon, '01d');
  assert.equal(requestedURL.includes('appid'), false);
});

test('forecast preserves the requested six and twelve item counts', async () => {
  for (const count of [6, 12] as const) {
    let requestedURL = '';
    await getWeatherForecast(44.8, 20.4, count, async (input) => {
      requestedURL = String(input);
      return Response.json({ list: [] });
    });
    assert.equal(requestedURL.endsWith(`cnt=${count}`), true);
  }
});

test('coordinates are validated before making a request', async () => {
  let called = false;
  assert.throws(() => getCurrentWeather(Number.NaN, 20, async () => {
    called = true;
    return Response.json({});
  }));
  assert.equal(called, false);
});

test('proxy failures reject with a generic message', async () => {
  await assert.rejects(
    () => getWeatherForecast(44, 20, 6, async () => new Response('secret-bearing upstream body', { status: 502 })),
    { message: 'Weather service unavailable' },
  );
});


test('service worker never caches environment, weather, or legacy provider requests', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const listeners: Record<string, Function> = {};
  let fetches = 0;
  let cacheOpens = 0;
  const deleted: string[] = [];
  runInNewContext(readFileSync(new URL('../../public/sw-custom.js', import.meta.url), 'utf8'), {
    URL, console: { log() {} },
    self: { location: { hostname: 'transport.dzarlax.dev' }, addEventListener: (name: string, fn: Function) => { listeners[name] = fn; }, clients: { claim: async () => {} } },
    fetch: async () => { fetches++; return new Response('{}'); },
    caches: { open: async () => { cacheOpens++; throw new Error('unexpected cache'); }, keys: async () => ['city-dashboard-legacy'], delete: async (name: string) => { deleted.push(name); return true; } },
  });
  for (const path of ['/api/env', '/api/weather/current?lat=44&lon=20', '/api/weather/forecast?lat=44&lon=20&cnt=12']) {
    let pending: Promise<Response> | undefined;
    listeners.fetch({ request: { url: `https://transport-api.dzarlax.dev${path}`, mode: 'cors' }, respondWith: (response: Promise<Response>) => { pending = response; } });
    await pending;
  }
  let pending: Promise<Response> | undefined;
  listeners.fetch({ request: { url: 'https://api.openweathermap.org/data/2.5/weather?appid=legacy-key', mode: 'cors' }, respondWith: (response: Promise<Response>) => { pending = response; } });
  await pending;
  assert.equal(fetches, 4);
  assert.equal(cacheOpens, 0);
  listeners.activate({ waitUntil: (promise: Promise<void>) => { pending = promise as unknown as Promise<Response>; } });
  await pending;
  assert.deepEqual(deleted, ['city-dashboard-legacy']);
});
