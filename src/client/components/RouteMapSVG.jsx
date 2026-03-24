import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RefreshCw, MapPin } from 'lucide-react';
import Portal from './Portal';
import { SERVER_URL } from '../utils/constants';
import { useLocalization } from '../utils/LocalizationContext';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DIR_COLORS = ['#0098DA', '#00A859'];

const RouteMapLeaflet = ({ isOpen, onClose, lineNumber, lineName, city, routeColor, stopLat, stopLon }) => {
  const { t } = useLocalization();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);

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

  // Init map once the container div is mounted
  useEffect(() => {
    if (!isOpen || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isOpen]);

  // Draw route + stop marker whenever data or stop coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous layers
    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];

    const primaryColor = routeColor ? `#${routeColor}` : DIR_COLORS[0];
    const dirs = data?.directions ?? [];
    const bounds = [];

    dirs.forEach((dir, idx) => {
      const pts = (dir.points ?? []).map(([lat, lon]) => [lat, lon]);
      if (!pts.length) return;
      const color = idx === 0 ? primaryColor : (DIR_COLORS[1] ?? '#00A859');
      const poly = L.polyline(pts, {
        color,
        weight: idx === 0 ? 5 : 3,
        opacity: idx === 0 ? 0.9 : 0.6,
      }).addTo(map);
      layersRef.current.push(poly);
      pts.forEach(p => bounds.push(p));
    });

    if (stopLat != null && stopLon != null) {
      const stopIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#EF4444;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([stopLat, stopLon], { icon: stopIcon }).addTo(map);
      layersRef.current.push(marker);
      bounds.push([stopLat, stopLon]);
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24] });
    } else if (stopLat != null && stopLon != null) {
      map.setView([stopLat, stopLon], 15);
    }
  }, [data, stopLat, stopLon, routeColor]);

  if (!isOpen) return null;

  const primaryColor = routeColor ? `#${routeColor}` : DIR_COLORS[0];
  const dirs = data?.directions ?? [];

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

        {/* Map area */}
        <div className="p-3">
          {loading && (
            <div className="flex items-center justify-center h-64 gap-2">
              <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-sm text-red-500 dark:text-red-400">{t('routeLoadError')}: {error}</p>
              <button onClick={fetch_} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
                {t('tryAgain')}
              </button>
            </div>
          )}

          {!loading && !error && dirs.length === 0 && data !== null && (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noRouteData')}</p>
            </div>
          )}

          {/* Leaflet map container — always rendered when open so map can init */}
          <div
            ref={mapRef}
            className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
            style={{ height: '260px', display: loading || error || (data !== null && dirs.length === 0) ? 'none' : 'block' }}
          />
        </div>

        {/* Direction legend */}
        {!loading && !error && dirs.length > 1 && (
          <div className="flex items-center gap-4 px-4 pb-3 pt-0">
            {dirs.map((_, idx) => (
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

export default RouteMapLeaflet;
