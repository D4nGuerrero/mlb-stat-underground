import { useState, useEffect, useCallback, Fragment } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { playerHeadshotUrl, teamLogoUrl, playerHeroShotUrl, getTeamAbbr } from '../utils/mlbHelpers';
import TeamAbbrCell from '../components/TeamAbbrCell';
import { buildSeasonHonors, getActiveHonorBadges } from '../utils/seasonHonors';
import { fetchPlayerSplitSections, SPLIT_DISPLAY_COLS } from '../utils/playerSplits';
import { computeCareerTotalsRow } from '../utils/careerTotals';
import SeasonYearLabel from '../components/SeasonYearLabel';
import { SegmentedControl, Select, TabBar, stickyHead, stickyCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT } from '../components/ui';
import { TABLE_TEXT_CLASS } from '../theme/tableTheme';

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

const MINOR_SPORT_IDS = [11, 12, 13, 14,16];
const MINOR_SPORT_ID_SET = new Set(MINOR_SPORT_IDS);

const LOWER_IS_BETTER = new Set(['era', 'whip', 'losses', 'errors']);

const HERO_TEXT_SHADOW = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' };

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
  { key: 'inningsPitched', label: 'IP' },

  { key: 'era', label: 'ERA' },
  { key: 'whip', label: 'WHIP' },
  { key: 'strikeOuts', label: 'K' },
  { key: 'baseOnBalls', label: 'BB' },

  { key: 'hits', label: 'H' },
  { key: 'runs', label: 'R' },
  { key: 'earnedRuns', label: 'ER' },
  { key: 'saves', label: 'SV' },

  { key: 'homeRuns', label: 'HR' },
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

function formatBornWithAge(playerInfo) {
  if (!playerInfo?.birthDate) return '—';
  const formatted = new Date(playerInfo.birthDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (playerInfo.currentAge != null) {
    return `${formatted} (${playerInfo.currentAge})`;
  }
  const born = new Date(playerInfo.birthDate);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return `${formatted} (${age})`;
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

function formatCell(value, format, row) {
  if (format === 'date' && row.date) {
    return new Date(row.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (format === 'team') {
    return <TeamAbbrCell team={row.team} size="xs" abbrClassName="text-[10px] font-medium" nameClassName="text-xs font-medium" />;
  }
  if (format === 'opponent') {
    const abbr = getTeamAbbr(row.opponent);
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

  console.log('AVER', responses);
  

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
  hidePeriod = false,
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center mb-5 mt-3">
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
      {!hidePeriod && period !== undefined && onPeriodChange && (
        <Select value={period} onChange={onPeriodChange} options={PERIOD_OPTIONS} className="w-52" />
      )}
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
  footerRow = null,
}) {
  if (!rows?.length && !footerRow) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  const careerHighs = highlightCareerHighs ? computeCareerHighs(rows, cols) : null;

  const renderRow = (row, i, { isFooter = false } = {}) => (
    <tr
      key={row.id ?? i}
      className={[
        'group border-b border-slate-800/60',
        isFooter ? 'border-t border-slate-600 font-bold text-slate-100 bg-slate-800/30' : 'hover:bg-slate-800/20',
      ].join(' ')}
    >
      <td className={`${stickyCell('bg-[#121827]', { footer: isFooter })} font-semibold text-slate-200`}>
        {row.label}
      </td>
      {cols.map((c) => {
        const value = row[c.key] ?? row.stat?.[c.key];
        const isHigh = !isFooter && careerHighs && isCareerHigh(c.key, value, careerHighs);
        return (
          <td
            key={c.key}
            className={[
              statCell(isHigh ? `font-bold text-${THEME_COLOR}-500` : isFooter ? 'text-slate-100' : ''),
            ].join(' ')}
          >
            {formatCell(value, c.format, row)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className={`${TABLE_SCROLL} -mx-1`}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/60">
            <th className={`${stickyHead('bg-[#121827]')} font-normal`}>
              {labelKey === 'season' ? 'Year' : 'Split'}
            </th>
            {cols.map((c) => (
              <th key={c.key} className={statHead('text-center font-normal')}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => renderRow(row, i))}
          {footerRow && renderRow(footerRow, 'footer', { isFooter: true })}
        </tbody>
      </table>
    </div>
  );
}

function SplitColumnHeaders({ as = 'th', splitLabel = 'Split', className = '' }) {
  const Cell = as;
  return (
    <tr className={`text-slate-500 border-b border-slate-700/60 ${className}`}>
      <Cell className={`${stickyHead('bg-[#121827]')} z-20 font-normal`}>
        {splitLabel}
      </Cell>
      {SPLIT_DISPLAY_COLS.map((c) => (
        <Cell key={c.key} className={`${statHead('text-center font-normal bg-[#121827]')}`}>
          {c.label}
        </Cell>
      ))}
    </tr>
  );
}

function SplitsTable({ sections, emptyMessage = 'No splits available' }) {
  const hasRows = sections?.some((s) => s.rows?.length);
  if (!hasRows) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  return (
    <div className="max-h-[70vh] overflow-auto -mx-1 rounded-xl border border-slate-800/60">
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
        <thead className="sticky top-0 z-30 bg-[#121827] shadow-[0_1px_0_0_rgba(51,65,85,0.6)]">
          <SplitColumnHeaders className="text-slate-400" />
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-slate-800/50">
                <td
                  colSpan={SPLIT_DISPLAY_COLS.length + 1}
                  className="py-2 px-3 text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-800/95 border-y border-slate-700/50"
                >
                  {section.title}
                </td>
              </tr>
              <SplitColumnHeaders as="td" splitLabel="" className="text-[10px] text-slate-600" />
              {section.rows.map((row, i) => (
                <tr key={row.id ?? `${section.title}-${i}`} className="group border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className={`${stickyCell('bg-[#121827]')} z-[1] text-slate-200`}>
                    {row.label}
                  </td>
                  {SPLIT_DISPLAY_COLS.map((c) => (
                    <td key={c.key} className={statCell()}>
                      {formatCell(row[c.key] ?? row.stat?.[c.key], c.format, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerTransactionsTab({ playerId }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    (async () => {
      try {
        const today = new Date();
        const start = new Date(today);
        start.setFullYear(today.getFullYear() - 5);
        const fmt = (d) => {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${m}/${day}/${d.getFullYear()}`;
        };
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/transactions?playerId=${playerId}&startDate=${fmt(start)}&endDate=${fmt(today)}&sportId=1`,
        );
        const json = await res.json();
        const sorted = [...(json.transactions ?? [])].sort(
          (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0),
        );
        setTxns(sorted);
      } catch {
        setTxns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className={`w-6 h-6 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
      </div>
    );
  }

  if (!txns.length) {
    return <div className="text-slate-500 text-sm text-center py-12">No transactions found.</div>;
  }

  return (
    <div className="space-y-1">
      {txns.map((t, i) => (
        <div
          key={t.id ?? `${t.date}-${i}`}
          className="flex items-start gap-3 px-1 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors rounded-xl"
        >
          <div className="w-24 text-xs text-slate-500 flex-shrink-0 pt-0.5 tabular-nums">{fmtDate(t.date)}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200">{t.typeDesc ?? t.description ?? '—'}</div>
            {t.fromTeam?.name && t.toTeam?.name && (
              <div className="text-xs text-slate-500 mt-0.5">
                {t.fromTeam.name} → {t.toTeam.name}
              </div>
            )}
            {t.description && t.typeDesc && t.description !== t.typeDesc && (
              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function GameLogTable({ cols, rows, emptyMessage = 'No game logs available' }) {
  if (!rows?.length) {
    return <div className="text-slate-500 text-sm text-center py-8">{emptyMessage}</div>;
  }

  return (
    <div className="max-h-[70vh] overflow-auto -mx-1 rounded-xl border border-slate-800/60">
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
        <thead className="sticky top-0 z-10 bg-[#121827] shadow-[0_1px_0_0_rgba(51,65,85,0.6)]">
          <tr className="text-slate-500 border-b border-slate-700/60">
            {cols.map((c, i) => (
              <th
                key={c.key}
                className={[
                  'font-normal whitespace-nowrap bg-[#121827]',
                  i === 0 ? `${stickyHead('bg-[#121827]')} z-20` : statHead('text-center'),
                ].join(' ')}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="group border-b border-slate-800/60 hover:bg-slate-800/20">
              {cols.map((c, j) => {
                const value = row[c.key] ?? row.stat?.[c.key];
                return (
                  <td
                    key={c.key}
                    className={[
                      j === 0 ? `${stickyCell('bg-[#121827]')} z-[1] font-semibold text-slate-200` : statCell(),
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

  const [logSeason, setLogSeason] = useState(CURRENT_YEAR);
  const [gameLogRows, setGameLogRows] = useState([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);

  const [splitLevel, setSplitLevel] = useState('mlb');
  const [splitSeason, setSplitSeason] = useState(CURRENT_YEAR);
  const [splitSections, setSplitSections] = useState([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('career');

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
    const meta = getPeriodMeta('regular');
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
  }, [playerId, logLevel, logGroup, logSeason]);

  const loadSplits = useCallback(async () => {
    if (!playerId || isPitcher) {
      setSplitSections([]);
      return;
    }
    setSplitLoading(true);
    try {
      const sections = await fetchPlayerSplitSections(playerId, splitSeason, splitLevel);
      setSplitSections(sections);
    } catch {
      setSplitSections([]);
    } finally {
      setSplitLoading(false);
    }
  }, [playerId, splitLevel, splitSeason, isPitcher]);

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

  const careerTotalsRow = computeCareerTotalsRow(careerRows, statGroup);

  const PLAYER_TABS = [
    { key: 'career', label: 'Career' },
    { key: 'gamelogs', label: 'Game Logs' },
    { key: 'splits', label: 'Splits' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'bvp', label: 'Batter vs. Pitcher' },
  ];

  return (
    <div className="max-w-4xl mx-auto  sm:px-6  sm:py-8">
 
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className={`w-8 h-8 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
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
        <div className="  -mb-6 -ml-6">
  {/* BACKGROUND LOGO */}
 <img
  src={teamLogoUrl(playerInfo.currentTeam.id)}
  className="absolute top-10 left-20 w-72 h-72 -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
  alt=""
/>

  {/* PLAYER IMG */}
  <img
    src={playerHeadshotUrl(playerId)}
    className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover shadow-lg"
    alt={playerInfo.fullName}
  />

 
</div>
              <div className="relative z-20 pb-1 min-w-0 ">
                {/* Player NAM POSITION TEAMNAME */}
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
                  className={`text-[11px] text-${THEME_COLOR}-300 font-semibold uppercase tracking-widest truncate`}
                  style={HERO_TEXT_SHADOW}
                >
                  {playerInfo.currentTeam?.id ? (
                    <Link
                      to={`/team/${playerInfo.currentTeam.id}`}
                      className="hover:text-white transition-colors"
                    >
                      {playerInfo.currentTeam.name}
                    </Link>
                  ) : (
                    playerInfo.currentTeam?.name || '—'
                  )}
                  {playerInfo.primaryNumber ? ` · #${playerInfo.primaryNumber}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Bats / Throws', value: `${playerInfo.batSide?.code || '—'} / ${playerInfo.pitchHand?.code || '—'}` },
              { label: 'Height / Weight', value: `${playerInfo.height || '—'} / ${playerInfo.weight ? `${playerInfo.weight} lb` : '—'}` },
              { label: 'Born', value: formatBornWithAge(playerInfo) },
              { label: 'Birthplace', value: [playerInfo.birthCity, playerInfo.birthStateProvince, playerInfo.birthCountry].filter(Boolean).join(', ') || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-sm font-semibold text-slate-200">{value}</div>
              </div>
            ))}
          </div>

          <div className="px-5 sm:px-8 py-5 sm:py-6">
            <TabBar variant="page" tabs={PLAYER_TABS} activeKey={activeTab} onChange={setActiveTab}>
              {(key) => {
                if (key === 'career') {
                  return (
                    <>
                      <div className="flex flex-wrap gap-3 items-center mb-5 pt-3">
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
                        footerRow={careerTotalsRow}
                        emptyMessage="No career stats available for this selection."
                      />
                    </>
                  );
                }
                if (key === 'gamelogs') {
                  return (
                    <>
                      <FilterBar
                        level={logLevel}
                        onLevelChange={setLogLevel}
                        season={logSeason}
                        onSeasonChange={setLogSeason}
                        group={logGroup}
                        onGroupChange={setLogGroup}
                        hidePeriod
                      />
                      {gameLogLoading ? (
                        <div className="flex justify-center py-12">
                          <div className={`w-6 h-6 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
                        </div>
                      ) : (
                        <GameLogTable
                          cols={gameLogCols}
                          rows={gameLogRows}
                          emptyMessage={`No game logs for ${logSeason} regular season.`}
                        />
                      )}
                    </>
                  );
                }
                if (key === 'splits') {
                  return (
                    <>
                      <FilterBar
                        level={splitLevel}
                        onLevelChange={setSplitLevel}
                        season={splitSeason}
                        onSeasonChange={setSplitSeason}
                        hidePeriod
                      />
                      {isPitcher ? (
                        <div className="text-slate-500 text-sm text-center py-12">
                          Splits breakdown is available for hitters only.
                        </div>
                      ) : splitLoading ? (
                        <div className="flex justify-center py-12">
                          <div className={`w-6 h-6 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
                        </div>
                      ) : (
                        <SplitsTable
                          sections={splitSections}
                          emptyMessage={`No splits for ${splitSeason} regular season.`}
                        />
                      )}
                    </>
                  );
                }
                if (key === 'transactions') {
                  return <PlayerTransactionsTab playerId={playerId} />;
                }
                return (
                  <div className="text-slate-500 text-sm text-center py-12 border border-dashed border-slate-700 rounded-2xl">
                    Batter vs. Pitcher matchup data coming soon.
                  </div>
                );
              }}
            </TabBar>
          </div>
        </div>
      )}
    </div>
  );
}