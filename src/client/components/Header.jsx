import React from 'react';
import { MapPin, Repeat2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Header = ({ lastUpdated, onRefresh, loading, locationStatus }) => {
  console.log('Header rendered:', { lastUpdated, onRefresh: typeof onRefresh, loading, locationStatus });

  const handleRefresh = () => {
    console.log('Refresh button clicked, onRefresh:', typeof onRefresh);
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden animate-fade-in">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 p-3 rounded-xl">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                Nearby Transit
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                Real-time transport information
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {lastUpdated && (
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500 dark:text-gray-400">Last updated</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md disabled:shadow-none"
            >
              <Repeat2 className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Mobile Status Bar */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:hidden">
          <div className="flex justify-between items-center">
            {locationStatus && (
              <div className="flex-1">
                {locationStatus}
              </div>
            )}
            {lastUpdated && (
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Updated: {lastUpdated.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Location Status */}
        {locationStatus && (
          <div className="hidden sm:block mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                {locationStatus}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header; 