import React, { useState, useEffect } from 'react';
import { requestNotifications, getNotificationStatus } from '../serviceWorkerRegistration';

const NotificationSettings = ({ className = "" }) => {
  const [status, setStatus] = useState('checking');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Проверяем статус уведомлений при монтировании
    const checkStatus = () => {
      const currentStatus = getNotificationStatus();
      setStatus(currentStatus);
    };
    
    checkStatus();
    
    // Проверяем статус при возврате в приложение
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotifications();
      setStatus(granted ? 'granted' : 'denied');
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
    setIsRequesting(false);
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'not_supported':
        return {
          icon: '❌',
          title: 'Not Supported',
          description: 'Your browser doesn\'t support push notifications',
          color: 'text-gray-600 dark:text-gray-400',
          showButton: false
        };
      case 'granted':
        return {
          icon: '🔔',
          title: 'Enabled',
          description: 'You\'ll receive notifications for arriving buses',
          color: 'text-green-600 dark:text-green-400',
          showButton: false
        };
      case 'denied':
        return {
          icon: '🔕',
          title: 'Blocked',
          description: 'Enable in browser settings to receive notifications',
          color: 'text-red-600 dark:text-red-400',
          showButton: false
        };
      case 'default':
        return {
          icon: '🔔',
          title: 'Available',
          description: 'Get notified when your bus is arriving soon',
          color: 'text-blue-600 dark:text-blue-400',
          showButton: true
        };
      default:
        return {
          icon: '⏳',
          title: 'Checking...',
          description: 'Checking notification support',
          color: 'text-gray-600 dark:text-gray-400',
          showButton: false
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl" role="img" aria-label="notification status">
          {statusInfo.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              Push Notifications
            </h3>
            <span className={`text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.title}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {statusInfo.description}
          </p>
          
          {statusInfo.showButton && (
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isRequesting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Requesting...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 0 0-15 0v5h5l-5 5-5-5h5V7a10 10 0 0 1 20 0v10z" />
                  </svg>
                  Enable Notifications
                </>
              )}
            </button>
          )}
          
          {status === 'granted' && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 You'll get alerts when buses arrive in &lt;5 minutes
            </div>
          )}
          
          {status === 'denied' && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 Go to browser settings → Site settings → Notifications to enable
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings; 