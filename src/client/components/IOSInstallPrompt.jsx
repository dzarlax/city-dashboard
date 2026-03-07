import React, { useState, useEffect } from 'react';
import { X, Share } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';

const DISMISSED_KEY = 'ios_install_dismissed';

const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return isIOS && isSafari && !isStandalone;
};

// Renders a string with {share} placeholder replaced by the Share icon
const renderWithShareIcon = (str) => {
  const parts = str.split('{share}');
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <Share className="inline w-3.5 h-3.5 text-blue-500 mx-0.5 align-text-bottom" />
      )}
    </React.Fragment>
  ));
};

const IOSInstallPrompt = () => {
  const { t } = useLocalization();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIOSSafari() && !localStorage.getItem(DISMISSED_KEY)) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-6 pt-2">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <img src="/icons/apple-touch-icon.png" alt="" className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('iosInstallTitle')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {renderWithShareIcon(t('iosInstallBody'))}
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 rotate-45" />
      </div>
    </div>
  );
};

export default IOSInstallPrompt;
