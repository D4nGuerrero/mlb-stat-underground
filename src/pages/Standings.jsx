import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import TeamAbbrCell from '../components/TeamAbbrCell';
import { TabBar, Select, SegmentedControl, BaseballSpinner, stickyTeamHead, stickyTeamCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE } from '../components/ui';
import { LeagueLevelPicker } from '../components/LeagueLevelPicker';
import { LEAGUE_LEVEL_BY_VALUE, LEAGUE_LEVEL_STORAGE_KEY, LEAGUE_LEVEL_VALUES } from '../constants/leagueLevels.js';
import { TABLE_TEXT_CLASS } from '../theme/tableTheme';
import { fetchStatsApiJson } from '../lib/mlb/client';
import { useLocalStorageState } from '../hooks/useStorageState';
import LeagueTitle from '../features/standings/LeagueTitle';
import StandingsColumnSettings from '../features/standings/StandingsColumnSettings';
import {
  DEFAULT_STANDINGS_COLUMN_PREFS,
  EXPANDED_COLUMNS,
  STANDINGS_COLUMN_STORAGE_KEY,
  VS_DIVISION_COLUMNS,
  WILDCARD_COLUMNS,
  glossaryForColumns,
  resolveStandingsColumns,
} from '../features/standings/standingsColumns';
import {
  CLINCH_LABELS,
  formatElimNumber,
  formatGamesBack,
  leagueKeyFromName,
  parseGamesBack,
  parseSortValue,
  parseStandings,
  sortDivisions,
  wildCardCutoffIndex,
  withGamesBackFromGroupLeader,
} from '../utils/standings';
import StandingsTimelineSheet from '../features/standings/StandingsTimelineSheet';

const CURRENT_YEAR = new Date().getFullYear();
const SEASON_OPTIONS = Array.from({ length: CURRENT_YEAR - 2003 + 1 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: String(y), label: String(y) };
}).filter((o) => Number(o.value) >= 2003);

const STANDINGS_TABS = [
  { key: 'standings', label: 'Standings' },
  { key: 'wildcard', label: 'Wild Card' },
  { key: 'expanded', label: 'Expanded' },
  { key: 'vsdivision', label: 'Vs. Division' },
];

const VIEW_SCOPE_OPTIONS = [
  { value: 'division', label: 'Division' },
  { value: 'league', label: 'League' },
  { value: 'overall', label: 'Overall' },
];

const STANDINGS_TYPE_BY_TAB = {
  standings: 'regularSeason',
  wildcard: 'wildCard',
  expanded: 'regularSeason',
  vsdivision: 'regularSeason',
};

const DEFAULT_SORT = {
  standings: { division: 'divisionRank', league: 'leagueRank', overall: 'sportRank' },
  expanded: { division: 'divisionRank', league: 'leagueRank', overall: 'sportRank' },
  vsdivision: { division: 'divisionRank', league: 'leagueRank', overall: 'sportRank' },
  wildcard: 'wcGb',
};

const STANDINGS_TEAM_COL = 'w-[38%] sm:w-[28%]';
const STANDINGS_TEAM_COL_SCROLL = 'w-[8.75rem] min-w-[8.75rem] sm:w-[10.5rem] sm:min-w-[10.5rem]';
const WIDE_STAT_KEYS = new Set(['home', 'away', 'oneRun', 'extraInning', 'lastTen', 'wcGb']);

const loadStandingsLeague = () => {
  try {
    const saved = localStorage.getItem(LEAGUE_LEVEL_STORAGE_KEY);
    return LEAGUE_LEVEL_VALUES.has(saved) ? saved : 'mlb';
  } catch {
    return 'mlb';
  }
};

export default function Standings() {
  const navigate = useNavigate();
  const cache = useRef({});
  const [season, setSeason] = useState(() => String(CURRENT_YEAR));
  const [standingsData, setStandingsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('standings');
  const [viewScope, setViewScope] = useState('division');
  const [sortCol, setSortCol] = useState('divisionRank');
  const [sortDir, setSortDir] = useState('asc');
  const [standingsLeague, setStandingsLeague] = useState(loadStandingsLeague);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [columnPrefs, setColumnPrefs] = useLocalStorageState(
    STANDINGS_COLUMN_STORAGE_KEY,
    DEFAULT_STANDINGS_COLUMN_PREFS,
  );

  const standingsType = STANDINGS_TYPE_BY_TAB[activeTab] ?? 'regularSeason';
  const selectedLeague = LEAGUE_LEVEL_BY_VALUE[standingsLeague] ?? LEAGUE_LEVEL_BY_VALUE.mlb;
  const leagueParams = useMemo(
    () => Object.fromEntries(new URLSearchParams(selectedLeague.standingsQuery)),
    [selectedLeague.standingsQuery],
  );

  useEffect(() => {
    const key = `${standingsLeague}:${season}:${standingsType}`;
    if (cache.current[key]) {
      setStandingsData(cache.current[key]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchStatsApiJson('/api/v1/standings', {
      query: {
        ...leagueParams,
        season,
        standingsTypes: standingsType,
        hydrate: 'team(division,league),records(divisionRecords,splitRecords,leagueRecords)',
      },
      ttl: 60_000,
      retries: 1,
      signal: controller.signal,
    })
      .then((data) => {
        cache.current[key] = data;
        setStandingsData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [season, standingsType, standingsLeague, leagueParams]);

  useEffect(() => {
    localStorage.setItem(LEAGUE_LEVEL_STORAGE_KEY, standingsLeague);
  }, [standingsLeague]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== LEAGUE_LEVEL_STORAGE_KEY) return;
      if (LEAGUE_LEVEL_VALUES.has(event.newValue)) setStandingsLeague(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const parsed = useMemo(
    () => (standingsData?.records ? parseStandings(standingsData.records) : null),
    [standingsData],
  );

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(['pct', 'wins', 'runsScored', 'runDiff'].includes(col) ? 'desc' : 'asc');
    }
  };

  const compareWcGb = (a, b) => {
    const cmp = parseGamesBack(a.wcGb) - parseGamesBack(b.wcGb);
    if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
    const ar = a.wildCardRank ?? 99;
    const br = b.wildCardRank ?? 99;
    return sortDir === 'asc' ? ar - br : br - ar;
  };

  const sortTeams = (teams) => {
    return [...teams].sort((a, b) => {
      if (activeTab === 'wildcard' && sortCol === 'wcGb') return compareWcGb(a, b);
      const av = parseSortValue(sortCol, a[sortCol]);
      const bv = parseSortValue(sortCol, b[sortCol]);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  };

  const getGroupedData = () => {
    if (!parsed) return null;
    const { divisions, wildCardGroups } = parsed;

    if (activeTab === 'wildcard') {
      return {
        layout: 'league-groups',
        groups: wildCardGroups.map((group) => ({ ...group, teams: sortTeams(group.teams) })),
      };
    }

    const divs = sortDivisions(divisions).map((d) => ({ ...d, teams: sortTeams(d.teams) }));
    const leagueGroups = Object.values(divs.reduce((acc, div) => {
      const key = div.leagueId ?? div.leagueLabel;
      if (!acc[key]) acc[key] = { name: div.leagueLabel, teams: [], divisions: [] };
      acc[key].teams.push(...div.teams);
      acc[key].divisions.push(div);
      return acc;
    }, {})).map((group) => ({
      ...group,
      teams: sortTeams(withGamesBackFromGroupLeader(group.teams, 'leagueRank')),
    }));

    if (viewScope === 'league') {
      return {
        layout: 'league-groups',
        groups: leagueGroups,
      };
    }

    if (viewScope === 'overall') {
      const overallTeams = withGamesBackFromGroupLeader(divs.flatMap((d) => d.teams), 'sportRank');
      return {
        layout: 'single',
        title: `${selectedLeague.shortLabel} Overall`,
        teams: sortTeams(overallTeams),
      };
    }

    return {
      layout: 'divisions',
      groups: leagueGroups,
    };
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'wildcard') {
      setSortCol(DEFAULT_SORT.wildcard);
      setSortDir('asc'); // wcGb asc: +ahead, —, then games behind
      return;
    }
    const scope = viewScope;
    setSortCol(DEFAULT_SORT[key]?.[scope] ?? 'divisionRank');
    setSortDir('asc');
  };

  const handleViewScopeChange = (scope) => {
    setViewScope(scope);
    if (activeTab === 'wildcard') return;
    setSortCol(DEFAULT_SORT[activeTab]?.[scope] ?? 'divisionRank');
    setSortDir('asc');
  };

  const StreakBadge = ({ streak }) => {
    if (!streak || streak === '-') return <span className="text-slate-600">—</span>;
    const isWin = streak.startsWith('W');
    return (
      <span className={`font-mono ${isWin ? `text-emerald-400` : 'text-red-400'}`}>
        {streak}
      </span>
    );
  };

  const RunDiffBadge = ({ diff }) => {
    if (diff === 0) return <span className="text-slate-500">0</span>;
    return (
      <span className={diff > 0 ? `text-emerald-400` : 'text-red-400'}>
        {diff > 0 ? `+${diff}` : diff}
      </span>
    );
  };

  const SortTh = ({ col, label, className = '' }) => {
    const active = sortCol === col;
    return (
      <th
        className={`${statHead(`cursor-pointer select-none bg-[#0b1220] uppercase tracking-wider transition-colors ${active ? 'text-accent-400' : 'text-slate-400 hover:text-slate-200'}`, { align: 'text-center' })} ${className}`}
        onClick={() => handleSort(col)}
      >
        {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </th>
    );
  };

  const renderTeamCell = (team, { rowBg = 'bg-slate-900', teamColClass = STANDINGS_TEAM_COL, stickyShadow = false, className = '' } = {}) => (
    <td className={`${stickyTeamCell(rowBg, { shadow: stickyShadow, widthClass: teamColClass })} border-r border-slate-700/70 !px-3 sm:!px-4 ${className}`}>
      <button
        type="button"
        className="text-left hover:opacity-90 transition-opacity"
        onClick={() => {
          const seasonQuery = season && season !== String(CURRENT_YEAR) ? `?season=${season}` : '';
          navigate(`/team/${team.teamId}${seasonQuery}`);
        }}
      >
        <span className="inline-flex items-center gap-1 min-w-0">
          {team.clinchIndicator && (
            <span
              className="flex-shrink-0 text-[11px] font-bold text-accent-400 sm:text-xs"
              title={CLINCH_LABELS[team.clinchIndicator] ?? 'Clinched'}
            >
              {team.clinchIndicator}-
            </span>
          )}
          <TeamAbbrCell
            team={team.team}
            teamId={team.teamId}
            teamName={team.teamName}
            hidePlaceholderAbbr={selectedLeague.value !== 'mlb'}
            size="xl"
            abbrClassName="text-[13px] font-bold text-white"
            nameClassName="text-sm font-semibold text-white"
          />
        </span>
      </button>
    </td>
  );

  const renderCell = (team, col) => {
    switch (col.key) {
      case 'gb':
      case 'wcGb':
        return formatGamesBack(team[col.key]);
      case 'elimNumber':
      case 'wcElimNumber': {
        const label = formatElimNumber(col.key === 'wcElimNumber' ? team.wcElimNumber : team.elimNumber);
        return label === 'E' ? <span className="text-slate-500">E</span> : label;
      }
      case 'streak':
        return <StreakBadge streak={team.streak} />;
      case 'runDiff':
        return <RunDiffBadge diff={team.runDiff} />;
      case 'runsScored':
      case 'runsAllowed':
        return team[col.key] ?? '—';
      case 'wins':
        return <span className="font-semibold text-white">{team.wins}</span>;
      case 'losses':
        return <span className="text-slate-300">{team.losses}</span>;
      case 'pct':
        return <span className="text-slate-200">{team.pct}</span>;
      default:
        return team[col.key] ?? '—';
    }
  };

  const standingsColumns = useMemo(() => resolveStandingsColumns(columnPrefs), [columnPrefs]);
  const COLUMN_SETS = {
    standings: standingsColumns,
    wildcard: WILDCARD_COLUMNS,
    expanded: EXPANDED_COLUMNS,
    vsdivision: VS_DIVISION_COLUMNS,
  };

  const divisionColumnLabel = (div) => {
    const league = leagueKeyFromName(div.leagueLabel);
    const short = String(div.name || '').toUpperCase();
    if (league && /EAST|CENTRAL|WEST/.test(short)) return `${league} ${short}`;
    return short || 'DIVISION';
  };

  const columnEdgeClass = (col, index) => {
    const edges = [];
    if (index === 0) edges.push('border-l border-slate-700/70');
    if (col.grouped) edges.push('border-l border-slate-700/70');
    return edges.join(' ');
  };

  const renderTable = (title, teams, { highlightLeader = false, embedded = false } = {}) => {
    const columns = COLUMN_SETS[activeTab] ?? COLUMN_SETS.standings;
    const isScrollTable = activeTab === 'wildcard' || activeTab === 'expanded' || columns.length > 7;
    const teamColClass = isScrollTable ? STANDINGS_TEAM_COL_SCROLL : STANDINGS_TEAM_COL;
    const tableMinWidthClass = isScrollTable
      ? (columns.length >= 12 ? 'min-w-[1080px]' : 'min-w-[760px]')
      : '';
    const tableLayoutClass = isScrollTable ? 'w-max min-w-full' : 'table-fixed w-full';
    const wildcardCutoffIndex = activeTab === 'wildcard' && sortCol === 'wcGb' && sortDir === 'asc'
      ? wildCardCutoffIndex(teams, season)
      : -1;
    const statWidthClass = (col) => {
      if (!isScrollTable) return col.className ?? '';
      return `${WIDE_STAT_KEYS.has(col.key) ? 'min-w-[3.35rem]' : 'min-w-[2.55rem]'} ${col.className ?? ''}`;
    };
    const table = (
      <div className={embedded ? '' : TABLE_SCROLL}>
        <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${tableLayoutClass} ${tableMinWidthClass}`}>
          <colgroup>
            <col className={teamColClass} />
            {columns.map((col) => (
              <col key={col.key} className={statWidthClass(col) || undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-700/80">
              <th className={`${stickyTeamHead('bg-[#0b1220]', { shadow: isScrollTable, widthClass: teamColClass })} border-r border-b border-slate-700/70 !px-3 py-2.5 text-left text-[13px] font-bold uppercase tracking-[0.08em] text-white sm:!px-4`}>
                {title}
              </th>
              {columns.map((col, index) => (
                <SortTh
                  key={col.key}
                  col={col.key}
                  label={col.label}
                  className={`${statWidthClass(col)} ${columnEdgeClass(col, index)} py-2.5`}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const isLeader = i === 0 && highlightLeader;
              const cutoffCellClass = i === wildcardCutoffIndex ? 'border-b-2 !border-b-slate-600' : '';
              const rowBg = isLeader ? 'bg-slate-800' : 'bg-slate-900';
              return (
                <tr
                  key={team.teamId}
                  className={[
                    'group border-b border-slate-800/50 last:border-b-0 transition-colors hover:bg-slate-800/40',
                    isLeader ? 'bg-slate-800' : '',
                  ].join(' ')}
                >
                  {renderTeamCell(team, { rowBg, teamColClass, stickyShadow: isScrollTable, className: cutoffCellClass })}
                  {columns.map((col, index) => (
                    <td
                      key={col.key}
                      className={`${statCell('text-slate-200 py-2.5', { align: 'text-center' })} ${statWidthClass(col)} ${columnEdgeClass(col, index)} ${cutoffCellClass}`}
                    >
                      {renderCell(team, col)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    if (embedded) return <div key={title}>{table}</div>;

    return (
      <div key={title} className="overflow-hidden border-y border-slate-800 bg-slate-900 sm:rounded-2xl sm:border">
        {table}
      </div>
    );
  };

  const renderLeaguePanel = (group) => (
    <section key={group.name} className="space-y-3">
      <LeagueTitle title={group.name} variant="banner" className="px-4 sm:px-1" />
      <div className="overflow-hidden border-y border-slate-800 bg-slate-900 sm:rounded-2xl sm:border">
        <div className={TABLE_SCROLL}>
          {group.divisions.map((div) => renderTable(
            divisionColumnLabel(div),
            div.teams,
            { highlightLeader: true, embedded: true },
          ))}
        </div>
      </div>
    </section>
  );

  const grouped = !isLoading && !error && parsed ? getGroupedData() : null;

  const renderGlossary = (items) => {
    if (!items?.length) return null;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800/60">
        {items.map(({ key, text }) => (
          <span key={key}>
            <span className="text-slate-400 font-semibold">{key}</span>: {text}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto sm:px-6 py-0 sm:py-8 max-w-3xl">
      <div className="mb-0 px-4 sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div className={`text-accent-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>
            {selectedLeague.shortLabel} Standings
          </div>
          <LeagueLevelPicker
            value={standingsLeague}
            onChange={setStandingsLeague}
            ariaLabel="Change standings league level"
          />
        </div>
        {/* <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Standings</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Division-by-division records for the {season} season
        </p> */}
      </div>

      <TabBar
        variant="page"
        tabs={STANDINGS_TABS}
        activeKey={activeTab}
        onChange={handleTabChange}
        className="mb-4"
      />

      <div className={`flex flex-wrap gap-3 items-center px-3 sm:px-0 mb-6 ${activeTab === 'wildcard' ? 'justify-end' : 'justify-between'}`}>
        {activeTab !== 'wildcard' && (
          <div className="flex bg-slate-900 border border-slate-700 rounded-2xl p-1">
            <SegmentedControl
              value={viewScope}
              onChange={handleViewScopeChange}
              size="sm"
              options={VIEW_SCOPE_OPTIONS}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTimelineOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-accent-400/50 hover:text-white"
          >
            <i className="fa-solid fa-clock-rotate-left text-[11px] text-accent-400" aria-hidden />
            Timeline
          </button>
          <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} buttonClassName="min-w-[100px]" />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <BaseballSpinner size="lg" label="Loading standings…" />
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6 text-center text-red-400">
          Failed to load standings: {error}
        </div>
      )}

      {grouped?.layout === 'league-groups' && (
        <div className="space-y-8">
          {grouped.groups.map((g) => (
            <section key={g.name} className="space-y-3">
              <LeagueTitle title={g.name} variant="banner" className="px-4 sm:px-1" />
              {renderTable('Team', g.teams)}
            </section>
          ))}
        </div>
      )}

      {grouped?.layout === 'single' && renderTable(grouped.title, grouped.teams)}

      {grouped?.layout === 'divisions' && (
        <div className="space-y-8">
          {grouped.groups.map((group) => renderLeaguePanel(group))}
        </div>
      )}

      {!isLoading && !error && grouped?.layout === 'league-groups' && grouped.groups.every((g) => !g.teams.length) && (
        <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
          No standings data available for this selection.
        </div>
      )}

      {activeTab === 'standings' && !isLoading && !error && (
        <div className="flex justify-center mt-4 px-4 sm:px-0">
          <button
            type="button"
            onClick={() => setColumnSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
            aria-label="Edit standings columns"
          >
            <Settings size={13} />
            Columns
          </button>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span><span className="font-semibold text-accent-400">z</span> – Clinched best record in league</span>
          <span><span className="font-semibold text-accent-400">y</span> – Clinched Division</span>
          <span><span className="font-semibold text-accent-400">x</span> – Clinched Postseason</span>
          <span><span className="font-semibold text-accent-400">w</span> – Clinched Wild Card</span>
          <span><span className={`text-accent-400`}>W3</span> – Win streak</span>
          <span><span className="text-red-400">L2</span> – Loss streak</span>
          <span className="text-slate-600 italic">Click column headers to sort</span>
        </div>

        {renderGlossary(glossaryForColumns(COLUMN_SETS[activeTab] ?? []))}
      </div>

      <StandingsColumnSettings
        open={columnSettingsOpen}
        onClose={() => setColumnSettingsOpen(false)}
        prefs={columnPrefs}
        onChange={setColumnPrefs}
      />

      <StandingsTimelineSheet
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        season={season}
        leagueLevel={standingsLeague}
        leagueParams={leagueParams}
        leagueShortLabel={selectedLeague.shortLabel}
      />
    </div>
  );
}

