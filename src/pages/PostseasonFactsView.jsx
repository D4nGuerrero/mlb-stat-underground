import { useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SegmentedControl, LoadingSpinner } from '../components/ui';
import TeamLogoImg from '../components/TeamLogoImg';
import { assetUrl } from '../utils/baseUrl.js';
import {
  FACTS_RANGE_OPTIONS,
  buildFactRows,
  factDroughtLeaders,
  factLeaders,
  factsRangeLabel,
  sortFactRows,
} from '../utils/postseasonFacts';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function surfaceClass(isDark) {
  return isDark
    ? 'border-slate-800 bg-slate-900/80'
    : 'border-slate-200 bg-white shadow-sm';
}

function droughtLabel(row) {
  if (row.lastYear == null) return 'No October';
  if (row.drought === 0) return 'This October';
  if (row.drought === 1) return '1 year';
  return `${row.drought} years`;
}

function appearanceCell(count) {
  return count ? count : '—';
}

function LeaderCard({ title, hint, rows, metric, isDark, onOpen, empty }) {
  return (
    <section className={cn('rounded-3xl border px-4 py-4', surfaceClass(isDark))}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={cn(
          'font-display text-sm font-black tracking-tight sm:text-base',
          isDark ? 'text-white' : 'text-slate-900',
        )}
        >
          {title}
        </h3>
        {hint && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{hint}</span>}
      </div>
      {rows.length ? (
        <ol className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <li key={row.teamId}>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex w-full items-center gap-2 rounded-xl px-1 py-0.5 text-left transition-colors hover:bg-slate-800/40"
              >
                <span className="w-4 text-right text-[11px] font-black tabular-nums text-slate-500">
                  {index + 1}
                </span>
                <TeamLogoImg teamId={row.teamId} alt="" className="h-6 w-6 object-contain" />
                <span className={cn(
                  'min-w-0 flex-1 truncate text-sm font-bold',
                  isDark ? 'text-slate-100' : 'text-slate-800',
                )}
                >
                  <span className="sm:hidden">{row.team.abbr}</span>
                  <span className="hidden sm:inline">{row.team.name}</span>
                </span>
                <span className={cn(
                  'font-display text-base font-black tabular-nums',
                  isDark ? 'text-white' : 'text-slate-900',
                )}
                >
                  {metric(row)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

export default function PostseasonFactsView({
  sources,
  loading,
  error,
  range,
  onRangeChange,
  sort,
  dir = 'desc',
  onSortChange,
  onDirChange,
  isDark,
  focusTeamId,
  onOpenYear,
}) {
  const rows = useMemo(
    () => sortFactRows(buildFactRows(sources, range), sort, dir),
    [sources, range, sort, dir],
  );
  const titleLeaders = useMemo(() => factLeaders(rows, 'titles'), [rows]);
  const tripLeaders = useMemo(() => factLeaders(rows, 'wsApps'), [rows]);
  const octoberLeaders = useMemo(() => factLeaders(rows, 'octobers'), [rows]);
  const droughtLeaders = useMemo(() => factDroughtLeaders(rows), [rows]);
  const windowLabel = factsRangeLabel(range);
  const neverWon = rows.filter((row) => row.titles === 0).length;
  const activeSort = sort === 'octobers' ? 'trips' : sort === 'lcs' ? 'cs' : sort;
  const setSort = (key, { reset = false } = {}) => {
    const next = key === 'octobers' ? 'trips' : key === 'lcs' ? 'cs' : key;
    if (!reset && next === activeSort) {
      onDirChange?.(dir === 'asc' ? 'desc' : 'asc');
      return;
    }
    onSortChange?.(next);
    onDirChange?.('desc');
  };
  const openRow = (row) => {
    if (!row.lastYear) return;
    onOpenYear?.(row.lastYear, row.teamId);
  };

  useEffect(() => {
    if (!focusTeamId) return undefined;
    const node = document.getElementById(`facts-team-${focusTeamId}`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return undefined;
  }, [focusTeamId, rows]);

  if (loading && !sources.length) {
    return <LoadingSpinner size="lg" py="py-24" label="Crunching October history…" />;
  }

  if (error && !sources.length) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-900/20 p-8 text-center text-red-300">
        <div className="font-bold">Could not load postseason facts.</div>
        <div className="mt-1 text-sm text-red-200/70">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={range}
        onChange={onRangeChange}
        size="xs"
        variant="compact"
        rounded="full"
        wrap
        optionClassName="!px-2.5"
        options={FACTS_RANGE_OPTIONS}
      />
      <p className="text-xs text-slate-500">
        {windowLabel}. Counts only include Octobers in that window. Last October is the most recent year they actually played.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LeaderCard
          title="World Series titles"
          hint="wins"
          rows={titleLeaders}
          metric={(row) => row.titles}
          isDark={isDark}
          onOpen={() => setSort('titles', { reset: true })}
          empty="No champions in this window."
        />
        <LeaderCard
          title="World Series trips"
          hint="apps"
          rows={tripLeaders}
          metric={(row) => row.wsApps}
          isDark={isDark}
          onOpen={() => setSort('ws', { reset: true })}
          empty="No World Series teams in this window."
        />
        <LeaderCard
          title="Most Octobers"
          hint="years"
          rows={octoberLeaders}
          metric={(row) => row.octobers}
          isDark={isDark}
          onOpen={() => setSort('trips', { reset: true })}
          empty="No postseason clubs in this window."
        />
        <LeaderCard
          title="Longest droughts"
          hint="missed"
          rows={droughtLeaders}
          metric={(row) => droughtLabel(row)}
          isDark={isDark}
          onOpen={() => setSort('drought', { reset: true })}
          empty="Everyone in this window made it recently."
        />
      </div>

      <div className={cn(
        'rounded-2xl border px-4 py-3 text-sm',
        isDark ? 'border-slate-800 bg-slate-900/50 text-slate-300' : 'border-slate-200 bg-white text-slate-600',
      )}
      >
        <span className="font-bold text-amber-300">{neverWon}</span>
        {' '}
        {neverWon === 1 ? 'club has' : 'clubs have'}
        {' '}no World Series title in {windowLabel}.
      </div>

      <div className={cn('overflow-hidden rounded-3xl border', surfaceClass(isDark))}>
        <div className="overflow-x-auto">
          <table className="min-w-[44rem] w-full text-left">
            <thead>
              <tr className={isDark ? 'bg-slate-950/70 text-slate-400' : 'bg-slate-50 text-slate-500'}>
                {[
                  { key: 'last', label: 'Team', align: 'left' },
                  { key: 'last', label: 'Last' },
                  { key: 'last', label: 'Finish' },
                  { key: 'trips', label: 'Trips' },
                  { key: 'ds', label: 'DS' },
                  { key: 'cs', label: 'CS' },
                  { key: 'ws', label: 'WS' },
                  { key: 'titles', label: 'Wins' },
                  { key: 'drought', label: 'Drought' },
                ].map((col, index) => (
                  <th
                    key={`${col.key}-${col.label}-${index}`}
                    className={cn(
                      'px-2 py-2 text-[10px] font-black uppercase tracking-wider',
                      col.align === 'left' ? 'text-left' : 'text-center',
                      index === 0 ? 'sticky left-0 z-10 px-3' : '',
                      index === 0 && (isDark ? 'bg-slate-950/70' : 'bg-slate-50'),
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(col.key)}
                      aria-sort={activeSort === col.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn(
                        'inline-flex items-center gap-0.5 transition-colors',
                        activeSort === col.key ? 'text-amber-300' : 'hover:text-slate-200',
                      )}
                    >
                      {col.label}
                      {activeSort === col.key && (
                        dir === 'asc'
                          ? <ChevronUp size={11} aria-hidden />
                          : <ChevronDown size={11} aria-hidden />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const focused = focusTeamId && Number(focusTeamId) === row.teamId;
                const clickable = Boolean(row.lastYear);
                return (
                  <tr
                    id={`facts-team-${row.teamId}`}
                    key={row.teamId}
                    onClick={() => clickable && openRow(row)}
                    className={cn(
                      'border-t',
                      isDark ? 'border-slate-800' : 'border-slate-100',
                      clickable ? (isDark ? 'cursor-pointer hover:bg-slate-800/50' : 'cursor-pointer hover:bg-slate-50') : '',
                      focused ? (isDark ? 'bg-slate-800/80' : 'bg-amber-50/80') : '',
                    )}
                  >
                    <td className={cn(
                      'sticky left-0 z-10 px-3 py-2',
                      focused
                        ? isDark ? 'bg-slate-800' : 'bg-amber-50'
                        : isDark ? 'bg-slate-900' : 'bg-white',
                    )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <TeamLogoImg teamId={row.teamId} alt="" className="h-6 w-6 object-contain" />
                        <span className={cn(
                          'truncate text-sm font-bold',
                          isDark ? 'text-white' : 'text-slate-900',
                        )}
                        >
                          <span className="sm:hidden">{row.team.abbr}</span>
                          <span className="hidden sm:inline">{row.team.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center font-display text-sm font-black tabular-nums">
                      {row.lastYear ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-center text-xs font-bold text-slate-400">
                      <span className="inline-flex items-center justify-center gap-1">
                        {row.wonLastWs && (
                          <img src={assetUrl('icons/world-series-trophy.png')} alt="" className="h-3.5 w-3.5 object-contain" />
                        )}
                        {row.lastLabel ?? '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center font-display text-sm font-black tabular-nums">{appearanceCell(row.octobers)}</td>
                    <td className="px-2 py-2 text-center font-display text-sm font-black tabular-nums">{appearanceCell(row.dsApps)}</td>
                    <td className="px-2 py-2 text-center font-display text-sm font-black tabular-nums">{appearanceCell(row.lcsApps)}</td>
                    <td className="px-2 py-2 text-center font-display text-sm font-black tabular-nums">{appearanceCell(row.wsApps)}</td>
                    <td className="px-2 py-2 text-center font-display text-sm font-black tabular-nums">{appearanceCell(row.titles)}</td>
                    <td className="px-2 py-2 text-center text-xs font-bold text-slate-400">{droughtLabel(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
