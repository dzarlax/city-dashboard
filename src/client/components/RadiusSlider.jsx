import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';
import { STORAGE_KEYS } from '../utils/constants';
import Portal from './Portal';

const RadiusSlider = ({ radius, onRadiusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRadius, setTempRadius] = useState(radius);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const { t } = useLocalization();

  useEffect(() => {
    setTempRadius(radius);
  }, [radius]);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTempRadius(radius);
  }, [radius]);

  const toggleDropdown = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close on click outside, scroll, resize, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        close();
      }
    };

    const handleDismiss = () => close();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [isOpen, close]);

  const handleRadiusChange = (newRadius) => {
    setTempRadius(newRadius);
  };

  const handleApply = () => {
    onRadiusChange(tempRadius);
    localStorage.setItem(STORAGE_KEYS.SEARCH_RADIUS, tempRadius.toString());
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultRadius = 500;
    setTempRadius(defaultRadius);
    onRadiusChange(defaultRadius);
    localStorage.setItem(STORAGE_KEYS.SEARCH_RADIUS, defaultRadius.toString());
    setIsOpen(false);
  };

  const radiusOptions = [
    { value: 500, label: '500m' },
    { value: 1000, label: '1km' },
    { value: 2000, label: '2km' },
    { value: 5000, label: '5km' },
    { value: 10000, label: '10km' }
  ];

  const currentLabel = radiusOptions.find(opt => opt.value === radius)?.label || `${radius}m`;

  return (
    <>
      <div ref={buttonRef}>
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors shrink-0 whitespace-nowrap"
          aria-label={t('searchRadius')}
          aria-expanded={isOpen}
        >
          <Maximize className="w-4 h-4 shrink-0 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {currentLabel}
          </span>
        </button>
      </div>

      {isOpen && (
        <Portal>
          <div
            ref={dropdownRef}
            className="fixed w-72 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] animate-fade-in"
            style={{
              top: `${position.top}px`,
              right: `${position.right}px`
            }}
          >
            <div className="px-3 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t('searchRadius')}
                </h3>
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {tempRadius >= 1000 ? `${tempRadius / 1000}km` : `${tempRadius}m`}
                </span>
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 mb-4">
                {radiusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleRadiusChange(option.value)}
                    className={`flex-1 min-w-0 py-1.5 px-1 text-xs font-medium rounded-md transition-colors text-center truncate ${
                      tempRadius === option.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom slider */}
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={tempRadius}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                aria-label={t('searchRadius')}
              />

              {/* Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('reset')}
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {t('apply')}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};

export default RadiusSlider;
