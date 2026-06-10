import { THEME_COLOR } from './theme';

/**
 * Build Tailwind utility classes with the configured palette name.
 * @param {string} [color] — defaults to THEME_COLOR from theme.js
 */
export function tw(color = THEME_COLOR) {
  const u =
    (prefix) =>
    (shade, opacity) => {
      if (opacity === undefined) return `${prefix}-${color}-${shade}`;
      if (typeof opacity === 'string' && opacity.startsWith('[')) {
        return `${prefix}-${color}-${shade}/${opacity}`;
      }
      return `${prefix}-${color}-${shade}/${opacity}`;
    };

  const text = u('text');
  const bg = u('bg');
  const border = u('border');
  const ring = u('ring');
  const from = u('from');

  return {
    text,
    bg,
    border,
    ring,
    from,
    hoverText: (shade) => `hover:text-${color}-${shade}`,
    hoverBg: (shade) => `hover:bg-${color}-${shade}`,
    hoverBorder: (shade) => `hover:border-${color}-${shade}`,
    focusBorder: (shade) => `focus:border-${color}-${shade}`,
  };
}

/** Pre-bound helpers using THEME_COLOR from theme.js */
export const t = tw();