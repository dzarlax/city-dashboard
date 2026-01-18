# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

City Dashboard is a real-time public transit information display for Serbian cities (Belgrade, Novi Sad, Niš). It's a React-based PWA that displays nearby bus stops with live arrival times based on the user's geolocation.

**API:** `https://transport-api.dzarlax.dev`

## Development Commands

```bash
# Start development server (port 3000)
npm run dev
# or
npm run client

# Build for production
npm run build
# or
npm run build:client

# Build for GitHub Pages
npm run build:prod

# Build for Home Assistant Community Store (HACS)
npm run build:hacs

# Preview production build
npm run start
# or
npm run start:client
```

## Architecture

### Entry Point Flow

1. **`src/client/main.jsx`** - React app entry
   - Wraps app in `ThemeProvider` (dark/light mode)
   - Registers service worker for PWA functionality
   - Renders `App` component

2. **`src/client/App.jsx`** - Root wrapper
   - Wraps `Dashboard` in `LocalizationProvider` (i18n: EN, RU, SR)

3. **`src/client/Dashboard.jsx`** - Main application logic
   - Manages location state via `useLocationManager` hook
   - Fetches transit data via `useTransitData` hook
   - Renders `Header`, `BusStation` cards, and location modals

### Key Architectural Patterns

**Context-based State Management:**
- `ThemeContext` - Dark/light theme switching
- `LocalizationContext` - i18n support (auto-detects browser language)

**Class-based Service:**
- `GeolocationManager` - Centralized geolocation logic with:
  - Position caching in localStorage (10-minute expiry)
  - Background watching for PWA
  - Distance calculations (Haversine formula)
  - Fallback to cached position on errors
  - Callback-based pub/sub pattern

**Custom Hooks:**
- `useLocationManager` - Complex geolocation state (GPS → cached → env config fallback chain)
- `useTransitData` - Fetches stations every 10 seconds with vehicle change detection
- `usePWAGeolocation` - Background location updates when page visibility changes
- `useVisibilityChange` - Track page visibility for PWA background updates

### Data Fetching

**API Endpoints:**
- `/api/env` - Environment config (fallback coordinates, search radius)
- `/api/stations/{city}/all?lat=X&lon=Y&rad=Z` - Stations within radius

**Cities:** `bg` (Belgrade), `ns` (Novi Sad), `nis` (Niš)

**Stations Key Format:** `{stopId}-{city}` (e.g., `123-bg`)

**Vehicle Change Detection:** Compares `secondsLeft` and `stationsBetween` to prevent unnecessary re-renders of `BusStation` components.

### Geolocation Fallback Chain

1. Try GPS via `navigator.geolocation.getCurrentPosition()`
2. If fails, use cached position from localStorage (if < 10 minutes old)
3. If no cache, fetch fallback from `/api/env`
4. If all fail, show error with retry option

**Error Handling:**
- `HTTPS_REQUIRED` - Auto-fallback (geolocation requires HTTPS)
- `NOT_SUPPORTED` - Auto-fallback (browser doesn't support geolocation)
- `PERMISSION_DENIED` - Auto-fallback + user notification
- `POSITION_UNAVAILABLE` - Auto-fallback
- `TIMEOUT` - Show retry option (no auto-fallback)

### Styling

**Tailwind CSS Configuration:**
- Dark mode: `class` strategy
- Custom colors: `primary`, `success`, `warning`
- City-specific colors: BG (green), NS (blue), NIS (purple)
- Custom breakpoints up to `4xl` (8-column grid)

**Grid System:** Responsive grid from 1 to 8 columns based on screen size:
```
grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8
```

### Vite Configurations

- **`vite.config.base.js`** - Shared config (React, Tailwind, PostCSS)
- **`vite.config.js`** - Development (port 3000, env-compatible plugin)
- **`vite.config.ha.js`** - Home Assistant build (outputs to `dist/dashboard.js`)

### PWA Features

- **Service Worker:** `public/sw-custom.js` with network-first for API, cache-first for static
- **Manifest:** `public/manifest.json`
- **Background Location:** `watchPosition` for real-time updates on mobile

## Important Implementation Notes

1. **No Global State Library** - Uses React Context and custom hooks only
2. **Single API Source** - All data from `transport-api.dzarlax.dev`
3. **Geolocation Manager is Singleton** - One global instance exported from `GeolocationManager.js`
4. **Map-based State** - `useTransitData` uses `Map` for O(1) station lookups by key
5. **Vehicle Diffing** - Only updates `BusStation` if arrival data actually changed
6. **10-second Polling** - Automatic refresh of transit data via `setInterval`
7. **Language Auto-detection** - LocalizationContext checks `navigator.language`

## File Structure Notes

- `src/client/components/` - UI components (Header, BusStation, modals, etc.)
- `src/client/utils/` - Custom hooks and contexts (not utilities)
- `public/` - Static assets and PWA files
- `Archive/` - Legacy server code (not actively used)
