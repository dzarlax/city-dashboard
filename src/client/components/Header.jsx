import React, { useMemo } from 'react';
import { MapPin, Repeat2, AlertCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import SortSelector from './SortSelector';
import RadiusSlider from './RadiusSlider';
import { useLocalization } from '../utils/LocalizationContext';
import { STALE_DATA_THRESHOLD } from '../utils/constants';

const Header = ({ lastUpdated, onRefresh, loading, sortBy, onSortChange, searchRadius, onRadiusChange, locationStatus }) => {
  const { t } = useLocalization();

  // Check if data is stale
  const isDataStale = useMemo(() => {
    if (!lastUpdated) return false;
    const now = new Date();
    const timeSinceUpdate = now - lastUpdated;
    return timeSinceUpdate > STALE_DATA_THRESHOLD;
  }, [lastUpdated]);

  // Get relative time string
  const getRelativeTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return t('now') || 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden animate-fade-in">
      <div className="p-3 sm:p-4">
        {/* Main header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 p-2 rounded-lg">
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
          
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <SortSelector currentSort={sortBy} onSortChange={onSortChange} />
            <RadiusSlider radius={searchRadius} onRadiusChange={onRadiusChange} />
            <ThemeToggle />
            {lastUpdated && (
              <div
                className={`text-right hidden md:block ${isDataStale ? 'animate-pulse' : ''}`}
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
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label={loading ? 'Refreshing data' : 'Refresh data'}
            >
              <Repeat2 className={loading ? 'w-3 h-3 sm:w-4 sm:h-4 animate-spin' : 'w-3 h-3 sm:w-4 sm:h-4'} aria-hidden="true" />
              <span className="hidden sm:inline">{t('refresh')}</span>
            </button>
          </div>
        </div>

        {/* Location status row */}
        {locationStatus && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {locationStatus}
              </div>
              {lastUpdated && (
                <div
                  className={`text-xs sm:hidden ${isDataStale ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
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