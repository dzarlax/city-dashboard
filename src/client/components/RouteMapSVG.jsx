import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, MapPin } from 'lucide-react';
import Portal from './Portal';
import { SERVER_URL } from '../utils/constants';
import { useLocalization } from '../utils/LocalizationContext';

const PADDING = 24;
const W = 400;
const H = 280;

function projectPoints(allPoints) {
  if (!allPoints.length) return { project: () => [0, 0] };
  const lats = allPoints.map(p => p[0]);
  const lons = allPoints.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const latRange = maxLat - minLat || 0.001;
  const lonRange = maxLon - minLon || 0.001;
  return {
    minLat, maxLat, minLon, maxLon,
    project: ([lat, lon]) => [
      PADDING + ((lon - minLon) / lonRange) * (W - PADDING * 2),
      PADDING + ((maxLat - lat) / latRange) * (H - PADDING * 2),
    ],
  };
}

const DIR_COLORS = ['#0098DA', '#00A859'];

const RouteMapSVG = ({ isOpen, onClose, lineNumber, lineName, city, routeColor, stopLat, stopLon }) => {
  const { t } = useLocalization();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    if (!lineNumber || !city) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/gtfs/${city.toLowerCase()}/shape?line=${lineNumber}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [lineNumber, city]);

  useEffect(() => {
    if (isOpen) fetch_();
    else { setData(null); setError(null); }
  }, [isOpen, fetch_]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const { directions, proj } = useMemo(() => {
    const dirs = data?.directions ?? [];
    const allPts = dirs.flatMap(d => d.points ?? []);
    if (stopLat != null && stopLon != null) allPts.push([stopLat, stopLon]);
    return { directions: dirs, proj: projectPoints(allPts) };
  }, [data, stopLat, stopLon]);

  if (!isOpen) return null;

  const primaryColor = routeColor ? `#${routeColor}` : DIR_COLORS[0];

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-[9999] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        role="dialog" aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold"
              style={{ backgroundColor: primaryColor, color: '#ffffff' }}
            >
              {lineNumber}
            </span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[220px]">
                {lineName || t('routeMap')}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetch_} disabled={loading} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* SVG area */}
        <div className="p-3">
          {loading && (
            <div className="flex items-center justify-center h-48 gap-2">
              <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <p className="text-sm text-red-500 dark:text-red-400">{t('routeLoadError')}: {error}</p>
              <button onClick={fetch_} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
                {t('tryAgain')}
              </button>
            </div>
          )}

          {!loading && !error && directions.length === 0 && data !== null && (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noRouteData')}</p>
            </div>
          )}

          {!loading && !error && directions.length > 0 && (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
              style={{ aspectRatio: `${W}/${H}` }}
            >
              {directions.map((dir, idx) => {
                const pts = (dir.points ?? []).map(p => proj.project(p));
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
                const color = idx === 0 ? primaryColor : DIR_COLORS[1] ?? '#00A859';
                return (
                  <path
                    key={idx}
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={idx === 0 ? 3 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={idx === 0 ? 1 : 0.6}
                  />
                );
              })}

              {/* Current stop marker */}
              {stopLat != null && stopLon != null && (() => {
                const [x, y] = proj.project([stopLat, stopLon]);
                return (
                  <g>
                    <circle cx={x} cy={y} r={7} fill="white" stroke="#EF4444" strokeWidth={2} />
                    <circle cx={x} cy={y} r={4} fill="#EF4444" />
                  </g>
                );
              })()}
            </svg>
          )}
        </div>

        {/* Direction legend */}
        {!loading && !error && directions.length > 1 && (
          <div className="flex items-center gap-4 px-4 pb-3 pt-0">
            {directions.map((_, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: idx === 0 ? primaryColor : (DIR_COLORS[1] ?? '#00A859'), opacity: idx === 0 ? 1 : 0.6 }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {idx === 0 ? 'A →' : '← B'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Portal>
  );
};

export default RouteMapSVG;
