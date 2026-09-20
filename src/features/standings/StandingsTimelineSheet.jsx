import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, BaseballSpinner, stickyTeamHead, stickyTeamCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT_STANDINGS } from '../../components/ui';
import TeamAbbrCell from '../../components/TeamAbbrCell';
import { TABLE_TEXT_CLASS, TABLE_TEAM_COL_CLASS } from '../../theme/tableTheme';
import {
  addDaysIso,
  clampIsoDate,
  computeWindowStandings,
  fetchSeasonDateBounds,
  fetchStandingsSnapshot,
  formatGamesBack,
  formatSliderDateLong,
  parseStandings,
  sortDivisions,
} from '../../utils/standings';
import LeagueTitle from './LeagueTitle';
import StandingsDateSlider from './StandingsDateSlider';

const TIMELINE_COLUMNS = [
  { key: 'wins', label: 'W' },
  { key: 'losses', label: 'L' },
  { key: 'pct', label: 'PCT' },
  { key: 'gb', label: 'GB' },
  { key: 'runsScored', label: 'RS' },
  { key: 'runsAllowed', label: 'RA' },
  { key: 'runDiff', label: 'DIFF' },
];

function groupDivisions(parsed) {
  const divs = sortDivisions(parsed?.divisions ?? []);
  const leagueGroups = Object.values(divs.reduce((acc, div) => {
    const key = div.leagueId ?? div.leagueLabel;
    if (!acc[key]) acc[key] = { name: div.leagueLabel, divisions: [] };
    acc[key].divisions.push(div);
    return acc;
  }, {}));
  return leagueGroups;
}

export default function StandingsTimelineSheet({
  open,
  onClose,
  season,
  leagueLevel,
  leagueParams,
  leagueShortLabel = 'MLB',
}) {
  const navigate = useNavigate();
  const cacheRef = useRef({});
  const [bounds, setBounds] = useState(null);
  const [fromIso, setFromIso] = useState(null);
  const [toIso, setToIso] = useState(null);
  const [committed, setCommitted] = useState({ from: null, to: null });
  const [parsed, setParsed] = useState(null);
  const [windowed, setWindowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    fetchSeasonDateBounds({ season, leagueLevel, signal: controller.signal })
      .then((nextBounds) => {
        setBounds(nextBounds);
        setFromIso(nextBounds.start);
        setToIso(nextBounds.end);
        setCommitted({ from: nextBounds.start, to: nextBounds.end });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err.message || 'Failed to load season dates');
      });
    return () => controller.abort();
  }, [open, season, leagueLevel]);

  useEffect(() => {
    if (!fromIso || !toIso) return undefined;
    const handle = window.setTimeout(() => {
      setCommitted((current) => (
        current.from === fromIso && current.to === toIso ? current : { from: fromIso, to: toIso }
      ));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [fromIso, toIso]);

  const loadSnapshot = useCallback(async (dateIso, signal) => {
    const key = `${leagueLevel}:${season}:${dateIso}`;
    if (cacheRef.current[key]) return cacheRef.current[key];
    const data = await fetchStandingsSnapshot({
      season,
      dateIso,
      leagueParams,
      signal,
    });
    const next = parseStandings(data?.records);
    cacheRef.current[key] = next;
    return next;
  }, [leagueLevel, leagueParams, season]);

  useEffect(() => {
    if (!open || !committed.from || !committed.to || !bounds) return undefined;
    const controller = new AbortController();
    const fromAtStart = committed.from === bounds.start;
    setLoading(true);
    setError(null);

    const run = async () => {
      const endParsed = await loadSnapshot(committed.to, controller.signal);
      if (fromAtStart) {
        setParsed(endParsed);
        setWindowed(false);
        return;
      }
      const dayBeforeFrom = addDaysIso(committed.from, -1);
      const startDate = !dayBeforeFrom || dayBeforeFrom < bounds.start ? null : dayBeforeFrom;
      const startParsed = startDate
        ? await loadSnapshot(startDate, controller.signal)
        : { divisions: [], wildCardGroups: [] };
      setParsed(computeWindowStandings(endParsed, startParsed));
      setWindowed(true);
    };

    run()
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err.message || 'Failed to load standings for that date');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [bounds, committed.from, committed.to, loadSnapshot, open]);

  const groups = useMemo(() => groupDivisions(parsed), [parsed]);

  const onSliderChange = (nextFrom, nextTo) => {
    if (!bounds) return;
    const from = clampIsoDate(nextFrom, bounds.start, bounds.end);
    const to = clampIsoDate(nextTo, from, bounds.end);
    setFromIso(from);
    setToIso(to);
  };

  const renderTable = (title, teams) => (
    <div key={title} className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900">
      <div className="border-b border-slate-800/80 px-4 py-2.5 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-200 sm:text-base">
          <LeagueTitle title={title} />
        </h2>
      </div>
      <div className={TABLE_SCROLL}>
        <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT_STANDINGS}`}>
          <colgroup>
            <col className={TABLE_TEAM_COL_CLASS} />
            {TIMELINE_COLUMNS.map((col) => (
              <col key={col.key} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-500">
              <th className={`${stickyTeamHead('bg-slate-900', { shadow: false })} font-semibold text-slate-500`}>
                Team
              </th>
              {TIMELINE_COLUMNS.map((col) => (
                <th key={col.key} className={statHead('text-slate-500')}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <tr
                key={team.teamId}
                className={[
                  'group border-b border-slate-800/30 last:border-b-0 transition-colors hover:bg-slate-800/25',
                  index === 0 ? 'bg-accent-500/[0.05]' : '',
                ].join(' ')}
              >
                <td className={stickyTeamCell('bg-slate-900', { shadow: false })}>
                  <button
                    type="button"
                    className="text-left transition-opacity hover:opacity-90"
                    onClick={() => {
                      const seasonQuery = season && season !== String(new Date().getFullYear())
                        ? `?season=${season}`
                        : '';
                      onClose?.();
                      navigate(`/team/${team.teamId}${seasonQuery}`);
                    }}
                  >
                    <TeamAbbrCell
                      team={team.team}
                      teamId={team.teamId}
                      teamName={team.teamName}
                      hidePlaceholderAbbr={leagueLevel !== 'mlb'}
                      size="lg"
                      abbrClassName="text-[11px] font-semibold"
                      nameClassName="text-sm font-semibold"
                    />
                  </button>
                </td>
                {TIMELINE_COLUMNS.map((col) => (
                  <td key={col.key} className={statCell('text-slate-300')}>
                    {col.key === 'gb' && formatGamesBack(team.gb)}
                    {col.key === 'wins' && <span className="font-semibold text-slate-100">{team.wins}</span>}
                    {col.key === 'losses' && <span className="text-slate-400">{team.losses}</span>}
                    {col.key === 'pct' && team.pct}
                    {col.key === 'runsScored' && (team.runsScored ?? '—')}
                    {col.key === 'runsAllowed' && (team.runsAllowed ?? '—')}
                    {col.key === 'runDiff' && (
                      <span className={team.runDiff > 0 ? 'text-emerald-400' : team.runDiff < 0 ? 'text-red-400' : 'text-slate-500'}>
                        {team.runDiff > 0 ? `+${team.runDiff}` : team.runDiff}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      backDismiss
      historyKey="standingsTimeline"
      size="2xl"
      align="bottom"
      panelClassName="flex max-h-[92vh] flex-col bg-[radial-gradient(circle_at_top_left,rgba(30,64,175,0.16),transparent_42%),linear-gradient(180deg,#101827,#07101d)]"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-slate-600" />
      </div>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-2 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-accent-400">
            {leagueShortLabel} Timeline
          </div>
          <div className="font-display text-2xl tracking-tight text-white sm:text-3xl">
            Standings by date
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {windowed
              ? `Records from ${formatSliderDateLong(committed.from)} through ${formatSliderDateLong(committed.to)}.`
              : `Standings as of ${formatSliderDateLong(committed.to)}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          aria-label="Close standings timeline"
        >
          <i className="fa-solid fa-xmark text-lg" aria-hidden />
        </button>
      </div>

      <div className="border-y border-slate-800/80 bg-slate-950/40 px-4 py-4 sm:px-6">
        {bounds ? (
          <StandingsDateSlider
            startIso={bounds.start}
            endIso={bounds.end}
            fromIso={fromIso ?? bounds.start}
            toIso={toIso ?? bounds.end}
            onChange={onSliderChange}
          />
        ) : (
          <div className="flex justify-center py-4">
            <BaseballSpinner size="sm" label="Loading season dates…" />
          </div>
        )}
      </div>

      <div className="gameday-scroll-rail min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {loading && (
          <div className="flex justify-center py-16">
            <BaseballSpinner size="lg" label="Loading standings…" />
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-900/20 p-5 text-center text-red-400">
            {error}
          </div>
        )}
        {!loading && !error && groups.map((group) => (
          <div key={group.name} className="mb-5 space-y-4 last:mb-0">
            <div className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <LeagueTitle title={group.name} />
            </div>
            {group.divisions.map((div) => renderTable(
              div.name,
              [...div.teams].sort((a, b) => a.divisionRank - b.divisionRank),
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
