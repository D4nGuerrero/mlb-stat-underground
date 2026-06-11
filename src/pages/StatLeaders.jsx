import { useState, useEffect, useRef, useCallback } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { restoreListScroll, saveListScroll } from '../utils/listScrollRestore';
import { mlbTeams, playerHeadshotUrl, teamLogoUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';
import {
  SegmentedControl,
  Select,
  stickyTeamAbbrHeadAfterRank,
  stickyTeamAbbrCellAfterRank,
  stickyRankHead,
  stickyRankCell,
  scrollStatHead,
  scrollStatCell,
  TABLE_SCROLL_BODY,
  TABLE_BASE,
  BaseballSpinner,
} from '../components/ui';
import { TABLE_TEXT_CLASS, TABLE_MIN_W } from '../theme/tableTheme';
import TeamAbbrCell from '../components/TeamAbbrCell';

const SEASON_OPTIONS = [2026, 2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017].map((y) => ({
  value: String(y),
  label: `${y} Season`,
}));
const LIMIT_OPTIONS = [
  { value: 10, label: 'Top 10' },
  { value: 25, label: 'Top 25' },
  { value: 50, label: 'Top 50' },
];

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

const TEAM_SORT_DEFAULTS = {
  hitting: { col: 'homeRuns', dir: 'desc' },
  pitching: { col: 'era', dir: 'asc' },
  fielding: { col: 'fielding', dir: 'desc' },
};

const STAT_LEADERS_SCROLL_KEY = 'stat-leaders';
const DEFAULT_SEASON = '2026';
const DEFAULT_LIMIT = 25;
const VALID_GROUPS = new Set(['hitting', 'pitching', 'fielding']);
const VALID_LEAGUES = new Set(['all', 'AL', 'NL']);

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

  const playerGroup = playerOrTeam === 'player' ? activeGroup : 'hitting';
  const cats = GROUP_CATS[playerGroup] ?? HITTING_CATS;
  const categoryParam = searchParams.get('category');
  const category = cats.some((c) => c.key === categoryParam)
    ? categoryParam
    : defaultCategoryForGroup(playerGroup);

  const teamGroup = playerOrTeam === 'team' ? activeGroup : 'hitting';
  const teamDefaults = TEAM_SORT_DEFAULTS[teamGroup] ?? TEAM_SORT_DEFAULTS.hitting;
  const teamCols = TEAM_STAT_COLS[teamGroup] ?? TEAM_BATTING_COLS;
  const sortParam = searchParams.get('sort');
  const teamSortCol = teamCols.some((c) => c.key === sortParam) ? sortParam : teamDefaults.col;
  const dirParam = searchParams.get('dir');
  const teamSortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : teamDefaults.dir;

  return {
    playerOrTeam,
    group: playerGroup,
    category,
    season,
    leagueFilter,
    limit,
    teamGroup,
    teamSortCol,
    teamSortDir,
  };
}

function buildStatLeadersParams(state) {
  const params = new URLSearchParams();
  if (state.playerOrTeam === 'team') params.set('view', 'team');

  const activeGroup = state.playerOrTeam === 'team' ? state.teamGroup : state.group;
  if (activeGroup !== 'hitting') params.set('group', activeGroup);

  if (state.season !== DEFAULT_SEASON) params.set('season', state.season);
  if (state.leagueFilter !== 'all') params.set('league', state.leagueFilter);

  if (state.playerOrTeam === 'player') {
    if (state.category !== defaultCategoryForGroup(state.group)) {
      params.set('category', state.category);
    }
    if (state.limit !== DEFAULT_LIMIT) params.set('limit', String(state.limit));
  } else {
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
  const [leagueFilter, setLeagueFilter] = useState(initial.leagueFilter);
  const [teamStats, setTeamStats] = useState([]);
  const [teamGroup, setTeamGroup] = useState(initial.teamGroup);
  const [teamSortCol, setTeamSortCol] = useState(initial.teamSortCol);
  const [teamSortDir, setTeamSortDir] = useState(initial.teamSortDir);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(initial.limit);

  const syncToUrl = useCallback((overrides = {}) => {
    setSearchParams(
      buildStatLeadersParams({
        playerOrTeam,
        group,
        category,
        season,
        leagueFilter,
        limit,
        teamGroup,
        teamSortCol,
        teamSortDir,
        ...overrides,
      }),
      { replace: true },
    );
  }, [
    playerOrTeam,
    group,
    category,
    season,
    leagueFilter,
    limit,
    teamGroup,
    teamSortCol,
    teamSortDir,
    setSearchParams,
  ]);

  const saveScroll = () => saveListScroll(STAT_LEADERS_SCROLL_KEY);

  const isTeam = playerOrTeam === 'team';
  const teamCols = TEAM_STAT_COLS[teamGroup] ?? TEAM_BATTING_COLS;
  const allCats = GROUP_CATS[group] ?? HITTING_CATS;

  const fetchLeaders = async ({
    statGroup = group,
    leaderCategory = category,
    season: seasonParam = season,
    resultLimit = limit,
  } = {}) => {
    const cacheKey = `player:${statGroup}:${leaderCategory}:${seasonParam}:${resultLimit}`;
    if (cache.current[cacheKey]) {
      setLeaders(cache.current[cacheKey]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setLeaders([]);
    try {
      const url = `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${leaderCategory}&season=${seasonParam}&statGroup=${statGroup}&leaderGameTypes=R&limit=${resultLimit}&sportId=1&hydrate=person,team(league)`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.leagueLeaders?.[0]?.leaders ?? [];
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
  } = {}) => {
    const cacheKey = `team:${statGroup}:${seasonParam}`;
    if (cache.current[cacheKey]) {
      setTeamStats(cache.current[cacheKey]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setTeamStats([]);
    try {
      const rows = await Promise.all(
        mlbTeams.map(async (t) => {
          const res = await fetch(
            `https://statsapi.mlb.com/api/v1/teams/${t.id}/stats?stats=season&season=${seasonParam}&group=${statGroup}`,
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const split = data.stats?.[0]?.splits?.[0];
          return {
            team: { id: t.id, name: t.name, abbr: t.abbr },
            leagueId: AL_TEAM_IDS.has(t.id) ? 103 : 104,
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
    if (isLoading) return;
    if (!isTeam && leaders.length === 0 && !error) return;
    if (isTeam && teamStats.length === 0 && !error) return;
    restoreListScroll(STAT_LEADERS_SCROLL_KEY);
  }, [isLoading, isTeam, leaders.length, teamStats.length, error]);

  const handlePlayerOrTeamChange = (opt) => {
    setPlayerOrTeam(opt);
    if (opt === 'team') {
      const defaults = TEAM_SORT_DEFAULTS.hitting;
      setTeamGroup('hitting');
      setTeamSortCol(defaults.col);
      setTeamSortDir(defaults.dir);
      syncToUrl({
        playerOrTeam: opt,
        teamGroup: 'hitting',
        teamSortCol: defaults.col,
        teamSortDir: defaults.dir,
      });
      fetchTeamStats({ statGroup: 'hitting' });
    } else {
      syncToUrl({ playerOrTeam: opt });
      fetchLeaders();
    }
  };

  const handleGroupChange = (g) => {
    const cats = GROUP_CATS[g] ?? HITTING_CATS;
    const nextCategory = cats[0].key;
    setGroup(g);
    setCategory(nextCategory);
    syncToUrl({ group: g, category: nextCategory });
    fetchLeaders({ statGroup: g, leaderCategory: nextCategory });
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
    syncToUrl({ season: s });
    if (isTeam) fetchTeamStats({ season: s });
    else fetchLeaders({ season: s });
  };

  const handleLeagueChange = (league) => {
    setLeagueFilter(league);
    syncToUrl({ leagueFilter: league });
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    syncToUrl({ category: cat });
    fetchLeaders({ leaderCategory: cat });
  };

  const handleLimitChange = (n) => {
    setLimit(n);
    syncToUrl({ limit: n });
    fetchLeaders({ resultLimit: n });
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

  const currentCat = allCats.find((c) => c.key === category) ?? allCats[0];
  const filteredLeaders = leaders.filter((l) => {
    if (leagueFilter === 'all') return true;
    const leagueId = l.team?.league?.id;
    if (leagueFilter === 'AL') return leagueId === 103;
    if (leagueFilter === 'NL') return leagueId === 104;
    return true;
  });

  const filteredTeamStats = teamStats.filter((row) => {
    if (leagueFilter === 'all') return true;
    if (leagueFilter === 'AL') return row.leagueId === 103;
    if (leagueFilter === 'NL') return row.leagueId === 104;
    return true;
  });

  const rankedTeamStats = rankTeams(filteredTeamStats, teamSortCol, teamSortDir);

  const teamGroupLabel = teamGroup === 'hitting' ? 'Batting' : teamGroup === 'pitching' ? 'Pitching' : 'Fielding';
  const leagueLabel = leagueFilter === 'all' ? 'MLB' : leagueFilter;

  return (
    <div className={`mx-auto px-4 sm:px-6 py-6 sm:py-8 ${isTeam ? 'max-w-7xl' : 'max-w-4xl'}`}>
      <div className="mb-6">
        <div className={`text-${THEME_COLOR}-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>
          League Leaders
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Stat Leaders</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Top performers in every statistical category
        </p>
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

          <Select value={season} onChange={handleSeasonChange} options={SEASON_OPTIONS} />

          {!isTeam && (
            <Select value={limit} onChange={handleLimitChange} options={LIMIT_OPTIONS} />
          )}
        </div>

        {!isTeam && (
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
                ? `${leagueLabel} Team ${teamGroupLabel} Stats ${season}`
                : `${currentCat.label} Leaders`}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {season} Regular Season
              {isTeam
                ? ` · ${teamGroupLabel}`
                : ` · ${group} · Top ${limit}`}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <LeagueLogo filter={leagueFilter} />
            {isLoading && <BaseballSpinner size="sm" inline />}
          </div>
        </div>

        {!isLoading && error && (
          <div className="p-8 text-center text-red-400 text-sm">{error}</div>
        )}

        {isTeam && !isLoading && !error && rankedTeamStats.length > 0 && (
          <div className={TABLE_SCROLL_BODY}>
            <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.lg}`}>
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40">
                  <th className={`${stickyRankHead('bg-slate-900', { stickTop: true })} font-semibold text-slate-400`}>RK</th>
                  <th className={`${stickyTeamAbbrHeadAfterRank('bg-slate-900', { stickTop: true })} font-semibold text-slate-400`}>Team</th>
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
                    <td className={stickyTeamAbbrCellAfterRank('bg-slate-900')}>
                      <TeamAbbrCell team={row.team} abbrOnly size="sm" abbrClassName="text-[10px] font-medium" />
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

        {isTeam && !isLoading && !error && (
          <div className="px-5 sm:px-6 py-3 border-t border-slate-800 text-[11px] text-slate-500">
            Click column headers to sort · Statistics updated from MLB Stats API
          </div>
        )}

        {isTeam && !isLoading && !error && rankedTeamStats.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">No team data available.</div>
        )}

        {!isTeam && !isLoading && !error && leaders.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">
            No data available for this category / season combination.
          </div>
        )}

        {!isTeam && filteredLeaders.map((leader, i) => {
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
                  {leader.person?.fullName ?? '—'}
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
          {isTeam ? `/v1/teams/{teamId}/stats?stats=season&group=${teamGroup}&season=${season}` : `/v1/stats/leaders?leaderCategories=${category}&season=${season}`}
        </code>
      </div>
    </div>
  );
}