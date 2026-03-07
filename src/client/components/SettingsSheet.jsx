import React, { useEffect } from 'react';
import { X, ArrowUpDown, Maximize2, Languages, Sun, Moon } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';
import { useTheme } from '../utils/ThemeContext';
import { SORT_OPTIONS, STORAGE_KEYS } from '../utils/constants';
import Portal from './Portal';

const sortOptions = [
  { value: SORT_OPTIONS.DISTANCE, label: 'Distance', icon: '📍' },
  { value: SORT_OPTIONS.ARRIVAL_TIME, label: 'Arrival', icon: '⏰' },
  { value: SORT_OPTIONS.NAME, label: 'Name', icon: '🔤' },
];

const radiusOptions = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

const SettingsSheet = ({ isOpen, onClose, sortBy, onSortChange, searchRadius, onRadiusChange }) => {
  const { language, changeLanguage, availableLanguages, t } = useLocalization();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSortChange = (value) => {
    onSortChange(value);
    localStorage.setItem(STORAGE_KEYS.SORT_BY, value);
  };

  const handleRadiusChange = (value) => {
    onRadiusChange(value);
    localStorage.setItem(STORAGE_KEYS.SEARCH_RADIUS, value.toString());
  };

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl animate-slide-up-sheet max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-4 py-5 space-y-6 pb-8">

          {/* Sort */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Sort by
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-colors ${
                    sortBy === opt.value
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-xl leading-none">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Radius */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Search Radius
                </span>
              </div>
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                {searchRadius >= 1000 ? `${searchRadius / 1000}km` : `${searchRadius}m`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {radiusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleRadiusChange(opt.value)}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    searchRadius === opt.value
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={searchRadius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-primary-600"
              aria-label="Search radius slider"
            />
          </section>

          {/* Language */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Languages className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('language')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {availableLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-colors ${
                    language === lang.code
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-xl leading-none">{lang.flag}</span>
                  {lang.name}
                </button>
              ))}
            </div>
          </section>

          {/* Theme */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              {isDark
                ? <Moon className="w-4 h-4 text-gray-400" />
                : <Sun className="w-4 h-4 text-gray-400" />
              }
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Theme
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-100 dark:bg-gray-700 rounded-xl transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDark ? t('switchToLightMode') : t('switchToDarkMode')}
              </span>
              <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>
          </section>

        </div>
      </div>
    </Portal>
  );
};

export default SettingsSheet;
