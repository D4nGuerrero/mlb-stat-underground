import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { restoreListScroll, saveListScroll } from '../utils/listScrollRestore';
import { mlbTeams, playerHeadshotUrl, teamLogoUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';
import TeamAbbrCell from '../components/TeamAbbrCell';
import TeamLogoImg from '../components/TeamLogoImg';
import {
  SegmentedControl,
  Select,
  stickyRankHead,
  stickyRankCell,
  stickyTeamHeadAfterRank,
  stickyTeamCellAfterRank,
  stickyPlayerHeadAfterRank,
  stickyPlayerCellAfterRank,
  scrollStatHead,
  scrollStatCell,
  TABLE_BASE,
  BaseballSpinner,
} from '../components/ui';
import { TABLE_TEXT_CLASS, TABLE_MIN_W } from '../theme/tableTheme';
import { LeagueLevelPicker } from '../components/LeagueLevelPicker';
import {
  LEAGUE_LEVEL_BY_VALUE,
  LEAGUE_LEVEL_STORAGE_KEY,
  LEAGUE_LEVEL_VALUES,
} from '../constants/leagueLevels.js';
import { countryFlagUrl, displayCountryName, normalizeCountryName } from '../utils/countryFlags';

const CURRENT_YEAR = new Date().getFullYear();

const SEASON_OPTIONS = [
  { value: 'all', label: 'All Time' },
  ...Array.from(
    { length: CURRENT_YEAR - 2003 + 1 },
    (_, i) => CURRENT_YEAR - i
  ).map((year) => ({
    value: String(year),
    label: `${year} Season`,
  })),
];
const LIMIT_OPTIONS = [
  { value: 10, label: 'Top 10' },
  { value: 25, label: 'Top 25' },
  { value: 50, label: 'Top 50' },
];
const COMPLETE_PLAYER_LIMIT = 5000;
const COMPLETE_PLAYER_PAGE_LIMIT = 1000;
const COMPLETE_PLAYER_ROWS_STEP = 250;
const RATE_STAT_SAMPLE_MINIMUMS = {
  season: {
    batting: 502,
    pitchingIpOuts: 486,
    fieldingChances: 100,
  },
  allTime: {
    batting: 1000,
    pitchingIpOuts: 1500,
    fieldingChances: 500,
  },
};
const BATTING_RATE_SORT_COLS = new Set(['avg', 'obp', 'slg', 'ops']);
const PITCHING_RATE_SORT_COLS = new Set([
  'era',
  'whip',
  'avg',
  'strikeoutsPer9Inn',
  'strikeoutWalkRatio',
  'walksPer9Inn',
  'hitsPer9Inn',
]);
const FIELDING_RATE_SORT_COLS = new Set(['fielding']);

const POSITION_OPTIONS = [
  { value: 'all', label: 'All Positions' },
  { value: 'P', label: 'Pitcher' },
  { value: 'C', label: 'Catcher' },
  { value: '1B', label: 'First Base' },
  { value: '2B', label: 'Second Base' },
  { value: '3B', label: 'Third Base' },
  { value: 'SS', label: 'Shortstop' },
  { value: 'LF', label: 'Left Field' },
  { value: 'CF', label: 'Center Field' },
  { value: 'RF', label: 'Right Field' },
  { value: 'OF', label: 'Outfield' },
  { value: 'DH', label: 'Designated Hitter' },
];

const ALL_COUNTRIES_OPTION = { value: 'all', label: 'All Countries' };

const LEAGUE_LOGOS = {
  all: { src: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg', alt: 'MLB' },
  AL: { src: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/159.svg', alt: 'AL' },
  NL: { src: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/160.svg', alt: 'NL' },
};

const HITTING_CATS = [
  { key: 'homeRuns', label: 'Home Runs', abbr: 'HR', format: 'int' },
  { key: 'battingAverage', label: 'Batting Average', abbr: 'AVG', format: '3dec' },
  { key: 'onBasePlusSlugging', label: 'OPS', abbr: 'OPS', format: '3dec' },
  { key: 'rbi', label: 'RBI', abbr: 'RBI', format: 'int' },
  { key: 'runs', label: 'Runs Scored', abbr: 'R', format: 'int' },
  { key: 'hits', label: 'Hits', abbr: 'H', format: 'int' },
  { key: 'doubles', label: 'Doubles', abbr: '2B', format: 'int' },
  { key: 'triples', label: 'Triples', abbr: '3B', format: 'int' },
  { key: 'stolenBases', label: 'Stolen Bases', abbr: 'SB', format: 'int' },
  { key: 'sluggingPercentage', label: 'Slugging %', abbr: 'SLG', format: '3dec' },
  { key: 'onBasePercentage', label: 'On-Base %', abbr: 'OBP', format: '3dec' },
  { key: 'totalBases', label: 'Total Bases', abbr: 'TB', format: 'int' },
  { key: 'strikeouts', label: 'Strikeouts (Batter)', abbr: 'K', format: 'int' },
  { key: 'walks', label: 'Walks', abbr: 'BB', format: 'int' },
];

const PITCHING_CATS = [
  { key: 'earnedRunAverage', label: 'ERA', abbr: 'ERA', format: '2dec' },
  { key: 'wins', label: 'Wins', abbr: 'W', format: 'int' },
  { key: 'strikeouts', label: 'Strikeouts', abbr: 'K', format: 'int' },
  { key: 'saves', label: 'Saves', abbr: 'SV', format: 'int' },
  { key: 'whip', label: 'WHIP', abbr: 'WHIP', format: '2dec' },
  { key: 'inningsPitched', label: 'Innings Pitched', abbr: 'IP', format: 'str' },
  { key: 'strikeoutsPer9Inn', label: 'Strikeouts per 9 IP', abbr: 'K/9', format: '2dec' },
  { key: 'strikeoutWalkRatio', label: 'Strikeout-to-Walk Ratio', abbr: 'K/BB', format: '2dec' },
  { key: 'holds', label: 'Holds', abbr: 'HLD', format: 'int' },
  { key: 'blownSaves', label: 'Blown Saves', abbr: 'BS', format: 'int' },
  { key: 'walksPer9Inn', label: 'Walks per 9 IP', abbr: 'BB/9', format: '2dec' },
  { key: 'hitsPer9Inn', label: 'Hits per 9 IP', abbr: 'H/9', format: '2dec' },
  { key: 'shutouts', label: 'Shutouts', abbr: 'SHO', format: 'int' },
  { key: 'completeGames', label: 'Complete Games', abbr: 'CG', format: 'int' },
];

const FIELDING_CATS = [
  { key: 'fielding', label: 'Fielding %', abbr: 'FLD%', format: '3dec' },
  { key: 'putOuts', label: 'Putouts', abbr: 'PO', format: 'int' },
  { key: 'assists', label: 'Assists', abbr: 'A', format: 'int' },
  { key: 'errors', label: 'Errors', abbr: 'E', format: 'int' },
  { key: 'doublePlays', label: 'Double Plays', abbr: 'DP', format: 'int' },
  { key: 'chances', label: 'Total Chances', abbr: 'TC', format: 'int' },
];

const AL_TEAM_IDS = new Set([108, 110, 111, 114, 116, 117, 118, 133, 136, 139, 140, 141, 142, 145, 147]);

const TEAM_BATTING_COLS = [
  { key: 'gamesPlayed', label: 'GP', format: 'int' },
  { key: 'atBats', label: 'AB', format: 'int' },
  { key: 'runs', label: 'R', format: 'int' },
  { key: 'hits', label: 'H', format: 'int' },
  { key: 'doubles', label: '2B', format: 'int' },
  { key: 'triples', label: '3B', format: 'int' },
  { key: 'homeRuns', label: 'HR', format: 'int' },
  { key: 'rbi', label: 'RBI', format: 'int' },
  { key: 'totalBases', label: 'TB', format: 'int' },
  { key: 'baseOnBalls', label: 'BB', format: 'int' },
  { key: 'strikeOuts', label: 'SO', format: 'int' },
  { key: 'stolenBases', label: 'SB', format: 'int' },
  { key: 'avg', label: 'AVG', format: '3dec' },
  { key: 'obp', label: 'OBP', format: '3dec' },
  { key: 'slg', label: 'SLG', format: '3dec' },
  { key: 'ops', label: 'OPS', format: '3dec' },
];

const TEAM_PITCHING_COLS = [
  { key: 'gamesPlayed', label: 'GP', format: 'int' },
  { key: 'wins', label: 'W', format: 'int' },
  { key: 'losses', label: 'L', format: 'int' },
  { key: 'era', label: 'ERA', format: '2dec', lowerBetter: true },
  { key: 'saves', label: 'SV', format: 'int' },
  { key: 'completeGames', label: 'CG', format: 'int' },
  { key: 'shutouts', label: 'SHO', format: 'int' },
  { key: 'inningsPitched', label: 'IP', format: 'str' },
  { key: 'hits', label: 'H', format: 'int', lowerBetter: true },
  { key: 'earnedRuns', label: 'ER', format: 'int', lowerBetter: true },
  { key: 'homeRuns', label: 'HR', format: 'int', lowerBetter: true },
  { key: 'baseOnBalls', label: 'BB', format: 'int', lowerBetter: true },
  { key: 'strikeOuts', label: 'SO', format: 'int' },
  { key: 'avg', label: 'OBA', format: '3dec', lowerBetter: true },
  { key: 'whip', label: 'WHIP', format: '2dec', lowerBetter: true },
];

const TEAM_FIELDING_COLS = [
  { key: 'gamesPlayed', label: 'GP', format: 'int' },
  { key: 'gamesStarted', label: 'GS', format: 'int' },
  { key: 'putOuts', label: 'PO', format: 'int' },
  { key: 'assists', label: 'A', format: 'int' },
  { key: 'errors', label: 'E', format: 'int', lowerBetter: true },
  { key: 'fielding', label: 'FLD%', format: '3dec' },
  { key: 'doublePlays', label: 'DP', format: 'int' },
  { key: 'chances', label: 'TC', format: 'int' },
];

const TEAM_STAT_COLS = {
  hitting: TEAM_BATTING_COLS,
  pitching: TEAM_PITCHING_COLS,
  fielding: TEAM_FIELDING_COLS,
};

const PLAYER_STAT_COLS = TEAM_STAT_COLS;

const STAT_FULL_LABELS = {
  gamesPlayed: 'Games Played',
  gamesStarted: 'Games Started',
  atBats: 'At Bats',
  runs: 'Runs',
  hits: 'Hits',
  doubles: 'Doubles',
  triples: 'Triples',
  homeRuns: 'Home Runs',
  rbi: 'RBI',
  totalBases: 'Total Bases',
  baseOnBalls: 'Walks',
  strikeOuts: 'Strikeouts',
  stolenBases: 'Stolen Bases',
  avg: 'Batting Average',
  obp: 'On-Base Percentage',
  slg: 'Slugging Percentage',
  ops: 'OPS',
  wins: 'Wins',
  losses: 'Losses',
  era: 'ERA',
  saves: 'Saves',
  completeGames: 'Complete Games',
  shutouts: 'Shutouts',
  inningsPitched: 'Innings Pitched',
  earnedRuns: 'Earned Runs',
  whip: 'WHIP',
  putOuts: 'Putouts',
  assists: 'Assists',
  errors: 'Errors',
  fielding: 'Fielding Percentage',
  doublePlays: 'Double Plays',
  chances: 'Total Chances',
};

const statFullLabel = (col) => STAT_FULL_LABELS[col.key] ?? col.label;

const QUALIFIED_PLAYER_SORT_COLS = new Set([
  'avg',
  'obp',
  'slg',
  'ops',
  'era',
  'whip',
  'fielding',
  'strikeoutsPer9Inn',
  'strikeoutWalkRatio',
  'walksPer9Inn',
  'hitsPer9Inn',
]);

const TEAM_SORT_DEFAULTS = {
  hitting: { col: 'homeRuns', dir: 'desc' },
  pitching: { col: 'era', dir: 'asc' },
  fielding: { col: 'fielding', dir: 'desc' },
};

const PLAYER_SORT_DEFAULTS = TEAM_SORT_DEFAULTS;

const STAT_LEADERS_SCROLL_KEY = 'stat-leaders';
const COMPLETE_LEADERS_TABLE_SCROLL = '-mx-1 max-h-[calc(100vh-10rem)] overflow-auto rounded-xl border border-slate-800/60 scrollbar-thin';
const DEFAULT_SEASON = String(CURRENT_YEAR);
const DEFAULT_LIMIT = 25;
const VALID_GROUPS = new Set(['hitting', 'pitching', 'fielding']);
const VALID_LEAGUES = new Set(['all', 'AL', 'NL']);
const VALID_PLAYER_MODES = new Set(['cards', 'complete']);
const VALID_POSITIONS = new Set(POSITION_OPTIONS.map((option) => option.value));
const VALID_TEAM_MODES = new Set(['leaders', 'complete']);

function loadLeadersLeague() {
  try {
    const saved = localStorage.getItem(LEAGUE_LEVEL_STORAGE_KEY);
    return LEAGUE_LEVEL_VALUES.has(saved) ? saved : 'mlb';
  } catch {
    return 'mlb';
  }
}

function leadersSportQuery(leagueLevel) {
  const league = LEAGUE_LEVEL_BY_VALUE[leagueLevel] ?? LEAGUE_LEVEL_BY_VALUE.mlb;
  return league.sportQuery;
}

function completeStatsSportQuery(leagueLevel) {
  return leadersSportQuery(leagueLevel).replace(/sportId=/g, 'sportIds=');
}

async function fetchTeamsForLevel(leagueLevel, seasonParam) {
  if (leagueLevel === 'mlb') {
    return mlbTeams.map((t) => ({
      id: t.id,
      name: t.name,
      abbr: t.abbr,
      leagueId: AL_TEAM_IDS.has(t.id) ? 103 : 104,
    }));
  }

  const league = LEAGUE_LEVEL_BY_VALUE[leagueLevel] ?? LEAGUE_LEVEL_BY_VALUE.mlb;
  const teamSeason = seasonParam === 'all' ? String(CURRENT_YEAR) : seasonParam;
  const res = await fetch(`https://statsapi.mlb.com/api/v1/teams?${league.sportQuery}&season=${teamSeason}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    abbr: t.abbreviation,
    leagueId: t.league?.id,
  }));
}

function defaultCategoryForGroup(group) {
  return (GROUP_CATS[group] ?? HITTING_CATS)[0].key;
}

function parseStatLeadersState(searchParams) {
  const playerOrTeam = searchParams.get('view') === 'team' ? 'team' : 'player';
  const groupParam = searchParams.get('group');
  const activeGroup = VALID_GROUPS.has(groupParam) ? groupParam : 'hitting';

  const season = SEASON_OPTIONS.some((o) => o.value === searchParams.get('season'))
    ? searchParams.get('season')
    : DEFAULT_SEASON;

  const leagueFilter = VALID_LEAGUES.has(searchParams.get('league'))
    ? searchParams.get('league')
    : 'all';

  const limitRaw = Number(searchParams.get('limit'));
  const limit = LIMIT_OPTIONS.some((o) => o.value === limitRaw) ? limitRaw : DEFAULT_LIMIT;
  const playerMode = VALID_PLAYER_MODES.has(searchParams.get('mode'))
    ? searchParams.get('mode')
    : 'cards';
  const positionFilter = VALID_POSITIONS.has(searchParams.get('pos'))
    ? searchParams.get('pos')
    : 'all';
  const countryFilter = normalizeCountryName(searchParams.get('country') || 'all');

  const playerGroup = playerOrTeam === 'player' ? activeGroup : 'hitting';
  const cats = GROUP_CATS[playerGroup] ?? HITTING_CATS;
  const categoryParam = searchParams.get('category');
  const category = cats.some((c) => c.key === categoryParam)
    ? categoryParam
    : defaultCategoryForGroup(playerGroup);
  const playerDefaults = PLAYER_SORT_DEFAULTS[playerGroup] ?? PLAYER_SORT_DEFAULTS.hitting;
  const playerCols = PLAYER_STAT_COLS[playerGroup] ?? TEAM_BATTING_COLS;
  const playerSortParam = searchParams.get('psort');
  const playerSortCol = playerCols.some((c) => c.key === playerSortParam)
    ? playerSortParam
    : playerDefaults.col;
  const playerDirParam = searchParams.get('pdir');
  const playerSortDir = playerDirParam === 'asc' || playerDirParam === 'desc'
    ? playerDirParam
    : playerDefaults.dir;

  const teamGroup = playerOrTeam === 'team' ? activeGroup : 'hitting';
  const teamDefaults = TEAM_SORT_DEFAULTS[teamGroup] ?? TEAM_SORT_DEFAULTS.hitting;
  const teamCols = TEAM_STAT_COLS[teamGroup] ?? TEAM_BATTING_COLS;
  const sortParam = searchParams.get('sort');
  const teamSortCol = teamCols.some((c) => c.key === sortParam) ? sortParam : teamDefaults.col;
  const dirParam = searchParams.get('dir');
  const teamSortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : teamDefaults.dir;
  const teamMode = VALID_TEAM_MODES.has(searchParams.get('tmode'))
    ? searchParams.get('tmode')
    : 'leaders';
  const levelParam = searchParams.get('level');
  const leadersLeague = LEAGUE_LEVEL_VALUES.has(levelParam) ? levelParam : loadLeadersLeague();

  return {
    playerOrTeam,
    group: playerGroup,
    category,
    season,
    leagueFilter,
    leadersLeague,
    limit,
    positionFilter,
    countryFilter,
    playerSortCol,
    playerSortDir,
    teamGroup,
    teamSortCol,
    teamSortDir,
    teamMode,
    playerMode,
  };
}

function buildStatLeadersParams(state) {
  const params = new URLSearchParams();
  if (state.playerOrTeam === 'team') params.set('view', 'team');

  const activeGroup = state.playerOrTeam === 'team' ? state.teamGroup : state.group;
  if (activeGroup !== 'hitting') params.set('group', activeGroup);

  if (state.season !== DEFAULT_SEASON) params.set('season', state.season);
  if (state.leadersLeague && state.leadersLeague !== 'mlb') params.set('level', state.leadersLeague);
  if (state.leagueFilter !== 'all') params.set('league', state.leagueFilter);

  if (state.playerOrTeam === 'player') {
    if (state.playerMode === 'complete') params.set('mode', 'complete');
    if (state.positionFilter && state.positionFilter !== 'all') params.set('pos', state.positionFilter);
    if (state.countryFilter && state.countryFilter !== 'all') params.set('country', state.countryFilter);
    if (state.category !== defaultCategoryForGroup(state.group)) {
      params.set('category', state.category);
    }
    if (state.limit !== DEFAULT_LIMIT) params.set('limit', String(state.limit));
    if (state.playerMode === 'complete') {
      const defaults = PLAYER_SORT_DEFAULTS[state.group] ?? PLAYER_SORT_DEFAULTS.hitting;
      if (state.playerSortCol !== defaults.col) params.set('psort', state.playerSortCol);
      if (state.playerSortDir !== defaults.dir) params.set('pdir', state.playerSortDir);
    }
  } else {
    if (state.teamMode === 'leaders') params.set('tmode', 'leaders');
    const defaults = TEAM_SORT_DEFAULTS[state.teamGroup] ?? TEAM_SORT_DEFAULTS.hitting;
    if (state.teamSortCol !== defaults.col) params.set('sort', state.teamSortCol);
    if (state.teamSortDir !== defaults.dir) params.set('dir', state.teamSortDir);
  }

  return params;
}

const GROUP_CATS = {
  hitting: HITTING_CATS,
  pitching: PITCHING_CATS,
  fielding: FIELDING_CATS,
};

const LEADER_CATEGORY_STAT_KEYS = {
  battingAverage: 'avg',
  earnedRunAverage: 'era',
  onBasePercentage: 'obp',
  onBasePlusSlugging: 'ops',
  sluggingPercentage: 'slg',
  strikeouts: 'strikeOuts',
};

const MEDAL = ['🥇', '🥈', '🥉'];

const formatValue = (val, fmt) => {
  if (val == null || val === '') return '–';
  if (fmt === 'int') return String(parseInt(val, 10));
  if (fmt === '3dec') {
    const f = parseFloat(val).toFixed(3);
    return f.startsWith('0.') ? f.slice(1) : f;
  }
  if (fmt === '2dec') return parseFloat(val).toFixed(2);
  return String(val);
};

const normalizeStatKeys = (stat = {}) => ({
  ...stat,
  // Stats API leaders accepts "walks", but full stat rows expose the same stat as baseOnBalls.
  walks: stat.walks ?? stat.baseOnBalls,
  strikeouts: stat.strikeouts ?? stat.strikeOuts,
  earnedRunAverage: stat.earnedRunAverage ?? stat.era,
  onBasePercentage: stat.onBasePercentage ?? stat.obp,
  onBasePlusSlugging: stat.onBasePlusSlugging ?? stat.ops,
  sluggingPercentage: stat.sluggingPercentage ?? stat.slg,
});

const parseSortValue = (stat, key) => {
  const raw = stat?.[key];
  if (raw == null || raw === '') return 0;
  if (key === 'inningsPitched') {
    const s = String(raw);
    const [whole, frac = '0'] = s.split('.');
    return parseInt(whole, 10) * 3 + parseInt(frac, 10);
  }
  const n = parseFloat(String(raw).replace(/^\./, '0.'));
  return Number.isNaN(n) ? 0 : n;
};

const parseOutsFromInnings = (innings) => {
  if (innings == null || innings === '') return 0;
  const [whole, frac = '0'] = String(innings).split('.');
  return (parseInt(whole, 10) || 0) * 3 + (parseInt(frac, 10) || 0);
};

const statKeyForLeaderCategory = (categoryKey) => LEADER_CATEGORY_STAT_KEYS[categoryKey] ?? categoryKey;

const leaderCategoryLowerBetter = (categoryKey) => {
  const statKey = statKeyForLeaderCategory(categoryKey);
  return [...TEAM_BATTING_COLS, ...TEAM_PITCHING_COLS, ...TEAM_FIELDING_COLS]
    .some((col) => col.key === statKey && col.lowerBetter);
};

const rankTeams = (rows, sortCol, sortDir) => {
  const sorted = [...rows].sort((a, b) => {
    const av = parseSortValue(a.stat, sortCol);
    const bv = parseSortValue(b.stat, sortCol);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  let rank = 0;
  let prevVal = null;
  return sorted.map((row, i) => {
    const val = parseSortValue(row.stat, sortCol);
    if (i === 0 || val !== prevVal) {
      rank = i + 1;
      prevVal = val;
    }
    return { ...row, rank };
  });
};

const rateSampleEligible = (row, sortCol, seasonParam) => {
  const stat = row.stat ?? {};
  const minimums = seasonParam === 'all'
    ? RATE_STAT_SAMPLE_MINIMUMS.allTime
    : RATE_STAT_SAMPLE_MINIMUMS.season;

  if (BATTING_RATE_SORT_COLS.has(sortCol)) {
    const sample = parseInt(stat.plateAppearances ?? stat.atBats ?? 0, 10) || 0;
    return sample >= minimums.batting;
  }

  if (PITCHING_RATE_SORT_COLS.has(sortCol)) {
    return parseOutsFromInnings(stat.inningsPitched) >= minimums.pitchingIpOuts;
  }

  if (FIELDING_RATE_SORT_COLS.has(sortCol)) {
    const sample = parseInt(stat.chances ?? 0, 10) || 0;
    return sample >= minimums.fieldingChances;
  }

  return true;
};

const rankRowsByStat = (rows, sortCol, sortDir, seasonParam = DEFAULT_SEASON) => {
  const sorted = [...rows].sort((a, b) => {
    const aEligible = rateSampleEligible(a, sortCol, seasonParam);
    const bEligible = rateSampleEligible(b, sortCol, seasonParam);
    if (aEligible !== bEligible) return aEligible ? -1 : 1;

    const av = parseSortValue(a.stat, sortCol);
    const bv = parseSortValue(b.stat, sortCol);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  let rank = 0;
  let prevVal = null;
  return sorted.map((row, i) => {
    const val = parseSortValue(row.stat, sortCol);
    if (i === 0 || val !== prevVal) {
      rank = i + 1;
      prevVal = val;
    }
    return { ...row, rank };
  });
};

const getPlayerPosition = (row) =>
  row.player?.primaryPosition?.abbreviation ??
  row.person?.primaryPosition?.abbreviation ??
  row.position?.abbreviation ??
  row.position?.code ??
  '';

const positionMatches = (row, positionFilter) => {
  if (positionFilter === 'all') return true;
  const pos = getPlayerPosition(row);
  if (positionFilter === 'OF') return ['LF', 'CF', 'RF', 'OF'].includes(pos);
  return pos === positionFilter;
};

const playerCountry = (row) => row.person?.birthCountry ?? row.player?.birthCountry ?? '';

const countryMatches = (row, countryFilter) => {
  if (!countryFilter || countryFilter === 'all') return true;
  return normalizeCountryName(playerCountry(row)) === normalizeCountryName(countryFilter);
};

const buildCountryOptions = (rows) => {
  const countries = [...new Set(rows.map((row) => displayCountryName(playerCountry(row))).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return [
    ALL_COUNTRIES_OPTION,
    ...countries.map((country) => ({
      value: normalizeCountryName(country),
      label: country,
      icon: countryFlagUrl(country),
    })),
  ];
};

function compactPlayerName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name || '—';
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

function TeamIdentity({ team, onClick }) {
  const content = (
    <>
      {team?.id && (
        <img
          src={teamLogoUrl(team.id)}
          alt=""
          className="h-7 w-7 flex-shrink-0 object-contain"
          onError={(e) => (e.target.style.display = 'none')}
        />
      )}
      <span className="font-mono text-[10px] font-black uppercase tracking-wide text-slate-400">
        {team?.abbr ?? '—'}
      </span>
      <span className="truncate font-semibold text-slate-200">{team?.name ?? '—'}</span>
    </>
  );

  if (!onClick) {
    return <div className="flex min-w-0 items-center gap-2">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!team?.id}
      className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-white disabled:pointer-events-none"
    >
      {content}
    </button>
  );
}

function PlayerIdentity({ player, team, onPlayerClick, onTeamClick }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {team?.id && (
        <button
          type="button"
          onClick={onTeamClick}
          className="flex-shrink-0 transition-opacity hover:opacity-80"
          title={team?.name}
        >
          <TeamLogoImg teamId={team.id} className="h-5 w-5 object-contain" />
        </button>
      )}
      <Link
        to={`/player/${player?.id}`}
        onClick={onPlayerClick}
        className={`min-w-0 truncate font-semibold text-slate-200 transition-colors hover:text-${THEME_COLOR}-400`}
      >
        {compactPlayerName(player?.fullName)}
      </Link>
    </div>
  );
}

function LeagueLogo({ filter }) {
  const logo = LEAGUE_LOGOS[filter] ?? LEAGUE_LOGOS.all;
  return (
    <img
      key={filter}
      src={logo.src}
      alt={logo.alt}
      className="w-8 h-8 object-contain flex-shrink-0"
    />
  );
}

export default function StatLeaders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cache = useRef({});
  const initial = parseStatLeadersState(searchParams);

  const [playerOrTeam, setPlayerOrTeam] = useState(initial.playerOrTeam);
  const [group, setGroup] = useState(initial.group);
  const [category, setCategory] = useState(initial.category);
  const [season, setSeason] = useState(initial.season);
  const [leaders, setLeaders] = useState([]);
  const [completePlayerRows, setCompletePlayerRows] = useState([]);
  const [leagueFilter, setLeagueFilter] = useState(initial.leagueFilter);
  const [leadersLeague, setLeadersLeague] = useState(initial.leadersLeague);
  const [positionFilter, setPositionFilter] = useState(initial.positionFilter);
  const [countryFilter, setCountryFilter] = useState(initial.countryFilter);
  const [teamStats, setTeamStats] = useState([]);
  const [teamGroup, setTeamGroup] = useState(initial.teamGroup);
  const [playerSortCol, setPlayerSortCol] = useState(initial.playerSortCol);
  const [playerSortDir, setPlayerSortDir] = useState(initial.playerSortDir);
  const [teamSortCol, setTeamSortCol] = useState(initial.teamSortCol);
  const [teamSortDir, setTeamSortDir] = useState(initial.teamSortDir);
  const [teamMode, setTeamMode] = useState(initial.teamMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(initial.limit);
  const [playerMode, setPlayerMode] = useState(initial.playerMode);
  const [completePlayerDisplayLimit, setCompletePlayerDisplayLimit] = useState(COMPLETE_PLAYER_ROWS_STEP);

  const syncToUrl = useCallback((overrides = {}, options = {}) => {
    setSearchParams(
      buildStatLeadersParams({
        playerOrTeam,
        group,
        category,
        season,
        leagueFilter,
        leadersLeague,
        limit,
        positionFilter,
        countryFilter,
        playerSortCol,
        playerSortDir,
        teamGroup,
        teamSortCol,
        teamSortDir,
        teamMode,
        playerMode,
        ...overrides,
      }),
      { replace: options.replace ?? true },
    );
  }, [
    playerOrTeam,
    group,
    category,
    season,
    leagueFilter,
    leadersLeague,
    limit,
    positionFilter,
    countryFilter,
    playerSortCol,
    playerSortDir,
    teamGroup,
    teamSortCol,
    teamSortDir,
    teamMode,
    playerMode,
    setSearchParams,
  ]);

  const saveScroll = () => saveListScroll(STAT_LEADERS_SCROLL_KEY);

  const isTeam = playerOrTeam === 'team';
  const isCompletePlayer = !isTeam && playerMode === 'complete';
  const isCompleteTeam = isTeam && teamMode === 'complete';
  const isMlbLevel = leadersLeague === 'mlb';
  const selectedLeague = LEAGUE_LEVEL_BY_VALUE[leadersLeague] ?? LEAGUE_LEVEL_BY_VALUE.mlb;
  const teamCols = TEAM_STAT_COLS[teamGroup] ?? TEAM_BATTING_COLS;
  const playerCols = PLAYER_STAT_COLS[group] ?? TEAM_BATTING_COLS;
  const allCats = GROUP_CATS[group] ?? HITTING_CATS;

  const fetchLeaders = async ({
    statGroup = group,
    leaderCategory = category,
    season: seasonParam = season,
    resultLimit = limit,
    leagueLevel = leadersLeague,
  } = {}) => {
    const cacheKey = `player:${leagueLevel}:${statGroup}:${leaderCategory}:${seasonParam}:${resultLimit}`;
    if (cache.current[cacheKey]) {
      setLeaders(cache.current[cacheKey]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setLeaders([]);
    try {
      const url = seasonParam === 'all'
        ? `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${leaderCategory}&statGroup=${statGroup}&leaderGameTypes=R&limit=${resultLimit}&${leadersSportQuery(leagueLevel)}&statType=career&hydrate=person,team(league)`
        : `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${leaderCategory}&season=${seasonParam}&statGroup=${statGroup}&leaderGameTypes=R&limit=${resultLimit}&${leadersSportQuery(leagueLevel)}&hydrate=person,team(league)`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = (data.leagueLeaders?.[0]?.leaders ?? []).map((leader) => ({
        ...leader,
        player: leader.player ?? leader.person,
        person: leader.person ?? leader.player,
        leagueId: leader.team?.league?.id ?? leader.league?.id,
        stat: normalizeStatKeys(leader.stat ?? {}),
      }));
      cache.current[cacheKey] = list;
      setLeaders(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamStats = async ({
    statGroup = teamGroup,
    season: seasonParam = season,
    leagueLevel = leadersLeague,
  } = {}) => {
    const cacheKey = `team:${leagueLevel}:${statGroup}:${seasonParam}`;
    if (cache.current[cacheKey]) {
      setTeamStats(cache.current[cacheKey]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setTeamStats([]);
    try {
      const teams = await fetchTeamsForLevel(leagueLevel, seasonParam);
      const rows = await Promise.all(
        teams.map(async (t) => {
          const statsType = seasonParam === 'all' ? 'career' : 'season';
          const seasonPart = seasonParam === 'all' ? '' : `&season=${seasonParam}`;
          const res = await fetch(
            `https://statsapi.mlb.com/api/v1/teams/${t.id}/stats?stats=${statsType}${seasonPart}&group=${statGroup}`,
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const split = data.stats?.[0]?.splits?.[0];
          return {
            team: { id: t.id, name: t.name, abbr: t.abbr, abbreviation: t.abbr },
            leagueId: t.leagueId,
            stat: split?.stat ?? {},
          };
        }),
      );
      cache.current[cacheKey] = rows;
      setTeamStats(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initial.playerOrTeam === 'team') {
      fetchTeamStats({
        statGroup: initial.teamGroup,
        season: initial.season,
      });
    } else if (initial.playerMode === 'complete') {
      fetchCompletePlayerStats({
        statGroup: initial.group,
        season: initial.season,
      });
    } else {
      fetchLeaders({
        statGroup: initial.group,
        leaderCategory: initial.category,
        season: initial.season,
        resultLimit: initial.limit,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LEAGUE_LEVEL_STORAGE_KEY, leadersLeague);
  }, [leadersLeague]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== LEAGUE_LEVEL_STORAGE_KEY) return;
      if (!LEAGUE_LEVEL_VALUES.has(event.newValue)) return;
      setLeadersLeague(event.newValue);
      if (event.newValue !== 'mlb') setLeagueFilter('all');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseStatLeadersState(new URLSearchParams(window.location.search));

      setPlayerOrTeam(next.playerOrTeam);
      setGroup(next.group);
      setCategory(next.category);
      setSeason(next.season);
      setLeagueFilter(next.leagueFilter);
      setLeadersLeague(next.leadersLeague);
      setLimit(next.limit);
      setPositionFilter(next.positionFilter);
      setCountryFilter(next.countryFilter);
      setPlayerSortCol(next.playerSortCol);
      setPlayerSortDir(next.playerSortDir);
      setTeamGroup(next.teamGroup);
      setTeamSortCol(next.teamSortCol);
      setTeamSortDir(next.teamSortDir);
      setTeamMode(next.teamMode);
      setPlayerMode(next.playerMode);

      if (next.playerOrTeam === 'team') {
        fetchTeamStats({ statGroup: next.teamGroup, season: next.season, leagueLevel: next.leadersLeague });
    } else if (next.playerMode === 'complete') {
        fetchCompletePlayerStats({
          statGroup: next.group,
          season: next.season,
          leagueLevel: next.leadersLeague,
          sortCol: next.playerSortCol,
          sortDir: next.playerSortDir,
        });
      } else {
        fetchLeaders({
          statGroup: next.group,
          leaderCategory: next.category,
          season: next.season,
          resultLimit: next.limit,
          leagueLevel: next.leadersLeague,
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isCompletePlayer && completePlayerRows.length === 0 && !error) return;
    if (!isTeam && !isCompletePlayer && leaders.length === 0 && !error) return;
    if (isTeam && teamStats.length === 0 && !error) return;
    restoreListScroll(STAT_LEADERS_SCROLL_KEY);
  }, [completePlayerRows.length, error, isCompletePlayer, isLoading, isTeam, leaders.length, teamStats.length]);

  const handlePlayerOrTeamChange = (opt) => {
    setPlayerOrTeam(opt);
    if (opt === 'team') {
      const defaults = TEAM_SORT_DEFAULTS.hitting;
      setTeamGroup('hitting');
      setTeamSortCol(defaults.col);
      setTeamSortDir(defaults.dir);
      setTeamMode('leaders');
      syncToUrl({
        playerOrTeam: opt,
        teamGroup: 'hitting',
        teamSortCol: defaults.col,
        teamSortDir: defaults.dir,
        teamMode: 'leaders',
      });
      fetchTeamStats({ statGroup: 'hitting' });
    } else {
      setPlayerMode('cards');
      syncToUrl({ playerOrTeam: opt, playerMode: 'cards' });
      fetchLeaders();
    }
  };

  const fetchCompletePlayerStats = async ({
    statGroup = group,
    season: seasonParam = season,
    leagueLevel = leadersLeague,
    sortCol = playerSortCol,
    sortDir = playerSortDir,
  } = {}) => {
    const isAllTime = seasonParam === 'all';
    // All-time country/position filters need the full career result set. If we let the
    // API return only the first sorted slice, players disappear when sorting/filtering.
    const cacheKey = isAllTime
      ? `complete-player:${leagueLevel}:${statGroup}:${seasonParam}:all-rows`
      : `complete-player:${leagueLevel}:${statGroup}:${seasonParam}:${sortCol}:${sortDir}`;
    if (cache.current[cacheKey]) {
      setCompletePlayerRows(cache.current[cacheKey]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setCompletePlayerRows([]);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    try {
      const statsType = isAllTime ? 'career' : 'season';
      const seasonPart = isAllTime ? '' : `&season=${seasonParam}`;
      const playerPool = !isAllTime && QUALIFIED_PLAYER_SORT_COLS.has(sortCol) ? 'qualified' : 'all';
      const sortPart = !isAllTime && sortCol ? `&sortStat=${sortCol}&order=${sortDir}` : '';
      const pageLimit = isAllTime ? COMPLETE_PLAYER_PAGE_LIMIT : COMPLETE_PLAYER_LIMIT;
      const baseUrl = `https://statsapi.mlb.com/api/v1/stats?stats=${statsType}&group=${statGroup}${seasonPart}&${completeStatsSportQuery(leagueLevel)}&playerPool=${playerPool}&limit=${pageLimit}${sortPart}&hydrate=person,team(league)`;
      const splits = [];
      let offset = 0;
      let totalSplits = null;

      do {
        const url = isAllTime ? `${baseUrl}&offset=${offset}` : baseUrl;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const statBlock = data.stats?.[0] ?? {};
        const pageSplits = statBlock.splits ?? [];
        splits.push(...pageSplits);
        totalSplits = statBlock.totalSplits ?? pageSplits.length;
        offset += pageSplits.length;
        if (!isAllTime) break;
      } while (offset < totalSplits && offset > 0);

      const rows = splits.map((split) => ({
        ...split,
        player: split.player ?? split.person,
        person: split.person ?? split.player,
        leagueId: split.team?.league?.id,
        stat: normalizeStatKeys(split.stat ?? {}),
      }));
      cache.current[cacheKey] = rows;
      setCompletePlayerRows(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupChange = (g) => {
    const cats = GROUP_CATS[g] ?? HITTING_CATS;
    const nextCategory = cats[0].key;
    const defaults = PLAYER_SORT_DEFAULTS[g] ?? PLAYER_SORT_DEFAULTS.hitting;
    setGroup(g);
    setCategory(nextCategory);
    setPlayerSortCol(defaults.col);
    setPlayerSortDir(defaults.dir);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({
      group: g,
      category: nextCategory,
      playerSortCol: defaults.col,
      playerSortDir: defaults.dir,
    });
    if (playerMode === 'complete') {
      fetchCompletePlayerStats({ statGroup: g, sortCol: defaults.col, sortDir: defaults.dir });
    }
    else fetchLeaders({ statGroup: g, leaderCategory: nextCategory });
  };

  const handleTeamGroupChange = (g) => {
    const defaults = TEAM_SORT_DEFAULTS[g];
    setTeamGroup(g);
    setTeamSortCol(defaults.col);
    setTeamSortDir(defaults.dir);
    syncToUrl({
      teamGroup: g,
      teamSortCol: defaults.col,
      teamSortDir: defaults.dir,
    });
    fetchTeamStats({ statGroup: g });
  };

  const handleSeasonChange = (s) => {
    setSeason(s);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({ season: s });
    if (isTeam) fetchTeamStats({ season: s });
    else if (playerMode === 'complete') fetchCompletePlayerStats({ season: s });
    else fetchLeaders({ season: s });
  };

  const handleLeagueChange = (league) => {
    setLeagueFilter(league);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({ leagueFilter: league });
  };

  const handleLeadersLeagueChange = (level) => {
    if (level === leadersLeague) return;
    setLeadersLeague(level);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    const nextLeagueFilter = level === 'mlb' ? leagueFilter : 'all';
    if (level !== 'mlb') setLeagueFilter('all');
    syncToUrl({ leadersLeague: level, leagueFilter: nextLeagueFilter });
    if (isTeam) fetchTeamStats({ leagueLevel: level });
    else if (playerMode === 'complete') fetchCompletePlayerStats({ leagueLevel: level });
    else fetchLeaders({ leagueLevel: level });
  };

  const handlePositionChange = (pos) => {
    setPositionFilter(pos);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({ positionFilter: pos });
  };

  const handleCountryChange = (country) => {
    setCountryFilter(country);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({ countryFilter: country });
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPlayerMode('cards');
    syncToUrl({ category: cat, playerMode: 'cards' });
    fetchLeaders({ leaderCategory: cat });
  };

  const handleLimitChange = (n) => {
    setLimit(n);
    syncToUrl({ limit: n });
    fetchLeaders({ resultLimit: n });
  };

  const showCompletePlayerTable = () => {
    saveScroll();
    setPlayerMode('complete');
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({ playerMode: 'complete' }, { replace: false });
    fetchCompletePlayerStats();
  };

  const showPlayerCards = () => {
    saveScroll();
    setPlayerMode('cards');
    setLimit(DEFAULT_LIMIT);
    syncToUrl({ playerMode: 'cards', limit: DEFAULT_LIMIT }, { replace: false });
    fetchLeaders({ resultLimit: DEFAULT_LIMIT });
  };

  const handlePlayerSort = (col) => {
    if (playerSortCol === col) {
      const nextDir = playerSortDir === 'asc' ? 'desc' : 'asc';
      setPlayerSortDir(nextDir);
      setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
      syncToUrl({ playerSortDir: nextDir });
      if (season !== 'all') fetchCompletePlayerStats({ sortCol: col, sortDir: nextDir });
      return;
    }
    const meta = playerCols.find((c) => c.key === col);
    const nextDir = meta?.lowerBetter ? 'asc' : 'desc';
    setPlayerSortCol(col);
    setPlayerSortDir(nextDir);
    setCompletePlayerDisplayLimit(COMPLETE_PLAYER_ROWS_STEP);
    syncToUrl({ playerSortCol: col, playerSortDir: nextDir });
    if (season !== 'all') fetchCompletePlayerStats({ sortCol: col, sortDir: nextDir });
  };

  const handleTeamSort = (col) => {
    if (teamSortCol === col) {
      const nextDir = teamSortDir === 'asc' ? 'desc' : 'asc';
      setTeamSortDir(nextDir);
      syncToUrl({ teamSortDir: nextDir });
      return;
    }
    const meta = teamCols.find((c) => c.key === col);
    const nextDir = meta?.lowerBetter ? 'asc' : 'desc';
    setTeamSortCol(col);
    setTeamSortDir(nextDir);
    syncToUrl({ teamSortCol: col, teamSortDir: nextDir });
  };

  const handleTeamModeChange = (mode) => {
    if (mode !== teamMode) saveScroll();
    setTeamMode(mode);
    syncToUrl({ teamMode: mode }, { replace: mode !== teamMode ? false : true });
  };

  const currentCat = allCats.find((c) => c.key === category) ?? allCats[0];
  const filteredLeaders = leaders.filter((l) => {
    if (!isMlbLevel || leagueFilter === 'all') return true;
    const leagueId = l.team?.league?.id;
    if (leagueFilter === 'AL') return leagueId === 103;
    if (leagueFilter === 'NL') return leagueId === 104;
    return true;
  });

  const filteredTeamStats = teamStats.filter((row) => {
    if (!isMlbLevel || leagueFilter === 'all') return true;
    if (leagueFilter === 'AL') return row.leagueId === 103;
    if (leagueFilter === 'NL') return row.leagueId === 104;
    return true;
  });

  const filteredCompletePlayers = useMemo(() => completePlayerRows.filter((row) => {
    if (isMlbLevel && leagueFilter === 'AL' && row.leagueId !== 103) return false;
    if (isMlbLevel && leagueFilter === 'NL' && row.leagueId !== 104) return false;
    if (!countryMatches(row, countryFilter)) return false;
    return positionMatches(row, positionFilter);
  }), [completePlayerRows, countryFilter, isMlbLevel, leagueFilter, positionFilter]);

  const countryOptions = useMemo(() => buildCountryOptions(completePlayerRows), [completePlayerRows]);
  const selectedCountryLabel =
    countryOptions.find((option) => option.value === normalizeCountryName(countryFilter))?.label ?? ALL_COUNTRIES_OPTION.label;

  const rankedTeamStats = rankTeams(filteredTeamStats, teamSortCol, teamSortDir);
const rankedCompletePlayers = useMemo(
    () => rankRowsByStat(filteredCompletePlayers, playerSortCol, playerSortDir, season),
    [filteredCompletePlayers, playerSortCol, playerSortDir, season],
  );
  const visibleRankedCompletePlayers = rankedCompletePlayers.slice(0, completePlayerDisplayLimit);
  const hasMoreCompletePlayers = visibleRankedCompletePlayers.length < rankedCompletePlayers.length;
  const teamLeaderCards = teamCols
    .filter((col) => !['gamesPlayed', 'gamesStarted', 'atBats'].includes(col.key))
    .map((col) => {
      const ranked = rankTeams(filteredTeamStats, col.key, col.lowerBetter ? 'asc' : 'desc');
      return { col, leaders: ranked.slice(0, 5) };
    })
    .filter((item) => item.leaders.length > 0);

  const teamGroupLabel = teamGroup === 'hitting' ? 'Batting' : teamGroup === 'pitching' ? 'Pitching' : 'Fielding';
  const playerGroupLabel = group === 'hitting' ? 'Batting' : group === 'pitching' ? 'Pitching' : 'Fielding';
  const leagueLabel = isMlbLevel
    ? (leagueFilter === 'all' ? 'MLB' : leagueFilter)
    : selectedLeague.shortLabel;
  const seasonLabel = season === 'all' ? 'All-Time' : season;
  const seasonSubLabel = season === 'all' ? 'Career totals' : `${season} Regular Season`;

  return (
    <div className={`mx-auto px-4 sm:px-6 py-0 sm:py-8 ${isTeam || isCompletePlayer ? 'max-w-7xl' : 'max-w-4xl'}`}>
      <div className="">
        <div className="flex items-center justify-between gap-3">
          <div className={`text-${THEME_COLOR}-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>
            League Leaders
          </div>
          <LeagueLevelPicker
            value={leadersLeague}
            onChange={handleLeadersLeagueChange}
            ariaLabel="Change league leaders level"
          />
        </div>
        {/* <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Stat Leaders</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Top performers in every statistical category
        </p> */}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5 mb-6 space-y-4">
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-fit">
          <SegmentedControl
            value={playerOrTeam}
            onChange={handlePlayerOrTeamChange}
            variant="emerald"
            options={[
              { value: 'player', label: 'Player' },
              { value: 'team', label: 'Team' },
            ]}
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {!isTeam && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              <SegmentedControl
                value={playerMode}
                onChange={(mode) => {
                  if (mode === 'complete') showCompletePlayerTable();
                  else showPlayerCards();
                }}
                options={[
                  { value: 'cards', label: 'Stat Leaders' },
                  { value: 'complete', label: 'Complete Leaders' },
                ]}
              />
            </div>
          )}

          {isTeam && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              <SegmentedControl
                value={teamMode}
                onChange={handleTeamModeChange}
                options={[
                  { value: 'leaders', label: 'League Leaders' },
                  { value: 'complete', label: 'Complete Leaders' },
                ]}
              />
            </div>
          )}

          <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
            <SegmentedControl
              value={isTeam ? teamGroup : group}
              onChange={isTeam ? handleTeamGroupChange : handleGroupChange}
              options={[
                { value: 'hitting', label: 'hitting' },
                { value: 'pitching', label: 'pitching' },
                { value: 'fielding', label: 'fielding' },
              ]}
            />
          </div>

          {isMlbLevel && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              <SegmentedControl
                value={leagueFilter}
                onChange={handleLeagueChange}
                options={[
                  { value: 'all', label: 'MLB' },
                  { value: 'AL', label: 'AL' },
                  { value: 'NL', label: 'NL' },
                ]}
              />
            </div>
          )}

          <Select value={season} onChange={handleSeasonChange} options={SEASON_OPTIONS} />

          {isCompletePlayer && (
            <>
              <Select
                value={positionFilter}
                onChange={handlePositionChange}
                options={POSITION_OPTIONS}
                className="w-44"
              />
              <Select
                value={countryFilter}
                onChange={handleCountryChange}
                options={countryOptions}
                className="w-48"
              />
            </>
          )}
        </div>

        {!isTeam && playerMode !== 'complete' && (
          <SegmentedControl
            value={category}
            onChange={handleCategoryChange}
            variant="category"
            size="sm"
            wrap
            options={allCats.map((cat) => ({ value: cat.key, label: cat.abbr }))}
          />
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-base sm:text-lg">
              {isTeam
                ? `${leagueLabel} Team ${teamGroupLabel} ${teamMode === 'complete' ? 'Complete Leaders' : 'League Leaders'} ${seasonLabel}`
                : playerMode === 'complete'
                  ? `${leagueLabel} Player ${playerGroupLabel} Complete Leaders ${seasonLabel}`
                  : `${currentCat.label} Leaders`}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {seasonSubLabel}
              {isTeam
                ? ` · ${teamGroupLabel} · ${teamMode === 'complete' ? 'full table' : 'quick view'}`
                : playerMode === 'complete'
                  ? ` · ${playerGroupLabel} · ${POSITION_OPTIONS.find((option) => option.value === positionFilter)?.label ?? 'All Positions'} · ${selectedCountryLabel}`
                  : ` · ${group} · quick view`}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {isMlbLevel ? (
              <LeagueLogo filter={leagueFilter} />
            ) : (
              <img
                src={selectedLeague.logo}
                alt=""
                className="w-8 h-8 object-contain flex-shrink-0"
              />
            )}
            {isLoading && <BaseballSpinner size="sm" inline />}
          </div>
        </div>

        {!isLoading && error && (
          <div className="p-8 text-center text-red-400 text-sm">{error}</div>
        )}

        {isTeam && teamMode === 'leaders' && !isLoading && !error && teamLeaderCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3 sm:p-4">
            {teamLeaderCards.map(({ col, leaders }) => {
              const leader = leaders[0];
              const nextLeaders = leaders.slice(1);
              return (
              <button
                key={col.key}
                type="button"
                onClick={() => {
                  const nextDir = col.lowerBetter ? 'asc' : 'desc';
                  saveScroll();
                  setTeamSortCol(col.key);
                  setTeamSortDir(nextDir);
                  setTeamMode('complete');
                  syncToUrl(
                    { teamSortCol: col.key, teamSortDir: nextDir, teamMode: 'complete' },
                    { replace: false },
                  );
                }}
                className="group relative overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-slate-800/80"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_45%)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-black tracking-tight text-white">{statFullLabel(col)}</div>
                    <div className="mt-3 font-display text-5xl leading-none text-emerald-300 tabular-nums">
                      {formatValue(leader.stat?.[col.key], col.format)}
                    </div>
                  </div>
                  {leader.team?.id && (
                    <img
                      src={teamLogoUrl(leader.team.id)}
                      alt=""
                      className="h-16 w-16 flex-shrink-0 object-contain"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  )}
                </div>
                <div className="relative mt-4">
                  <TeamIdentity team={leader.team} />
                </div>
                {nextLeaders.length > 0 && (
                  <div className="relative mt-4 space-y-2 border-t border-slate-800/80 pt-3">
                    {nextLeaders.map((row) => (
                      <div key={row.team?.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-5 flex-shrink-0 font-mono text-[10px] text-slate-600">#{row.rank}</span>
                          {row.team?.id && (
                            <img
                              src={teamLogoUrl(row.team.id)}
                              alt=""
                              className="h-5 w-5 flex-shrink-0 object-contain"
                              onError={(e) => (e.target.style.display = 'none')}
                            />
                          )}
                          <span className="font-mono text-[10px] font-black text-slate-500">{row.team?.abbr ?? '—'}</span>
                          <span className="truncate font-semibold text-slate-300">{row.team?.name ?? '—'}</span>
                        </div>
                        <span className="flex-shrink-0 font-mono font-bold text-slate-300 tabular-nums">
                          {formatValue(row.stat?.[col.key], col.format)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
                  Complete Leaders
                  <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </button>
            )})}
          </div>
        )}

        {isCompleteTeam && !isLoading && !error && rankedTeamStats.length > 0 && (
          <div className={COMPLETE_LEADERS_TABLE_SCROLL}>
            <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.lg}`}>
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40">
                  <th className={`${stickyRankHead('bg-slate-900', { stickTop: true })} font-semibold text-slate-400`}>RK</th>
                  <th className={`${stickyTeamHeadAfterRank('bg-slate-900', { stickTop: true })} font-semibold text-slate-400`}>Team</th>
                  {teamCols.map((col) => (
                    <th
                      key={col.key}
                      className={scrollStatHead(
                        `font-semibold cursor-pointer select-none transition-colors ${teamSortCol === col.key ? `text-${THEME_COLOR}-400` : 'text-slate-400 hover:text-slate-200'}`,
                        { stickTop: true, bg: 'bg-slate-900' },
                      )}
                      onClick={() => handleTeamSort(col.key)}
                    >
                      {col.label}
                      {teamSortCol === col.key && (
                        <span className="ml-0.5">{teamSortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedTeamStats.map((row) => (
                  <tr
                    key={row.team?.id}
                    className="group border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors cursor-pointer"
                    onClick={() => {
                      saveScroll();
                      navigate(`/team/${row.team?.id}`);
                    }}
                  >
                    <td className={`${stickyRankCell('bg-slate-900')} font-mono text-xs text-slate-500`}>{row.rank}</td>
                    <td className={stickyTeamCellAfterRank('bg-slate-900')}>
                      <TeamAbbrCell
                        team={row.team}
                        size="sm"
                        abbrClassName="text-[10px] font-black uppercase tracking-wide text-slate-400"
                        nameClassName="font-semibold text-slate-200"
                      />
                    </td>
                    {teamCols.map((col) => (
                      <td
                        key={col.key}
                        className={scrollStatCell(teamSortCol === col.key ? `text-${THEME_COLOR}-300` : '')}
                      >
                        {formatValue(row.stat?.[col.key], col.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isCompleteTeam && !isLoading && !error && (
          <div className="px-5 sm:px-6 py-3 border-t border-slate-800 text-[11px] text-slate-500">
            Click column headers to sort · Statistics updated from MLB Stats API
          </div>
        )}

        {isTeam && !isLoading && !error && (
          teamMode === 'leaders' ? teamLeaderCards.length === 0 : rankedTeamStats.length === 0
        ) && (
          <div className="p-12 text-center text-slate-500 text-sm">No team data available.</div>
        )}

        {!isTeam && !isCompletePlayer && !isLoading && !error && leaders.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">
            No data available for this category / season combination.
          </div>
        )}

        {isCompletePlayer && !isLoading && !error && rankedCompletePlayers.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">
            No complete player stats available for this selection.
          </div>
        )}

        {isCompletePlayer && !isLoading && !error && rankedCompletePlayers.length > 0 && (
          <div className={COMPLETE_LEADERS_TABLE_SCROLL}>
            <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.lg}`}>
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40">
                  <th className={`${stickyRankHead('bg-slate-900', { stickTop: true })} font-semibold text-slate-400`}>RK</th>
                  <th className={`${stickyPlayerHeadAfterRank('bg-slate-900', { stickTop: true })} font-semibold text-slate-400`}>
                    Name
                  </th>
                  <th className={scrollStatHead('text-center font-semibold text-slate-400', { stickTop: true, bg: 'bg-slate-900' })}>POS</th>
                  {playerCols.map((col) => (
                    <th
                      key={col.key}
                      className={scrollStatHead(
                        `font-semibold cursor-pointer select-none transition-colors ${playerSortCol === col.key ? `text-${THEME_COLOR}-400` : 'text-slate-400 hover:text-slate-200'}`,
                        { stickTop: true, bg: 'bg-slate-900' },
                      )}
                      onClick={() => handlePlayerSort(col.key)}
                    >
                      {col.label}
                      {playerSortCol === col.key && (
                        <span className="ml-0.5">{playerSortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRankedCompletePlayers.map((row) => (
                  <tr
                    key={`${row.player?.id ?? row.person?.id}-${row.team?.id ?? 'team'}-${row.season ?? season}`}
                    className="group border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors"
                  >
                    <td className={`${stickyRankCell('bg-slate-900')} font-mono text-xs text-slate-500`}>
                      {row.rank}
                    </td>
                    <td className={stickyPlayerCellAfterRank('bg-slate-900')}>
                      <PlayerIdentity
                        player={row.player ?? row.person}
                        team={row.team}
                        onPlayerClick={saveScroll}
                        onTeamClick={(e) => {
                          e.stopPropagation();
                          saveScroll();
                          navigate(`/team/${row.team?.id}`);
                        }}
                      />
                    </td>
                    <td className={scrollStatCell('text-center text-slate-500', { align: 'text-center' })}>
                      {getPlayerPosition(row) || '—'}
                    </td>
                    {playerCols.map((col) => (
                      <td
                        key={col.key}
                        className={scrollStatCell(playerSortCol === col.key ? `text-${THEME_COLOR}-300` : '')}
                      >
                        {formatValue(row.stat?.[col.key], col.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMoreCompletePlayers && (
              <div className="sticky bottom-0 z-30 flex items-center justify-center border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setCompletePlayerDisplayLimit((n) => n + COMPLETE_PLAYER_ROWS_STEP)}
                  className={`rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-${THEME_COLOR}-300 transition-colors hover:border-${THEME_COLOR}-500/50 hover:bg-slate-800/80`}
                >
                  Show more
                  <span className="ml-2 text-xs font-semibold text-slate-500">
                    {visibleRankedCompletePlayers.length} of {rankedCompletePlayers.length}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {!isTeam && playerMode !== 'complete' && filteredLeaders.map((leader, i) => {
          const isTop3 = i < 3;
          return (
            <div
              key={leader.person?.id ?? i}
              className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors ${
                isTop3 ? 'bg-gradient-to-r from-slate-800/40 to-transparent' : ''
              }`}
            >
              <div className="w-8 sm:w-10 text-center flex-shrink-0">
                {isTop3 ? (
                  <span className="text-xl sm:text-[30px]">{MEDAL[i]}</span>
                ) : (
                  <span className="font-mono text-slate-500 text-sm">{leader.rank}</span>
                )}
              </div>

              <img
                src={playerHeadshotUrl(leader.person?.id)}
                alt={leader.person?.fullName}
                className="w-10 h-10 sm:w-20 sm:h-20 "
                onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
              />

              <div className="flex-1 min-w-0">
                <Link
                  to={`/player/${leader.person?.id}`}
                  onClick={saveScroll}
                  className={`font-semibold hover:text-${THEME_COLOR}-400 transition-colors truncate block text-sm sm:text-base`}
                >
                  {compactPlayerName(leader.person?.fullName)}
                </Link>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  {leader.team?.id && (
                    <img
                      src={teamLogoUrl(leader.team.id)}
                      alt=""
                      className="w-6 h-6 object-contain cursor-pointer"
                      onClick={() => {
                        saveScroll();
                        navigate(`/team/${leader.team.id}`);
                      }}
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  )}
                  <span className="truncate">{leader.team?.name ?? '—'}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div
                  className={`font-display tabular-nums leading-none ${
                    i === 0 ? 'text-3xl text-5xl sm:text-6xl text-yellow-400'
                    : i === 1 ? 'text-2xl text-4xl sm:text-5xl text-slate-300'
                    : i === 2 ? 'text-2xl text-3xl sm:text-4xl text-amber-600'
                    : 'text-2xl sm:text-2xl text-slate-300'
                  }`}
                >
                  {formatValue(leader.value, currentCat.format)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{currentCat.abbr}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-xs text-slate-600 text-center">
        Data from MLB Stats API ·{' '}
        <code className="font-mono">
          {isTeam
            ? `/v1/teams/{teamId}/stats?stats=${season === 'all' ? 'career' : 'season'}&group=${teamGroup}${season === 'all' ? '' : `&season=${season}`}`
            : season === 'all'
              ? `/v1/stats/leaders?leaderCategories=${category}&statType=career`
              : `/v1/stats/leaders?leaderCategories=${category}&season=${season}`}
        </code>
      </div>
    </div>
  );
}
