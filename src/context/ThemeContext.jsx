import { createContext, useContext, useEffect, useState } from 'react';
import {
  THEME_COLOR,
  THEME_COLOR_OPTIONS,
  getStoredThemeColor,
  setStoredThemeColor,
} from '../theme/theme';

const ThemeContext = createContext({
  theme: 'dark',
  toggle: () => {},
  isDark: true,
  color: THEME_COLOR,
  setColor: () => {},
  colorOptions: THEME_COLOR_OPTIONS,
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('mlb-theme') || 'dark');
  const [color, setColorState] = useState(() => getStoredThemeColor());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('mlb-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.themeColor = color;
  }, [color]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const setColor = (next) => setColorState(setStoredThemeColor(next));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle,
        isDark: theme === 'dark',
        color,
        setColor,
        colorOptions: THEME_COLOR_OPTIONS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);