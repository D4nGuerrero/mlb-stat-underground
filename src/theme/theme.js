/**
 * App accent palette.
 * Runtime color is applied via CSS variables on <html> (see applyAccentToDocument).
 * Use Tailwind `accent-*` utilities or the variables directly.
 */
export const THEME_STORAGE_KEY = 'mlb-theme-color';

/**
 * Settings accents. `default` = mono (white in dark mode, black in light mode).
 * Blue is a separate color option.
 */
export const THEME_COLOR_OPTIONS = [
  'default',
  'blue',
  'emerald',
  'sky',
  'violet',
  'rose',
  'amber',
  'cyan',
];

/** Built-in default accent (mono). */
export const THEME_COLOR_DEFAULT = 'default';

/** @deprecated Prefer `accent-*` utilities. */
export const THEME_COLOR = THEME_COLOR_DEFAULT;

/** Labels for Settings UI */
export const THEME_COLOR_LABELS = {
  default: 'Default',
  blue: 'Blue',
  emerald: 'Emerald',
  sky: 'Sky',
  violet: 'Violet',
  rose: 'Rose',
  amber: 'Amber',
  cyan: 'Cyan',
};

/** Space-separated RGB for dark mode (brighter / normal). */
export const ACCENT_RGB_DARK = {
  default: {
    200: '203 213 225', // slate-300
    300: '226 232 240', // slate-200
    400: '241 245 249', // slate-100
    500: '255 255 255', // white
    600: '226 232 240',
    950: '15 23 42',
  },
  blue: {
    200: '191 219 254',
    300: '147 197 253',
    400: '96 165 250',
    500: '59 130 246',
    600: '37 99 235',
    950: '23 37 84',
  },
  emerald: {
    200: '167 243 208',
    300: '110 231 183',
    400: '52 211 153',
    500: '16 185 129',
    600: '5 150 105',
    950: '2 44 34',
  },
  sky: {
    200: '186 230 253',
    300: '125 211 252',
    400: '56 189 248',
    500: '14 165 233',
    600: '2 132 199',
    950: '8 47 73',
  },
  violet: {
    200: '221 214 254',
    300: '196 181 253',
    400: '167 139 250',
    500: '139 92 246',
    600: '124 58 237',
    950: '46 16 101',
  },
  rose: {
    200: '254 205 211',
    300: '253 164 175',
    400: '251 113 133',
    500: '244 63 94',
    600: '225 29 72',
    950: '76 5 25',
  },
  amber: {
    200: '253 230 138',
    300: '252 211 77',
    400: '251 191 36',
    500: '245 158 11',
    600: '217 119 6',
    950: '69 26 3',
  },
  cyan: {
    200: '165 243 252',
    300: '103 232 249',
    400: '34 211 238',
    500: '6 182 212',
    600: '8 145 178',
    950: '8 51 68',
  },
};

/**
 * Darker accents for light mode (better contrast on pale surfaces).
 * `default` is near-black.
 */
export const ACCENT_RGB_LIGHT = {
  default: {
    200: '100 116 139', // slate-500
    300: '71 85 105', // slate-600
    400: '51 65 85', // slate-700
    500: '15 23 42', // slate-900
    600: '2 6 23', // slate-950
    950: '2 6 23',
  },
  blue: {
    200: '96 165 250',
    300: '59 130 246',
    400: '37 99 235',
    500: '29 78 216', // blue-700
    600: '30 64 175', // blue-800
    950: '23 37 84',
  },
  emerald: {
    200: '52 211 153',
    300: '16 185 129',
    400: '5 150 105',
    500: '4 120 87', // emerald-700
    600: '6 95 70', // emerald-800
    950: '2 44 34',
  },
  sky: {
    200: '56 189 248',
    300: '14 165 233',
    400: '2 132 199',
    500: '3 105 161', // sky-700
    600: '7 89 133', // sky-800
    950: '8 47 73',
  },
  violet: {
    200: '167 139 250',
    300: '139 92 246',
    400: '124 58 237',
    500: '109 40 217', // violet-700
    600: '91 33 182', // violet-800
    950: '46 16 101',
  },
  rose: {
    200: '251 113 133',
    300: '244 63 94',
    400: '225 29 72',
    500: '190 18 60', // rose-700
    600: '159 18 57', // rose-800
    950: '76 5 25',
  },
  amber: {
    200: '251 191 36',
    300: '245 158 11',
    400: '217 119 6',
    500: '180 83 9', // amber-700
    600: '146 64 14', // amber-800
    950: '69 26 3',
  },
  cyan: {
    200: '34 211 238',
    300: '6 182 212',
    400: '8 145 178',
    500: '14 116 144', // cyan-700
    600: '21 94 117', // cyan-800
    950: '8 51 68',
  },
};

/** Hex companions for channel palettes. */
function channelsToHexPalette(channels) {
  const out = {};
  for (const [shade, rgb] of Object.entries(channels)) {
    const [r, g, b] = rgb.split(/\s+/).map(Number);
    out[shade] = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  return out;
}

export const ACCENT_HEX_DARK = Object.fromEntries(
  Object.entries(ACCENT_RGB_DARK).map(([k, v]) => [k, channelsToHexPalette(v)]),
);
export const ACCENT_HEX_LIGHT = Object.fromEntries(
  Object.entries(ACCENT_RGB_LIGHT).map(([k, v]) => [k, channelsToHexPalette(v)]),
);

/** @deprecated use ACCENT_RGB_DARK */
export const ACCENT_RGB = ACCENT_RGB_DARK;
/** @deprecated use ACCENT_HEX_DARK */
export const ACCENT_HEX = ACCENT_HEX_DARK;

export function getStoredThemeColor() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    // Migrate old “blue = default” installs: keep blue as blue; only empty → default.
    if (THEME_COLOR_OPTIONS.includes(saved)) return saved;
    return THEME_COLOR_DEFAULT;
  } catch {
    return THEME_COLOR_DEFAULT;
  }
}

export function setStoredThemeColor(color) {
  if (!THEME_COLOR_OPTIONS.includes(color)) return getStoredThemeColor();
  try {
    localStorage.setItem(THEME_STORAGE_KEY, color);
  } catch {
    /* ignore */
  }
  return color;
}

function resolveIsDark(isDark) {
  if (typeof isDark === 'boolean') return isDark;
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.theme !== 'light'
    && !document.body?.classList?.contains('theme-light');
}

/**
 * Apply accent to the document (data attr + CSS vars).
 * @param {string} [color]
 * @param {boolean} [isDark] — appearance mode; mono default + light accents depend on this
 */
export function applyAccentToDocument(color = getStoredThemeColor(), isDark) {
  if (typeof document === 'undefined') return color;
  const resolved = THEME_COLOR_OPTIONS.includes(color) ? color : THEME_COLOR_DEFAULT;
  const dark = resolveIsDark(isDark);
  const root = document.documentElement;
  const table = dark ? ACCENT_RGB_DARK : ACCENT_RGB_LIGHT;
  const hexTable = dark ? ACCENT_HEX_DARK : ACCENT_HEX_LIGHT;
  const channels = table[resolved] ?? table[THEME_COLOR_DEFAULT];
  const hexes = hexTable[resolved] ?? hexTable[THEME_COLOR_DEFAULT];

  root.dataset.themeColor = resolved;
  root.setAttribute('data-theme-color', resolved);
  root.dataset.accentMode = dark ? 'dark' : 'light';

  for (const shade of Object.keys(channels)) {
    root.style.setProperty(`--accent-${shade}`, channels[shade]);
    root.style.setProperty(`--accent-${shade}-hex`, hexes[shade]);
  }

  root.style.setProperty('--accent', hexes[500]);
  root.style.setProperty('--accent-soft', hexes[400]);
  root.style.setProperty('--accent-strong', hexes[600]);

  return resolved;
}
