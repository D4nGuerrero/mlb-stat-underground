import { useEffect, useMemo, useState } from 'react';
import { THEME_COLOR } from '../../../theme/theme.js';
import { playerHeadshotUrl, teamLogoUrl } from '../../../utils/mlbHelpers';
import { Modal } from '../../../components/ui';

const savantGameCache = new Map();
const hrParkDetailsCache = new Map();

const MLB_PARKS = [
  { key: 'ari', abbr: 'AZ', teamId: 109, park: 'Chase Field' },
  { key: 'atl', abbr: 'ATL', teamId: 144, park: 'Truist Park' },
  { key: 'bal', abbr: 'BAL', teamId: 110, park: 'Oriole Park at Camden Yards' },
  { key: 'bos', abbr: 'BOS', teamId: 111, park: 'Fenway Park' },
  { key: 'chc', abbr: 'CHC', teamId: 112, park: 'Wrigley Field' },
  { key: 'cws', abbr: 'CWS', teamId: 145, park: 'Rate Field' },
  { key: 'cin', abbr: 'CIN', teamId: 113, park: 'Great American Ball Park' },
  { key: 'cle', abbr: 'CLE', teamId: 114, park: 'Progressive Field' },
  { key: 'col', abbr: 'COL', teamId: 115, park: 'Coors Field' },
  { key: 'det', abbr: 'DET', teamId: 116, park: 'Comerica Park' },
  { key: 'hou', abbr: 'HOU', teamId: 117, park: 'Daikin Park' },
  { key: 'kc', abbr: 'KC', teamId: 118, park: 'Kauffman Stadium' },
  { key: 'laa', abbr: 'LAA', teamId: 108, park: 'Angel Stadium' },
  { key: 'lad', abbr: 'LAD', teamId: 119, park: 'Dodger Stadium' },
  { key: 'mia', abbr: 'MIA', teamId: 146, park: 'loanDepot park' },
  { key: 'mil', abbr: 'MIL', teamId: 158, park: 'American Family Field' },
  { key: 'min', abbr: 'MIN', teamId: 142, park: 'Target Field' },
  { key: 'nym', abbr: 'NYM', teamId: 121, park: 'Citi Field' },
  { key: 'nyy', abbr: 'NYY', teamId: 147, park: 'Yankee Stadium' },
  { key: 'oak', abbr: 'ATH', teamId: 133, park: 'Sutter Health Park' },
  { key: 'phi', abbr: 'PHI', teamId: 143, park: 'Citizens Bank Park' },
  { key: 'pit', abbr: 'PIT', teamId: 134, park: 'PNC Park' },
  { key: 'sd', abbr: 'SD', teamId: 135, park: 'Petco Park' },
  { key: 'sea', abbr: 'SEA', teamId: 136, park: 'T-Mobile Park' },
  { key: 'sf', abbr: 'SF', teamId: 137, park: 'Oracle Park' },
  { key: 'stl', abbr: 'STL', teamId: 138, park: 'Busch Stadium' },
  { key: 'tb', abbr: 'TB', teamId: 139, park: 'George M. Steinbrenner Field' },
  { key: 'tex', abbr: 'TEX', teamId: 140, park: 'Globe Life Field' },
  { key: 'tor', abbr: 'TOR', teamId: 141, park: 'Rogers Centre' },
  { key: 'wsh', abbr: 'WSH', teamId: 120, park: 'Nationals Park' },
];

const SAVANT_COLUMNS = [
  { key: 'batterName', label: 'Batter', align: 'text-left', sticky: true },
  { key: 'abNumber', label: 'PA', align: 'text-right' },
  { key: 'inning', label: 'In.', align: 'text-right' },
  { key: 'result', label: 'Result', align: 'text-left' },
  { key: 'exitVelocity', label: 'Exit Velo', align: 'text-right', accent: true },
  { key: 'launchAngle', label: 'Hit LA', align: 'text-right' },
  { key: 'distance', label: 'Hit Dist', align: 'text-right' },
  { key: 'batSpeed', label: 'Bat Speed', align: 'text-right' },
  { key: 'pitchSpeed', label: 'Pitch Velo', align: 'text-right' },
  { key: 'xba', label: 'xBA', align: 'text-right' },
  { key: 'hrParks', label: 'HR / Park', align: 'text-right' },
];

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 0) {
  const number = numberOrNull(value);
  if (number == null) return '—';
  return number.toFixed(digits);
}

function formatXba(value) {
  const number = numberOrNull(value);
  if (number == null) return '—';
  return number.toFixed(3).replace(/^0/, '');
}

function playerShortName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName || '—';
  const suffix = parts.at(-1);
  const hasSuffix = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(suffix);
  const lastName = hasSuffix ? `${parts.at(-2)} ${suffix}` : suffix;
  return `${parts[0][0]}. ${lastName}`;
}

function fullInningLabel(row) {
  const half = row.halfInning === 'bottom' ? 'B' : 'T';
  return row.inning ? `${half}${row.inning}` : '—';
}

function exitVelocityTone(value) {
  const ev = numberOrNull(value);
  if (ev == null) return 'bg-slate-800 text-slate-300';
  if (ev >= 110) return 'bg-red-600 text-white';
  if (ev >= 105) return 'bg-red-500 text-white';
  if (ev >= 100) return 'bg-red-400 text-slate-950';
  if (ev >= 95) return 'bg-red-300 text-slate-950';
  if (ev >= 90) return 'bg-orange-200 text-slate-950';
  if (ev >= 85) return 'bg-slate-300 text-slate-950';
  if (ev >= 80) return 'bg-sky-200 text-slate-950';
  if (ev >= 70) return 'bg-sky-400 text-slate-950';
  if (ev >= 60) return 'bg-blue-500 text-white';
  return 'bg-blue-700 text-white';
}

function xbaTone(value) {
  const xba = numberOrNull(value);
  if (xba == null) return '';
  if (xba >= 0.500) return 'bg-emerald-400/80 text-slate-950';
  if (xba >= 0.350) return 'bg-emerald-500/20 text-emerald-200';
  if (xba <= 0.100) return 'text-slate-500';
  return 'text-slate-200';
}

function normalizeSavantRows(data) {
  const pitchRows = [...(data?.team_away ?? []), ...(data?.team_home ?? [])]
    .filter((row) => row?.ab_number != null);
  const paRowsByNumber = new Map();

  pitchRows.forEach((row) => {
    const key = Number(row.ab_number);
    const current = paRowsByNumber.get(key);
    const currentPitch = numberOrNull(current?.pitch_number ?? current?.player_total_pitches) ?? -1;
    const nextPitch = numberOrNull(row.pitch_number ?? row.player_total_pitches) ?? -1;
    if (!current || nextPitch >= currentPitch) {
      paRowsByNumber.set(key, row);
    }
  });

  const battedBallByPa = new Map(
    (data?.exit_velocity ?? [])
      .filter((row) => row?.ab_number != null)
      .map((row) => [Number(row.ab_number), row]),
  );

  return [...paRowsByNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([abNumber, paRow], index) => {
      const battedBall = battedBallByPa.get(abNumber);
      const metricsRow = battedBall ?? paRow;
      const homeRunParks = metricsRow.contextMetrics?.homeRunBallparks;
      return {
        id: paRow.play_id || `${paRow.game_pk}-${abNumber}-${index}`,
        teamId: paRow.team_batting_id,
        teamAbbr: paRow.team_batting,
        batterId: paRow.batter,
        batterName: paRow.batter_name,
        year: paRow.year,
        battedBallPlayId: battedBall?.play_id,
        abNumber,
        inning: paRow.inning,
        halfInning: paRow.half_inning,
        result: paRow.result || paRow.events || paRow.call_name,
        exitVelocity: battedBall ? metricsRow.hit_speed ?? metricsRow.launch_speed : null,
        launchAngle: battedBall ? metricsRow.hit_angle ?? metricsRow.launch_angle : null,
        distance: battedBall ? metricsRow.hit_distance : null,
        batSpeed: metricsRow.batSpeed,
        pitchSpeed: metricsRow.start_speed,
        xba: battedBall ? metricsRow.xba : null,
        hrParkCount: homeRunParks,
        hrParks: homeRunParks != null ? `${homeRunParks}/30` : metricsRow.contextMetrics?.homeRunBallparksFormatted,
        isBarrel: Number(metricsRow.is_barrel) === 1,
        playIndex: abNumber - 1,
      };
    });
}

async function fetchSavantGame(gamePk, signal) {
  if (savantGameCache.has(gamePk)) return savantGameCache.get(gamePk);
  const res = await fetch(`https://baseballsavant.mlb.com/gf?game_pk=${gamePk}`, { signal });
  if (!res.ok) throw new Error(`Savant HTTP ${res.status}`);
  const data = await res.json();
  savantGameCache.set(gamePk, data);
  return data;
}

async function fetchHrParkDetails(row) {
  if (!row?.batterId || !row?.year || !row?.battedBallPlayId) return null;

  const cacheKey = `${row.batterId}:${row.year}:xhr`;
  if (!hrParkDetailsCache.has(cacheKey)) {
    const params = new URLSearchParams({
      type: 'details',
      player_id: String(row.batterId),
      year: String(row.year),
      player_type: 'Batter',
      cat: 'xhr',
    });
    const res = await fetch(`https://baseballsavant.mlb.com/leaderboard/home-runs?${params.toString()}`, {
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    });
    if (!res.ok) throw new Error(`Savant HR/Park HTTP ${res.status}`);
    hrParkDetailsCache.set(cacheKey, await res.json());
  }

  const detailRow = hrParkDetailsCache.get(cacheKey)?.find((item) => item.play_id === row.battedBallPlayId);
  if (!detailRow) return null;

  const homeRunParks = [];
  const notHomeRunParks = [];
  MLB_PARKS.forEach((park) => {
    const bucket = Number(detailRow[park.key]) > 0 ? homeRunParks : notHomeRunParks;
    bucket.push(park);
  });

  return { row: detailRow, homeRunParks, notHomeRunParks };
}

function SavantStatCell({ column, row, onHrParksClick }) {
  const value = row[column.key];

  if (column.key === 'exitVelocity') {
    return (
      <td className="px-1 py-1 text-right">
        <span className={`inline-flex min-w-12 justify-end rounded px-1.5 py-0.5 font-black tabular-nums ${exitVelocityTone(value)}`}>
          {formatNumber(value, 1)}
        </span>
      </td>
    );
  }

  if (column.key === 'launchAngle') {
    return (
      <td className="px-1 py-1 text-right font-mono text-slate-300 tabular-nums">
        {row.isBarrel && <i className="fa-solid fa-bolt mr-1 text-orange-400" aria-label="Barrel" />}
        {formatNumber(value, 0)}
      </td>
    );
  }

  if (column.key === 'batSpeed' || column.key === 'pitchSpeed') {
    return (
      <td className="px-1 py-1 text-right font-mono text-slate-300 tabular-nums">
        {formatNumber(value, 1)}
      </td>
    );
  }

  if (column.key === 'xba') {
    return (
      <td className="px-1 py-1 text-right font-mono tabular-nums">
        <span className={`rounded px-1 py-0.5 ${xbaTone(value)}`}>{formatXba(value)}</span>
      </td>
    );
  }

  if (column.key === 'hrParks') {
    const count = numberOrNull(row.hrParkCount);
    const clickable = count != null && count > 0;
    return (
      <td className="px-1 py-1 text-right font-mono tabular-nums">
        {clickable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onHrParksClick?.(row);
            }}
            className={`font-bold text-${THEME_COLOR}-200 underline decoration-${THEME_COLOR}-300/70 decoration-dotted underline-offset-2 hover:text-white`}
          >
            {value}
          </button>
        ) : (
          <span className="text-slate-400">{value ?? '—'}</span>
        )}
      </td>
    );
  }

  if (column.key === 'result') {
    return (
      <td className="max-w-[8rem] px-2 py-1 text-left">
        <div className="truncate font-semibold text-slate-100">{value || '—'}</div>
      </td>
    );
  }

  if (column.key === 'inning') {
    return (
      <td className="px-1 py-1 text-right font-mono text-slate-300 tabular-nums">
        {fullInningLabel(row)}
      </td>
    );
  }

  return (
    <td className={`px-1 py-1 font-mono text-slate-300 tabular-nums ${column.align}`}>
      {value ?? '—'}
    </td>
  );
}

function sortValue(row, key) {
  if (key === 'batterName' || key === 'result' || key === 'hrParks') {
    if (key === 'hrParks') return numberOrNull(row.hrParkCount);
    return String(row[key] ?? '').toLowerCase();
  }
  return numberOrNull(row[key]);
}

function compareRows(a, b, sort) {
  const aValue = sortValue(a, sort.key);
  const bValue = sortValue(b, sort.key);

  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;

  const result =
    typeof aValue === 'string' || typeof bValue === 'string'
      ? String(aValue).localeCompare(String(bValue))
      : aValue - bValue;

  return sort.dir === 'asc' ? result : -result;
}

function SortHeader({ column, sort, onSort }) {
  const active = sort.key === column.key;
  const nextDir = active && sort.dir === 'desc' ? 'ascending' : 'descending';

  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={`inline-flex w-full items-center gap-1 ${column.align === 'text-right' ? 'justify-end' : 'justify-start'} rounded px-0.5 py-0.5 transition-colors hover:text-white`}
      aria-label={`Sort by ${column.label} ${nextDir}`}
    >
      <span>{column.label}</span>
      <i
        className={`fa-solid text-[8px] ${
          active
            ? sort.dir === 'asc'
              ? `fa-caret-up text-${THEME_COLOR}-300`
              : `fa-caret-down text-${THEME_COLOR}-300`
            : 'fa-sort text-slate-700'
        }`}
        aria-hidden
      />
    </button>
  );
}

function ParkList({ title, parks, tone }) {
  return (
    <div className="min-w-0">
      <h4 className={`mb-2 font-display text-lg font-black ${tone === 'hr' ? `text-${THEME_COLOR}-200` : 'text-slate-300'}`}>
        {title} - ({parks.length})
      </h4>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Ballpark
        </div>
        <div className="max-h-[42vh] overflow-y-auto">
          {parks.map((park, index) => (
            <div
              key={park.key}
              className={`flex items-center gap-2 px-3 py-2 text-xs ${index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950'}`}
            >
              <img src={teamLogoUrl(park.teamId)} alt="" className="h-6 w-6 flex-shrink-0 object-contain" />
              <span className="font-mono font-bold text-slate-300">{park.abbr}</span>
              <span className="min-w-0 truncate text-slate-200">- {park.park}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HrParkSheet({ open, onClose, selected, loading, error, details }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selected ? `${selected.batterName} - HR / Park` : 'HR / Park'}
      size="lg"
      align="bottom"
      backDismiss
      historyKey="savantHrParkSheet"
      panelClassName="max-h-[88vh] overflow-hidden"
    >
      <div className="gameday-scroll-rail max-h-[calc(88vh-3.5rem)] overflow-y-auto p-4">
        <p className="mb-4 text-xs italic leading-relaxed text-slate-400">
          This shows whether the batted ball would have been a home run in other parks based on Savant&apos;s standard trajectory-to-wall comparison when that per-park detail is available.
        </p>

        {selected && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs sm:grid-cols-4">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-600">Result</div>
              <div className="font-bold text-white">{selected.result}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-600">EV</div>
              <div className="font-mono font-bold text-white">{formatNumber(selected.exitVelocity, 1)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-600">LA</div>
              <div className="font-mono font-bold text-white">{formatNumber(selected.launchAngle, 0)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-600">Distance</div>
              <div className="font-mono font-bold text-white">{formatNumber(selected.distance, 0)} ft</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-400">
            <div className={`h-2 w-2 rounded-full bg-${THEME_COLOR}-400 live-pulse`} />
            Loading park breakdown...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && details && (
          <div className="grid gap-4 md:grid-cols-2">
            <ParkList title="Home Run" parks={details.homeRunParks} tone="hr" />
            <ParkList title="Not a Home Run" parks={details.notHomeRunParks} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function SavantStatcastSection({ gamePk, allPlays = [], onOpenPlay }) {
  const [sort, setSort] = useState({ key: 'exitVelocity', dir: 'desc' });
  const [selectedHrParkRow, setSelectedHrParkRow] = useState(null);
  const [hrParkSheetState, setHrParkSheetState] = useState({ loading: false, error: null, details: null });
  const [state, setState] = useState(() => ({
    loading: !savantGameCache.has(gamePk),
    error: null,
    data: savantGameCache.get(gamePk) ?? null,
  }));

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    setState({
      loading: !savantGameCache.has(gamePk),
      error: null,
      data: savantGameCache.get(gamePk) ?? null,
    });

    fetchSavantGame(gamePk, controller.signal)
      .then((data) => {
        if (alive) setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setState({ loading: false, error: err, data: null });
        }
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [gamePk]);

  const rows = useMemo(() => normalizeSavantRows(state.data), [state.data]);
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sort)),
    [rows, sort],
  );
  const savantUrl = `https://baseballsavant.mlb.com/gf?game_pk=${gamePk}`;
  const handleSort = (key) => {
    setSort((current) => ({
      key,
      dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc',
    }));
  };
  const openAtBat = (row) => {
    const play = allPlays[row.playIndex];
    if (play) onOpenPlay?.(play);
  };
  const openHrParkSheet = async (row) => {
    setSelectedHrParkRow(row);
    setHrParkSheetState({ loading: true, error: null, details: null });
    try {
      const details = await fetchHrParkDetails(row);
      setHrParkSheetState({
        loading: false,
        error: details ? null : 'Savant has the HR/Park count for this batted ball, but the per-park breakdown is not available from the detail endpoint yet.',
        details,
      });
    } catch (err) {
      setHrParkSheetState({
        loading: false,
        error: err?.message || 'Unable to load park breakdown.',
        details: null,
      });
    }
  };
  const closeHrParkSheet = () => {
    setSelectedHrParkRow(null);
    setHrParkSheetState({ loading: false, error: null, details: null });
  };

  return (
    <section className="bg-slate-900 sm:rounded-2xl border-slate-700/60 sm:border overflow-hidden">
     

      {state.loading && (
        <div className="flex items-center justify-center gap-3 px-4 py-12 text-sm text-slate-400">
          <div className={`h-2 w-2 rounded-full bg-${THEME_COLOR}-400 live-pulse`} />
          Loading Statcast metrics...
        </div>
      )}

      {!state.loading && state.error && (
        <div className="px-4 py-10 text-center">
          <div className="text-sm font-bold text-slate-200">Savant data did not load.</div>
          <div className="mt-1 text-xs text-slate-500">{state.error.message}</div>
        </div>
      )}

      {!state.loading && !state.error && rows.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No batted-ball Statcast rows available for this game yet.
        </div>
      )}

      {!state.loading && !state.error && rows.length > 0 && (
        <div className="gameday-scroll-rail max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[720px] table-auto border-collapse text-[11px] sm:text-xs">
            <thead className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {SAVANT_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={[
                      'sticky top-0 z-20 bg-slate-950 px-1 py-2 font-black shadow-[0_1px_0_rgba(30,41,59,0.9)]',
                      column.align,
                      column.sticky
                        ? 'left-0 z-30 w-px whitespace-nowrap px-2 shadow-[10px_0_16px_-14px_rgba(0,0,0,1),0_1px_0_rgba(30,41,59,0.9)]'
                        : '',
                    ].join(' ')}
                  >
                    <SortHeader column={column} sort={sort} onSort={handleSort} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {sortedRows.map((row, index) => {
                const stickyBg = index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950';
                return (
                <tr
                  key={row.id}
                  tabIndex={allPlays[row.playIndex] ? 0 : undefined}
                  onClick={() => openAtBat(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openAtBat(row);
                    }
                  }}
                  className={`group ${stickyBg} cursor-pointer transition-colors hover:bg-slate-800/70 focus:outline-none focus:ring-1 focus:ring-${THEME_COLOR}-400/60`}
                  title="Open At Bat Details"
                >
                  <td className={`sticky left-0 z-10 w-px whitespace-nowrap ${stickyBg} px-2 py-1.5 shadow-[10px_0_16px_-14px_rgba(0,0,0,1)] group-hover:bg-slate-800`}>
                    <div className="flex items-center gap-1.5 text-left">
                      <img src={teamLogoUrl(row.teamId)} alt="" className="h-5 w-5 flex-shrink-0 object-contain" />
                      <img
                        src={playerHeadshotUrl(row.batterId, { width: 80 })}
                        alt=""
                        className={`h-6 w-6 flex-shrink-0 rounded-full border border-${THEME_COLOR}-500/40 bg-slate-800 object-cover`}
                      />
                      <div className="text-[11px] font-bold text-slate-100 group-hover:text-white">
                        {playerShortName(row.batterName)}
                      </div>
                    </div>
                  </td>
                  {SAVANT_COLUMNS.filter((column) => !column.sticky).map((column) => (
                    <SavantStatCell
                      key={column.key}
                      column={column}
                      row={row}
                      onHrParksClick={openHrParkSheet}
                    />
                  ))}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
      <HrParkSheet
        open={Boolean(selectedHrParkRow)}
        onClose={closeHrParkSheet}
        selected={selectedHrParkRow}
        loading={hrParkSheetState.loading}
        error={hrParkSheetState.error}
        details={hrParkSheetState.details}
      />
    </section>
  );
}
