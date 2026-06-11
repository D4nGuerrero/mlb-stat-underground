import { useState, useEffect, useCallback, useRef } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { mlbTeams } from '../utils/mlbHelpers';
import { TeamPicker, SegmentedControl, BaseballSpinner } from '../components/ui';
import { simulateGame } from '../simulator/game';
import { CURRENT_SEASON } from '../simulator/constants';
import { defaultPlayer, loadTeamForGame } from '../simulator/roster';
import {
  AtBatCard,
  BoxScore,
  ComingSoonPanel,
  InningBox,
  LineupBuilder,
  ParkInfo,
  teamLogoUrl,
} from '../simulator/components/GameUI';

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

export default function BaseballSimulator() {
  const [tab, setTab] = useState(() => initialSession?.tab ?? 'game');
  const [awayTeam, setAwayTeam] = useState(() => (initialSession?.awayTeamId ? teamById(initialSession.awayTeamId) : null));
  const [homeTeam, setHomeTeam] = useState(() => (initialSession?.homeTeamId ? teamById(initialSession.homeTeamId) : null));
  const [result, setResult] = useState(() => initialSession?.result ?? null);
  const [simming, setSimming] = useState(false);
  const [speed, setSpeed] = useState(() => initialSession?.speed ?? 'instant');
  const [liveIdx, setLiveIdx] = useState(0);
  const [resultTab, setResultTab] = useState(() => initialSession?.resultTab ?? 'plays');
  const [boxTab, setBoxTab] = useState(() => initialSession?.boxTab ?? 'away');
  const liveTimer = useRef(null);

  const [awayLineup, setAwayLineup] = useState([]);
  const [homeLineup, setHomeLineup] = useState([]);
  const [awayBench, setAwayBench] = useState([]);
  const [homeBench, setHomeBench] = useState([]);
  const [awayStarter, setAwayStarter] = useState(null);
  const [homeStarter, setHomeStarter] = useState(null);
  const [awayPitchers, setAwayPitchers] = useState([]);
  const [homePitchers, setHomePitchers] = useState([]);
  const [awayLoading, setAwayLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [showLineup, setShowLineup] = useState(() => initialSession?.showLineup ?? false);
  const [lineupMode, setLineupMode] = useState(() => initialSession?.lineupMode ?? 'realistic');

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

  useEffect(() => {
    if (!awayTeam) return;
    setAwayLoading(true);
    setAwayLineup([]);
    setAwayStarter(null);
    loadTeamForGame(awayTeam, CURRENT_SEASON, { opposingHand: homeStarter?.throwsHand || 'R', isHome: false }, lineupMode)
      .then((data) => {
        setAwayLineup(data.lineup);
        setAwayBench(data.bench || []);
        setAwayPitchers(data.pitchers);
        setAwayStarter(data.starter);
      })
      .catch(() => {
        setAwayLineup(Array.from({ length: 9 }, (_, index) => defaultPlayer(awayTeam.id, index)));
        setAwayBench([]);
      })
      .finally(() => setAwayLoading(false));
  }, [awayTeam, lineupMode, homeStarter?.throwsHand]);

  useEffect(() => {
    if (!homeTeam) return;
    setHomeLoading(true);
    setHomeLineup([]);
    setHomeStarter(null);
    loadTeamForGame(homeTeam, CURRENT_SEASON, { opposingHand: awayStarter?.throwsHand || 'R', isHome: true }, lineupMode)
      .then((data) => {
        setHomeLineup(data.lineup);
        setHomeBench(data.bench || []);
        setHomePitchers(data.pitchers);
        setHomeStarter(data.starter);
      })
      .catch(() => {
        setHomeLineup(Array.from({ length: 9 }, (_, index) => defaultPlayer(homeTeam.id, index)));
        setHomeBench([]);
      })
      .finally(() => setHomeLoading(false));
  }, [homeTeam, lineupMode, awayStarter?.throwsHand]);

  const movePlayer = (lineup, setLineup, idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= lineup.length) return;
    const next = [...lineup];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setLineup(next);
  };

  const runSimulation = useCallback(() => {
    if (!awayTeam || !homeTeam) return;

    const awayLineupFinal = awayLineup.length >= 9
      ? awayLineup
      : Array.from({ length: 9 }, (_, index) => defaultPlayer(awayTeam.id, index));
    const homeLineupFinal = homeLineup.length >= 9
      ? homeLineup
      : Array.from({ length: 9 }, (_, index) => defaultPlayer(homeTeam.id, index));
    const awayBullpen = awayPitchers.filter((pitcher) => pitcher.id !== awayStarter?.id).slice(0, 5);
    const homeBullpen = homePitchers.filter((pitcher) => pitcher.id !== homeStarter?.id).slice(0, 5);

    setSimming(true);
    setResult(null);
    setLiveIdx(0);
    clearInterval(liveTimer.current);

    setTimeout(() => {
      const gameResult = simulateGame({
        awayTeam,
        homeTeam,
        awayLineup: awayLineupFinal,
        homeLineup: homeLineupFinal,
        awayStarter: awayStarter || defaultPlayer(awayTeam.id, 99),
        homeStarter: homeStarter || defaultPlayer(homeTeam.id, 99),
        awayBullpen,
        homeBullpen,
        awayBench,
        homeBench,
      });
      setResult(gameResult);
      setResultTab('plays');
      setSimming(false);

      if (speed === 'live') {
        let index = 0;
        const allPlays = [...gameResult.plays].reverse();
        liveTimer.current = setInterval(() => {
          index++;
          setLiveIdx(index);
          if (index >= allPlays.length) clearInterval(liveTimer.current);
        }, 250);
      }
    }, 80);
  }, [awayTeam, homeTeam, awayLineup, homeLineup, awayBench, homeBench, awayStarter, homeStarter, awayPitchers, homePitchers, speed]);

  const isLiveMode = speed === 'live' && result && liveIdx < (result?.plays?.length ?? 0);
  const visiblePlays = result
    ? (speed === 'live' ? result.plays.slice(result.plays.length - liveIdx) : result.plays)
    : [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="text-center mb-6">
        <div className={`text-${THEME_COLOR}-400 text-[10px] font-mono tracking-[3px] uppercase mb-1`}>Rebuild</div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tighter mb-1">Baseball Simulator</h1>
        <p className="text-slate-500 text-sm">Hybrid probabilistic engine with pitch-by-pitch at-bats</p>
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

      {tab === 'season' && (
        <ComingSoonPanel
          title="Season Mode — Coming Soon"
          description="Full 162-game seasons will return after the single-game engine is validated and calibrated."
        />
      )}

      {tab === 'playoffs' && (
        <ComingSoonPanel
          title="Playoffs — Coming Soon"
          description="Bracket simulation will be rebuilt on top of the new game engine."
        />
      )}

      {tab === 'history' && (
        <ComingSoonPanel
          title="Historical Replays — Coming Soon"
          description="Cross-era matchups will return once single-game simulation is solid."
        />
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
                  <span className={`text-${THEME_COLOR}-400`}>Loading real stats…</span>
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
              />
            </div>
          )}

          <div className="flex items-center gap-3 mb-5">
            <SegmentedControl
              value={speed}
              onChange={setSpeed}
              variant="speed"
              size="sm"
              rounded="lg"
              options={[
                { value: 'instant', label: '⚡' },
                { value: 'live', label: '▶ Live' },
              ]}
            />
            <button
              type="button"
              onClick={runSimulation}
              disabled={!awayTeam || !homeTeam || simming || awayLoading || homeLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-${THEME_COLOR}-600 hover:bg-${THEME_COLOR}-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all text-sm`}
            >
              {simming ? (
                <>
                  <BaseballSpinner size="xs" inline />
                  Simulating…
                </>
              ) : '▶ Simulate Game'}
            </button>
          </div>

          {result && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-4">
                  {isLiveMode ? 'In Progress' : result.innings.length > 9 ? `Final / ${result.innings.length}` : 'Final'}
                </div>
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <img src={teamLogoUrl(result.awayTeam.id)} className="w-14 h-14 object-contain" alt={result.awayTeam.abbr} />
                    <span className="text-[11px] text-slate-500 font-mono">{result.awayTeam.abbr}</span>
                  </div>
                  <span className={`font-display text-6xl tabular-nums ${result.awayScore > result.homeScore ? 'text-white' : 'text-slate-600'}`}>
                    {result.awayScore}
                  </span>
                  <span className="text-slate-700 font-mono text-xl">—</span>
                  <span className={`font-display text-6xl tabular-nums ${result.homeScore > result.awayScore ? 'text-white' : 'text-slate-600'}`}>
                    {result.homeScore}
                  </span>
                  <div className="flex flex-col items-center gap-2">
                    <img src={teamLogoUrl(result.homeTeam.id)} className="w-14 h-14 object-contain" alt={result.homeTeam.abbr} />
                    <span className="text-[11px] text-slate-500 font-mono">{result.homeTeam.abbr}</span>
                  </div>
                </div>
                {!isLiveMode && (
                  <div className="mt-4 text-center">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 bg-${THEME_COLOR}-500/10 border border-${THEME_COLOR}-500/30 rounded-xl text-${THEME_COLOR}-400 text-sm font-semibold`}>
                      {result.winner.abbr} win{result.innings.length > 9 ? ` (F/${result.innings.length})` : '!'}
                    </span>
                  </div>
                )}
              </div>

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
                optionClassName="flex-1 py-1.5"
                options={[
                  { value: 'plays', label: 'Play-by-Play' },
                  { value: 'box', label: 'Box Score' },
                ]}
              />

              {resultTab === 'plays' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Play by Play</span>
                    <span className="text-[10px] text-slate-600 font-mono">{visiblePlays.length} plays</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {visiblePlays.map((play, index) => (
                      <AtBatCard key={`${play.inning}-${play.batterId}-${index}`} play={play} index={index} />
                    ))}
                    {isLiveMode && (
                      <div className="px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
                        Simulating…
                      </div>
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
                      teamName={boxTab === 'away' ? result.awayTeam.name : result.homeTeam.name}
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