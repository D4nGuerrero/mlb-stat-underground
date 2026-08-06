import { useState, useEffect, useCallback, useRef } from 'react';
import { mlbTeams } from '../utils/mlbHelpers';
import { TeamPicker, SegmentedControl, BaseballSpinner } from '../components/ui';
import { simulateGame } from '../simulator/game';
import {
  CURRENT_SEASON,
  SERIES_LENGTH_OPTIONS,
  SIM_SEASON_OPTIONS,
  venueIdForTeam,
} from '../simulator/constants';
import { fetchScheduleSummary } from '../simulator/schedule';
import { simulateHistoricalMatchup } from '../simulator/history';
import { simulatePlayoffs } from '../simulator/playoffs';
import { defaultPlayer, loadTeamForGame } from '../simulator/roster';
import { simulateTeamSeason } from '../simulator/season';
import { clearTeamCache } from '../simulator/teamCache';
import {
  createLiveGame,
  getLiveGameView,
  liveGameAckOutcome,
  liveGameEnsureAtBat,
  liveGameThrowPitch,
} from '../simulator/liveGame';
import {
  AtBatCard,
  BoxScore,
  HistoricalResultsPanel,
  InningBox,
  LineupBuilder,
  ParkInfo,
  PlayoffResultsPanel,
  ScoringPlaysPanel,
  SeasonResultsPanel,
  SimProgressBar,
  teamLogoUrl,
} from '../simulator/components/GameUI';
import SimPitchStage from '../simulator/viz/SimPitchStage';

/** Plays array is newest-first. Chronological index 0 = last element. */
function playAtChrono(result, chronoIndex) {
  if (!result?.plays?.length) return null;
  const total = result.plays.length;
  if (chronoIndex < 0 || chronoIndex >= total) return null;
  return result.plays[total - 1 - chronoIndex];
}

function isPlayPitchComplete(play, pitchIdx) {
  if (!play) return true;
  if (play.outcome === 'IBB' || play.intentionalWalk) return pitchIdx > 0;
  const n = play.pitches?.length || 0;
  if (n === 0) return pitchIdx > 0;
  return pitchIdx >= n;
}

/**
 * Full game list is newest-first; live/atbat reveal from first at-bat forward,
 * display newest revealed on top.
 */
function getRevealedPlays(result, speed, liveIdx, pitchIdx = 0) {
  if (!result?.plays?.length) return [];
  if (speed === 'instant') return result.plays;
  if (speed !== 'live' && speed !== 'atbat') return result.plays;
  if (liveIdx <= 0 && speed === 'live') return [];

  const total = result.plays.length;
  let completed = liveIdx;
  if (speed === 'atbat') {
    const current = playAtChrono(result, liveIdx);
    if (current && isPlayPitchComplete(current, pitchIdx)) {
      completed = liveIdx + 1;
    }
  }

  if (completed <= 0) return [];
  const revealed = [];
  for (let chrono = completed - 1; chrono >= 0; chrono -= 1) {
    const play = result.plays[total - 1 - chrono];
    if (play) revealed.push(play);
  }
  return revealed;
}

function getLiveScore(result, revealedPlays) {
  if (!result) return { away: 0, home: 0 };
  return revealedPlays.reduce(
    (score, play) => {
      if (play.battingSide === 'away') score.away += play.runs || 0;
      else score.home += play.runs || 0;
      return score;
    },
    { away: 0, home: 0 },
  );
}

const MLB_TEAMS = [...mlbTeams].sort((a, b) => a.name.localeCompare(b.name));
const SIM_SESSION_KEY = 'mlb-simulator-session';

function loadSimulatorSession() {
  try {
    const raw = sessionStorage.getItem(SIM_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSimulatorSession(data) {
  try {
    sessionStorage.setItem(SIM_SESSION_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable */
  }
}

function teamById(id) {
  return MLB_TEAMS.find((team) => team.id === id) ?? null;
}

const initialSession = typeof window !== 'undefined' ? loadSimulatorSession() : null;

function buildRosterRequestKey(team, opposingHand, lineupMode, isHome) {
  if (!team?.id) return null;
  return [team.id, opposingHand || 'R', lineupMode, isHome ? 'home' : 'away'].join(':');
}

export default function BaseballSimulator() {
  const [tab, setTab] = useState(() => initialSession?.tab ?? 'game');
  const [awayTeam, setAwayTeam] = useState(() => (initialSession?.awayTeamId ? teamById(initialSession.awayTeamId) : null));
  const [homeTeam, setHomeTeam] = useState(() => (initialSession?.homeTeamId ? teamById(initialSession.homeTeamId) : null));
  const [result, setResult] = useState(() => initialSession?.result ?? null);
  const [simming, setSimming] = useState(false);
  const [speed, setSpeed] = useState(() => initialSession?.speed ?? 'instant');
  const [liveIdx, setLiveIdx] = useState(0);
  const [pitchIdx, setPitchIdx] = useState(0);
  /** Progressive live game for ◎ AB mode (pitch-by-pitch, not pre-sim). */
  const [liveGame, setLiveGame] = useState(null);
  const [liveView, setLiveView] = useState(null);
  const [resultTab, setResultTab] = useState(() => initialSession?.resultTab ?? 'plays');
  const [boxTab, setBoxTab] = useState(() => initialSession?.boxTab ?? 'away');
  const playsListRef = useRef(null);

  const [awayLineup, setAwayLineup] = useState([]);
  const [homeLineup, setHomeLineup] = useState([]);
  const [awayBench, setAwayBench] = useState([]);
  const [homeBench, setHomeBench] = useState([]);
  const [awayStarter, setAwayStarter] = useState(null);
  const [homeStarter, setHomeStarter] = useState(null);
  const [awayPitchers, setAwayPitchers] = useState([]);
  const [homePitchers, setHomePitchers] = useState([]);
  const [awayRosterKey, setAwayRosterKey] = useState(null);
  const [homeRosterKey, setHomeRosterKey] = useState(null);
  const [showLineup, setShowLineup] = useState(() => initialSession?.showLineup ?? false);
  const [lineupMode, setLineupMode] = useState(() => initialSession?.lineupMode ?? 'realistic');
  const [seasonYear, setSeasonYear] = useState(String(CURRENT_SEASON));
  const [seasonPreview, setSeasonPreview] = useState(null);
  const [seasonPreviewKey, setSeasonPreviewKey] = useState(null);
  const [playoffYear, setPlayoffYear] = useState(String(CURRENT_SEASON - 1));
  const [histSeasonA, setHistSeasonA] = useState('2003');
  const [histSeasonB, setHistSeasonB] = useState(String(CURRENT_SEASON));
  const [histBestOf, setHistBestOf] = useState(7);
  const [seasonResult, setSeasonResult] = useState(null);
  const [playoffResult, setPlayoffResult] = useState(null);
  const [historicalResult, setHistoricalResult] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [simError, setSimError] = useState(null);
  const [selectedCardPlayerId, setSelectedCardPlayerId] = useState(null);

  useEffect(() => {
    const persist = () => {
      saveSimulatorSession({
        awayTeamId: awayTeam?.id ?? null,
        homeTeamId: homeTeam?.id ?? null,
        result,
        tab,
        speed,
        resultTab,
        boxTab,
        showLineup,
        lineupMode,
      });
    };

    persist();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    const onPageShow = (event) => {
      if (!event.persisted) return;
      const saved = loadSimulatorSession();
      if (!saved) return;
      if (saved.awayTeamId) setAwayTeam(teamById(saved.awayTeamId));
      if (saved.homeTeamId) setHomeTeam(teamById(saved.homeTeamId));
      if (saved.result) setResult(saved.result);
      if (saved.tab) setTab(saved.tab);
      if (saved.speed) setSpeed(saved.speed);
      if (saved.resultTab) setResultTab(saved.resultTab);
      if (saved.boxTab) setBoxTab(saved.boxTab);
      if (saved.showLineup != null) setShowLineup(saved.showLineup);
      if (saved.lineupMode) setLineupMode(saved.lineupMode);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [awayTeam, homeTeam, result, tab, speed, resultTab, boxTab, showLineup, lineupMode]);

  const awayRequestKey = buildRosterRequestKey(awayTeam, homeStarter?.throwsHand || 'R', lineupMode, false);
  const homeRequestKey = buildRosterRequestKey(homeTeam, awayStarter?.throwsHand || 'R', lineupMode, true);
  const seasonPreviewRequestKey = tab === 'season' && homeTeam
    ? `${homeTeam.id}:${seasonYear}`
    : null;
  const awayLoading = Boolean(awayRequestKey) && awayRosterKey !== awayRequestKey;
  const homeLoading = Boolean(homeRequestKey) && homeRosterKey !== homeRequestKey;
  const seasonPreviewLoading = Boolean(seasonPreviewRequestKey) && seasonPreviewKey !== seasonPreviewRequestKey;

  useEffect(() => {
    if (!awayTeam || !awayRequestKey) return;
    loadTeamForGame(awayTeam, CURRENT_SEASON, { opposingHand: homeStarter?.throwsHand || 'R', isHome: false }, lineupMode)
      .then((data) => {
        setAwayLineup(data.lineup);
        setAwayBench(data.bench || []);
        setAwayPitchers(data.pitchers);
        setAwayStarter(data.starter);
        setAwayRosterKey(awayRequestKey);
      })
      .catch(() => {
        setAwayLineup(Array.from({ length: 9 }, (_, index) => defaultPlayer(awayTeam.id, index)));
        setAwayBench([]);
        setAwayPitchers([]);
        setAwayStarter(null);
        setAwayRosterKey(awayRequestKey);
      });
  }, [awayRequestKey, awayTeam, homeStarter?.throwsHand, lineupMode]);

  useEffect(() => {
    if (!homeTeam || !homeRequestKey) return;
    loadTeamForGame(homeTeam, CURRENT_SEASON, { opposingHand: awayStarter?.throwsHand || 'R', isHome: true }, lineupMode)
      .then((data) => {
        setHomeLineup(data.lineup);
        setHomeBench(data.bench || []);
        setHomePitchers(data.pitchers);
        setHomeStarter(data.starter);
        setHomeRosterKey(homeRequestKey);
      })
      .catch(() => {
        setHomeLineup(Array.from({ length: 9 }, (_, index) => defaultPlayer(homeTeam.id, index)));
        setHomeBench([]);
        setHomePitchers([]);
        setHomeStarter(null);
        setHomeRosterKey(homeRequestKey);
      });
  }, [awayStarter?.throwsHand, homeRequestKey, homeTeam, lineupMode]);

  useEffect(() => {
    if (!seasonPreviewRequestKey || !homeTeam) return undefined;

    let cancelled = false;
    fetchScheduleSummary(homeTeam.id, parseInt(seasonYear, 10))
      .then((summary) => {
        if (!cancelled) {
          setSeasonPreview(summary);
          setSeasonPreviewKey(seasonPreviewRequestKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSeasonPreview(null);
          setSeasonPreviewKey(seasonPreviewRequestKey);
        }
      });

    return () => { cancelled = true; };
  }, [homeTeam, seasonPreviewRequestKey, seasonYear]);

  const movePlayer = (lineup, setLineup, idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= lineup.length) return;
    const next = [...lineup];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setLineup(next);
  };

  const resetBulkState = useCallback(() => {
    setSeasonResult(null);
    setPlayoffResult(null);
    setHistoricalResult(null);
    setBulkProgress(null);
    setSimError(null);
  }, []);

  const runSimulation = useCallback(() => {
    if (!awayTeam || !homeTeam) return;
    resetBulkState();

    const awayLineupFinal = awayLineup.length >= 9
      ? awayLineup
      : Array.from({ length: 9 }, (_, index) => defaultPlayer(awayTeam.id, index));
    const homeLineupFinal = homeLineup.length >= 9
      ? homeLineup
      : Array.from({ length: 9 }, (_, index) => defaultPlayer(homeTeam.id, index));
    const awayBullpen = awayPitchers.filter((pitcher) => pitcher.id !== awayStarter?.id).slice(0, 5);
    const homeBullpen = homePitchers.filter((pitcher) => pitcher.id !== homeStarter?.id).slice(0, 5);
    const starters = {
      awayStarter: awayStarter || defaultPlayer(awayTeam.id, 99),
      homeStarter: homeStarter || defaultPlayer(homeTeam.id, 99),
    };

    setSimming(true);
    setResult(null);
    setLiveGame(null);
    setLiveView(null);
    setLiveIdx(0);
    setPitchIdx(0);

    setTimeout(() => {
      // ◎ AB mode: progressive live game — each pitch is rolled when you throw
      if (speed === 'atbat') {
        const game = createLiveGame({
          awayTeam,
          homeTeam,
          awayLineup: awayLineupFinal,
          homeLineup: homeLineupFinal,
          ...starters,
          awayBullpen,
          homeBullpen,
          awayBench,
          homeBench,
        });
        // First batter ready, 0 pitches — user throws each pitch live
        liveGameEnsureAtBat(game);
        const view = getLiveGameView(game);
        setLiveGame(game);
        setLiveView(view);
        setResult(view);
        setResultTab('plays');
        setSimming(false);
        return;
      }

      const gameResult = simulateGame({
        awayTeam,
        homeTeam,
        awayLineup: awayLineupFinal,
        homeLineup: homeLineupFinal,
        ...starters,
        awayBullpen,
        homeBullpen,
        awayBench,
        homeBench,
      });
      setResult(gameResult);
      setResultTab('plays');
      setSimming(false);
      setLiveIdx(0);
      setPitchIdx(0);
    }, 80);
  }, [awayTeam, homeTeam, awayLineup, homeLineup, awayBench, homeBench, awayStarter, homeStarter, awayPitchers, homePitchers, resetBulkState, speed]);

  const runSeasonSimulation = useCallback(async () => {
    if (!homeTeam) return;
    setSimming(true);
    setSimError(null);
    resetBulkState();
    setResult(null);
    clearTeamCache();
    try {
      const data = await simulateTeamSeason({
        team: homeTeam,
        season: parseInt(seasonYear, 10),
        lineupMode,
        onProgress: (progress) => setBulkProgress({ type: 'season', ...progress }),
      });
      setSeasonResult(data);
    } catch (err) {
      setSimError(err.message || 'Season simulation failed.');
    } finally {
      setSimming(false);
      setBulkProgress(null);
    }
  }, [homeTeam, seasonYear, lineupMode, resetBulkState]);

  const runPlayoffSimulation = useCallback(async () => {
    setSimming(true);
    setSimError(null);
    resetBulkState();
    setResult(null);
    clearTeamCache();
    try {
      const data = await simulatePlayoffs({
        season: parseInt(playoffYear, 10),
        lineupMode,
        onProgress: (progress) => setBulkProgress({ type: 'playoffs', ...progress }),
      });
      setPlayoffResult(data);
    } catch (err) {
      setSimError(err.message || 'Playoff simulation failed.');
    } finally {
      setSimming(false);
      setBulkProgress(null);
    }
  }, [playoffYear, lineupMode, resetBulkState]);

  const runHistoricalSimulation = useCallback(async () => {
    if (!awayTeam || !homeTeam) return;
    setSimming(true);
    setSimError(null);
    resetBulkState();
    setResult(null);
    clearTeamCache();
    try {
      const data = await simulateHistoricalMatchup({
        teamA: awayTeam,
        teamB: homeTeam,
        seasonA: parseInt(histSeasonA, 10),
        seasonB: parseInt(histSeasonB, 10),
        homeTeam,
        lineupMode,
        bestOf: histBestOf,
        onProgress: (progress) => setBulkProgress({ type: 'historical', ...progress }),
      });
      setHistoricalResult(data);
    } catch (err) {
      setSimError(err.message || 'Historical simulation failed.');
    } finally {
      setSimming(false);
      setBulkProgress(null);
    }
  }, [awayTeam, homeTeam, histSeasonA, histSeasonB, histBestOf, lineupMode, resetBulkState]);

  const totalPlays = result?.plays?.length ?? 0;
  const isLiveMode = speed === 'live' && result && liveIdx < totalPlays;
  const isAtBatMode = speed === 'atbat' && Boolean(liveView || liveGame);
  const isLiveComplete = speed === 'live'
    ? (result && liveIdx >= totalPlays && totalPlays > 0)
    : (speed === 'atbat' && Boolean(liveView?.complete));

  // Live AB: current at-bat being pitched (not pre-simmed)
  const currentLiveAb = isAtBatMode
    ? (liveView?.phase === 'outcome'
      ? (liveView.playsChrono?.[liveView.playsChrono.length - 1]
        || liveView.plays?.[0]
        || null)
      : liveView?.currentAtBat)
    : null;

  const displayedPlays = speed === 'atbat'
    ? (liveView?.plays || [])
    : getRevealedPlays(result, speed, liveIdx, pitchIdx);
  const playListIndex = (index) => (
    (speed === 'live' || speed === 'atbat')
      ? Math.max(0, displayedPlays.length - index - 1)
      : totalPlays - index - 1
  );
  const liveScore = getLiveScore(result, displayedPlays);
  const useLiveScore = speed === 'live' && result && !isLiveComplete;
  const displayAwayScore = speed === 'atbat'
    ? (liveView?.awayScore ?? 0)
    : (useLiveScore ? liveScore.away : result?.awayScore ?? 0);
  const displayHomeScore = speed === 'atbat'
    ? (liveView?.homeScore ?? 0)
    : (useLiveScore ? liveScore.home : result?.homeScore ?? 0);

  const matchupBatter = currentLiveAb
    ? [...awayLineup, ...homeLineup, ...awayBench, ...homeBench]
      .find((p) => p.id === currentLiveAb.batterId) || { name: currentLiveAb.batter, card: null }
    : null;
  const matchupPitcher = currentLiveAb
    ? [...awayPitchers, ...homePitchers, awayStarter, homeStarter]
      .filter(Boolean)
      .find((p) => p.id === currentLiveAb.pitcherId) || { name: currentLiveAb.pitcher, card: null }
    : null;

  const advanceLivePlay = useCallback(() => {
    if (!result || speed !== 'live' || liveIdx >= totalPlays) return;
    setLiveIdx((prev) => Math.min(prev + 1, totalPlays));
  }, [result, speed, liveIdx, totalPlays]);

  const throwLiveGamePitch = useCallback(() => {
    if (!liveGame || speed !== 'atbat') return;
    const out = liveGameThrowPitch(liveGame);
    setLiveGame(out.state);
    const view = getLiveGameView(out.state);
    setLiveView(view);
    setResult(view);
  }, [liveGame, speed]);

  const ackLiveOutcome = useCallback(() => {
    if (!liveGame || speed !== 'atbat') return;
    liveGameAckOutcome(liveGame);
    const view = getLiveGameView(liveGame);
    setLiveGame(liveGame);
    setLiveView(view);
    setResult(view);
  }, [liveGame, speed]);

  useEffect(() => {
    if (speed !== 'live' || liveIdx <= 0) return;
    const el = playsListRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [liveIdx, speed]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="text-center mb-6">
        <div className={`text-accent-400 text-[10px] font-mono tracking-[3px] uppercase mb-1`}>Rebuild</div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tighter mb-1">Baseball Simulator</h1>
        <p className="text-slate-500 text-sm">
          Instant / Live = full game sim · ◎ AB = live pitch-by-pitch
        </p>
      </div>

      <div className="mb-6 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Single Game Engine</div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Log5 batter/pitcher blending, Statcast exit velocity and barrel adjustments, park factors,
          and pitch-by-pitch simulation. Away team bats in the top half; home team pitches — and vice versa.
        </p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-6">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          variant="simulator"
          size="sm"
          className="flex-1"
          optionClassName="flex-1"
          options={[
            { value: 'game', label: '⚾ Single Game' },
            { value: 'season', label: '📅 Season' },
            { value: 'playoffs', label: '🏆 Playoffs' },
            { value: 'history', label: '📜 History' },
          ]}
        />
      </div>

      {simError && (
        <div className="mb-4 px-4 py-3 bg-red-950/40 border border-red-800/50 rounded-xl text-sm text-red-300">
          {simError}
        </div>
      )}

      {tab === 'season' && (
        <>
          <div className="mb-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400 leading-relaxed">
              Uses the real MLB schedule and keeps actual results for games already played.
              Remaining games are simulated with {seasonYear} rosters and season stats for both teams.
            </p>
          </div>

          <div className="flex justify-center mb-4">
            <TeamPicker
              label="Team"
              teams={MLB_TEAMS}
              selected={homeTeam}
              onSelect={(team) => { setHomeTeam(team); resetBulkState(); }}
            />
          </div>

          <label className="block mb-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 block">Season</span>
            <select
              value={seasonYear}
              onChange={(e) => { setSeasonYear(e.target.value); resetBulkState(); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
            >
              {SIM_SEASON_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          {homeTeam && (
            <div className="mb-4 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
              {seasonPreviewLoading ? (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <BaseballSpinner size="xs" inline />
                  Loading schedule…
                </div>
              ) : seasonPreview ? (
                <div className="text-xs font-mono text-slate-400">
                  <span className="text-slate-300">{seasonPreview.completed.length}</span> played
                  <span className="text-slate-600 mx-2">·</span>
                  <span className={seasonPreview.remaining.length > 0 ? `text-accent-400` : 'text-slate-300'}>
                    {seasonPreview.remaining.length}
                  </span> remaining
                  <span className="text-slate-600 mx-2">·</span>
                  {seasonPreview.total} total
                </div>
              ) : (
                <div className="text-xs text-slate-600">Could not load schedule</div>
              )}
            </div>
          )}

          {bulkProgress?.type === 'season' && (
            <SimProgressBar
              current={bulkProgress.current}
              total={bulkProgress.total}
              label={`Sim game ${bulkProgress.current}/${bulkProgress.total} vs ${bulkProgress.opponent} · ${bulkProgress.wins}–${bulkProgress.losses}`}
            />
          )}

          <button
            type="button"
            onClick={runSeasonSimulation}
            disabled={!homeTeam || simming || seasonPreview?.remaining?.length === 0}
            className={`w-full mb-5 flex items-center justify-center gap-2 py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all text-sm`}
          >
            {simming ? (
              <>
                <BaseballSpinner size="xs" inline />
                Simulating remaining games…
              </>
            ) : '▶ Simulate Remaining Games'}
          </button>

          {seasonResult && <SeasonResultsPanel result={seasonResult} />}

          {!seasonResult && !simming && (
            <div className="text-center py-10 text-slate-600 text-sm">
              {homeTeam
                ? (seasonPreview?.remaining?.length === 0
                  ? 'Season complete — no remaining games to simulate'
                  : 'Simulate the rest of the schedule from today\'s real record')
                : 'Pick a team to get started'}
            </div>
          )}
        </>
      )}

      {tab === 'playoffs' && (
        <>
          <div className="mb-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400 leading-relaxed">
              Seeds top four teams per league from real standings, then simulates ALDS through the World Series
              with pitch-by-pitch Log5 batter/pitcher matchups using that year&apos;s rosters and stats.
            </p>
          </div>

          <label className="block mb-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 block">Standings Year</span>
            <select
              value={playoffYear}
              onChange={(e) => { setPlayoffYear(e.target.value); resetBulkState(); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
            >
              {SIM_SEASON_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          {bulkProgress?.type === 'playoffs' && (
            <div className="mb-4 text-center text-xs text-slate-400 font-mono">
              {bulkProgress.label}: {bulkProgress.higherSeed?.abbr} {bulkProgress.higherWins} – {bulkProgress.lowerSeed?.abbr} {bulkProgress.lowerWins}
            </div>
          )}

          <button
            type="button"
            onClick={runPlayoffSimulation}
            disabled={simming}
            className={`w-full mb-5 flex items-center justify-center gap-2 py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all text-sm`}
          >
            {simming ? (
              <>
                <BaseballSpinner size="xs" inline />
                Simulating playoffs…
              </>
            ) : '▶ Simulate Playoffs'}
          </button>

          {playoffResult && <PlayoffResultsPanel result={playoffResult} />}

          {!playoffResult && !simming && (
            <div className="text-center py-10 text-slate-600 text-sm">
              Select a year and run the full postseason bracket
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="mb-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400 leading-relaxed">
              Cross-era matchups from 2003–2026 with the same pitch-by-pitch engine as season mode — each team
              uses its chosen year&apos;s stats in every at-bat. Tap any game for box score, linescore, and plays.
            </p>
          </div>

          <div className="flex items-stretch gap-3 mb-4">
            <TeamPicker
              label="Away"
              teams={MLB_TEAMS}
              selected={awayTeam}
              onSelect={(team) => { setAwayTeam(team); resetBulkState(); }}
              exclude={homeTeam}
            />
            <div className="flex flex-col items-center justify-center shrink-0 gap-1 pt-6">
              <span className="text-slate-700 font-mono text-lg">@</span>
            </div>
            <TeamPicker
              label="Home"
              teams={MLB_TEAMS}
              selected={homeTeam}
              onSelect={(team) => { setHomeTeam(team); resetBulkState(); }}
              exclude={awayTeam}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 block">
                {awayTeam ? `${awayTeam.abbr} Season` : 'Away Season'}
              </span>
              <select
                value={histSeasonA}
                onChange={(e) => { setHistSeasonA(e.target.value); resetBulkState(); }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
              >
                {SIM_SEASON_OPTIONS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 block">
                {homeTeam ? `${homeTeam.abbr} Season` : 'Home Season'}
              </span>
              <select
                value={histSeasonB}
                onChange={(e) => { setHistSeasonB(e.target.value); resetBulkState(); }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
              >
                {SIM_SEASON_OPTIONS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block mb-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 block">Series Length</span>
            <select
              value={histBestOf}
              onChange={(e) => { setHistBestOf(Number(e.target.value)); resetBulkState(); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
            >
              {SERIES_LENGTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {bulkProgress?.type === 'historical' && (
            <div className="mb-4 text-center text-xs text-slate-400 font-mono">
              {bulkProgress.label}: {bulkProgress.higherSeed?.abbr} {bulkProgress.higherWins} – {bulkProgress.lowerSeed?.abbr} {bulkProgress.lowerWins}
            </div>
          )}

          <button
            type="button"
            onClick={runHistoricalSimulation}
            disabled={!awayTeam || !homeTeam || simming}
            className={`w-full mb-5 flex items-center justify-center gap-2 py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all text-sm`}
          >
            {simming ? (
              <>
                <BaseballSpinner size="xs" inline />
                Simulating series…
              </>
            ) : '▶ Simulate Matchup'}
          </button>

          {historicalResult && <HistoricalResultsPanel result={historicalResult} />}

          {!historicalResult && !simming && (
            <div className="text-center py-10 text-slate-600 text-sm">
              {awayTeam && homeTeam ? 'Set seasons and simulate the cross-era series' : 'Pick two teams to get started'}
            </div>
          )}
        </>
      )}

      {tab === 'game' && (
        <>
          <div className="flex items-stretch gap-3 mb-4">
            <TeamPicker
              label="Away"
              teams={MLB_TEAMS}
              selected={awayTeam}
              onSelect={(team) => { setAwayTeam(team); setResult(null); }}
              exclude={homeTeam}
            />
            <div className="flex flex-col items-center justify-center shrink-0 gap-1 pt-6">
              <span className="text-slate-700 font-mono text-lg">@</span>
            </div>
            <TeamPicker
              label="Home"
              teams={MLB_TEAMS}
              selected={homeTeam}
              onSelect={(team) => { setHomeTeam(team); setResult(null); }}
              exclude={awayTeam}
            />
          </div>

          <ParkInfo homeTeam={homeTeam} />

          {awayTeam && homeTeam && (
            <button
              type="button"
              onClick={() => setShowLineup((value) => !value)}
              className="w-full mb-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <span>{showLineup ? '▲ Hide' : '▼ Edit'} Lineups & Pitchers</span>
              {(awayLoading || homeLoading) && (
                <>
                  <BaseballSpinner size="xs" inline />
                  <span className={`text-accent-400`}>Loading real stats…</span>
                </>
              )}
            </button>
          )}

          {showLineup && awayTeam && homeTeam && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <LineupBuilder
                title={awayTeam.abbr}
                lineup={awayLineup}
                loading={awayLoading}
                onMove={(index, dir) => movePlayer(awayLineup, setAwayLineup, index, dir)}
                starters={awayPitchers}
                selectedStarterId={awayStarter?.id}
                onPickStarter={setAwayStarter}
                mode={lineupMode}
                onModeChange={setLineupMode}
                selectedPlayerId={selectedCardPlayerId}
                onSelectPlayer={(player) => setSelectedCardPlayerId(player?.id ?? null)}
              />
              <LineupBuilder
                title={homeTeam.abbr}
                lineup={homeLineup}
                loading={homeLoading}
                onMove={(index, dir) => movePlayer(homeLineup, setHomeLineup, index, dir)}
                starters={homePitchers}
                selectedStarterId={homeStarter?.id}
                onPickStarter={setHomeStarter}
                mode={lineupMode}
                onModeChange={setLineupMode}
                selectedPlayerId={selectedCardPlayerId}
                onSelectPlayer={(player) => setSelectedCardPlayerId(player?.id ?? null)}
              />
            </div>
          )}

          <div className="flex items-center gap-3 mb-5">
            <SegmentedControl
              value={speed}
              onChange={(value) => {
                setSpeed(value);
                setLiveIdx(0);
                setPitchIdx(0);
                setLiveGame(null);
                setLiveView(null);
                setResult(null);
              }}
              variant="speed"
              size="sm"
              rounded="lg"
              options={[
                { value: 'instant', label: '⚡' },
                { value: 'live', label: '▶ Live' },
                { value: 'atbat', label: '◎ AB' },
              ]}
            />
            <button
              type="button"
              onClick={runSimulation}
              disabled={!awayTeam || !homeTeam || simming || awayLoading || homeLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all text-sm`}
            >
              {simming ? (
                <>
                  <BaseballSpinner size="xs" inline />
                  Starting…
                </>
              ) : speed === 'atbat' ? '▶ Start Live Game' : '▶ Simulate Game'}
            </button>
          </div>

          {result && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-4">
                  {(isLiveMode || isAtBatMode)
                    ? 'In Progress'
                    : result.innings.length > 9 ? `Final / ${result.innings.length}` : 'Final'}
                </div>
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <img src={teamLogoUrl(result.awayTeam.id)} className="w-14 h-14 object-contain" alt={result.awayTeam.abbr} />
                    <span className="text-[11px] text-slate-500 font-mono">{result.awayTeam.abbr}</span>
                  </div>
                  <span className={`font-display text-6xl tabular-nums ${displayAwayScore > displayHomeScore ? 'text-white' : 'text-slate-600'}`}>
                    {displayAwayScore}
                  </span>
                  <span className="text-slate-700 font-mono text-xl">—</span>
                  <span className={`font-display text-6xl tabular-nums ${displayHomeScore > displayAwayScore ? 'text-white' : 'text-slate-600'}`}>
                    {displayHomeScore}
                  </span>
                  <div className="flex flex-col items-center gap-2">
                    <img src={teamLogoUrl(result.homeTeam.id)} className="w-14 h-14 object-contain" alt={result.homeTeam.abbr} />
                    <span className="text-[11px] text-slate-500 font-mono">{result.homeTeam.abbr}</span>
                  </div>
                </div>
                {result && (speed === 'instant' || isLiveComplete) && result.winner && (
                  <div className="mt-4 text-center">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 bg-accent-500/10 border border-accent-500/30 rounded-xl text-accent-400 text-sm font-semibold`}>
                      {result.winner.abbr} win{(result.innings?.length || 0) > 9 ? ` (F/${result.innings.length})` : '!'}
                    </span>
                  </div>
                )}
                {isAtBatMode && liveView && !liveView.complete && (
                  <div className="mt-3 text-center text-[11px] font-mono text-slate-500">
                    {liveView.half === 'away' ? '▲' : '▼'}{liveView.inningNum}
                    {' · '}{liveView.outs} out
                    {' · '}live pitch-by-pitch
                  </div>
                )}
              </div>

              {isAtBatMode && (
                <SimPitchStage
                  key={`ab-${liveView?.sessionId || 's'}-${currentLiveAb?.batterId || 'x'}-${liveView?.playsChrono?.length || 0}-${liveView?.phase}`}
                  play={currentLiveAb}
                  batter={matchupBatter}
                  pitcher={matchupPitcher}
                  sessionId={liveView?.sessionId || liveGame?.sessionId || 'sim'}
                  venueId={venueIdForTeam(homeTeam?.id ?? result?.homeTeam?.id)}
                  batterTeamId={
                    currentLiveAb?.battingSide === 'away'
                      ? (awayTeam?.id ?? result?.awayTeam?.id)
                      : (homeTeam?.id ?? result?.homeTeam?.id)
                  }
                  showOutcome={liveView?.phase === 'outcome'}
                  onThrowPitch={throwLiveGamePitch}
                  onOutcomeDone={ackLiveOutcome}
                  paLabel={
                    liveView?.complete
                      ? 'Final'
                      : `Inning ${liveView?.inningNum ?? 1}`
                  }
                  gameMeta={liveView ? {
                    awayScore: liveView.awayScore,
                    homeScore: liveView.homeScore,
                    outs: liveView.outs,
                  } : null}
                />
              )}

              {(speed === 'instant' || isLiveComplete || (isAtBatMode && liveView)) && result?.innings && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Linescore</div>
                <InningBox
                  innings={result.innings}
                  awayTeam={result.awayTeam}
                  homeTeam={result.homeTeam}
                  lineHits={result.lineHits}
                  lineErrors={result.lineErrors}
                />
              </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: `${result.awayTeam.abbr} SP`, pitcher: result.awayStarter },
                  { label: `${result.homeTeam.abbr} SP`, pitcher: result.homeStarter },
                ].map(({ label, pitcher }) => pitcher && (
                  <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">{label}</div>
                    <div className="font-semibold text-sm text-slate-200 truncate">{pitcher.name}</div>
                    {pitcher.pitchingStats && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        ERA {pitcher.pitchingStats.era} · {pitcher.pitchingStats.strikeOuts ?? '?'}K
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <SegmentedControl
                value={resultTab}
                onChange={setResultTab}
                variant="simulator"
                size="sm"
                rounded="lg"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-1"
                optionClassName="flex-1 py-1.5 text-[11px] sm:text-xs"
                options={[
                  { value: 'plays', label: 'All Plays' },
                  { value: 'scoring', label: 'Scoring Plays' },
                  { value: 'box', label: 'Box Score' },
                ]}
              />

              {speed === 'live' && result && isLiveMode && (
                <button
                  type="button"
                  onClick={advanceLivePlay}
                  className={`w-full py-3 bg-accent-600 hover:bg-accent-500 border border-accent-500/40 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2`}
                >
                  Next At-Bat
                  <span className="text-[11px] font-mono text-white/70">
                    {liveIdx + 1} / {totalPlays}
                  </span>
                </button>
              )}

              {resultTab === 'scoring' && (
                <ScoringPlaysPanel
                  plays={displayedPlays}
                  emptyMessage={
                    (speed === 'live' || speed === 'atbat') && displayedPlays.length === 0
                      ? 'Press Next to step through at-bats.'
                      : 'No runs scored in the plays shown.'
                  }
                />
              )}

              {resultTab === 'plays' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">All Plays</span>
                    <span className="text-[10px] text-slate-600 font-mono">{displayedPlays.length} plays</span>
                  </div>
                  <div ref={playsListRef} className="max-h-96 overflow-y-auto">
                    {displayedPlays.length === 0 && (speed === 'live' || speed === 'atbat') ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-600">
                        Press <span className="text-slate-400 font-semibold">
                          {speed === 'atbat' ? 'First Pitch' : 'Next At-Bat'}
                        </span>
                        {' '}to begin.
                      </div>
                    ) : (
                      displayedPlays.map((play, index) => (
                        <AtBatCard
                          key={`${play.inning}-${play.batterId}-${index}`}
                          play={play}
                          index={playListIndex(index)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {resultTab === 'box' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="flex gap-1 p-2 border-b border-slate-800">
                    <SegmentedControl
                      value={boxTab}
                      onChange={setBoxTab}
                      variant="simulator"
                      size="sm"
                      rounded="lg"
                      className="flex-1"
                      optionClassName="flex-1 py-1.5"
                      options={[
                        { value: 'away', label: result.awayTeam.abbr },
                        { value: 'home', label: result.homeTeam.abbr },
                      ]}
                    />
                  </div>
                  <div className="p-2">
                    <BoxScore
                      players={boxTab === 'away' ? result.boxAway : result.boxHome}
                      teamAbbr={boxTab === 'away' ? result.awayTeam.abbr : result.homeTeam.abbr}
                      pitcherLines={boxTab === 'away' ? result.pitcherLinesAway : result.pitcherLinesHome}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={runSimulation}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-all"
              >
                Simulate Again
              </button>
            </div>
          )}

          {!result && !simming && (
            <div className="text-center py-10 text-slate-600 text-sm">
              {awayTeam && homeTeam ? 'Ready — click Simulate Game' : 'Pick two teams to get started'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
