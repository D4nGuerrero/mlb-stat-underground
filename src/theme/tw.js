/**
 * Build Tailwind utility classes with a palette name.
 * Prefer static `accent-*` classes so Settings can recolor the whole app via CSS vars.
 * @param {string} [color='accent']
 */
export function tw(color = 'accent') {
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

/** Pre-bound helpers using the runtime accent palette */
export const t = tw('accent');
