import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';
import { STORAGE_KEYS, SORT_OPTIONS } from '../utils/constants';
import Portal from './Portal';

const sortOptionsList = [
  { value: SORT_OPTIONS.DISTANCE, label: 'Distance', icon: '📍' },
  { value: SORT_OPTIONS.ARRIVAL_TIME, label: 'Arrival Time', icon: '⏰' },
  { value: SORT_OPTIONS.NAME, label: 'Name', icon: '🔤' }
];

const SortSelector = ({ currentSort, onSortChange }) => {
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const currentOption = sortOptionsList.find(opt => opt.value === currentSort);

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

  const handleSortChange = (value) => {
    onSortChange(value);
    localStorage.setItem(STORAGE_KEYS.SORT_BY, value);
    setIsOpen(false);
  };

  return (
    <>
      <div ref={buttonRef}>
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          aria-label="Sort stations"
          aria-expanded={isOpen}
        >
          <ArrowUpDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:inline">
            {currentOption?.icon}
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
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Sort by
              </div>
              {sortOptionsList.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    currentSort === option.value
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                  {currentSort === option.value && (
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

export default SortSelector;
