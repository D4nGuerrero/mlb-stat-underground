import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { teamLogoUrl, playerHeadshotUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';
import { TabBar, Select, SegmentedControl, stickyPlayerHead, stickyPlayerCell, scrollStickyHead, scrollStickyCell, scrollStatHead, scrollStatCell, TABLE_SCROLL, TABLE_BASE } from '../components/ui';
import { TABLE_TEXT_CLASS, TABLE_MIN_W } from '../theme/tableTheme';

const SEASON = new Date().getFullYear();
const SEASON_OPTIONS = Array.from({ length: SEASON - 2002 + 1 }, (_, i) => {
  const y = SEASON - i;
  return { value: String(y), label: String(y) };
});

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

const formatCalendarGameLabel = (g, teamId) => {
  const home = g.teams?.home;
  const away = g.teams?.away;
  const isHome = home?.team?.id?.toString() === teamId?.toString();
  const isFinal = g.status?.abstractGameState === 'Final';
  const isLive = g.status?.abstractGameState === 'Live';

  if (isFinal) {
    const homeWin = (home?.score ?? 0) > (away?.score ?? 0);
    const awayWin = (away?.score ?? 0) > (home?.score ?? 0);
    const won = isHome ? homeWin : awayWin;
    const wl = won ? 'W' : 'L';
    const score = isHome
      ? `${home?.score ?? 0}-${away?.score ?? 0}`
      : `${away?.score ?? 0}-${home?.score ?? 0}`;
    return { text: `${wl} ${score}`, type: won ? 'win' : 'loss' };
  }
  if (isLive) return { text: 'LIVE', type: 'live' };
  return { text: fmtGameTime(g.gameDate), type: 'upcoming' };
};
const fmt = (v, dec = 3) => {
  if (v == null || v === '') return '–';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (dec === 0) return Math.round(n).toString();
  return n.toFixed(dec).replace(/^0\./, '.');
};

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

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className={`w-8 h-8 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
    </div>
  );
}

// ─── Sortable table ───────────────────────────────────────────────────────────
function SortableTable({ cols, rows, nameKey = 'fullName', idKey = 'id' }) {
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
                    <Link to={`/player/${playerId}`} className={`font-medium hover:text-${THEME_COLOR}-400 transition-colors text-xs sm:text-sm leading-tight block truncate`}>
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
function StatsTab({ teamId, season }) {
  const [sub, setSub] = useState('batting');
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

  const getLeader = (key, asc = false) => {
    if (!rows.length) return null;
    return rows.reduce((best, r) => {
      const bv = parseFloat(best?.stat?.[key] ?? 0);
      const rv = parseFloat(r?.stat?.[key] ?? 0);
      return (asc ? rv < bv : rv > bv) ? r : best;
    });
  };

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
          {leaderStats.map(({ label, key, dec }) => {
            const leader = getLeader(key, key === 'era' || key === 'whip');
            const person = leader?.player ?? leader?.person;
            const val = leader?.stat?.[key];
            return (
              <div key={key} className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-slate-500 font-medium mb-1.5">{label}</div>
                <img
                  src={playerHeadshotUrl(person?.id)}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border border-slate-700 mx-auto mb-1.5 bg-slate-800"
                  onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                />
                <div className={`font-display text-lg tabular-nums text-${THEME_COLOR}-400 leading-none`}>
                  {dec === -1 ? (val ?? '–') : fmt(val, dec)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{person?.fullName?.split(' ').slice(-1)[0]}</div>
              </div>
            );
          })}
        </div>
      )}

      {loading && <Spinner />}
      {error && <div className="py-8 text-center text-red-400 text-sm">{error}</div>}
      {!loading && !error && rows.length > 0 && (
        <div className="border border-slate-700/60 rounded-2xl overflow-hidden">
          <SortableTable cols={colsMap[sub]} rows={rows} />
        </div>
      )}
      {!loading && !error && rows.length === 0 && data[sub] != null && (
        <div className="py-12 text-center text-slate-500 text-sm">No stats available for {season}.</div>
      )}
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab({ teamId, season }) {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const gameRefs = useRef({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    setGames([]);
    setSelectedMonth('');
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=1&gameType=R&hydrate=team,linescore`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const allGames = (json.dates ?? [])
          .flatMap((d) => d.games ?? [])
          .sort((a, b) => new Date(a.officialDate ?? a.gameDate) - new Date(b.officialDate ?? b.gameDate));
        setGames(allGames);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId, season]);

  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
      arr.sort((a, b) => new Date(a.officialDate ?? a.gameDate) - new Date(b.officialDate ?? b.gameDate));
    });
    return map;
  }, [games]);

  const months = useMemo(() => Object.keys(gamesByMonth).sort(), [gamesByMonth]);

  useEffect(() => {
    if (!months.length || selectedMonth) return;
    const now = new Date();
    const k = monthKey(now);
    setSelectedMonth(months.includes(k) ? k : months[0]);
  }, [months, selectedMonth]);

  useEffect(() => {
    if (view !== 'list' || !games.length) return;
    const todayKey = localDateKey(new Date());
    const idx = games.findIndex((g) => (g.officialDate ?? g.gameDate?.split('T')[0] ?? '') >= todayKey);
    const target = idx >= 0 ? games[idx] : games[games.length - 1];
    const el = target?.gamePk ? gameRefs.current[target.gamePk] : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [games, view]);

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

  if (loading) return <Spinner />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const todayStr = localDateKey(new Date());

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

        {view === 'month' && months.length > 0 && (
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={months.map((m) => {
              const [yy, mm] = m.split('-').map((x) => Number(x));
              return { value: m, label: monthLabel(new Date(yy, mm - 1, 1)) };
            })}
            buttonClassName="bg-slate-900 min-w-[140px]"
          />
        )}
      </div>

      {games.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">No schedule found for {season}.</div>
      )}

      {view === 'list' && games.length > 0 && (
        <div className="space-y-1">
          {games.map((g) => {
            const home = g.teams?.home;
            const away = g.teams?.away;
            const isFinal = g.status?.abstractGameState === 'Final';
            const isLive = g.status?.abstractGameState === 'Live';
            const homeWin = isFinal && home?.score > away?.score;
            const awayWin = isFinal && away?.score > home?.score;
            const isHome = home?.team?.id?.toString() === teamId?.toString();
            const opp = isHome ? away : home;
            const dateStr = g.officialDate ?? g.gameDate?.split('T')[0];
            const isToday = dateStr === todayStr;
            return (
              <div
                key={g.gamePk}
                ref={(el) => { if (el) gameRefs.current[g.gamePk] = el; }}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors cursor-pointer rounded-xl ${isToday ? `bg-${THEME_COLOR}-500/[0.06] border-${THEME_COLOR}-500/20` : ''}`}
                onClick={() => navigate(`/game/${g.gamePk}`)}
              >
                <div className="w-14 sm:w-16 text-xs text-slate-500 flex-shrink-0">{fmtDate(dateStr)}</div>
                <div className="w-5 sm:w-6 text-xs text-slate-500 flex-shrink-0">{isHome ? 'vs' : '@'}</div>
                <img src={teamLogoUrl(opp?.team?.id)} alt="" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" onError={(e) => (e.target.style.display = 'none')} />
                <div className="flex-1 min-w-0 text-sm font-medium truncate">{opp?.team?.name}</div>
                <div className="text-right flex-shrink-0 text-sm">
                  {isFinal ? (
                    <span className={`font-semibold tabular-nums ${isHome ? (homeWin ? `text-emerald-400` : 'text-red-400') : (awayWin ? `text-emerald-400` : 'text-red-400')}`}>
                      {isHome ? (homeWin ? 'W' : 'L') : (awayWin ? 'W' : 'L')}{' '}
                      {isHome ? `${home?.score}-${away?.score}` : `${away?.score}-${home?.score}`}
                    </span>
                  ) : isLive ? (
                    <span className="text-yellow-400 text-xs font-bold">LIVE</span>
                  ) : (
                    <span className="text-slate-500 text-xs">
                      {g.gameDate ? new Date(g.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'month' && months.length > 0 && selectedMonth && (() => {
        const { days, byDate, monthDate } = buildMonthGrid(selectedMonth);
        const monthIdx = monthDate.getMonth();

        return (
         <div className="border-t border-t-slate-700/60 sm:border sm:border-slate-700/60 sm:rounded-2xl overflow-hidden overflow-x-auto">
            <div className="min-w-[320px]">
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
                  const dayGames = byDate[key] ?? [];
                  const isToday = key === todayStr;
                  return (
                    <div
                      key={key}
                      className={`aspect-square sm:aspect-auto sm:min-h-[128px] border-b border-r border-slate-800/50 p-0.5 sm:p-1.5 flex flex-col overflow-hidden ${inMonth ? '' : 'opacity-35'} ${isToday ? `bg-${THEME_COLOR}-500/[0.06]` : ''}`}
                    >
                      <div className={`text-[9px] sm:text-[11px] font-mono leading-none mb-0.5 sm:mb-1 flex-shrink-0 ${isToday ? `text-${THEME_COLOR}-300` : 'text-slate-400'}`}>
                        {inMonth ? d.getDate() : ''}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 min-h-0">
                        {dayGames.slice(0, 2).map((g, gi) => {
                          const home = g.teams?.home;
                          const away = g.teams?.away;
                          const isHome = home?.team?.id?.toString() === teamId?.toString();
                          const opp = isHome ? away : home;
                          const isFinal = g.status?.abstractGameState === 'Final';
                          const isLive = g.status?.abstractGameState === 'Live';
                          const homeWin = isFinal && home?.score > away?.score;
                          const awayWin = isFinal && away?.score > home?.score;
                          const won = isHome ? homeWin : awayWin;
                          const gameLabel = formatCalendarGameLabel(g, teamId);
                          return (
                            <button
                              key={g.gamePk}
                              type="button"
                              onClick={() => navigate(`/game/${g.gamePk}`)}
                              className={`w-full flex-1 flex flex-col items-center justify-between gap-0 min-h-0 sm:min-h-[52px] rounded sm:rounded-lg px-0.5 py-0.5 sm:px-1 sm:py-1 transition-colors ${gi > 0 ? 'hidden sm:flex' : ''} ${
                                isFinal
                                  ? won
                                    ? `bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25`
                                    : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/25'
                                  : isLive
                                  ? 'bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30'
                                  : 'bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50'
                              }`}
                              title={`${isHome ? 'vs' : '@'} ${opp?.team?.name ?? 'Opponent'} · ${gameLabel.text}`}
                            >
                              <img
                                src={teamLogoUrl(opp?.team?.id)}
                                alt={opp?.team?.name ?? 'Opponent'}
                                className="w-7 h-7 sm:w-11 sm:h-11 object-contain flex-shrink-0 drop-shadow-sm"
                                onError={(e) => (e.target.style.display = 'none')}
                              />
                              <span
                                className={[
                                  'text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none flex-shrink-0',
                                  gameLabel.type === 'win' ? `text-emerald-400`
                                    : gameLabel.type === 'loss' ? 'text-red-400'
                                    : gameLabel.type === 'live' ? 'text-yellow-300'
                                    : 'text-slate-400',
                                ].join(' ')}
                              >
                                {gameLabel.text}
                              </span>
                            </button>
                          );
                        })}
                        {dayGames.length > 1 && (
                          <div className="sm:hidden text-[7px] text-slate-500 text-center leading-none">+{dayGames.length - 1}</div>
                        )}
                        {dayGames.length > 2 && (
                          <div className="hidden sm:block text-[9px] text-slate-500 text-center">+{dayGames.length - 2}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Roster Tab ──────────────────────────────────────────────────────────────
function RosterTab({ teamId, season }) {
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

  if (loading) return <Spinner />;
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
function DepthChartTab({ teamId, season }) {
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

  if (loading) return <Spinner />;

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
            <Link key={p.person.id} to={`/player/${p.person.id}`} className="flex items-center gap-2 py-1 hover:opacity-80 transition-opacity">
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

  if (loading) return <Spinner />;
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
function InjuriesTab({ teamId, season }) {
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

  if (loading) return <Spinner />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-2">
      {(roster ?? []).length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No injuries reported.</div>}
      {(roster ?? []).map((p) => (
        <Link
          key={p.person.id}
          to={`/player/${p.person.id}`}
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
function TransactionsTab({ teamId }) {
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

  if (loading) return <Spinner />;
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
                <Link to={`/player/${t.person.id}`} className={`hover:text-${THEME_COLOR}-400 transition-colors`}>
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

// ─── Main TeamPage ────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [teamInfo, setTeamInfo] = useState(null);
  const [teamRecord, setTeamRecord] = useState(null);
  const [season, setSeason] = useState(SEASON.toString());
  const [activeTab, setActiveTab] = useState('stats');
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
              if (key === 'stats') return <StatsTab teamId={teamId} season={season} />;
              if (key === 'schedule') return <ScheduleTab teamId={teamId} season={season} />;
              if (key === 'roster') return <RosterTab teamId={teamId} season={season} />;
              if (key === 'depth') return <DepthChartTab teamId={teamId} season={season} />;
              if (key === 'splits') return <SplitsTab teamId={teamId} season={season} />;
              if (key === 'injuries') return <InjuriesTab teamId={teamId} season={season} />;
              if (key === 'transactions') return <TransactionsTab teamId={teamId} />;
              return null;
            }}
          </TabBar>
        </div>
      </div>
    </div>
  );
}
