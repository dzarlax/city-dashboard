import React, { useEffect, useRef } from 'react';
import { X, MapPin, Bus, ExternalLink, Clock, Zap, CalendarClock, Navigation } from 'lucide-react';
import Portal from './Portal';
import { useLocalization } from '../utils/LocalizationContext';
import { CITY_INFO, SERVER_URL, NOW_ARRIVAL_THRESHOLD, UPCOMING_ARRIVAL_THRESHOLD, MAX_ARRIVALS_PER_ROUTE } from '../utils/constants';
import { formatMinutes, getStationUrl, getLineUrl, getTransportType, TRANSPORT_CONFIG } from '../utils/helpers';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Palette for route lines when no official color
const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#65a30d'];

// Find the index of the point in a polyline closest to a given lat/lon
function findClosestPointIndex(points, lat, lon) {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const [pLat, pLon] = points[i];
    const d = (pLat - lat) ** 2 + (pLon - lon) ** 2;
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

// Trim a direction's points from the station onwards (the "remaining" route)
function trimFromStation(points, stationLat, stationLon) {
  if (!points || points.length === 0) return [];
  const idx = findClosestPointIndex(points, stationLat, stationLon);
  return points.slice(idx);
}

const StationDetailModal = ({
  isOpen,
  onClose,
  name,
  stopId,
  city,
  distance,
  coords,
  vehicles = [],
  isFavorite,
  onToggleFavorite,
  onOpenSchedule,
  onOpenRouteMap,
}) => {
  const { t } = useLocalization();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Initialize map + fetch and draw route shapes
  useEffect(() => {
    if (!isOpen || !coords || coords.length < 2) return;

    const lat = parseFloat(coords[0]);
    const lon = parseFloat(coords[1]);
    if (isNaN(lat) || isNaN(lon)) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!mapRef.current || cancelled) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
      }).setView([lat, lon], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Fetch direction-aware routes for this specific stop (single request)
      const cityLower = city.toLowerCase();
      let routes = [];
      try {
        const res = await fetch(`${SERVER_URL}/api/gtfs/${cityLower}/stop-directions?stop_id=${stopId}`);
        if (res.ok) {
          const json = await res.json();
          routes = json.routes ?? [];
        }
      } catch {}

      if (cancelled) return;

      // Draw route polylines — each route is already the correct direction for this stop
      const allBounds = [[lat, lon]];
      routes.forEach((route, idx) => {
        const lineColor = route.route_color && route.route_color.length === 6
          ? `#${route.route_color}`
          : ROUTE_COLORS[idx % ROUTE_COLORS.length];

        const rawPts = (route.points ?? []).map(([lt, ln]) => [lt, ln]);
        // Trim from station to end of route (only show where you can go)
        const pts = trimFromStation(rawPts, lat, lon);
        if (pts.length < 2) return;

        const poly = L.polyline(pts, {
          color: lineColor,
          weight: 4,
          opacity: 0.8,
          lineCap: 'round',
        }).addTo(map);
        poly.bindTooltip(route.line_number, { sticky: true, className: 'leaflet-tooltip-route' });

        // Terminus marker with headsign
        const lastPt = pts[pts.length - 1];
        const terminusLabel = route.headsign || route.line_number;

        const endIcon = L.divIcon({
          html: `<div style="
            display: flex; align-items: center; gap: 3px;
            background: ${lineColor}; color: white;
            padding: 2px 6px; border-radius: 10px;
            border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            font-size: 10px; font-weight: 700; white-space: nowrap;
            max-width: 160px; overflow: hidden; text-overflow: ellipsis;
          "><span>${route.line_number}</span><span style="font-weight:400;opacity:0.9">\u2192 ${terminusLabel}</span></div>`,
          className: '',
          iconSize: null,
          iconAnchor: [0, 10],
        });
        L.marker(lastPt, { icon: endIcon }).addTo(map);

        pts.forEach(p => allBounds.push(p));
      });

      // Station marker — large and prominent, drawn last to be on top
      const stationIcon = L.divIcon({
        html: `<div style="
          width: 40px; height: 40px;
          background: #2563eb; border: 4px solid white;
          border-radius: 50%; box-shadow: 0 0 0 3px #2563eb, 0 4px 12px rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
        "><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      L.marker([lat, lon], { icon: stationIcon, zIndexOffset: 1000 }).addTo(map);

      // Pulsing ring around station
      const pulseIcon = L.divIcon({
        html: `<div style="
          width: 60px; height: 60px;
          border: 3px solid #2563eb;
          border-radius: 50%;
          opacity: 0.4;
          animation: pulse-ring 2s ease-out infinite;
        "></div>
        <style>
          @keyframes pulse-ring {
            0% { transform: scale(0.6); opacity: 0.4; }
            100% { transform: scale(1.2); opacity: 0; }
          }
        </style>`,
        className: '',
        iconSize: [60, 60],
        iconAnchor: [30, 30],
      });
      L.marker([lat, lon], { icon: pulseIcon, zIndexOffset: 999, interactive: false }).addTo(map);

      // Fit bounds: show trimmed routes with some padding
      if (allBounds.length > 1) {
        map.fitBounds(L.latLngBounds(allBounds).pad(0.1), { maxZoom: 15 });
      }

      setTimeout(() => map.invalidateSize(), 300);
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, coords, stopId, city]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stationUrl = getStationUrl(stopId, name, city);
  const lat = coords ? parseFloat(coords[0]) : null;
  const lon = coords ? parseFloat(coords[1]) : null;
  const hasCoords = lat && lon && !isNaN(lat) && !isNaN(lon);

  // Group vehicles by line
  const groupedVehicles = vehicles.reduce((acc, vehicle) => {
    const key = `${vehicle.lineNumber}-${vehicle.lineName || ''}`;
    if (!acc[key]) {
      acc[key] = {
        lineNumber: vehicle.lineNumber,
        lineName: vehicle.lineName,
        routeColor: vehicle.routeColor || '',
        routeTextColor: vehicle.routeTextColor || '',
        fareAmount: vehicle.fareAmount || 0,
        firstDeparture: vehicle.firstDeparture || '',
        lastDeparture: vehicle.lastDeparture || '',
        scheduled: vehicle.scheduled || false,
        arrivals: [],
      };
    }
    acc[key].arrivals.push({
      secondsLeft: vehicle.secondsLeft,
      stationsBetween: vehicle.stationsBetween,
    });
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedVehicles).sort(
    (a, b) => parseInt(a.lineNumber) - parseInt(b.lineNumber)
  );

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[80vw] sm:max-w-[600px] lg:w-[50vw] lg:max-w-[900px] z-[9999] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-label={`Station ${name}`}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-primary-100 dark:bg-primary-900/40 p-1.5 rounded-lg flex-shrink-0">
                <Bus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                {name}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap ml-8">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                #{stopId}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CITY_INFO[city]?.badge || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`}>
                {city}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin className="w-3 h-3" />
                {distance}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          {/* Map */}
          {hasCoords && (
            <div
              ref={mapRef}
              className="w-full h-[30vh] sm:h-[35vh] bg-gray-100 dark:bg-gray-900"
              style={{ minHeight: '192px' }}
            />
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            {stationUrl && (
              <a
                href={stationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700 dark:hover:bg-sky-900/50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                BG Prevoz
              </a>
            )}
            {hasCoords && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/50 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                {t('routeMap')}
              </a>
            )}
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(stopId, city)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isFavorite
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                {isFavorite ? '\u2605' : '\u2606'}
              </button>
            )}
          </div>

          {/* Routes */}
          <div className="px-4 py-3 space-y-3">
            {sortedGroups.length > 0 ? (
              sortedGroups.map((group) => {
                const transportType = getTransportType(group.lineNumber, city, group.lineName);
                const hasOfficialColor = group.routeColor && group.routeColor.length === 6;
                const btnStyle = hasOfficialColor
                  ? { backgroundColor: `#${group.routeColor}`, color: `#${group.routeTextColor || 'FFFFFF'}` }
                  : {};
                const btnClass = hasOfficialColor
                  ? 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold'
                  : `inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${TRANSPORT_CONFIG[transportType]?.btnClass || TRANSPORT_CONFIG['\u0430\u0443\u0442\u043e\u0431\u0443\u0441'].btnClass}`;

                return (
                  <div
                    key={`${group.lineNumber}-${group.lineName || ''}`}
                    className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 space-y-2"
                  >
                    {/* Line header */}
                    <div className="flex items-center gap-2">
                      <span className={btnClass} style={btnStyle}>
                        {group.lineNumber}
                      </span>
                      {group.lineName && (
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                          {group.lineName}
                        </span>
                      )}
                      {group.scheduled && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          <CalendarClock className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Arrivals */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {group.arrivals
                          .sort((a, b) => a.secondsLeft - b.secondsLeft)
                          .slice(0, MAX_ARRIVALS_PER_ROUTE)
                          .map((arrival, i) => {
                            const isNow = arrival.secondsLeft < NOW_ARRIVAL_THRESHOLD;
                            const isUpcoming = arrival.secondsLeft < UPCOMING_ARRIVAL_THRESHOLD;
                            return (
                              <span
                                key={i}
                                className={
                                  isNow
                                    ? 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold whitespace-nowrap bg-amber-500 text-white animate-pulse'
                                    : isUpcoming
                                    ? 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700'
                                    : 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                }
                              >
                                {isNow && <Zap className="w-2.5 h-2.5 mr-0.5" />}
                                {formatMinutes(arrival.secondsLeft, t)}
                                {arrival.stationsBetween > 0 && (
                                  <span className="ml-1 opacity-75 text-[10px]">({arrival.stationsBetween})</span>
                                )}
                              </span>
                            );
                          })}
                      </div>
                    </div>

                    {/* Meta: operating hours & fare */}
                    {(group.firstDeparture || group.fareAmount > 0) && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        {group.firstDeparture && (
                          <span>{group.firstDeparture} \u2192 {group.lastDeparture}</span>
                        )}
                        {group.fareAmount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-700">
                            {group.fareAmount} RSD
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenSchedule({ lineNumber: group.lineNumber, lineName: group.lineName, routeColor: group.routeColor, routeTextColor: group.routeTextColor })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        <CalendarClock className="w-3 h-3" />
                        {t('fullSchedule')}
                      </button>
                      {city === 'BG' && (
                        <button
                          onClick={() => onOpenRouteMap({ lineNumber: group.lineNumber, lineName: group.lineName, routeColor: group.routeColor })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                        >
                          <MapPin className="w-3 h-3" />
                          {t('routeMap')}
                        </button>
                      )}
                      {city === 'BG' && (
                        <a
                          href={getLineUrl(group.lineNumber, city)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-700 hover:bg-sky-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6">
                <Clock className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t('noArrivalsScheduled')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default StationDetailModal;
