import React from 'react';

const LocationStatus = ({ 
  isUsingGPS, 
  isStale, 
  accuracy, 
  onRequestLocation,
  isRequesting 
}) => {
  const getStatusText = () => {
    if (isRequesting) return 'Getting location...';
    if (isUsingGPS && isStale) return 'Using saved location';
    if (isUsingGPS) return 'GPS location active';
    return 'Using default location';
  };

  const getStatusColor = () => {
    if (isRequesting) return 'text-yellow-600 dark:text-yellow-400';
    if (isUsingGPS && !isStale) return 'text-green-600 dark:text-green-400';
    if (isUsingGPS && isStale) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getStatusIcon = () => {
    if (isRequesting) {
      return (
        <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
      );
    }

    if (isUsingGPS && !isStale) {
      return (
        <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
      );
    }

    if (isUsingGPS && isStale) {
      return (
        <svg className="w-3 h-3 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }

    return (
      <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  };

  const handleClick = () => {
    if (!isUsingGPS && !isRequesting) {
      onRequestLocation();
    }
  };

  return (
    <div 
      className={`
        flex items-center text-xs font-medium transition-colors
        ${getStatusColor()}
        ${(!isUsingGPS && !isRequesting) ? 'cursor-pointer hover:opacity-80' : ''}
      `}
      onClick={handleClick}
      title={
        isRequesting ? 'Requesting location...' :
        isUsingGPS && !isStale ? `GPS active${accuracy ? ` (±${Math.round(accuracy)}m)` : ''}` :
        isUsingGPS && isStale ? 'Using previously saved location' :
        'Click to enable GPS location'
      }
    >
      {getStatusIcon()}
      <span className="ml-1.5 hidden sm:inline">
        {getStatusText()}
      </span>
      
      {/* Показать точность на больших экранах */}
      {isUsingGPS && !isStale && accuracy && (
        <span className="ml-1 text-xs opacity-75 hidden md:inline">
          ±{Math.round(accuracy)}m
        </span>
      )}
    </div>
  );
};

export default LocationStatus; 