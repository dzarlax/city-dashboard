import React, { useState, useRef, useEffect } from 'react';
import { Languages } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';
import Portal from './Portal';

const LanguageSelector = () => {
  const { language, changeLanguage, availableLanguages, t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const currentLang = availableLanguages.find(lang => lang.code === language);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  return (
    <>
      <div ref={buttonRef}>
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          aria-label={t('selectLanguage')}
          aria-expanded={isOpen}
        >
          <Languages className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:inline">
            {currentLang?.flag}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:inline">
            {currentLang?.code.toUpperCase()}
          </span>
        </button>
      </div>

      {isOpen && (
        <Portal>
          <div
            ref={dropdownRef}
            className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] animate-fade-in"
            style={{
              top: `${position.top}px`,
              right: `${position.right}px`
            }}
          >
            <div className="p-1">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    language === lang.code
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-sm font-medium">{lang.name}</span>
                  {language === lang.code && (
                    <span className="ml-auto text-primary-600 dark:text-primary-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};

export default LanguageSelector;
