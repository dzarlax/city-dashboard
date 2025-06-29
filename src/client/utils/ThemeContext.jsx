import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    console.error('useTheme must be used within a ThemeProvider');
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      console.log('Loaded theme from localStorage:', savedTheme);
      return savedTheme === 'dark';
    }
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('Using system preference:', systemDark);
    return systemDark;
  });

  useEffect(() => {
    console.log('ThemeProvider effect:', isDark);
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      console.log('Added dark class to HTML. Current classes:', root.className);
    } else {
      root.classList.remove('dark');
      console.log('Removed dark class from HTML. Current classes:', root.className);
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Additional debug - check if dark class is actually there
    const hasDarkClass = root.classList.contains('dark');
    console.log('HTML element has dark class:', hasDarkClass);
  }, [isDark]);

  const toggleTheme = () => {
    console.log('toggleTheme called, current isDark:', isDark);
    setIsDark(!isDark);
  };

  const value = { isDark, toggleTheme };
  console.log('ThemeProvider rendering with value:', value);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
} 