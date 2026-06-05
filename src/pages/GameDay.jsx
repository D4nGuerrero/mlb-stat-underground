import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMLBWebSocket } from '../hooks/useMLBWebSocket';
import {
  teamLogoUrl,
  playerHeadshotUrl,
  playerActionShotUrl,
  pitcherActionShotUrl,
  stadiumInfieldUrl,
  stadiumExteriorUrl,
  stadiumTimeOfDay,
  batterSilhouetteUrl,
  renderBaseDiamond,
} from '../utils/mlbHelpers';
import PitchCanvas from '../components/PitchCanvas';
import { TabBar, Modal, SegmentedControl } from '../components/ui';

// ─── helpers ────────────────────────────────────────────────────────────────

const PLAY_BADGE = {
  single: {
    label: 'Single',
    cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  double: {
    label: 'Double',
    cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  triple: {
    label: 'Triple',
    cls: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/50',
  },
  home_run: {
    label: 'Home Run',
    cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  strikeout: {
    label: 'Strikeout',
    cls: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  walk: {
    label: 'Walk',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  intent_walk: {
    label: 'IBB',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  hit_by_pitch: {
    label: 'HBP',
    cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  field_out: {
    label: 'Out',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  lineout: {
    label: 'Lineout',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  flyout: {
    label: 'Flyout',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  groundout: {
    label: 'Groundout',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  pop_out: {
    label: 'Pop Out',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  grounded_into_double_play: {
    label: 'GIDP',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  double_play: {
    label: 'Double Play',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  triple_play: {
    label: 'Triple Play!',
    cls: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  force_out: {
    label: 'Force Out',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  field_error: {
    label: 'Error',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  sac_fly: {
    label: 'Sac Fly',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  sac_bunt: {
    label: 'Sac Bunt',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  stolen_base_2b: {
    label: 'Stolen Base',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  stolen_base_3b: {
    label: 'Stolen Base',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  stolen_base_home: {
    label: 'Steal Home!',
    cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  caught_stealing_2b: {
    label: 'CS',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  caught_stealing_3b: {
    label: 'CS',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  wild_pitch: {
    label: 'Wild Pitch',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  passed_ball: {
    label: 'Passed Ball',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  balk: {
    label: 'Balk',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
};

const getPlayBadge = (et) =>
  PLAY_BADGE[et] || {
    label: et?.replace(/_/g, ' ') || '—',
    cls: 'bg-slate-700/40 text-slate-400 border-slate-700/40',
  };

const getAllBatters = (teamBox) =>
  Object.values(teamBox?.players || {})
    .filter((p) => p.battingOrder)
    .sort((a, b) => parseInt(a.battingOrder) - parseInt(b.battingOrder));

const getSubLetter = (order) => {
  const suffix = parseInt(order) % 100;
  return suffix === 0 ? null : String.fromCharCode(96 + suffix);
};

const fmtEra = (era) => (era != null ? parseFloat(era).toFixed(2) : null);

const ORDINALS = [
  '',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
  '13th',
];

// ─── component ──────────────────────────────────────────────────────────────

export default function GamePage() {
  const { gamePk } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('live');
  const [vsStats, setVsStats] = useState(null);
  // Track whether we pushed a history entry for the sheet
  const sheetHistoryRef = useRef(false);
  const vsStatsCacheRef = useRef({});

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gamePk]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  const { status: wsStatus, lastUpdate } = useMLBWebSocket(
    gamePk ? parseInt(gamePk) : null,
    feed?.gameData?.status?.abstractGameState,
  );

  useEffect(() => {
    if (lastUpdate) fetchGame();
  }, [lastUpdate]);

  // Hide nav bar on mobile while game page is open
  useEffect(() => {
    document.body.classList.add('game-page-open');
    return () => document.body.classList.remove('game-page-open');
  }, []);

  const venueId = feed?.gameData?.venue?.id;
  const exteriorTimeOfDay = stadiumTimeOfDay(feed?.gameData?.gameDate);
  const [exteriorFailed, setExteriorFailed] = useState(false);

  useEffect(() => {
    if (!venueId) {
      setExteriorFailed(true);
      return;
    }
    setExteriorFailed(false);
    const img = new Image();
    img.onload = () => setExteriorFailed(false);
    img.onerror = () => setExteriorFailed(true);
    img.src = stadiumExteriorUrl(venueId, exteriorTimeOfDay);
  }, [venueId, exteriorTimeOfDay]);

  // History API: push state when sheet opens so back button closes it
  const openSheet = useCallback((play) => {
    setSelectedPlay(play);
    window.history.pushState({ mlbSheet: true }, '');
    sheetHistoryRef.current = true;
  }, []);

  const closeSheet = useCallback(() => {
    setSelectedPlay(null);
    if (sheetHistoryRef.current) {
      sheetHistoryRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const onPopState = (e) => {
      if (selectedPlay) {
        sheetHistoryRef.current = false;
        setSelectedPlay(null);
        // Prevent route navigation — do nothing else
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedPlay]);

  // ── batter vs pitcher head-to-head stats ───────────────────────────────────
  useEffect(() => {
    const batterId = feed?.liveData?.linescore?.offense?.batter?.id;
    const pitcherId = feed?.liveData?.linescore?.defense?.pitcher?.id;
    if (!batterId || !pitcherId) { setVsStats(null); return; }
    const key = `${batterId}-${pitcherId}`;
    if (vsStatsCacheRef.current[key] !== undefined) {
      setVsStats(vsStatsCacheRef.current[key]);
      return;
    }
    const season = new Date().getFullYear();
    fetch(
      `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=batting,type=vsPlayerTotal,opposingPlayerId=${pitcherId},season=${season})`,
    )
      .then((r) => r.json())
      .then((data) => {
        const stat =
          data.people?.[0]?.stats?.find(
            (s) =>
              s.type?.displayName === 'vsPlayerTotal' ||
              s.type?.displayName === 'vsPlayer',
          )?.splits?.[0]?.stat || null;
        vsStatsCacheRef.current[key] = stat;
        setVsStats(stat);
      })
      .catch(() => {
        vsStatsCacheRef.current[key] = null;
        setVsStats(null);
      });
  }, [
    feed?.liveData?.linescore?.offense?.batter?.id,
    feed?.liveData?.linescore?.defense?.pitcher?.id,
  ]);

  // ── derived data ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !feed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⚾</div>
        <div className="text-red-400 font-semibold mb-2">
          Failed to load game
        </div>
        <div className="text-slate-500 text-sm mb-6">{error}</div>
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-sm transition-all"
        >
          ← Back to Game Day
        </button>
      </div>
    );
  }

  const gd = feed.gameData;
  const ld = feed.liveData;
  const status = gd.status;
  const away = gd.teams.away;
  const home = gd.teams.home;
  const ls = ld.linescore;
  const isLive = status.abstractGameState === 'Live';
  const isFinal = status.abstractGameState === 'Final';
  const decisions = ld.decisions;

  const allPitchEvents = ld.plays?.currentPlay?.playEvents || [];
  const pitchesSoFar = allPitchEvents.filter((e) => e.isPitch);
  const latestPitch = pitchesSoFar[pitchesSoFar.length - 1];
  const szTop = latestPitch?.pitchData?.strikeZoneTop || 3.5;
  const szBot = latestPitch?.pitchData?.strikeZoneBottom || 1.5;
  const currentPlay = ld.plays?.currentPlay;
  const batSide = currentPlay?.matchup?.batSide?.code || 'R';
  const batterIsAway = ls?.inningHalf === 'Top'; // top inning → away team bats

  const awayRuns = ls?.teams?.away?.runs ?? 0;
  const homeRuns = ls?.teams?.home?.runs ?? 0;
  const awayWins = isFinal && awayRuns > homeRuns;
  const homeWins = isFinal && homeRuns > awayRuns;

  const getPitcherStats = (playerId) => {
    const allPlayers = {
      ...(ld.boxscore?.teams?.away?.players || {}),
      ...(ld.boxscore?.teams?.home?.players || {}),
    };
    const player = allPlayers[`ID${playerId}`];
    return player?.seasonStats?.pitching || player?.stats?.pitching || null;
  };

  const allPlays = ld.plays?.allPlays || [];
  const completePlays = allPlays.filter(
    (p) => p.about?.isComplete && p.result?.event,
  );
  const summaryPlays =
    summaryFilter === 'scoring'
      ? completePlays.filter((p) => p.about?.isScoringPlay)
      : completePlays;

  const inningGroups = summaryPlays.reduce((acc, play) => {
    const half = play.about?.halfInning === 'top' ? 'Top' : 'Bot';
    const ord = ORDINALS[play.about?.inning] || play.about?.inning;
    const key = `${half} ${ord}`;
    const group = acc.find((g) => g.key === key);
    if (group) group.plays.push(play);
    else acc.push({ key, plays: [play] });
    return acc;
  }, []);

  // ── Team Box Score ─────────────────────────────────────────────────────────

  const TeamBoxSection = ({ sideKey, team }) => {
    const teamBox = ld.boxscore?.teams?.[sideKey];
    if (!teamBox) return null;

    const batters = getAllBatters(teamBox);
    const pitcherIds = teamBox.pitchers || [];
    const pitchers = pitcherIds
      .map((id) => teamBox.players?.[`ID${id}`])
      .filter(Boolean);

    const subNotes = batters
      .filter((p) => p.note)
      .map((p) => {
        const letter = getSubLetter(p.battingOrder);
        return letter ? `${letter}-${p.note}` : p.note;
      });

    const battingTotals = batters.reduce(
      (acc, p) => {
        const b = p.stats?.batting || {};
        return {
          ab: acc.ab + (b.atBats || 0),
          r: acc.r + (b.runs || 0),
          h: acc.h + (b.hits || 0),
          rbi: acc.rbi + (b.rbi || 0),
          bb: acc.bb + (b.baseOnBalls || 0),
          so: acc.so + (b.strikeOuts || 0),
        };
      },
      { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
    );

    const pitchingTotals = pitchers.reduce(
      (acc, p) => {
        const pt = p.stats?.pitching || {};
        return {
          ip: acc.ip + parseFloat(pt.inningsPitched || 0),
          h: acc.h + (pt.hits || 0),
          r: acc.r + (pt.runs || 0),
          er: acc.er + (pt.earnedRuns || 0),
          bb: acc.bb + (pt.baseOnBalls || 0),
          k: acc.k + (pt.strikeOuts || 0),
          hr: acc.hr + (pt.homeRuns || 0),
        };
      },
      { ip: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 },
    );

    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <img
            src={teamLogoUrl(team.id)}
            className="w-5 h-5 object-contain"
            alt={team.abbreviation}
          />
          <span className="font-bold text-sm text-slate-100">
            {team.teamName || team.abbreviation}
          </span>
        </div>

        <div className="overflow-x-auto mb-2">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/60">
                <th className="text-left py-1.5 font-normal">BATTING</th>
                {['AB', 'R', 'H', 'RBI', 'BB', 'SO'].map((h) => (
                  <th key={h} className="px-2 text-center font-normal w-8">
                    {h}
                  </th>
                ))}
                <th className="px-2 text-center font-normal w-10">AVG</th>
                <th className="px-2 text-center font-normal w-10">OPS</th>
              </tr>
            </thead>
            <tbody>
              {batters.map((p) => {
                const b = p.stats?.batting || {};
                const sb = p.seasonStats?.batting || {};
                const subLetter = getSubLetter(p.battingOrder);
                const lastName =
                  p.person?.fullName?.split(' ').slice(-1)[0] || '';
                const pos = p.position?.abbreviation || '';
                return (
                  <tr
                    key={p.person?.id}
                    className="border-b border-slate-800/40 hover:bg-slate-800/20"
                  >
                    <td className="py-1.5 pr-2">
                      <button
                        onClick={() => navigate(`/player/${p.person?.id}`)}
                        className="text-left hover:text-emerald-400 transition-colors"
                      >
                        {subLetter && (
                          <span className="text-slate-500 mr-0.5">
                            {subLetter}-
                          </span>
                        )}
                        <span
                          className={
                            subLetter ? 'text-slate-400' : 'text-slate-200'
                          }
                        >
                          {lastName}
                        </span>
                      </button>
                      <span className="text-slate-600 ml-1 text-[10px]">
                        {pos}
                      </span>
                    </td>
                    <td className="px-2 text-center text-slate-400">
                      {b.atBats ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-400">
                      {b.runs ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-400">
                      {b.hits ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-400">
                      {b.rbi ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-400">
                      {b.baseOnBalls ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-400">
                      {b.strikeOuts ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-500 font-mono">
                      {sb.avg ?? '-'}
                    </td>
                    <td className="px-2 text-center text-slate-500 font-mono">
                      {sb.ops ?? '-'}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-700 font-bold text-slate-300">
                <td className="py-1.5 pr-2">Totals</td>
                {[
                  battingTotals.ab,
                  battingTotals.r,
                  battingTotals.h,
                  battingTotals.rbi,
                  battingTotals.bb,
                  battingTotals.so,
                ].map((v, i) => (
                  <td key={i} className="px-2 text-center">
                    {v}
                  </td>
                ))}
                <td className="px-2" />
                <td className="px-2" />
              </tr>
            </tbody>
          </table>
        </div>

        {subNotes.length > 0 && (
          <div className="mb-3 text-[11px] text-slate-500 space-y-0.5 italic">
            {subNotes.map((note, i) => (
              <div key={i}>{note}</div>
            ))}
          </div>
        )}

        {(teamBox.info || []).map((section) => (
          <div key={section.title} className="mb-2">
            <div className="text-[11px] font-bold text-slate-400 mb-0.5">
              {section.title}
            </div>
            <div className="text-[11px] text-slate-500 space-y-0.5">
              {(section.fieldList || []).map((field, i) => (
                <div key={i}>
                  <span className="font-semibold text-slate-400">
                    {field.label}{' '}
                  </span>
                  {field.value}
                </div>
              ))}
            </div>
          </div>
        ))}

        {pitchers.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/60">
                  <th className="text-left py-1.5 font-normal">PITCHING</th>
                  {['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'ERA'].map((h) => (
                    <th key={h} className="px-2 text-center font-normal w-8">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitchers.map((p) => {
                  const pt = p.stats?.pitching || {};
                  const seasonEra = p.seasonStats?.pitching?.era;
                  const lastName =
                    p.person?.fullName?.split(' ').slice(-1)[0] || '';
                  const decMark =
                    decisions?.winner?.id === p.person?.id
                      ? 'W'
                      : decisions?.loser?.id === p.person?.id
                        ? 'L'
                        : decisions?.save?.id === p.person?.id
                          ? 'SV'
                          : null;
                  return (
                    <tr
                      key={p.person?.id}
                      className="border-b border-slate-800/40 hover:bg-slate-800/20"
                    >
                      <td className="py-1.5 pr-2 flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/player/${p.person?.id}`)}
                          className="hover:text-emerald-400 transition-colors text-slate-200"
                        >
                          {lastName}
                        </button>
                        {decMark && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                            {decMark}
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-center text-slate-400 font-mono">
                        {pt.inningsPitched ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-400">
                        {pt.hits ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-400">
                        {pt.runs ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-400">
                        {pt.earnedRuns ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-400">
                        {pt.baseOnBalls ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-400">
                        {pt.strikeOuts ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-400">
                        {pt.homeRuns ?? '-'}
                      </td>
                      <td className="px-2 text-center text-slate-500 font-mono">
                        {seasonEra != null
                          ? parseFloat(seasonEra).toFixed(2)
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-700 font-bold text-slate-300">
                  <td className="py-1.5 pr-2">Totals</td>
                  <td className="px-2 text-center font-mono">
                    {pitchingTotals.ip.toFixed(1)}
                  </td>
                  {[
                    pitchingTotals.h,
                    pitchingTotals.r,
                    pitchingTotals.er,
                    pitchingTotals.bb,
                    pitchingTotals.k,
                    pitchingTotals.hr,
                  ].map((v, i) => (
                    <td key={i} className="px-2 text-center">
                      {v}
                    </td>
                  ))}
                  <td className="px-2 text-center" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Play Detail Bottom Sheet ───────────────────────────────────────────────

  const PlayDetailSheet = () => {
    if (!selectedPlay) return null;

    const play = selectedPlay;
    const pitches = (play.playEvents || []).filter((e) => e.isPitch);
    const hitData = play.hitData;
    const badge = getPlayBadge(play.result?.eventType);
    const szT = pitches[pitches.length - 1]?.pitchData?.strikeZoneTop || 3.5;
    const szB = pitches[pitches.length - 1]?.pitchData?.strikeZoneBottom || 1.5;
    const inningStr = `${play.about?.halfInning === 'top' ? 'TOP' : 'BOT'} ${play.about?.inning}`;
    const scoreStr = `${away.abbreviation} ${play.result?.awayScore ?? 0} – ${home.abbreviation} ${play.result?.homeScore ?? 0}`;
    const hasHitData =
      hitData &&
      (hitData.launchSpeed != null ||
        hitData.totalDistance != null ||
        hitData.launchAngle != null);

    const pitcherName = play.matchup?.pitcher?.fullName || '—';
    const batterName = play.matchup?.batter?.fullName || '—';
    const pitcherId = play.matchup?.pitcher?.id;
    const batterId = play.matchup?.batter?.id;

    const lastCount = pitches[pitches.length - 1]?.count;
    const finalBalls = play.count?.balls ?? lastCount?.balls ?? 0;
    const finalStrikes = play.count?.strikes ?? lastCount?.strikes ?? 0;
    const outs = play.count?.outs ?? 0;

    // extra hitData fields
    const trajectory = hitData?.trajectory?.replace(/_/g, ' ');
    const hardness = hitData?.hardness;
    const location = hitData?.location;

    return (
      <Modal
        open
        onClose={closeSheet}
        size="md"
        panelClassName="max-h-[88vh] sm:max-h-[92vh] overflow-y-auto bg-[#0d1520] border-slate-700/70 p-0"
      >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-[#0d1520] z-10">
            <div className="w-10 h-1 rounded-full bg-slate-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-700/40">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 font-mono">
                {inningStr}
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500 font-mono">
                {scoreStr}
              </span>
            </div>
            <button
              onClick={closeSheet}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-sm"
            >
              ×
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Result banner */}
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex items-center text-xs px-3 py-1.5 rounded-full border font-bold flex-shrink-0 ${badge.cls}`}
              >
                {badge.label}
              </span>
              <p className="text-slate-200 text-sm leading-snug pt-0.5">
                {play.result?.description}
              </p>
            </div>

            {/* Hit data cards */}
            {hasHitData && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">
                  Hit Data
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Exit Velo',
                      value:
                        hitData.launchSpeed != null
                          ? parseFloat(hitData.launchSpeed).toFixed(1)
                          : null,
                      unit: 'mph',
                      icon: '💨',
                    },
                    {
                      label: 'Distance',
                      value:
                        hitData.totalDistance != null
                          ? hitData.totalDistance
                          : null,
                      unit: 'ft',
                      icon: '📏',
                    },
                    {
                      label: 'Angle',
                      value:
                        hitData.launchAngle != null
                          ? hitData.launchAngle
                          : null,
                      unit: '°',
                      icon: '📐',
                    },
                  ].map(({ label, value, unit, icon }) => (
                    <div
                      key={label}
                      className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center"
                    >
                      <div className="text-base mb-1">{icon}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
                        {label}
                      </div>
                      <div className="font-bold text-white text-xl leading-none">
                        {value ?? '—'}
                      </div>
                      {value != null && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Extra hit metadata */}
                {(trajectory || hardness || location) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {trajectory && (
                      <span className="text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700/40 rounded-full text-slate-400 capitalize">
                        {trajectory}
                      </span>
                    )}
                    {hardness && (
                      <span
                        className={`text-[11px] px-2.5 py-1 border rounded-full ${
                          hardness === 'hard'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : hardness === 'soft'
                              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                              : 'bg-slate-800 border-slate-700/40 text-slate-400'
                        } capitalize`}
                      >
                        {hardness} contact
                      </span>
                    )}
                    {location && (
                      <span className="text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700/40 rounded-full text-slate-400">
                        Zone {location}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Matchup */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest px-4 pt-3 pb-1">
                At Bat Matchup
              </div>
              <div className="flex items-stretch">
                <button
                  className="flex-1 flex flex-col items-center gap-2 p-4 hover:bg-slate-700/30 transition-colors border-r border-slate-700/40"
                  onClick={() => {
                    setSelectedPlay(null);
                    navigate(`/player/${pitcherId}`);
                  }}
                >
                  <img
                    src={playerHeadshotUrl(pitcherId)}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700"
                    alt=""
                  />
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-200 leading-tight">
                      {pitcherName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {play.matchup?.pitchHand?.code
                        ? `${play.matchup.pitchHand.code}H Pitcher`
                        : 'Pitcher'}
                    </div>
                  </div>
                </button>

                <div className="flex flex-col items-center justify-center px-4 gap-3">
                  <div>
                    <div className="text-[9px] text-slate-600 text-center mb-1">
                      OUTS
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full border ${i < outs ? 'bg-red-400 border-red-400' : 'border-slate-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-600 mb-0.5">
                      COUNT
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200 leading-none">
                      {finalBalls}-{finalStrikes}
                    </div>
                  </div>
                  <div className="text-slate-600 text-lg">⚔</div>
                </div>

                <button
                  className="flex-1 flex flex-col items-center gap-2 p-4 hover:bg-slate-700/30 transition-colors border-l border-slate-700/40"
                  onClick={() => {
                    setSelectedPlay(null);
                    navigate(`/player/${batterId}`);
                  }}
                >
                  <img
                    src={playerHeadshotUrl(batterId)}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700"
                    alt=""
                  />
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-200 leading-tight">
                      {batterName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {play.matchup?.batSide?.code
                        ? `Bats ${play.matchup.batSide.code}`
                        : 'Batter'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Pitch locations (canvas) */}
            {pitches.length > 0 && (
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                  Pitch Locations
                </div>
                <PitchCanvas
                  playEvents={play.playEvents || []}
                  szTop={szT}
                  szBot={szB}
                  width={260}
                  height={280}
                  gamePk={gamePk}
                  variant="gamedayDark"
                  className="mx-auto"
                />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500 justify-center">
                  {[
                    { color: 'bg-red-400', label: 'Called K' },
                    { color: 'bg-orange-400', label: 'Swing K' },
                    { color: 'bg-green-400', label: 'Ball' },
                    { color: 'bg-blue-500', label: 'In Play' },
                    { color: 'bg-slate-400', label: 'Foul' },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pitch sequence with enhanced data */}
            {pitches.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                  Pitch Sequence · {pitches.length} pitch
                  {pitches.length !== 1 ? 'es' : ''}
                </div>
                <div className="space-y-1.5">
                  {pitches.map((pitch, i) => {
                    const desc = pitch.details?.description || '';
                    const type = pitch.details?.type?.description || '';
                    const mph = pitch.pitchData?.startSpeed
                      ? parseFloat(pitch.pitchData.startSpeed).toFixed(1)
                      : null;
                    const effMph = pitch.pitchData?.effectiveSpeed
                      ? parseFloat(pitch.pitchData.effectiveSpeed).toFixed(1)
                      : null;
                    const spinRate = pitch.pitchData?.breaks?.spinRate;
                    const breakIn = pitch.pitchData?.breaks?.breakLength;
                    const countAfter = pitch.count;
                    const isBall =
                      desc.toLowerCase().includes('ball') &&
                      !desc.toLowerCase().includes('in play');
                    const isInPlay = desc.toLowerCase().includes('in play');
                    const isFoul = desc.toLowerCase().includes('foul');
                    const isSwingK = desc.toLowerCase().includes('swinging');
                    const dotColor = isInPlay
                      ? 'bg-blue-500'
                      : isBall
                        ? 'bg-green-500'
                        : isFoul
                          ? 'bg-slate-400'
                          : isSwingK
                            ? 'bg-orange-400'
                            : 'bg-red-500';
                    const rowBg = isInPlay
                      ? 'bg-blue-500/5 border-blue-500/10'
                      : 'border-transparent';
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 text-xs rounded-xl px-2.5 py-2.5 border ${rowBg}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5 ${dotColor}`}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-200 leading-tight">
                            {desc || '—'}
                          </div>
                          {type && (
                            <div className="text-slate-600 text-[10px] mt-0.5">
                              {type}
                            </div>
                          )}
                          {(spinRate || breakIn) && (
                            <div className="flex gap-3 mt-1">
                              {spinRate && (
                                <span className="text-[10px] text-slate-500">
                                  <span className="text-slate-400">
                                    {Math.round(spinRate)}
                                  </span>{' '}
                                  rpm
                                </span>
                              )}
                              {breakIn && (
                                <span className="text-[10px] text-slate-500">
                                  <span className="text-slate-400">
                                    {parseFloat(breakIn).toFixed(1)}
                                  </span>
                                  ″ brk
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {mph && (
                            <div>
                              <span className="font-bold text-slate-300 font-mono">
                                {mph}
                              </span>
                              <span className="text-slate-600 text-[9px] ml-0.5">
                                mph
                              </span>
                              {effMph && mph !== effMph && (
                                <span className="text-slate-600 text-[9px] ml-1">
                                  ({effMph} eff)
                                </span>
                              )}
                            </div>
                          )}
                          {countAfter && (
                            <div className="font-mono text-[10px] text-slate-500">
                              {countAfter.balls}-{countAfter.strikes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
      </Modal>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  const tabList = [
    ...(isLive ? [{ key: 'live', label: 'Live Situation' }] : []),
    { key: 'boxscore', label: 'Box Score' },
    { key: 'summary', label: 'Summary' },
  ];

  const currentTab = !isLive && activeTab === 'live' ? 'boxscore' : activeTab;

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-6 py-0 sm:py-8">
      {/* Mobile compact sticky header — shows instead of nav */}
      <div className="sm:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800/60 flex items-center justify-between px-4 py-3">
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="flex items-center gap-2 text-sm text-slate-300 active:text-white"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          <span>Scores</span>
        </button>
        <div className="flex items-center gap-2 font-bold text-sm">
          <img
            src={teamLogoUrl(away.id)}
            className="w-5 h-5 object-contain"
            alt={away.abbreviation}
          />
          <span className={awayWins ? 'text-white' : 'text-slate-400'}>
            {awayRuns}
          </span>
          <span className="text-slate-600 text-xs">—</span>
          <span className={homeWins ? 'text-white' : 'text-slate-400'}>
            {homeRuns}
          </span>
          <img
            src={teamLogoUrl(home.id)}
            className="w-5 h-5 object-contain"
            alt={home.abbreviation}
          />
        </div>
        {isLive ? (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <div className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" />
            <span>
              {ls?.inningHalf === 'Top' ? '▲' : '▼'}
              {ls?.currentInning}
            </span>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 font-semibold">FINAL</div>
        )}
      </div>

      {/* Desktop: back + ws status */}
      <div className="hidden sm:flex items-center justify-between mb-4 px-0">
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          <span>Scores</span>
        </button>
        {isLive && (
          <div
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              wsStatus === 'connected'
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                  ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                  : 'text-slate-500 border-slate-700/40'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : wsStatus === 'reconnecting' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`}
            />
            {wsStatus === 'connected'
              ? 'Live'
              : wsStatus === 'reconnecting'
                ? 'Reconnecting…'
                : 'Connecting…'}
          </div>
        )}
      </div>

      <div className="px-3 sm:px-0">
        {/* Scoreboard */}
        <div className="bg-[#121827] border border-slate-700/60 rounded-2xl overflow-hidden mb-4">
          {/* Game date / venue */}
          <div className="px-5 pt-3.5 pb-0 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{gd.venue?.name}</span>
            <span
              className={`text-[11px] font-bold ${isLive ? 'text-red-400' : 'text-slate-400'}`}
            >
              {isLive ? '● LIVE' : isFinal ? 'FINAL' : status.abstractGameState}
            </span>
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5">
            {/* Away */}
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src={teamLogoUrl(away.id)}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                alt={away.abbreviation}
                onClick={() => navigate(`/team/${away.id}`)}
              />
              <div>
                <div className="text-sm font-bold text-slate-200 leading-none mb-1">
                  {away.abbreviation}
                </div>
                <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                  {away.record
                    ? `${away.record.wins} - ${away.record.losses}`
                    : ''}
                </div>
              </div>
            </div>

            {/* Scores */}
            <div className="flex items-center gap-3 sm:gap-6">
              <span
                className={`font-display text-4xl sm:text-5xl tabular-nums leading-none ${awayWins ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
              >
                {awayRuns}
              </span>
              <div className="text-center min-w-[56px] sm:min-w-[80px]">
                {isLive ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-red-400 rounded-full live-pulse" />
                      <span className="text-red-400 font-bold text-xs sm:text-sm tracking-wide">
                        LIVE
                      </span>
                    </div>
                    <span className="text-slate-300 text-xs font-semibold">
                      {ls?.inningHalf === 'Top' ? '▲' : '▼'}{' '}
                      {ls?.currentInningOrdinal}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-300 font-bold tracking-widest text-xs sm:text-sm">
                    FINAL
                  </span>
                )}
              </div>
              <span
                className={`font-display text-4xl sm:text-5xl tabular-nums leading-none ${homeWins ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
              >
                {homeRuns}
              </span>
            </div>

            {/* Home */}
            <div className="flex items-center gap-2 sm:gap-3 justify-end">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-200 leading-none mb-1">
                  {home.abbreviation}
                </div>
                <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                  {home.record
                    ? `${home.record.wins} - ${home.record.losses}`
                    : ''}
                </div>
              </div>
              <img
                src={teamLogoUrl(home.id)}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                alt={home.abbreviation}
                onClick={() => navigate(`/team/${home.id}`)}
              />
            </div>
          </div>

          {/* Linescore */}
          <div className="bg-slate-800/40 border-t border-slate-700/50">
            <div className="overflow-x-auto px-4 sm:px-6 py-3">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left py-1.5 w-14" />
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <th key={i} className="px-2 text-center font-normal w-8">
                        {i}
                      </th>
                    ))}
                    <th className="px-3 text-center font-bold border-l border-slate-600 w-8">
                      R
                    </th>
                    <th className="px-2 text-center font-normal w-8">H</th>
                    <th className="px-2 text-center font-normal w-8">E</th>
                  </tr>
                </thead>
                <tbody className="">
                  {[
                    { team: away, side: 'away', runs: awayRuns },
                    { team: home, side: 'home', runs: homeRuns },
                  ].map(({ team, side, runs }) => (
                    <tr key={side} className="border-t border-slate-700/40">
                      <td className="py-2 font-bold text-slate-200 w-14">
                        {team.abbreviation}
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                        const inn = ls?.innings?.find((n) => n.num === i);
                        const val = inn?.[side]?.runs;
                        return (
                          <td
                            key={i}
                            className="px-2 text-center font-mono text-slate-300 w-8"
                          >
                            {val > 0 ? (
                              <span className="text-green-400 font-bold">
                                {val}
                              </span>
                            ) : val === 0 ? (
                              <span>0</span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 text-center font-bold border-l border-slate-600 w-8">
                        {runs}
                      </td>
                      <td className="px-2 text-center text-slate-400 w-8">
                        {ls?.teams?.[side]?.hits ?? 0}
                      </td>
                      <td className="px-2 text-center text-slate-500 w-8">
                        {ls?.teams?.[side]?.errors ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pitcher decisions */}
          {decisions &&
            (decisions.winner || decisions.loser || decisions.save) && (
              <div className="px-4 sm:px-6 py-3 grid grid-cols-3 gap-2 sm:gap-4 border-t border-slate-700/50 text-sm">
                {[
                  { label: 'W', player: decisions.winner },
                  { label: 'L', player: decisions.loser },
                  { label: 'S', player: decisions.save },
                ].map(({ label, player }) => {
                  if (!player) return <div key={label} />;
                  const stats = getPitcherStats(player.id);
                  const lastName =
                    player.fullName?.split(' ').slice(-1)[0] ?? player.fullName;
                  return (
                    <div key={label}>
                      <span className="text-slate-500 font-semibold mr-1">
                        {label}:
                      </span>
                      <button
                        onClick={() => navigate(`/player/${player.id}`)}
                        className="font-semibold text-slate-100 hover:text-emerald-400 transition-colors"
                      >
                        {lastName}
                      </button>
                      {stats && (
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {label === 'S'
                            ? stats.saves != null
                              ? `${stats.saves} SV${fmtEra(stats.era) ? `  ${fmtEra(stats.era)} ERA` : ''}`
                              : null
                            : `${stats.wins ?? 0}-${stats.losses ?? 0}${fmtEra(stats.era) ? `  ${fmtEra(stats.era)} ERA` : ''}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Tab nav */}
        <TabBar
          className="mb-4"
          variant="standalone"
          tabs={tabList}
          activeKey={currentTab}
          onChange={setActiveTab}
        />

        {/* Tab content */}
        {currentTab === 'live' && isLive && ls && (
          <div className="space-y-3">

            {/* ── AT-BAT VISUAL: Composite stadium (exterior top + infield bottom) + PitchCanvas + silhouette ── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 min-h-[320px] flex flex-col">
              {/* Background stack: top half exterior, bottom half infield */}
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                <div
                  className="h-[48%] min-h-[130px] bg-cover bg-center bg-top"
                  style={{
                    backgroundImage:
                      venueId && !exteriorFailed
                        ? `url(${stadiumExteriorUrl(venueId, exteriorTimeOfDay)})`
                        : undefined,
                    backgroundColor:
                      !venueId || exteriorFailed ? '#0f172a' : undefined,
                  }}
                />
                <div
                  className="flex-1 min-h-[130px] bg-cover"
                  style={{
                    backgroundImage: `url(${stadiumInfieldUrl()})`,
                    backgroundPosition: 'center 30%',
                  }}
                />
              </div>
              {/* Seam blend between halves */}
              <div
                className="absolute left-0 right-0 top-[48%] h-16 -translate-y-1/2 z-[1] pointer-events-none bg-gradient-to-b from-transparent via-black/35 to-transparent"
                aria-hidden
              />
              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/80 pointer-events-none z-[2]" />

              {/* Top bar: LIVE badge + inning indicator + count summary */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-red-400 tracking-wide">LIVE</span>
                  <span className="text-[10px] text-white/80 font-mono ml-1">
                    {ls.inningHalf === 'Top' ? '▲' : '▼'}{ls.currentInningOrdinal}
                  </span>
                </div>
                <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="text-[10px] font-mono text-white font-bold">
                    {ls.balls ?? 0}–{ls.strikes ?? 0} · {ls.outs ?? 0} out{ls.outs !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Pitch canvas centered */}
              <div className="relative z-10 flex flex-col items-center pt-12 pb-20 px-3">
                {latestPitch && (
                  <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
                    {latestPitch.details?.type?.description && (
                      <span className="text-[11px] bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-0.5 rounded-full text-white font-medium">
                        {latestPitch.details.type.description}
                      </span>
                    )}
                    {latestPitch.pitchData?.startSpeed && (
                      <span className="text-base font-bold font-mono text-white">
                        {Math.round(latestPitch.pitchData.startSpeed)}
                        <span className="text-xs text-white/50 ml-0.5">mph</span>
                      </span>
                    )}
                  </div>
                )}
                {latestPitch?.details?.description && (
                  <div className="text-[10px] text-white/55 mb-2 italic text-center">
                    {latestPitch.details.description}
                  </div>
                )}
                <PitchCanvas
                  playEvents={allPitchEvents}
                  szTop={szTop}
                  szBot={szBot}
                  width={280}
                  height={300}
                  gamePk={gamePk}
                  variant="gamedayDark"
                  className="mx-auto"
                />
              </div>

              {/* Batter silhouette at plate bottom */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                style={{ height: '90px' }}
              >
                <img
                  src={batterSilhouetteUrl(batSide, batterIsAway ? 'away' : 'home')}
                  className="h-full w-auto object-contain"
                  alt=""
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* ── MATCHUP ROW: Pitcher | Count+Outs+Diamond | Batter ── */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-slate-800">
                {/* Pitcher */}
                <button
                  className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-800/40 transition-colors"
                  onClick={() => navigate(`/player/${ls.defense?.pitcher?.id}`)}
                >
                  <div className="text-[8px] text-slate-500 uppercase tracking-widest">
                    Pitching
                  </div>
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 flex-shrink-0">
                    <img
                      src={pitcherActionShotUrl(ls.defense?.pitcher?.id)}
                      className="w-full h-full object-cover object-top"
                      alt=""
                      onError={(e) => {
                        e.target.src = playerHeadshotUrl(ls.defense?.pitcher?.id);
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200 text-center leading-tight max-w-[72px] truncate">
                    {ls.defense?.pitcher?.fullName?.split(' ').slice(-1)[0] || '—'}
                  </div>
                  {(() => {
                    const all = {
                      ...(ld.boxscore?.teams?.away?.players || {}),
                      ...(ld.boxscore?.teams?.home?.players || {}),
                    };
                    const player = all[`ID${ls.defense?.pitcher?.id}`];
                    const gs = player?.stats?.pitching;
                    const ss = player?.seasonStats?.pitching;
                    return (
                      <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
                        {gs?.pitchesThrown != null && (
                          <div className="text-slate-400">
                            {gs.pitchesThrown} pitches
                          </div>
                        )}
                        {gs?.strikeOuts != null && (
                          <div>
                            {gs.strikeOuts}K {gs.baseOnBalls ?? 0}BB
                          </div>
                        )}
                        {ss?.era != null && (
                          <div>ERA {parseFloat(ss.era).toFixed(2)}</div>
                        )}
                      </div>
                    );
                  })()}
                </button>

                {/* Center: BSO indicators + base diamond */}
                <div className="flex flex-col items-center justify-center gap-2 p-3">
                  <div className="flex flex-col gap-1">
                    {[
                      {
                        label: 'B',
                        max: 3,
                        val: ls.balls || 0,
                        dot: 'bg-green-400 border-green-400',
                      },
                      {
                        label: 'S',
                        max: 2,
                        val: ls.strikes || 0,
                        dot: 'bg-amber-400 border-amber-400',
                      },
                      {
                        label: 'O',
                        max: 3,
                        val: ls.outs || 0,
                        dot: 'bg-red-400 border-red-400',
                      },
                    ].map(({ label, max, val, dot }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="text-[7px] text-slate-500 w-2.5 font-bold">
                          {label}
                        </span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: max }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2.5 h-2.5 rounded-full border ${i < val ? dot : 'border-slate-600'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderBaseDiamond(
                        !!ls.offense?.first,
                        !!ls.offense?.second,
                        !!ls.offense?.third,
                      ),
                    }}
                  />
                </div>

                {/* Batter */}
                <button
                  className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-800/40 transition-colors"
                  onClick={() => navigate(`/player/${ls.offense?.batter?.id}`)}
                >
                  <div className="text-[8px] text-slate-500 uppercase tracking-widest">
                    At Bat
                  </div>
                  <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-emerald-500/40 flex-shrink-0">
                    <img
                      src={playerActionShotUrl(ls.offense?.batter?.id)}
                      className="w-full h-full object-cover object-top"
                      alt=""
                      onError={(e) => {
                        e.target.src = playerHeadshotUrl(ls.offense?.batter?.id);
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200 text-center leading-tight max-w-[72px] truncate">
                    {ls.offense?.batter?.fullName?.split(' ').slice(-1)[0] || '—'}
                  </div>
                  {(() => {
                    const all = {
                      ...(ld.boxscore?.teams?.away?.players || {}),
                      ...(ld.boxscore?.teams?.home?.players || {}),
                    };
                    const player = all[`ID${ls.offense?.batter?.id}`];
                    const gs = player?.stats?.batting;
                    const ss = player?.seasonStats?.batting;
                    return (
                      <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
                        {gs != null && (
                          <div className="text-emerald-400/80 font-semibold">
                            {gs.hits ?? 0}-{gs.atBats ?? 0}
                          </div>
                        )}
                        {ss?.avg && <div>AVG {ss.avg}</div>}
                        {ss?.ops && <div>OPS {ss.ops}</div>}
                      </div>
                    );
                  })()}
                </button>
              </div>
            </div>

            {/* ── VS STATS: Batter career stats vs this pitcher ── */}
            {vsStats && vsStats.atBats > 0 && (
              <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-3">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2.5 text-center">
                  {ls.offense?.batter?.fullName?.split(' ').slice(-1)[0]} vs{' '}
                  {ls.defense?.pitcher?.fullName?.split(' ').slice(-1)[0]} — career
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {[
                    { label: 'AB', value: vsStats.atBats },
                    { label: 'AVG', value: vsStats.avg },
                    { label: 'H', value: vsStats.hits },
                    { label: 'HR', value: vsStats.homeRuns },
                    { label: 'K', value: vsStats.strikeOuts },
                    { label: 'BB', value: vsStats.baseOnBalls },
                    vsStats.ops ? { label: 'OPS', value: vsStats.ops } : null,
                  ]
                    .filter(Boolean)
                    .filter(
                      (s) =>
                        s.value != null &&
                        s.value !== '-' &&
                        s.value !== '-.---',
                    )
                    .map(({ label, value }) => (
                      <div key={label} className="text-center min-w-[32px]">
                        <div className="text-[8px] text-slate-500">{label}</div>
                        <div className="text-xs font-bold font-mono text-slate-200">
                          {value}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── RECENT PLAYS: reversed, most recent first ── */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                  Recent Plays
                </span>
                <span className="text-[9px] text-slate-600">
                  {completePlays.length} plays
                </span>
              </div>
              {[...completePlays]
                .reverse()
                .slice(0, 20)
                .map((play, i) => {
                  const b = getPlayBadge(play.result?.eventType);
                  const bid = play.matchup?.batter?.id;
                  const half = play.about?.halfInning === 'top' ? '▲' : '▼';
                  const inn = play.about?.inning;
                  return (
                    <div
                      key={i}
                      onClick={() => openSheet(play)}
                      className={`flex items-start gap-2.5 cursor-pointer px-4 py-3 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors ${play.about?.isScoringPlay ? 'bg-emerald-500/5' : ''}`}
                    >
                      <span className="text-[9px] font-mono text-slate-600 pt-0.5 flex-shrink-0 w-8 text-center">
                        {half}{inn}
                      </span>
                      <img
                        src={playerHeadshotUrl(bid)}
                        className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                        alt=""
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-block text-[8px] px-1.5 py-0.5 rounded-full border font-semibold mb-0.5 ${b.cls}`}
                        >
                          {b.label}
                        </span>
                        <p className="text-xs text-slate-400 leading-snug line-clamp-2">
                          {play.result?.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              {completePlays.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-600 text-xs">
                  No plays yet
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'boxscore' && ld.boxscore && (
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 sm:p-5">
            <TeamBoxSection sideKey="away" team={away} />
            <TeamBoxSection sideKey="home" team={home} />

            {ld.boxscore.info?.length > 0 && (
              <div className="mt-2 pt-4 border-t border-slate-700/40 text-[11px] text-slate-500 space-y-1">
                {ld.boxscore.info.map((item, i) => (
                  <div key={i}>
                    <span className="font-semibold text-slate-400">
                      {item.label}:
                    </span>{' '}
                    {item.value}
                  </div>
                ))}
              </div>
            )}

            {ld.boxscore.weather && (
              <div className="text-[11px] text-slate-500 mt-1">
                <span className="font-semibold text-slate-400">Weather:</span>{' '}
                {[
                  ld.boxscore.weather.condition,
                  ld.boxscore.weather.temp && `${ld.boxscore.weather.temp}°F`,
                  ld.boxscore.weather.wind &&
                    `Wind: ${ld.boxscore.weather.wind}`,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
          </div>
        )}

        {currentTab === 'summary' && (
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 sm:p-5">
            <SegmentedControl
              value={summaryFilter}
              onChange={setSummaryFilter}
              variant="pill"
              size="sm"
              className="mb-4"
              options={[
                { value: 'all', label: 'All Plays' },
                { value: 'scoring', label: 'Scoring Only' },
              ]}
            />

            <div className="space-y-5">
              {inningGroups.map(({ key, plays: groupPlays }) => (
                <div key={key}>
                  <div className="text-xs font-bold text-slate-300 mb-2">
                    {key}
                  </div>
                  <div className="space-y-1.5">
                    {groupPlays.map((play, i) => {
                      const b = getPlayBadge(play.result?.eventType);
                      const bid = play.matchup?.batter?.id;
                      return (
                        <div
                          key={i}
                          onClick={() => openSheet(play)}
                          className={`flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-slate-800/50 transition-all ${play.about?.isScoringPlay ? 'ring-1 ring-emerald-500/20 bg-emerald-500/5' : ''}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (bid) navigate(`/player/${bid}`);
                            }}
                            className="flex-shrink-0 mt-0.5"
                          >
                            <img
                              src={playerHeadshotUrl(bid)}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-700 hover:border-emerald-500/60 transition-colors"
                              alt=""
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <span
                              className={`inline-block text-[9px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${b.cls}`}
                            >
                              {b.label}
                            </span>
                            <p className="text-xs text-slate-300 leading-snug">
                              {play.result?.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {inningGroups.length === 0 && (
                <div className="text-xs text-slate-600 italic text-center pt-4">
                  No plays yet
                </div>
              )}
            </div>
          </div>
        )}

        <PlayDetailSheet />
      </div>
      {/* end px-3 sm:px-0 */}
    </div>
  );
}
