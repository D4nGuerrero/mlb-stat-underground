/**
 * Table typography & column sizing — edit here to experiment.
 *
 * All values must be valid Tailwind classes (JIT needs the full strings).
 *
 * Examples:
 *   TABLE_TEXT.mobile = 'text-[11px]'
 *   TABLE_TEXT.desktop = 'md:text-base'
 *   TABLE_TEAM_COL.desktop = 'sm:min-w-[14rem]'
 */

/** Stat cell / header font sizes (mobile → tablet → desktop) */
export const TABLE_TEXT = {
  mobile: 'text-[12px]',
  tablet: 'sm:text-xs',
  desktop: 'md:text-sm',
};

/** Combined — applied to all table data & headers */
export const TABLE_TEXT_CLASS = [TABLE_TEXT.mobile, TABLE_TEXT.tablet, TABLE_TEXT.desktop].join(' ');

/** Cell padding */
export const TABLE_PAD = {
  statX: 'px-0.5 sm:px-1',
  statY: 'py-1 sm:py-1.5',
  stickyX: 'px-1 sm:px-2',
  stickyY: 'py-1 sm:py-2',
};

/**
 * Team / label column widths.
 * Mobile stays narrow (logo + abbr); desktop grows for full names.
 */
export const TABLE_TEAM_COL = {
  mobile: 'w-[4.25rem] max-w-[4.25rem]',
  desktop: 'sm:w-auto sm:min-w-[10rem] md:min-w-[12rem]',
};

export const TABLE_TEAM_COL_CLASS = [TABLE_TEAM_COL.mobile, TABLE_TEAM_COL.desktop].join(' ');

/** First column for player names, dates, splits, etc. */
export const TABLE_LABEL_COL = {
  mobile: 'w-px',
  desktop: 'sm:min-w-[7rem] md:min-w-[9rem]',
};

export const TABLE_LABEL_COL_CLASS = [TABLE_LABEL_COL.mobile, TABLE_LABEL_COL.desktop].join(' ');

/**
 * table-fixed squeezes columns on mobile; table-auto on desktop lets team col expand.
 */
export const TABLE_LAYOUT_CLASS = 'max-sm:table-fixed sm:table-auto';