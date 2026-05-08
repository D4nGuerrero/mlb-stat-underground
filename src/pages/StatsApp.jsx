import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  mlbTeams,
  teamLogoUrl,
  playerHeadshotUrl,
  FALLBACK_HEADSHOT,
} from '../utils/mlbHelpers';

// ─── Stat groups & hero stats ─────────────────────────────────────────────
const HITTING_GROUPS = [
  {
    label: 'Batting Line',
    stats: [
      { key: 'gamesPlayed', label: 'G' },
      { key: 'plateAppearances', label: 'PA' },
      { key: 'atBats', label: 'AB' },
      { key: 'runs', label: 'R' },
      { key: 'hits', label: 'H' },
      { key: 'doubles', label: '2B' },
      { key: 'triples', label: '3B' },
      { key: 'homeRuns', label: 'HR' },
      { key: 'rbi', label: 'RBI' },
      { key: 'stolenBases', label: 'SB' },
      { key: 'caughtStealing', label: 'CS' },
      { key: 'leftOnBase', label: 'LOB' },
    ],
  },
  {
    label: 'Plate Discipline',
    stats: [
      { key: 'baseOnBalls', label: 'BB' },
      { key: 'intentionalWalks', label: 'IBB' },
      { key: 'strikeOuts', label: 'SO' },
      { key: 'hitByPitch', label: 'HBP' },
      { key: 'sacBunts', label: 'SH' },
      { key: 'sacFlies', label: 'SF' },
      { key: 'groundIntoDoublePlay', label: 'GIDP' },
      { key: 'numberOfPitches', label: 'Pit' },
    ],
  },
  {
    label: 'Rate Stats',
    stats: [
      { key: 'avg', label: 'AVG' },
      { key: 'obp', label: 'OBP' },
      { key: 'slg', label: 'SLG' },
      { key: 'ops', label: 'OPS' },
      { key: 'babip', label: 'BABIP' },
      { key: 'totalBases', label: 'TB' },
      { key: 'atBatsPerHomeRun', label: 'AB/HR' },
    ],
  },
];

const PITCHING_GROUPS = [
  {
    label: 'Pitching Line',
    stats: [
      { key: 'wins', label: 'W' },
      { key: 'losses', label: 'L' },
      { key: 'gamesPlayed', label: 'G' },
      { key: 'gamesStarted', label: 'GS' },
      { key: 'inningsPitched', label: 'IP' },
      { key: 'completeGames', label: 'CG' },
      { key: 'shutouts', label: 'SHO' },
      { key: 'saves', label: 'SV' },
      { key: 'saveOpportunities', label: 'SVO' },
      { key: 'holds', label: 'HLD' },
      { key: 'blownSaves', label: 'BS' },
      { key: 'gamesFinished', label: 'GF' },
    ],
  },
  {
    label: 'Results Allowed',
    stats: [
      { key: 'hits', label: 'H' },
      { key: 'runs', label: 'R' },
      { key: 'earnedRuns', label: 'ER' },
      { key: 'homeRuns', label: 'HR' },
      { key: 'baseOnBalls', label: 'BB' },
      { key: 'intentionalWalks', label: 'IBB' },
      { key: 'hitBatsmen', label: 'HBP' },
      { key: 'strikeOuts', label: 'SO' },
      { key: 'wildPitches', label: 'WP' },
      { key: 'balks', label: 'BK' },
    ],
  },
  {
    label: 'Rate Stats',
    stats: [
      { key: 'era', label: 'ERA' },
      { key: 'whip', label: 'WHIP' },
      { key: 'winPercentage', label: 'W%' },
      { key: 'strikeoutsPer9Inn', label: 'K/9' },
      { key: 'walksPer9Inn', label: 'BB/9' },
      { key: 'hitsPer9Inn', label: 'H/9' },
      { key: 'strikeoutWalkRatio', label: 'K/BB' },
      { key: 'battersFaced', label: 'BF' },
    ],
  },
];

const HITTING_HERO = ['avg', 'homeRuns', 'rbi', 'ops', 'obp', 'slg'];
const PITCHING_HERO = ['era', 'wins', 'strikeOuts', 'whip', 'inningsPitched', 'saves'];

const HERO_LABELS = {
  avg: 'AVG', homeRuns: 'HR', rbi: 'RBI', ops: 'OPS', obp: 'OBP', slg: 'SLG',
  era: 'ERA', wins: 'W', strikeOuts: 'K', whip: 'WHIP', inningsPitched: 'IP', saves: 'SV',
  winPercentage: 'W%', strikeoutsPer9Inn: 'K/9',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────
const processPlayerSeason = (person, season) => {
  const group = person.primaryPosition?.abbreviation === 'P' ? 'pitching' : 'hitting';
  const statsBlock = person.stats?.find((s) => s.group?.displayName?.toLowerCase() === group);
  if (!statsBlock?.splits?.length) return null;

  const splits = statsBlock.splits.filter((sp) => sp.season === season);
  if (!splits.length) return null;

  const teams = [];
  let stat = null;

  for (const split of splits) {
    if (split.team?.id) {
      teams.push({
        id: split.team.id,
        name: split.team.name,
        logo: `https://www.mlbstatic.com/team-logos/team-cap-on-light/${split.team.id}.svg`,
        logoDark: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${split.team.id}.svg`,
      });
    } else {
      stat = split.stat;
    }
  }

  if (!stat && splits.length > 0) {
    stat = splits[0].stat;
  }

  return { stat: stat ?? {}, teams, group };
};

const getTeamNames = (teams) => teams.map((t) => t.name).join(' / ') || 'N/A';

const EXODUS_HERO_STATS = {
  hitting: ['avg', 'obp', 'slg', 'ops'],
  pitching: ['era', 'whip', 'strikeoutsPer9Inn', 'winPercentage'],
};

const LOWER_IS_BETTER = new Set(['era', 'whip']);

// ─── Sub-components ───────────────────────────────────────────────────────
function PlayerHeader({ playerData, season, onWatch }) {
  const heroKeys = HITTING_HERO;
  return (
    <div className="p-5 sm:p-6 border-b border-slate-800">
      <div className="flex items-start gap-4 sm:gap-6">
        <img
          src={playerData.headshot}
          alt={playerData.fullName}
          className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-cover border-2 border-slate-700 flex-shrink-0"
          onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              to={`/player/${playerData.id}`}
              className="font-display text-2xl sm:text-3xl hover:text-emerald-400 transition-colors"
            >
              {playerData.fullName}
            </Link>
            <button
              onClick={() => onWatch(playerData)}
              className="text-xs px-3 py-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 font-semibold rounded-xl flex items-center gap-1"
            >
              ★ Watch
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {playerData.teamId && (
              <img
                src={teamLogoUrl(playerData.teamId)}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => (e.target.style.display = 'none')}
              />
            )}
            <span className="text-emerald-400 text-sm">
              {playerData.team}
              {playerData.position ? ` · ${playerData.position}` : ''}
            </span>
            <span className="text-slate-600 text-xs">· {season}</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mt-4">
            {heroKeys.map((key) => {
              const val = playerData.stats[key];
              if (val == null) return null;
              return (
                <div key={key} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-2.5 sm:p-3 text-center">
                  <div className="text-[10px] sm:text-xs text-slate-500 mb-1 font-medium">
                    {HERO_LABELS[key]}
                  </div>
                  <div className="font-display text-xl sm:text-2xl text-white tabular-nums">
                    {val}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatGroup({ label, stats, playerStats }) {
  const rows = stats.filter((s) => playerStats[s.key] != null);
  if (!rows.length) return null;

  return (
    <div className="p-4 sm:p-5">
      <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">
        {label}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {rows.map(({ key, label: shortLabel }) => (
          <div key={key} className="bg-slate-800/50 rounded-xl p-2 sm:p-2.5 text-center">
            <div className="text-[9px] sm:text-[10px] text-slate-500 mb-0.5 font-medium">
              {shortLabel}
            </div>
            <div className="font-mono text-sm sm:text-base text-slate-200 tabular-nums">
              {playerStats[key]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExodusPlayerCard({ player }) {
  const heroStats = EXODUS_HERO_STATS[player.group] || EXODUS_HERO_STATS.hitting;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl shadow-black/30 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_45%)] pointer-events-none" />

      <div className="relative p-5 border-b border-white/5">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl" />
            <img
              src={player.photo}
              alt={player.fullName}
              className="relative w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg"
              onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white truncate">{player.fullName}</h2>
              <div className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-medium uppercase tracking-wider text-rose-300">
                EXODUS
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {player.teams2025.map((t, i) => (
                  <img
                    key={i}
                    src={t.logoDark}
                    alt={t.name}
                    className="w-9 h-9 object-contain flex-shrink-0"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ))}
                <span className="truncate text-slate-300 font-medium">{getTeamNames(player.teams2025)}</span>
              </div>

              <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                {player.teams2026.map((t, i) => (
                  <img
                    key={i}
                    src={t.logoDark}
                    alt={t.name}
                    className="w-9 h-9 object-contain flex-shrink-0"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ))}
                <span className="truncate font-medium text-emerald-300">{getTeamNames(player.teams2026)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-4 gap-3">
          {heroStats.map((k) => {
            const prev = Number(player.statsPrev?.[k] ?? 0);
            const curr = Number(player.statsCurrent?.[k] ?? 0);

            const isLowerBetter = LOWER_IS_BETTER.has(k);
            const improved = isLowerBetter ? curr < prev : curr > prev;
            const declined = isLowerBetter ? curr > prev : curr < prev;

            return (
              <div
                key={k}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                  improved
                    ? 'border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.10] via-slate-900 to-slate-950'
                    : declined
                    ? 'border-red-500/20 bg-gradient-to-b from-red-500/[0.08] via-slate-900 to-slate-950'
                    : 'border-white/5 bg-gradient-to-b from-slate-900 to-slate-950'
                }`}
              >
                <div
                  className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-3xl opacity-20 ${
                    improved ? 'bg-emerald-400' : declined ? 'bg-red-400' : 'bg-slate-500'
                  }`}
                />
                <div className="relative p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {HERO_LABELS[k] || k.toUpperCase()}
                    </div>
                    <div
                      className={`flex items-center justify-center rounded-full border w-5 h-5 ${
                        improved
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : declined
                          ? 'border-red-500/20 bg-red-500/10 text-red-400'
                          : 'border-slate-700 bg-slate-800 text-slate-500'
                      }`}
                    >
                      {improved ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 3l5 6h-3v8H8V9H5l5-6z" clipRule="evenodd" />
                        </svg>
                      ) : declined ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 17l-5-6h3V3h4v8h3l-5 6z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-2xl font-black tracking-tight text-white leading-none">
                      {player.statsCurrent?.[k] ?? '—'}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">Prev: {player.statsPrev?.[k] ?? '—'}</div>
                      <div
                        className={`text-[11px] font-semibold tabular-nums ${
                          improved ? 'text-emerald-400' : declined ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
                        {improved
                          ? `+${(curr - prev).toFixed(isLowerBetter ? 2 : 3)}`
                          : declined
                          ? `${(curr - prev).toFixed(isLowerBetter ? 2 : 3)}`
                          : '±0.000'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function StatsApp() {
  const [playerName, setPlayerName] = useState('Aaron Judge');
  const [season, setSeason] = useState('2026');
  const [statType, setStatType] = useState('hitting');
  const [playerData, setPlayerData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('search');

  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlbWatchlist') ?? '[]');
    } catch {
      return [];
    }
  });

  const [formerTeamId, setFormerTeamId] = useState(140);
  const [exodusResults, setExodusResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [hotPlayers, setHotPlayers] = useState([]);
  const [coldPlayers, setColdPlayers] = useState([]);
  const [isHotColdLoading, setIsHotColdLoading] = useState(false);

  // New state for league-wide rankings
  const [exodusRankings, setExodusRankings] = useState([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('mlbWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const fetchPlayerStats = async (nameOverride) => {
    const name = (nameOverride ?? playerName).trim();
    if (!name) return;
    setIsLoading(true);
    setError(null);
    setPlayerData(null);
    try {
      const searchRes = await fetch(
        `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}`
      );
      const searchData = await searchRes.json();
      if (!searchData.people?.length) throw new Error(`No player found matching "${name}"`);

      const player = searchData.people[0];
      const playerId = player.id;

      const statsRes = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=${season}&group=${statType}`
      );
      const statsData = await statsRes.json();

      if (!statsData.stats?.[0]?.splits?.length)
        throw new Error(`No ${statType} stats for ${player.fullName} in ${season}`);

      const split = statsData.stats[0].splits[0];
      setPlayerData({
        id: playerId,
        fullName: player.fullName ?? name,
        stats: split.stat ?? {},
        team: split.team?.name ?? 'N/A',
        teamId: split.team?.id,
        position: player.primaryPosition?.abbreviation ?? '',
        headshot: playerHeadshotUrl(playerId),
      });
      setActiveTab('search');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addToWatchlist = (player) => {
    if (watchlist.some((p) => p.id === player.id)) return;
    setWatchlist([player, ...watchlist]);
  };

  const removeFromWatchlist = (id) => setWatchlist(watchlist.filter((p) => p.id !== id));

  const analyzeTeamExodus = async () => {
    if (!formerTeamId) return;
    setIsAnalyzing(true);
    setExodusResults([]);

    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/teams/${formerTeamId}/roster?season=2025&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
      );
      const data = await res.json();
      const roster = data.roster ?? [];

      const movers = roster
        .map((entry) => {
          const person = entry.person;
          const prev = processPlayerSeason(person, '2025');
          const current = processPlayerSeason(person, '2026');

          if (!prev || !current) return null;

          const wasOnFormerTeam = prev.teams.some((t) => t.id === formerTeamId);
          const stillOnFormerTeam = current.teams.some((t) => t.id === formerTeamId);

          if (!wasOnFormerTeam || stillOnFormerTeam) return null;

          return {
            fullName: person.fullName,
            playerId: person.id,
            photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${person.id}/headshot/67/current`,
            teams2025: prev.teams,
            teams2026: current.teams,
            statsPrev: prev.stat,
            statsCurrent: current.stat,
            group: prev.group,
          };
        })
        .filter(Boolean);

      setExodusResults(movers);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeTeamAcquisitions = async (targetTeamId2026) => {
  if (!targetTeamId2026) return;

  setIsAnalyzing(true);
  setAcquisitionResults([]);   // ← use a new state for this: const [acquisitionResults, setAcquisitionResults] = useState([]);

  try {
    // 1. Fetch 2026 roster with full yearByYear stats (one call)
    const rosterRes = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${targetTeamId2026}/roster?season=2026&rosterType=fullRoster&hydrate=person(stats(group=hitting,type=yearByYear))`
    );

    const rosterData = await rosterRes.json();
    const rosterPlayers2026 = rosterData.roster ?? [];

    console.log(`Analyzing acquisitions for team ${targetTeamId2026} — ${rosterPlayers2026.length} players`);

    // 2. Build acquisitions array
    const acquisitions = rosterPlayers2026
      .map(player => {
        const p = player.person;
        const hitting = p.stats?.find(s => s.group?.displayName === "hitting");

        const split2025 = hitting?.splits?.find(sp => sp.season === "2025");
        const split2026 = hitting?.splits?.find(sp => sp.season === "2026");

        // Only keep players who actually changed teams
        if (
          split2025?.team?.id &&
          split2026?.team?.id &&
          split2025.team.id !== split2026.team.id
        ) {
          return {
            fullName: p.fullName,
            playerId: p.id,

            // Player photo
            photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${p.id}/headshot/67/current`,

            // Previous team (2025)
            team2025: split2025.team.name,
            team2025Id: split2025.team.id,
            team2025Logo: `https://www.mlbstatic.com/team-logos/team-cap-on-light/${split2025.team.id}.svg`,
            team2025LogoDark: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${split2025.team.id}.svg`,

            // New team (2026) — always the same for this call
            team2026: split2026.team.name,
            team2026Id: split2026.team.id,
            team2026Logo: `https://www.mlbstatic.com/team-logos/team-cap-on-light/${split2026.team.id}.svg`,
            team2026LogoDark: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${split2026.team.id}.svg`,

            statsPrev: split2025.stat ?? null,     // 2025 stats
            statsCurrent: split2026.stat ?? null   // 2026 stats
          };
        }
        return null;
      })
      .filter(Boolean);

    // 3. Sort by "value" — highest 2026 home runs first
    acquisitions.sort((a, b) => 
      (b.statsCurrent?.homeRuns ?? 0) - (a.statsCurrent?.homeRuns ?? 0)
    );

    console.log(`Found ${acquisitions.length} new acquisitions`);

    setAcquisitionResults(acquisitions.slice(0, 12)); // top 12 most valuable

  } catch (err) {
    console.error("Error analyzing team acquisitions:", err);
  } finally {
    setIsAnalyzing(false);
  }
};

  const fetchHotCold = async () => {
    setIsHotColdLoading(true);
    setHotPlayers([]);
    setColdPlayers([]);
    try {
      const today = new Date();
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(today.getDate() - 10);
      const fmt = (d) => d.toISOString().split('T')[0];
      const yr = today.getFullYear();
      const dateRange = `startDate=${fmt(tenDaysAgo)}&endDate=${fmt(today)}`;

      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=onBasePlusSlugging&season=${yr}&statGroup=hitting&leaderGameTypes=R&limit=50&sportId=1&hydrate=person,team&${dateRange}`
      );
      const data = await res.json();
      const all = data.leagueLeaders?.[0]?.leaders ?? [];
      setHotPlayers(all.slice(0, 10));
      setColdPlayers([...all].slice(-10).reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setIsHotColdLoading(false);
    }
  };

  // ── NEW: League-wide Exodus Rankings ─────────────────────────────────────────────
  const analyzeAllExodus = async () => {
    setIsRankingLoading(true);
    setExodusRankings([]);

    const rankings = [];

    for (const team of mlbTeams) {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?season=2025&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
        );
        const data = await res.json();
        const roster = data.roster ?? [];

        const movers = roster
          .map((entry) => {
            const person = entry.person;
            const prev = processPlayerSeason(person, '2025');
            const current = processPlayerSeason(person, '2026');

            if (!prev || !current) return null;

            const wasOnTeam = prev.teams.some((t) => t.id === team.id);
            const stillOnTeam = current.teams.some((t) => t.id === team.id);

            if (!wasOnTeam || stillOnTeam) return null;

            return {
              fullName: person.fullName,
              group: prev.group,
              statsCurrent: current.stat,
            };
          })
          .filter(Boolean);

        const lostHitters = movers.filter((m) => m.group === 'hitting');
        const lostPitchers = movers.filter((m) => m.group === 'pitching');

        const avgOPS = lostHitters.length
          ? lostHitters.reduce((sum, p) => sum + (Number(p.statsCurrent.ops) || 0), 0) / lostHitters.length
          : 0;

        const avgERA = lostPitchers.length
          ? lostPitchers.reduce((sum, p) => sum + (Number(p.statsCurrent.era) || 0), 0) / lostPitchers.length
          : 0;

        const hitterScore = avgOPS * lostHitters.length;
        const pitcherScore = (5.0 - avgERA) * lostPitchers.length;
        const exodusScore = hitterScore + pitcherScore;

        rankings.push({
          teamId: team.id,
          teamName: team.name,
          abbr: team.abbr,
          logo: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`,
          lostPlayers: movers.length,
          lostHitters: lostHitters.length,
          lostPitchers: lostPitchers.length,
          avgOPS: avgOPS.toFixed(3),
          avgERA: avgERA.toFixed(2),
          exodusScore: Number(exodusScore.toFixed(2)),
        });
      } catch (err) {
        console.error(`Failed to analyze team ${team.id}`, err);
      }
    }

    rankings.sort((a, b) => b.exodusScore - a.exodusScore);
    setExodusRankings(rankings);
    setIsRankingLoading(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'hotcold' && hotPlayers.length === 0 && !isHotColdLoading) {
      fetchHotCold();
    }
  };

  const heroKeys = statType === 'hitting' ? HITTING_HERO : PITCHING_HERO;
  const statGroups = statType === 'hitting' ? HITTING_GROUPS : PITCHING_GROUPS;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <div className="text-emerald-400 text-xs font-mono tracking-[3px] mb-1 uppercase">Player Stats</div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Stats Center</h1>
        <p className="text-slate-400 mt-1 text-sm">Search any player · Build a watchlist · Track Team Exodus</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-700 rounded-2xl p-1 mb-6 w-fit">
        {[
          { key: 'search', label: 'Player Search' },
          { key: 'watchlist', label: `Watchlist${watchlist.length ? ` (${watchlist.length})` : ''}` },
          { key: 'hotcold', label: '🔥 Hot & Cold ❄️' },

          { key: 'exodus', label: 'Team Exodus' },
                    { key: 'rankings', label: 'Exodus Rankings' },
                    
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === key ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* PLAYER SEARCH TAB */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
              <div className="sm:col-span-5">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium tracking-wide">PLAYER NAME</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPlayerStats()}
                  className="w-full bg-slate-800 border border-slate-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Aaron Judge, Shohei Ohtani…"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium tracking-wide">SEASON</label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                >
                  {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium tracking-wide">STAT GROUP</label>
                <div className="flex bg-slate-800 border border-slate-600 rounded-2xl p-1">
                  {['hitting', 'pitching'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setStatType(t)}
                      className={`flex-1 py-2 rounded-[14px] text-sm font-medium transition-all capitalize ${
                        statType === t ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => fetchPlayerStats()}
                disabled={isLoading}
                className="px-8 py-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-2xl text-sm active:scale-[0.985] disabled:opacity-50 transition-all"
              >
                {isLoading ? 'Loading…' : 'Search Stats'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6 text-center text-red-400">
              {error}
            </div>
          )}

          {playerData && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
              <PlayerHeader playerData={playerData} season={season} onWatch={addToWatchlist} />
              <div className="divide-y divide-slate-800">
                {statGroups.map((group) => (
                  <StatGroup
                    key={group.label}
                    label={group.label}
                    stats={group.stats}
                    playerStats={playerData.stats}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WATCHLIST TAB */}
      {activeTab === 'watchlist' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-400">
              {watchlist.length} player{watchlist.length !== 1 ? 's' : ''} saved
            </div>
            {watchlist.length > 0 && (
              <button
                onClick={() => setWatchlist([])}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {watchlist.length === 0 ? (
            <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
              <div className="text-3xl mb-3">⭐</div>
              No players saved. Use the Player Search tab to find a player and click <strong>“Watch”</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {watchlist.map((player) => (
                <div
                  key={player.id}
                  className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center gap-3"
                >
                  <img
                    src={player.headshot ?? playerHeadshotUrl(player.id)}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-700 flex-shrink-0"
                    alt=""
                    onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-sm">{player.fullName}</div>
                    <div className="text-xs text-slate-400 truncate">{player.team}</div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setPlayerName(player.fullName);
                        setActiveTab('search');
                        setTimeout(() => fetchPlayerStats(player.fullName), 50);
                      }}
                      className="text-xs px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => removeFromWatchlist(player.id)}
                      className="text-xs px-2 py-0.5 text-red-400 hover:text-red-300 transition-colors text-center"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HOT & COLD TAB */}
      {activeTab === 'hotcold' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Who's Hot & Who's Cold</h3>
              <p className="text-sm text-slate-400 mt-0.5">Based on OPS over the last 10 days</p>
            </div>
            <button
              onClick={fetchHotCold}
              disabled={isHotColdLoading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isHotColdLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {isHotColdLoading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isHotColdLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-slate-900 border border-orange-500/30 rounded-3xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    🔥 <span className="text-orange-400">Who's Hot</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Highest OPS · Last 10 days</div>
                </div>
                {hotPlayers.map((p, i) => (
                  <div
                    key={p.person?.id ?? i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors"
                  >
                    <span className="w-5 text-center font-mono text-xs text-slate-500 flex-shrink-0">{i + 1}</span>
                    <img
                      src={playerHeadshotUrl(p.person?.id)}
                      alt=""
                      className="w-9 h-9 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                      onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{p.person?.fullName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        {p.team?.id && (
                          <img
                            src={teamLogoUrl(p.team.id)}
                            alt=""
                            className="w-3.5 h-3.5 object-contain"
                            onError={(e) => (e.target.style.display = 'none')}
                          />
                        )}
                        <span className="truncate">{p.team?.name}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display text-xl tabular-nums text-orange-400">{p.value}</div>
                      <div className="text-[10px] text-slate-500">OPS</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 border border-blue-500/30 rounded-3xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-blue-500/10 to-transparent">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    ❄️ <span className="text-blue-400">Who's Cold</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Lowest OPS · Last 10 days</div>
                </div>
                {coldPlayers.map((p, i) => (
                  <div
                    key={p.person?.id ?? i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors"
                  >
                    <span className="w-5 text-center font-mono text-xs text-slate-500 flex-shrink-0">{i + 1}</span>
                    <img
                      src={playerHeadshotUrl(p.person?.id)}
                      alt=""
                      className="w-9 h-9 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                      onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{p.person?.fullName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        {p.team?.id && (
                          <img
                            src={teamLogoUrl(p.team.id)}
                            alt=""
                            className="w-3.5 h-3.5 object-contain"
                            onError={(e) => (e.target.style.display = 'none')}
                          />
                        )}
                        <span className="truncate">{p.team?.name}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display text-xl tabular-nums text-blue-400">{p.value}</div>
                      <div className="text-[10px] text-slate-500">OPS</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEAM EXODUS TAB */}
      {activeTab === 'exodus' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">Team Exodus Analyzer</h3>
            <p className="text-sm text-slate-400 mb-4">
              Players who left after 2025 — hitters AND pitchers — and how they’re performing in 2026.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium tracking-wide">
                  TEAM THEY LEFT (2025 ROSTER)
                </label>
                <select
                  value={formerTeamId}
                  onChange={(e) => setFormerTeamId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                >
                  {mlbTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.abbr})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={analyzeTeamExodus}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all flex-shrink-0 w-full sm:w-auto"
              >
                {isAnalyzing ? 'Analyzing Exodus…' : 'Analyze Exodus'}
              </button>
            </div>
          </div>

          {exodusResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {exodusResults.map((player) => (
                <ExodusPlayerCard key={player.playerId} player={player} />
              ))}
            </div>
          )}

          {!isAnalyzing && exodusResults.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No players left this roster after 2025. Try a different team.
            </div>
          )}
        </div>
      )}

      {/* NEW: EXODUS RANKINGS TAB */}
      {activeTab === 'rankings' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">League Exodus Rankings</h3>
            <p className="text-sm text-slate-400 mb-4">
              Which teams got played the hardest? Ranking by total talent lost in the 2025–2026 exodus.
            </p>
            <button
              onClick={analyzeAllExodus}
              disabled={isRankingLoading}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all"
            >
              {isRankingLoading ? 'Analyzing all 30 teams…' : 'Calculate League-Wide Exodus Rankings'}
            </button>
          </div>

          {isRankingLoading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {exodusRankings.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400">RANK</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400">TEAM</th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-slate-400">PLAYERS LOST</th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-slate-400">HITTERS AVG OPS</th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-slate-400">PITCHERS AVG ERA</th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-slate-400">EXODUS SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {exodusRankings.map((team, i) => (
                    <tr key={team.teamId} className="border-b border-slate-700 last:border-none hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-mono text-lg font-bold text-emerald-400">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={team.logo} alt="" className="w-8 h-8 object-contain" />
                          <div>
                            <div className="font-semibold">{team.teamName}</div>
                            <div className="text-xs text-slate-400">{team.abbr}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono">{team.lostPlayers}</td>
                      <td className="px-6 py-4 text-center font-mono text-emerald-300">{team.avgOPS}</td>
                      <td className="px-6 py-4 text-center font-mono text-rose-300">{team.avgERA}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-rose-400">{team.exodusScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}