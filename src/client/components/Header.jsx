import React from 'react';
import { MapPin, Repeat2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useLocalization } from '../utils/LocalizationContext';

const Header = ({ lastUpdated, onRefresh, loading, locationStatus }) => {
  const { t } = useLocalization();

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
            <ThemeToggle />
            {lastUpdated && (
              <div className="text-right hidden md:block">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('updated')}</p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {lastUpdated.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md disabled:shadow-none"
            >
              <Repeat2 className={loading ? 'w-3 h-3 sm:w-4 sm:h-4 animate-spin' : 'w-3 h-3 sm:w-4 sm:h-4'} />
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
                <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                  {t('updated')}: {lastUpdated.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}
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