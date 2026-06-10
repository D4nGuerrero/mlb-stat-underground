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

/** Tight padding — standings (fit ~9 cols on mobile) */
export const TABLE_PAD = {
  statX: 'px-0.5 sm:px-1',
  statY: 'py-1 sm:py-1.5',
  stickyX: 'px-1 sm:px-2',
  stickyY: 'py-1 sm:py-2',
};

/** Comfortable padding — player/team scroll tables */
export const TABLE_PAD_SCROLL = {
  statX: 'px-2',
  statY: 'py-2',
  stickyX: 'px-3',
  stickyY: ' sm:py-1',
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

/** Logo + abbr — stats tables outside standings (always abbreviated) */
export const TABLE_TEAM_ABBR_COL_CLASS = 'w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]';

/** Year/season — 1st pinned col; shrinks/grows to fit badges + label */
export const TABLE_YEAR_COL_CLASS = 'w-px whitespace-nowrap';

/** Date — 1st pinned col (game logs) */
export const TABLE_DATE_COL_CLASS = 'w-[5rem] min-w-[5rem] max-w-[5rem]';

/** 2nd pinned col offset — set via --sticky-col-1-width on the table (see useStickyColOffset) */
export const STICKY_AFTER_COL_1 = 'left-[var(--sticky-col-1-width,4rem)]';

/** Date column is fixed width */
export const STICKY_AFTER_DATE = 'left-20';

/** First column for player names, dates, splits, etc. */
export const TABLE_LABEL_COL = {
  mobile: 'w-px whitespace-nowrap',
  desktop: 'sm:min-w-[7rem] md:min-w-[9rem]',
};

export const TABLE_LABEL_COL_CLASS = [TABLE_LABEL_COL.mobile, TABLE_LABEL_COL.desktop].join(' ');

/** Team roster player column */
export const TABLE_PLAYER_COL_CLASS = 'min-w-[9.25rem] sm:min-w-[10rem] whitespace-nowrap';

/** Default: scroll horizontally instead of crushing columns */
export const TABLE_LAYOUT_CLASS = 'table-auto';

/** Standings only: squeeze stat columns on mobile */
export const TABLE_LAYOUT_STANDINGS_CLASS = 'max-sm:table-fixed sm:table-auto';

/** Min-widths for scroll tables */
export const TABLE_MIN_W = {
  md: 'min-w-[640px]',
  lg: 'min-w-[900px]',
  sm: 'min-w-[520px]',
};