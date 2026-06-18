import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, useLocation, useNavigationType, Link } from 'react-router-dom';
import { playerHeadshotUrl, teamLogoUrl, playerHeroShotUrl, getTeamAbbr, spotracPlayerUrl } from '../utils/mlbHelpers';
import TeamAbbrCell from '../components/TeamAbbrCell';
import TeamLogoImg from '../components/TeamLogoImg';
import { buildSeasonHonors, getActiveHonorBadges } from '../utils/seasonHonors';
import { fetchPlayerSplitSections, SPLIT_DISPLAY_COLS } from '../utils/playerSplits';
import { computeCareerTotalsRow, computeSeasonTotalsRow } from '../utils/careerTotals';
import SeasonYearLabel from '../components/SeasonYearLabel';
import { useWatchlist } from '../hooks/useWatchlist';
import { fetchStatsApiJson } from '../lib/mlb/client';
import {
  SegmentedControl,
  Select,
  TabBar,
  Modal,
  scrollStickyYearHead,
  scrollStickyYearCell,
  scrollStickyTeamAbbrHead,
  scrollStickyTeamAbbrCell,
  scrollStickyHead,
  scrollStickyCell,
  scrollStatHead,
  scrollStatCell,
  TABLE_SCROLL_BODY,
  TABLE_BASE,
  useStickyColOffset,
  stickyCol1Props,
  LoadingSpinner,
} from '../components/ui';
import { TABLE_TEXT_CLASS, TABLE_MIN_W, TABLE_YEAR_COL_CLASS } from '../theme/tableTheme';

const CURRENT_YEAR = new Date().getFullYear();

const playerViewStateCache = new Map();
const TXN_SHEET_RETURN_PREFIX = 'playerTxnSheetReturn:';

function transactionRestoreKey(txn) {
  if (!txn) return null;
  return [
    txn.id,
    txn.date,
    txn.typeCode ?? txn.typeDesc,
    txn.fromTeam?.id,
    txn.toTeam?.id,
    txn.person?.id,
  ]
    .filter((part) => part != null && part !== '')
    .join('|');
}

function playerTxnSheetReturnKey(playerId) {
  return `${TXN_SHEET_RETURN_PREFIX}${playerId}`;
}

function readTxnSheetReturn(playerId) {
  if (typeof window === 'undefined' || !playerId) return null;

  try {
    const raw = window.sessionStorage.getItem(playerTxnSheetReturnKey(playerId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTxnSheetReturn(playerId, txn, yearsBack) {
  if (typeof window === 'undefined' || !playerId || !txn) return;

  try {
    window.sessionStorage.setItem(
      playerTxnSheetReturnKey(playerId),
      JSON.stringify({
        txnKey: transactionRestoreKey(txn),
        txn,
        yearsBack,
        scrollY: window.scrollY,
      }),
    );
  } catch {
    // If storage is unavailable, navigation still works; we just skip sheet restoration.
  }
}

function clearTxnSheetReturn(playerId) {
  if (typeof window === 'undefined' || !playerId) return;

  try {
    window.sessionStorage.removeItem(playerTxnSheetReturnKey(playerId));
  } catch {
    // No-op: storage can be blocked in private browsing modes.
  }
}

function isPitcherPosition(abbreviation) {
  return abbreviation === 'P' || abbreviation === 'SP' || abbreviation === 'RP';
}

function freshPlayerViewState() {
  return {
    activeTab: 'career',
    careerLevel: 'mlb',
    careerGroup: 'hitting',
    careerGameType: 'R',
    logLevel: 'mlb',
    logGroup: 'hitting',
    logSeason: CURRENT_YEAR,
    splitLevel: 'mlb',
    splitSeason: CURRENT_YEAR,
  };
}

function initialPlayerViewState(locationKey, navigationType) {
  if (navigationType === 'POP') {
    return playerViewStateCache.get(locationKey) ?? freshPlayerViewState();
  }
  return freshPlayerViewState();
}

const SEASON_OPTIONS = Array.from({ length: 8 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: y, label: String(y) };
});

const PERIOD_OPTIONS = [
  { value: 'regular', label: 'Regular Season', gameType: 'R', statsType: 'season' },
  { value: 'last10', label: 'Last 10 Games', gameType: 'R', statsType: 'lastXGames', limit: 10 },
  { value: 'last30', label: 'Last 30 Games', gameType: 'R', statsType: 'lastXGames', limit: 30 },
  { value: 'spring', label: 'Spring Training', gameType: 'S', statsType: 'season' },
  { value: 'postseason', label: 'Postseason Cumulative', gameType: 'P', statsType: 'season' },
];

const CAREER_GAME_TYPE_OPTIONS = [
  { value: 'A', label: 'All-Star Game' },
  { value: 'R', label: 'Regular Season' },
  { value: 'F', label: 'Wild Card' },
  { value: 'D', label: 'Division Series' },
  { value: 'L', label: 'League Championship Series' },
  { value: 'W', label: 'World Series' },
  { value: 'S', label: 'Spring Training' },
  { value: 'P', label: 'Postseason Cumulative' },
];

const MINOR_SPORT_IDS = [11, 12, 13, 14,16];

const LOWER_IS_BETTER = new Set(['era', 'whip', 'losses', 'errors']);

const HERO_TEXT_SHADOW = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' };

function mapPlayerToWatchEntry(player) {
  const imageOptions = isMinorsPlayerProfile(player) ? { level: 'minors' } : undefined;
  return {
    id: player.id,
    fullName: player.fullName,
    team: player.currentTeam?.name ?? '—',
    teamId: player.currentTeam?.id,
    position: player.primaryPosition?.abbreviation ?? '',
    headshot: playerHeadshotUrl(player.id, imageOptions),
    active: player.active,
  };
}

function PlayerHeroActions({ player, playerId, watchlist, onToggleWatch, watchAnimating }) {
  const isWatched = watchlist.some((p) => p.id === Number(playerId));
  const parentOrgId = player?.active !== false ? player?.currentTeam?.parentOrgId : null;

  return (
    <div className="absolute bottom-4 right-5 sm:bottom-6 sm:right-8 z-30 flex items-center gap-2">
      {parentOrgId && (
        <Link
          to={`/team/${parentOrgId}`}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-white/20 backdrop-blur-sm hover:border-white/40 transition-all"
          title="MLB affiliate"
        >
          <img
            src={teamLogoUrl(parentOrgId)}
            alt=""
            className="w-5 h-5 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </Link>
      )}
      <button
        type="button"
        onClick={onToggleWatch}
        aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        title={isWatched ? 'Unwatch player' : 'Watch player'}
        className={[
          'w-9 h-9 flex items-center justify-center rounded-full border backdrop-blur-sm transition-all active:scale-95',
          watchAnimating ? 'watch-pop' : '',
          isWatched
            ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/35'
            : 'bg-black/40 border-white/20 text-white/80 hover:text-white hover:border-white/40',
        ].join(' ')}
      >
        <i className={`fa-solid ${isWatched ? 'fa-eye' : 'fa-eye-slash'} text-sm`} aria-hidden />
      </button>
    </div>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const hitCols = [
 { key: 'team', label: 'Team', format: 'team' },
  { key: 'gamesPlayed', label: 'G' },
  { key: 'atBats', label: 'AB' },
  { key: 'runs', label: 'R' },
  { key: 'hits', label: 'H' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'strikeOuts', label: 'SO' },
  { key: 'stolenBases', label: 'SB' },
  { key: 'avg', label: 'AVG' },
  { key: 'obp', label: 'OBP' },
  { key: 'slg', label: 'SLG' },
  { key: 'ops', label: 'OPS' },
];

const pitchCols = [
  { key: 'team', label: 'Team', format: 'team' },
  { key: 'gamesPlayed', label: 'G' },
  { key: 'gamesStarted', label: 'GS' },
  { key: 'wins', label: 'W' },
  { key: 'losses', label: 'L' },
  { key: 'inningsPitched', label: 'IP' },

  { key: 'era', label: 'ERA' },
  { key: 'whip', label: 'WHIP' },
  { key: 'strikeOuts', label: 'K' },
  { key: 'baseOnBalls', label: 'BB' },

  { key: 'hits', label: 'H' },
  { key: 'runs', label: 'R' },
  { key: 'earnedRuns', label: 'ER' },
  { key: 'saves', label: 'SV' },

  { key: 'homeRuns', label: 'HR' },
];

const fieldCols = [
  { key: 'gamesPlayed', label: 'G' },
  { key: 'gamesStarted', label: 'GS' },
  { key: 'putOuts', label: 'PO' },
  { key: 'assists', label: 'A' },
  { key: 'errors', label: 'E' },
  { key: 'chances', label: 'TC' },
  { key: 'fielding', label: 'FPCT' },
  { key: 'rangeFactorPerGame', label: 'RF' },
];

const gameLogHitCols = [
  { key: 'date', label: 'Date', format: 'date' },
  { key: 'opponent', label: 'OPP', format: 'opponent' },
  { key: 'atBats', label: 'AB' },
  { key: 'runs', label: 'R' },
  { key: 'hits', label: 'H' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'hitByPitch', label: 'HBP' },
  { key: 'strikeOuts', label: 'SO' },
  { key: 'stolenBases', label: 'SB' },
  { key: 'caughtStealing', label: 'CS' },
  { key: 'avg', label: 'AVG' },
  { key: 'obp', label: 'OBP' },
  { key: 'slg', label: 'SLG' },
  { key: 'ops', label: 'OPS' },
];

const gameLogPitchCols = [
  { key: 'date', label: 'Date', format: 'date' },
  { key: 'opponent', label: 'OPP', format: 'opponent' },
  { key: 'inningsPitched', label: 'IP' },
  { key: 'hits', label: 'H' },
  { key: 'runs', label: 'R' },
  { key: 'earnedRuns', label: 'ER' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'strikeOuts', label: 'K' },
  { key: 'groundOuts', label: 'GB' },
  { key: 'flyOuts', label: 'FB' },
  { key: 'numberOfPitches', label: 'P' },
  { key: 'battersFaced', label: 'TBF' },
  { key: 'gameScore', label: 'GSC', format: 'gameScore' },
  { key: 'decision', label: 'DEC', format: 'decision' },
  { key: 'relief', label: 'REL', format: 'relief' },
  { key: 'era', label: 'ERA' },
];

const GAME_LOG_HIT_GLOSSARY = [
  { key: 'AB', text: 'At bats' },
  { key: 'R', text: 'Runs scored' },
  { key: 'H', text: 'Hits' },
  { key: '2B', text: 'Doubles' },
  { key: '3B', text: 'Triples' },
  { key: 'HR', text: 'Home runs' },
  { key: 'RBI', text: 'Runs batted in' },
  { key: 'BB', text: 'Walks' },
  { key: 'HBP', text: 'Hit by pitch' },
  { key: 'SO', text: 'Strikeouts' },
  { key: 'SB', text: 'Stolen bases' },
  { key: 'CS', text: 'Caught stealing' },
  { key: 'AVG', text: 'Batting average' },
  { key: 'OBP', text: 'On-base percentage' },
  { key: 'SLG', text: 'Slugging percentage' },
  { key: 'OPS', text: 'On-base plus slugging' },
];

const GAME_LOG_PITCH_GLOSSARY = [
  { key: 'IP', text: 'Innings pitched' },
  { key: 'H', text: 'Hits allowed' },
  { key: 'R', text: 'Runs allowed' },
  { key: 'ER', text: 'Earned runs' },
  { key: 'HR', text: 'Home runs allowed' },
  { key: 'BB', text: 'Walks' },
  { key: 'K', text: 'Strikeouts' },
  { key: 'GB', text: 'Ground-ball outs' },
  { key: 'FB', text: 'Fly-ball outs' },
  { key: 'P', text: 'Pitches thrown' },
  { key: 'TBF', text: 'Batters faced' },
  { key: 'GSC', text: 'Game score (Bill James)' },
  { key: 'DEC', text: 'Decision (W/L/S)' },
  { key: 'REL', text: 'Relief appearance' },
  { key: 'ERA', text: 'Earned run average' },
];

function formatBornWithAge(playerInfo) {
  if (!playerInfo?.birthDate) return '—';
  const formatted = new Date(playerInfo.birthDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (playerInfo.currentAge != null) {
    return `${formatted} (${playerInfo.currentAge})`;
  }
  const born = new Date(playerInfo.birthDate);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return `${formatted} (${age})`;
}

function getRosterStatusMeta({ code, description, player } = {}) {
  const normalizedCode = String(code || '').toUpperCase();
  const normalizedDescription = String(description || '');
  const isRetired = normalizedCode === 'RET' || player?.active === false;
  const isDeceased = normalizedCode === 'D' || /deceased|death/i.test(normalizedDescription);
  const isInjured =
    /^D\d+/.test(normalizedCode) ||
    ['7', '10', '15', '60', 'IL', 'INJ'].includes(normalizedCode) ||
    /injur|disabled|il\b|day injured|60-day|10-day|7-day/i.test(normalizedDescription);
  const isLongTermInjured = normalizedCode === 'D60' || normalizedCode === '60' || /60-day/i.test(normalizedDescription);

  if (isDeceased) {
    return {
      label: 'Deceased',
      className: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
      icon: 'rip',
      showDate: false,
    };
  }

  if (isRetired) {
    return {
      label: 'Retired',
      className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      icon: 'retired',
      showDate: false,
    };
  }

  if (normalizedCode === 'A') {
    return {
      label: normalizedDescription || 'Active',
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      icon: 'active',
      showDate: false,
    };
  }

  if (isInjured) {
    return {
      label: normalizedDescription || 'Injured List',
      className: 'bg-red-500/15 text-red-300 border-red-500/30',
      icon: isLongTermInjured ? 'injured' : 'injured_short',
      showDate: true,
    };
  }

  if (/suspend|restricted|inactive/i.test(normalizedDescription)) {
    return {
      label: normalizedDescription || normalizedCode || 'Inactive',
      className: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
      icon: 'restricted',
      showDate: true,
    };
  }

  return {
    label: normalizedDescription || normalizedCode || 'Status Unknown',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: 'info',
    showDate: true,
  };
}

function RosterStatusIcon({ type }) {
  if (type === 'rip') {
    return <i className="fa-solid fa-cross text-[10px]" aria-hidden />;
  }

  if (type === 'injured') {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center shadow-sm" aria-hidden>
        <i className="fa-solid fa-plus text-[8px] text-red-600" />
      </span>
    );
  }

  if (type === 'injured_short') {
    return <i className="fa-solid fa-bandage text-[10px]" aria-hidden />;
  }

  const iconByType = {
    active: 'fa-circle-check',
    retired: 'fa-flag-checkered',
    restricted: 'fa-ban',
    info: 'fa-circle-info',
  };

  return <i className={`fa-solid ${iconByType[type] ?? iconByType.info} text-[10px]`} aria-hidden />;
}

function isActiveOnMinorsTeam(player) {
  if (!player) return false;
  const rosterEntry = player.rosterEntries?.find((e) => e.isActive) ?? player.rosterEntries?.[0];
  if (rosterEntry?.status?.code !== 'A') return false;
  return Boolean(player.currentTeam?.parentOrgId);
}

function hasRetiredStatusCode(player) {
  return (player?.rosterEntries ?? []).some((entry) => entry?.status?.code === 'RET');
}

function shouldUseMostPlayedTeam(player) {
  return player?.active === false && !hasRetiredStatusCode(player);
}

function isMinorsPlayerProfile(player) {
  // Retired/inactive profiles can still carry a MiLB currentTeam from the API.
  // For those players, MLB's regular photo archive is usually more complete.
  return player?.active !== false && Boolean(player?.currentTeam?.parentOrgId);
}

function defaultStatsLevelForPlayer(player) {
  return isActiveOnMinorsTeam(player) ? 'minors' : 'mlb';
}

function PlayerRosterStatus({ rosterEntries, player }) {
  const entry = rosterEntries?.find((e) => e.isActive) ?? rosterEntries?.[0];
  const contractUrl = spotracPlayerUrl(player);
  const hasStatus = Boolean(entry?.status);
  const shouldShowInactiveStatus = player?.active === false;

  if (!hasStatus && !shouldShowInactiveStatus && !contractUrl) return null;

  const { code, description } = entry?.status ?? {};
  const statusMeta = hasStatus || shouldShowInactiveStatus
    ? getRosterStatusMeta({ code, description, player })
    : null;
  const badgeCls = statusMeta?.className ?? '';
  const statusDate = entry?.statusDate
    ? new Date(entry.statusDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="px-5 sm:px-8 py-3 border-b border-slate-700/50 flex items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 min-w-0">
        {statusMeta ? (
          <>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Status</div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeCls}`}>
              <RosterStatusIcon type={statusMeta.icon} />
              {statusMeta.label}
            </span>
            {statusDate && statusMeta.showDate && (
              <span className="text-xs text-slate-500">since {statusDate}</span>
            )}
          </>
        ) : (
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">Status</div>
        )}
      </div>
      {contractUrl && (
        <a
          href={contractUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View contract on Spotrac"
          aria-label="View contract on Spotrac"
          className="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 transition-all"
        >
          <i className="fa-solid fa-dollar-sign text-sm" aria-hidden />
        </a>
      )}
    </div>
  );
}

function parseStatValue(value) {
  if (value == null || value === '—' || value === '-.--') return null;
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function computeCareerHighs(rows, cols) {
  const highs = {};
  for (const col of cols) {
    const nums = rows
      .map((row) => parseStatValue(row[col.key] ?? row.stat?.[col.key]))
      .filter((n) => n != null);
    if (!nums.length) continue;
    highs[col.key] = LOWER_IS_BETTER.has(col.key) ? Math.min(...nums) : Math.max(...nums);
  }
  return highs;
}

function isCareerHigh(colKey, value, highs) {
  const num = parseStatValue(value);
  return num != null && highs[colKey] != null && num === highs[colKey];
}

const LABEL_SORT_KEY = '__label__';

function isSeasonTotalRow(row) {
  return Boolean(row?.isSeasonTotal) || !row?.team?.id;
}

function getMostPlayedTeam(rows) {
  const teams = new Map();

  for (const row of rows ?? []) {
    const team = row?.team;
    if (!team?.id || isSeasonTotalRow(row)) continue;
    const games = Number(row.stat?.gamesPlayed ?? row.stat?.games ?? 0);
    const prev = teams.get(team.id) ?? { team, games: 0, seasons: new Set() };
    prev.games += Number.isFinite(games) ? games : 0;
    if (row.season) prev.seasons.add(row.season);
    teams.set(team.id, prev);
  }

  return [...teams.values()]
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.seasons.size - a.seasons.size;
    })[0]?.team ?? null;
}

function compareSeasonRows(a, b, sortDir) {
  const seasonCmp = (Number(a.season) || 0) - (Number(b.season) || 0);
  if (seasonCmp !== 0) return sortDir === 'asc' ? seasonCmp : -seasonCmp;

  const aTotal = isSeasonTotalRow(a);
  const bTotal = isSeasonTotalRow(b);
  if (aTotal !== bTotal) {
    if (sortDir === 'asc') return aTotal ? 1 : -1;
    return aTotal ? -1 : 1;
  }
  if (aTotal) {
    const aCombined = Boolean(a.isCombinedSeasonTotal);
    const bCombined = Boolean(b.isCombinedSeasonTotal);
    if (aCombined !== bCombined) {
      if (sortDir === 'asc') return aCombined ? 1 : -1;
      return aCombined ? -1 : 1;
    }
    return 0;
  }

  // MLB API returns stints in chronological order within a season
  const stintCmp = (a.stintOrder ?? 0) - (b.stintOrder ?? 0);
  return sortDir === 'asc' ? stintCmp : -stintCmp;
}

function cellSortValue(key, row, col) {
  if (key === LABEL_SORT_KEY) {
    if (row.season != null) return Number(row.season) || 0;
    if (typeof row.label === 'string') return parseFloat(row.label) || 0;
    return 0;
  }
  const format = col?.format;
  if (format === 'date' && row.date) return new Date(`${row.date}T12:00:00`).getTime();
  if (format === 'team') return isSeasonTotalRow(row) ? 'Total' : getTeamAbbr(row.team);
  if (format === 'opponent') {
    const abbr = getTeamAbbr(row.opponent);
    if (abbr === '—') return '';
    return row.isHome ? `vs ${abbr}` : `@ ${abbr}`;
  }
  const value = row[key] ?? row.stat?.[key];
  if (format === 'text') return String(value ?? '');
  const n = parseStatValue(value);
  if (n != null) return n;
  return parseFloat(value) || 0;
}

function comparePlayerRows(a, b, sortCol, sortDir, col) {
  if (sortCol === LABEL_SORT_KEY && (a.season != null || b.season != null)) {
    return compareSeasonRows(a, b, sortDir);
  }

  const av = cellSortValue(sortCol, a, col);
  const bv = cellSortValue(sortCol, b, col);
  let cmp;
  if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
  else cmp = (Number(av) || 0) - (Number(bv) || 0);
  return sortDir === 'asc' ? cmp : -cmp;
}

function useTableSort(defaultCol, defaultDir = 'desc') {
  const [sortCol, setSortCol] = useState(defaultCol);
  const [sortDir, setSortDir] = useState(defaultDir);
  const handleSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(key);
      setSortDir(defaultDir);
    }
  };
  const sortMark = (key) => (sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '');
  const sortActive = (key) => (sortCol === key ? `text-${THEME_COLOR}-400` : '');
  return { sortCol, sortDir, handleSort, sortMark, sortActive };
}

function injectMinorsSeasonTotals(rows, group, renderLabel) {
  const stintsBySeason = new Map();

  for (const row of rows) {
    if (isSeasonTotalRow(row)) continue;
    const season = row.season;
    if (!stintsBySeason.has(season)) stintsBySeason.set(season, []);
    stintsBySeason.get(season).push(row);
  }

  const extraRows = [];

  for (const [season, stints] of stintsBySeason) {
    if (stints.length < 2) continue;

    const hasCombinedTotal = rows.some(
      (row) => row.season === season && isSeasonTotalRow(row) && !row.minorsLevel,
    );
    if (hasCombinedTotal) continue;

    const totalRow = computeSeasonTotalsRow(stints, group, season);
    if (!totalRow) continue;

    extraRows.push({
      ...totalRow,
      label: renderLabel(season),
    });
  }

  if (!extraRows.length) return rows;

  return [...rows, ...extraRows].sort((a, b) => compareSeasonRows(a, b, 'desc'));
}

function mergeMinorLeagueStats(responses) {
  const mergedByKey = new Map();

  for (const data of responses) {
    for (const stat of data.stats ?? []) {
      const key = `${stat.type?.displayName ?? ''}|${stat.group?.displayName ?? ''}`;
      const existing = mergedByKey.get(key);
      if (existing) {
        existing.splits = [...(existing.splits ?? []), ...(stat.splits ?? [])];
      } else {
        mergedByKey.set(key, { ...stat, splits: [...(stat.splits ?? [])] });
      }
    }
  }

  return { stats: [...mergedByKey.values()] };
}

function ipToOuts(ip) {
  if (ip == null || ip === '') return 0;
  const [whole, frac = '0'] = String(ip).split('.');
  return parseInt(whole, 10) * 3 + parseInt(frac, 10);
}

function outsToIp(outs) {
  const whole = Math.floor(outs / 3);
  const frac = outs % 3;
  return frac === 0 ? String(whole) : `${whole}.${frac}`;
}

function getGameLogStat(row) {
  return row.stat ?? row;
}

function sumGameLogField(rows, key) {
  return rows.reduce((acc, row) => acc + (Number(getGameLogStat(row)[key]) || 0), 0);
}

function computePitcherGameScore(stat) {
  if (!stat) return null;
  const outs = ipToOuts(stat.inningsPitched);
  const innings = Math.floor(outs / 3);
  const uer = (Number(stat.runs) || 0) - (Number(stat.earnedRuns) || 0);
  return Math.round(
    40 + outs + 2 * Math.max(0, innings - 4)
    + (Number(stat.strikeOuts) || 0)
    - 2 * (Number(stat.hits) || 0)
    - 4 * (Number(stat.earnedRuns) || 0)
    - 2 * uer
    - (Number(stat.baseOnBalls) || 0)
    - (Number(stat.hitBatsmen) || 0),
  );
}

function formatPitcherDecision(stat) {
  if (!stat) return '—';
  if (stat.wins === 1) return 'W';
  if (stat.losses === 1) return 'L';
  if (stat.saves === 1) return 'S';
  return '—';
}

function formatPitcherRelief(stat) {
  if (!stat) return '—';
  if (stat.gamesStarted === 1) return '—';
  if ((stat.gamesPlayed ?? 0) > 0) return '✓';
  return '—';
}

function computeGameLogMonthTotals(rows, group) {
  if (!rows.length) return null;

  if (group === 'pitching') {
    const totals = {
      hits: sumGameLogField(rows, 'hits'),
      runs: sumGameLogField(rows, 'runs'),
      earnedRuns: sumGameLogField(rows, 'earnedRuns'),
      homeRuns: sumGameLogField(rows, 'homeRuns'),
      baseOnBalls: sumGameLogField(rows, 'baseOnBalls'),
      strikeOuts: sumGameLogField(rows, 'strikeOuts'),
      groundOuts: sumGameLogField(rows, 'groundOuts'),
      flyOuts: sumGameLogField(rows, 'flyOuts'),
      numberOfPitches: sumGameLogField(rows, 'numberOfPitches'),
      battersFaced: sumGameLogField(rows, 'battersFaced'),
    };
    const totalOuts = rows.reduce((acc, row) => acc + ipToOuts(getGameLogStat(row).inningsPitched), 0);
    const ip = outsToIp(totalOuts);
    const ipFloat = totalOuts / 3;
    totals.inningsPitched = ip;
    totals.era = ipFloat > 0 ? ((totals.earnedRuns * 9) / ipFloat).toFixed(2) : '0.00';
    return totals;
  }

  const totals = {
    atBats: sumGameLogField(rows, 'atBats'),
    runs: sumGameLogField(rows, 'runs'),
    hits: sumGameLogField(rows, 'hits'),
    doubles: sumGameLogField(rows, 'doubles'),
    triples: sumGameLogField(rows, 'triples'),
    homeRuns: sumGameLogField(rows, 'homeRuns'),
    rbi: sumGameLogField(rows, 'rbi'),
    baseOnBalls: sumGameLogField(rows, 'baseOnBalls'),
    strikeOuts: sumGameLogField(rows, 'strikeOuts'),
    stolenBases: sumGameLogField(rows, 'stolenBases'),
    caughtStealing: sumGameLogField(rows, 'caughtStealing'),
    hitByPitch: sumGameLogField(rows, 'hitByPitch'),
  };

  const ab = totals.atBats;
  const h = totals.hits;
  const bb = totals.baseOnBalls;
  const hbp = totals.hitByPitch;
  const sf = sumGameLogField(rows, 'sacFlies');
  const singles = h - totals.doubles - totals.triples - totals.homeRuns;
  const obpDenom = ab + bb + hbp + sf;
  const obpNum = obpDenom > 0 ? (h + bb + hbp) / obpDenom : 0;
  const slgNum = ab > 0
    ? (singles + 2 * totals.doubles + 3 * totals.triples + 4 * totals.homeRuns) / ab
    : 0;

  totals.avg = ab > 0 ? (h / ab).toFixed(3).replace(/^0/, '') : '.000';
  totals.obp = obpDenom > 0 ? obpNum.toFixed(3).replace(/^0/, '') : '.000';
  totals.slg = ab > 0 ? slgNum.toFixed(3).replace(/^0/, '') : '.000';
  totals.ops = (obpNum + slgNum).toFixed(3).replace(/^0/, '');

  return totals;
}

function buildGameLogMonthSections(rows, group) {
  const monthMap = new Map();
  for (const row of rows) {
    const d = new Date(`${row.date}T12:00:00`);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        label: d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase(),
        rows: [],
      });
    }
    monthMap.get(key).rows.push(row);
  }

  return [...monthMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, section]) => ({
      ...section,
      totals: computeGameLogMonthTotals(section.rows, group),
    }));
}

function formatCell(value, format, row) {
  if (row.isMonthTotals) {
    if (format === 'date' || format === 'opponent') return '';
    if (format === 'gameScore' || format === 'decision' || format === 'relief') return '—';
  }

  if (format === 'date' && row.date) {
    return new Date(row.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (format === 'team') {
    if (isSeasonTotalRow(row)) {
      return <span className="text-[10px] font-medium text-slate-400">Total</span>;
    }
    return <TeamAbbrCell team={row.team} abbrOnly size="md" abbrClassName="text-[10px] font-medium" />;
  }
  if (format === 'opponent') {
    const abbr = getTeamAbbr(row.opponent);
    if (abbr === '—') return '—';
    const teamId = row.opponent?.id;
    const prefix = row.isHome ? 'vs' : '@';
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <span className="text-slate-400">{prefix}</span>
        <TeamLogoImg teamId={teamId} className="w-5 h-5 object-contain flex-shrink-0" alt={abbr} />
        <span className="font-medium">{abbr}</span>
      </span>
    );
  }
  if (format === 'gameScore') {
    const score = value ?? computePitcherGameScore(getGameLogStat(row));
    return score == null ? '—' : score;
  }
  if (format === 'decision') {
    const dec = formatPitcherDecision(getGameLogStat(row));
    if (dec === 'W') return <span className="text-emerald-400 font-semibold">W</span>;
    if (dec === 'L') return <span className="text-red-400 font-semibold">L</span>;
    if (dec === 'S') return <span className="text-emerald-400 font-semibold">S</span>;
    return dec;
  }
  if (format === 'relief') {
    return formatPitcherRelief(getGameLogStat(row));
  }
  if (format === 'pitchesStrikes') {
    const pitches = row.numberOfPitches ?? row.stat?.numberOfPitches;
    const strikes = row.strikes ?? row.stat?.strikes;
    if (pitches == null && strikes == null) return '—';
    return `${pitches ?? '—'}-${strikes ?? '—'}`;
  }
  if (format === 'text') return value ?? '—';
  return value ?? '—';
}

async function fetchPlayerStats(playerId, params, level = 'mlb') {
  const base = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?${params}`;


  
  if (level === 'mlb') {
    const res = await fetch(`${base}&sportId=1`);
    return res.json();
  }

  const responses = await Promise.all(
    MINOR_SPORT_IDS.map((sportId) =>
      fetch(`${base}&sportId=${sportId}`).then((r) => r.json()),
    ),
  );

  console.log('AVER', responses);
  

  return mergeMinorLeagueStats(responses);
}

function FilterBar({
  level,
  onLevelChange,
  period,
  onPeriodChange,
  season,
  onSeasonChange,
  seasonOptions = SEASON_OPTIONS,
  group,
  onGroupChange,
  hidePeriod = false,
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center mx-2 my-3">
      <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
        <SegmentedControl
          value={level}
          onChange={onLevelChange}
          size="sm"
          options={[
            { value: 'mlb', label: 'MLB' },
            { value: 'minors', label: 'Minors' },
          ]}
        />
      </div>
      {group !== undefined && onGroupChange && (
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
          <SegmentedControl
            value={group}
            onChange={onGroupChange}
            size="sm"
            options={[
              { value: 'hitting', label: 'Batting' },
              { value: 'pitching', label: 'Pitching' },
            ]}
          />
        </div>
      )}
      {!hidePeriod && period !== undefined && onPeriodChange && (
        <Select value={period} onChange={onPeriodChange} options={PERIOD_OPTIONS} className="w-52" />
      )}
      <Select value={season} onChange={onSeasonChange} options={seasonOptions} className="w-24" />
    </div>
  );
}

function StatsTable({
  cols,
  rows,
  labelKey = 'label',
  emptyMessage = 'No stats available',
  highlightCareerHighs = false,
  footerRow = null,
}) {
  const tableRef = useRef(null);
  const { sortCol, sortDir, handleSort, sortMark, sortActive } = useTableSort(LABEL_SORT_KEY, 'desc');
  useStickyColOffset(tableRef, [rows, footerRow, cols, sortCol, sortDir]);

  const sortedRows = useMemo(() => {
    const col = cols.find((c) => c.key === sortCol);
    return [...rows].sort((a, b) => comparePlayerRows(a, b, sortCol, sortDir, col));
  }, [rows, cols, sortCol, sortDir]);

  const careerHighs = highlightCareerHighs
    ? computeCareerHighs(rows.filter((row) => !isSeasonTotalRow(row)), cols)
    : null;

  const duplicateSeasons = useMemo(() => {
    if (labelKey !== 'season') return null;
    const counts = new Map();
    for (const row of rows) {
      if (row.season == null) continue;
      counts.set(row.season, (counts.get(row.season) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([season]) => season));
  }, [rows, labelKey]);

  if (!rows?.length && !footerRow) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  const renderRow = (row, i, { isFooter = false } = {}) => (
    <tr
      key={row.id ?? i}
      className={[
        'group border-b border-slate-800/60',
        isFooter ? 'border-t border-slate-600 font-bold text-slate-100 bg-[#182030]' : 'hover:bg-slate-800/20',
      ].join(' ')}
    >
      <td
        {...stickyCol1Props()}
        className={[
          scrollStickyYearCell('bg-[#121827]', { footer: isFooter }),
          isFooter || isSeasonTotalRow(row) || !duplicateSeasons?.has(row.season)
            ? 'font-semibold text-slate-200'
            : 'font-medium text-slate-500',
        ].join(' ')}
      >
        {row.label}
      </td>
      {cols.map((c, colIdx) => {
        const value = row[c.key] ?? row.stat?.[c.key];
        const isHigh = !isFooter && careerHighs && isCareerHigh(c.key, value, careerHighs);
        const isTeamSticky = colIdx === 0 && c.format === 'team';
        return (
          <td
            key={c.key}
            className={
              isTeamSticky
                ? scrollStickyTeamAbbrCell('bg-[#121827]', { footer: isFooter })
                : scrollStatCell(
                    isHigh
                      ? `font-bold text-${THEME_COLOR}-500`
                      : isFooter
                        ? 'text-slate-100 bg-[#182030]'
                        : 'text-slate-300',
                    { align: 'text-center' },
                  )
            }
          >
            {formatCell(value, c.format, row)}
          </td>
        );
      })}
    </tr>
  );

  const labelTitle = labelKey === 'season' ? 'Year' : 'Split';

  return (
    <div className={TABLE_SCROLL_BODY}>
      <table ref={tableRef} className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.md}`}>
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/60">
            <th
              {...stickyCol1Props()}
              className={`${scrollStickyYearHead('bg-[#121827]', { stickTop: true })} font-normal cursor-pointer select-none hover:text-slate-300 ${sortActive(LABEL_SORT_KEY)}`}
              onClick={() => handleSort(LABEL_SORT_KEY)}
            >
              {labelTitle}{sortMark(LABEL_SORT_KEY)}
            </th>
            {cols.map((c, colIdx) => (
              <th
                key={c.key}
                className={[
                  colIdx === 0 && c.format === 'team'
                    ? scrollStickyTeamAbbrHead('bg-[#121827]', { align: 'text-center', stickTop: true })
                    : scrollStatHead(`text-center font-normal cursor-pointer select-none hover:text-slate-300 ${sortActive(c.key)}`, { align: 'text-center', stickTop: true }),
                ].join(' ')}
                onClick={() => handleSort(c.key)}
              >
                {c.label}{sortMark(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => renderRow(row, i))}
          {footerRow && renderRow(footerRow, 'footer', { isFooter: true })}
        </tbody>
      </table>
    </div>
  );
}

function SplitColumnHeaders({ as = 'th', splitLabel = 'Split', className = '' }) {
  const Cell = as;
  return (
    <tr className={`text-slate-500 border-b border-slate-700/60 ${className}`}>
      <Cell className={`${scrollStickyHead('bg-[#121827]', { stickTop: true })} font-normal`}>
        {splitLabel}
      </Cell>
      {SPLIT_DISPLAY_COLS.map((c) => (
        <Cell key={c.key} className={`${scrollStatHead('text-center font-normal', { align: 'text-center', stickTop: true })}`}>
          {c.label}
        </Cell>
      ))}
    </tr>
  );
}

function SplitsTable({ sections, emptyMessage = 'No splits available' }) {
  const hasRows = sections?.some((s) => s.rows?.length);
  if (!hasRows) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  return (
    <div className={TABLE_SCROLL_BODY}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.lg}`}>
        <thead>
          <SplitColumnHeaders className="text-slate-400" />
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-slate-800/50">
                <td
                  colSpan={SPLIT_DISPLAY_COLS.length + 1}
                  className="py-2 px-3 text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-800/95 border-y border-slate-700/50"
                >
                  {section.title}
                </td>
              </tr>
              <SplitColumnHeaders as="td" splitLabel="" className="text-[10px] text-slate-600" />
              {section.rows.map((row, i) => (
                <tr key={row.id ?? `${section.title}-${i}`} className="group border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className={`${scrollStickyCell('bg-[#121827]')} z-[1] pl-4 text-slate-200`}>
                    {row.label}
                  </td>
                  {SPLIT_DISPLAY_COLS.map((c) => (
                    <td key={c.key} className={scrollStatCell('', { align: 'text-center' })}>
                      {formatCell(row[c.key] ?? row.stat?.[c.key], c.format, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isTradeTransaction(txn) {
  return txn?.typeCode === 'TR' || /^trade$/i.test(txn?.typeDesc?.trim() ?? '');
}

function txnApiDateParam(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

async function fetchTradeBundle(txn) {
  const teamId = txn.fromTeam?.id ?? txn.toTeam?.id;
  const dateParam = txnApiDateParam(txn.date);
  if (!teamId || !dateParam || txn.id == null) return [txn];

  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/transactions?teamId=${teamId}&date=${dateParam}&sportId=1`,
    );
    if (!res.ok) return [txn];
    const json = await res.json();
    const related = (json.transactions ?? []).filter((t) => t.id === txn.id);
    return related.length ? related : [txn];
  } catch {
    return [txn];
  }
}

function groupTradePlayers(transactions) {
  const byToTeam = new Map();
  for (const t of transactions) {
    if (!t.person?.id || !t.toTeam?.id) continue;
    const key = t.toTeam.id;
    if (!byToTeam.has(key)) {
      byToTeam.set(key, { team: t.toTeam, players: [] });
    }
    const bucket = byToTeam.get(key);
    if (!bucket.players.some((p) => p.id === t.person.id)) {
      bucket.players.push(t.person);
    }
  }
  return [...byToTeam.values()].sort((a, b) => a.team.name.localeCompare(b.team.name));
}

function TransactionTypeLabel({ typeDesc, className = '' }) {
  const label = typeDesc ?? '—';
  const isTrade = isTradeTransaction({ typeDesc: label });
  return (
    <span
      className={`font-medium ${isTrade ? `text-${THEME_COLOR}-400` : 'text-slate-200'} ${className}`}
    >
      {label}
    </span>
  );
}

const TXN_INITIAL_YEARS = 5;
const TXN_LOAD_MORE_YEARS = 5;
const TXN_MAX_YEARS = 50;

function formatTxnApiDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${m}/${day}/${date.getFullYear()}`;
}

async function fetchPlayerTransactions(playerId, yearsBack) {
  const today = new Date();
  const start = new Date(today);
  start.setFullYear(today.getFullYear() - yearsBack);
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/transactions?playerId=${playerId}&startDate=${formatTxnApiDate(start)}&endDate=${formatTxnApiDate(today)}&sportId=1`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return [...(json.transactions ?? [])].sort(
    (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0),
  );
}

function ReceivesLabel() {
  return (
    <div className="mb-4 sm:mb-3 pt-0">
      <p className="text-center text-sm font-semibold text-slate-300 tracking-wide">Receives:</p>
      <div className="divider-7 mt-0" aria-hidden />
    </div>
  );
}

function TransactionPlayerLink({ person, onNavigate }) {
  if (!person?.id) {
    return <span className="text-slate-300">{person?.fullName ?? '—'}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onNavigate(person.id)}
      className={`text-left text-sm text-slate-200 hover:text-${THEME_COLOR}-400 transition-colors`}
    >
      {person.fullName}
    </button>
  );
}

function TransactionDetailModal({ txn, tradeBundle, tradeLoading, onClose, onPlayerClick }) {
  if (!txn) return null;

  const isTrade = isTradeTransaction(txn);
  const tradeGroups = isTrade ? groupTradePlayers(tradeBundle) : [];

  return (
    <Modal
      open={Boolean(txn)}
      onClose={onClose}
      size="lg"
      panelClassName="max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-[#0d1520] border-slate-700/70"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-[#0d1520] z-10">
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <TransactionTypeLabel typeDesc={txn.typeDesc ?? txn.description} className="text-lg sm:text-xl" />
            <p className="text-sm text-slate-500 mt-1">{fmtDate(txn.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-lg flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!isTrade && txn.fromTeam?.id && txn.toTeam?.id && (
          <div className="flex items-center justify-center gap-4 sm:gap-6 py-1">
            <div className="flex flex-col items-center gap-1">
              <img src={teamLogoUrl(txn.fromTeam.id)} alt="" className="w-12 h-12 object-contain" />
              <span className="text-[10px] text-slate-500">{getTeamAbbr(txn.fromTeam) ?? txn.fromTeam.name}</span>
            </div>
            <i className="fa-solid fa-arrow-right-long text-slate-500" aria-hidden />
            <div className="flex flex-col items-center gap-1">
              <img src={teamLogoUrl(txn.toTeam.id)} alt="" className="w-12 h-12 object-contain" />
              <span className="text-[10px] text-slate-500">{getTeamAbbr(txn.toTeam) ?? txn.toTeam.name}</span>
            </div>
          </div>
        )}

        {isTrade && (
          <div className="space-y-3">
            {tradeLoading ? (
              <LoadingSpinner size="md" py="py-6" />
            ) : tradeGroups.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {tradeGroups.map(({ team }) => (
                    <div key={`trade-logo-${team.id}`} className="flex flex-col items-center gap-1.5 min-w-0 px-1">
                      <img
                        src={teamLogoUrl(team.id)}
                        alt=""
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                      />
                      <span className="text-xs sm:text-sm text-slate-400 text-center leading-tight">
                        {getTeamAbbr(team) ?? team.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {tradeGroups.map(({ team, players }) => (
                    <div
                      key={team.id}
                      className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3 sm:p-4"
                    >
                      <ReceivesLabel />
                      <ul className="space-y-2">
                        {players.map((person) => (
                          <li key={person.id} className="flex items-center gap-2">
                            <img
                              src={playerHeadshotUrl(person.id)}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover bg-slate-700 flex-shrink-0"
                            />
                            <TransactionPlayerLink person={person} onNavigate={onPlayerClick} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : txn.person?.id ? (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-3">
                <img
                  src={playerHeadshotUrl(txn.person.id)}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover bg-slate-700"
                />
                <TransactionPlayerLink person={txn.person} onNavigate={onPlayerClick} />
              </div>
            ) : null}
          </div>
        )}

        {txn.description && (
          <p className="text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-4">
            {txn.description}
          </p>
        )}
      </div>
    </Modal>
  );
}

function PlayerTransactionsTab({ playerId }) {
  const navigate = useNavigate();
  const restoredTxnRef = useRef(null);
  const savedTxnReturn = useMemo(() => readTxnSheetReturn(playerId), [playerId]);
  const [txns, setTxns] = useState([]);
  const [yearsBack, setYearsBack] = useState(() => Math.max(
    TXN_INITIAL_YEARS,
    Number(savedTxnReturn?.yearsBack) || TXN_INITIAL_YEARS,
  ));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [tradeBundle, setTradeBundle] = useState([]);
  const [tradeLoading, setTradeLoading] = useState(false);

  const openTransaction = useCallback(async (txn) => {
    setSelectedTxn(txn);
    if (!isTradeTransaction(txn)) {
      setTradeBundle([txn]);
      setTradeLoading(false);
      return;
    }
    setTradeLoading(true);
    setTradeBundle([txn]);
    const bundle = await fetchTradeBundle(txn);
    setTradeBundle(bundle);
    setTradeLoading(false);
  }, []);

  useEffect(() => {
    if (!playerId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const sorted = await fetchPlayerTransactions(playerId, yearsBack);
        if (cancelled) return;

        setTxns(sorted);

        if (!savedTxnReturn?.txnKey || restoredTxnRef.current === savedTxnReturn.txnKey) return;
        const txn = sorted.find((item) => transactionRestoreKey(item) === savedTxnReturn.txnKey) ?? savedTxnReturn.txn;
        if (!txn) return;

        restoredTxnRef.current = savedTxnReturn.txnKey;
        clearTxnSheetReturn(playerId);
        await openTransaction(txn);

        if (Number.isFinite(savedTxnReturn.scrollY)) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: savedTxnReturn.scrollY, left: 0, behavior: 'instant' });
          });
        }
      } catch {
        if (!cancelled) setTxns([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openTransaction, playerId, savedTxnReturn, yearsBack]);

  const canLoadMore = yearsBack < TXN_MAX_YEARS;
  const oldestYear = txns.length
    ? new Date(txns[txns.length - 1].date + 'T12:00:00').getFullYear()
    : null;
  const loadMoreYears = () => {
    setLoadingMore(true);
    setYearsBack((y) => Math.min(y + TXN_LOAD_MORE_YEARS, TXN_MAX_YEARS));
  };

  const closeTransaction = () => {
    clearTxnSheetReturn(playerId);
    setSelectedTxn(null);
  };

  const handlePlayerClick = (id) => {
    writeTxnSheetReturn(playerId, selectedTxn, yearsBack);
    navigate(`/player/${id}`);
  };

  if (loading) return <LoadingSpinner size="md" py="py-12" />;

  if (!txns.length) {
    return <div className="text-slate-500 text-sm text-center py-12">No transactions found.</div>;
  }

  return (
    <>
      <div className="space-y-1">
        {txns.map((t, i) => {
          const isTrade = isTradeTransaction(t);
          const rowKey = `${t.id ?? t.date}-${t.person?.id ?? i}`;
          const rowContent = (
            <>
              <div className="w-24 text-xs text-slate-500 flex-shrink-0 pt-0.5 tabular-nums">{fmtDate(t.date)}</div>
              <div className="flex-1 min-w-0">
                <TransactionTypeLabel typeDesc={t.typeDesc ?? t.description} className="text-sm" />
                {t.fromTeam?.name && t.toTeam?.name && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t.fromTeam.name} → {t.toTeam.name}
                  </div>
                )}
                {t.description && t.typeDesc && t.description !== t.typeDesc && (
                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
                )}
              </div>
              {isTrade && (
                <i className="fa-solid fa-chevron-right text-[10px] text-slate-600 mt-1 flex-shrink-0" aria-hidden />
              )}
            </>
          );

          if (!isTrade) {
            return (
              <div
                key={rowKey}
                className="w-full flex items-start gap-2 px-4 py-3 border-b border-slate-800/40 rounded-xl"
              >
                {rowContent}
              </div>
            );
          }

          return (
            <button
              key={rowKey}
              type="button"
              onClick={() => openTransaction(t)}
              className="w-full text-left flex items-start gap-2 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/30 active:bg-slate-800/40 transition-colors rounded-xl cursor-pointer"
            >
              {rowContent}
            </button>
          );
        })}
      </div>

      {canLoadMore && (
        <div className="pt-4 pb-2 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={loadMoreYears}
            disabled={loadingMore}
            className="text-sm font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors px-4 py-2 rounded-xl border border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/40"
          >
            {loadingMore ? 'Loading…' : 'See more'}
          </button>
          {oldestYear != null && !loadingMore && (
            <span className="text-[10px] text-slate-600">
              Showing back to {oldestYear}
              {yearsBack < TXN_MAX_YEARS ? ` · ${yearsBack} years loaded` : ' · full history'}
            </span>
          )}
        </div>
      )}

      <TransactionDetailModal
        txn={selectedTxn}
        tradeBundle={tradeBundle}
        tradeLoading={tradeLoading}
        onClose={closeTransaction}
        onPlayerClick={handlePlayerClick}
      />
    </>
  );
}

function GameLogGlossary({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800/60 px-1">
      {items.map(({ key, text }) => (
        <span key={key}>
          <span className="text-slate-400 font-semibold">{key}</span>: {text}
        </span>
      ))}
    </div>
  );
}

function GameLogTable({ cols, rows, logGroup, emptyMessage = 'No game logs available' }) {
  const oppMeasureRef = useRef(null);
  const [oppColWidth, setOppColWidth] = useState(null);
  const monthSections = useMemo(() => buildGameLogMonthSections(rows, logGroup), [rows, logGroup]);
  const glossary = logGroup === 'pitching' ? GAME_LOG_PITCH_GLOSSARY : GAME_LOG_HIT_GLOSSARY;

  useLayoutEffect(() => {
    const oppCell = oppMeasureRef.current;
    if (!oppCell) return;

    const syncOppWidth = () => {
      const w = Math.ceil(oppCell.getBoundingClientRect().width);
      if (w > 0) setOppColWidth(w);
    };

    syncOppWidth();
    const ro = new ResizeObserver(syncOppWidth);
    ro.observe(oppCell);
    return () => ro.disconnect();
  }, [rows, cols, logGroup]);

  if (!rows?.length) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  const oppStickyHead = scrollStickyHead('bg-[#121827]', {
    stickTop: true,
    widthClass: `${TABLE_YEAR_COL_CLASS} w-full box-border`,
  });
  const oppStickyCell = scrollStickyCell('bg-[#121827]', {
    widthClass: `${TABLE_YEAR_COL_CLASS} w-full box-border`,
  });
  const monthStickyCell = scrollStickyCell('bg-[#182030]', {
    widthClass: `${TABLE_YEAR_COL_CLASS} w-full box-border`,
    footer: true,
  });

  return (
    <div>
      <div className={TABLE_SCROLL_BODY}>
        <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS}`}>
          <colgroup>
            <col />
            <col style={oppColWidth ? { width: oppColWidth } : undefined} />
          </colgroup>
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/60">
              {cols.map((c, i) => (
                <th
                  key={c.key}
                  className={[
                    'font-normal whitespace-nowrap bg-[#121827]',
                    i === 0
                      ? `${TABLE_YEAR_COL_CLASS} px-3 py-2 text-left`
                      : i === 1
                        ? oppStickyHead
                        : scrollStatHead('text-center', { align: 'text-center', stickTop: true }),
                  ].join(' ')}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthSections.map((section, sectionIdx) => (
              <Fragment key={section.key}>
                {section.rows.map((row, i) => (
                  <tr key={row.id ?? `${section.key}-${i}`} className="group border-b border-slate-800/60 hover:bg-slate-800/20">
                    {cols.map((c, j) => {
                      const value = row[c.key] ?? row.stat?.[c.key];
                      const measureOpp = sectionIdx === 0 && i === 0 && j === 1;
                      return (
                        <td
                          key={c.key}
                          ref={measureOpp ? oppMeasureRef : undefined}
                          className={[
                            j === 0
                              ? `${TABLE_YEAR_COL_CLASS} px-3 py-2 font-semibold text-slate-200`
                              : j === 1
                                ? oppStickyCell
                                : scrollStatCell('', { align: 'text-center' }),
                          ].join(' ')}
                        >
                          {formatCell(value, c.format, row)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {section.totals && (
                  <tr className="group border-b border-slate-700/50 bg-slate-800/40 text-slate-400">
                    {cols.map((c, j) => {
                      const totalsRow = { isMonthTotals: true, stat: section.totals, ...section.totals };
                      const value = section.totals[c.key];
                      return (
                        <td
                          key={c.key}
                          className={[
                            j === 0
                              ? `${TABLE_YEAR_COL_CLASS} px-3 py-2 bg-[#182030]`
                              : j === 1
                                ? `${monthStickyCell} text-[10px] font-bold text-slate-300 uppercase tracking-widest`
                                : scrollStatCell('text-slate-400 font-semibold', { align: 'text-center' }),
                          ].join(' ')}
                        >
                          {j === 0
                            ? null
                            : j === 1
                              ? section.label
                              : formatCell(value, c.format, totalsRow)}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <GameLogGlossary items={glossary} />
    </div>
  );
}

function PlayerGameLogsPanel({ playerId, playerInfo, logLevel, logGroup, logSeason, gameLogCols }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId || !playerInfo) return undefined;

    let cancelled = false;
    const loadGameLogs = async () => {
      const params = new URLSearchParams({
        stats: 'gameLog',
        season: String(logSeason),
        group: logGroup,
        gameType: 'R',
      });

      try {
        const data = await fetchPlayerStats(playerId, params.toString(), logLevel);
        let splits = data.stats?.find((s) => s.type?.displayName === 'gameLog')?.splits ?? [];
        splits = [...splits].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (!cancelled) {
          setRows(
            splits.map((sp, i) => ({
              id: `${sp.date}-${sp.game?.gamePk ?? i}`,
              date: sp.date,
              team: sp.team,
              opponent: sp.opponent,
              isHome: sp.isHome,
              stat: sp.stat,
              ...sp.stat,
            })),
          );
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadGameLogs();
    return () => {
      cancelled = true;
    };
  }, [logGroup, logLevel, logSeason, playerId, playerInfo]);

  if (loading) {
    return <LoadingSpinner size="md" py="py-12" />;
  }

  return (
    <GameLogTable
      cols={gameLogCols}
      rows={rows}
      logGroup={logGroup}
      emptyMessage={`No game logs for ${logSeason} regular season.`}
    />
  );
}

function PlayerSplitsPanel({ playerId, playerInfo, isPitcher, splitLevel, splitSeason }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(!isPitcher);

  useEffect(() => {
    if (!playerId || !playerInfo || isPitcher) return undefined;

    let cancelled = false;
    const loadSplits = async () => {
      try {
        const nextSections = await fetchPlayerSplitSections(playerId, splitSeason, splitLevel);
        if (!cancelled) setSections(nextSections);
      } catch {
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSplits();
    return () => {
      cancelled = true;
    };
  }, [isPitcher, playerId, playerInfo, splitLevel, splitSeason]);

  if (isPitcher) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Splits breakdown is available for hitters only.
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner size="md" py="py-12" />;
  }

  return (
    <SplitsTable
      sections={sections}
      emptyMessage={`No splits for ${splitSeason} regular season.`}
    />
  );
}

function PlayerPageContent({ playerId, locationKey, initialViewState, restoredFromHistory }) {
  const restoredFromHistoryRef = useRef(restoredFromHistory);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [yearByYear, setYearByYear] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [careerLevel, setCareerLevel] = useState(initialViewState.careerLevel);
  const [careerGroup, setCareerGroup] = useState(initialViewState.careerGroup);
  const [careerGameType, setCareerGameType] = useState(initialViewState.careerGameType);

  const [logLevel, setLogLevel] = useState(initialViewState.logLevel);
  const [logGroup, setLogGroup] = useState(initialViewState.logGroup);

  const [logSeason, setLogSeason] = useState(initialViewState.logSeason);

  const [splitLevel, setSplitLevel] = useState(initialViewState.splitLevel);
  const [splitSeason, setSplitSeason] = useState(initialViewState.splitSeason);
  const [activeTab, setActiveTab] = useState(initialViewState.activeTab);
  const { watchlist, isWatching, removeFromWatchlist, upsertWatchlistEntry } = useWatchlist();
  const [watchAnimating, setWatchAnimating] = useState(false);

  const isPitcher = isPitcherPosition(playerInfo?.primaryPosition?.abbreviation);

  useEffect(() => {
    playerViewStateCache.set(locationKey, {
      activeTab,
      careerLevel,
      careerGroup,
      careerGameType,
      logLevel,
      logGroup,
      logSeason,
      splitLevel,
      splitSeason,
    });
  }, [
    locationKey,
    activeTab,
    careerLevel,
    careerGroup,
    careerGameType,
    logLevel,
    logGroup,
    logSeason,
    splitLevel,
    splitSeason,
  ]);

  const statGroup = careerGroup;
  const displayCols =
    careerGroup === 'pitching' ? pitchCols : careerGroup === 'fielding' ? fieldCols : hitCols;
  const gameLogCols = logGroup === 'pitching' ? gameLogPitchCols : gameLogHitCols;

  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadPlayer = async () => {
      try {
        const bioData = await fetchStatsApiJson(`/api/v1/people/${playerId}`, {
          query: { hydrate: 'currentTeam(team),awards,rosterEntries' },
          signal: controller.signal,
          ttl: 5 * 60_000,
          retries: 1,
        });
        if (cancelled) return;

        const player = bioData.people?.[0] || null;
        setPlayerInfo(player);
        if (restoredFromHistoryRef.current) return;
        const defaultLevel = defaultStatsLevelForPlayer(player);
        setCareerLevel(defaultLevel);
        setLogLevel(defaultLevel);
        setSplitLevel(defaultLevel);
        const pitcher = isPitcherPosition(player?.primaryPosition?.abbreviation);
        setCareerGroup(pitcher ? 'pitching' : 'hitting');
        setLogGroup(pitcher ? 'pitching' : 'hitting');
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setError('Failed to load player data.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadPlayer();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [playerId]);

  useEffect(() => {
    if (!playerId || !playerInfo) return;
    const params = `stats=yearByYear&group=hitting,pitching,fielding&hydrate=team&gameType=${careerGameType}`;
    fetchPlayerStats(playerId, params, careerLevel).then((data) => {
      setYearByYear(data.stats || []);
    });
  }, [playerId, playerInfo, careerLevel, careerGameType]);

  const toggleWatchlist = useCallback(() => {
    if (!playerInfo) return;
    const id = Number(playerId);
    if (isWatching(id)) {
      removeFromWatchlist(id);
      return;
    }
    upsertWatchlistEntry(mapPlayerToWatchEntry(playerInfo));
    setWatchAnimating(true);
    window.setTimeout(() => setWatchAnimating(false), 250);
  }, [isWatching, playerId, playerInfo, removeFromWatchlist, upsertWatchlistEntry]);

  const handleLogLevelChange = useCallback((nextLevel) => {
    setLogLevel(nextLevel);
    setLogSeason(CURRENT_YEAR);
  }, []);

  const handleLogGroupChange = useCallback((nextGroup) => {
    setLogGroup(nextGroup);
    setLogSeason(CURRENT_YEAR);
  }, []);

  const getYearByYearSplits = (group) =>
    yearByYear?.find((s) => s.type?.displayName === 'yearByYear' && s.group?.displayName === group)?.splits ?? [];

  const seasonHonors = buildSeasonHonors(playerInfo?.awards);

  const careerRows = (() => {
    const rows = getYearByYearSplits(statGroup)
      .filter((sp) => sp.season && sp.stat)
      .map((sp, stintOrder) => {
        const minorsLevel = careerLevel === 'minors' ? sp.sport?.abbreviation : null;
        return {
          id: `${sp.season}-${sp.team?.id ?? 'total'}-${sp.sport?.id ?? 0}-${stintOrder}`,
          season: Number(sp.season),
          stintOrder,
          isSeasonTotal: !sp.team?.id,
          minorsLevel: !sp.team?.id ? minorsLevel : null,
          label: (
            <SeasonYearLabel
              season={sp.season}
              minorsLevel={minorsLevel}
              badges={careerLevel === 'mlb' ? getActiveHonorBadges(seasonHonors[sp.season]) : []}
            />
          ),
          team: sp.team,
          stat: sp.stat,
        };
      })
      .sort((a, b) => compareSeasonRows(a, b, 'desc'));

    if (careerLevel !== 'minors') return rows;

    return injectMinorsSeasonTotals(rows, statGroup, (season) => (
      <SeasonYearLabel season={season} />
    ));
  })();

  const careerGroupOptions = [
    { value: 'hitting', label: 'Batting' },
    { value: 'pitching', label: 'Pitching' },
    { value: 'fielding', label: 'Fielding' },
  ];

  const careerTotalsRow = computeCareerTotalsRow(careerRows, statGroup);
  const isMinorsProfile = isMinorsPlayerProfile(playerInfo);
  const useMostPlayedTeam = shouldUseMostPlayedTeam(playerInfo);
  const primaryCareerTeam = useMostPlayedTeam ? getMostPlayedTeam(careerRows) : null;
  const waitingForMostPlayedTeam = useMostPlayedTeam && !primaryCareerTeam;
  const displayTeam = waitingForMostPlayedTeam
    ? null
    : primaryCareerTeam ?? playerInfo?.currentTeam;
  const playerImageOptions = isMinorsProfile ? { level: 'minors' } : undefined;
  const currentTeamLogoOptions = isMinorsProfile ? { level: 'minors' } : undefined;

  const PLAYER_TABS = [
    { key: 'career', label: 'Career' },
    { key: 'gamelogs', label: 'Game Logs' },
    { key: 'splits', label: 'Splits' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'bvp', label: 'Batter vs. Pitcher' },
  ];

  return (
    <div className="max-w-5xl mx-auto  sm:px-6  sm:py-8">
 
      {isLoading && <LoadingSpinner size="lg" py="py-20" />}

      {error && <div className="text-center py-20 text-slate-500">{error}</div>}

      {!isLoading && !error && playerInfo && (
        <div className="bg-[#121827] border border-slate-700/60 sm:rounded-2xl overflow-hidden">
          <div
            className="relative h-[200px] sm:h-[300px] bg-cover bg-center overflow-hidden px-5 sm:px-8 py-6 sm:py-8 flex flex-col justify-end"
            style={{
              backgroundImage: `url(${playerHeroShotUrl(playerId, playerImageOptions)})`,
            
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/90 pointer-events-none" />
            <PlayerHeroActions
              player={playerInfo}
              playerId={playerId}
              watchlist={watchlist}
              onToggleWatch={toggleWatchlist}
              watchAnimating={watchAnimating}
            />
            <div className="relative flex items-end gap-4 sm:gap-6">
        <div className="  -mb-6 -ml-6">
  {/* BACKGROUND LOGO */}
 {displayTeam?.id && (
   <img
    src={teamLogoUrl(displayTeam.id, primaryCareerTeam ? undefined : currentTeamLogoOptions)}
    className="absolute top-10 left-20 w-72 h-72 -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
    alt=""
  />
 )}

  {/* PLAYER IMG */}
  <img
    src={playerHeadshotUrl(playerId, playerImageOptions)}
    className="relative z-10 w-32 h-32 sm:w-40 sm:h-40  object-cover shadow-lg"
    alt={playerInfo.fullName}
  />

 
</div>
              <div className="relative z-20 pb-1 min-w-0 ">
                {/* Player NAM POSITION TEAMNAME */}
                <h1
                  className="text-2xl sm:text-3xl font-bold text-white leading-none mb-1.5 truncate"
                  style={HERO_TEXT_SHADOW}
                >
                  {playerInfo.fullName}
                </h1>
                <div className="text-slate-100 text-sm font-medium" style={HERO_TEXT_SHADOW}>
                  {playerInfo.primaryPosition?.name || '—'}
                </div>
                <div
                  className={`text-[11px] text-${THEME_COLOR}-300 font-semibold uppercase tracking-widest truncate`}
                  style={HERO_TEXT_SHADOW}
                >
                  {displayTeam?.id ? (
                    <Link
                      to={`/team/${displayTeam.id}`}
                      className="hover:text-white transition-colors"
                    >
                      {displayTeam.name}
                    </Link>
                  ) : (
                    displayTeam?.name || '—'
                  )}
                  {playerInfo.primaryNumber ? ` · #${playerInfo.primaryNumber}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {[
              { label: 'Bats / Throws', value: `${playerInfo.batSide?.code || '—'} / ${playerInfo.pitchHand?.code || '—'}` },
              { label: 'Height / Weight', value: `${playerInfo.height || '—'} / ${playerInfo.weight ? `${playerInfo.weight} lb` : '—'}` },
              { label: 'Born', value: formatBornWithAge(playerInfo) },
              { label: 'Birthplace', value: [playerInfo.birthCity, playerInfo.birthStateProvince, playerInfo.birthCountry].filter(Boolean).join(', ') || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-sm font-semibold text-slate-200">{value}</div>
              </div>
            ))}
          </div>

          <PlayerRosterStatus rosterEntries={playerInfo.rosterEntries} player={playerInfo} />

          <div className=" sm:px-8 sm:py-5 sm:py-6">
            <TabBar variant="page" tabs={PLAYER_TABS} activeKey={activeTab} onChange={setActiveTab}>
              {(key) => {
                if (key === 'career') {
                  return (
                    <>
                      <div className="flex flex-wrap gap-2 items-center my-3 mx-2 sm:mx-0">
                        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
                          <SegmentedControl
                            value={careerLevel}
                            onChange={setCareerLevel}
                            size="sm"
                            options={[
                              { value: 'mlb', label: 'MLB' },
                              { value: 'minors', label: 'Minors' },
                            ]}
                          />
                        </div>
                        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
                          <SegmentedControl
                            value={careerGroup}
                            onChange={setCareerGroup}
                            size="sm"
                            options={careerGroupOptions}
                          />
                        </div>
                        <Select
                          value={careerGameType}
                          onChange={setCareerGameType}
                          options={CAREER_GAME_TYPE_OPTIONS}
                          className="w-56"
                        />
                      </div>
                      <StatsTable
                        cols={displayCols}
                        rows={careerRows}
                        labelKey="season"
                        highlightCareerHighs
                        footerRow={careerTotalsRow}
                        emptyMessage="No career stats available for this selection."
                      />
                    </>
                  );
                }
                if (key === 'gamelogs') {
                  return (
                    <>
                      <FilterBar
                        level={logLevel}
                        onLevelChange={handleLogLevelChange}
                        season={logSeason}
                        onSeasonChange={setLogSeason}
                        seasonOptions={SEASON_OPTIONS}
                        group={logGroup}
                        onGroupChange={handleLogGroupChange}
                        hidePeriod
                      />
                      <PlayerGameLogsPanel
                        key={`${playerId}:${logLevel}:${logGroup}:${logSeason}`}
                        playerId={playerId}
                        playerInfo={playerInfo}
                        logLevel={logLevel}
                        logGroup={logGroup}
                        logSeason={logSeason}
                        gameLogCols={gameLogCols}
                      />
                    </>
                  );
                }
                if (key === 'splits') {
                  return (
                    <>
                      <FilterBar
                        level={splitLevel}
                        onLevelChange={setSplitLevel}
                        season={splitSeason}
                        onSeasonChange={setSplitSeason}
                        hidePeriod
                      />
                      <PlayerSplitsPanel
                        key={`${playerId}:${splitLevel}:${splitSeason}:${isPitcher ? 'pitcher' : 'hitter'}`}
                        playerId={playerId}
                        playerInfo={playerInfo}
                        isPitcher={isPitcher}
                        splitLevel={splitLevel}
                        splitSeason={splitSeason}
                      />
                    </>
                  );
                }
                if (key === 'transactions') {
                  return <PlayerTransactionsTab key={playerId} playerId={playerId} />;
                }
                return (
                  <div className="text-slate-500 text-sm text-center py-12 border border-dashed border-slate-700 rounded-2xl">
                    Batter vs. Pitcher matchup data coming soon.
                  </div>
                );
              }}
            </TabBar>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  const { playerId } = useParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const startingViewState = initialPlayerViewState(location.key, navigationType);
  const restoredFromHistory = navigationType === 'POP' && playerViewStateCache.has(location.key);

  return (
    <PlayerPageContent
      key={`${playerId}:${location.key}`}
      playerId={playerId}
      locationKey={location.key}
      initialViewState={startingViewState}
      restoredFromHistory={restoredFromHistory}
    />
  );
}
