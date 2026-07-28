import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, useLocation, useNavigationType, Link } from 'react-router-dom';
import { playerHeadshotUrl, teamLogoUrl, playerHeroShotUrl, playerHeroBackgroundClass, getTeamAbbr, spotracPlayerUrl, retiredPlayerTeamOverride, mlbTeams } from '../utils/mlbHelpers';
import TeamAbbrCell from '../components/TeamAbbrCell';
import TeamLogoImg from '../components/TeamLogoImg';
import { buildSeasonHonors, getActiveHonorBadges } from '../utils/seasonHonors';
import { fetchPlayerSplitSections, SPLIT_DISPLAY_COLS, PITCHING_SPLIT_DISPLAY_COLS } from '../utils/playerSplits';
import { computeCareerTotalsRow, computeSeasonTotalsRow } from '../utils/careerTotals';
import SeasonYearLabel from '../components/SeasonYearLabel';
import { useWatchlist } from '../hooks/useWatchlist';
import { fetchStatsApiJson } from '../lib/mlb/client';
import { countryFlagUrl } from '../utils/countryFlags';
import { getHistoricalTradeBundle, getHistoricalTradesForPlayer, isHistoricalTrade } from '../utils/historicalTrades';
import {
  SegmentedControl,
  Select,
  TabBar,
  Modal,
  BottomSheetModal,
  scrollStickyYearHead,
  scrollStickyYearCell,
  scrollStickyTeamAbbrHead,
  scrollStickyTeamAbbrCell,
  scrollStickyHead,
  scrollStickyCell,
  scrollStickyDateHead,
  scrollStickyDateCell,
  scrollStickyTeamAfterDateHead,
  scrollStickyTeamAfterDateCell,
  scrollStatHead,
  scrollStatCell,
  TABLE_SCROLL_BODY,
  TABLE_BASE,
  useStickyColOffset,
  stickyCol1Props,
  LoadingSpinner,
} from '../components/ui';
import { TABLE_TEXT_CLASS, TABLE_MIN_W } from '../theme/tableTheme';

const CURRENT_YEAR = new Date().getFullYear();
const MLB_PARENT_TEAM_IDS = new Set(mlbTeams.map((team) => Number(team.id)));
const BVP_SEARCH_SPORT_IDS = '1,11,12,13,14,15,16,17';

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
    splitGroup: 'hitting',
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

function seasonOptionValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function seasonOptionsFromYearByYear(stats, group) {
  const seasons = new Set();
  const block = stats?.find(
    (s) => s.type?.displayName === 'yearByYear' && s.group?.displayName === group,
  );

  for (const split of block?.splits ?? []) {
    if (!split.season) continue;
    if ((Number(split.stat?.gamesPlayed) || 0) <= 0) continue;
    seasons.add(Number(split.season));
  }

  return [...seasons]
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .map((season) => ({ value: season, label: String(season) }));
}

function fallbackSeasonOptionsForPlayer(player) {
  const lastYear = Number(player?.lastPlayedDate?.slice(0, 4));
  const year = Number.isFinite(lastYear) && lastYear > 0 ? lastYear : CURRENT_YEAR;
  return [{ value: year, label: String(year) }];
}

function resolveSeasonValue(value, options) {
  const normalized = seasonOptionValue(value);
  if (options.some((option) => option.value === normalized)) return normalized;
  return options[0]?.value ?? normalized;
}

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
];

const MINOR_SPORT_IDS = [
  11, // Triple-A
  12, // Double-A
  13, // High-A
  14, // Single-A
  16, // Rookie
  17, // Winter Leagues
  23, // Independent Leagues / Mexico bucket
  31, // Nippon Professional Baseball
  32, // Korean Baseball Organization
  51, // International Baseball
];

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
  const rawParentOrgId = player?.active !== false ? player?.currentTeam?.parentOrgId : null;
  const parentOrgId = MLB_PARENT_TEAM_IDS.has(Number(rawParentOrgId)) ? rawParentOrgId : null;

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

function joinEducation(entries) {
  return (entries ?? [])
    .map((entry) => [entry.name, entry.city, entry.state].filter(Boolean).join(', '))
    .filter(Boolean)
    .join(' · ');
}

function formatDraftPick(draftPick, draftYear) {
  if (!draftYear && !draftPick) return null;
  if (!draftPick) return `${draftYear} MLB Draft`;

  const round = draftPick.pickRound ?? draftPick.round;
  const overall = draftPick.displayPickNumber ?? draftPick.pickNumber;
  const team = draftPick.team?.name;
  const parts = [
    draftYear ? `${draftYear} MLB Draft` : null,
    round ? `Round ${round}` : null,
    overall ? `Pick ${overall} overall` : null,
    team ? `by ${team}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function buildPlayerBioRows(playerInfo, draftPick) {
  if (!playerInfo) return { base: [], expanded: [] };

  const birthplace = [playerInfo.birthCity, playerInfo.birthStateProvince, playerInfo.birthCountry].filter(Boolean).join(', ') || '—';
  const base = [
    { label: 'Bats / Throws', value: `${playerInfo.batSide?.code || '—'} / ${playerInfo.pitchHand?.code || '—'}` },
    { label: 'Height / Weight', value: `${playerInfo.height || '—'} / ${playerInfo.weight ? `${playerInfo.weight} lb` : '—'}` },
    { label: 'Born', value: formatBornWithAge(playerInfo) },
    { label: 'Birthplace', value: birthplace, format: 'birthplace', country: playerInfo.birthCountry },
  ];

  const college = joinEducation(playerInfo.education?.colleges);
  const highSchool = joinEducation(playerInfo.education?.highschools);
  const draftText = formatDraftPick(draftPick, playerInfo.draftYear);
  const relationships = (playerInfo.relatives ?? []).filter((relative) => relative?.id && relative?.hasStats !== false);

  const expanded = [
    playerInfo.fullFMLName && playerInfo.fullFMLName !== playerInfo.fullName
      ? { label: 'Full Name', value: playerInfo.fullFMLName }
      : null,
    playerInfo.nickName ? { label: 'Nickname', value: playerInfo.nickName } : null,
    draftText ? { label: 'Drafted', value: draftText } : null,
    playerInfo.mlbDebutDate ? { label: 'MLB Debut', value: fmtDate(playerInfo.mlbDebutDate) } : null,
    relationships.length ? { label: 'Relationships', value: relationships, format: 'relationships' } : null,
    college ? { label: 'College', value: college } : null,
    highSchool ? { label: 'High School', value: highSchool } : null,
  ].filter((row) => row?.value && row.value !== '—');

  return { base, expanded };
}

function PlayerBioInfo({ playerInfo, draftPick }) {
  const [expanded, setExpanded] = useState(false);
  const { base, expanded: expandedRows } = buildPlayerBioRows(playerInfo, draftPick);
  const visibleRows = expanded ? [...base, ...expandedRows] : base;
  const hasExpandedRows = expandedRows.length > 0;

  return (
    <section className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700/50">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Bio</div>
          <div className="text-xs text-slate-400">Player information</div>
        </div>
        {hasExpandedRows && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className={`inline-flex items-center gap-2 rounded-full border border-${THEME_COLOR}-500/30 bg-${THEME_COLOR}-500/10 px-3 py-1.5 text-xs font-semibold text-${THEME_COLOR}-200 hover:bg-${THEME_COLOR}-500/20 transition-colors`}
            aria-expanded={expanded}
          >
            {expanded ? 'Show Less' : 'Show More'}
            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-[10px]`} aria-hidden />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {visibleRows.map(({ label, value, format, country }) => (
          <div key={label} className={label === 'Drafted' || label === 'Relationships' ? 'col-span-2 sm:col-span-4' : ''}>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
            {format === 'relationships' ? (
              <div className="flex flex-wrap gap-2">
                {value.map((relative) => (
                  <Link
                    key={relative.id}
                    to={`/player/${relative.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-${THEME_COLOR}-500/50 hover:text-${THEME_COLOR}-300 transition-colors`}
                  >
                    {relative.fullName ?? relative.nameFirstLast}
                    {relative.relation && <span className="text-slate-500 font-medium">({relative.relation})</span>}
                  </Link>
                ))}
              </div>
            ) : format === 'birthplace' ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 leading-snug">
                {countryFlagUrl(country) && (
                  <img
                    src={countryFlagUrl(country)}
                    alt={`${country} flag`}
                    title={country}
                    className="h-3.5 w-5 rounded-[2px] object-cover shadow-sm ring-1 ring-white/10 flex-shrink-0"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                )}
                <span>{value}</span>
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-200 leading-snug">{value}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
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

function formatRateStat(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric.toFixed(3).replace(/^0/, '');
  const text = String(value);
  return text.startsWith('0.') ? text.slice(1) : text;
}

function formatTwoDecimalStat(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function formatWholeStat(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.round(numeric)) : String(value);
}

function isCurrentMlbTeam(team) {
  return MLB_PARENT_TEAM_IDS.has(Number(team?.id));
}

function getYearByYearSplitsFromStats(stats, group) {
  return stats?.find((s) => s.type?.displayName === 'yearByYear' && s.group?.displayName === group)?.splits ?? [];
}

function rowsFromYearByYearStats(stats, group) {
  return getYearByYearSplitsFromStats(stats, group)
    .filter((split) => split.season && split.stat)
    .map((split, index) => ({
      id: `${split.season}-${split.team?.id ?? 'total'}-${index}`,
      season: Number(split.season),
      team: split.team,
      stat: split.stat,
      isSeasonTotal: !split.team?.id,
    }));
}

function getSeasonStatFromYearByYear(stats, group, season) {
  const rows = rowsFromYearByYearStats(stats, group).filter((row) => row.season === Number(season));
  if (!rows.length) return null;
  const existingTotal = rows.find(isSeasonTotalRow);
  if (existingTotal) return existingTotal.stat;
  return computeSeasonTotalsRow(rows, group, season)?.stat ?? rows[0]?.stat ?? null;
}

function getCareerStatFromYearByYear(stats, group) {
  const rows = rowsFromYearByYearStats(stats, group);
  return computeCareerTotalsRow(rows, group)?.stat ?? null;
}

function PlayerStatSummaryCard({ playerInfo, isPitcher, stats, levelLabel = '' }) {
  const isActive = playerInfo?.active !== false;
  const group = isPitcher ? 'pitching' : 'hitting';
  const stat = isActive
    ? getSeasonStatFromYearByYear(stats, group, CURRENT_YEAR)
    : getCareerStatFromYearByYear(stats, group);
  const header = isActive
    ? `${CURRENT_YEAR} ${levelLabel ? `${levelLabel} ` : ''}STATS`
    : 'CAREER STATS';
  const headerClass = isActive
    ? `border-${THEME_COLOR}-500/25 bg-${THEME_COLOR}-500/10 text-${THEME_COLOR}-300`
    : 'border-slate-600/40 bg-slate-700/30 text-slate-300';
  const items = isPitcher
    ? [
        { label: 'W-L', value: stat ? `${stat.wins ?? 0}-${stat.losses ?? 0}` : '—' },
        { label: 'IP', value: stat?.inningsPitched ?? '—' },
        { label: 'ERA', value: formatTwoDecimalStat(stat?.era) },
        { label: 'K', value: formatWholeStat(stat?.strikeOuts) },
        { label: 'WHIP', value: formatTwoDecimalStat(stat?.whip) },
      ]
    : [
        { label: 'AB', value: formatWholeStat(stat?.atBats) },
        { label: 'AVG', value: formatRateStat(stat?.avg) },
        { label: 'HR', value: formatWholeStat(stat?.homeRuns) },
        { label: 'RBI', value: formatWholeStat(stat?.rbi) },
        { label: 'OPS', value: formatRateStat(stat?.ops) },
      ];

  return (
    <section className="px-4 pt-4 sm:px-8 sm:pt-6">
      <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-lg shadow-black/15">
        <div className={`border-b px-4 py-2 text-center ${headerClass}`}>
          <div className="text-[10px] font-black uppercase tracking-[0.22em]">
            {header}
          </div>
        </div>
        <div className="grid grid-cols-5 divide-x divide-slate-800/80 px-1 py-3 sm:py-4">
          {items.map((item) => (
            <div key={item.label} className="min-w-0 px-1.5 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-[10px]">
                {item.label}
              </div>
              <div className="mt-1 font-display text-2xl leading-none tracking-tighter text-slate-100 sm:text-3xl">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
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

function buildPlayerCareerRows(stats, group, {
  careerLevel,
  seasonHonors = {},
  includeHonors = false,
} = {}) {
  const splits = getYearByYearSplitsFromStats(stats, group).filter((sp) => sp.season && sp.stat);
  const seasonMeta = splits.reduce((acc, split) => {
    const season = split.season;
    if (!acc.has(season)) acc.set(season, { count: 0, hasTotal: false });
    const meta = acc.get(season);
    meta.count += 1;
    if (!split.team?.id) meta.hasTotal = true;
    return acc;
  }, new Map());

  return splits
    .map((sp, stintOrder) => {
      const minorsLevel = careerLevel === 'minors' ? sp.sport?.abbreviation : null;
      const meta = seasonMeta.get(sp.season);
      const showHonors =
        includeHonors &&
        (meta?.count <= 1 || !meta?.hasTotal || !sp.team?.id);
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
            badges={showHonors ? getActiveHonorBadges(seasonHonors[sp.season]) : []}
          />
        ),
        team: sp.team,
        stat: sp.stat,
      };
    })
    .sort((a, b) => compareSeasonRows(a, b, 'desc'));
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

  return mergeMinorLeagueStats(responses);
}

async function fetchPlayerDraftPick(playerId, draftYear, signal) {
  if (!playerId || !draftYear) return null;
  const data = await fetchStatsApiJson(`/api/v1/draft/${draftYear}`, {
    query: { playerId, hydrate: 'team,person' },
    signal,
    ttl: 24 * 60 * 60_000,
    retries: 1,
  });
  const rounds = data.drafts?.rounds ?? [];
  for (const round of rounds) {
    const pick = (round.picks ?? []).find((item) => Number(item.person?.id) === Number(playerId));
    if (pick) return pick;
  }
  return null;
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
  collapsibleSeasonGroups = false,
  expandAllSeasonGroups = false,
}) {
  const tableRef = useRef(null);
  const [seasonGroupOverrides, setSeasonGroupOverrides] = useState(() => new Map());
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

  const isSeasonGroupExpanded = (season) => (
    seasonGroupOverrides.has(season) ? seasonGroupOverrides.get(season) : expandAllSeasonGroups
  );

  const toggleSeasonGroup = (season) => {
    const nextExpanded = !isSeasonGroupExpanded(season);
    setSeasonGroupOverrides((prev) => {
      const next = new Map(prev);
      next.set(season, nextExpanded);
      return next;
    });
  };

  const renderRow = (row, i, {
    isFooter = false,
    isGroupedDetail = false,
    groupExpanded = false,
    isGroupedSummary = false,
    onToggleGroup,
  } = {}) => (
    <tr
      key={row.id ?? i}
      className={[
        'group border-b border-slate-800/60',
        isGroupedDetail ? 'bg-slate-950/20' : '',
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
        {isGroupedSummary ? (
          <button
            type="button"
            onClick={onToggleGroup}
            className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-white"
            aria-expanded={groupExpanded}
          >
            <i
              className={`fa-solid fa-chevron-right text-[9px] text-slate-500 transition-transform ${groupExpanded ? 'rotate-90' : ''}`}
              aria-hidden
            />
            {row.label}
          </button>
        ) : row.label}
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
                    isGroupedDetail
                      ? 'text-slate-500'
                      : isHigh
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

  const renderCollapsibleRows = () => {
    const grouped = new Map();

    for (const row of sortedRows) {
      if (!duplicateSeasons?.has(row.season)) continue;
      if (!grouped.has(row.season)) grouped.set(row.season, []);
      grouped.get(row.season).push(row);
    }

    const emittedGroupedSeasons = new Set();
    return sortedRows.flatMap((row, i) => {
      if (!duplicateSeasons?.has(row.season)) return [renderRow(row, i)];
      if (emittedGroupedSeasons.has(row.season)) return [];

      emittedGroupedSeasons.add(row.season);
      const groupRows = grouped.get(row.season) ?? [];
      const summaryRow = groupRows.find(isSeasonTotalRow) ?? groupRows[0];
      const detailRows = groupRows.filter((item) => item !== summaryRow);
      const expanded = isSeasonGroupExpanded(row.season);

      return [
        renderRow(summaryRow, `${row.season}-summary`, {
          groupExpanded: expanded,
          isGroupedSummary: true,
          onToggleGroup: () => toggleSeasonGroup(row.season),
        }),
        ...(expanded
          ? detailRows.map((detailRow, detailIdx) =>
              renderRow(detailRow, `${row.season}-detail-${detailRow.id ?? detailIdx}`, { isGroupedDetail: true }),
            )
          : []),
      ];
    }).filter(Boolean);
  };

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
          {collapsibleSeasonGroups ? renderCollapsibleRows() : sortedRows.map((row, i) => renderRow(row, i))}
          {footerRow && renderRow(footerRow, 'footer', { isFooter: true })}
        </tbody>
      </table>
    </div>
  );
}

function SplitColumnHeaders({ as = 'th', splitLabel = 'Split', className = '', cols = SPLIT_DISPLAY_COLS }) {
  const Cell = as;
  return (
    <tr className={`text-slate-500 border-b border-slate-700/60 ${className}`}>
      <Cell className={`${scrollStickyHead('bg-[#121827]', { stickTop: true })} font-normal`}>
        {splitLabel}
      </Cell>
      {cols.map((c) => (
        <Cell key={c.key} className={`${scrollStatHead('text-center font-normal', { align: 'text-center', stickTop: true })}`}>
          {c.label}
        </Cell>
      ))}
    </tr>
  );
}

function SplitsTable({ sections, cols = SPLIT_DISPLAY_COLS, emptyMessage = 'No splits available' }) {
  const hasRows = sections?.some((s) => s.rows?.length);
  if (!hasRows) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  return (
    <div className={TABLE_SCROLL_BODY}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.lg}`}>
        <thead>
          <SplitColumnHeaders cols={cols} className="text-slate-400" />
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-slate-800/50">
                <td
                  colSpan={cols.length + 1}
                  className="py-2 px-3 text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-800/95 border-y border-slate-700/50"
                >
                  {section.title}
                </td>
              </tr>
              <SplitColumnHeaders as="td" splitLabel="" cols={cols} className="text-[10px] text-slate-600" />
              {section.rows.map((row, i) => (
                <tr key={row.id ?? `${section.title}-${i}`} className="group border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className={`${scrollStickyCell('bg-[#121827]')} z-[1] pl-4 text-slate-200`}>
                    {row.label}
                  </td>
                  {cols.map((c) => (
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

const isCashTradeItem = (txn) => /cash/i.test(`${txn?.description ?? ''} ${txn?.typeDesc ?? ''}`);

const formatCashTransactionText = (text = '') => {
  if (!text || text.includes('💵')) return text;
  return text
    .replace(/\bcash considerations\b/gi, '💵 Cash Considerations')
    .replace(/\bcash\b/gi, '💵 Cash');
};

function txnApiDateParam(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

async function fetchTradeBundle(txn) {
  if (isHistoricalTrade(txn)) {
    return getHistoricalTradeBundle(txn);
  }

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
    if (!t.toTeam?.id) continue;
    const key = t.toTeam.id;
    if (!byToTeam.has(key)) {
      byToTeam.set(key, { team: t.toTeam, players: [] });
    }
    const bucket = byToTeam.get(key);
    if (t.person?.id && !bucket.players.some((p) => p.id === t.person.id)) {
      bucket.players.push(t.person);
    } else if (!t.person?.id && isCashTradeItem(t) && !bucket.players.some((p) => p.cash)) {
      bucket.players.push({ id: `cash-${t.toTeam.id}`, fullName: '💵 Cash Considerations', cash: true });
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
    `https://statsapi.mlb.com/api/v1/transactions?playerId=${playerId}&startDate=${formatTxnApiDate(start)}&endDate=${formatTxnApiDate(today)}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return sortTransactions(json.transactions);
}

function sortTransactions(transactions = []) {
  return [...transactions].sort(
    (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0),
  );
}

function transactionDedupeKey(txn) {
  const person = txn.person?.id ?? txn.person?.retroId ?? txn.person?.fullName ?? 'asset';
  const from = txn.fromTeam?.id ?? txn.fromTeam?.retroCode ?? txn.fromTeam?.name ?? 'from';
  const to = txn.toTeam?.id ?? txn.toTeam?.retroCode ?? txn.toTeam?.name ?? 'to';
  return `${txn.date ?? ''}:${txn.typeCode ?? txn.typeDesc ?? ''}:${person}:${from}:${to}`;
}

function mergeTransactions(...groups) {
  const seen = new Set();
  const rows = [];
  for (const txn of groups.flat()) {
    const key = transactionDedupeKey(txn);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(txn);
  }
  return sortTransactions(rows);
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
  if (person?.cash) {
    return <span className="text-slate-300">💵 Cash Considerations</span>;
  }
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
  const isTrade = txn ? isTradeTransaction(txn) : false;
  const tradeGroups = isTrade ? groupTradePlayers(tradeBundle) : [];

  return (
    <BottomSheetModal
      open={Boolean(txn)}
      onClose={onClose}
      historyKey="playerTransactionDetail"
    >
      {txn && (
        <>
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
                                {person.cash ? (
                                  <span className="flex w-8 h-8 items-center justify-center rounded-full bg-emerald-500/10 text-base flex-shrink-0" aria-hidden>
                                    💵
                                  </span>
                                ) : (
                                  <img
                                    src={playerHeadshotUrl(person.id)}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover bg-slate-700 flex-shrink-0"
                                  />
                                )}
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
                {formatCashTransactionText(txn.description)}
              </p>
            )}
          </div>
        </>
      )}
    </BottomSheetModal>
  );
}

function PlayerTransactionsTab({ playerId, playerInfo }) {
  const navigate = useNavigate();
  const restoredTxnRef = useRef(null);
  const savedTxnReturn = useMemo(() => readTxnSheetReturn(playerId), [playerId]);
  const [txns, setTxns] = useState([]);
  const [txnFilter, setTxnFilter] = useState('all');
  const [usingProfileTransactions, setUsingProfileTransactions] = useState(false);
  const [yearsBack, setYearsBack] = useState(() => Math.max(
    TXN_INITIAL_YEARS,
    Number(savedTxnReturn?.yearsBack) || TXN_INITIAL_YEARS,
  ));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [tradeBundle, setTradeBundle] = useState([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [allTradeTxns, setAllTradeTxns] = useState(null);
  const [historicalTradeTxns, setHistoricalTradeTxns] = useState([]);
  const [tradeLookupLoading, setTradeLookupLoading] = useState(false);

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

        const fallbackTxns = sortTransactions(playerInfo?.transactions ?? []);
        const usingFallback = !sorted.length && fallbackTxns.length > 0;
        const displayTxns = sorted.length ? sorted : fallbackTxns;
        setTxns(displayTxns);
        setUsingProfileTransactions(usingFallback);

        if (!savedTxnReturn?.txnKey || restoredTxnRef.current === savedTxnReturn.txnKey) return;
        const txn = displayTxns.find((item) => transactionRestoreKey(item) === savedTxnReturn.txnKey) ?? savedTxnReturn.txn;
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
  }, [openTransaction, playerId, playerInfo, savedTxnReturn, yearsBack]);

  useEffect(() => {
    setAllTradeTxns(null);
    setHistoricalTradeTxns([]);
    let cancelled = false;
    setTradeLookupLoading(true);

    if (!playerId) {
      setTradeLookupLoading(false);
      return undefined;
    }

    (async () => {
      try {
        const [modernResult, historicalResult] = await Promise.allSettled([
          fetchPlayerTransactions(playerId, TXN_MAX_YEARS),
          getHistoricalTradesForPlayer(playerId),
        ]);
        if (cancelled) return;
        const fullHistory = modernResult.status === 'fulfilled' ? modernResult.value : [];
        const historicalTrades = historicalResult.status === 'fulfilled' ? historicalResult.value : [];
        if (modernResult.status === 'rejected' && historicalResult.status === 'rejected') {
          throw modernResult.reason;
        }
        const historical = sortTransactions(historicalTrades);
        setHistoricalTradeTxns(historical);
        setAllTradeTxns(mergeTransactions(fullHistory.filter(isTradeTransaction), historical));
      } catch {
        if (!cancelled) {
          setAllTradeTxns(null);
          setHistoricalTradeTxns([]);
        }
      } finally {
        if (!cancelled) setTradeLookupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const canLoadMore = !usingProfileTransactions && yearsBack < TXN_MAX_YEARS;
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

  const mergedTxns = mergeTransactions(txns, historicalTradeTxns);
  const loadedTradeTxns = mergedTxns.filter(isTradeTransaction);
  const tradeTxns = allTradeTxns ?? loadedTradeTxns;
  const visibleTxns = txnFilter === 'trades' ? tradeTxns : mergedTxns;
  const tradeCount = tradeTxns.length;
  const hiddenTradeCount = Math.max(0, tradeCount - txns.filter(isTradeTransaction).length);
  const tradeLabel = tradeLookupLoading && allTradeTxns == null ? 'Trades…' : `Trades (${tradeCount})`;
  const showLoadMore = canLoadMore && txnFilter !== 'trades';

  if (!mergedTxns.length && !tradeTxns.length && !tradeLookupLoading) {
    return <div className="text-slate-500 text-sm text-center py-12">No transactions found.</div>;
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2">
        <div className="text-xs text-slate-500">
          Showing {visibleTxns.length} of {txnFilter === 'trades' ? tradeCount : mergedTxns.length}
          {txnFilter === 'trades' ? ' trade moves' : ' transactions'}
        </div>
        <div className="flex rounded-2xl border border-slate-700 bg-slate-800 p-1">
          <SegmentedControl
            value={txnFilter}
            onChange={setTxnFilter}
            size="sm"
            options={[
              { value: 'all', label: 'All' },
              { value: 'trades', label: tradeLabel },
            ]}
          />
        </div>
      </div>

      <div className="space-y-1">
        {visibleTxns.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-sm">
            {tradeLookupLoading ? 'Searching full transaction history for trades…' : 'No trades found.'}
          </div>
        )}
        {visibleTxns.map((t, i) => {
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
                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{formatCashTransactionText(t.description)}</div>
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

      {txnFilter === 'trades' && hiddenTradeCount > 0 && (
        <div className="px-4 pt-3 text-center text-[11px] text-slate-500">
          Showing {hiddenTradeCount} older {hiddenTradeCount === 1 ? 'trade' : 'trades'} from full history.
        </div>
      )}

      {showLoadMore && (
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
  const navigate = useNavigate();
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const monthSections = useMemo(() => buildGameLogMonthSections(rows, logGroup), [rows, logGroup]);
  const glossary = logGroup === 'pitching' ? GAME_LOG_PITCH_GLOSSARY : GAME_LOG_HIT_GLOSSARY;

  if (!rows?.length) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  const gameLogDateWidth = 'w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem]';
  const gameLogAfterDateLeft = 'left-[3.25rem]';
  const gameLogOppWidth = 'w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem]';
  const dateStickyHead = scrollStickyDateHead('bg-[#121827]', {
    stickTop: true,
    widthClass: gameLogDateWidth,
  });
  const dateStickyCell = scrollStickyDateCell('bg-[#121827]', {
    widthClass: gameLogDateWidth,
  });
  const oppStickyHead = scrollStickyTeamAfterDateHead('bg-[#121827]', {
    stickTop: true,
    left: gameLogAfterDateLeft,
    widthClass: gameLogOppWidth,
  });
  const oppStickyCell = scrollStickyTeamAfterDateCell('bg-[#121827]', {
    left: gameLogAfterDateLeft,
    widthClass: gameLogOppWidth,
  });
  const monthStickyDateCell = scrollStickyDateCell('bg-[#182030]', {
    footer: true,
    widthClass: gameLogDateWidth,
  });
  const monthStickyOppCell = scrollStickyTeamAfterDateCell('bg-[#182030]', {
    footer: true,
    left: gameLogAfterDateLeft,
    widthClass: gameLogOppWidth,
  });
  const syncScroll = (source, target) => {
    if (!target.current) return;
    if (target.current.scrollLeft === source.currentTarget.scrollLeft) return;
    target.current.scrollLeft = source.currentTarget.scrollLeft;
  };
  const renderHeader = ({ sticky = false } = {}) => (
    <thead className={sticky ? '' : 'sr-only'}>
      <tr className="text-slate-500 border-b border-slate-700/60">
        {cols.map((c, i) => (
          <th
            key={c.key}
            className={[
              'font-normal whitespace-nowrap bg-[#121827]',
              i === 0
                ? dateStickyHead
                : i === 1
                  ? `${oppStickyHead} pr-4 shadow-[6px_0_10px_-8px_rgba(0,0,0,0.9)]`
                  : scrollStatHead('text-center', { align: 'text-center', stickTop: true }),
            ].join(' ')}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div>
      <div
        ref={headerScrollRef}
        className="sticky top-14 z-40 -mx-1 overflow-x-auto overflow-y-hidden rounded-t-xl border-x border-t border-slate-800/60 scrollbar-none sm:top-0"
        onScroll={(event) => syncScroll(event, bodyScrollRef)}
      >
        <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} min-w-max`}>
          {renderHeader({ sticky: true })}
        </table>
      </div>
      <div
        ref={bodyScrollRef}
        className="-mx-1 overflow-x-auto rounded-b-xl border border-slate-800/60 scrollbar-thin"
        onScroll={(event) => syncScroll(event, headerScrollRef)}
      >
        <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} min-w-max`}>
          {renderHeader()}
          <tbody>
            {monthSections.map((section) => (
              <Fragment key={section.key}>
                {section.rows.map((row, i) => (
                  <tr
                    key={row.id ?? `${section.key}-${i}`}
                    tabIndex={row.gamePk ? 0 : undefined}
                    role={row.gamePk ? 'button' : undefined}
                    onClick={row.gamePk ? () => navigate(`/game/${row.gamePk}`) : undefined}
                    onKeyDown={row.gamePk
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/game/${row.gamePk}`);
                          }
                        }
                      : undefined}
                    className={[
                      'group border-b border-slate-800/60 hover:bg-slate-800/20',
                      row.gamePk ? 'cursor-pointer focus:outline-none focus:bg-slate-800/30' : '',
                    ].join(' ')}
                  >
                    {cols.map((c, j) => {
                      const value = row[c.key] ?? row.stat?.[c.key];
                      return (
                        <td
                          key={c.key}
                          className={[
                            j === 0
                              ? `${dateStickyCell} font-semibold text-slate-200`
                              : j === 1
                                ? `${oppStickyCell} pr-4 shadow-[6px_0_10px_-8px_rgba(0,0,0,0.9)]`
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
                              ? monthStickyDateCell
                              : j === 1
                                ? `${monthStickyOppCell} pr-4 shadow-[6px_0_10px_-8px_rgba(0,0,0,0.9)] text-[10px] font-bold text-slate-300 uppercase tracking-widest`
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

function PlayerGameLogsPanel({
  playerId,
  playerInfo,
  logLevel,
  logGroup,
  logSeason,
  gameLogCols,
}) {
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
        gameType: 'R,P',
      });

      try {
        const data = await fetchPlayerStats(playerId, params.toString(), logLevel);
        let splits = data.stats?.find((s) => s.type?.displayName === 'gameLog')?.splits ?? [];
        splits = [...splits].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (!cancelled) {
          setRows(
            splits.map((sp, i) => ({
              id: `${sp.date}-${sp.game?.gamePk ?? i}`,
              gamePk: sp.game?.gamePk,
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
      emptyMessage={`No game logs for ${logSeason}.`}
    />
  );
}

function PlayerSplitsPanel({ playerId, playerInfo, splitLevel, splitGroup, splitSeason }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId || !playerInfo) return undefined;

    let cancelled = false;
    setLoading(true);
    const loadSplits = async () => {
      try {
        const nextSections = await fetchPlayerSplitSections(playerId, splitSeason, splitLevel, splitGroup);
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
  }, [playerId, playerInfo, splitGroup, splitLevel, splitSeason]);

  if (loading) {
    return <LoadingSpinner size="md" py="py-12" />;
  }

  const cols = splitGroup === 'pitching' ? PITCHING_SPLIT_DISPLAY_COLS : SPLIT_DISPLAY_COLS;
  const label = splitGroup === 'pitching' ? 'pitching' : 'batting';

  return (
    <SplitsTable
      cols={cols}
      sections={sections}
      emptyMessage={`No ${label} splits for ${splitSeason} regular season.`}
    />
  );
}

function bvpSearchSort(expectedPitcher) {
  return (a, b) => {
    const aPitcher = isPitcherPosition(a.primaryPosition?.abbreviation);
    const bPitcher = isPitcherPosition(b.primaryPosition?.abbreviation);
    if (aPitcher !== bPitcher) return aPitcher === expectedPitcher ? -1 : 1;
    const currentMlbDiff = Number(isCurrentMlbTeam(b.currentTeam)) - Number(isCurrentMlbTeam(a.currentTeam));
    if (currentMlbDiff !== 0) return currentMlbDiff;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return String(a.fullName ?? '').localeCompare(String(b.fullName ?? ''));
  };
}

function bvpPersonMeta(person = {}) {
  const team = person.currentTeam;
  return {
    id: person.id,
    fullName: person.fullName ?? 'Unknown Player',
    position: person.primaryPosition?.abbreviation ?? '',
    teamName: team?.name ?? team?.teamName ?? '',
    teamId: team?.id,
    active: person.active,
  };
}

function bvpPersonMetaWithTeam(person = {}, team = null) {
  const meta = bvpPersonMeta(person);
  if (!team) return meta;
  return {
    ...meta,
    teamId: team.id ?? meta.teamId,
    teamName: team.name ?? team.teamName ?? meta.teamName,
  };
}

function bvpStatCards(stat = {}) {
  return [
    { label: 'AB', value: formatWholeStat(stat.atBats) },
    { label: 'H', value: formatWholeStat(stat.hits) },
    { label: 'AVG', value: formatRateStat(stat.avg) },
    { label: 'OPS', value: formatRateStat(stat.ops) },
    { label: 'HR', value: formatWholeStat(stat.homeRuns) },
    { label: 'RBI', value: formatWholeStat(stat.rbi) },
    { label: 'BB', value: formatWholeStat(stat.baseOnBalls) },
    { label: 'K', value: formatWholeStat(stat.strikeOuts) },
  ];
}

function isoDateOffset(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function bvpGameTeamSlot(game, teamId) {
  const awayId = Number(game?.teams?.away?.team?.id);
  const homeId = Number(game?.teams?.home?.team?.id);
  if (awayId === Number(teamId)) return 'away';
  if (homeId === Number(teamId)) return 'home';
  return null;
}

function bvpNextGameContext(game, playerTeamId) {
  const playerSlot = bvpGameTeamSlot(game, playerTeamId);
  if (!playerSlot) return null;
  const opponentSlot = playerSlot === 'away' ? 'home' : 'away';
  const playerTeam = game.teams?.[playerSlot]?.team;
  const opponentTeam = game.teams?.[opponentSlot]?.team;
  const opposingProbable = game.teams?.[opponentSlot]?.probablePitcher;
  const ownProbable = game.teams?.[playerSlot]?.probablePitcher;

  return {
    gamePk: game.gamePk,
    gameDate: game.officialDate,
    detailedState: game.status?.detailedState,
    playerTeam,
    opponentTeam,
    opposingProbable,
    ownProbable,
  };
}

async function fetchBvpStats({ batterId, pitcherId, scope }) {
  const data = await fetchStatsApiJson(`/api/v1/people/${batterId}/stats`, {
    query: {
      stats: 'vsPlayerTotal',
      group: 'hitting',
      opposingPlayerId: pitcherId,
      ...(scope === 'season' ? { season: CURRENT_YEAR } : {}),
    },
    ttl: 10 * 60_000,
    retries: 1,
  });
  return data.stats?.find((block) => block.type?.displayName === 'vsPlayerTotal')?.splits?.[0] ?? null;
}

function PlayerBvpTab({ playerInfo }) {
  const playerInfoId = playerInfo?.id;
  const playerCurrentTeam = playerInfo?.currentTeam;
  const currentIsPitcher = isPitcherPosition(playerInfo?.primaryPosition?.abbreviation);
  const expectedOpponentPitcher = !currentIsPitcher;
  const opponentLabel = expectedOpponentPitcher ? 'pitcher' : 'batter';
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('career');
  const [results, setResults] = useState([]);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [searchState, setSearchState] = useState({ loading: false, message: '' });
  const [matchupState, setMatchupState] = useState({ loading: false, split: null, error: '' });
  const [nextGameState, setNextGameState] = useState({ loading: false, context: null, message: '' });
  const requestIdRef = useRef(0);

  const loadMatchup = useCallback(async (opponent, nextScope = scope) => {
    if (!playerInfoId || !opponent?.id) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const batterId = currentIsPitcher ? opponent.id : playerInfoId;
    const pitcherId = currentIsPitcher ? playerInfoId : opponent.id;
    setSelectedOpponent(opponent);
    setMatchupState({ loading: true, split: null, error: '' });

    try {
      const split = await fetchBvpStats({ batterId, pitcherId, scope: nextScope });
      if (requestIdRef.current !== requestId) return;
      setMatchupState({
        loading: false,
        split,
        error: split?.stat ? '' : `No ${nextScope === 'season' ? CURRENT_YEAR : 'career'} matchup plate appearances found.`,
      });
    } catch {
      if (requestIdRef.current !== requestId) return;
      setMatchupState({ loading: false, split: null, error: 'Could not load batter vs pitcher stats.' });
    }
  }, [currentIsPitcher, playerInfoId, scope]);

  const handleSearch = async (event) => {
    event?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchState({ loading: false, message: 'Type at least 2 characters.' });
      setResults([]);
      return;
    }

    setSearchState({ loading: true, message: `Searching ${opponentLabel}s...` });
    try {
      const data = await fetchStatsApiJson('/api/v1/people/search', {
        query: {
          names: trimmed,
          sportIds: BVP_SEARCH_SPORT_IDS,
          hydrate: 'currentTeam',
        },
        ttl: 5 * 60_000,
        retries: 1,
      });
      const people = (data.people ?? [])
        .filter((person) => Number(person.id) !== Number(playerInfo?.id))
        .sort(bvpSearchSort(expectedOpponentPitcher));
      const roleMatches = people.filter((person) => isPitcherPosition(person.primaryPosition?.abbreviation) === expectedOpponentPitcher);
      const mapped = (roleMatches.length ? roleMatches : people).slice(0, 8).map(bvpPersonMeta);
      setResults(mapped);
      setSearchState({
        loading: false,
        message: mapped.length ? `${mapped.length} result${mapped.length === 1 ? '' : 's'} found.` : 'No players found.',
      });
    } catch {
      setResults([]);
      setSearchState({ loading: false, message: 'Search failed. Try again.' });
    }
  };

  const handleScopeChange = (nextScope) => {
    setScope(nextScope);
    if (selectedOpponent) loadMatchup(selectedOpponent, nextScope);
  };

  useEffect(() => {
    const teamId = playerCurrentTeam?.id;
    if (!teamId || !isCurrentMlbTeam(playerCurrentTeam)) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    fetchStatsApiJson('/api/v1/schedule', {
      query: {
        sportId: 1,
        teamId,
        startDate: isoDateOffset(0),
        endDate: isoDateOffset(14),
        hydrate: 'probablePitcher,team',
      },
      signal: controller.signal,
      ttl: 5 * 60_000,
      retries: 1,
    })
      .then((data) => {
        if (cancelled) return;
        const game = (data.dates ?? []).flatMap((dateRow) => dateRow.games ?? [])[0];
        const context = game ? bvpNextGameContext(game, teamId) : null;
        setNextGameState({
          loading: false,
          context,
          message: context ? '' : 'No upcoming MLB game found in the next two weeks.',
        });

        if (!currentIsPitcher && context?.opposingProbable?.id) {
          const opponent = bvpPersonMetaWithTeam(context.opposingProbable, context.opponentTeam);
          setResults((current) => (
            current.some((row) => Number(row.id) === Number(opponent.id)) ? current : [opponent, ...current].slice(0, 8)
          ));
          loadMatchup(opponent);
          setSearchState({ loading: false, message: 'Loaded the announced opposing probable pitcher.' });
        }
      })
      .catch(() => {
        if (!cancelled) setNextGameState({ loading: false, context: null, message: 'Could not load next matchup.' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentIsPitcher, loadMatchup, playerCurrentTeam]);

  const batter = currentIsPitcher ? selectedOpponent : bvpPersonMeta(playerInfo);
  const pitcher = currentIsPitcher ? bvpPersonMeta(playerInfo) : selectedOpponent;
  const stat = matchupState.split?.stat;
  const hasMatchup = Boolean(stat?.plateAppearances || stat?.atBats);
  const nextContext = nextGameState.context;
  const nextGameUnavailableMessage =
    !playerCurrentTeam?.id || !isCurrentMlbTeam(playerCurrentTeam)
      ? 'Next matchup is only available for current MLB players.'
      : nextGameState.message;
  const nextProbable = nextContext?.opposingProbable
    ? bvpPersonMetaWithTeam(nextContext.opposingProbable, nextContext.opponentTeam)
    : null;

  return (
    <div className="mx-2 my-4 space-y-4 sm:mx-0">
      <section className="rounded-3xl border border-slate-800/80 bg-slate-900/45 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
              Batter vs. Pitcher
            </div>
            <div className="mt-1 text-xl font-black text-white">
              Search a {opponentLabel} to compare against {playerInfo?.fullName}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Stats are shown from the batter&apos;s perspective.
            </div>
          </div>
          <SegmentedControl
            value={scope}
            onChange={handleScopeChange}
            options={[
              { value: 'career', label: 'Career' },
              { value: 'season', label: String(CURRENT_YEAR) },
            ]}
            className="w-full sm:w-56"
          />
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-600" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${opponentLabel}s...`}
              className="h-11 w-full rounded-2xl border border-slate-800 bg-slate-950/70 pl-9 pr-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <button
            type="submit"
            disabled={searchState.loading}
            className="h-11 rounded-2xl bg-blue-500 px-4 text-sm font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searchState.loading ? 'Searching' : 'Search'}
          </button>
        </form>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                Next Matchup
              </div>
              {nextGameState.loading ? (
                <div className="mt-1 h-5 w-48 animate-pulse rounded-full bg-slate-800/70" />
              ) : nextContext ? (
                <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-black text-slate-100">
                  {nextContext.opponentTeam?.id && (
                    <img src={teamLogoUrl(nextContext.opponentTeam.id)} alt="" className="h-6 w-6 object-contain" />
                  )}
                  <span className="truncate">
                    vs {nextContext.opponentTeam?.name ?? 'Opponent'} · {fmtDate(nextContext.gameDate)}
                  </span>
                  {nextContext.detailedState && (
                    <span className="hidden text-xs font-semibold text-slate-600 sm:inline">{nextContext.detailedState}</span>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-sm font-semibold text-slate-500">{nextGameUnavailableMessage}</div>
              )}
              {!currentIsPitcher && nextContext && !nextProbable && (
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Opposing probable pitcher has not been announced yet.
                </div>
              )}
              {currentIsPitcher && nextContext && (
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Search an opposing hitter from {nextContext.opponentTeam?.teamName ?? nextContext.opponentTeam?.name ?? 'the opponent'} to view BvP.
                </div>
              )}
            </div>
            {!currentIsPitcher && nextProbable && (
              <button
                type="button"
                onClick={() => loadMatchup(nextProbable)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/40 bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-100 transition hover:bg-blue-500/25"
              >
                <img src={playerHeadshotUrl(nextProbable.id)} alt="" className="h-7 w-7 rounded-full bg-slate-800 object-cover" />
                <span className="text-left">
                  <span className="block leading-tight">Use Probable</span>
                  <span className="block leading-tight text-blue-200/70">{nextProbable.fullName}</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {(searchState.message || results.length > 0) && (
          <div className="mt-3">
            {searchState.message && (
              <div className="mb-2 text-xs font-semibold text-slate-500">{searchState.message}</div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => loadMatchup(person)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    Number(selectedOpponent?.id) === Number(person.id)
                      ? 'border-blue-400/60 bg-blue-500/15'
                      : 'border-slate-800 bg-slate-950/35 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <img
                    src={playerHeadshotUrl(person.id)}
                    alt=""
                    className="h-11 w-11 rounded-full bg-slate-800 object-cover"
                    onError={(event) => {
                      event.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-100">{person.fullName}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      {person.teamId && <img src={teamLogoUrl(person.teamId)} alt="" className="h-4 w-4 object-contain" />}
                      <span className="truncate">{person.teamName || 'No team'}</span>
                      {person.position && <span className="text-slate-600">• {person.position}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {selectedOpponent && (
        <section className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/45">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-800/80 bg-slate-950/35 px-4 py-4">
            {[batter, pitcher].map((person, index) => (
              <div key={`${person?.id}-${index}`} className={`flex min-w-0 items-center gap-3 ${index === 1 ? 'justify-end text-right' : ''}`}>
                {index === 1 && (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{person?.fullName}</div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pitcher</div>
                  </div>
                )}
                <img
                  src={playerHeadshotUrl(person?.id)}
                  alt=""
                  className="h-12 w-12 rounded-full bg-slate-800 object-cover"
                  onError={(event) => {
                    event.currentTarget.style.visibility = 'hidden';
                  }}
                />
                {index === 0 && (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{person?.fullName}</div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Batter</div>
                  </div>
                )}
              </div>
            ))}
            <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-200">
              vs
            </div>
          </div>

          {matchupState.loading ? (
            <div className="p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-800/60" />
                ))}
              </div>
            </div>
          ) : hasMatchup ? (
            <div className="grid grid-cols-2 gap-px bg-slate-800/80 sm:grid-cols-4">
              {bvpStatCards(stat).map((item) => (
                <div key={item.label} className="bg-slate-950/40 px-4 py-3 text-center">
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">{item.label}</div>
                  <div className="mt-1 font-display text-2xl text-white tabular-nums">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                <i className="fa-solid fa-user-slash" aria-hidden />
              </div>
              <div className="mt-3 text-sm font-black text-slate-200">No matchup history</div>
              <div className="mt-1 text-sm text-slate-500">{matchupState.error}</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const REWARD_STYLES = {
  MVP: { icon: 'fa-crown', tone: 'border-yellow-400/35 bg-yellow-500/10 text-yellow-100', text: 'text-yellow-200' },
  'Postseason MVP': { icon: 'fa-trophy', tone: 'border-orange-400/35 bg-orange-500/10 text-orange-100', text: 'text-orange-200' },
  'Club MVP': { icon: 'fa-flag', tone: 'border-red-400/35 bg-red-500/10 text-red-100', text: 'text-red-200' },
  'Cy Young': { icon: 'fa-baseball', tone: 'border-sky-400/35 bg-sky-500/10 text-sky-100', text: 'text-sky-200' },
  'Gold Glove': { icon: 'fa-shield-halved', tone: 'border-amber-400/35 bg-amber-500/10 text-amber-100', text: 'text-amber-200' },
  'Silver Slugger': { icon: 'fa-baseball-bat-ball', tone: 'border-slate-300/35 bg-slate-300/10 text-slate-100', text: 'text-slate-200' },
  Rookie: { icon: 'fa-star', tone: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100', text: 'text-emerald-200' },
  'All-Star': { icon: 'fa-star', tone: 'border-blue-400/35 bg-blue-500/10 text-blue-100', text: 'text-blue-200' },
  'MiLB Honor': { icon: 'fa-medal', tone: 'border-violet-400/35 bg-violet-500/10 text-violet-100', text: 'text-violet-200' },
  'MLB.com Award': { icon: 'fa-medal', tone: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100', text: 'text-cyan-200' },
  'Hot Streak': { icon: 'fa-bolt', tone: 'border-orange-400/35 bg-orange-500/10 text-orange-100', text: 'text-orange-200' },
  Honor: { icon: 'fa-award', tone: 'border-slate-600 bg-slate-800/60 text-slate-200', text: 'text-slate-400' },
};

const REGULAR_SEASON_MAJOR_AWARD_IDS = new Map([
  ['ALMVP', 'MVP'],
  ['NLMVP', 'MVP'],
  ['ALCY', 'Cy Young'],
  ['NLCY', 'Cy Young'],
  ['ALGG', 'Gold Glove'],
  ['NLGG', 'Gold Glove'],
  ['ALSS', 'Silver Slugger'],
  ['NLSS', 'Silver Slugger'],
  ['ALROY', 'Rookie'],
  ['NLROY', 'Rookie'],
  ['ALAS', 'All-Star'],
  ['NLAS', 'All-Star'],
]);

function rewardStyle(label) {
  return REWARD_STYLES[label] ?? REWARD_STYLES.Honor;
}

function makeRewardMeta(label, bucket = 'other') {
  return { label, bucket, ...rewardStyle(label) };
}

function rewardMeta(award = {}) {
  const id = String(award.id ?? '').toUpperCase();
  const name = String(award.name ?? '');
  const text = `${id} ${name}`.toLowerCase();

  if (REGULAR_SEASON_MAJOR_AWARD_IDS.has(id)) {
    return makeRewardMeta(REGULAR_SEASON_MAJOR_AWARD_IDS.get(id), 'regular');
  }
  if (/^(ALCS|NLCS|WS)MVP$/.test(id) || /world series mvp|league championship series mvp|\b(alcs|nlcs) mvp\b/.test(text)) {
    return makeRewardMeta('Postseason MVP', 'postseason');
  }
  if (/^[A-Z]{2,5}MVP$/.test(id) || /team mvp|club mvp|rangers mvp/.test(text)) {
    return makeRewardMeta('Club MVP', 'club');
  }
  if (/mlb\.com|mlbcom/.test(text)) {
    return makeRewardMeta('MLB.com Award');
  }
  if (/most valuable player|\bmvp\b/.test(text)) {
    return makeRewardMeta('MVP');
  }
  if (id.endsWith('CY') || /cy young/.test(text)) {
    return makeRewardMeta('Cy Young', REGULAR_SEASON_MAJOR_AWARD_IDS.has(id) ? 'regular' : 'other');
  }
  if (id.endsWith('GG') || /gold glove/.test(text)) {
    return makeRewardMeta('Gold Glove', REGULAR_SEASON_MAJOR_AWARD_IDS.has(id) ? 'regular' : 'other');
  }
  if (id.endsWith('SS') || /silver slugger/.test(text)) {
    return makeRewardMeta('Silver Slugger', REGULAR_SEASON_MAJOR_AWARD_IDS.has(id) ? 'regular' : 'other');
  }
  if (id.endsWith('ROY') || /rookie of the year/.test(text)) {
    return makeRewardMeta('Rookie', REGULAR_SEASON_MAJOR_AWARD_IDS.has(id) ? 'regular' : 'other');
  }
  if (/milb|minor league|futures game|mid-season all-star|post-season all-star|baseball america.*all-star|organization all-star|triple-a all-star|class a all-star/.test(text)) {
    return makeRewardMeta('MiLB Honor');
  }
  if (id.endsWith('AS') || /all-star|all star/.test(text)) {
    return makeRewardMeta('All-Star', REGULAR_SEASON_MAJOR_AWARD_IDS.has(id) ? 'regular' : 'other');
  }
  if (/player of the week|player of the month/.test(text)) {
    return makeRewardMeta('Hot Streak');
  }
  return makeRewardMeta('Honor');
}

function normalizeRewardTeamName(team) {
  return team?.name ?? team?.teamName ?? team?.shortName ?? '—';
}

function awardRowGames(row = {}) {
  return Number(row.stat?.gamesPlayed ?? row.stat?.games ?? row.stat?.gamesPitched ?? 0) || 0;
}

function resolveAwardDisplayTeam(award = {}, seasonRows = []) {
  if (!award.season) return award.team;
  const rows = seasonRows.filter((row) => String(row.season) === String(award.season) && row.team?.id && !isSeasonTotalRow(row));
  if (!rows.length) return award.team;
  if (award.team?.id && rows.some((row) => Number(row.team.id) === Number(award.team.id))) return award.team;
  return [...rows].sort((a, b) => awardRowGames(b) - awardRowGames(a))[0]?.team ?? award.team;
}

function isMvpAwardMeta(meta = {}) {
  return /\bMVP\b/.test(meta.label);
}

function shouldShowAwardSeasonStats(award = {}, meta = {}) {
  if (isMvpAwardMeta(meta)) return true;
  const text = `${award.id ?? ''} ${award.name ?? ''}`.toLowerCase();
  if (/of the week|of the month/.test(text)) return false;
  return /of the year|outstanding pitcher|cy young|comeback player|hank aaron|reliever/.test(text);
}

function pickAwardSeasonRow(award = {}, rows = [], displayTeam = null) {
  if (!award.season || !rows.length) return null;
  const matchingSeason = rows.filter((row) => String(row.season) === String(award.season));
  if (!matchingSeason.length) return null;
  const teamRows = matchingSeason.filter((row) => row.team?.id && !isSeasonTotalRow(row));
  if (displayTeam?.id) {
    const teamMatch = teamRows.find((row) => Number(row.team.id) === Number(displayTeam.id));
    if (teamMatch) return teamMatch;
  }
  const totalRow = matchingSeason.find((row) => isSeasonTotalRow(row));
  if (totalRow) return totalRow;
  return [...teamRows].sort((a, b) => awardRowGames(b) - awardRowGames(a))[0] ?? null;
}

function awardSeasonStatItems(row, group) {
  const stat = row?.stat;
  if (!stat) return [];
  return awardStatItems(stat, group);
}

function awardStatItems(stat, group) {
  if (!stat) return [];
  if (group === 'pitching') {
    return [
      { label: 'W-L', value: `${formatWholeStat(stat.wins)}-${formatWholeStat(stat.losses)}` },
      { label: 'ERA', value: formatTwoDecimalStat(stat.era) },
      { label: 'IP', value: stat.inningsPitched ?? '—' },
      { label: 'K', value: formatWholeStat(stat.strikeOuts) },
      { label: 'WHIP', value: formatTwoDecimalStat(stat.whip) },
    ];
  }
  return [
    { label: 'AVG', value: formatRateStat(stat.avg) },
    { label: 'HR', value: formatWholeStat(stat.homeRuns) },
    { label: 'RBI', value: formatWholeStat(stat.rbi) },
    { label: 'OPS', value: formatRateStat(stat.ops) },
    { label: 'WAR', value: stat.war ?? stat.warOffensive ?? '—' },
  ];
}

function awardPostseasonGameType(award = {}) {
  const id = String(award.id ?? '').toUpperCase();
  if (id === 'WSMVP') return 'W';
  if (id === 'ALCSMVP' || id === 'NLCSMVP') return 'L';
  return null;
}

function awardPostseasonSeriesLabel(award = {}) {
  const id = String(award.id ?? '').toUpperCase();
  if (id === 'WSMVP') return 'World Series Line';
  if (id === 'ALCSMVP') return 'ALCS Line';
  if (id === 'NLCSMVP') return 'NLCS Line';
  return 'Series Line';
}

function apiDateFromIso(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
}

function isoDateIsSameOrBefore(a, b) {
  return String(a ?? '') <= String(b ?? '');
}

function AwardPostseasonSeriesStats({ playerId, award, displayTeam }) {
  const group = isPitchingAward(award) ? 'pitching' : 'hitting';
  const gameType = awardPostseasonGameType(award);
  const [state, setState] = useState({ loading: Boolean(playerId && gameType), stat: null, rangeLabel: '' });

  useEffect(() => {
    if (!playerId || !award.season || !award.date || !gameType) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    const loadSeriesStats = async () => {
      try {
        const teamId = displayTeam?.id ?? award.team?.id;
        const scheduleQuery = {
          sportId: 1,
          season: award.season,
          gameTypes: gameType,
          ...(teamId ? { teamId } : {}),
        };
        const scheduleData = await fetchStatsApiJson('/api/v1/schedule', {
          query: scheduleQuery,
          signal: controller.signal,
          ttl: 60 * 60_000,
          retries: 1,
        });
        if (cancelled) return;

        const seriesDates = (scheduleData.dates ?? [])
          .map((dateRow) => dateRow.date)
          .filter((date) => date && isoDateIsSameOrBefore(date, award.date));
        const startIso = seriesDates[0];
        const endIso = seriesDates[seriesDates.length - 1] ?? award.date;
        const startDate = apiDateFromIso(startIso);
        const endDate = apiDateFromIso(endIso);

        if (!startDate || !endDate) {
          setState({ loading: false, stat: null, rangeLabel: '' });
          return;
        }

        const statsData = await fetchStatsApiJson(`/api/v1/people/${playerId}/stats`, {
          query: {
            stats: 'byDateRange',
            group: 'hitting,pitching',
            startDate,
            endDate,
            sportId: 1,
            gameType,
          },
          signal: controller.signal,
          ttl: 60 * 60_000,
          retries: 1,
        });
        if (cancelled) return;

        const stat = pickDateRangeStat(statsData?.stats, group);
        const rangeLabel =
          startIso && endIso && startIso !== endIso
            ? `${fmtDate(startIso)} - ${fmtDate(endIso)}`
            : fmtDate(endIso);
        setState({ loading: false, stat, rangeLabel });
      } catch {
        if (!cancelled) setState({ loading: false, stat: null, rangeLabel: '' });
      }
    };

    loadSeriesStats();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [award.date, award.season, award.team?.id, displayTeam?.id, gameType, group, playerId]);

  if (!gameType) return null;
  const items = awardStatItems(state.stat, group).filter((item) => item.value !== '—' && item.value != null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-800/80 bg-slate-950/35 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
        {awardPostseasonSeriesLabel(award)}
      </span>
      {state.rangeLabel && <span className="text-[10px] font-semibold text-slate-600">{state.rangeLabel}</span>}
      {state.loading ? (
        <span className="h-4 w-28 animate-pulse rounded-full bg-slate-800/70" />
      ) : items.length ? (
        items.map((item) => (
          <span key={item.label} className="text-xs font-semibold text-slate-500">
            <span className="font-black text-slate-200 tabular-nums">{item.value}</span> {item.label}
          </span>
        ))
      ) : (
        <span className="text-xs font-semibold text-slate-600">No series stats found.</span>
      )}
    </div>
  );
}

function AwardSeasonStats({ playerId, award, meta, displayTeam, seasonRowsByGroup }) {
  if (!shouldShowAwardSeasonStats(award, meta)) return null;
  const group = isPitchingAward(award) ? 'pitching' : 'hitting';
  const seasonType = meta.bucket === 'postseason' ? 'postseason' : 'regular';
  if (seasonType === 'postseason') {
    return <AwardPostseasonSeriesStats playerId={playerId} award={award} displayTeam={displayTeam} />;
  }

  const row = pickAwardSeasonRow(award, seasonRowsByGroup?.[seasonType]?.[group], displayTeam);
  const items = awardSeasonStatItems(row, group).filter((item) => item.value !== '—' && item.value != null);
  if (!items.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-800/80 bg-slate-950/35 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
        {seasonType === 'postseason' ? 'Postseason Line' : 'Season Line'}
      </span>
      {items.map((item) => (
        <span key={item.label} className="text-xs font-semibold text-slate-500">
          <span className="font-black text-slate-200 tabular-nums">{item.value}</span> {item.label}
        </span>
      ))}
    </div>
  );
}

function rewardDateRange(award = {}) {
  if (!award.date) return null;
  const end = new Date(`${award.date}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const name = String(award.name ?? '').toLowerCase();
  const start = new Date(end);

  if (/of the month/.test(name)) {
    start.setDate(1);
  } else if (/of the week/.test(name)) {
    start.setDate(end.getDate() - 6);
  } else {
    return null;
  }

  const apiDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${date.getFullYear()}`;
  };

  return {
    startDate: apiDate(start),
    endDate: apiDate(end),
    label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  };
}

function awardPrimaryPosition(award = {}) {
  return award.player?.primaryPosition?.abbreviation ?? '';
}

function isPitchingAward(award = {}) {
  const position = awardPrimaryPosition(award);
  const text = `${award.id ?? ''} ${award.name ?? ''}`.toLowerCase();
  return position === 'P' || /pitcher|cy young|reliever/.test(text);
}

function pickDateRangeStat(stats, group) {
  const splits = stats?.find((item) => item.group?.displayName === group)?.splits ?? [];
  return (
    splits.find((split) => Number(split.sport?.id) === 1)?.stat ??
    splits.find((split) => Number(split.sport?.id) !== 0)?.stat ??
    splits[0]?.stat ??
    null
  );
}

function AwardDateRangeStats({ playerId, award }) {
  const range = useMemo(() => rewardDateRange(award), [award]);
  const [loading, setLoading] = useState(Boolean(range));
  const [stat, setStat] = useState(null);

  useEffect(() => {
    if (!playerId || !range) return undefined;

    let cancelled = false;
    const params = new URLSearchParams({
      stats: 'byDateRange',
      group: 'hitting,pitching',
      startDate: range.startDate,
      endDate: range.endDate,
    });

    fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?${params}&sportId=1`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const group = isPitchingAward(award) ? 'pitching' : 'hitting';
        setStat(pickDateRangeStat(data?.stats, group));
      })
      .catch(() => {
        if (!cancelled) setStat(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [award, playerId, range]);

  if (!range) return null;

  const isPitcherAward = isPitchingAward(award);
  const items = isPitcherAward
    ? [
        { label: 'G', value: formatWholeStat(stat?.gamesPlayed ?? stat?.gamesPitched) },
        { label: 'IP', value: stat?.inningsPitched ?? '—' },
        { label: 'ERA', value: formatTwoDecimalStat(stat?.era) },
        { label: 'K', value: formatWholeStat(stat?.strikeOuts) },
        { label: 'WHIP', value: formatTwoDecimalStat(stat?.whip) },
      ]
    : [
        { label: 'G', value: formatWholeStat(stat?.gamesPlayed) },
        { label: 'AVG', value: formatRateStat(stat?.avg) },
        { label: 'HR', value: formatWholeStat(stat?.homeRuns) },
        { label: 'RBI', value: formatWholeStat(stat?.rbi) },
        { label: 'OPS', value: formatRateStat(stat?.ops) },
      ];

  return (
    <div className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Award Window
        </span>
        <span className="text-[10px] font-semibold text-slate-600">{range.label}</span>
      </div>
      {loading ? (
        <div className="h-9 animate-pulse rounded-xl bg-slate-800/60" />
      ) : stat ? (
        <div className="grid grid-cols-5 divide-x divide-slate-800/80">
          {items.map((item) => (
            <div key={item.label} className="px-1 text-center">
              <div className="text-[9px] font-black uppercase text-slate-600">{item.label}</div>
              <div className="mt-0.5 text-xs font-black tabular-nums text-slate-200">{item.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-[11px] text-slate-600">No date-range stats found.</div>
      )}
    </div>
  );
}

function buildRewardGroups(awards = []) {
  const seen = new Set();
  const deduped = [];

  for (const award of awards) {
    const key = [
      award.season,
      award.id,
      award.name,
      award.date,
      award.player?.primaryPosition?.abbreviation,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(award);
  }

  const groups = new Map();
  for (const award of deduped) {
    const season = award.season ?? 'Unknown';
    if (!groups.has(season)) groups.set(season, []);
    groups.get(season).push(award);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([season, items]) => ({
      season,
      items: items.sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''))),
    }));
}

function buildRewardCountChips(awards, labels, bucket) {
  return labels
    .map((label) => {
      const matchingAwards = awards.filter((award) => {
        const meta = rewardMeta(award);
        return meta.label === label && meta.bucket === bucket;
      });
      return {
        label,
        count: matchingAwards.length,
        meta: matchingAwards.length ? rewardMeta(matchingAwards[0]) : null,
      };
    })
    .filter((item) => item.count > 0);
}

function PlayerRewardsTab({ playerId, awards = [], seasonRows = [], seasonRowsByGroup = {} }) {
  const groups = useMemo(() => buildRewardGroups(awards), [awards]);
  const uniqueAwards = groups.flatMap((group) => group.items);
  const regularAwardCounts = buildRewardCountChips(
    uniqueAwards,
    ['MVP', 'All-Star', 'Gold Glove', 'Silver Slugger', 'Cy Young', 'Rookie'],
    'regular'
  );
  const postseasonAwardCounts = buildRewardCountChips(uniqueAwards, ['Postseason MVP'], 'postseason');

  if (!uniqueAwards.length) {
    return (
      <div className="mx-2 my-4 rounded-3xl border border-dashed border-slate-700/70 bg-slate-900/45 px-5 py-12 text-center sm:mx-0">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-slate-500">
          <i className="fa-solid fa-award text-2xl" aria-hidden />
        </div>
        <div className="mt-4 text-base font-black text-slate-200">No rewards found</div>
        <div className="mt-1 text-sm text-slate-500">
          MLB Stats API did not return award history for this player.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-2 my-4 space-y-5 sm:mx-0">
      <section className="relative overflow-hidden border-b border-slate-800/80 px-2 pb-4">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300">Awards</div>
            <div className="mt-1 text-2xl font-black text-white">Trophy Case</div>
            <div className="mt-1 text-sm text-slate-500">
              {uniqueAwards.length} total honors across {groups.length} {groups.length === 1 ? 'season' : 'seasons'}.
            </div>
          </div>
          {(regularAwardCounts.length > 0 || postseasonAwardCounts.length > 0) && (
            <div className="space-y-3">
              {regularAwardCounts.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                    Regular Season
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {regularAwardCounts.map(({ label, count, meta }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${meta.tone}`}>
                          <i className={`fa-solid ${meta.icon} text-xs`} aria-hidden />
                        </span>
                        <span className="font-display text-2xl leading-none text-white tabular-nums">{count}</span>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {postseasonAwardCounts.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                    Postseason
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {postseasonAwardCounts.map(({ label, count, meta }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${meta.tone}`}>
                          <i className={`fa-solid ${meta.icon} text-xs`} aria-hidden />
                        </span>
                        <span className="font-display text-2xl leading-none text-white tabular-nums">{count}</span>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="divide-y divide-slate-800/80 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/45">
        {groups.map((group) => (
          <section key={group.season} className="grid gap-0 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <div className="flex items-center justify-between bg-slate-950/35 px-4 py-3 sm:block sm:border-r sm:border-slate-800/80">
              <div className="text-xl font-black text-white">{group.season}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {group.items.length} {group.items.length === 1 ? 'honor' : 'honors'}
              </div>
            </div>
            <div className="divide-y divide-slate-800/70">
              {group.items.map((award, index) => {
                const meta = rewardMeta(award);
                const displayTeam = resolveAwardDisplayTeam(award, seasonRows);
                const teamName = normalizeRewardTeamName(displayTeam);
                const position = award.player?.primaryPosition?.abbreviation;
                return (
                  <article
                    key={`${award.season}-${award.id}-${award.date}-${displayTeam?.id ?? teamName}-${index}`}
                    className="px-4 py-3 transition-colors hover:bg-slate-800/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border ${meta.tone}`}>
                        <i className={`fa-solid ${meta.icon}`} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <div className="text-sm font-black leading-snug text-slate-100">{award.name ?? 'Award'}</div>
                          <span className={`text-[10px] font-black uppercase tracking-wide ${meta.text}`}>
                            {meta.label}
                          </span>
                          {award.date && <span className="text-[11px] font-semibold text-slate-600">{fmtDate(award.date)}</span>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                          {displayTeam?.id && (
                            <img
                              src={teamLogoUrl(displayTeam.id)}
                              alt=""
                              className="h-6 w-6 object-contain"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span className="truncate">{teamName}</span>
                          {position && (
                            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
                              {position}
                            </span>
                          )}
                        </div>
                        <AwardSeasonStats
                          playerId={playerId}
                          award={award}
                          meta={meta}
                          displayTeam={displayTeam}
                          seasonRowsByGroup={seasonRowsByGroup}
                        />
                        <AwardDateRangeStats playerId={playerId} award={award} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlayerPageContent({ playerId, locationKey, initialViewState, restoredFromHistory }) {
  const restoredFromHistoryRef = useRef(restoredFromHistory);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [draftPick, setDraftPick] = useState(null);
  const [yearByYear, setYearByYear] = useState(null);
  const [postseasonYearByYear, setPostseasonYearByYear] = useState(null);
  const [yearByYearByLevel, setYearByYearByLevel] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [careerLevel, setCareerLevel] = useState(initialViewState.careerLevel);
  const [careerGroup, setCareerGroup] = useState(initialViewState.careerGroup);
  const [careerGameType, setCareerGameType] = useState(
    initialViewState.careerGameType === 'P' ? 'R' : initialViewState.careerGameType
  );
  const [careerSeasonGroupsExpanded, setCareerSeasonGroupsExpanded] = useState(false);

  const [logLevel, setLogLevel] = useState(initialViewState.logLevel);
  const [logGroup, setLogGroup] = useState(initialViewState.logGroup);

  const [logSeason, setLogSeason] = useState(initialViewState.logSeason);

  const [splitLevel, setSplitLevel] = useState(initialViewState.splitLevel);
  const [splitGroup, setSplitGroup] = useState(initialViewState.splitGroup ?? 'hitting');
  const [splitSeason, setSplitSeason] = useState(initialViewState.splitSeason);
  const [activeTab, setActiveTab] = useState(initialViewState.activeTab);
  const { watchlist, isWatching, removeFromWatchlist, upsertWatchlistEntry } = useWatchlist();
  const [watchAnimating, setWatchAnimating] = useState(false);

  const isPitcher = isPitcherPosition(playerInfo?.primaryPosition?.abbreviation);

  const handleCareerLevelChange = useCallback((nextLevel) => {
    setCareerLevel(nextLevel);
    setCareerSeasonGroupsExpanded(false);
  }, []);

  const handleCareerGroupChange = useCallback((nextGroup) => {
    setCareerGroup(nextGroup);
    setCareerSeasonGroupsExpanded(false);
  }, []);

  const handleCareerGameTypeChange = useCallback((nextGameType) => {
    setCareerGameType(nextGameType);
    setCareerSeasonGroupsExpanded(false);
  }, []);

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
      splitGroup,
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
    splitGroup,
    splitSeason,
  ]);

  const statGroup = careerGroup;
  const displayCols =
    careerGroup === 'pitching' ? pitchCols : careerGroup === 'fielding' ? fieldCols : hitCols;
  const gameLogCols = logGroup === 'pitching' ? gameLogPitchCols : gameLogHitCols;
  const fallbackSeasonOptions = fallbackSeasonOptionsForPlayer(playerInfo);
  const logSeasonOptions =
    seasonOptionsFromYearByYear(yearByYearByLevel[logLevel], logGroup).length
      ? seasonOptionsFromYearByYear(yearByYearByLevel[logLevel], logGroup)
      : fallbackSeasonOptions;
  const splitSeasonOptions =
    seasonOptionsFromYearByYear(yearByYearByLevel[splitLevel], splitGroup).length
      ? seasonOptionsFromYearByYear(yearByYearByLevel[splitLevel], splitGroup)
      : fallbackSeasonOptions;
  const resolvedLogSeason = resolveSeasonValue(logSeason, logSeasonOptions);
  const resolvedSplitSeason = resolveSeasonValue(splitSeason, splitSeasonOptions);

  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadPlayer = async () => {
      try {
        const bioData = await fetchStatsApiJson(`/api/v1/people/${playerId}`, {
          query: { hydrate: 'currentTeam(team),awards,rosterEntries,education,transactions,relatives(person)' },
          signal: controller.signal,
          ttl: 5 * 60_000,
          retries: 1,
        });
        if (cancelled) return;

        const player = bioData.people?.[0] || null;
        setPlayerInfo(player);
        setDraftPick(null);
        if (player?.draftYear) {
          fetchPlayerDraftPick(playerId, player.draftYear, controller.signal)
            .then((pick) => {
              if (!cancelled) setDraftPick(pick);
            })
            .catch(() => {
              if (!cancelled) setDraftPick(null);
            });
        }
        if (restoredFromHistoryRef.current) return;
        const defaultLevel = defaultStatsLevelForPlayer(player);
        setCareerLevel(defaultLevel);
        setLogLevel(defaultLevel);
        setSplitLevel(defaultLevel);
        const pitcher = isPitcherPosition(player?.primaryPosition?.abbreviation);
        setCareerGroup(pitcher ? 'pitching' : 'hitting');
        setLogGroup(pitcher ? 'pitching' : 'hitting');
        setSplitGroup(pitcher ? 'pitching' : 'hitting');
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
      const stats = data.stats || [];
      setYearByYear(stats);
    });
  }, [playerId, playerInfo, careerLevel, careerGameType]);

  useEffect(() => {
    if (!playerId || !playerInfo) return;
    const params = 'stats=yearByYear&group=hitting,pitching,fielding&hydrate=team&gameType=P';
    fetchPlayerStats(playerId, params, careerLevel).then((data) => {
      setPostseasonYearByYear(data.stats || []);
    }).catch(() => {
      setPostseasonYearByYear([]);
    });
  }, [playerId, playerInfo, careerLevel]);

  useEffect(() => {
    if (!playerId || !playerInfo) return;
    const neededLevels = [...new Set(['mlb', logLevel, splitLevel])].filter(
      (level) => level && !yearByYearByLevel[level],
    );
    if (!neededLevels.length) return;

    let cancelled = false;
    const params = 'stats=yearByYear&group=hitting,pitching,fielding&hydrate=team&gameType=R';

    Promise.all(
      neededLevels.map(async (level) => {
        const data = await fetchPlayerStats(playerId, params, level);
        return [level, data.stats || []];
      }),
    ).then((entries) => {
      if (cancelled) return;
      setYearByYearByLevel((prev) => {
        const next = { ...prev };
        for (const [level, stats] of entries) next[level] = stats;
        return next;
      });
    }).catch(() => {
      // Season options are a convenience; panels still show their own empty/error states.
    });

    return () => {
      cancelled = true;
    };
  }, [logLevel, playerId, playerInfo, splitLevel, yearByYearByLevel]);

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
  }, []);

  const handleLogGroupChange = useCallback((nextGroup) => {
    setLogGroup(nextGroup);
  }, []);

  const handleSplitGroupChange = useCallback((nextGroup) => {
    setSplitGroup(nextGroup);
  }, []);

  const seasonHonors = buildSeasonHonors(playerInfo?.awards);

  const careerRows = (() => {
    const rows = buildPlayerCareerRows(yearByYear, statGroup, {
      careerLevel,
      seasonHonors,
      includeHonors: careerLevel === 'mlb',
    });

    if (careerLevel !== 'minors') return rows;

    return injectMinorsSeasonTotals(rows, statGroup, (season) => (
      <SeasonYearLabel season={season} />
    ));
  })();
  const postseasonRows = buildPlayerCareerRows(postseasonYearByYear, statGroup, {
    careerLevel,
  });
  const postseasonTotalsRow = computeCareerTotalsRow(postseasonRows, statGroup);

  const careerGroupOptions = [
    { value: 'hitting', label: 'Batting' },
    { value: 'pitching', label: 'Pitching' },
    { value: 'fielding', label: 'Fielding' },
  ];

  const careerTotalsRow = computeCareerTotalsRow(careerRows, statGroup);
  const careerSeasonCount = new Set(careerRows.map((row) => row.season).filter(Boolean)).size;
  const careerSeasonCountLabel = `${careerSeasonCount} ${careerSeasonCount === 1 ? 'Season' : 'Seasons'}${
    playerInfo?.active === false ? ' total' : ' so far'
  }`;
  const isMinorsProfile = isMinorsPlayerProfile(playerInfo);
  const useMostPlayedTeam = shouldUseMostPlayedTeam(playerInfo);
  const retiredTeamOverride = retiredPlayerTeamOverride(playerInfo?.id);
  const primaryCareerTeam = retiredTeamOverride ?? (useMostPlayedTeam ? getMostPlayedTeam(careerRows) : null);
  const waitingForMostPlayedTeam = useMostPlayedTeam && !primaryCareerTeam;
  const displayTeam = waitingForMostPlayedTeam
    ? null
    : primaryCareerTeam ?? playerInfo?.currentTeam;
  const playerImageOptions = isMinorsProfile ? { level: 'minors' } : undefined;
  const currentTeamLogoOptions = isMinorsProfile ? { level: 'minors' } : undefined;
  const heroBgClass = playerHeroBackgroundClass(playerInfo?.id);
  const regularMlbYearByYear =
    yearByYearByLevel.mlb ??
    (careerLevel === 'mlb' && careerGameType === 'R' ? yearByYear : null);
  const regularMinorsYearByYear =
    yearByYearByLevel.minors ??
    (careerLevel === 'minors' && careerGameType === 'R' ? yearByYear : null);
  const awardSeasonRowsByGroup = {
    regular: {
      hitting: buildPlayerCareerRows(regularMlbYearByYear, 'hitting', { careerLevel: 'mlb' }),
      pitching: buildPlayerCareerRows(regularMlbYearByYear, 'pitching', { careerLevel: 'mlb' }),
    },
    postseason: {
      hitting: buildPlayerCareerRows(postseasonYearByYear, 'hitting', { careerLevel: 'mlb' }),
      pitching: buildPlayerCareerRows(postseasonYearByYear, 'pitching', { careerLevel: 'mlb' }),
    },
  };
  const awardTeamRows = (() => {
    const primaryRows = buildPlayerCareerRows(regularMlbYearByYear, isPitcher ? 'pitching' : 'hitting', {
      careerLevel: 'mlb',
    });
    if (primaryRows.length) return primaryRows;
    return buildPlayerCareerRows(regularMlbYearByYear, isPitcher ? 'hitting' : 'pitching', {
      careerLevel: 'mlb',
    });
  })();
  const summaryStatsLevel = isMinorsProfile && regularMinorsYearByYear ? 'minors' : 'mlb';
  const summaryStats = summaryStatsLevel === 'minors' ? regularMinorsYearByYear : regularMlbYearByYear;

  const PLAYER_TABS = [
    { key: 'career', label: 'Career' },
    { key: 'gamelogs', label: 'Game Logs' },
    { key: 'splits', label: 'Splits' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'bvp', label: 'Batter vs. Pitcher' },
    { key: 'rewards', label: 'Awards' },
  ];

  return (
    <div className="max-w-5xl mx-auto  sm:px-6  sm:py-8">
 
      {isLoading && <LoadingSpinner size="lg" py="py-20" />}

      {error && <div className="text-center py-20 text-slate-500">{error}</div>}

      {!isLoading && !error && playerInfo && (

        // PLAYER HERO
        //fun bg: bg-[length:auto_1%]
        <div className="bg-[#121827] border border-slate-700/60 sm:rounded-2xl overflow-hidden">
          <div
            className={`relative h-[200px] sm:h-[300px] bg-cover  ${heroBgClass} overflow-hidden px-5 sm:px-8 py-6 sm:py-8 flex flex-col justify-end`}
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
                  {playerInfo.primaryPosition?.name || '—'}         {playerInfo.primaryNumber ? ` · #${playerInfo.primaryNumber}` : ''}
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
               
                </div>
              </div>
            </div>
          </div>

          <PlayerStatSummaryCard
            playerInfo={playerInfo}
            isPitcher={isPitcher}
            stats={summaryStats}
            levelLabel={summaryStatsLevel === 'minors' ? 'MINORS' : ''}
          />

          <PlayerBioInfo playerInfo={playerInfo} draftPick={draftPick} />

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
                            onChange={handleCareerLevelChange}
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
                            onChange={handleCareerGroupChange}
                            size="sm"
                            options={careerGroupOptions}
                          />
                        </div>
                        <Select
                          value={careerGameType}
                          onChange={handleCareerGameTypeChange}
                          options={CAREER_GAME_TYPE_OPTIONS}
                          className="w-56"
                        />
                        <div className="inline-flex items-center gap-1.5 px-1 text-xs font-black uppercase tracking-wide text-slate-500">
                          <i className="fa-solid fa-calendar-days text-[10px] text-emerald-300" aria-hidden />
                          <span>{careerSeasonCountLabel}</span>
                        </div>
                        {careerLevel === 'minors' && (
                          <button
                            type="button"
                            onClick={() => setCareerSeasonGroupsExpanded((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                          >
                            <i
                              className={`fa-solid fa-chevron-right text-[10px] transition-transform ${careerSeasonGroupsExpanded ? 'rotate-90' : ''}`}
                              aria-hidden
                            />
                            {careerSeasonGroupsExpanded ? 'Collapse all' : 'Expand all'}
                          </button>
                        )}
                      </div>
                      <StatsTable
                        key={`career-${careerLevel}-${careerGroup}-${careerGameType}-${careerSeasonGroupsExpanded ? 'expanded' : 'collapsed'}`}
                        cols={displayCols}
                        rows={careerRows}
                        labelKey="season"
                        highlightCareerHighs
                        footerRow={careerTotalsRow}
                        collapsibleSeasonGroups={careerLevel === 'minors'}
                        expandAllSeasonGroups={careerSeasonGroupsExpanded}
                        emptyMessage="No career stats available for this selection."
                      />
                      {postseasonRows.length > 0 && (
                        <section className="mt-6">
                          <div className="mb-2 px-2 sm:px-0">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              Postseason
                            </div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-300">
                              Cumulative playoff stats by season
                            </div>
                          </div>
                          <StatsTable
                            key={`postseason-${careerLevel}-${careerGroup}`}
                            cols={displayCols}
                            rows={postseasonRows}
                            labelKey="season"
                            footerRow={postseasonTotalsRow}
                            emptyMessage="No postseason stats available."
                          />
                        </section>
                      )}
                    </>
                  );
                }
                if (key === 'gamelogs') {
                  return (
                    <>
                      <FilterBar
                        level={logLevel}
                        onLevelChange={handleLogLevelChange}
                        season={resolvedLogSeason}
                        onSeasonChange={setLogSeason}
                        seasonOptions={logSeasonOptions}
                        group={logGroup}
                        onGroupChange={handleLogGroupChange}
                        hidePeriod
                      />
                      <PlayerGameLogsPanel
                        key={`${playerId}:${logLevel}:${logGroup}:${resolvedLogSeason}`}
                        playerId={playerId}
                        playerInfo={playerInfo}
                        logLevel={logLevel}
                        logGroup={logGroup}
                        logSeason={resolvedLogSeason}
                        gameLogCols={gameLogCols}
                      />
                    </>
                  );
                }
                if (key === 'rewards') {
                  return (
                    <PlayerRewardsTab
                      playerId={playerId}
                      awards={playerInfo.awards}
                      seasonRows={awardTeamRows}
                      seasonRowsByGroup={awardSeasonRowsByGroup}
                    />
                  );
                }
                if (key === 'splits') {
                  return (
                    <>
                      <FilterBar
                        level={splitLevel}
                        onLevelChange={setSplitLevel}
                        season={resolvedSplitSeason}
                        onSeasonChange={setSplitSeason}
                        seasonOptions={splitSeasonOptions}
                        group={splitGroup}
                        onGroupChange={handleSplitGroupChange}
                        hidePeriod
                      />
                      <PlayerSplitsPanel
                        key={`${playerId}:${splitLevel}:${splitGroup}:${resolvedSplitSeason}`}
                        playerId={playerId}
                        playerInfo={playerInfo}
                        splitLevel={splitLevel}
                        splitGroup={splitGroup}
                        splitSeason={resolvedSplitSeason}
                      />
                    </>
                  );
                }
                if (key === 'transactions') {
                  return <PlayerTransactionsTab key={playerId} playerId={playerId} playerInfo={playerInfo} />;
                }
                if (key === 'bvp') {
                  return <PlayerBvpTab playerInfo={playerInfo} />;
                }
                return null;
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
