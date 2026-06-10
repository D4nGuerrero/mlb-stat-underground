import { useState, useEffect, useRef, useMemo } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useNavigate } from 'react-router-dom';
import TeamAbbrCell from '../components/TeamAbbrCell';
import { TabBar, Select, SegmentedControl, stickyTeamHead, stickyTeamCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT_STANDINGS } from '../components/ui';
import { TABLE_TEXT_CLASS, TABLE_TEAM_COL_CLASS } from '../theme/tableTheme';

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

const DIVISION_META = {
  201: { short: 'East', league: 'AL', order: 0 },
  202: { short: 'Central', league: 'AL', order: 1 },
  200: { short: 'West', league: 'AL', order: 2 },
  204: { short: 'East', league: 'NL', order: 0 },
  205: { short: 'Central', league: 'NL', order: 1 },
  203: { short: 'West', league: 'NL', order: 2 },
};

const LEAGUE_DIV_IDS = {
  103: { east: 201, central: 202, west: 200, intrLeague: 104 },
  104: { east: 204, central: 205, west: 203, intrLeague: 103 },
};

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

const EXPANDED_GLOSSARY = [
  { key: '1-RUN', text: 'One-run games' },
  { key: 'XTRA', text: 'Extra-inning games' },
];

const VS_DIV_GLOSSARY = [
  { key: 'EAST', text: 'Vs. East Division (in league)' },
  { key: 'CENT', text: 'Vs. Central Division (in league)' },
  { key: 'WEST', text: 'Vs. West Division (in league)' },
  { key: 'INTR', text: 'Vs. Interleague opponents' },
  { key: 'RHP', text: 'Vs. right-handed pitchers' },
  { key: 'LHP', text: 'Vs. left-handed pitchers' },
];

function divisionShortName(divId, fallback) {
  return DIVISION_META[divId]?.short ?? fallback?.replace(/American League |National League /, '') ?? 'Division';
}

function sortDivisions(divisions) {
  return [...divisions].sort((a, b) => {
    const am = DIVISION_META[a.divId] ?? { league: 'ZZ', order: 99 };
    const bm = DIVISION_META[b.divId] ?? { league: 'ZZ', order: 99 };
    if (am.league !== bm.league) return am.league === 'AL' ? -1 : 1;
    return am.order - bm.order;
  });
}

function fmtWL(w, l) {
  if (w == null || l == null) return '—';
  return `${w}-${l}`;
}

function parseWL(value) {
  if (!value || value === '—') return 0;
  const [w] = String(value).split('-').map((n) => parseInt(n, 10));
  return Number.isNaN(w) ? 0 : w;
}

/**
 * WCGB sort order (asc = best wild-card position first):
 *   +8, +3 (ahead) → — (in/clinched) → 0 → 2.0, 5.0… (games behind)
 * Desc reverses that order.
 */
function parseGamesBack(value) {
  if (value == null || value === '' || value === '-' || value === '—') return 0;
  const s = String(value).trim();
  if (s.startsWith('+')) {
    const n = parseFloat(s.slice(1));
    return Number.isNaN(n) ? -1000 : -1000 - n;
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function formatGamesBack(value) {
  if (value == null || value === '' || value === '-' || value === '—' || value === '0.0') return '—';
  const s = String(value).trim();
  const n = parseFloat(s.startsWith('+') ? s.slice(1) : s);
  if (Number.isNaN(n)) return '—';
  const num = Number.isInteger(n) ? String(n) : String(n);
  return s.startsWith('+') ? `+${num}` : num;
}

function parseSortValue(col, value) {
  if (col === 'streak') {
    if (!value || value === '-') return 0;
    const num = parseInt(String(value).slice(1), 10) || 0;
    return String(value).startsWith('W') ? num : -num;
  }
  if (col === 'wcGb' || col === 'gb') return parseGamesBack(value);
  if (col === 'pct' || col === 'vsDivPct') return parseFloat(value) || 0;
  if (['oneRun', 'extraInning', 'vsEast', 'vsCentral', 'vsWest', 'vsIntr', 'vsRhp', 'vsLhp', 'lastTen', 'home', 'away'].includes(col)) {
    return parseWL(value);
  }
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value ?? 0;
}

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

  const standingsType = STANDINGS_TYPE_BY_TAB[activeTab] ?? 'regularSeason';

  useEffect(() => {
    fetchStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, standingsType]);

  const fetchStandings = async () => {
    const key = `${season}:${standingsType}`;
    if (cache.current[key]) {
      setStandingsData(cache.current[key]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=${standingsType}&hydrate=team(division,league),records(divisionRecords,splitRecords,leagueRecords)`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache.current[key] = data;
      setStandingsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const buildTeamRow = (tr, { leagueId, divId }) => {
    const splits = tr.records?.splitRecords || [];
    const home = splits.find((s) => s.type === 'home');
    const away = splits.find((s) => s.type === 'away');
    const lastTen = splits.find((s) => s.type === 'lastTen');
    const oneRun = splits.find((s) => s.type === 'oneRun');
    const extraInning = splits.find((s) => s.type === 'extraInning');
    const vsLeft = splits.find((s) => s.type === 'left');
    const vsRight = splits.find((s) => s.type === 'right');

    const ownLeagueId = tr.team?.league?.id ?? leagueId;
    const ownDivisionId = tr.team?.division?.id ?? divId;
    const divMap = LEAGUE_DIV_IDS[ownLeagueId] ?? {};
    const divisionRecords = tr.records?.divisionRecords || [];
    const leagueRecords = tr.records?.leagueRecords || [];

    const getDivRecord = (id) => divisionRecords.find((d) => d.division?.id === id);
    const east = getDivRecord(divMap.east);
    const central = getDivRecord(divMap.central);
    const west = getDivRecord(divMap.west);
    const intr = leagueRecords.find((l) => l.league?.id === divMap.intrLeague);

    return {
      teamId: tr.team?.id,
      teamName: tr.team?.name,
      wins: tr.wins ?? 0,
      losses: tr.losses ?? 0,
      pct: tr.leagueRecord?.pct ?? '.000',
      gb: tr.divisionGamesBack ?? '-',
      lgGb: tr.leagueGamesBack ?? '-',
      wcGb: tr.wildCardGamesBack ?? '-',
      home: home ? fmtWL(home.wins, home.losses) : '—',
      away: away ? fmtWL(away.wins, away.losses) : '—',
      lastTen: lastTen ? fmtWL(lastTen.wins, lastTen.losses) : '—',
      oneRun: oneRun ? fmtWL(oneRun.wins, oneRun.losses) : '—',
      extraInning: extraInning ? fmtWL(extraInning.wins, extraInning.losses) : '—',
      runsScored: tr.runsScored ?? null,
      runsAllowed: tr.runsAllowed ?? null,
      streak: tr.streak?.streakCode ?? '-',
      runDiff: tr.runDifferential ?? 0,
      divisionRank: parseInt(tr.divisionRank ?? '99', 10),
      leagueRank: parseInt(tr.leagueRank ?? '99', 10),
      sportRank: parseInt(tr.sportRank ?? '99', 10),
      wildCardRank: parseInt(tr.wildCardRank ?? '99', 10),
      gamesPlayed: tr.gamesPlayed ?? 0,
      divisionChamp: tr.divisionChamp ?? false,
      clinched: tr.clinched ?? false,
      wildCard: tr.wildCard ?? false,
      leagueId: ownLeagueId,
      divId: ownDivisionId,
      vsEast: east ? fmtWL(east.wins, east.losses) : '—',
      vsCentral: central ? fmtWL(central.wins, central.losses) : '—',
      vsWest: west ? fmtWL(west.wins, west.losses) : '—',
      vsIntr: intr ? fmtWL(intr.wins, intr.losses) : '—',
      vsRhp: vsRight ? fmtWL(vsRight.wins, vsRight.losses) : '—',
      vsLhp: vsLeft ? fmtWL(vsLeft.wins, vsLeft.losses) : '—',
    };
  };

  const parseStandings = (records) => {
    if (!records) return { al: {}, nl: {}, wildCard: { al: [], nl: [] } };
    const al = {};
    const nl = {};
    const wildCard = { al: [], nl: [] };

    records.forEach((record) => {
      const firstTeam = record.teamRecords?.[0]?.team;
      const leagueId = record.league?.id ?? firstTeam?.league?.id;
      const divId = record.division?.id ?? firstTeam?.division?.id;
      const divName = record.division?.name ?? firstTeam?.division?.name ?? 'Unknown Division';

      if (record.standingsType === 'wildCard') {
        const bucket = leagueId === 103 ? wildCard.al : wildCard.nl;
        (record.teamRecords || []).forEach((tr) => {
          bucket.push(buildTeamRow(tr, { leagueId, divId }));
        });
        return;
      }

      if (!divId || leagueId == null) return;

      const target = leagueId === 103 ? al : nl;
      if (!target[divId]) {
        target[divId] = {
          divId,
          name: divisionShortName(divId, divName),
          leagueId,
          leagueLabel: leagueId === 103 ? 'American League' : 'National League',
          teams: [],
        };
      }

      (record.teamRecords || []).forEach((tr) => {
        target[divId].teams.push(buildTeamRow(tr, { leagueId, divId }));
      });
    });

    [al, nl].forEach((lg) => {
      Object.values(lg).forEach((div) => {
        div.teams.sort((a, b) => a.divisionRank - b.divisionRank);
      });
    });

    wildCard.al.sort((a, b) => (a.wildCardRank ?? 99) - (b.wildCardRank ?? 99));
    wildCard.nl.sort((a, b) => (a.wildCardRank ?? 99) - (b.wildCardRank ?? 99));

    return { al, nl, wildCard };
  };

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
    const { al, nl, wildCard } = parsed;

    if (activeTab === 'wildcard') {
      return {
        layout: 'league-groups',
        groups: [
          { name: 'American League', teams: sortTeams(wildCard.al) },
          { name: 'National League', teams: sortTeams(wildCard.nl) },
        ],
      };
    }

    const alDivs = sortDivisions(Object.values(al)).map((d) => ({ ...d, teams: sortTeams(d.teams) }));
    const nlDivs = sortDivisions(Object.values(nl)).map((d) => ({ ...d, teams: sortTeams(d.teams) }));
    const alTeams = sortTeams(alDivs.flatMap((d) => d.teams));
    const nlTeams = sortTeams(nlDivs.flatMap((d) => d.teams));

    if (viewScope === 'league') {
      return {
        layout: 'league-groups',
        groups: [
          { name: 'American League', teams: alTeams },
          { name: 'National League', teams: nlTeams },
        ],
      };
    }

    if (viewScope === 'overall') {
      return {
        layout: 'single',
        title: 'MLB Overall',
        teams: sortTeams([...alTeams, ...nlTeams]),
      };
    }

    return {
      layout: 'divisions',
      alDivs,
      nlDivs,
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
        className={`${statHead(`cursor-pointer select-none hover:text-slate-300 transition-colors ${active ? `text-${THEME_COLOR}-400` : ''}`)} ${className}`}
        onClick={() => handleSort(col)}
      >
        {label}{active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  };

  const renderTeamCell = (team) => (
    <td className={stickyTeamCell('bg-slate-900')}>
      <button
        type="button"
        className="text-left hover:opacity-90 transition-opacity"
        onClick={() => navigate(`/team/${team.teamId}`)}
      >
        <TeamAbbrCell
          teamId={team.teamId}
          teamName={team.teamName}
          size="sm"
          abbrClassName="text-[10px] font-medium"
          nameClassName="text-xs font-medium"
        />
        {(team.clinched || team.divisionChamp) && (
          <span className={`hidden sm:block text-[10px] text-${THEME_COLOR}-400 font-semibold mt-0.5`}>
            {team.divisionChamp ? 'y – Division' : 'x – Postseason'}
          </span>
        )}
      </button>
    </td>
  );

  const renderCell = (team, col) => {
    switch (col.key) {
      case 'gb':
      case 'wcGb':
        return formatGamesBack(team[col.key]);
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
        return <span className="text-slate-400">{team.losses}</span>;
      case 'pct':
        return <span className="text-slate-300">{team.pct}</span>;
      default:
        return team[col.key] ?? '—';
    }
  };

  const COLUMN_SETS = {
    standings: [
      { key: 'wins', label: 'W' },
      { key: 'losses', label: 'L' },
      { key: 'pct', label: 'PCT' },
      { key: 'gb', label: 'GB' },
      { key: 'runsScored', label: 'RS' },
      { key: 'runsAllowed', label: 'RA' },
      { key: 'runDiff', label: 'DIFF' },
      { key: 'streak', label: 'Strk' },
      { key: 'lastTen', label: 'L10' },
    ],
    wildcard: [
      { key: 'wins', label: 'W' },
      { key: 'losses', label: 'L' },
      { key: 'pct', label: 'PCT' },
      { key: 'wcGb', label: 'WCGB' },
      { key: 'runsScored', label: 'RS' },
      { key: 'runsAllowed', label: 'RA' },
      { key: 'runDiff', label: 'DIFF' },
      { key: 'streak', label: 'Strk' },
      { key: 'lastTen', label: 'L10' },
    ],
    expanded: [
      { key: 'wins', label: 'W' },
      { key: 'losses', label: 'L' },
      { key: 'pct', label: 'PCT' },
      { key: 'gb', label: 'GB' },
      { key: 'home', label: 'Home', className: 'hidden sm:table-cell' },
      { key: 'away', label: 'Away', className: 'hidden sm:table-cell' },
      { key: 'runsScored', label: 'RS' },
      { key: 'runsAllowed', label: 'RA' },
      { key: 'runDiff', label: 'DIFF' },
      { key: 'oneRun', label: '1-RUN' },
      { key: 'extraInning', label: 'XTRA' },
      { key: 'streak', label: 'Strk' },
      { key: 'lastTen', label: 'L10' },
    ],
    vsdivision: [
      { key: 'vsEast', label: 'EAST' },
      { key: 'vsCentral', label: 'CENT' },
      { key: 'vsWest', label: 'WEST' },
      { key: 'vsIntr', label: 'INTR' },
      { key: 'vsRhp', label: 'RHP' },
      { key: 'vsLhp', label: 'LHP' },
    ],
  };

  const renderTable = (title, teams, { highlightLeader = false } = {}) => {
    const columns = COLUMN_SETS[activeTab] ?? COLUMN_SETS.standings;
    return (
      <div key={title} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden px-3">
        <div className="px-5 sm:px-6 py-3 border-b border-slate-800">
          <h2 className="font-semibold text-base sm:text-lg">{title}</h2>
        </div>
        <div className={TABLE_SCROLL}>
          <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT_STANDINGS}`}>
            <colgroup>
              <col className={TABLE_TEAM_COL_CLASS} />
              {columns.map((col) => (
                <col key={col.key} className={col.className ?? undefined} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className={`${stickyTeamHead('bg-slate-900')} font-medium`}>
                  Team
                </th>
                {columns.map((col) => (
                  <SortTh key={col.key} col={col.key} label={col.label} className={col.className ?? ''} />
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((team, i) => (
                <tr
                  key={team.teamId}
                  className={`group border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors ${i === 0 && highlightLeader ? `bg-${THEME_COLOR}-500/[0.04]` : ''}`}
                >
                  {renderTeamCell(team)}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${statCell()} ${col.className ?? ''}`}
                    >
                      {renderCell(team, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const grouped = !isLoading && !error && parsed ? getGroupedData() : null;

  const renderGlossary = (items) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800/60">
      {items.map(({ key, text }) => (
        <span key={key}>
          <span className="text-slate-400 font-semibold">{key}</span>: {text}
        </span>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto sm:px-6 py-6 sm:py-8">
      <div className="mb-6 px-3 sm:px-0">
        <div className={`text-${THEME_COLOR}-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>
          MLB Standings
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Standings</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Division-by-division records for the {season} season
        </p>
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
        <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} buttonClassName="min-w-[100px]" />
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <div className={`w-8 h-8 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
          Loading standings…
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6 text-center text-red-400">
          Failed to load standings: {error}
        </div>
      )}

      {grouped?.layout === 'league-groups' && (
        <div className="space-y-5">
          {grouped.groups.map((g) => renderTable(g.name, g.teams))}
        </div>
      )}

      {grouped?.layout === 'single' && renderTable(grouped.title, grouped.teams)}

      {grouped?.layout === 'divisions' && (
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
              American League
            </div>
            {grouped.alDivs.map((div) => renderTable(div.name, div.teams, { highlightLeader: true }))}
          </div>
          <div className="border-t border-slate-700/60 pt-5 space-y-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
              National League
            </div>
            {grouped.nlDivs.map((div) => renderTable(div.name, div.teams, { highlightLeader: true }))}
          </div>
        </div>
      )}

      {!isLoading && !error && grouped?.layout === 'league-groups' && grouped.groups.every((g) => !g.teams.length) && (
        <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
          No standings data available for this selection.
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span><span className={`text-${THEME_COLOR}-400 font-semibold`}>x</span> – Clinched Postseason</span>
          <span><span className={`text-${THEME_COLOR}-400 font-semibold`}>y</span> – Clinched Division</span>
          <span><span className={`text-${THEME_COLOR}-400`}>W3</span> – Win streak</span>
          <span><span className="text-red-400">L2</span> – Loss streak</span>
          <span className="text-slate-600 italic">Click column headers to sort</span>
        </div>

        {activeTab === 'expanded' && renderGlossary(EXPANDED_GLOSSARY)}
        {activeTab === 'vsdivision' && renderGlossary(VS_DIV_GLOSSARY)}
      </div>
    </div>
  );
}