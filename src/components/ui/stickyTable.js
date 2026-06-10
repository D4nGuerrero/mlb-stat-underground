import {
  TABLE_TEXT_CLASS,
  TABLE_PAD,
  TABLE_PAD_SCROLL,
  TABLE_TEAM_COL_CLASS,
  TABLE_TEAM_ABBR_COL_CLASS,
  TABLE_YEAR_COL_CLASS,
  TABLE_DATE_COL_CLASS,
  STICKY_AFTER_COL_1,
  STICKY_AFTER_DATE,
  TABLE_LABEL_COL_CLASS,
  TABLE_PLAYER_COL_CLASS,
  TABLE_LAYOUT_CLASS,
  TABLE_LAYOUT_STANDINGS_CLASS,
} from '../../theme/tableTheme';

/** Shared sticky + compact column styles for horizontally scrollable tables. */
export const STICKY_SHADOW = 'shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]';

export const TABLE_SCROLL = 'overflow-x-auto';
/** border-collapse breaks position:sticky on th/td — use this for pinned columns */
export const TABLE_BASE = 'w-full border-separate border-spacing-0';
/** @deprecated alias */
export const TABLE_BASE_STICKY = TABLE_BASE;

/** Vertical + horizontal scroll for long stat tables */
export const TABLE_SCROLL_BODY = ' overflow-auto -mx-1 rounded-xl border border-slate-800/60 scrollbar-thin';
/** @deprecated use TABLE_TEXT_CLASS from theme/tableTheme.js */
export const TABLE_COMPACT = TABLE_TEXT_CLASS;
export const TABLE_LAYOUT = TABLE_LAYOUT_CLASS;
export const TABLE_LAYOUT_STANDINGS = TABLE_LAYOUT_STANDINGS_CLASS;

function padFor(compact) {
  return compact ? TABLE_PAD : TABLE_PAD_SCROLL;
}

function stickyBase(bg, { left = 'left-0', shadow = true, widthClass, align = 'text-left', compact = true, stickTop = false }) {
  const pad = padFor(compact);
  return [
    'sticky whitespace-nowrap',
    stickTop ? 'top-0 z-40' : 'z-30',
    widthClass,
    pad.stickyX,
    pad.stickyY,
    align,
    TABLE_TEXT_CLASS,
    left,
    bg,
    shadow ? STICKY_SHADOW : '',
  ].filter(Boolean).join(' ');
}

/** Opaque sticky backgrounds — semi-transparent lets scrolled cells bleed through */
const STICKY_CELL_BG = {
  footer: 'bg-[#182030]',
  hover: 'group-hover:bg-[#1a2235]',
};

function stickyCellBase(bg, { left = 'left-0', footer = false, shadow = true, widthClass, compact = true }) {
  const pad = padFor(compact);
  return [
    'sticky z-20 whitespace-nowrap',
    widthClass,
    pad.stickyX,
    pad.stickyY,
    TABLE_TEXT_CLASS,
    left,
    footer ? STICKY_CELL_BG.footer : bg,
    footer ? '' : STICKY_CELL_BG.hover,
    shadow ? STICKY_SHADOW : '',
  ].filter(Boolean).join(' ');
}

/** Sticky team column — wide enough for full names on desktop */
export function stickyTeamHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { ...opts, widthClass: TABLE_TEAM_COL_CLASS });
}

export function stickyTeamCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { ...opts, widthClass: TABLE_TEAM_COL_CLASS });
}

/** Sticky first column (player, date, split label, etc.) */
export function stickyHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { ...opts, widthClass: TABLE_LABEL_COL_CLASS });
}

export function stickyCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { ...opts, widthClass: TABLE_LABEL_COL_CLASS });
}

/** Sticky player column on team roster tables */
export function stickyPlayerHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { ...opts, widthClass: TABLE_PLAYER_COL_CLASS, compact: false });
}

export function stickyPlayerCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { ...opts, widthClass: TABLE_PLAYER_COL_CLASS, compact: false });
}

/** Scroll tables — comfortable padding (player page, team stats, etc.) */
export function scrollStickyHead(bg = 'bg-slate-900', opts = {}) {
  return stickyHead(bg, { ...opts, compact: false });
}

export function scrollStickyCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCell(bg, { ...opts, compact: false });
}

/** Narrow rank/index column pinned before a sticky label column. */
export function stickyRankHead(bg = 'bg-slate-900', opts = {}) {
  const resolved = typeof opts === 'string' ? { left: opts } : opts;
  const { left = 'left-0', stickTop = false } = resolved;
  return [
    'sticky whitespace-nowrap w-7 min-w-[1.75rem] px-1 py-2 text-center',
    TABLE_TEXT_CLASS,
    left,
    bg,
    stickTop ? 'top-0 z-40' : 'z-20',
    stickTop ? STICKY_SHADOW : '',
  ].filter(Boolean).join(' ');
}

export function stickyRankCell(bg = 'bg-slate-900', opts = {}) {
  const resolved = typeof opts === 'string' ? { left: opts } : opts;
  const { left = 'left-0' } = resolved;
  return `sticky z-20 whitespace-nowrap w-7 min-w-[1.75rem] px-1 py-2 text-center ${TABLE_TEXT_CLASS} ${left} ${bg} ${STICKY_CELL_BG.hover}`;
}

/** Sticky team column after a w-6 rank column — offset + team width */
export const STICKY_AFTER_RANK = 'left-7';

export function stickyTeamHeadAfterRank(bg = 'bg-slate-900') {
  return stickyTeamHead(bg, { left: STICKY_AFTER_RANK });
}

export function stickyTeamCellAfterRank(bg = 'bg-slate-900', opts = {}) {
  return stickyTeamCell(bg, { left: STICKY_AFTER_RANK, ...opts });
}

/** Narrow abbr team column after rank — stat leaders, stats center */
export function stickyTeamAbbrHeadAfterRank(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { left: STICKY_AFTER_RANK, widthClass: TABLE_TEAM_ABBR_COL_CLASS, compact: false, ...opts });
}

export function stickyTeamAbbrCellAfterRank(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { left: STICKY_AFTER_RANK, widthClass: TABLE_TEAM_ABBR_COL_CLASS, compact: false, ...opts });
}

/** Year + Team pinned columns (career stats) */
export function scrollStickyYearHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { widthClass: TABLE_YEAR_COL_CLASS, compact: false, ...opts });
}

export function scrollStickyYearCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { widthClass: TABLE_YEAR_COL_CLASS, compact: false, ...opts });
}

export function scrollStickyTeamAbbrHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { left: STICKY_AFTER_COL_1, widthClass: TABLE_TEAM_ABBR_COL_CLASS, compact: false, ...opts });
}

export function scrollStickyTeamAbbrCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { left: STICKY_AFTER_COL_1, widthClass: TABLE_TEAM_ABBR_COL_CLASS, compact: false, ...opts });
}

/** Date + Team pinned columns (game logs) */
export function scrollStickyDateHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { widthClass: TABLE_DATE_COL_CLASS, compact: false, ...opts });
}

export function scrollStickyDateCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { widthClass: TABLE_DATE_COL_CLASS, compact: false, ...opts });
}

export function scrollStickyTeamAfterDateHead(bg = 'bg-slate-900', opts = {}) {
  return stickyBase(bg, { left: STICKY_AFTER_DATE, widthClass: TABLE_TEAM_ABBR_COL_CLASS, compact: false, ...opts });
}

export function scrollStickyTeamAfterDateCell(bg = 'bg-slate-900', opts = {}) {
  return stickyCellBase(bg, { left: STICKY_AFTER_DATE, widthClass: TABLE_TEAM_ABBR_COL_CLASS, compact: false, ...opts });
}

/** Stat/data columns */
export function statHead(className = '', { compact = true, align = 'text-right', stickTop = false, bg = 'bg-[#121827]' } = {}) {
  const pad = padFor(compact);
  const pin = stickTop ? `sticky top-0 z-30 ${bg} shadow-[0_1px_0_0_rgba(51,65,85,0.6)]` : '';
  return `${pad.statX} ${pad.statY} font-medium ${align} whitespace-nowrap ${TABLE_TEXT_CLASS} ${pin} ${className}`.replace(/\s+/g, ' ').trim();
}

export function statCell(className = '', { compact = true, align = 'text-right' } = {}) {
  const pad = padFor(compact);
  const color = className ? '' : 'text-slate-300';
  return `${pad.statX} ${pad.statY} ${align} relative z-0 font-mono tabular-nums leading-tight ${TABLE_TEXT_CLASS} ${color} ${className}`.replace(/\s+/g, ' ').trim();
}

export function scrollStatHead(className = '', opts = {}) {
  return statHead(className, { compact: false, ...opts });
}

export function scrollStatCell(className = '', opts = {}) {
  return statCell(className, { ...opts, compact: false });
}