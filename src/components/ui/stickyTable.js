import {
  TABLE_TEXT_CLASS,
  TABLE_PAD,
  TABLE_TEAM_COL_CLASS,
  TABLE_LABEL_COL_CLASS,
  TABLE_LAYOUT_CLASS,
} from '../../theme/tableTheme';

/** Shared sticky + compact column styles for horizontally scrollable tables. */
export const STICKY_SHADOW = 'shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]';

export const TABLE_SCROLL = 'overflow-x-auto';
export const TABLE_BASE = 'w-full border-collapse';
/** @deprecated use TABLE_TEXT_CLASS from theme/tableTheme.js */
export const TABLE_COMPACT = TABLE_TEXT_CLASS;
export const TABLE_LAYOUT = TABLE_LAYOUT_CLASS;

function stickyBase(bg, { left = 'left-0', shadow = true, widthClass, align = 'text-left' }) {
  return [
    'sticky z-20 whitespace-nowrap',
    widthClass,
    TABLE_PAD.stickyX,
    TABLE_PAD.stickyY,
    align,
    TABLE_TEXT_CLASS,
    left,
    bg,
    shadow ? STICKY_SHADOW : '',
  ].filter(Boolean).join(' ');
}

function stickyCellBase(bg, { left = 'left-0', footer = false, shadow = true, widthClass }) {
  return [
    'sticky z-10 whitespace-nowrap',
    widthClass,
    TABLE_PAD.stickyX,
    TABLE_PAD.stickyY,
    TABLE_TEXT_CLASS,
    left,
    footer ? 'bg-slate-800/30' : bg,
    footer ? '' : 'group-hover:bg-slate-800/20',
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

/** Narrow rank/index column pinned before a sticky label column. */
export function stickyRankHead(bg = 'bg-slate-900', left = 'left-0') {
  return `sticky z-20 whitespace-nowrap w-6 min-w-[1.5rem] px-0.5 py-1 text-center ${TABLE_TEXT_CLASS} ${left} ${bg}`;
}

export function stickyRankCell(bg = 'bg-slate-900', left = 'left-0') {
  return `sticky z-10 whitespace-nowrap w-6 min-w-[1.5rem] px-0.5 py-1 text-center ${TABLE_TEXT_CLASS} ${left} ${bg} group-hover:bg-slate-800/20`;
}

/** Sticky team column after a w-6 rank column — offset + team width */
export const STICKY_AFTER_RANK = 'left-6';

export function stickyTeamHeadAfterRank(bg = 'bg-slate-900') {
  return stickyTeamHead(bg, { left: STICKY_AFTER_RANK });
}

export function stickyTeamCellAfterRank(bg = 'bg-slate-900', opts = {}) {
  return stickyTeamCell(bg, { left: STICKY_AFTER_RANK, ...opts });
}

/** Stat/data columns */
export function statHead(className = '') {
  return `${TABLE_PAD.statX} ${TABLE_PAD.statY} font-medium text-right whitespace-nowrap ${TABLE_TEXT_CLASS} ${className}`;
}

export function statCell(className = '') {
  return `${TABLE_PAD.statX} ${TABLE_PAD.statY} text-right font-mono tabular-nums leading-tight ${TABLE_TEXT_CLASS} text-slate-300 ${className}`;
}