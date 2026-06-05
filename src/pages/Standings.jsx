import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamLogoUrl } from '../utils/mlbHelpers';
import { SegmentedControl, Select } from '../components/ui';

const SEASON_OPTIONS = [2026, 2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017].map((y) => ({
  value: String(y),
  label: String(y),
}));
const STANDINGS_TYPE_OPTIONS = [
  { value: 'regularSeason', label: 'Regular Season' },
  { value: 'wildCard', label: 'Wild Card' },
  { value: 'divisionLeaders', label: 'Division Leaders' },
  { value: 'springTraining', label: 'Spring Training' },
  { value: 'postseason', label: 'Postseason' },
];

export default function Standings() {
  const navigate = useNavigate();
  const cache = useRef({});
  const [season, setSeason] = useState(() => String(new Date().getFullYear()));
  const [standingsData, setStandingsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewType, setViewType] = useState('division'); // 'division' | 'league' | 'overall'
  const [standingsType, setStandingsType] = useState('regularSeason');
  const [sortCol, setSortCol] = useState('divisionRank');
  const [sortDir, setSortDir] = useState('asc');

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
        `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=${standingsType}&hydrate=team(division,league)`,
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
    if (!records) return { al: {}, nl: {} };
    const al = {};
    const nl = {};

    records.forEach((record) => {
      const firstTeam = record.teamRecords?.[0]?.team;
      const leagueId = record.league?.id ?? firstTeam?.league?.id;
      const divId    = record.division?.id ?? firstTeam?.division?.id;
      const divName  = record.division?.name ?? firstTeam?.division?.name ?? 'Unknown Division';

      if (!divId || leagueId == null) return;

      const target = leagueId === 103 ? al : nl;
      if (!target[divId]) target[divId] = { name: divName, leagueId, teams: [] };

      (record.teamRecords || []).forEach((tr) => {
        const splits = tr.records?.splitRecords || [];
        const home    = splits.find((s) => s.type === 'home');
        const away    = splits.find((s) => s.type === 'away');
        const lastTen = splits.find((s) => s.type === 'lastTen');
        target[divId].teams.push({
          teamId: tr.team?.id,
          teamName: tr.team?.name,
          wins: tr.wins ?? 0,
          losses: tr.losses ?? 0,
          pct: tr.leagueRecord?.pct ?? '.000',
          gb: tr.divisionGamesBack ?? '-',
          lgGb: tr.leagueGamesBack ?? '-',
          wcGb: tr.wildCardGamesBack ?? '-',
          home:    home    ? `${home.wins}-${home.losses}`       : '-',
          away:    away    ? `${away.wins}-${away.losses}`       : '-',
          lastTen: lastTen ? `${lastTen.wins}-${lastTen.losses}` : '-',
          streak: tr.streak?.streakCode ?? '-',
          runDiff: tr.runDifferential ?? 0,
          divisionRank: parseInt(tr.divisionRank ?? '99'),
          leagueRank: parseInt(tr.leagueRank ?? '99'),
          gamesPlayed: tr.gamesPlayed ?? 0,
          divisionChamp: tr.divisionChamp ?? false,
          clinched: tr.clinched ?? false,
          wildCard: tr.wildCard ?? false,
          elim: tr.eliminationNumber ?? '-',
          leagueId,
        });
      });
    });

    [al, nl].forEach((lg) =>
      Object.values(lg).forEach((div) =>
        div.teams.sort((a, b) => a.divisionRank - b.divisionRank),
      ),
    );

    return { al, nl };
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
          const num = parseInt(s.slice(1)) || 0;
          return s.startsWith('W') ? num : -num;
        };
        av = parseStreak(av);
        bv = parseStreak(bv);
      } else if (sortCol === 'pct') {
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
    const { al, nl } = parseStandings(standingsData.records);

    if (viewType === 'division') {
      const allDivs = [
        ...Object.values(al).sort((a, b) => a.name.localeCompare(b.name)),
        ...Object.values(nl).sort((a, b) => a.name.localeCompare(b.name)),
      ];
      return { type: 'division', divisions: allDivs };
    }

    if (viewType === 'league') {
      const alTeams = Object.values(al).flatMap((d) => d.teams);
      const nlTeams = Object.values(nl).flatMap((d) => d.teams);
      return {
        type: 'league',
        groups: [
          { name: 'American League', teams: alTeams.sort((a, b) => a.leagueRank - b.leagueRank) },
          { name: 'National League', teams: nlTeams.sort((a, b) => a.leagueRank - b.leagueRank) },
        ],
      };
    }

    // overall
    const allTeams = [
      ...Object.values(al).flatMap((d) => d.teams),
      ...Object.values(nl).flatMap((d) => d.teams),
    ].sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
    return { type: 'overall', groups: [{ name: 'All Teams', teams: allTeams }] };
  };

  const StreakBadge = ({ streak }) => {
    if (!streak || streak === '-') return <span className="text-slate-600">—</span>;
    const isWin = streak.startsWith('W');
    return (
      <span className={`font-mono ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
        {streak}
      </span>
    );
  };

  const RunDiffBadge = ({ diff }) => {
    if (diff === 0) return <span className="text-slate-500">0</span>;
    return (
      <span className={diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
        {diff > 0 ? `+${diff}` : diff}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="text-emerald-400 text-xs font-mono tracking-[3px] mb-1 uppercase">
          MLB Standings
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Standings</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Division-by-division records for the current season
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {/* View type */}
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
          <SegmentedControl
            value={viewType}
            onChange={setViewType}
            options={[
              { value: 'division', label: 'Division' },
              { value: 'league', label: 'League' },
              { value: 'overall', label: 'Overall' },
            ]}
          />
        </div>

        <Select
          value={standingsType}
          onChange={setStandingsType}
          options={STANDINGS_TYPE_OPTIONS}
        />

        <Select value={season} onChange={setSeason} options={SEASON_OPTIONS} />

        <button
          onClick={fetchStandings}
          className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium rounded-2xl text-sm transition-all"
        >
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-5">
        <span><span className="text-emerald-400 font-semibold">x</span> – Clinched Postseason</span>
        <span><span className="text-emerald-400 font-semibold">y</span> – Clinched Division</span>
        <span><span className="text-emerald-400">W3</span> – Win streak</span>
        <span><span className="text-red-400">L2</span> – Loss streak</span>
        <span className="text-slate-600 italic">Click column headers to sort</span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          Loading standings…
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6 text-center text-red-400">
          Failed to load standings: {error}
        </div>
      )}

      {/* Standings tables */}
      {!isLoading && !error && standingsData && (() => {
        const grouped = getGroupedData();
        if (!grouped) return null;

        const tables = grouped.type === 'division'
          ? grouped.divisions.map((div) => ({ name: div.name, teams: sortTeams(div.teams) }))
          : grouped.groups.map((g) => ({ name: g.name, teams: sortTeams(g.teams) }));

        const SortTh = ({ col, label, className = '' }) => {
          const active = sortCol === col;
          return (
            <th
              className={`px-2 sm:px-3 py-3 font-medium text-right cursor-pointer select-none hover:text-slate-300 transition-colors ${active ? 'text-emerald-400' : ''} ${className}`}
              onClick={() => handleSort(col)}
            >
              {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
            </th>
          );
        };

        return (
          <div className="space-y-5">
            {tables.map((table) => (
              <div key={table.name} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-semibold text-base sm:text-lg">{table.name}</h2>
                  <span className="text-xs text-slate-500">{season} {standingsType === 'regularSeason' ? 'Regular Season' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-800">
                        <th className="text-left px-4 sm:px-6 py-3 font-medium min-w-[160px] sm:min-w-[200px]">Team</th>
                        <SortTh col="wins"     label="W" />
                        <SortTh col="losses"   label="L" />
                        <SortTh col="pct"      label="PCT" />
                        <SortTh col="gb"       label="GB" />
                        <SortTh col="home"     label="Home"  className="hidden sm:table-cell" />
                        <SortTh col="away"     label="Away"  className="hidden sm:table-cell" />
                        <SortTh col="lastTen"  label="L10"   className="hidden md:table-cell" />
                        <SortTh col="runDiff"  label="DIFF"  className="hidden md:table-cell" />
                        <SortTh col="streak"   label="Strk" />
                      </tr>
                    </thead>
                    <tbody>
                      {table.teams.map((team, i) => (
                        <tr
                          key={team.teamId}
                          className={`border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors ${i === 0 && grouped.type === 'division' ? 'bg-emerald-500/[0.04]' : ''}`}
                        >
                          <td className="px-4 sm:px-6 py-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={teamLogoUrl(team.teamId)}
                                alt=""
                                className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => navigate(`/team/${team.teamId}`)}
                                onError={(e) => (e.target.style.display = 'none')}
                              />
                              <div>
                                <button
                                  className="font-medium text-sm sm:text-base leading-tight hover:text-emerald-400 transition-colors text-left"
                                  onClick={() => navigate(`/team/${team.teamId}`)}
                                >
                                  {team.teamName}
                                </button>
                                {(team.clinched || team.divisionChamp) && (
                                  <span className="text-[10px] text-emerald-400 font-semibold block">
                                    {team.divisionChamp ? 'y – Division' : 'x – Postseason'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono font-semibold text-white">{team.wins}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.losses}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-300">{team.pct}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400">{team.gb === '0.0' || team.gb === '-' ? '—' : team.gb}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">{team.home}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">{team.away}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono text-slate-400 hidden md:table-cell">{team.lastTen}</td>
                          <td className="px-2 sm:px-3 py-3 text-right font-mono hidden md:table-cell">
                            <RunDiffBadge diff={team.runDiff} />
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
            ))}

            {tables.length === 0 && (
              <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
                No standings data available for this selection.
              </div>
            )}
          </div>
        );
      })()}

      {/* Footer note */}
      <div className="mt-8 text-xs text-slate-600 text-center">
        Data from MLB Stats API · leagueId 103 (AL) / 104 (NL) ·{' '}
        <code className="font-mono">/v1/standings</code>
      </div>
    </div>
  );
}
