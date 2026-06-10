import { useState, useEffect, useRef } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { Link, useNavigate } from 'react-router-dom';
import { mlbTeams, playerHeadshotUrl, teamLogoUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';
import { SegmentedControl, Select } from '../components/ui';

const SEASON_OPTIONS = [2026, 2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017].map((y) => ({
  value: String(y),
  label: `${y} Season`,
}));
const LIMIT_OPTIONS = [
  { value: 10, label: 'Top 10' },
  { value: 25, label: 'Top 25' },
  { value: 50, label: 'Top 50' },
];

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

// ESPN-style team stats table (https://www.espn.com/mlb/stats/_/view/team)
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

const TEAM_SORT_DEFAULTS = {
  batting: { col: 'homeRuns', dir: 'desc' },
  pitching: { col: 'era', dir: 'asc' },
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

export default function StatLeaders() {
  const navigate = useNavigate();
  const cache = useRef({});
  const [playerOrTeam, setPlayerOrTeam] = useState('player'); // 'player' | 'team'
  const [group, setGroup] = useState('hitting');
  const [category, setCategory] = useState('homeRuns');
  const [season, setSeason] = useState('2026');
  const [leaders, setLeaders] = useState([]);
  const [leagueFilter, setLeagueFilter] = useState('all'); // 'all' | 'AL' | 'NL'
  const [teamStats, setTeamStats] = useState([]);
  const [teamGroup, setTeamGroup] = useState('batting');
  const [teamLeagueFilter, setTeamLeagueFilter] = useState('all');
  const [teamSortCol, setTeamSortCol] = useState(TEAM_SORT_DEFAULTS.batting.col);
  const [teamSortDir, setTeamSortDir] = useState(TEAM_SORT_DEFAULTS.batting.dir);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(25);

  const isTeam = playerOrTeam === 'team';
  const teamCols = teamGroup === 'batting' ? TEAM_BATTING_COLS : TEAM_PITCHING_COLS;
  const allCats = group === 'hitting' ? HITTING_CATS : group === 'pitching' ? PITCHING_CATS : FIELDING_CATS;

  const handleGroupChange = (g) => {
    setGroup(g);
    const cats = g === 'hitting' ? HITTING_CATS : g === 'pitching' ? PITCHING_CATS : FIELDING_CATS;
    setCategory(cats[0].key);
  };

  useEffect(() => {
    if (isTeam) {
      fetchTeamStats();
    } else {
      fetchLeaders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, season, group, limit, teamGroup, playerOrTeam]);

  const fetchLeaders = async () => {
    const cacheKey = `player:${group}:${category}:${season}:${limit}`;
    if (cache.current[cacheKey]) {
      setLeaders(cache.current[cacheKey]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setLeaders([]);
    try {
      const url = `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${category}&season=${season}&statGroup=${group}&leaderGameTypes=R&limit=${limit}&sportId=1&hydrate=person,team(league)`;
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

  const fetchTeamStats = async () => {
    const apiGroup = teamGroup === 'batting' ? 'hitting' : 'pitching';
    const cacheKey = `team:${apiGroup}:${season}`;
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
            `https://statsapi.mlb.com/api/v1/teams/${t.id}/stats?stats=season&season=${season}&group=${apiGroup}`,
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

  const handleTeamSort = (col) => {
    if (teamSortCol === col) {
      setTeamSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    const meta = teamCols.find((c) => c.key === col);
    setTeamSortCol(col);
    setTeamSortDir(meta?.lowerBetter ? 'asc' : 'desc');
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
    if (teamLeagueFilter === 'all') return true;
    if (teamLeagueFilter === 'AL') return row.leagueId === 103;
    if (teamLeagueFilter === 'NL') return row.leagueId === 104;
    return true;
  });

  const rankedTeamStats = rankTeams(filteredTeamStats, teamSortCol, teamSortDir);

  return (
    <div className={`mx-auto px-4 sm:px-6 py-6 sm:py-8 ${isTeam ? 'max-w-7xl' : 'max-w-4xl'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className={`text-${THEME_COLOR}-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>
          League Leaders
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Stat Leaders</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Top performers in every statistical category
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5 mb-6 space-y-4">
        {/* Player / Team toggle */}
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-fit">
          <SegmentedControl
            value={playerOrTeam}
            onChange={(opt) => {
              setPlayerOrTeam(opt);
              if (opt === 'team') {
                setTeamGroup('batting');
                setTeamLeagueFilter('all');
                setTeamSortCol(TEAM_SORT_DEFAULTS.batting.col);
                setTeamSortDir(TEAM_SORT_DEFAULTS.batting.dir);
              }
            }}
            variant="emerald"
            options={[
              { value: 'player', label: 'Player' },
              { value: 'team', label: 'Team' },
            ]}
          />
        </div>

        {/* Group + season */}
        <div className="flex flex-wrap gap-3 items-center">
          {!isTeam && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              <SegmentedControl
                value={group}
                onChange={handleGroupChange}
                options={[
                  { value: 'hitting', label: 'hitting' },
                  { value: 'pitching', label: 'pitching' },
                  { value: 'fielding', label: 'fielding' },
                ]}
              />
            </div>
          )}

          {!isTeam && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              <SegmentedControl
                value={leagueFilter}
                onChange={setLeagueFilter}
                options={[
                  { value: 'all', label: 'MLB' },
                  { value: 'AL', label: 'AL' },
                  { value: 'NL', label: 'NL' },
                ]}
              />
            </div>
          )}

          <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} />

          {!isTeam && (
            <Select value={limit} onChange={setLimit} options={LIMIT_OPTIONS} />
          )}
        </div>

        {/* ESPN-style team controls: Batting/Pitching + league filter */}
        {isTeam && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-fit">
              <SegmentedControl
                value={teamGroup}
                onChange={(g) => {
                  setTeamGroup(g);
                  const defaults = TEAM_SORT_DEFAULTS[g];
                  setTeamSortCol(defaults.col);
                  setTeamSortDir(defaults.dir);
                }}
                variant="emerald"
                options={[
                  { value: 'batting', label: 'Batting' },
                  { value: 'pitching', label: 'Pitching' },
                ]}
              />
            </div>

            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-fit">
              <SegmentedControl
                value={teamLeagueFilter}
                onChange={setTeamLeagueFilter}
                options={[
                  { value: 'all', label: 'All MLB' },
                  { value: 'AL', label: 'American League' },
                  { value: 'NL', label: 'National League' },
                ]}
              />
            </div>
          </div>
        )}

        {/* Category pills (player leaders only) */}
        {!isTeam && (
          <SegmentedControl
            value={category}
            onChange={setCategory}
            variant="category"
            size="sm"
            wrap
            options={allCats.map((cat) => ({ value: cat.key, label: cat.abbr }))}
          />
        )}
      </div>

      {/* Results card */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
        {/* Header row */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base sm:text-lg">
              {isTeam
                ? `MLB Team ${teamGroup === 'batting' ? 'Batting' : 'Pitching'} Stats ${season}`
                : `${currentCat.label} Leaders`}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {season} Regular Season
              {isTeam
                ? ` · ${teamLeagueFilter === 'all' ? 'All MLB' : teamLeagueFilter === 'AL' ? 'American League' : 'National League'}`
                : ` · ${group} · Top ${limit}`}
            </div>
          </div>
          {isLoading && (
            <div className={`w-5 h-5 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin flex-shrink-0`} />
          )}
        </div>

        {/* Error */}
        {!isLoading && error && (
          <div className="p-8 text-center text-red-400 text-sm">{error}</div>
        )}

        {/* ESPN-style team stats table */}
        {isTeam && !isLoading && !error && rankedTeamStats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 w-10 sticky left-0 bg-slate-900 z-10">RK</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 min-w-[180px] sticky left-10 bg-slate-900 z-10">Team</th>
                  {teamCols.map((col) => (
                    <th
                      key={col.key}
                      className={`px-2 py-2.5 text-xs font-semibold cursor-pointer select-none whitespace-nowrap text-right transition-colors ${
                        teamSortCol === col.key ? `text-${THEME_COLOR}-400` : 'text-slate-400 hover:text-slate-200'
                      }`}
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
                    className="border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors cursor-pointer"
                    onClick={() => navigate(`/team/${row.team?.id}`)}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 sticky left-0 bg-slate-900">{row.rank}</td>
                    <td className="px-3 py-2 sticky left-10 bg-slate-900">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={teamLogoUrl(row.team?.id)}
                          alt=""
                          className="w-7 h-7 object-contain flex-shrink-0"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                        <span className={`font-medium text-sm truncate hover:text-${THEME_COLOR}-400 transition-colors`}>
                          {row.team?.name ?? '—'}
                        </span>
                      </div>
                    </td>
                    {teamCols.map((col) => (
                      <td
                        key={col.key}
                        className={`px-2 py-2 text-right font-mono text-xs tabular-nums ${
                          teamSortCol === col.key ? `text-${THEME_COLOR}-300` : 'text-slate-300'
                        }`}
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

        {/* Empty team */}
        {isTeam && !isLoading && !error && rankedTeamStats.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">No team data available.</div>
        )}

        {/* Player leaders */}
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
                  <span className="text-xl">{MEDAL[i]}</span>
                ) : (
                  <span className="font-mono text-slate-500 text-sm">{leader.rank}</span>
                )}
              </div>

              <img
                src={playerHeadshotUrl(leader.person?.id)}
                alt={leader.person?.fullName}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border border-slate-700 flex-shrink-0"
                onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
              />

              <div className="flex-1 min-w-0">
                <Link
                  to={`/player/${leader.person?.id}`}
                  className={`font-semibold hover:text-${THEME_COLOR}-400 transition-colors truncate block text-sm sm:text-base`}
                >
                  {leader.person?.fullName ?? '—'}
                </Link>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  {leader.team?.id && (
                    <img
                      src={teamLogoUrl(leader.team.id)}
                      alt=""
                      className="w-4 h-4 object-contain cursor-pointer"
                      onClick={() => navigate(`/team/${leader.team.id}`)}
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  )}
                  <span className="truncate">{leader.team?.name ?? '—'}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div
                  className={`font-display tabular-nums leading-none ${
                    i === 0 ? 'text-3xl sm:text-4xl text-yellow-400'
                    : i === 1 ? 'text-2xl sm:text-3xl text-slate-300'
                    : i === 2 ? 'text-2xl sm:text-3xl text-amber-600'
                    : 'text-xl sm:text-2xl text-slate-300'
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
          {isTeam ? `/v1/teams/{teamId}/stats?stats=season&group=${teamGroup === 'batting' ? 'hitting' : 'pitching'}&season=${season}` : `/v1/stats/leaders?leaderCategories=${category}&season=${season}`}
        </code>
      </div>
    </div>
  );
}
