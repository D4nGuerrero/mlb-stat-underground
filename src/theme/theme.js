/**
 * App accent palette — any Tailwind color name (emerald, blue, sky, violet, …).
 *
 * Use in JSX:  className={`text-${THEME_COLOR}-500`}
 * Tailwind safelist in tailwind.config.js includes supported palettes.
 */
export const THEME_STORAGE_KEY = 'mlb-theme-color';

/** Supported palettes for runtime switching (must match tailwind safelist). */
export const THEME_COLOR_OPTIONS = ['emerald', 'blue'];

/** Default / build-time palette — change this to switch the app accent. */
export const THEME_COLOR = 'blue';

export function getStoredThemeColor() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_COLOR_OPTIONS.includes(saved) ? saved : THEME_COLOR;
  } catch {
    return THEME_COLOR;
  }
}

export function setStoredThemeColor(color) {
  if (!THEME_COLOR_OPTIONS.includes(color)) return THEME_COLOR;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, color);
  } catch {
    /* ignore */
  }
  return color;
}