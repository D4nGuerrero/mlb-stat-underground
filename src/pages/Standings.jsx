import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamAbbrCell from '../components/TeamAbbrCell';
import { TabBar, Select, SegmentedControl, BaseballSpinner, stickyTeamHead, stickyTeamCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT_STANDINGS } from '../components/ui';
import { LeagueLevelPicker } from '../components/LeagueLevelPicker';
import { LEAGUE_LEVEL_BY_VALUE, LEAGUE_LEVEL_STORAGE_KEY, LEAGUE_LEVEL_VALUES } from '../constants/leagueLevels.js';
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

const LEAGUE_LOGOS = {
  AL: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/159.svg',
  NL: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/160.svg',
};

function leagueKeyFromName(name) {
  if (/\bamerican league\b|\bAL\b/i.test(name ?? '')) return 'AL';
  if (/\bnational league\b|\bNL\b/i.test(name ?? '')) return 'NL';
  return null;
}

function LeagueTitle({ title, className = '' }) {
  const leagueKey = leagueKeyFromName(title);

  return (
    <span className={`inline-flex items-center gap-2 pl-2 ${className}`}>
      {leagueKey && (
        <img
          src={LEAGUE_LOGOS[leagueKey]}
          alt=""
          className="w-5 h-5 object-contain flex-shrink-0"
          onError={(e) => (e.target.style.display = 'none')}
        />
      )}
      <span>{title}</span>
    </span>
  );
}

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

const loadStandingsLeague = () => {
  try {
    const saved = localStorage.getItem(LEAGUE_LEVEL_STORAGE_KEY);
    return LEAGUE_LEVEL_VALUES.has(saved) ? saved : 'mlb';
  } catch {
    return 'mlb';
  }
};

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

function gamesBackFromLeader(team, leader) {
  if (!team || !leader) return '-';
  const gamesBack = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
  if (!Number.isFinite(gamesBack) || gamesBack <= 0) return '-';
  return Number.isInteger(gamesBack) ? String(gamesBack) : gamesBack.toFixed(1);
}

function getGroupLeader(teams, rankKey) {
  return [...teams].sort((a, b) => {
    const ar = Number.isFinite(a[rankKey]) ? a[rankKey] : 99;
    const br = Number.isFinite(b[rankKey]) ? b[rankKey] : 99;
    if (ar !== br) return ar - br;
    const pctDiff = (parseFloat(b.pct) || 0) - (parseFloat(a.pct) || 0);
    if (pctDiff !== 0) return pctDiff;
    return (b.wins ?? 0) - (a.wins ?? 0);
  })[0];
}

function withGamesBackFromGroupLeader(teams, rankKey) {
  const leader = getGroupLeader(teams, rankKey);
  return teams.map((team) => ({
    ...team,
    gb: gamesBackFromLeader(team, leader),
  }));
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
  const [standingsLeague, setStandingsLeague] = useState(loadStandingsLeague);

  const standingsType = STANDINGS_TYPE_BY_TAB[activeTab] ?? 'regularSeason';
  const selectedLeague = LEAGUE_LEVEL_BY_VALUE[standingsLeague] ?? LEAGUE_LEVEL_BY_VALUE.mlb;

  const fetchStandings = async () => {
    const key = `${standingsLeague}:${season}:${standingsType}`;
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
        `https://statsapi.mlb.com/api/v1/standings?${selectedLeague.standingsQuery}&season=${season}&standingsTypes=${standingsType}&hydrate=team(division,league),records(divisionRecords,splitRecords,leagueRecords)`,
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

  useEffect(() => {
    fetchStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, standingsType, standingsLeague]);

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
      team: tr.team,
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

  const parseStandings = useCallback((records) => {
    if (!records) return { divisions: [], wildCardGroups: [] };
    const divisions = {};
    const wildCardGroups = {};

    records.forEach((record) => {
      const firstTeam = record.teamRecords?.[0]?.team;
      const leagueId = record.league?.id ?? firstTeam?.league?.id;
      const leagueName = record.league?.name ?? firstTeam?.league?.name ?? 'League';
      const divId = record.division?.id ?? firstTeam?.division?.id ?? `league-${leagueId ?? 'unknown'}`;
      const divName = record.division?.name ?? firstTeam?.division?.name ?? leagueName;

      if (record.standingsType === 'wildCard') {
        const key = leagueId ?? 'league';
        if (!wildCardGroups[key]) wildCardGroups[key] = { leagueId, name: leagueName, teams: [] };
        (record.teamRecords || []).forEach((tr) => {
          wildCardGroups[key].teams.push(buildTeamRow(tr, { leagueId, divId }));
        });
        return;
      }

      if (!divId || leagueId == null) return;

      if (!divisions[divId]) {
        divisions[divId] = {
          divId,
          name: divisionShortName(divId, divName),
          leagueId,
          leagueLabel: leagueName,
          teams: [],
        };
      }

      (record.teamRecords || []).forEach((tr) => {
        divisions[divId].teams.push(buildTeamRow(tr, { leagueId, divId }));
      });
    });

    Object.values(divisions).forEach((div) => {
      div.teams.sort((a, b) => a.divisionRank - b.divisionRank);
    });

    Object.values(wildCardGroups).forEach((group) => {
      group.teams.sort((a, b) => (a.wildCardRank ?? 99) - (b.wildCardRank ?? 99));
    });

    return {
      divisions: Object.values(divisions),
      wildCardGroups: Object.values(wildCardGroups),
    };
  }, []);

  const parsed = useMemo(
    () => (standingsData?.records ? parseStandings(standingsData.records) : null),
    [parseStandings, standingsData],
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
        className={`${statHead(`cursor-pointer select-none hover:text-slate-300 transition-colors ${active ? `text-accent-400` : ''}`)} ${className}`}
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
          team={team.team}
          teamId={team.teamId}
          teamName={team.teamName}
          hidePlaceholderAbbr={selectedLeague.value !== 'mlb'}
          size="xxl"
          abbrClassName="text-[10px] font-medium"
          nameClassName="text-[20px] font-medium"
        />
        {(team.clinched || team.divisionChamp) && (
          <span className={`hidden sm:block text-[10px] text-accent-400 font-semibold mt-0.5`}>
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
        return <span className="font-semibold text-slate-100">{team.wins}</span>;
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
    const tableMinWidthClass = activeTab === 'expanded' ? 'min-w-[760px] sm:min-w-[980px]' : '';
    return (
      <div key={title} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden px-3">
        <div className="px-5 sm:px-6 py-3 border-b border-slate-800">
          <h2 className="font-semibold text-base sm:text-lg">
            <LeagueTitle title={title} />
          </h2>
        </div>
        <div className={TABLE_SCROLL}>
          <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT_STANDINGS} ${tableMinWidthClass}`}>
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
                  className={`group border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors ${i === 0 && highlightLeader ? `bg-accent-500/[0.04]` : ''}`}
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
        <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} buttonClassName="min-w-[100px]" />
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
        <div className="space-y-5">
          {grouped.groups.map((g) => renderTable(g.name, g.teams))}
        </div>
      )}

      {grouped?.layout === 'single' && renderTable(grouped.title, grouped.teams)}

      {grouped?.layout === 'divisions' && (
        <div className="space-y-5">
          {grouped.groups.map((group, index) => (
            <div key={group.name} className={`${index > 0 ? 'border-t border-slate-700/60 pt-5' : ''} space-y-4`}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
                <LeagueTitle title={group.name} />
              </div>
              {group.divisions.map((div) => renderTable(div.name, div.teams, { highlightLeader: true }))}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && grouped?.layout === 'league-groups' && grouped.groups.every((g) => !g.teams.length) && (
        <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
          No standings data available for this selection.
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span><span className={`text-accent-400 font-semibold`}>x</span> – Clinched Postseason</span>
          <span><span className={`text-accent-400 font-semibold`}>y</span> – Clinched Division</span>
          <span><span className={`text-accent-400`}>W3</span> – Win streak</span>
          <span><span className="text-red-400">L2</span> – Loss streak</span>
          <span className="text-slate-600 italic">Click column headers to sort</span>
        </div>

        {activeTab === 'expanded' && renderGlossary(EXPANDED_GLOSSARY)}
        {activeTab === 'vsdivision' && renderGlossary(VS_DIV_GLOSSARY)}
      </div>
    </div>
  );
}
