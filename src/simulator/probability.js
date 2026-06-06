import { describeBipPlay } from './battedBall';
import { DEFAULT_PARK, LEAGUE_AVG, PARK_FACTORS } from './constants';
import { normalizeProbabilities } from './math';

export function batterProbabilities(stats) {
  if (!stats) return { ...LEAGUE_AVG };
  const pa = stats.plateAppearances || stats.atBats || 400;
  if (pa < 30) return { ...LEAGUE_AVG };

  const hr = (stats.homeRuns || 0) / pa;
  const triple = (stats.triples || 0) / pa;
  const doubles = (stats.doubles || 0) / pa;
  const singles = Math.max(0, ((stats.hits || 0) - (stats.homeRuns || 0) - (stats.triples || 0) - (stats.doubles || 0))) / pa;
  const bb = (stats.baseOnBalls || 0) / pa;
  const hbp = (stats.hitByPitch || 0) / pa;
  const k = (stats.strikeOuts || 0) / pa;
  const out = Math.max(0.05, 1 - hr - triple - doubles - singles - bb - hbp - k);

  return normalizeProbabilities({
    HR: hr, '3B': triple, '2B': doubles, '1B': singles,
    BB: bb, HBP: hbp, K: k, OUT: out,
  });
}

export function applyStatcastAdjustments(probs, statcastStats) {
  if (!statcastStats) return probs;

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

/** Log5-style geometric blend of batter rates with pitcher allowed rates. */
export function blendWithPitcher(batterProbs, pitcherStats) {
  if (!pitcherStats) return batterProbs;
  const ip = pitcherStats.inningsPitched || 50;
  if (ip < 5) return batterProbs;

  const bf = ip * 4.3;
  const pK = Math.min(0.40, (pitcherStats.strikeOuts || 0) / bf);
  const pBB = Math.min(0.20, (pitcherStats.baseOnBalls || 0) / bf);
  const pHR = Math.min(0.08, (pitcherStats.homeRuns || 0) / bf);
  const kRatio = (pK + LEAGUE_AVG.K) > 0 ? pK / LEAGUE_AVG.K : 1;
  const bbRatio = (pBB + LEAGUE_AVG.BB) > 0 ? pBB / LEAGUE_AVG.BB : 1;
  const hrRatio = (pHR + LEAGUE_AVG.HR) > 0 ? pHR / LEAGUE_AVG.HR : 1;

  return normalizeProbabilities({
    HR: batterProbs.HR * Math.sqrt(hrRatio),
    '3B': batterProbs['3B'],
    '2B': batterProbs['2B'],
    '1B': batterProbs['1B'],
    BB: batterProbs.BB * Math.sqrt(bbRatio),
    HBP: batterProbs.HBP,
    K: batterProbs.K * Math.sqrt(kRatio),
    OUT: batterProbs.OUT,
  });
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