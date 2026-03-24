import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, Clock } from 'lucide-react';
import Portal from './Portal';
import { SERVER_URL } from '../utils/constants';
import { useLocalization } from '../utils/LocalizationContext';

/**
 * Parse a departure time string like "HH:MM" where HH may exceed 23
 * (e.g. "24:10" means 00:10 the next day).
 * Returns total seconds from midnight of the current day.
 */
function parseTimeToSeconds(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 3600 + mm * 60;
}

/**
 * Returns seconds until a departure, accounting for times > 23:xx rolling
 * over to the next day.
 */
function secondsUntilDeparture(timeStr) {
  const now =
    new Date().getHours() * 3600 +
    new Date().getMinutes() * 60 +
    new Date().getSeconds();
  let departureSeconds = parseTimeToSeconds(timeStr);
  if (departureSeconds < now) {
    departureSeconds += 86400;
  }
  return departureSeconds - now;
}

/**
 * Group an array of time strings by their hour bucket.
 * Returns an array of { hour: number, times: string[] } sorted by hour.
 */
function groupByHour(times) {
  const map = new Map();
  for (const t of times) {
    const hh = parseInt(t.split(':')[0], 10);
    const bucket = hh % 24; // normalize 24+ hour values for grouping header
    if (!map.has(hh)) map.set(hh, []);
    map.get(hh).push(t);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, times]) => ({ hour, times }));
}

const ScheduleModal = ({
  isOpen,
  onClose,
  stopId,
  city,
  lineNumber,
  lineName,
  routeColor,
  routeTextColor,
}) => {
  const { t } = useLocalization();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchedule = useCallback(async () => {
    if (!stopId || !city) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/gtfs/${city.toLowerCase()}/schedule?stop_id=${stopId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSchedule(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [stopId, city]);

  useEffect(() => {
    if (isOpen) {
      fetchSchedule();
    } else {
      // Reset on close so next open re-fetches
      setSchedule(null);
      setError(null);
    }
  }, [isOpen, fetchSchedule]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Filter departures for the matching line and collect times
  const departureTimes = useMemo(() => {
    if (!schedule) return [];
    const match = schedule.find(
      (route) => String(route.line_number ?? route.lineNumber) === String(lineNumber)
    );
    return match?.departures ?? match?.times ?? [];
  }, [schedule, lineNumber]);

  const hourGroups = useMemo(() => groupByHour(departureTimes), [departureTimes]);

  // Chip color based on how soon the departure is
  function chipClass(timeStr) {
    const secs = secondsUntilDeparture(timeStr);
    if (secs <= 5 * 60) {
      // within 5 min
      return 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700';
    }
    if (secs <= 30 * 60) {
      // within 30 min
      return 'bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700';
    }
    return 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
  }

  // Format display time: normalize 24+ hours back to 00–23 for readability
  function displayTime(timeStr) {
    const [hh, mm] = timeStr.split(':');
    const h = parseInt(hh, 10) % 24;
    return `${String(h).padStart(2, '0')}:${mm}`;
  }

  const badgeStyle = routeColor
    ? {
        backgroundColor: `#${routeColor}`,
        color: routeTextColor ? `#${routeTextColor}` : '#ffffff',
      }
    : { backgroundColor: '#2563eb', color: '#ffffff' };

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-[9999] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-label={`Schedule for line ${lineNumber}`}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold flex-shrink-0"
              style={badgeStyle}
            >
              {lineNumber}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {lineName ? `${lineName}` : t('fullSchedule')}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={fetchSchedule}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Refresh schedule"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="w-6 h-6 text-primary-500 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-red-500 dark:text-red-400">
                {t('scheduleLoadError')}: {error}
              </p>
              <button
                onClick={fetchSchedule}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}

          {/* No data */}
          {!loading && !error && hourGroups.length === 0 && schedule !== null && (
            <div className="flex flex-col items-center justify-center py-10">
              <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noScheduleData')}</p>
            </div>
          )}

          {/* Hour groups */}
          {!loading && !error && hourGroups.length > 0 && (
            <div className="space-y-3">
              {hourGroups.map(({ hour, times }) => (
                <div key={hour} className="flex gap-3 items-start">
                  {/* Hour label */}
                  <div className="w-10 flex-shrink-0 text-right">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                      {String(hour % 24).padStart(2, '0')}h
                    </span>
                  </div>
                  {/* Time chips */}
                  <div className="flex flex-wrap gap-1.5 flex-1 pt-0.5">
                    {times.map((t_) => (
                      <span
                        key={t_}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium ${chipClass(t_)}`}
                      >
                        {displayTime(t_)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        {!loading && !error && hourGroups.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700">
              &lt;5 min
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700">
              &lt;30 min
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
              later
            </span>
          </div>
        )}
      </div>
    </Portal>
  );
};

export default ScheduleModal;
