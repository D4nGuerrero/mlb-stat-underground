/**
 * Progressive live game for AB mode: pitch-by-pitch, not pre-simmed reveal.
 */
import { createLiveAtBat, throwLivePitch, liveAtBatToPlayView } from './liveAtBat.js';
import { teamDefenseRating } from './defense.js';
import { resolveBattedBallPlay } from './playResolver.js';
import { describePlay } from './probability.js';
import { advanceRunnersContext } from './runners.js';
import {
  pickPinchHitter,
  platoonPitcherChange,
  resolveSacBunt,
  shouldIntentionalWalk,
  shouldSacBunt,
} from './strategy.js';

const REGULATION_INNINGS = 9;

function createDefense(starter, bullpen) {
  return {
    starter,
    bullpen: bullpen || [],
    current: starter,
    bullpenIdx: 0,
    pitchCount: 0,
  };
}

function maybeSwapPitcher(defense) {
  const tired = defense.pitchCount > 105 || (defense.pitchCount > 85 && Math.random() < 0.25);
  if (tired && defense.bullpenIdx < defense.bullpen.length) {
    defense.current = defense.bullpen[defense.bullpenIdx++];
    defense.pitchCount = 0;
  }
}

function countHit(outcome) {
  return ['HR', '3B', '2B', '1B'].includes(outcome);
}

function buildBatLine(player, battingSide, plays) {
  const playerPlays = plays.filter((play) => play.battingSide === battingSide && play.batterId === player.id);
  const ab = playerPlays.filter((play) => !['BB', 'HBP', 'IBB', 'SAC', 'SF'].includes(play.outcome)).length;
  const h = playerPlays.filter((play) => countHit(play.outcome)).length;
  const d = playerPlays.filter((play) => play.outcome === '2B').length;
  const t = playerPlays.filter((play) => play.outcome === '3B').length;
  const hr = playerPlays.filter((play) => play.outcome === 'HR').length;
  const bb = playerPlays.filter((play) => ['BB', 'IBB'].includes(play.outcome)).length;
  const hbp = playerPlays.filter((play) => play.outcome === 'HBP').length;
  const k = playerPlays.filter((play) => play.outcome === 'K').length;
  const rbi = playerPlays.reduce((sum, play) => sum + (play.runs || 0), 0);
  const tb = h + d + t * 2 + hr * 3;
  const avg = ab > 0 ? (h / ab).toFixed(3).replace('0.', '.') : '.000';
  return {
    ...player, ab, h, d, t, hr, bb, hbp, k, rbi, tb, avg,
  };
}

function buildPitcherLines(defendingTeamSide, plays) {
  const teamPlays = plays.filter((play) => play.defendingSide === defendingTeamSide && play.pitcherId);
  const map = {};
  const order = [];
  for (const play of teamPlays) {
    const key = play.pitcherId || play.pitcher;
    if (!map[key]) {
      map[key] = {
        name: play.pitcher, id: play.pitcherId,
        outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, pc: 0,
      };
      order.push(key);
    }
    const line = map[key];
    line.pc += play.atBatPitches || 0;
    if (countHit(play.outcome)) line.h++;
    line.r += play.runs || 0;
    line.er += play.earnedRuns ?? play.runs ?? 0;
    if (['BB', 'IBB'].includes(play.outcome)) line.bb++;
    if (play.outcome === 'K') line.k++;
    if (play.outcome === 'HR') line.hr++;
    if (play.outcome === 'HBP') line.hbp++;
    if (['K', 'OUT', 'SF', 'SAC', 'DP'].includes(play.outcome)) line.outs += play.outsRecorded || 1;
  }
  return order.map((key) => {
    const line = map[key];
    return { ...line, ip: `${Math.floor(line.outs / 3)}.${line.outs % 3}` };
  });
}

/**
 * Create progressive game state for pitch-by-pitch AB mode.
 */
export function createLiveGame(opts) {
  const {
    awayTeam, homeTeam,
    awayLineup, homeLineup,
    awayStarter, homeStarter,
    awayBullpen = [], homeBullpen = [],
    awayBench = [], homeBench = [],
  } = opts;

  return {
    awayTeam,
    homeTeam,
    /** Unique per Start Live Game — avoids PitchCanvas sessionStorage skipping animations */
    sessionId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lineups: { away: [...awayLineup], home: [...homeLineup] },
    benches: { away: [...awayBench], home: [...homeBench] },
    defense: {
      away: createDefense(awayStarter, awayBullpen),
      home: createDefense(homeStarter, homeBullpen),
    },
    awayStarter,
    homeStarter,
    batIdx: { away: 0, home: 0 },
    inning: 0, // 0-based
    half: 'away', // batting side
    outs: 0,
    bases: [null, null, null],
    inningRuns: { away: 0, home: 0 },
    innings: [], // completed full innings { away, home }
    score: { away: 0, home: 0 },
    plays: [], // chronological (first → last)
    teamErrors: { away: 0, home: 0 },
    inningErrorFlag: false,
    currentAtBat: null,
    phase: 'pitch', // pitch | outcome | complete
    complete: false,
    walkOff: false,
  };
}

function halfLabel(half, inning) {
  return `${half === 'away' ? '▲' : '▼'}${inning + 1}`;
}

function startNextAtBat(state) {
  if (state.complete) return state;

  const battingSide = state.half;
  const defendSide = battingSide === 'away' ? 'home' : 'away';
  const pitcherDefense = state.defense[defendSide];
  maybeSwapPitcher(pitcherDefense);

  let batter = state.lineups[battingSide][state.batIdx[battingSide] % state.lineups[battingSide].length];
  const pitcher = pitcherDefense.current;
  const pitcherHand = pitcher?.throwsHand || 'R';
  const scoreDiff = battingSide === 'away'
    ? state.score.away - state.score.home
    : state.score.home - state.score.away;

  if (platoonPitcherChange(pitcherDefense, batter, state.inning, scoreDiff)
    && pitcherDefense.bullpenIdx < pitcherDefense.bullpen.length) {
    pitcherDefense.current = pitcherDefense.bullpen[pitcherDefense.bullpenIdx++];
    pitcherDefense.pitchCount = 0;
  }

  const pinch = pickPinchHitter(
    state.benches[battingSide], batter, pitcherHand, state.inning, scoreDiff, battingSide,
  );
  if (pinch) {
    batter = pinch;
    const idx = state.benches[battingSide].indexOf(pinch);
    if (idx >= 0) state.benches[battingSide].splice(idx, 1);
  }

  // Sac bunt: resolve immediately as a completed play (no pitch theater)
  if (shouldSacBunt({
    bases: state.bases, outs: state.outs, batter,
    inning: state.inning, scoreDiff, battingSide,
  })) {
    const resolved = resolveSacBunt(state.bases, batter);
    finalizePlay(state, {
      batter,
      pitcher: pitcherDefense.current,
      atBat: null,
      resolved: {
        ...resolved,
        earnedRuns: state.inningErrorFlag ? 0 : resolved.runsScored,
      },
      skipPitching: true,
    });
    return state;
  }

  const intentional = shouldIntentionalWalk({
    bases: state.bases, outs: state.outs, batter,
    pitcher: pitcherDefense.current,
    inning: state.inning, scoreDiff, battingSide,
  });

  state.currentAtBat = createLiveAtBat(batter, pitcherDefense.current, state.homeTeam.id, {
    forceWalk: intentional,
  });
  state.phase = 'pitch';
  return state;
}

function finalizePlay(state, { batter, pitcher, atBat, resolved, skipPitching = false }) {
  const battingSide = state.half;
  const defendSide = battingSide === 'away' ? 'home' : 'away';
  const pitcherDefense = state.defense[defendSide];
  const half = halfLabel(battingSide, state.inning);

  if (!skipPitching && atBat) {
    pitcherDefense.pitchCount += atBat.pitchCount || atBat.pitches?.length || 0;
  }

  state.bases = resolved.newBases ?? state.bases;
  state.inningRuns[battingSide] += resolved.runsScored || 0;
  state.score[battingSide] += resolved.runsScored || 0;

  const play = {
    inning: half,
    battingSide,
    defendingSide: defendSide,
    batter: batter.name,
    batterId: batter.id,
    pitcher: pitcher?.name || '—',
    pitcherId: pitcher?.id || '—',
    pitcherTeamId: defendSide === 'away' ? state.awayTeam.id : state.homeTeam.id,
    outcome: resolved.outcome,
    runs: resolved.runsScored || 0,
    earnedRuns: resolved.earnedRuns ?? resolved.runsScored ?? 0,
    outsRecorded: resolved.outsRecorded ?? 1,
    isDoublePlay: resolved.isDoublePlay,
    isError: resolved.isError,
    isSacFly: resolved.isSacFly,
    desc: describePlay(
      resolved.outcome,
      batter,
      resolved,
      atBat?.bipMeta,
      { customDesc: resolved.desc },
    ),
    outsAfter: state.outs + (resolved.outsRecorded || 0),
    bases: `${state.bases[0] ? '●' : '○'}${state.bases[1] ? '●' : '○'}${state.bases[2] ? '●' : '○'}`,
    pitchCount: Math.round(pitcherDefense.pitchCount),
    pitches: atBat?.pitches || [],
    atBatPitches: atBat?.pitches?.length || 0,
    exitVelocity: atBat?.exitVelocity,
    launchAngle: atBat?.launchAngle,
    hitDistance: atBat?.hitDistance,
    sprayAngle: atBat?.sprayAngle,
    hitField: atBat?.hitField,
    hardHit: atBat?.hardHit,
    barrel: atBat?.barrel,
    battedBallType: atBat?.battedBallType,
  };

  state.outs += resolved.outsRecorded || 0;
  state.plays.push(play);
  state.batIdx[battingSide] = (state.batIdx[battingSide] + 1) % 9;
  state.currentAtBat = null;

  // Walk-off: bottom 9+ and home takes the lead
  if (
    battingSide === 'home'
    && state.inning >= REGULATION_INNINGS - 1
    && state.score.home > state.score.away
  ) {
    play.walkOff = true;
    state.walkOff = true;
    if (!state.innings[state.inning]) {
      state.innings[state.inning] = { away: state.score.away, home: state.inningRuns.home };
    } else {
      state.innings[state.inning].home = state.inningRuns.home;
    }
    state.complete = true;
    state.phase = 'outcome';
    state.currentAtBat = null;
    return { state, play, atBatComplete: true, gameComplete: true };
  }

  if (state.outs >= 3) {
    endHalf(state);
  }

  // Next batter is prepared after user acks outcome (liveGameAckOutcome)
  state.phase = 'outcome';
  state.pendingNextBatter = !state.complete;
  return { state, play, atBatComplete: true, gameComplete: state.complete };
}

function endHalf(state) {
  const battingSide = state.half;
  if (battingSide === 'away') {
    // store partial inning row
    if (!state.innings[state.inning]) {
      state.innings[state.inning] = { away: state.inningRuns.away, home: 0 };
    } else {
      state.innings[state.inning].away = state.inningRuns.away;
    }
    state.half = 'home';
    state.outs = 0;
    state.bases = [null, null, null];
    state.inningRuns.home = 0;
    state.inningErrorFlag = false;

    // Skip bottom 9 if home already ahead
    if (state.inning >= REGULATION_INNINGS - 1 && state.score.home > state.score.away) {
      state.innings[state.inning].home = 'X';
      state.complete = true;
      state.phase = 'complete';
    }
  } else {
    if (!state.innings[state.inning]) {
      state.innings[state.inning] = { away: 0, home: state.inningRuns.home };
    } else {
      state.innings[state.inning].home = state.inningRuns.home;
    }
    state.inning += 1;
    state.half = 'away';
    state.outs = 0;
    state.bases = [null, null, null];
    state.inningRuns = { away: 0, home: 0 };
    state.inningErrorFlag = false;

    // Extra innings or end after 9 if not tied
    if (state.inning >= REGULATION_INNINGS && state.score.away !== state.score.home) {
      state.complete = true;
      state.phase = 'complete';
    }
    // Cap extras
    if (state.inning >= 18) {
      state.complete = true;
      state.phase = 'complete';
    }
  }
}

function resolveCompletedAtBat(state, atBat) {
  const battingSide = state.half;
  const defendSide = battingSide === 'away' ? 'home' : 'away';
  const batter = atBat.batter;
  const pitcher = atBat.pitcher;
  const defenseRating = teamDefenseRating(state.lineups[defendSide]);
  const outcome = atBat.outcome;
  let resolved;

  if (['BB', 'HBP', 'IBB'].includes(outcome)) {
    const adv = advanceRunnersContext(state.bases, outcome === 'IBB' ? 'IBB' : outcome, state.outs, batter);
    resolved = {
      outcome,
      outsRecorded: 0,
      ...adv,
      isDoublePlay: false,
      isError: false,
      isSacFly: false,
      earnedRuns: state.inningErrorFlag ? 0 : adv.runsScored,
    };
  } else if (outcome === 'K') {
    resolved = {
      outcome: 'K',
      outsRecorded: 1,
      newBases: state.bases,
      runsScored: 0,
      runnersScored: [],
      runnerUpdates: [],
      earnedRuns: 0,
    };
  } else if (atBat.bipMeta) {
    resolved = resolveBattedBallPlay({
      rawOutcome: outcome,
      bases: state.bases,
      outs: state.outs,
      batter,
      bip: atBat.bipMeta,
      defenseRating,
      inningErrorFlag: state.inningErrorFlag,
    });
    if (resolved.isError) {
      state.teamErrors[defendSide]++;
      state.inningErrorFlag = true;
    }
  } else {
    resolved = {
      outcome: outcome || 'OUT',
      outsRecorded: 1,
      newBases: state.bases,
      runsScored: 0,
      runnersScored: [],
      runnerUpdates: [],
      earnedRuns: 0,
    };
  }

  return finalizePlay(state, { batter, pitcher, atBat, resolved });
}

/** Ensure a current at-bat is ready without throwing a pitch. */
export function liveGameEnsureAtBat(state) {
  if (state.complete || state.phase === 'outcome') return state;
  if (!state.currentAtBat) startNextAtBat(state);
  return state;
}

/**
 * Throw one pitch in the live game.
 */
export function liveGameThrowPitch(stateIn) {
  const state = stateIn;
  if (state.complete) {
    return { state, pitch: null, atBatComplete: false, gameComplete: true, play: null };
  }
  // Must acknowledge outcome before next pitch
  if (state.phase === 'outcome') {
    return { state, pitch: null, atBatComplete: true, gameComplete: false, play: state.plays[state.plays.length - 1] || null };
  }

  if (!state.currentAtBat) {
    startNextAtBat(state);
  }

  // Sac bunt path sets phase outcome without currentAtBat
  if (!state.currentAtBat) {
    return {
      state,
      pitch: null,
      atBatComplete: state.phase === 'outcome',
      gameComplete: state.complete,
      play: state.plays[state.plays.length - 1] || null,
    };
  }

  const { atBat, pitch, justCompleted } = throwLivePitch(state.currentAtBat);
  state.currentAtBat = atBat;
  state.phase = 'pitch';

  if (justCompleted) {
    return { ...resolveCompletedAtBat(state, atBat), pitch };
  }

  return { state, pitch, atBatComplete: false, gameComplete: false, play: null };
}

/** After outcome UI, clear outcome phase and start the next batter. */
export function liveGameAckOutcome(state) {
  if (state.complete) {
    state.phase = 'complete';
    return state;
  }
  state.phase = 'pitch';
  state.pendingNextBatter = false;
  if (!state.currentAtBat) {
    startNextAtBat(state);
  }
  return state;
}

/**
 * UI-facing snapshot (compatible with simulator result panels).
 */
export function getLiveGameView(state) {
  const playsNewestFirst = [...state.plays].reverse();
  const currentView = state.currentAtBat
    ? liveAtBatToPlayView(state.currentAtBat, {
      inning: halfLabel(state.half, state.inning),
      battingSide: state.half,
      defendingSide: state.half === 'away' ? 'home' : 'away',
    })
    : null;

  // Linescore rows
  const innings = state.innings.map((row) => ({ ...row }));
  if (!state.complete) {
    // in-progress half
    if (!innings[state.inning]) {
      innings[state.inning] = {
        away: state.half === 'away' ? state.inningRuns.away : (state.innings[state.inning]?.away ?? 0),
        home: state.half === 'home' ? state.inningRuns.home : (state.innings[state.inning]?.home ?? 0),
      };
    } else {
      if (state.half === 'away') innings[state.inning].away = state.inningRuns.away;
      else innings[state.inning].home = state.inningRuns.home;
    }
  }

  const teamHits = (side) => state.plays.filter((p) => p.battingSide === side && countHit(p.outcome)).length;

  return {
    live: true,
    sessionId: state.sessionId,
    complete: state.complete,
    phase: state.phase,
    awayTeam: state.awayTeam,
    homeTeam: state.homeTeam,
    awayLineup: state.lineups.away,
    homeLineup: state.lineups.home,
    awayStarter: state.awayStarter,
    homeStarter: state.homeStarter,
    innings,
    awayScore: state.score.away,
    homeScore: state.score.home,
    outs: state.outs,
    half: state.half,
    inningNum: state.inning + 1,
    bases: state.bases,
    lineHits: { away: teamHits('away'), home: teamHits('home') },
    lineErrors: { away: state.teamErrors.away, home: state.teamErrors.home },
    winner: state.complete
      ? (state.score.away > state.score.home ? state.awayTeam : state.homeTeam)
      : null,
    plays: playsNewestFirst,
    playsChrono: state.plays,
    currentAtBat: currentView,
    boxAway: state.lineups.away.map((p) => buildBatLine(p, 'away', state.plays)),
    boxHome: state.lineups.home.map((p) => buildBatLine(p, 'home', state.plays)),
    pitcherLinesAway: buildPitcherLines('away', state.plays),
    pitcherLinesHome: buildPitcherLines('home', state.plays),
  };
}
