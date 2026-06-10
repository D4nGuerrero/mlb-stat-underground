import { useState, useEffect, useRef } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useNavigate } from 'react-router-dom';
import { teamLogoUrl } from '../utils/mlbHelpers';
import { TabBar, Select } from '../components/ui';

const SEASON_OPTIONS = [2026, 2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017].map((y) => ({
  value: String(y),
  label: String(y),
}));

const STANDINGS_TABS = [
  { key: 'standings', label: 'Standings' },
  { key: 'wildcard', label: 'Wild Card' },
  { key: 'expanded', label: 'Expanded' },
  { key: 'vsdivision', label: 'Vs. Division' },
];

const DIVISION_META = {
  201: { short: 'East', league: 'AL', order: 0 },
  202: { short: 'Central', league: 'AL', order: 1 },
  200: { short: 'West', league: 'AL', order: 2 },
  204: { short: 'East', league: 'NL', order: 0 },
  205: { short: 'Central', league: 'NL', order: 1 },
  203: { short: 'West', league: 'NL', order: 2 },
};

const STANDINGS_TYPE_BY_TAB = {
  standings: 'regularSeason',
  wildcard: 'wildCard',
  expanded: 'regularSeason',
  vsdivision: 'regularSeason',
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

export default function Standings() {
  const navigate = useNavigate();
  const cache = useRef({});
  const [season, setSeason] = useState(() => String(new Date().getFullYear()));
  const [standingsData, setStandingsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('standings');
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
        `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=${standingsType}&hydrate=team(division,league),records(divisionRecords)`,
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

  const buildTeamRow = (tr, { leagueId, divId }) => {
    const splits = tr.records?.splitRecords || [];
    const home = splits.find((s) => s.type === 'home');
    const away = splits.find((s) => s.type === 'away');
    const lastTen = splits.find((s) => s.type === 'lastTen');
    const ownDivisionId = tr.team?.division?.id ?? divId;
    const vsDiv = (tr.records?.divisionRecords || []).find(
      (d) => d.division?.id === ownDivisionId,
    );

    return {
      teamId: tr.team?.id,
      teamName: tr.team?.name,
      wins: tr.wins ?? 0,
      losses: tr.losses ?? 0,
      pct: tr.leagueRecord?.pct ?? '.000',
      gb: tr.divisionGamesBack ?? '-',
      lgGb: tr.leagueGamesBack ?? '-',
      wcGb: tr.wildCardGamesBack ?? '-',
      home: home ? `${home.wins}-${home.losses}` : '-',
      away: away ? `${away.wins}-${away.losses}` : '-',
      lastTen: lastTen ? `${lastTen.wins}-${lastTen.losses}` : '-',
      streak: tr.streak?.streakCode ?? '-',
      runDiff: tr.runDifferential ?? 0,
      divisionRank: parseInt(tr.divisionRank ?? '99', 10),
      leagueRank: parseInt(tr.leagueRank ?? '99', 10),
      wildCardRank: parseInt(tr.wildCardRank ?? '99', 10),
      gamesPlayed: tr.gamesPlayed ?? 0,
      divisionChamp: tr.divisionChamp ?? false,
      clinched: tr.clinched ?? false,
      wildCard: tr.wildCard ?? false,
      elim: tr.eliminationNumber ?? '-',
      leagueId,
      divId: ownDivisionId,
      vsDivWins: vsDiv?.wins ?? null,
      vsDivLosses: vsDiv?.losses ?? null,
      vsDivPct: vsDiv?.pct ?? null,
    };
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'pct' || col === 'wins' ? 'desc' : 'asc');
    }
  };

  const sortTeams = (teams) => {
    return [...teams].sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];
      if (sortCol === 'streak') {
        const parseStreak = (s) => {
          if (!s || s === '-') return 0;
          const num = parseInt(s.slice(1), 10) || 0;
          return s.startsWith('W') ? num : -num;
        };
        av = parseStreak(av);
        bv = parseStreak(bv);
      } else if (sortCol === 'pct' || sortCol === 'vsDivPct') {
        av = parseFloat(av);
        bv = parseFloat(bv);
      } else if (typeof av === 'string') {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  };

  const getGroupedData = () => {
    if (!standingsData?.records) return null;
    const { al, nl, wildCard } = parseStandings(standingsData.records);

    if (activeTab === 'wildcard') {
      return {
        type: 'wildcard',
        groups: [
          { name: 'American League', teams: sortTeams(wildCard.al) },
          { name: 'National League', teams: sortTeams(wildCard.nl) },
        ],
      };
    }

    const alDivs = sortDivisions(Object.values(al));
    const nlDivs = sortDivisions(Object.values(nl));

    return {
      type: activeTab,
      alDivs: alDivs.map((d) => ({ ...d, teams: sortTeams(d.teams) })),
      nlDivs: nlDivs.map((d) => ({ ...d, teams: sortTeams(d.teams) })),
    };
  };

  const StreakBadge = ({ streak }) => {
    if (!streak || streak === '-') return <span className="text-slate-600">—</span>;
    const isWin = streak.startsWith('W');
    return (
      <span className={`font-mono ${isWin ? `text-${THEME_COLOR}-400` : 'text-red-400'}`}>
        {streak}
      </span>
    );
  };

  const RunDiffBadge = ({ diff }) => {
    if (diff === 0) return <span className="text-slate-500">0</span>;
    return (
      <span className={diff > 0 ? `text-${THEME_COLOR}-400` : 'text-red-400'}>
        {diff > 0 ? `+${diff}` : diff}
      </span>
    );
  };

  const SortTh = ({ col, label, className = '' }) => {
    const active = sortCol === col;
    return (
      <th
        className={`px-2 sm:px-3 py-3 font-medium text-right cursor-pointer select-none hover:text-slate-300 transition-colors ${active ? `text-${THEME_COLOR}-400` : ''} ${className}`}
        onClick={() => handleSort(col)}
      >
        {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </th>
    );
  };

  const renderTeamCell = (team) => (
    <td className="px-4 sm:px-6 py-3">
      <div className="flex items-center gap-2.5">
        <img
          src={teamLogoUrl(team.teamId)}
          alt=""
          className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
          onClick={() => navigate(`/team/${team.teamId}`)}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div>
          <button
            type="button"
            className={`font-medium text-sm sm:text-base leading-tight hover:text-${THEME_COLOR}-400 transition-colors text-left`}
            onClick={() => navigate(`/team/${team.teamId}`)}
          >
            {team.teamName}
          </button>
          {(team.clinched || team.divisionChamp) && (
            <span className={`text-[10px] text-${THEME_COLOR}-400 font-semibold block`}>
              {team.divisionChamp ? 'y – Division' : 'x – Postseason'}
            </span>
          )}
        </div>
      </div>
    </td>
  );

  const renderDivisionTable = (table, { highlightLeader = true, showWcGb = false, vsDivision = false }) => (
    <div key={`${table.leagueLabel}-${table.name}`} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
      <div className="px-5 sm:px-6 py-3 border-b border-slate-800">
        <h2 className="font-semibold text-base sm:text-lg">{table.name}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left px-4 sm:px-6 py-3 font-medium min-w-[160px] sm:min-w-[200px]">Team</th>
              {vsDivision ? (
                <>
                  <SortTh col="vsDivWins" label="W" />
                  <SortTh col="vsDivLosses" label="L" />
                  <SortTh col="vsDivPct" label="PCT" />
                </>
              ) : (
                <>
                  <SortTh col="wins" label="W" />
                  <SortTh col="losses" label="L" />
                  <SortTh col="pct" label="PCT" />
                  <SortTh col="gb" label="GB" />
                  {showWcGb && <SortTh col="wcGb" label="WCGB" />}
                  <SortTh col="home" label="Home" className="hidden sm:table-cell" />
                  <SortTh col="away" label="Away" className="hidden sm:table-cell" />
                  <SortTh col="lastTen" label="L10" className="hidden md:table-cell" />
                  <SortTh col="runDiff" label="DIFF" className="hidden md:table-cell" />
                  <SortTh col="streak" label="Strk" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {table.teams.map((team, i) => (
              <tr
                key={team.teamId}
                className={`border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors ${i === 0 && highlightLeader ? `bg-${THEME_COLOR}-500/[0.04]` : ''}`}
              >
                {renderTeamCell(team)}
                {vsDivision ? (
                  <>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono font-semibold text-white">{team.vsDivWins ?? '—'}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.vsDivLosses ?? '—'}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-300">{team.vsDivPct ?? '—'}</td>
                  </>
                ) : (
                  <>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono font-semibold text-white">{team.wins}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.losses}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-300">{team.pct}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.gb === '0.0' || team.gb === '-' ? '—' : team.gb}</td>
                    {showWcGb && (
                      <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">
                        {team.wcGb === '0.0' || team.wcGb === '-' ? '—' : team.wcGb}
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">{team.home}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">{team.away}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400 hidden md:table-cell">{team.lastTen}</td>
                    <td className="px-2 sm:px-3 py-3 text-right font-mono hidden md:table-cell">
                      <RunDiffBadge diff={team.runDiff} />
                    </td>
                    <td className="px-2 sm:px-3 py-3 text-right">
                      <StreakBadge streak={team.streak} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLeagueGroup = (name, teams, options = {}) => (
    <div key={name} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
      <div className="px-5 sm:px-6 py-3 border-b border-slate-800">
        <h2 className="font-semibold text-base sm:text-lg">{name}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left px-4 sm:px-6 py-3 font-medium min-w-[160px]">Team</th>
              <SortTh col="wins" label="W" />
              <SortTh col="losses" label="L" />
              <SortTh col="pct" label="PCT" />
              <SortTh col="wildCardRank" label="WC" />
              <SortTh col="wcGb" label="WCGB" />
              <SortTh col="streak" label="Strk" />
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.teamId} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                {renderTeamCell(team)}
                <td className="px-2 sm:px-3 py-3 text-right font-mono font-semibold text-white">{team.wins}</td>
                <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.losses}</td>
                <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-300">{team.pct}</td>
                <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.wildCardRank}</td>
                <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">
                  {team.wcGb === '0.0' || team.wcGb === '-' ? '—' : team.wcGb}
                </td>
                <td className="px-2 sm:px-3 py-3 text-right">
                  <StreakBadge streak={team.streak} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const grouped = !isLoading && !error && standingsData ? getGroupedData() : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <div className={`text-${THEME_COLOR}-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>
          MLB Standings
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Standings</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Division-by-division records for the {season} season
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <TabBar
          tabs={STANDINGS_TABS}
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setSortCol(key === 'wildcard' ? 'wildCardRank' : key === 'vsdivision' ? 'vsDivPct' : 'divisionRank');
            setSortDir('asc');
          }}
        />
        <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} />
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

      {grouped && grouped.type === 'wildcard' && (
        <div className="space-y-5">
          {grouped.groups.map((g) => renderLeagueGroup(g.name, g.teams))}
        </div>
      )}

      {grouped && grouped.type !== 'wildcard' && (
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
              American League
            </div>
            {grouped.alDivs.map((div) =>
              renderDivisionTable(div, {
                showWcGb: activeTab === 'expanded',
                vsDivision: activeTab === 'vsdivision',
              }),
            )}
          </div>

          <div className="border-t border-slate-700/60 pt-5 space-y-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
              National League
            </div>
            {grouped.nlDivs.map((div) =>
              renderDivisionTable(div, {
                showWcGb: activeTab === 'expanded',
                vsDivision: activeTab === 'vsdivision',
              }),
            )}
          </div>
        </div>
      )}

      {!isLoading && !error && grouped && grouped.type === 'wildcard' && grouped.groups.every((g) => !g.teams.length) && (
        <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
          No standings data available for this selection.
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-8">
        <span><span className={`text-${THEME_COLOR}-400 font-semibold`}>x</span> – Clinched Postseason</span>
        <span><span className={`text-${THEME_COLOR}-400 font-semibold`}>y</span> – Clinched Division</span>
        <span><span className={`text-${THEME_COLOR}-400`}>W3</span> – Win streak</span>
        <span><span className="text-red-400">L2</span> – Loss streak</span>
        <span className="text-slate-600 italic">Click column headers to sort</span>
      </div>
    </div>
  );
}