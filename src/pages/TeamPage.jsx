import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { teamLogoUrl, playerHeadshotUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';
import { TabBar, Select, SegmentedControl, LoadingSpinner, Modal, SwipeableCarousel, stickyPlayerHead, stickyPlayerCell, scrollStickyHead, scrollStickyCell, scrollStatHead, scrollStatCell, TABLE_SCROLL, TABLE_BASE } from '../components/ui';
import { loadTeamPageState, saveTeamPageState, persistTeamPageLeave, restoreTeamPageScroll } from '../utils/teamPageState';
import { TABLE_TEXT_CLASS, TABLE_MIN_W } from '../theme/tableTheme';

const CURRENT_YEAR = new Date().getFullYear();
const SEASON_OPTIONS = Array.from({ length: CURRENT_YEAR - 2002 + 1 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: String(y), label: String(y) };
});
const SCHEDULE_SEASON_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2003 + 1 },
  (_, i) => CURRENT_YEAR - i,
).map((year) => ({
  value: String(year),
  label: `${year} Season`,
}));

const HERO_TEXT_SHADOW = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' };

const localDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const fmtGameTime = (gameDate) => {
  if (!gameDate) return 'TBD';
  return new Date(gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getScheduleOpponent = (g, teamId) => {
  const home = g.teams?.home;
  const away = g.teams?.away;
  const isHome = home?.team?.id?.toString() === teamId?.toString();
  const opp = isHome ? away : home;
  return { isHome, opp };
};

const scheduleGameScore = (side, g) => {
  const teamScore = g.teams?.[side]?.score;
  if (teamScore != null) return teamScore;
  return g.linescore?.teams?.[side]?.runs ?? null;
};

const formatCalendarGameLabel = (g, teamId) => {
  const { isHome } = getScheduleOpponent(g, teamId);
  const isFinal = g.status?.abstractGameState === 'Final';
  const isLive = g.status?.abstractGameState === 'Live';
  const homeScore = scheduleGameScore('home', g);
  const awayScore = scheduleGameScore('away', g);

  if (isFinal && homeScore != null && awayScore != null) {
    const homeWin = homeScore > awayScore;
    const awayWin = awayScore > homeScore;
    const won = isHome ? homeWin : awayWin;
    const wl = won ? 'W' : 'L';
    const score = isHome ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`;
    return { text: `${wl} ${score}`, type: won ? 'win' : 'loss' };
  }
  if (isLive) return { text: 'LIVE', type: 'live' };
  return { text: fmtGameTime(g.gameDate), type: 'upcoming' };
};

const calendarLabelClass = (type) => {
  if (type === 'win') return 'text-emerald-400';
  if (type === 'loss') return 'text-red-400';
  if (type === 'live') return 'text-yellow-300';
  return 'text-slate-400';
};

const calendarGameSurfaceClass = (isHome) => (
  isHome
    ? `bg-${THEME_COLOR}-500/40 hover:bg-${THEME_COLOR}-500/20 border border-${THEME_COLOR}-500/25`
    : 'bg-slate-600/25 hover:bg-slate-600/40 border border-slate-500/35'
);

const scheduleGameDateKey = (g) => g.officialDate ?? (g.gameDate ? g.gameDate.split('T')[0] : '');

const isDoubleHeaderGame = (g) => g?.doubleHeader === 'Y' || g?.doubleHeader === 'S';

const scheduleGameEntryQuality = (g) => {
  let score = 0;
  if (isDoubleHeaderGame(g)) score += 4;
  if (scheduleGameScore('home', g) != null) score += 2;
  if (scheduleGameScore('away', g) != null) score += 2;
  if (g.linescore) score += 1;
  return score;
};

const dedupeScheduleGames = (games) => {
  const byPk = new Map();
  for (const g of games) {
    if (g.gamePk == null) continue;
    const prev = byPk.get(g.gamePk);
    if (!prev || scheduleGameEntryQuality(g) > scheduleGameEntryQuality(prev)) {
      byPk.set(g.gamePk, g);
    }
  }
  return [...byPk.values()].sort(sortScheduleGames);
};

const isDoubleHeaderDay = (dayGames) => {
  const unique = dedupeScheduleGames(dayGames);
  return unique.length >= 2 && unique.some(isDoubleHeaderGame);
};

const getDoubleHeaderLabel = (g) => {
  if (!isDoubleHeaderGame(g) || !g?.gameNumber) return null;
  return `G${g.gameNumber}`;
};

const sortScheduleGames = (a, b) => {
  const dateA = scheduleGameDateKey(a);
  const dateB = scheduleGameDateKey(b);
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  const numA = a.gameNumber ?? 1;
  const numB = b.gameNumber ?? 1;
  if (numA !== numB) return numA - numB;
  return new Date(a.gameDate ?? 0) - new Date(b.gameDate ?? 0);
};
const fmt = (v, dec = 3) => {
  if (v == null || v === '') return '–';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (dec === 0) return Math.round(n).toString();
  return n.toFixed(dec).replace(/^0\./, '.');
};

const BATTING_RATE_KEYS = new Set(['avg', 'obp', 'slg', 'ops']);
const PITCHING_RATE_KEYS = new Set(['era', 'whip']);

function ipToDecimal(ip) {
  if (ip == null || ip === '') return 0;
  const [whole, frac = '0'] = String(ip).split('.');
  return parseInt(whole, 10) + parseInt(frac, 10) / 3;
}

function getTeamGamesPlayed(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r?.stat?.gamesPlayed) || 0), 0);
}

function qualifiesBattingRate(row, teamGames) {
  const pa = Number(row?.stat?.plateAppearances ?? 0);
  const ab = Number(row?.stat?.atBats ?? 0);
  const minPA = Math.max(20, Math.floor(teamGames * 3.1));
  if (pa > 0) return pa >= minPA;
  return ab >= minPA;
}

function qualifiesPitchingRate(row, teamGames) {
  const minIP = Math.max(8, teamGames);
  return ipToDecimal(row?.stat?.inningsPitched) >= minIP;
}

function getTopLeaders(rows, statKey, { asc = false, qualify } = {}) {
  const eligible = rows.filter((row) => {
    const val = row?.stat?.[statKey];
    if (val == null || val === '') return false;
    if (Number.isNaN(parseFloat(val))) return false;
    if (qualify && !qualify(row)) return false;
    return true;
  });

  eligible.sort((a, b) => {
    const av = parseFloat(a.stat[statKey]);
    const bv = parseFloat(b.stat[statKey]);
    return asc ? av - bv : bv - av;
  });

  return eligible.slice(0, 4);
}

function formatLeaderSubline(person, row) {
  const pos = row?.position?.abbreviation
    ?? person?.primaryPosition?.abbreviation
    ?? person?.primaryPosition?.name;
  const number = person?.primaryNumber ?? person?.jerseyNumber;
  return [pos, number != null ? `#${number}` : null].filter(Boolean).join(' • ') || '—';
}

function TeamLeaderCard({ label, statKey, dec, leaders, onNavigateAway }) {
  if (!leaders?.length) return null;

  const [top, ...rest] = leaders;
  const topPerson = top.player ?? top.person;
  const topVal = top.stat?.[statKey];
  const leave = onNavigateAway ?? (() => {});

  return (
    <div className="leader-card w-full min-w-[300px] max-w-[320px] bg-[#1b2a51] rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-xl">
      <div className="p-0 flex items-start gap-3 border-b border-slate-700 min-h-[148px]">
        <div className="flex-1 p-3 min-w-0">
          <div className={`uppercase text-${THEME_COLOR}-400 text-xs font-semibold tracking-widest mb-1`}>
            {label}
          </div>
          <div className="font-bold text-white text-4xl leading-none tabular-nums">
            {dec === -1 ? (topVal ?? '–') : fmt(topVal, dec)}
          </div>
          <div className="mt-3">
            <Link
              to={`/player/${topPerson?.id}`}
              onClick={leave}
              className="font-semibold text-lg text-white hover:text-slate-200 transition-colors truncate block"
              title={topPerson?.fullName}
            >
              {topPerson?.fullName ?? '—'}
            </Link>
            <div className="text-xs text-slate-400">{formatLeaderSubline(topPerson, top)}</div>
          </div>
        </div>
        <div className="flex-shrink-0 mt-5 pr-1">
          <Link to={`/player/${topPerson?.id}`} onClick={leave}>
            <img
              src={playerHeadshotUrl(topPerson?.id, 1)}
              alt=""
              className="w-24 h-24 object-cover"
              onError={(e) => { e.target.src = FALLBACK_HEADSHOT; }}
            />
          </Link>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="bg-white text-slate-900 p-3 space-y-3 rounded-b-3xl">
          {rest.map((row, i) => {
            const person = row.player ?? row.person;
            const val = row.stat?.[statKey];
            return (
              <Fragment key={person?.id ?? i}>
                {i > 0 && <div className="h-px bg-slate-200 mx-1" />}
                <Link
                  to={`/player/${person?.id}`}
                  onClick={leave}
                  className="flex items-center gap-3 group"
                >
                  <img
                    src={playerHeadshotUrl(person?.id, 2)}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 flex-shrink-0"
                    onError={(e) => { e.target.src = FALLBACK_HEADSHOT; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate group-hover:text-slate-600 transition-colors">
                      {person?.fullName ?? '—'}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums flex-shrink-0">
                    {dec === -1 ? (val ?? '–') : fmt(val, dec)}
                  </div>
                </Link>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamLeadersCarousel({ leaderStats, rows, battingRateQualify, pitchingRateQualify, onNavigateAway }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const carouselKey = leaderStats.map((s) => s.key).join(',');

  useEffect(() => {
    setSlideIndex(0);
  }, [carouselKey]);

  const cards = leaderStats.map(({ label, key, dec }) => {
    const isPitchRate = PITCHING_RATE_KEYS.has(key);
    const isBatRate = BATTING_RATE_KEYS.has(key);
    const leaders = getTopLeaders(rows, key, {
      asc: isPitchRate,
      qualify: isBatRate
        ? battingRateQualify
        : isPitchRate
          ? pitchingRateQualify
          : undefined,
    });
    if (!leaders.length) return null;
    return (
      <TeamLeaderCard
        key={key}
        label={label}
        statKey={key}
        dec={dec}
        leaders={leaders}
        onNavigateAway={onNavigateAway}
      />
    );
  }).filter(Boolean);

  if (!cards.length) return null;

  return (
    <SwipeableCarousel
      slideGap={12}
      showDots={cards.length > 1}
      selectedIndex={slideIndex}
      onSelectedIndexChange={setSlideIndex}
      slideClassName="flex-[0_0_88%] sm:flex-[0_0_72%] md:flex-[0_0_58%] lg:flex-[0_0_50%]"
      className="-mx-1 mb-5"
      reinitDeps={`${carouselKey}-${cards.length}`}
    >
      {cards}
    </SwipeableCarousel>
  );
}

// ─── Stat column defs ─────────────────────────────────────────────────────────
const BAT_COLS = [
  { key: 'gamesPlayed', label: 'G', dec: 0 },
  { key: 'atBats', label: 'AB', dec: 0 },
  { key: 'runs', label: 'R', dec: 0 },
  { key: 'hits', label: 'H', dec: 0 },
  { key: 'doubles', label: '2B', dec: 0 },
  { key: 'triples', label: '3B', dec: 0 },
  { key: 'homeRuns', label: 'HR', dec: 0 },
  { key: 'rbi', label: 'RBI', dec: 0 },
  { key: 'stolenBases', label: 'SB', dec: 0 },
  { key: 'baseOnBalls', label: 'BB', dec: 0 },
  { key: 'strikeOuts', label: 'SO', dec: 0 },
  { key: 'avg', label: 'AVG', dec: 3 },
  { key: 'obp', label: 'OBP', dec: 3 },
  { key: 'slg', label: 'SLG', dec: 3 },
  { key: 'ops', label: 'OPS', dec: 3 },
];

const PITCH_COLS = [
  { key: 'wins', label: 'W', dec: 0 },
  { key: 'losses', label: 'L', dec: 0 },
  { key: 'gamesPlayed', label: 'G', dec: 0 },
  { key: 'gamesStarted', label: 'GS', dec: 0 },
  { key: 'inningsPitched', label: 'IP', dec: -1 },
  { key: 'strikeOuts', label: 'SO', dec: 0 },
  { key: 'baseOnBalls', label: 'BB', dec: 0 },
  { key: 'hits', label: 'H', dec: 0 },
  { key: 'earnedRuns', label: 'ER', dec: 0 },
  { key: 'homeRuns', label: 'HR', dec: 0 },
  { key: 'saves', label: 'SV', dec: 0 },
  { key: 'era', label: 'ERA', dec: 2 },
  { key: 'whip', label: 'WHIP', dec: 2 },
];

const FIELD_COLS = [
  { key: 'gamesPlayed', label: 'G', dec: 0 },
  { key: 'gamesStarted', label: 'GS', dec: 0 },
  { key: 'putOuts', label: 'PO', dec: 0 },
  { key: 'assists', label: 'A', dec: 0 },
  { key: 'errors', label: 'E', dec: 0 },
  { key: 'fielding', label: 'FLD%', dec: 3 },
  { key: 'doublePlays', label: 'DP', dec: 0 },
  { key: 'chances', label: 'TC', dec: 0 },
];

// ─── Sortable table ───────────────────────────────────────────────────────────
function SortableTable({ cols, rows, nameKey = 'fullName', idKey = 'id', onNavigateAway }) {
  const [sortCol, setSortCol] = useState(cols[0]?.key ?? '');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (key === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(key); setSortDir('desc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = parseFloat(a.stat?.[sortCol] ?? a[sortCol] ?? 0);
    const bv = parseFloat(b.stat?.[sortCol] ?? b[sortCol] ?? 0);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  return (
    <div className={`${TABLE_SCROLL} -mx-1 px-1 scrollbar-thin`}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.md}`}>
        <thead>
          <tr className="border-b border-slate-700/60">
            <th className={`${stickyPlayerHead('bg-[#121827]')} text-slate-400 font-medium`}>Player</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`${scrollStatHead(`font-medium cursor-pointer select-none ${sortCol === c.key ? `text-${THEME_COLOR}-400` : 'text-slate-400 hover:text-slate-200'}`)}`}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {sortCol === c.key && <span className="ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const person = row.player ?? row.person ?? row;
            const playerId = person?.[idKey] ?? person?.id;
            const pos = row.position?.abbreviation ?? row.position?.name ?? person?.primaryPosition?.abbreviation;
            return (
              <tr key={playerId ?? i} className="group border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                <td className={stickyPlayerCell('bg-[#121827]')}>
                  <div className="min-w-0">
                    <Link
                      to={`/player/${playerId}`}
                      onClick={onNavigateAway}
                      className={`font-medium hover:text-${THEME_COLOR}-400 transition-colors text-xs sm:text-sm leading-tight block truncate`}
                    >
                      {person?.[nameKey] ?? person?.fullName ?? '—'}
                    </Link>
                    {pos && <span className="text-[10px] text-slate-500">{pos}</span>}
                  </div>
                </td>
                {cols.map((c) => {
                  const raw = row.stat?.[c.key] ?? row[c.key];
                  return (
                    <td key={c.key} className={scrollStatCell(sortCol === c.key ? `text-${THEME_COLOR}-300` : '')}>
                      {c.dec === -1 ? (raw ?? '–') : fmt(raw, c.dec)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({ teamId, season, sub, setSub, onNavigateAway }) {
  const [data, setData] = useState({ batting: null, pitching: null, fielding: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const groupMap = { batting: 'hitting', pitching: 'pitching', fielding: 'fielding' };
  const colsMap = { batting: BAT_COLS, pitching: PITCH_COLS, fielding: FIELD_COLS };

  useEffect(() => {
    setData({ batting: null, pitching: null, fielding: null });
  }, [teamId, season]);

  const fetchStats = useCallback(async (group) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${groupMap[group]}&season=${season}&teamId=${teamId}&playerPool=all&sportId=1&limit=200&hydrate=player,team`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const splits = json.stats?.[0]?.splits ?? [];
      setData((prev) => ({ ...prev, [group]: splits }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [teamId, season]);

  useEffect(() => {
    if (data[sub] != null) return;
    fetchStats(sub);
  }, [sub, teamId, season, data, fetchStats]);

  // top leader in each key category
  const leaderStats = sub === 'batting'
    ? [
        { label: 'AVG', key: 'avg', dec: 3 },
        { label: 'HR', key: 'homeRuns', dec: 0 },
        { label: 'RBI', key: 'rbi', dec: 0 },
        { label: 'OPS', key: 'ops', dec: 3 },
        { label: 'SB', key: 'stolenBases', dec: 0 },
        { label: 'H', key: 'hits', dec: 0 },
      ]
    : sub === 'pitching'
    ? [
        { label: 'ERA', key: 'era', dec: 2 },
        { label: 'W', key: 'wins', dec: 0 },
        { label: 'SO', key: 'strikeOuts', dec: 0 },
        { label: 'SV', key: 'saves', dec: 0 },
        { label: 'WHIP', key: 'whip', dec: 2 },
        { label: 'IP', key: 'inningsPitched', dec: -1 },
      ]
    : [];

  const rows = data[sub] ?? [];
  const teamGames = getTeamGamesPlayed(rows);

  const battingRateQualify = (row) => qualifiesBattingRate(row, teamGames);
  const pitchingRateQualify = (row) => qualifiesPitchingRate(row, teamGames);

  return (
    <div>
      <div className="flex flex-wrap gap-2 my-4">
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
          <SegmentedControl
            value={sub}
            onChange={setSub}
            size="sm"
            options={[
              { value: 'batting', label: 'Batting' },
              { value: 'pitching', label: 'Pitching' },
              { value: 'fielding', label: 'Fielding' },
            ]}
          />
        </div>
      </div>

      {leaderStats.length > 0 && rows.length > 0 && (
        <TeamLeadersCarousel
          leaderStats={leaderStats}
          rows={rows}
          battingRateQualify={battingRateQualify}
          pitchingRateQualify={pitchingRateQualify}
          onNavigateAway={onNavigateAway}
        />
      )}
      {loading && <LoadingSpinner size="lg" py="py-16" />}
      {error && <div className="py-8 text-center text-red-400 text-sm">{error}</div>}
      {!loading && !error && rows.length > 0 && (
        <div className="border border-slate-700/60 rounded-2xl overflow-hidden">
          <SortableTable cols={colsMap[sub]} rows={rows} onNavigateAway={onNavigateAway} />
        </div>
      )}
      {!loading && !error && rows.length === 0 && data[sub] != null && (
        <div className="py-12 text-center text-slate-500 text-sm">No stats available for {season}.</div>
      )}
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab({
  teamId,
  season,
  setSeason,
  view,
  setView,
  selectedMonth,
  setSelectedMonth,
  onNavigateAway,
}) {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gamePicker, setGamePicker] = useState(null);
  const gameRefs = useRef({});

  const goToGame = (gamePk) => {
    onNavigateAway?.({ scheduleMonth: selectedMonth });
    navigate(`/game/${gamePk}`);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setGames([]);
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=1&gameType=R&hydrate=team,linescore`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const allGames = dedupeScheduleGames(
          (json.dates ?? []).flatMap((d) => d.games ?? []),
        );
        setGames(allGames);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId, season]);

  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthName = (mm) => new Date(Number(season), Number(mm) - 1, 1).toLocaleDateString('en-US', { month: 'long' });

  const gamesByMonth = useMemo(() => {
    const map = {};
    for (const g of games) {
      const dateStr = g.officialDate ?? (g.gameDate ? g.gameDate.split('T')[0] : '');
      if (!dateStr) continue;
      const d = new Date(`${dateStr}T12:00:00`);
      const k = monthKey(d);
      (map[k] = map[k] ?? []).push(g);
    }
    Object.values(map).forEach((arr) => {
      arr.sort(sortScheduleGames);
    });
    return map;
  }, [games]);

  const months = useMemo(() => Object.keys(gamesByMonth).sort(), [gamesByMonth]);

  const monthsForYear = useMemo(
    () => months.filter((m) => m.startsWith(`${season}-`)),
    [months, season],
  );

  const filteredGames = useMemo(() => {
    if (!selectedMonth) return games;
    const monthPrefix = `${season}-${selectedMonth}`;
    return games.filter((g) => scheduleGameDateKey(g).startsWith(monthPrefix));
  }, [games, season, selectedMonth]);

  useEffect(() => {
    if (!monthsForYear.length) return;
    setSelectedMonth((prev) => {
      if (prev && monthsForYear.includes(`${season}-${prev}`)) return prev;
      const now = new Date();
      const currentKey = monthKey(now);
      if (season === String(now.getFullYear()) && monthsForYear.includes(currentKey)) {
        return currentKey.split('-')[1];
      }
      return monthsForYear[0].split('-')[1];
    });
  }, [monthsForYear, season, setSelectedMonth]);

  useEffect(() => {
    if (view !== 'list' || !filteredGames.length) return;
    const todayKey = localDateKey(new Date());
    const idx = filteredGames.findIndex((g) => scheduleGameDateKey(g) >= todayKey);
    const target = idx >= 0 ? filteredGames[idx] : filteredGames[filteredGames.length - 1];
    const el = target?.gamePk ? gameRefs.current[target.gamePk] : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [filteredGames, view, selectedMonth, season]);

  const buildMonthGrid = (monthStr) => {
    const [yy, mm] = monthStr.split('-').map((x) => Number(x));
    const first = new Date(yy, mm - 1, 1);
    const last = new Date(yy, mm, 0);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const days = [];
    const cursor = new Date(start);
    while (cursor <= last) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    const gamesForMonth = gamesByMonth[monthStr] ?? [];
    const byDate = {};
    for (const g of gamesForMonth) {
      const k = g.officialDate ?? (g.gameDate ? g.gameDate.split('T')[0] : '');
      if (k) (byDate[k] = byDate[k] ?? []).push(g);
    }
    return { days, byDate, monthDate: first };
  };

  const todayStr = localDateKey(new Date());

  const openGamePicker = (dateKey, dayGames) => {
    setGamePicker({ dateKey, games: dayGames });
  };

  const renderMonthCalendar = (monthStr) => {
    const { days, byDate, monthDate } = buildMonthGrid(monthStr);
    const monthIdx = monthDate.getMonth();

    return (
      <div className="border-t border-t-slate-700/60 sm:border sm:border-slate-700/60 sm:rounded-2xl overflow-hidden">
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-slate-800/60">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-1 sm:px-2 py-2 text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-500 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.getMonth() === monthIdx;
              const key = localDateKey(d);
              const dayGames = dedupeScheduleGames(byDate[key] ?? []);
              const isToday = key === todayStr;
              const doubleHeader = isDoubleHeaderDay(dayGames);
              const primaryGame = dayGames[0];
              const { isHome, opp } = primaryGame
                ? getScheduleOpponent(primaryGame, teamId)
                : { isHome: true, opp: null };
              return (
                <div
                  key={`${monthStr}-${key}`}
                  className={`aspect-square sm:aspect-auto sm:min-h-[128px] border-b border-r border-slate-800/50 p-0.5 sm:p-1.5 flex flex-col overflow-hidden ${inMonth ? '' : 'opacity-35'} ${isToday ? 'bg-slate-800' : ''}`}
                >
                  <div className={`text-[9px] sm:text-[11px] font-mono leading-none mb-0.5 sm:mb-1 flex-shrink-0 ${isToday ? `text-${THEME_COLOR}-300` : 'text-slate-400'}`}>
                    {inMonth ? d.getDate() : ''}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 min-h-0">
                    {primaryGame && (
                      doubleHeader ? (
                        <button
                          type="button"
                          onClick={() => openGamePicker(key, dayGames)}
                          className={`w-full flex-1 flex flex-col items-center justify-between gap-0.5 min-h-0 sm:min-h-[52px] rounded sm:rounded-lg px-0.5 py-0.5 sm:px-1 sm:py-1 transition-colors ${calendarGameSurfaceClass(isHome)}`}
                          title={`${isHome ? 'vs' : '@'} ${opp?.team?.name ?? 'Opponent'} · Doubleheader`}
                        >
                          <img
                            src={teamLogoUrl(opp?.team?.id)}
                            alt={opp?.team?.name ?? 'Opponent'}
                            className="w-6 h-6 sm:w-9 sm:h-9 object-contain flex-shrink-0 drop-shadow-sm"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <div className="flex flex-col items-center gap-0.5 w-full min-w-0">
                            {dayGames.map((g) => {
                              const label = formatCalendarGameLabel(g, teamId);
                              return (
                                <span
                                  key={g.gamePk}
                                  className={`text-[8px] sm:text-[9px] font-semibold tabular-nums leading-none ${calendarLabelClass(label.type)}`}
                                >
                                  {label.text}
                                </span>
                              );
                            })}
                          </div>
                        </button>
                      ) : (
                        (() => {
                          const gameLabel = formatCalendarGameLabel(primaryGame, teamId);
                          return (
                            <button
                              type="button"
                              onClick={() => goToGame(primaryGame.gamePk)}
                              className={`w-full flex-1 flex flex-col items-center justify-between gap-0 min-h-0 sm:min-h-[52px] rounded sm:rounded-lg px-0.5 py-0.5 sm:px-1 sm:py-1 transition-colors ${calendarGameSurfaceClass(isHome)}`}
                              title={`${isHome ? 'vs' : '@'} ${opp?.team?.name ?? 'Opponent'} · ${gameLabel.text}`}
                            >
                              <img
                                src={teamLogoUrl(opp?.team?.id)}
                                alt={opp?.team?.name ?? 'Opponent'}
                                className="w-7 h-7 sm:w-11 sm:h-11 object-contain flex-shrink-0 drop-shadow-sm"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className={`text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none flex-shrink-0 ${calendarLabelClass(gameLabel.type)}`}>
                                {gameLabel.text}
                              </span>
                            </button>
                          );
                        })()
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const pickGame = (gamePk) => {
    setGamePicker(null);
    goToGame(gamePk);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 my-4">
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
          <SegmentedControl
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'month', label: 'Monthly' },
              { value: 'list', label: 'List' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={season}
            onChange={setSeason}
            options={SCHEDULE_SEASON_OPTIONS}
            buttonClassName="bg-slate-900 min-w-[140px]"
          />
          {monthsForYear.length > 0 && (
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={monthsForYear.map((m) => {
                const mm = m.split('-')[1];
                return { value: mm, label: monthName(mm) };
              })}
              buttonClassName="bg-slate-900 min-w-[120px]"
            />
          )}
        </div>
      </div>

      {games.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">No schedule found for {season}.</div>
      )}

      {view === 'list' && filteredGames.length > 0 && (
        <div className="space-y-1">
          {filteredGames.map((g) => {
            const { isHome, opp } = getScheduleOpponent(g, teamId);
            const gameLabel = formatCalendarGameLabel(g, teamId);
            const dateStr = scheduleGameDateKey(g);
            const isToday = dateStr === todayStr;
            const dhLabel = getDoubleHeaderLabel(g);
            return (
              <div
                key={g.gamePk}
                ref={(el) => { if (el) gameRefs.current[g.gamePk] = el; }}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors cursor-pointer rounded-xl ${isToday ? `bg-${THEME_COLOR}-500/[0.06] border-${THEME_COLOR}-500/20` : ''}`}
                onClick={() => goToGame(g.gamePk)}
              >
                <div className="w-14 sm:w-16 text-xs text-slate-500 flex-shrink-0">
                  <div>{fmtDate(dateStr)}</div>
                  {dhLabel && <div className="text-[10px] text-slate-400 mt-0.5">{dhLabel}</div>}
                </div>
                <div className="w-5 sm:w-6 text-xs text-slate-500 flex-shrink-0">{isHome ? 'vs' : '@'}</div>
                <img src={teamLogoUrl(opp?.team?.id)} alt="" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" onError={(e) => (e.target.style.display = 'none')} />
                <div className="flex-1 min-w-0 text-sm font-medium truncate">{opp?.team?.name ?? opp?.team?.abbreviation ?? 'Opponent'}</div>
                <div className="text-right flex-shrink-0 text-sm">
                  <span className={`font-semibold tabular-nums ${calendarLabelClass(gameLabel.type)}`}>
                    {gameLabel.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && games.length > 0 && filteredGames.length === 0 && selectedMonth && (
        <div className="py-12 text-center text-slate-500 text-sm">No games in {monthName(selectedMonth)} {season}.</div>
      )}

      {view === 'month' && monthsForYear.length > 0 && selectedMonth && (
        renderMonthCalendar(`${season}-${selectedMonth}`)
      )}


      <Modal
        open={Boolean(gamePicker)}
        onClose={() => setGamePicker(null)}
        title={gamePicker ? `${fmtDate(gamePicker.dateKey)} · Doubleheader` : 'Doubleheader'}
        size="sm"
      >
        <div className="grid grid-cols-2 gap-3 p-4">
          {dedupeScheduleGames(gamePicker?.games ?? []).map((g) => {
            const { isHome, opp } = getScheduleOpponent(g, teamId);
            const label = formatCalendarGameLabel(g, teamId);
            const dhLabel = getDoubleHeaderLabel(g) ?? `G${g.gameNumber ?? '?'}`;
            return (
              <button
                key={g.gamePk}
                type="button"
                onClick={() => pickGame(g.gamePk)}
                className={`aspect-square flex flex-col items-center justify-between gap-1 rounded-xl px-2 py-3 transition-colors active:scale-[0.98] ${calendarGameSurfaceClass(isHome)}`}
              >
                <span className="text-[10px] font-semibold text-slate-400 leading-none">{dhLabel}</span>
                <img
                  src={teamLogoUrl(opp?.team?.id)}
                  alt={opp?.team?.name ?? 'Opponent'}
                  className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0 drop-shadow-sm"
                  onError={(e) => (e.target.style.display = 'none')}
                />
                <span className={`text-xs sm:text-sm font-semibold tabular-nums leading-none ${calendarLabelClass(label.type)}`}>
                  {label.text}
                </span>
                <span className="text-[10px] text-slate-500 leading-none truncate max-w-full">
                  {isHome ? 'vs' : '@'} {opp?.team?.abbreviation ?? opp?.team?.name ?? 'Opp'}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

// ─── Roster Tab ──────────────────────────────────────────────────────────────
function RosterTab({ teamId, season, onNavigateAway }) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(currentTeam,position)&season=${season}`
        );
        const json = await res.json();
        setRoster(json.roster ?? []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const grouped = {};
  (roster ?? []).forEach((p) => {
    const type = p.person?.primaryPosition?.type ?? 'Other';
    (grouped[type] = grouped[type] ?? []).push(p);
  });

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([posType, players]) => (
        <div key={posType}>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{posType}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {players.map((p) => (
              <Link
                key={p.person.id}
                to={`/player/${p.person.id}`}
                onClick={onNavigateAway}
                className="flex items-center gap-3 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 rounded-2xl px-3 py-2.5 transition-colors"
              >
                <img
                  src={playerHeadshotUrl(p.person.id)}
                  alt=""
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-slate-700 flex-shrink-0 bg-slate-800"
                  onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.person.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {p.position?.abbreviation ?? p.person?.primaryPosition?.abbreviation ?? '—'} · #{p.jerseyNumber ?? '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Depth Chart Tab ──────────────────────────────────────────────────────────
function DepthChartTab({ teamId, season, onNavigateAway }) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(currentTeam,position)&season=${season}`);
        const json = await res.json();
        setRoster(json.roster ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;

  const POS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'RP', 'CL'];
  const grouped = {};
  (roster ?? []).forEach((p) => {
    const pos = p.person?.primaryPosition?.abbreviation ?? 'UTIL';
    (grouped[pos] = grouped[pos] ?? []).push(p);
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {POS_ORDER.filter((pos) => grouped[pos]).map((pos) => (
        <div key={pos} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3">
          <div className={`text-xs font-bold text-${THEME_COLOR}-400 mb-2`}>{pos}</div>
          {grouped[pos].map((p) => (
            <Link
              key={p.person.id}
              to={`/player/${p.person.id}`}
              onClick={onNavigateAway}
              className="flex items-center gap-2 py-1 hover:opacity-80 transition-opacity"
            >
              <img src={playerHeadshotUrl(p.person.id)} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0" onError={(e) => (e.target.src = FALLBACK_HEADSHOT)} />
              <span className="text-xs font-medium truncate">{p.person.fullName.split(' ').slice(-1)[0]}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Splits Tab ───────────────────────────────────────────────────────────────
function SplitsTab({ teamId, season }) {
  const [splits, setSplits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/stats?stats=statSplits&group=hitting&season=${season}&teamId=${teamId}&sitCodes=vl,vr,h,a&hydrate=team`
        );
        const json = await res.json();
        setSplits(json.stats?.[0]?.splits ?? []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const SPLIT_LABELS = { vl: 'vs LHP', vr: 'vs RHP', h: 'Home', a: 'Away' };

  return (
    <div className={`${TABLE_SCROLL} -mx-1 px-1`}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.sm}`}>
        <thead>
          <tr className="border-b border-slate-700/60">
            <th className={`${scrollStickyHead('bg-[#121827]')} text-slate-400 font-medium`}>Split</th>
            {['G', 'AB', 'H', 'HR', 'RBI', 'AVG', 'OBP', 'SLG', 'OPS'].map((c) => (
              <th key={c} className={scrollStatHead('font-medium text-slate-400')}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(splits ?? []).map((s, i) => (
            <tr key={i} className="group border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
              <td className={`${scrollStickyCell('bg-[#121827]')} text-xs font-medium text-slate-300`}>{SPLIT_LABELS[s.split?.code] ?? s.split?.description ?? s.split?.code}</td>
              {[
                ['gamesPlayed', 0], ['atBats', 0], ['hits', 0], ['homeRuns', 0], ['rbi', 0],
                ['avg', 3], ['obp', 3], ['slg', 3], ['ops', 3],
              ].map(([key, dec]) => (
                <td key={key} className={scrollStatCell()}>{fmt(s.stat?.[key], dec)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(splits ?? []).length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No splits data available.</div>}
    </div>
  );
}

// ─── Injuries Tab ────────────────────────────────────────────────────────────
function InjuriesTab({ teamId, season, onNavigateAway }) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=injuries&hydrate=person(position)&season=${season}`
        );
        const json = await res.json();
        setRoster(json.roster ?? []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-2">
      {(roster ?? []).length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No injuries reported.</div>}
      {(roster ?? []).map((p) => (
        <Link
          key={p.person.id}
          to={`/player/${p.person.id}`}
          onClick={onNavigateAway}
          className="flex items-center gap-3 bg-red-950/20 hover:bg-red-950/30 border border-red-900/30 rounded-2xl px-4 py-3 transition-colors"
        >
          <img src={playerHeadshotUrl(p.person.id)} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700 flex-shrink-0" onError={(e) => (e.target.src = FALLBACK_HEADSHOT)} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{p.person.fullName}</div>
            <div className="text-xs text-slate-400">{p.person?.primaryPosition?.name} · #{p.jerseyNumber ?? '—'}</div>
          </div>
          {p.status && <div className="text-xs text-red-400 font-medium flex-shrink-0">{p.status.description ?? p.status.code}</div>}
        </Link>
      ))}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ teamId, onNavigateAway }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 120);
        const fmt2 = (d) => localDateKey(d);
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/transactions?teamId=${teamId}&startDate=${fmt2(start)}&endDate=${fmt2(today)}&sportId=1`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const sorted = [...(json.transactions ?? [])].sort(
          (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0),
        );
        setTxns(sorted);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-1">
      {txns.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No recent transactions.</div>}
      {txns.map((t, i) => (
        <div key={t.id ?? `${t.date}-${t.person?.id}-${i}`} className="flex items-start gap-3 px-3 sm:px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors rounded-xl">
          <div className="w-16 sm:w-20 text-xs text-slate-500 flex-shrink-0 pt-0.5 tabular-nums">{t.date ? fmtDate(t.date) : '—'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              {t.person?.id ? (
                <Link
                  to={`/player/${t.person.id}`}
                  onClick={onNavigateAway}
                  className={`hover:text-${THEME_COLOR}-400 transition-colors`}
                >
                  {t.person?.fullName ?? '—'}
                </Link>
              ) : (t.person?.fullName ?? '—')}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{t.typeDesc ?? t.description ?? '—'}</div>
            {t.description && t.typeDesc && t.description !== t.typeDesc && (
              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeScheduleMonth(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes('-')) return str.split('-').pop() ?? '';
  return str;
}

function readTeamPageDefaults(teamId) {
  const saved = loadTeamPageState(teamId);
  return {
    activeTab: saved?.activeTab ?? 'stats',
    season: saved?.season ?? String(CURRENT_YEAR),
    statsSub: saved?.statsSub ?? 'batting',
    scheduleView: saved?.scheduleView ?? 'month',
    scheduleMonth: normalizeScheduleMonth(saved?.scheduleMonth),
  };
}

// ─── Main TeamPage ────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [teamInfo, setTeamInfo] = useState(null);
  const [teamRecord, setTeamRecord] = useState(null);
  const defaults = useMemo(() => readTeamPageDefaults(teamId), [teamId]);
  const [season, setSeason] = useState(defaults.season);
  const [activeTab, setActiveTab] = useState(defaults.activeTab);
  const [statsSub, setStatsSub] = useState(defaults.statsSub);
  const [scheduleView, setScheduleView] = useState(defaults.scheduleView);
  const [scheduleMonth, setScheduleMonth] = useState(defaults.scheduleMonth);
  const [favoriteTeams, setFavoriteTeams] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]');
    } catch {
      return [];
    }
  });

  const isFavorite = favoriteTeams.includes(Number(teamId));

  useEffect(() => {
    localStorage.setItem('mlbFavoriteTeams', JSON.stringify(favoriteTeams));
  }, [favoriteTeams]);

  useEffect(() => {
    fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}?hydrate=division,league,venue`)
      .then((r) => r.json())
      .then((json) => setTeamInfo(json.teams?.[0] ?? null))
      .catch(() => {});
  }, [teamId]);

  useEffect(() => {
    fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`)
      .then((r) => r.json())
      .then((json) => {
        const records = (json.records ?? []).flatMap((r) => r.teamRecords ?? []);
        const rec = records.find((r) => r.team?.id === Number(teamId));
        setTeamRecord(rec?.leagueRecord ?? rec?.records?.splitRecords?.[0] ?? null);
      })
      .catch(() => setTeamRecord(null));
  }, [teamId, season]);

  useEffect(() => {
    try {
      setFavoriteTeams(JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]'));
    } catch {
      setFavoriteTeams([]);
    }
  }, [teamId]);

  useEffect(() => {
    const next = readTeamPageDefaults(teamId);
    setActiveTab(next.activeTab);
    setSeason(next.season);
    setStatsSub(next.statsSub);
    setScheduleView(next.scheduleView);
    setScheduleMonth(next.scheduleMonth);
    restoreTeamPageScroll(teamId);
  }, [teamId, location.key]);

  useEffect(() => {
    saveTeamPageState(teamId, {
      activeTab,
      season,
      statsSub,
      scheduleView,
      scheduleMonth,
    });
  }, [teamId, activeTab, season, statsSub, scheduleView, scheduleMonth]);

  const teamPageSnapshot = useMemo(() => ({
    activeTab,
    season,
    statsSub,
    scheduleView,
    scheduleMonth,
  }), [activeTab, season, statsSub, scheduleView, scheduleMonth]);

  const onNavigateAway = useCallback((overrides = {}) => {
    persistTeamPageLeave(teamId, { ...teamPageSnapshot, ...overrides });
  }, [teamId, teamPageSnapshot]);

  const toggleFavorite = () => {
    const idNum = Number(teamId);
    if (!idNum) return;
    setFavoriteTeams((prev) => (prev.includes(idNum) ? prev.filter((x) => x !== idNum) : [idNum, ...prev]));
  };

  const TABS = [
    { key: 'stats', label: 'Stats' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'roster', label: 'Roster' },
    { key: 'depth', label: 'Depth' },
    { key: 'splits', label: 'Splits' },
    { key: 'injuries', label: 'Injuries' },
    { key: 'transactions', label: 'Moves' },
  ];

  const recordText = teamRecord
    ? `${teamRecord.wins ?? 0}–${teamRecord.losses ?? 0}`
    : null;

  return (
    <div className="max-w-4xl mx-auto sm:px-6 sm:py-8">
      

      <div className="bg-[#121827] border border-slate-700/60 sm:rounded-2xl overflow-hidden">
        <div className="relative h-[180px] sm:h-[240px] overflow-hidden px-5 sm:px-8 py-5 sm:py-6 flex flex-col">
          {/* TEAM BANNER */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-[#121827]" />
          <img
            src={teamLogoUrl(teamId)}
            alt=""
            className="absolute -right-4 sm:right-6 top-1/2 -translate-y-1/2 w-36 sm:w-52 h-36 sm:h-52 object-contain opacity-[0.12] pointer-events-none"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

          <div className="relative flex items-center justify-between gap-3 mb-auto">
           
            <div className="flex items-center gap-2 flex-shrink-0">
              <Select
                value={season}
                onChange={setSeason}
                options={SEASON_OPTIONS}
                buttonClassName="bg-slate-900/80 border-slate-600/80 text-xs sm:text-sm min-w-[88px]"
              />
              <button
                type="button"
                onClick={toggleFavorite}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all active:scale-[0.985] ${
                  isFavorite
                    ? 'bg-yellow-400/15 hover:bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-600/80'
                }`}
                title={isFavorite ? 'Unfavorite team' : 'Favorite team'}
              >
                {isFavorite ? '★' : '☆'}
                <span className="hidden sm:inline ml-1">{isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-end gap-4 sm:gap-5 mt-4">
            <img
              src={teamLogoUrl(teamId)}
              alt={teamInfo?.name}
              className="w-16 h-16 sm:w-24 sm:h-24 object-contain flex-shrink-0 drop-shadow-lg"
              onError={(e) => (e.target.style.display = 'none')}
            />
            <div className="pb-1 min-w-0">
              <h1
                className="text-2xl sm:text-4xl font-bold text-white leading-none mb-1.5 truncate"
                style={HERO_TEXT_SHADOW}
              >
                {teamInfo?.name ?? `Team #${teamId}`}
              </h1>
              {recordText && (
                <div className={`text-${THEME_COLOR}-300 font-semibold text-sm sm:text-base`} style={HERO_TEXT_SHADOW}>
                  {recordText}
                  <span className="text-slate-400 font-normal text-xs sm:text-sm ml-2">{season} Regular Season</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-8 py-4 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'League', value: teamInfo?.league?.name ?? '—' },
            { label: 'Division', value: teamInfo?.division?.name ?? '—' },
            { label: 'Ballpark', value: (typeof teamInfo?.venue === 'string' ? teamInfo.venue : teamInfo?.venue?.name) ?? '—' },
            { label: 'Est.', value: teamInfo?.firstYearOfPlay ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
              <div className="text-sm font-semibold text-slate-200 truncate">{value}</div>
            </div>
          ))}
        </div>

        <div className=" sm:px-8 py-5 sm:py-6">
          <TabBar variant="page" tabs={TABS} activeKey={activeTab} onChange={setActiveTab}>
            {(key) => {
              if (key === 'stats') {
                return (
                  <StatsTab
                    teamId={teamId}
                    season={season}
                    sub={statsSub}
                    setSub={setStatsSub}
                    onNavigateAway={onNavigateAway}
                  />
                );
              }
              if (key === 'schedule') {
                return (
                  <ScheduleTab
                    teamId={teamId}
                    season={season}
                    setSeason={setSeason}
                    view={scheduleView}
                    setView={setScheduleView}
                    selectedMonth={scheduleMonth}
                    setSelectedMonth={setScheduleMonth}
                    onNavigateAway={onNavigateAway}
                  />
                );
              }
              if (key === 'roster') return <RosterTab teamId={teamId} season={season} onNavigateAway={onNavigateAway} />;
              if (key === 'depth') return <DepthChartTab teamId={teamId} season={season} onNavigateAway={onNavigateAway} />;
              if (key === 'splits') return <SplitsTab teamId={teamId} season={season} />;
              if (key === 'injuries') return <InjuriesTab teamId={teamId} season={season} onNavigateAway={onNavigateAway} />;
              if (key === 'transactions') return <TransactionsTab teamId={teamId} onNavigateAway={onNavigateAway} />;
              return null;
            }}
          </TabBar>
        </div>
      </div>
    </div>
  );
}
