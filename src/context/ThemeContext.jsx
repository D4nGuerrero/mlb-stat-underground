import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  THEME_COLOR_DEFAULT,
  THEME_COLOR_OPTIONS,
  getStoredThemeColor,
  setStoredThemeColor,
  applyAccentToDocument,
} from '../theme/theme.js';

const THEME_STORAGE_KEY = 'mlb-theme';
const NAV_POSITION_STORAGE_KEY = 'mlb-nav-position';
const HIDE_TOP_BAR_STORAGE_KEY = 'mlb-hide-top-bar';

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function readStoredNavPosition() {
  try {
    return localStorage.getItem(NAV_POSITION_STORAGE_KEY) === 'bottom' ? 'bottom' : 'top';
  } catch {
    return 'top';
  }
}

function readStoredHideTopBar() {
  try {
    return localStorage.getItem(HIDE_TOP_BAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [color, setColorState] = useState(getStoredThemeColor);
  const [navPosition, setNavPositionState] = useState(readStoredNavPosition);
  const [hideTopBar, setHideTopBarState] = useState(readStoredHideTopBar);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';

    root.classList.toggle('dark', isDark);
    root.dataset.theme = theme;
    body.classList.toggle('theme-light', !isDark);
    body.classList.toggle('theme-dark', isDark);

    // Mono default + light-mode accent darkness depend on appearance.
    applyAccentToDocument(color, isDark);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, color]);

  useEffect(() => {
    try {
      localStorage.setItem('mlb-theme-color', color);
    } catch {
      /* ignore */
    }
  }, [color]);

  useEffect(() => {
    document.documentElement.dataset.navPosition = navPosition;
    try {
      localStorage.setItem(NAV_POSITION_STORAGE_KEY, navPosition);
    } catch {
      /* ignore */
    }
  }, [navPosition]);

  useEffect(() => {
    document.documentElement.dataset.hideTopBar = hideTopBar ? 'true' : 'false';
    try {
      localStorage.setItem(HIDE_TOP_BAR_STORAGE_KEY, hideTopBar ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [hideTopBar]);

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const setColor = useCallback((next) => {
    const resolved = setStoredThemeColor(next);
    const isDark = document.documentElement.dataset.theme !== 'light';
    applyAccentToDocument(resolved, isDark);
    setColorState(resolved);
    void document.documentElement.offsetHeight;
  }, []);

  const setNavPosition = useCallback((next) => {
    const resolved = next === 'bottom' ? 'bottom' : 'top';
    setNavPositionState(resolved);
    // Top bar mode always shows the header; keep hide preference stored but unused.
  }, []);

  const setHideTopBar = useCallback((next) => {
    setHideTopBarState(Boolean(next));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggle,
      isDark: theme === 'dark',
      color: THEME_COLOR_OPTIONS.includes(color) ? color : THEME_COLOR_DEFAULT,
      setColor,
      colorOptions: THEME_COLOR_OPTIONS,
      navPosition,
      setNavPosition,
      isBottomNav: navPosition === 'bottom',
      hideTopBar,
      setHideTopBar,
    }),
    [theme, setTheme, toggle, color, setColor, navPosition, setNavPosition, hideTopBar, setHideTopBar],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
