import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { playerHeadshotUrl, teamLogoUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';

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

// Team stat categories
const TEAM_HITTING_CATS = [
  { key: 'avg', label: 'Batting Average', abbr: 'AVG', format: '3dec', stat: 'avg' },
  { key: 'homeRuns', label: 'Home Runs', abbr: 'HR', format: 'int', stat: 'homeRuns' },
  { key: 'runs', label: 'Runs Scored', abbr: 'R', format: 'int', stat: 'runs' },
  { key: 'hits', label: 'Hits', abbr: 'H', format: 'int', stat: 'hits' },
  { key: 'rbi', label: 'RBI', abbr: 'RBI', format: 'int', stat: 'rbi' },
  { key: 'stolenBases', label: 'Stolen Bases', abbr: 'SB', format: 'int', stat: 'stolenBases' },
  { key: 'obp', label: 'On-Base %', abbr: 'OBP', format: '3dec', stat: 'obp' },
  { key: 'slg', label: 'Slugging %', abbr: 'SLG', format: '3dec', stat: 'slg' },
  { key: 'ops', label: 'OPS', abbr: 'OPS', format: '3dec', stat: 'ops' },
  { key: 'strikeOuts', label: 'Strikeouts', abbr: 'SO', format: 'int', stat: 'strikeOuts' },
  { key: 'baseOnBalls', label: 'Walks', abbr: 'BB', format: 'int', stat: 'baseOnBalls' },
];

const TEAM_PITCHING_CATS = [
  { key: 'era', label: 'ERA', abbr: 'ERA', format: '2dec', stat: 'era', asc: true },
  { key: 'wins', label: 'Wins', abbr: 'W', format: 'int', stat: 'wins' },
  { key: 'strikeOuts', label: 'Strikeouts', abbr: 'SO', format: 'int', stat: 'strikeOuts' },
  { key: 'saves', label: 'Saves', abbr: 'SV', format: 'int', stat: 'saves' },
  { key: 'whip', label: 'WHIP', abbr: 'WHIP', format: '2dec', stat: 'whip', asc: true },
  { key: 'earnedRuns', label: 'Earned Runs', abbr: 'ER', format: 'int', stat: 'earnedRuns', asc: true },
  { key: 'baseOnBalls', label: 'Walks', abbr: 'BB', format: 'int', stat: 'baseOnBalls', asc: true },
  { key: 'hitBatsmen', label: 'Hit Batters', abbr: 'HBP', format: 'int', stat: 'hitBatsmen', asc: true },
  { key: 'homeRuns', label: 'HR Allowed', abbr: 'HR', format: 'int', stat: 'homeRuns', asc: true },
  { key: 'shutouts', label: 'Shutouts', abbr: 'SHO', format: 'int', stat: 'shutouts' },
];

const MEDAL = ['🥇', '🥈', '🥉'];

const formatValue = (val, fmt) => {
  if (val == null) return '–';
  if (fmt === 'int') return String(parseInt(val));
  if (fmt === '3dec') {
    const f = parseFloat(val).toFixed(3);
    return f.startsWith('0.') ? f.slice(1) : f; // strip leading 0 for .avg
  }
  if (fmt === '2dec') return parseFloat(val).toFixed(2);
  return String(val);
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
  const [teamGroup, setTeamGroup] = useState('hitting');
  const [teamCat, setTeamCat] = useState('homeRuns');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(25);

  const isTeam = playerOrTeam === 'team';
  const allCats = isTeam
    ? (teamGroup === 'hitting' ? TEAM_HITTING_CATS : TEAM_PITCHING_CATS)
    : (group === 'hitting' ? HITTING_CATS : group === 'pitching' ? PITCHING_CATS : FIELDING_CATS);

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
  }, [category, season, group, limit, teamGroup, teamCat, playerOrTeam]);

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
    const cacheKey = `team:${teamGroup}:${season}`;
    if (cache.current[cacheKey]) {
      const splits = cache.current[cacheKey];
      const catMeta = allCats.find((c) => c.key === teamCat) ?? allCats[0];
      const sorted = [...splits].sort((a, b) => {
        const av = parseFloat(a.stat?.[catMeta.stat] ?? a.stat?.[teamCat] ?? 0);
        const bv = parseFloat(b.stat?.[catMeta.stat] ?? b.stat?.[teamCat] ?? 0);
        return catMeta.asc ? av - bv : bv - av;
      });
      setTeamStats(sorted);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setTeamStats([]);
    try {
      const url = `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${teamGroup}&season=${season}&sportIds=1&playerPool=team&gameType=R&hydrate=team`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const splits = data.stats?.[0]?.splits ?? [];
      cache.current[cacheKey] = splits;
      const catMeta = allCats.find((c) => c.key === teamCat) ?? allCats[0];
      const sortedSplits = [...splits].sort((a, b) => {
        const av = parseFloat(a.stat?.[catMeta.stat] ?? a.stat?.[teamCat] ?? 0);
        const bv = parseFloat(b.stat?.[catMeta.stat] ?? b.stat?.[teamCat] ?? 0);
        return catMeta.asc ? av - bv : bv - av;
      });
      setTeamStats(sortedSplits);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const currentCat = allCats.find((c) => c.key === (isTeam ? teamCat : category)) ?? allCats[0];
  const filteredLeaders = leaders.filter((l) => {
    if (leagueFilter === 'all') return true;
    const leagueId = l.team?.league?.id;
    if (leagueFilter === 'AL') return leagueId === 103;
    if (leagueFilter === 'NL') return leagueId === 104;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="text-emerald-400 text-xs font-mono tracking-[3px] mb-1 uppercase">
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
          {['player', 'team'].map((opt) => (
            <button
              key={opt}
              onClick={() => { setPlayerOrTeam(opt); if (opt === 'team') { setTeamGroup('hitting'); setTeamCat('homeRuns'); } }}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all capitalize ${
                playerOrTeam === opt ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt === 'player' ? 'Player' : 'Team'}
            </button>
          ))}
        </div>

        {/* Group + season */}
        <div className="flex flex-wrap gap-3 items-center">
          {!isTeam && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              {['hitting', 'pitching', 'fielding'].map((g) => (
                <button
                  key={g}
                  onClick={() => handleGroupChange(g)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all capitalize ${
                    group === g ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {!isTeam && (
            <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
              {[
                { key: 'all', label: 'MLB' },
                { key: 'AL', label: 'AL' },
                { key: 'NL', label: 'NL' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setLeagueFilter(key)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    leagueFilter === key ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
          >
            {[2026, 2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017].map((y) => (
              <option key={y} value={y}>{y} Season</option>
            ))}
          </select>

          {!isTeam && (
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
            </select>
          )}
        </div>

        {/* Team sub-group toggle */}
        {isTeam && (
          <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-fit">
            {['hitting', 'pitching'].map((g) => (
              <button
                key={g}
                onClick={() => { setTeamGroup(g); setTeamCat(g === 'hitting' ? 'homeRuns' : 'era'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all capitalize ${
                  teamGroup === g ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {allCats.map((cat) => (
            <button
              key={cat.key}
              onClick={() => isTeam ? setTeamCat(cat.key) : setCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                (isTeam ? teamCat : category) === cat.key
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {cat.abbr}
            </button>
          ))}
        </div>
      </div>

      {/* Results card */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
        {/* Header row */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base sm:text-lg">
              {currentCat.label} {isTeam ? 'by Team' : 'Leaders'}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {season} · {isTeam ? `Team ${teamGroup}` : group} · Regular Season{!isTeam && ` · Top ${limit}`}
            </div>
          </div>
          {isLoading && (
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Error */}
        {!isLoading && error && (
          <div className="p-8 text-center text-red-400 text-sm">{error}</div>
        )}

        {/* Team stats rows */}
        {isTeam && !isLoading && !error && teamStats.map((split, i) => {
          const val = split.stat?.[currentCat.stat] ?? split.stat?.[teamCat];
          const isTop3 = i < 3;
          return (
            <div
              key={split.team?.id ?? i}
              className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors cursor-pointer ${isTop3 ? 'bg-gradient-to-r from-slate-800/40 to-transparent' : ''}`}
              onClick={() => navigate(`/team/${split.team?.id}`)}
            >
              <div className="w-8 sm:w-10 text-center flex-shrink-0">
                {isTop3 ? <span className="text-xl">{MEDAL[i]}</span> : <span className="font-mono text-slate-500 text-sm">{i + 1}</span>}
              </div>
              <img
                src={teamLogoUrl(split.team?.id)}
                alt={split.team?.name}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0"
                onError={(e) => (e.target.style.display = 'none')}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm sm:text-base hover:text-emerald-400 transition-colors truncate">
                  {split.team?.name ?? '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{season} · {teamGroup}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-display tabular-nums leading-none ${i === 0 ? 'text-3xl sm:text-4xl text-yellow-400' : i === 1 ? 'text-2xl sm:text-3xl text-slate-300' : i === 2 ? 'text-2xl sm:text-3xl text-amber-600' : 'text-xl sm:text-2xl text-slate-300'}`}>
                  {formatValue(val, currentCat.format)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{currentCat.abbr}</div>
              </div>
            </div>
          );
        })}

        {/* Empty team */}
        {isTeam && !isLoading && !error && teamStats.length === 0 && (
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
                  className="font-semibold hover:text-emerald-400 transition-colors truncate block text-sm sm:text-base"
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
          {isTeam ? `/v1/stats?stats=season&group=${teamGroup}&playerPool=team` : `/v1/stats/leaders?leaderCategories=${category}&season=${season}`}
        </code>
      </div>
    </div>
  );
}
