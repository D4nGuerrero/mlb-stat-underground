import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { playerHeadshotUrl, teamLogoUrl, playerHeroShotUrl, getTeamAbbr } from '../utils/mlbHelpers';
import TeamAbbrCell from '../components/TeamAbbrCell';
import TeamLogoImg from '../components/TeamLogoImg';
import { buildSeasonHonors, getActiveHonorBadges } from '../utils/seasonHonors';
import { fetchPlayerSplitSections, SPLIT_DISPLAY_COLS } from '../utils/playerSplits';
import { computeCareerTotalsRow } from '../utils/careerTotals';
import SeasonYearLabel from '../components/SeasonYearLabel';
import {
  SegmentedControl,
  Select,
  TabBar,
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
const MINOR_SPORT_ID_SET = new Set(MINOR_SPORT_IDS);

const LOWER_IS_BETTER = new Set(['era', 'whip', 'losses', 'errors']);

const HERO_TEXT_SHADOW = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' };
const WATCHLIST_KEY = 'mlbWatchlist';

function loadWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function mapPlayerToWatchEntry(player) {
  return {
    id: player.id,
    fullName: player.fullName,
    team: player.currentTeam?.name ?? '—',
    teamId: player.currentTeam?.id,
    position: player.primaryPosition?.abbreviation ?? '',
    headshot: playerHeadshotUrl(player.id),
    active: player.active,
  };
}

function PlayerHeroActions({ player, playerId, watchlist, onToggleWatch, watchAnimating }) {
  const isWatched = watchlist.some((p) => p.id === Number(playerId));
  const parentOrgId = player?.currentTeam?.parentOrgId;

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
  { key: 'totalBases', label: 'TB' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'intentionalWalks', label: 'IBB' },
  { key: 'strikeOuts', label: 'SO' },
  { key: 'stolenBases', label: 'SB' },
  { key: 'caughtStealing', label: 'CS' },
  { key: 'avg', label: 'AVG' },
  { key: 'obp', label: 'OBP' },
  { key: 'slg', label: 'SLG' },
  { key: 'hitByPitch', label: 'HBP' },
  { key: 'sacBunts', label: 'SAC' },
  { key: 'sacFlies', label: 'SF' },
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
  { key: 'TB', text: 'Total bases' },
  { key: '2B', text: 'Doubles' },
  { key: '3B', text: 'Triples' },
  { key: 'HR', text: 'Home runs' },
  { key: 'RBI', text: 'Runs batted in' },
  { key: 'BB', text: 'Walks' },
  { key: 'IBB', text: 'Intentional walks' },
  { key: 'SO', text: 'Strikeouts' },
  { key: 'SB', text: 'Stolen bases' },
  { key: 'CS', text: 'Caught stealing' },
  { key: 'AVG', text: 'Batting average' },
  { key: 'OBP', text: 'On-base percentage' },
  { key: 'SLG', text: 'Slugging percentage' },
  { key: 'HBP', text: 'Hit by pitch' },
  { key: 'SAC', text: 'Sacrifice bunts' },
  { key: 'SF', text: 'Sacrifice flies' },
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

function getRosterStatusStyle(code, description) {
  const isActive = code === 'A';
  const isInjured = /^D\d/.test(code || '') || /injur/i.test(description || '');
  if (isActive) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (isInjured) {
    return 'bg-red-500/15 text-red-300 border-red-500/30';
  }
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
}

function PlayerRosterStatus({ rosterEntries }) {
  const entry = rosterEntries?.find((e) => e.isActive) ?? rosterEntries?.[0];
  if (!entry?.status) return null;

  const { code, description } = entry.status;
  const badgeCls = getRosterStatusStyle(code, description);
  const statusDate = entry.statusDate
    ? new Date(entry.statusDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="px-5 sm:px-8 py-3 border-b border-slate-700/50 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-widest">Status</div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeCls}`}>
        {code !== 'A' && <i className="fa-solid fa-kit-medical text-[10px]" aria-hidden />}
        {description || code}
      </span>
      {statusDate && code !== 'A' && (
        <span className="text-xs text-slate-500">since {statusDate}</span>
      )}
      {entry.team?.name && (
        <span className="text-xs text-slate-500">{entry.team.name} 40-man</span>
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

function compareSeasonRows(a, b, sortDir) {
  const seasonCmp = (Number(a.season) || 0) - (Number(b.season) || 0);
  if (seasonCmp !== 0) return sortDir === 'asc' ? seasonCmp : -seasonCmp;

  const aTotal = isSeasonTotalRow(a);
  const bTotal = isSeasonTotalRow(b);
  if (aTotal !== bTotal) {
    if (sortDir === 'asc') return aTotal ? 1 : -1;
    return aTotal ? -1 : 1;
  }
  if (aTotal) return 0;

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
  let cmp = 0;
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
    totalBases: sumGameLogField(rows, 'totalBases'),
    doubles: sumGameLogField(rows, 'doubles'),
    triples: sumGameLogField(rows, 'triples'),
    homeRuns: sumGameLogField(rows, 'homeRuns'),
    rbi: sumGameLogField(rows, 'rbi'),
    baseOnBalls: sumGameLogField(rows, 'baseOnBalls'),
    intentionalWalks: sumGameLogField(rows, 'intentionalWalks'),
    strikeOuts: sumGameLogField(rows, 'strikeOuts'),
    stolenBases: sumGameLogField(rows, 'stolenBases'),
    caughtStealing: sumGameLogField(rows, 'caughtStealing'),
    hitByPitch: sumGameLogField(rows, 'hitByPitch'),
    sacBunts: sumGameLogField(rows, 'sacBunts'),
    sacFlies: sumGameLogField(rows, 'sacFlies'),
  };

  const ab = totals.atBats;
  const h = totals.hits;
  const bb = totals.baseOnBalls;
  const hbp = totals.hitByPitch;
  const sf = totals.sacFlies;
  const singles = h - totals.doubles - totals.triples - totals.homeRuns;
  const obpDenom = ab + bb + hbp + sf;

  totals.avg = ab > 0 ? (h / ab).toFixed(3).replace(/^0/, '') : '.000';
  totals.obp = obpDenom > 0 ? ((h + bb + hbp) / obpDenom).toFixed(3).replace(/^0/, '') : '.000';
  totals.slg = ab > 0
    ? ((singles + 2 * totals.doubles + 3 * totals.triples + 4 * totals.homeRuns) / ab)
        .toFixed(3)
        .replace(/^0/, '')
    : '.000';

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
    <div className="flex flex-wrap gap-3 items-center mb-5 mt-3">
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
      <Select value={season} onChange={onSeasonChange} options={seasonOptions} className="w-28" />
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
        className={`${scrollStickyYearCell('bg-[#121827]', { footer: isFooter })} font-semibold text-slate-200`}
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

function PlayerTransactionsTab({ playerId }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    (async () => {
      try {
        const today = new Date();
        const start = new Date(today);
        start.setFullYear(today.getFullYear() - 5);
        const fmt = (d) => {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${m}/${day}/${d.getFullYear()}`;
        };
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/transactions?playerId=${playerId}&startDate=${fmt(start)}&endDate=${fmt(today)}&sportId=1`,
        );
        const json = await res.json();
        const sorted = [...(json.transactions ?? [])].sort(
          (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0),
        );
        setTxns(sorted);
      } catch {
        setTxns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId]);

  if (loading) return <LoadingSpinner size="md" py="py-12" />;

  if (!txns.length) {
    return <div className="text-slate-500 text-sm text-center py-12">No transactions found.</div>;
  }

  return (
    <div className="space-y-1">
      {txns.map((t, i) => (
        <div
          key={t.id ?? `${t.date}-${i}`}
          className="flex items-start gap-3 px-1 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors rounded-xl"
        >
          <div className="w-24 text-xs text-slate-500 flex-shrink-0 pt-0.5 tabular-nums">{fmtDate(t.date)}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200">{t.typeDesc ?? t.description ?? '—'}</div>
            {t.fromTeam?.name && t.toTeam?.name && (
              <div className="text-xs text-slate-500 mt-0.5">
                {t.fromTeam.name} → {t.toTeam.name}
              </div>
            )}
            {t.description && t.typeDesc && t.description !== t.typeDesc && (
              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
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

export default function PlayerPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [playerInfo, setPlayerInfo] = useState(null);
  const [yearByYear, setYearByYear] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [careerLevel, setCareerLevel] = useState('mlb');
  const [careerGroup, setCareerGroup] = useState('hitting');
  const [careerGameType, setCareerGameType] = useState('R');

  const [logLevel, setLogLevel] = useState('mlb');
  const [logGroup, setLogGroup] = useState('hitting');

  const [logSeason, setLogSeason] = useState(CURRENT_YEAR);
  const [logSeasonOptions, setLogSeasonOptions] = useState(SEASON_OPTIONS);
  const [gameLogRows, setGameLogRows] = useState([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);

  const [splitLevel, setSplitLevel] = useState('mlb');
  const [splitSeason, setSplitSeason] = useState(CURRENT_YEAR);
  const [splitSections, setSplitSections] = useState([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('career');
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [watchAnimating, setWatchAnimating] = useState(false);

  const isPitcher =
    playerInfo?.primaryPosition?.abbreviation === 'P' ||
    playerInfo?.primaryPosition?.abbreviation === 'SP' ||
    playerInfo?.primaryPosition?.abbreviation === 'RP';

  const statGroup = careerGroup;
  const displayCols =
    careerGroup === 'pitching' ? pitchCols : careerGroup === 'fielding' ? fieldCols : hitCols;
  const gameLogCols = logGroup === 'pitching' ? gameLogPitchCols : gameLogHitCols;

  useEffect(() => {
    if (!playerId) return;
    setIsLoading(true);
    setError(null);

    fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam(team),awards,rosterEntries`)
      .then((r) => r.json())
      .then((bioData) => {
        setPlayerInfo(bioData.people?.[0] || null);
        if (bioData.people?.[0]?.primaryPosition?.abbreviation === 'P') {
          setCareerGroup('pitching');
          setLogGroup('pitching');
        }
      })
      .catch(() => setError('Failed to load player data.'))
      .finally(() => setIsLoading(false));
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    const params = `stats=yearByYear&group=hitting,pitching,fielding&hydrate=team&gameType=${careerGameType}`;
    fetchPlayerStats(playerId, params, careerLevel).then((data) => {
      setYearByYear(data.stats || []);
    });
  }, [playerId, careerLevel, careerGameType]);

  const getPeriodMeta = (period) => PERIOD_OPTIONS.find((p) => p.value === period) ?? PERIOD_OPTIONS[0];

  const loadGameLogs = useCallback(async () => {
    if (!playerId) return;
    setGameLogLoading(true);
    const meta = getPeriodMeta('regular');
    try {
      const params = new URLSearchParams({
        stats: 'gameLog',
        season: String(logSeason),
        group: logGroup,
        gameType: meta.gameType,
      });

      const data = await fetchPlayerStats(playerId, params.toString(), logLevel);
      let splits = data.stats?.find((s) => s.type?.displayName === 'gameLog')?.splits ?? [];

      if (meta.limit) {
        splits = [...splits]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, meta.limit);
      } else {
        splits = [...splits].sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      setGameLogRows(
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
    } catch {
      setGameLogRows([]);
    } finally {
      setGameLogLoading(false);
    }
  }, [playerId, logLevel, logGroup, logSeason]);

  const loadSplits = useCallback(async () => {
    if (!playerId || isPitcher) {
      setSplitSections([]);
      return;
    }
    setSplitLoading(true);
    try {
      const sections = await fetchPlayerSplitSections(playerId, splitSeason, splitLevel);
      setSplitSections(sections);
    } catch {
      setSplitSections([]);
    } finally {
      setSplitLoading(false);
    }
  }, [playerId, splitLevel, splitSeason, isPitcher]);

  useEffect(() => {
    setLogSeason(CURRENT_YEAR);
  }, [playerId]);

  useEffect(() => {
    const years = logSeasonOptions.map((o) => o.value);
    if (!years.length || years.includes(logSeason)) return;
    setLogSeason(years.includes(CURRENT_YEAR) ? CURRENT_YEAR : years[0]);
  }, [logSeasonOptions, logSeason]);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = `stats=yearByYear&group=${logGroup}&hydrate=team,sport&gameType=R`;
        const data = await fetchPlayerStats(playerId, params, logLevel);
        if (cancelled) return;
        const splits = data.stats?.find((s) => s.type?.displayName === 'yearByYear')?.splits ?? [];
        const seasons = [...new Set(
          splits
            .filter((sp) => {
              if (!sp.season || !sp.stat) return false;
              const games = Number(sp.stat.gamesPlayed ?? sp.stat.gamesStarted ?? 0);
              return games > 0;
            })
            .map((sp) => Number(sp.season)),
        )].sort((a, b) => b - a);
        const options = seasons.length
          ? seasons.map((y) => ({ value: y, label: String(y) }))
          : [{ value: CURRENT_YEAR, label: String(CURRENT_YEAR) }];
        setLogSeasonOptions(options);
      } catch {
        if (!cancelled) {
          setLogSeasonOptions([{ value: CURRENT_YEAR, label: String(CURRENT_YEAR) }]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [playerId, logLevel, logGroup]);

  useEffect(() => {
    loadGameLogs();
  }, [loadGameLogs]);

  useEffect(() => {
    loadSplits();
  }, [loadSplits]);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const refreshWatchlist = () => setWatchlist(loadWatchlist());
    window.addEventListener('focus', refreshWatchlist);
    return () => window.removeEventListener('focus', refreshWatchlist);
  }, []);

  const toggleWatchlist = useCallback(() => {
    if (!playerInfo) return;
    const id = Number(playerId);
    const exists = watchlist.some((p) => p.id === id);
    if (exists) {
      setWatchlist(watchlist.filter((p) => p.id !== id));
      return;
    }
    setWatchlist([mapPlayerToWatchEntry(playerInfo), ...watchlist]);
    setWatchAnimating(true);
    window.setTimeout(() => setWatchAnimating(false), 250);
  }, [playerInfo, playerId, watchlist]);

  const getYearByYearSplits = (group) =>
    yearByYear?.find((s) => s.type?.displayName === 'yearByYear' && s.group?.displayName === group)?.splits ?? [];

  const seasonHonors = buildSeasonHonors(playerInfo?.awards);

  const careerRows = getYearByYearSplits(statGroup)
    .filter((sp) => sp.season && sp.stat)
    .map((sp, stintOrder) => ({
      id: `${sp.season}-${sp.team?.id ?? 'total'}-${sp.sport?.id ?? 0}-${stintOrder}`,
      season: Number(sp.season),
      stintOrder,
      isSeasonTotal: !sp.team?.id,
      label: (
        <SeasonYearLabel
          season={sp.season}
          minorsLevel={careerLevel === 'minors' ? sp.sport?.abbreviation : null}
          badges={careerLevel === 'mlb' ? getActiveHonorBadges(seasonHonors[sp.season]) : []}
        />
      ),
      team: sp.team,
      stat: sp.stat,
    }))
    .sort((a, b) => compareSeasonRows(a, b, 'desc'));

  const careerGroupOptions = [
    { value: 'hitting', label: 'Batting' },
    { value: 'pitching', label: 'Pitching' },
    { value: 'fielding', label: 'Fielding' },
  ];

  const careerTotalsRow = computeCareerTotalsRow(careerRows, statGroup);

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
              backgroundImage: `url(${playerHeroShotUrl(playerId)})`,
            
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
 <img
  src={teamLogoUrl(playerInfo.currentTeam.id)}
  className="absolute top-10 left-20 w-72 h-72 -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
  alt=""
/>

  {/* PLAYER IMG */}
  <img
    src={playerHeadshotUrl(playerId)}
    className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover shadow-lg"
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
                  {playerInfo.currentTeam?.id ? (
                    <Link
                      to={`/team/${playerInfo.currentTeam.id}`}
                      className="hover:text-white transition-colors"
                    >
                      {playerInfo.currentTeam.name}
                    </Link>
                  ) : (
                    playerInfo.currentTeam?.name || '—'
                  )}
                  {playerInfo.primaryNumber ? ` · #${playerInfo.primaryNumber}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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

          <PlayerRosterStatus rosterEntries={playerInfo.rosterEntries} />

          <div className=" sm:px-8 py-5 sm:py-6">
            <TabBar variant="page" tabs={PLAYER_TABS} activeKey={activeTab} onChange={setActiveTab}>
              {(key) => {
                if (key === 'career') {
                  return (
                    <>
                      <div className="flex flex-wrap gap-3 items-center mb-5 pt-3 mx-3 sm:mx-0">
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
                        onLevelChange={setLogLevel}
                        season={logSeason}
                        onSeasonChange={setLogSeason}
                        seasonOptions={logSeasonOptions}
                        group={logGroup}
                        onGroupChange={setLogGroup}
                        hidePeriod
                      />
                      {gameLogLoading ? (
                        <LoadingSpinner size="md" py="py-12" />
                      ) : (
                        <GameLogTable
                          cols={gameLogCols}
                          rows={gameLogRows}
                          logGroup={logGroup}
                          emptyMessage={`No game logs for ${logSeason} regular season.`}
                        />
                      )}
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
                      {isPitcher ? (
                        <div className="text-slate-500 text-sm text-center py-12">
                          Splits breakdown is available for hitters only.
                        </div>
                      ) : splitLoading ? (
                        <LoadingSpinner size="md" py="py-12" />
                      ) : (
                        <SplitsTable
                          sections={splitSections}
                          emptyMessage={`No splits for ${splitSeason} regular season.`}
                        />
                      )}
                    </>
                  );
                }
                if (key === 'transactions') {
                  return <PlayerTransactionsTab playerId={playerId} />;
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