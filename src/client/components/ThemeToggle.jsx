import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../utils/ThemeContext';
import { useLocalization } from '../utils/LocalizationContext';

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLocalization();

  const handleClick = () => {
    toggleTheme();
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all duration-200 group"
      aria-label={isDark ? t('switchToLightMode') : t('switchToDarkMode')}
    >
      <div className="relative w-5 h-5">
        <Sun 
          className={
            isDark 
              ? 'absolute inset-0 w-5 h-5 text-yellow-500 transition-all duration-300 opacity-0 rotate-90 scale-50' 
              : 'absolute inset-0 w-5 h-5 text-yellow-500 transition-all duration-300 opacity-100 rotate-0 scale-100'
          }
        />
        <Moon 
          className={
            isDark 
              ? 'absolute inset-0 w-5 h-5 text-blue-400 transition-all duration-300 opacity-100 rotate-0 scale-100' 
              : 'absolute inset-0 w-5 h-5 text-blue-400 transition-all duration-300 opacity-0 -rotate-90 scale-50'
          }
        />
      </div>
    </button>
  );
};

export default ThemeToggle; 