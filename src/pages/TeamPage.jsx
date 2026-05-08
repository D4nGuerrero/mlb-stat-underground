import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { teamLogoUrl, playerHeadshotUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';

const SEASON = new Date().getFullYear();

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs sticky left-0 bg-slate-900 min-w-[140px]">Player</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`px-2 py-2 text-xs font-medium cursor-pointer select-none whitespace-nowrap text-right ${sortCol === c.key ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
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
            const person = row.person ?? row;
            return (
              <tr key={person?.[idKey] ?? i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                <td className="px-3 py-2 sticky left-0 bg-slate-900">
                  <div className="flex items-center gap-2">
                    <img
                      src={playerHeadshotUrl(person?.id)}
                      alt=""
                      className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                      onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                    />
                    <div>
                      <Link to={`/player/${person?.id}`} className="font-medium hover:text-emerald-400 transition-colors text-xs leading-tight block">
                        {person?.[nameKey] ?? person?.fullName ?? '—'}
                      </Link>
                      {row.position && (
                        <span className="text-[10px] text-slate-500">{row.position?.abbreviation ?? row.position}</span>
                      )}
                    </div>
                  </div>
                </td>
                {cols.map((c) => {
                  const raw = row.stat?.[c.key] ?? row[c.key];
                  return (
                    <td key={c.key} className={`px-2 py-2 text-right font-mono text-xs tabular-nums ${sortCol === c.key ? 'text-emerald-300' : 'text-slate-300'}`}>
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

  const fetchStats = useCallback(async (group) => {
    if (data[group]) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${groupMap[group]}&season=${season}&teamId=${teamId}&playerPool=all&sportId=1&limit=50&hydrate=person,team`
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
  }, [teamId, season, data]);

  useEffect(() => { fetchStats(sub); }, [sub]);

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
      {/* Sub-tabs */}
      <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-fit mb-5">
        {['batting', 'pitching', 'fielding'].map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${sub === s ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Leader tiles */}
      {leaderStats.length > 0 && rows.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
          {leaderStats.map(({ label, key, dec }) => {
            const leader = getLeader(key, key === 'era' || key === 'whip');
            const person = leader?.person;
            const val = leader?.stat?.[key];
            return (
              <div key={key} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-slate-500 font-medium mb-1.5">{label} Leader</div>
                <img
                  src={playerHeadshotUrl(person?.id)}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover border border-slate-700 mx-auto mb-1.5"
                  onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                />
                <div className="font-display text-lg tabular-nums text-emerald-400 leading-none">
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
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          <SortableTable cols={colsMap[sub]} rows={rows} />
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">No stats available.</div>
      )}
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab({ teamId, season }) {
  const navigate = useNavigate();
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=1&gameType=R&hydrate=team(record),linescore`
        );
        const json = await res.json();
        const allGames = (json.dates ?? []).flatMap((d) => d.games ?? []);
        setGames(allGames);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <Spinner />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-1">
      {(games ?? []).length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No schedule found.</div>}
      {(games ?? []).map((g) => {
        const home = g.teams?.home;
        const away = g.teams?.away;
        const isFinal = g.status?.abstractGameState === 'Final';
        const isLive = g.status?.abstractGameState === 'Live';
        const homeWin = isFinal && home?.score > away?.score;
        const awayWin = isFinal && away?.score > home?.score;
        const isHome = home?.team?.id?.toString() === teamId?.toString();
        const opp = isHome ? away : home;
        return (
          <div
            key={g.gamePk}
            className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors cursor-pointer rounded-xl"
            onClick={() => navigate(`/game/${g.gamePk}`)}
          >
            <div className="w-16 text-xs text-slate-500 flex-shrink-0">{fmtDate(g.officialDate)}</div>
            <div className="w-6 text-xs text-slate-500 flex-shrink-0">{isHome ? 'vs' : '@'}</div>
            <img src={teamLogoUrl(opp?.team?.id)} alt="" className="w-6 h-6 object-contain flex-shrink-0" onError={(e) => (e.target.style.display = 'none')} />
            <div className="flex-1 min-w-0 text-sm font-medium truncate">{opp?.team?.name}</div>
            <div className="text-right flex-shrink-0 text-sm">
              {isFinal ? (
                <span className={`font-semibold ${isHome ? (homeWin ? 'text-emerald-400' : 'text-red-400') : (awayWin ? 'text-emerald-400' : 'text-red-400')}`}>
                  {isHome ? (homeWin ? 'W' : 'L') : (awayWin ? 'W' : 'L')} {isHome ? `${home?.score}-${away?.score}` : `${away?.score}-${home?.score}`}
                </span>
              ) : isLive ? (
                <span className="text-yellow-400 text-xs font-medium">LIVE</span>
              ) : (
                <span className="text-slate-500 text-xs">{g.gameDate ? new Date(g.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '–'}</span>
              )}
            </div>
          </div>
        );
      })}
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
                <img src={playerHeadshotUrl(p.person.id)} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700 flex-shrink-0" onError={(e) => (e.target.src = FALLBACK_HEADSHOT)} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.person.fullName}</div>
                  <div className="text-xs text-slate-500">{p.person?.primaryPosition?.abbreviation} · #{p.jerseyNumber ?? '—'}</div>
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
          <div className="text-xs font-bold text-emerald-400 mb-2">{pos}</div>
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">Split</th>
            {['G', 'AB', 'H', 'HR', 'RBI', 'AVG', 'OBP', 'SLG', 'OPS'].map((c) => (
              <th key={c} className="px-2 py-2 text-xs font-medium text-slate-400 text-right">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(splits ?? []).map((s, i) => (
            <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
              <td className="px-3 py-2 text-xs font-medium text-slate-300">{SPLIT_LABELS[s.split?.code] ?? s.split?.description ?? s.split?.code}</td>
              {[
                ['gamesPlayed', 0], ['atBats', 0], ['hits', 0], ['homeRuns', 0], ['rbi', 0],
                ['avg', 3], ['obp', 3], ['slg', 3], ['ops', 3],
              ].map(([key, dec]) => (
                <td key={key} className="px-2 py-2 text-right font-mono text-xs tabular-nums text-slate-300">{fmt(s.stat?.[key], dec)}</td>
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
  const [txns, setTxns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 60);
        const fmt2 = (d) => d.toISOString().split('T')[0];
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/transactions?teamId=${teamId}&startDate=${fmt2(start)}&endDate=${fmt2(today)}&sportId=1`
        );
        const json = await res.json();
        setTxns(json.transactions ?? []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId]);

  if (loading) return <Spinner />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-1">
      {(txns ?? []).length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No recent transactions.</div>}
      {(txns ?? []).map((t, i) => (
        <div key={t.id ?? i} className="flex items-start gap-3 px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors rounded-xl">
          <div className="w-20 text-xs text-slate-500 flex-shrink-0 pt-0.5">{t.date ? fmtDate(t.date) : '—'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{t.person?.fullName ?? '—'}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t.typeDesc ?? t.description ?? '—'}</div>
            {t.description && t.typeDesc && (
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
  const [season, setSeason] = useState(SEASON.toString());
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}?hydrate=division,league`)
      .then((r) => r.json())
      .then((json) => setTeamInfo(json.teams?.[0] ?? null))
      .catch(() => {});
  }, [teamId]);

  const TABS = [
    { key: 'stats', label: 'Stats' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'roster', label: 'Roster' },
    { key: 'depth', label: 'Depth Chart' },
    { key: 'splits', label: 'Splits' },
    { key: 'injuries', label: 'Injuries' },
    { key: 'transactions', label: 'Transactions' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-5"
      >
        ← Back
      </button>

      {/* Team header */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-5">
          <img
            src={teamLogoUrl(teamId)}
            alt={teamInfo?.name}
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain flex-shrink-0"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <div className="flex-1 min-w-0">
            <div className="text-slate-400 text-xs font-mono tracking-widest uppercase mb-0.5">
              {teamInfo?.league?.name} · {teamInfo?.division?.name}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tighter">
              {teamInfo?.name ?? `Team #${teamId}`}
            </h1>
            {teamInfo?.record && (
              <div className="text-emerald-400 font-semibold mt-1">
                {teamInfo.record.wins}–{teamInfo.record.losses}
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            >
              {[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto bg-slate-900 border border-slate-700 rounded-2xl p-1 mb-6 scrollbar-none">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === key ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'stats' && <StatsTab teamId={teamId} season={season} />}
        {activeTab === 'schedule' && <ScheduleTab teamId={teamId} season={season} />}
        {activeTab === 'roster' && <RosterTab teamId={teamId} season={season} />}
        {activeTab === 'depth' && <DepthChartTab teamId={teamId} season={season} />}
        {activeTab === 'splits' && <SplitsTab teamId={teamId} season={season} />}
        {activeTab === 'injuries' && <InjuriesTab teamId={teamId} season={season} />}
        {activeTab === 'transactions' && <TransactionsTab teamId={teamId} />}
      </div>
    </div>
  );
}
