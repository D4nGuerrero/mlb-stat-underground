import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { playerHeadshotUrl, teamLogoUrl, stadiumInfieldUrl, playerActionShotUrl, playerHeroShotUrl } from '../utils/mlbHelpers';
import { Select } from '../components/ui';

const SEASON_OPTIONS = [
  new Date().getFullYear(),
  new Date().getFullYear() - 1,
  new Date().getFullYear() - 2,
  new Date().getFullYear() - 3,
].map((y) => ({ value: y, label: String(y) }));

export default function PlayerPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [playerInfo, setPlayerInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [yearByYear, setYearByYear] = useState(null);
  const [season, setSeason] = useState(() => new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) return;
    setIsLoading(true);
    setError(null);

    Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam`).then((r) => r.json()),
      fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season,career&group=hitting,pitching&season=${season}`).then((r) => r.json()),
      fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=yearByYear&group=hitting,pitching&hydrate=team`).then((r) => r.json()),
    ])
      .then(([bioData, statsData, ybyData]) => {
        setPlayerInfo(bioData.people?.[0] || null);
        setStats(statsData.stats || []);
        setYearByYear(ybyData.stats || []);
      })
      .catch(() => setError('Failed to load player data.'))
      .finally(() => setIsLoading(false));
  }, [playerId, season]);

  const getStatGroup = (type, group) =>
    stats?.find((s) => s.type?.displayName === type && s.group?.displayName === group)?.splits?.[0]?.stat || null;

  const seasonHitting = getStatGroup('season', 'hitting');
  const careerHitting = getStatGroup('career', 'hitting');
  const seasonPitching = getStatGroup('season', 'pitching');
  const careerPitching = getStatGroup('career', 'pitching');

  const isPitcher = playerInfo?.primaryPosition?.abbreviation === 'P' || playerInfo?.primaryPosition?.abbreviation === 'SP' || playerInfo?.primaryPosition?.abbreviation === 'RP';

  const hitCols = [
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
    { key: 'gamesPlayed', label: 'G' },
    { key: 'gamesStarted', label: 'GS' },
    { key: 'wins', label: 'W' },
    { key: 'losses', label: 'L' },
    { key: 'saves', label: 'SV' },
    { key: 'inningsPitched', label: 'IP' },
    { key: 'hits', label: 'H' },
    { key: 'runs', label: 'R' },
    { key: 'earnedRuns', label: 'ER' },
    { key: 'homeRuns', label: 'HR' },
    { key: 'baseOnBalls', label: 'BB' },
    { key: 'strikeOuts', label: 'K' },
    { key: 'era', label: 'ERA' },
    { key: 'whip', label: 'WHIP' },
  ];

  const StatsTable = ({ cols, seasonStat, careerStat }) => {
    if (!seasonStat && !careerStat) return null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/60">
              <th className="text-left py-2 font-normal pr-3 w-20">Split</th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 text-center font-normal whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasonStat && (
              <tr className="border-b border-slate-800/60 hover:bg-slate-800/20">
                <td className="py-2 pr-3 font-semibold text-slate-300">{season}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 text-center text-slate-400 font-mono">
                    {seasonStat[c.key] ?? '-'}
                  </td>
                ))}
              </tr>
            )}
            {careerStat && (
              <tr className="hover:bg-slate-800/20">
                <td className="py-2 pr-3 font-semibold text-slate-300">Career</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 text-center text-slate-400 font-mono">
                    {careerStat[c.key] ?? '-'}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const getYearByYearSplits = (group) =>
    yearByYear?.find((s) => s.type?.displayName === 'yearByYear' && s.group?.displayName === group)?.splits ?? [];

  const YearByYearTable = ({ cols, group }) => {
    const splits = getYearByYearSplits(group);
    if (!splits?.length) return null;

    const rows = splits
      .filter((sp) => sp.season && sp.stat)
      .sort((a, b) => Number(b.season) - Number(a.season));

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/60">
              <th className="text-left py-2 font-normal pr-3 w-14">Year</th>
              <th className="text-left py-2 font-normal pr-3 min-w-[140px]">Team</th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 text-center font-normal whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((sp) => (
              <tr key={`${sp.season}-${sp.team?.id ?? 'na'}`} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                <td className="py-2 pr-3 font-semibold text-slate-300">{sp.season}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {sp.team?.id && (
                      <img
                        src={teamLogoUrl(sp.team.id)}
                        alt=""
                        className="w-4 h-4 object-contain flex-shrink-0"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
                    <span className="text-slate-400 truncate">{sp.team?.name ?? '—'}</span>
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 text-center text-slate-400 font-mono">
                    {sp.stat?.[c.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm"
      >
        <i className="fa-solid fa-arrow-left" />
        Back
      </button>

      <div className="flex items-center justify-end mb-4">
        <Select
          value={season}
          onChange={setSeason}
          options={SEASON_OPTIONS}
          buttonClassName="bg-slate-900"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-20 text-slate-500">{error}</div>
      )}

      {!isLoading && !error && playerInfo && (
        <div className="bg-[#121827] border border-slate-700/60 rounded-2xl overflow-hidden">
          {/* Hero */}
          <div
            className="relative overflow-hidden px-5 sm:px-8 py-6 sm:py-8"
            style={{
              backgroundImage: `url(${playerHeroShotUrl(playerId)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: '283px'
            
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/85 pointer-events-none" />
            <div className="flex items-end gap-4 sm:gap-6">
              <div className="relative flex-shrink-0">
                <img
                  src={playerHeadshotUrl(playerId)}
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-600"
                  alt={playerInfo.fullName}
                />
                {playerInfo.currentTeam?.id && (
                  <img
                    src={teamLogoUrl(playerInfo.currentTeam.id)}
                    className="absolute -bottom-2 -right-2 w-8 h-8 sm:w-9 sm:h-9 object-contain bg-slate-900 rounded-xl p-1 border border-slate-700"
                    alt=""
                  />
                )}
              </div>
              <div className="pb-1">
                <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-1">
                  {playerInfo.currentTeam?.name || '—'} · #{playerInfo.primaryNumber || '—'}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-none mb-1">{playerInfo.fullName}</h1>
                <div className="text-slate-400 text-sm">
                  {playerInfo.primaryPosition?.name || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Bio stats */}
          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Bats / Throws', value: `${playerInfo.batSide?.code || '—'} / ${playerInfo.pitchHand?.code || '—'}` },
              { label: 'Height / Weight', value: `${playerInfo.height || '—'} / ${playerInfo.weight ? `${playerInfo.weight} lb` : '—'}` },
              { label: 'Born', value: playerInfo.birthDate ? new Date(playerInfo.birthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
              { label: 'Birthplace', value: [playerInfo.birthCity, playerInfo.birthStateProvince, playerInfo.birthCountry].filter(Boolean).join(', ') || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-sm font-semibold text-slate-200">{value}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="px-5 sm:px-8 py-5 sm:py-6 space-y-6">
            {(seasonHitting || careerHitting) && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Batting</div>
                <div className="overflow-x-auto">
                  <StatsTable cols={hitCols} seasonStat={seasonHitting} careerStat={careerHitting} />
                </div>
              </div>
            )}
            {(seasonPitching || careerPitching) && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Pitching</div>
                <div className="overflow-x-auto">
                  <StatsTable cols={pitchCols} seasonStat={seasonPitching} careerStat={careerPitching} />
                </div>
              </div>
            )}
            <div className="pt-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                Career by Year
              </div>
              {!isPitcher && <YearByYearTable cols={hitCols} group="hitting" />}
              {isPitcher && <YearByYearTable cols={pitchCols} group="pitching" />}
              {!getYearByYearSplits('hitting')?.length && !getYearByYearSplits('pitching')?.length && (
                <div className="text-slate-600 text-sm text-center py-6">No year-by-year data available</div>
              )}
            </div>
            {!seasonHitting && !careerHitting && !seasonPitching && !careerPitching && (
              <div className="text-slate-600 text-sm text-center py-6">No stats available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
