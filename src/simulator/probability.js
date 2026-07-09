import { describeBipPlay } from './battedBall.js';
import { DEFAULT_PARK, LEAGUE_AVG, PARK_FACTORS } from './constants.js';
import { classifyBattedBall, normalizeProbabilities, weightedOutcome } from './math.js';
import {
  batterRatesFromStats,
  OUTCOME_KEYS,
  pitcherRatesFromStats,
  pureRates,
} from './playerCard.js';

/** @deprecated prefer batterRatesFromStats / player.rates — kept for callers. */
export function batterProbabilities(stats) {
  return pureRates(batterRatesFromStats(stats, { shrink: true }));
}

/**
 * Prefer precomputed player.rates; fall back to platoon split rates when sample is large.
 * Rates (not 0–99 ratings) drive the engine.
 */
export function batterProbabilitiesForMatchup(batter, pitcherHand) {
  const sit = batter?.sitSplits;
  if (sit && pitcherHand) {
    const key = pitcherHand === 'L' ? 'vl' : 'vr';
    const split = sit[key];
    const pa = split?.plateAppearances || split?.atBats || 0;
    if (pa >= 25) return pureRates(batterRatesFromStats(split, { shrink: true }));
  }
  if (batter?.rates) return pureRates(batter.rates);
  return pureRates(batterRatesFromStats(batter?.stats, { shrink: true }));
}

/** Pitcher allowed rates per BF. Prefer player.pitchRates when present. */
export function pitcherAllowedProbabilities(pitcherOrStats) {
  if (!pitcherOrStats) return null;

  if (pitcherOrStats.pitchRates && pitcherOrStats.pitchRates.sample > 0) {
    return pureRates(pitcherOrStats.pitchRates);
  }

  const stats = pitcherOrStats.pitchingStats ?? (
    pitcherOrStats.inningsPitched != null || pitcherOrStats.strikeOuts != null
      ? pitcherOrStats
      : null
  );
  if (!stats) return null;

  const rates = pitcherRatesFromStats(stats, { shrink: true });
  if (!rates.sample || rates.sample < 5) return null;
  return pureRates(rates);
}

/** Bill James Log5 — both batter skill and pitcher allowance shape the rate. */
export function log5Blend(batterP, pitcherP, leagueP) {
  const p = batterP ?? leagueP;
  const q = pitcherP ?? leagueP;
  if (leagueP <= 0 || leagueP >= 1) return p;
  const numerator = (p * q) / leagueP;
  const denominator = numerator + ((1 - p) * (1 - q)) / (1 - leagueP);
  return denominator > 0 ? numerator / denominator : leagueP;
}

/**
 * Statcast used to nudge rates; disabled by default so counting-stat rates stay calibrated.
 * Kept for optional BIP flavor / experiments — pass `{ apply: true }` to enable.
 */
export function applyStatcastAdjustments(probs, statcastStats, { apply = false } = {}) {
  if (!apply || !statcastStats) return probs;

  const hhRate = statcastStats.hardHitPercent ?? statcastStats.hardHitRate ?? null;
  const brlRate = statcastStats.barrelBatRate ?? statcastStats.barrelPercent ?? null;
  const avgEV = statcastStats.avgHitSpeed ?? statcastStats.avgExitVelocity ?? null;
  if (hhRate === null && brlRate === null && avgEV === null) return probs;

  const lgHH = 38.5;
  const lgBrl = 8.0;
  const lgEV = 87.5;
  const hhFactor = hhRate !== null ? hhRate / lgHH : 1.0;
  const brlFactor = brlRate !== null ? brlRate / lgBrl : 1.0;
  const evFactor = avgEV !== null ? avgEV / lgEV : 1.0;
  const powerBoost = hhFactor * 0.5 + Math.sqrt(brlFactor) * 0.3 + evFactor * 0.2;

  return normalizeProbabilities({
    ...probs,
    HR: probs.HR * Math.sqrt(brlFactor) * Math.sqrt(evFactor),
    '2B': probs['2B'] * Math.sqrt(hhFactor),
    '3B': probs['3B'] * Math.sqrt(hhFactor),
    '1B': probs['1B'] / Math.sqrt(powerBoost),
    OUT: probs.OUT / Math.sqrt(powerBoost),
  });
}

/**
 * Log5 blend of batter rates with pitcher allowed rates.
 * Accepts raw pitching stats OR a full pitcher player (`pitchRates`).
 */
export function blendWithPitcher(batterProbs, pitcherOrStats) {
  const pitcherProbs = pitcherAllowedProbabilities(pitcherOrStats);
  if (!pitcherProbs) return batterProbs;

  const blended = {};
  for (const key of OUTCOME_KEYS) {
    blended[key] = log5Blend(batterProbs[key], pitcherProbs[key], LEAGUE_AVG[key]);
  }
  return normalizeProbabilities(blended);
}

export function applyParkFactor(probs, homeTeamId) {
  const pf = PARK_FACTORS[homeTeamId] || DEFAULT_PARK;
  return normalizeProbabilities({
    ...probs,
    HR: probs.HR * pf.hr,
    '2B': probs['2B'] * ((pf.hits - 1) * 0.5 + 1),
    '1B': probs['1B'] * ((pf.hits - 1) * 0.3 + 1),
  });
}

/** BIP-only weights from the batter/pitcher Log5 matchup (target ~.295 BABIP). */
export function bipContactWeights(paProbs) {
  const hitMass = paProbs.HR + paProbs['3B'] + paProbs['2B'] + paProbs['1B'];
  const bipMass = hitMass + paProbs.OUT;
  if (bipMass <= 0) {
    return normalizeProbabilities({
      HR: LEAGUE_AVG.HR,
      '3B': LEAGUE_AVG['3B'],
      '2B': LEAGUE_AVG['2B'],
      '1B': LEAGUE_AVG['1B'],
      OUT: LEAGUE_AVG.OUT,
    });
  }

  const babipTarget = 0.295;
  const babipScale = Math.max(0.88, Math.min(1.22, babipTarget / (hitMass / bipMass)));

  return normalizeProbabilities({
    HR: paProbs.HR * babipScale,
    '3B': paProbs['3B'] * babipScale,
    '2B': paProbs['2B'] * babipScale,
    '1B': paProbs['1B'] * babipScale * 1.04,
    OUT: paProbs.OUT / babipScale,
  });
}

/**
 * Resolve a batted-ball outcome from matchup rates, then gate by EV/LA/contact shape.
 * This keeps pitch-by-pitch physics while anchoring hit rates to season stats.
 */
export function resolveBipOutcome(paProbs, { exitVelocity, launchAngle, parkHr = 1 }) {
  const bbm = classifyBattedBall(launchAngle);
  const base = bipContactWeights(paProbs);

  if (launchAngle > 50 || bbm === 'PU') {
    return weightedOutcome(normalizeProbabilities({ OUT: 0.86, '1B': 0.14 }));
  }

  const ev = exitVelocity;
  const mult = { HR: 1, '3B': 1, '2B': 1, '1B': 1, OUT: 1 };

  if (bbm === 'GB') {
    mult.HR = 0.05;
    mult['3B'] = 0.1;
    mult['2B'] = ev >= 98 ? 0.9 : ev >= 92 ? 0.6 : 0.3;
    mult['1B'] = ev >= 88 ? 1.4 : 1.2;
    mult.OUT = ev >= 96 ? 0.7 : 0.92;
  } else if (bbm === 'LD') {
    mult.HR = ev >= 100 ? 1.7 : ev >= 95 ? 1.05 : 0.4;
    mult['2B'] = 1.5;
    mult['1B'] = 1.3;
    mult.OUT = ev >= 98 ? 0.5 : 0.68;
  } else if (bbm === 'FB') {
    mult.HR = ev >= 105 ? 3.0 * parkHr : ev >= 100 ? 2.0 * parkHr : ev >= 95 ? 1.05 * parkHr : 0.3;
    mult['2B'] = ev >= 100 ? 0.95 : 0.5;
    mult['1B'] = 0.4;
    mult.OUT = ev >= 100 ? 0.42 : 0.65;
  }

  const scaled = {};
  for (const key of ['HR', '3B', '2B', '1B', 'OUT']) {
    scaled[key] = (base[key] ?? 0) * mult[key];
  }

  return weightedOutcome(normalizeProbabilities(scaled));
}

const BASE_LABEL = { 1: 'first', 2: 'second', 3: 'third' };

function recordMove(updates, runner, from, to) {
  if (!runner) return;
  if (from === to) {
    updates.push({ name: runner.name, from, to, held: true });
  } else {
    updates.push({ name: runner.name, from, to });
  }
}

/** bases: [1st, 2nd, 3rd] — each slot is { id, name } or null */
export function advanceRunners(bases, hitType, outs, batter) {
  const r1 = bases[0];
  const r2 = bases[1];
  const r3 = bases[2];
  const runnersScored = [];
  const runnerUpdates = [];
  let newBases = [null, null, null];
  let runs = 0;

  const score = (runner, fromBase) => {
    runnersScored.push(runner);
    runnerUpdates.push({ name: runner.name, from: fromBase, to: 'home' });
    runs++;
  };

  if (hitType === 'HR') {
    if (r1) score(r1, 1);
    if (r2) score(r2, 2);
    if (r3) score(r3, 3);
    score(batter, 'batter');
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === '3B') {
    if (r1) score(r1, 1);
    if (r2) score(r2, 2);
    if (r3) score(r3, 3);
    newBases[2] = batter;
    recordMove(runnerUpdates, batter, 'batter', 3);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === '2B') {
    if (r3) score(r3, 3);
    if (r2) score(r2, 2);
    if (r1) {
      if (Math.random() < 0.62) score(r1, 1);
      else {
        newBases[2] = r1;
        recordMove(runnerUpdates, r1, 1, 3);
      }
    }
    newBases[1] = batter;
    recordMove(runnerUpdates, batter, 'batter', 2);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === '1B') {
    if (r3) score(r3, 3);
    if (r2) {
      if (Math.random() < 0.50) score(r2, 2);
      else if (Math.random() < 0.85) {
        newBases[2] = r2;
        recordMove(runnerUpdates, r2, 2, 3);
      } else {
        newBases[1] = r2;
        recordMove(runnerUpdates, r2, 2, 2);
      }
    }
    if (r1) {
      newBases[1] = r1;
      recordMove(runnerUpdates, r1, 1, 2);
    }
    newBases[0] = batter;
    recordMove(runnerUpdates, batter, 'batter', 1);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === 'BB' || hitType === 'HBP') {
    if (r1 && r2 && r3) {
      score(r3, 3);
      newBases[0] = batter;
      newBases[1] = r1;
      newBases[2] = r2;
      recordMove(runnerUpdates, r1, 1, 2);
      recordMove(runnerUpdates, r2, 2, 3);
    } else if (r1 && r2) {
      newBases[0] = batter;
      newBases[1] = r1;
      newBases[2] = r2;
      recordMove(runnerUpdates, r1, 1, 2);
      recordMove(runnerUpdates, r2, 2, 3);
    } else if (r1) {
      newBases[0] = batter;
      newBases[1] = r1;
      recordMove(runnerUpdates, r1, 1, 2);
    } else {
      newBases[0] = batter;
    }
    recordMove(runnerUpdates, batter, 'batter', 1);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === 'OUT' && outs < 2 && r3 && Math.random() < 0.20) {
    score(r3, 3);
    newBases = [r1, r2, null];
    if (r1) recordMove(runnerUpdates, r1, 1, 1);
    if (r2) recordMove(runnerUpdates, r2, 2, 2);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  newBases = [r1, r2, r3];
  if (hitType === 'OUT') {
    if (r1) recordMove(runnerUpdates, r1, 1, 1);
    if (r2) recordMove(runnerUpdates, r2, 2, 2);
    if (r3) recordMove(runnerUpdates, r3, 3, 3);
  }

  return { newBases, runsScored: runs, runnersScored, runnerUpdates };
}

const BATTER_ACTIONS = {
  BB: () => 'draws a walk',
  IBB: () => 'is intentionally walked',
  HBP: () => 'is hit by a pitch',
  K: () => ['strikes out', 'fans', 'swings and misses for strike three'][Math.floor(Math.random() * 3)],
  SAC: () => 'bunts for a sacrifice',
  SF: () => 'hits a sacrifice fly',
  DP: () => 'grounds into a double play',
  E: (bip) => `reaches on an error${bip?.fieldPhrase ? ` on a ${bip.battedBallType === 'GB' ? 'ground ball' : 'ball'} to ${bip.fieldPhrase}` : ''}`,
  SB: (name) => `${name} steals second`,
  CS: (name) => `${name} is caught stealing`,
  WP: () => 'advances on a wild pitch',
};

export function describePlay(hitType, batter, advanceResult, bip = null, meta = {}) {
  const batterName = typeof batter === 'string' ? batter : batter?.name || 'Batter';
  const {
    runsScored = 0,
    runnersScored = [],
    runnerUpdates = [],
  } = advanceResult || {};

  let action;
  if (meta.customDesc) {
    action = meta.customDesc.replace(`${batterName} `, '').replace(/\.$/, '');
  } else if (hitType === 'SB' || hitType === 'CS') {
    action = BATTER_ACTIONS[hitType](meta.runnerName || batterName);
  } else if (hitType === 'E') {
    action = BATTER_ACTIONS.E(bip);
  } else if (bip && ['HR', '3B', '2B', '1B', 'OUT', 'SF'].includes(hitType)) {
    action = describeBipPlay(hitType === 'SF' ? 'OUT' : hitType, bip, runsScored);
    if (hitType === 'SF') action = action.replace(/^flies out|^grounds out|^lines out|^pops out/, 'hits a sacrifice fly');
  } else {
    const actionFn = BATTER_ACTIONS[hitType];
    action = typeof actionFn === 'function' ? actionFn() : hitType;
  }
  const parts = hitType === 'SB' || hitType === 'CS'
    ? [`${action}.`]
    : [`${batterName} ${action}.`];

  for (const runner of runnersScored) {
    if (hitType === 'HR' && runner.name === batterName) continue;
    parts.push(`${runner.name} scores.`);
  }

  for (const update of runnerUpdates) {
    if (update.to === 'home' || update.from === 'batter') continue;
    if (update.held) {
      parts.push(`${update.name} stays at ${BASE_LABEL[update.from]}.`);
    } else {
      parts.push(`${update.name} advances to ${BASE_LABEL[update.to]}.`);
    }
  }

  return parts.join(' ');
}