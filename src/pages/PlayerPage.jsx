import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tab } from '@headlessui/react';
import { mlbTeams, playerHeadshotUrl, teamLogoUrl, playerHeroShotUrl } from '../utils/mlbHelpers';
import { buildSeasonHonors, getActiveHonorBadges } from '../utils/seasonHonors';
import SeasonYearLabel from '../components/SeasonYearLabel';
import { SegmentedControl, Select } from '../components/ui';

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

const TEAM_ABBR = Object.fromEntries(mlbTeams.map((t) => [t.id, t.abbr]));

const MINOR_SPORT_IDS = [11, 12, 13, 14];
const MINOR_SPORT_ID_SET = new Set(MINOR_SPORT_IDS);

const LOWER_IS_BETTER = new Set(['era', 'whip', 'losses', 'errors']);

const HITTING_SIT_CODES = 'vl,vr,h,a,d,n,b1,b2,b3,b4,b5,b6,b7,b8,b9';
const PITCHING_SIT_CODES = 'vl,vr,h,a,d,n';

const HERO_TEXT_SHADOW = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' };

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
  { key: 'saves', label: 'SV' },
  { key: 'inningsPitched', label: 'IP' },
  { key: 'hits', label: 'H' },
  { key: 'runs', label: 'R' },
  { key: 'earnedRuns', label: 'ER' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'strikeOuts', label: 'K' },
  { key: 'era', label: 'ERA' },
  { key: 'whip', label: 'WHIP' },
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
  { key: 'team', label: 'Team', format: 'team' },
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
  { key: 'team', label: 'Team', format: 'team' },
  { key: 'opponent', label: 'OPP', format: 'opponent' },
  { key: 'wins', label: 'W' },
  { key: 'losses', label: 'L' },
  { key: 'era', label: 'ERA' },
  { key: 'gamesPlayed', label: 'G' },
  { key: 'gamesStarted', label: 'GS' },
  { key: 'completeGames', label: 'CG' },
  { key: 'shutouts', label: 'SHO' },
  { key: 'saves', label: 'SV' },
  { key: 'saveOpportunities', label: 'SVO' },
  { key: 'inningsPitched', label: 'IP' },
  { key: 'hits', label: 'H' },
  { key: 'runs', label: 'R' },
  { key: 'earnedRuns', label: 'ER' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'hitBatsmen', label: 'HB' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'intentionalWalks', label: 'IBB' },
  { key: 'strikeOuts', label: 'SO' },
  { key: 'pitchesStrikes', label: 'NP-S', format: 'pitchesStrikes' },
  { key: 'avg', label: 'AVG' },
  { key: 'whip', label: 'WHIP' },
  { key: 'groundOutsToAirouts', label: 'GO/AO' },
];

function teamAbbr(team) {
  if (!team?.id) return '—';
  return TEAM_ABBR[team.id] ?? team.name?.split(' ').pop() ?? '—';
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

function pickLastXGamesSplit(splits, level) {
  if (!splits?.length) return null;

  if (level === 'mlb') {
    return splits.find((s) => s.sport?.id === 1) ?? splits.find((s) => s.sport?.id === 0) ?? splits[0];
  }

  return (
    splits.find((s) => s.sport?.id === 0)
    ?? splits.find((s) => MINOR_SPORT_ID_SET.has(s.sport?.id))
    ?? splits[0]
  );
}

function formatCell(value, format, row) {
  if (format === 'date' && row.date) {
    return new Date(row.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (format === 'team') return teamAbbr(row.team);
  if (format === 'opponent') {
    const abbr = teamAbbr(row.opponent);
    if (abbr === '—') return '—';
    return row.isHome ? `vs ${abbr}` : `@ ${abbr}`;
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

function FilterBar({
  level,
  onLevelChange,
  period,
  onPeriodChange,
  season,
  onSeasonChange,
  group,
  onGroupChange,
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center mb-5">
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
      <Select value={period} onChange={onPeriodChange} options={PERIOD_OPTIONS} className="w-52" />
      <Select value={season} onChange={onSeasonChange} options={SEASON_OPTIONS} className="w-28" />
    </div>
  );
}

function StatsTable({
  cols,
  rows,
  labelKey = 'label',
  emptyMessage = 'No stats available',
  highlightCareerHighs = false,
}) {
  if (!rows?.length) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  const careerHighs = highlightCareerHighs ? computeCareerHighs(rows, cols) : null;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs md:text-sm min-w-[640px]">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/60">
            <th className="text-left py-2 font-normal pr-3 w-px whitespace-nowrap sticky left-0 bg-[#121827]">
              {labelKey === 'season' ? 'Year' : 'Split'}
            </th>
            {cols.map((c) => (
              <th key={c.key} className="px-2 text-center font-normal whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-slate-800/60 hover:bg-slate-800/20">
              <td className="py-2 pr-3 font-semibold text-slate-200 w-px whitespace-nowrap sticky left-0 bg-[#121827]">
                {row.label}
              </td>
              {cols.map((c) => {
                const value = row[c.key] ?? row.stat?.[c.key];
                const isHigh = careerHighs && isCareerHigh(c.key, value, careerHighs);
                return (
                  <td
                    key={c.key}
                    className={[
                      'px-2 text-center font-mono tabular-nums',
                      isHigh ? 'font-bold text-emerald-500' : 'text-slate-300',
                    ].join(' ')}
                  >
                    {formatCell(value, c.format, row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameLogTable({ cols, rows, emptyMessage = 'No game logs available' }) {
  if (!rows?.length) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs md:text-sm">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/60">
            {cols.map((c, i) => (
              <th
                key={c.key}
                className={[
                  'py-2 font-normal whitespace-nowrap',
                  i === 0 ? 'text-left pr-3 pl-0 w-px sticky left-0 bg-[#121827]' : 'px-2 text-center',
                ].join(' ')}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-slate-800/60 hover:bg-slate-800/20">
              {cols.map((c, j) => {
                const value = row[c.key] ?? row.stat?.[c.key];
                return (
                  <td
                    key={c.key}
                    className={[
                      'py-2 text-slate-300 font-mono tabular-nums',
                      j === 0 ? 'pr-3 pl-0 w-px whitespace-nowrap font-semibold text-slate-200 sticky left-0 bg-[#121827]' : 'px-2 text-center',
                    ].join(' ')}
                  >
                    {formatCell(value, c.format, row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
  const [logPeriod, setLogPeriod] = useState('regular');
  const [logSeason, setLogSeason] = useState(CURRENT_YEAR);
  const [gameLogRows, setGameLogRows] = useState([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);

  const [splitLevel, setSplitLevel] = useState('mlb');
  const [splitPeriod, setSplitPeriod] = useState('regular');
  const [splitSeason, setSplitSeason] = useState(CURRENT_YEAR);
  const [splitRows, setSplitRows] = useState([]);
  const [splitLoading, setSplitLoading] = useState(false);

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

    fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam,awards`)
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
    const meta = getPeriodMeta(logPeriod);
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
  }, [playerId, logLevel, logGroup, logPeriod, logSeason]);

  const loadSplits = useCallback(async () => {
    if (!playerId) return;
    setSplitLoading(true);
    const meta = getPeriodMeta(splitPeriod);
    const group = isPitcher ? 'pitching' : 'hitting';
    const sitCodes = isPitcher ? PITCHING_SIT_CODES : HITTING_SIT_CODES;

    try {
      let splits = [];

      if (meta.statsType === 'lastXGames') {
        const params = new URLSearchParams({
          stats: 'lastXGames',
          season: String(splitSeason),
          group,
          gameType: meta.gameType,
          limit: String(meta.limit),
        });
        const data = await fetchPlayerStats(playerId, params.toString(), splitLevel);
        const raw = data.stats?.[0]?.splits ?? [];
        const best = pickLastXGamesSplit(raw, splitLevel);
        if (best?.stat) {
          splits = [{
            split: { code: 'total', description: `Last ${meta.limit} Games` },
            stat: best.stat,
          }];
        }
      } else {
        const params = new URLSearchParams({
          stats: 'statSplits',
          sitCodes,
          season: String(splitSeason),
          group,
          gameType: meta.gameType,
        });
        const data = await fetchPlayerStats(playerId, params.toString(), splitLevel);
        splits = data.stats?.[0]?.splits ?? [];
      }

      setSplitRows(
        splits.map((sp, i) => ({
          id: sp.split?.code ?? i,
          label: sp.split?.description ?? sp.split?.code ?? '—',
          stat: sp.stat,
        })),
      );
    } catch {
      setSplitRows([]);
    } finally {
      setSplitLoading(false);
    }
  }, [playerId, splitLevel, splitPeriod, splitSeason, isPitcher]);

  useEffect(() => {
    loadGameLogs();
  }, [loadGameLogs]);

  useEffect(() => {
    loadSplits();
  }, [loadSplits]);

  const getYearByYearSplits = (group) =>
    yearByYear?.find((s) => s.type?.displayName === 'yearByYear' && s.group?.displayName === group)?.splits ?? [];

  const seasonHonors = buildSeasonHonors(playerInfo?.awards);

  const careerRows = getYearByYearSplits(statGroup)
    .filter((sp) => sp.season && sp.stat)
    .sort((a, b) => Number(b.season) - Number(a.season) || (b.sport?.id ?? 0) - (a.sport?.id ?? 0))
    .map((sp) => ({
      id: `${sp.season}-${sp.team?.id ?? 'na'}-${sp.sport?.id ?? 0}`,
      label: (
        <SeasonYearLabel
          season={sp.season}
          minorsLevel={careerLevel === 'minors' ? sp.sport?.abbreviation : null}
          badges={careerLevel === 'mlb' ? getActiveHonorBadges(seasonHonors[sp.season]) : []}
        />
      ),
      team: sp.team,
      stat: sp.stat,
    }));

  const careerGroupOptions = [
    { value: 'hitting', label: 'Batting' },
    { value: 'pitching', label: 'Pitching' },
    { value: 'fielding', label: 'Fielding' },
  ];

  const tabs = ['Career', 'Game Logs', 'Splits', 'Batter vs. Pitcher'];

  return (
    <div className="max-w-4xl mx-auto  sm:px-6  sm:py-8">
 
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

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
            <div className="relative flex items-end gap-4 sm:gap-6">
              <div className="relative flex-shrink-0">
                <img
                  src={playerHeadshotUrl(playerId)}
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                  alt={playerInfo.fullName}
                />
                {playerInfo.currentTeam?.id && (
                  <img
                    src={teamLogoUrl(playerInfo.currentTeam.id)}
                    className="absolute -bottom-2 -right-2 w-8 h-8 sm:w-9 sm:h-9 object-contain bg-slate-900 rounded-xl p-1 border border-slate-600"
                    alt=""
                  />
                )}
              </div>
              <div className="pb-1 min-w-0">
                
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
                  className="text-[11px] text-emerald-300 font-semibold uppercase tracking-widest truncate"
                  style={HERO_TEXT_SHADOW}
                >
                  {playerInfo.currentTeam?.name || '—'}
                  {playerInfo.primaryNumber ? ` · #${playerInfo.primaryNumber}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Bats / Throws', value: `${playerInfo.batSide?.code || '—'} / ${playerInfo.pitchHand?.code || '—'}` },
              { label: 'Height / Weight', value: `${playerInfo.height || '—'} / ${playerInfo.weight ? `${playerInfo.weight} lb` : '—'}` },
              { label: 'Born', value: playerInfo.birthDate ? new Date(playerInfo.birthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
              { label: 'Birthplace', value: [playerInfo.birthCity, playerInfo.birthStateProvince, playerInfo.birthCountry].filter(Boolean).join(', ') || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-sm font-semibold text-slate-200">{value}</div>
              </div>
            ))}
          </div>

          <div className="px-5 sm:px-8 py-5 sm:py-6">
            <Tab.Group>
              <Tab.List className="flex gap-1  border-b border-slate-700/60 mb-6 scrollbar-none">
                {tabs.map((tab) => (
                  <Tab
                    key={tab}
                    className={({ selected }) =>
                      [
                        'px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap rounded-t-xl transition-colors focus:outline-none',
                        selected
                          ? 'bg-slate-800 text-white border-b-2 border-emerald-400 -mb-px'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/40',
                      ].join(' ')
                    }
                  >
                    {tab}
                  </Tab>
                ))}
              </Tab.List>

              <Tab.Panels>
                <Tab.Panel>
                  <div className="flex flex-wrap gap-3 items-center mb-5">
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
                    emptyMessage="No career stats available for this selection."
                  />
                </Tab.Panel>

                <Tab.Panel>
                  <FilterBar
                    level={logLevel}
                    onLevelChange={setLogLevel}
                    period={logPeriod}
                    onPeriodChange={setLogPeriod}
                    season={logSeason}
                    onSeasonChange={setLogSeason}
                    group={logGroup}
                    onGroupChange={setLogGroup}
                  />
                  {gameLogLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <GameLogTable
                      cols={gameLogCols}
                      rows={gameLogRows}
                      emptyMessage={`No game logs for ${logSeason} ${PERIOD_OPTIONS.find((p) => p.value === logPeriod)?.label ?? ''}.`}
                    />
                  )}
                </Tab.Panel>

                <Tab.Panel>
                  <FilterBar
                    level={splitLevel}
                    onLevelChange={setSplitLevel}
                    period={splitPeriod}
                    onPeriodChange={setSplitPeriod}
                    season={splitSeason}
                    onSeasonChange={setSplitSeason}
                  />
                  {splitLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <StatsTable
                      cols={isPitcher ? pitchCols : hitCols}
                      rows={splitRows}
                      emptyMessage={`No splits for ${splitSeason} ${PERIOD_OPTIONS.find((p) => p.value === splitPeriod)?.label ?? ''}.`}
                    />
                  )}
                </Tab.Panel>

                <Tab.Panel>
                  <div className="text-slate-500 text-sm text-center py-12 border border-dashed border-slate-700 rounded-2xl">
                    Batter vs. Pitcher matchup data coming soon.
                  </div>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>
        </div>
      )}
    </div>
  );
}