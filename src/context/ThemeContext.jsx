import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggle: () => {}, isDark: true });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('mlb-theme') || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('mlb-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
