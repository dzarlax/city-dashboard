import React, { useMemo } from 'react';
import { MapPin, Repeat2, AlertCircle, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import SortSelector from './SortSelector';
import RadiusSlider from './RadiusSlider';
import { useLocalization } from '../utils/LocalizationContext';
import { STALE_DATA_THRESHOLD } from '../utils/constants';

const Header = ({
  lastUpdated,
  onRefresh,
  loading,
  sortBy,
  onSortChange,
  searchRadius,
  onRadiusChange,
  locationStatus,
  onOpenSettings,
  onOpenChanges,
}) => {
  const { t } = useLocalization();

  const isDataStale = useMemo(() => {
    if (!lastUpdated) return false;
    return new Date() - lastUpdated > STALE_DATA_THRESHOLD;
  }, [lastUpdated]);

  const getRelativeTime = (date) => {
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return t('now') || 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      <div className="p-3 sm:p-4">

        {/* Main header row */}
        <div className="flex items-center justify-between">

          {/* Left: icon + title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-primary-100 dark:bg-primary-900/40 p-2 rounded-lg flex-shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {t('nearbyTransit')}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {t('realtimeTransportInfo')}
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">

            {/* Desktop-only controls */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <LanguageSelector />
              <SortSelector currentSort={sortBy} onSortChange={onSortChange} />
              <RadiusSlider radius={searchRadius} onRadiusChange={onRadiusChange} />
              <ThemeToggle />
              {lastUpdated && (
                <div
                  className={`text-right ${isDataStale ? 'animate-pulse' : ''}`}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                    {t('updated')}
                    {isDataStale && (
                      <AlertCircle className="w-3 h-3 text-amber-500" aria-label="Data is stale" />
                    )}
                  </p>
                  <p className={`text-xs font-medium ${isDataStale ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {getRelativeTime(lastUpdated)}
                  </p>
                </div>
              )}
            </div>

            {/* Changes button — always visible */}
            <button
              onClick={onOpenChanges}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium shadow-sm"
              aria-label="Show transit changes"
            >
              <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('changes')}</span>
            </button>

            {/* Refresh button — always visible */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label={loading ? 'Refreshing data' : 'Refresh data'}
            >
              <Repeat2
                className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{t('refresh')}</span>
            </button>

            {/* Mobile-only settings button */}
            <button
              onClick={onOpenSettings}
              className="md:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              aria-label="Open settings"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>

          </div>
        </div>

        {/* Location status row */}
        {locationStatus && (
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {locationStatus}
              </div>
              {lastUpdated && (
                <div
                  className={`text-xs md:hidden ${isDataStale ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
                  role="status"
                  aria-live="polite"
                >
                  {t('updated')}: {getRelativeTime(lastUpdated)}
                  {isDataStale && (
                    <AlertCircle className="w-3 h-3 text-amber-500 inline ml-1" aria-label="Data is stale" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Header;
