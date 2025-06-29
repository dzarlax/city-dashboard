import React from 'react';

const LocationFallbackNotice = ({ reason, onTryAgain, onDismiss }) => {
  const getTitle = () => {
    switch (reason) {
      case 'HTTPS_REQUIRED':
        return 'HTTPS Required for Location';
      case 'NOT_SUPPORTED':
        return 'Location Not Supported';
      case 'PERMISSION_DENIED':
        return 'Location Access Denied';
      default:
        return 'Using Default Location';
    }
  };

  const getMessage = () => {
    switch (reason) {
      case 'HTTPS_REQUIRED':
        return 'Location services require a secure HTTPS connection. Using Belgrade city center as default location.';
      case 'NOT_SUPPORTED':
        return 'Your browser doesn\'t support location services. Using Belgrade city center as default location.';
      case 'PERMISSION_DENIED':
        return 'Location access was denied. Using Belgrade city center as default location.';
      default:
        return 'Unable to determine your location. Using Belgrade city center as default location.';
    }
  };

  const getActionText = () => {
    switch (reason) {
      case 'HTTPS_REQUIRED':
        return 'Use HTTPS';
      case 'PERMISSION_DENIED':
        return 'Enable Location';
      default:
        return 'Try Again';
    }
  };

  const handleAction = () => {
    if (reason === 'HTTPS_REQUIRED') {
      // Перенаправляем на HTTPS версию
      window.location.href = 'https://transport.dzarlax.dev';
    } else {
      onTryAgain?.();
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-4 animate-fade-in">
      <div className="flex items-start">
        <svg 
          className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
          />
        </svg>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-yellow-800 dark:text-yellow-400 font-medium text-sm">
              {getTitle()}
            </h3>
            <button
              onClick={onDismiss}
              className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 p-1 rounded"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1 mb-3">
            {getMessage()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAction}
              className="text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 text-xs font-medium underline"
            >
              {getActionText()}
            </button>
            {reason === 'HTTPS_REQUIRED' && (
              <span className="text-yellow-600 dark:text-yellow-400 text-xs">
                or use localhost for development
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationFallbackNotice; 