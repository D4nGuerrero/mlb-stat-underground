/**
 * Outcome-first at-bat simulation.
 * 1) Roll PA outcome from calibrated rates (Log5 + park)
 * 2) Build BIP physics locked to that outcome
 * 3) Generate pitch-sequence theater that ends on the outcome
 */
import { bipForForcedOutcome } from './battedBall.js';
import { DEFAULT_PARK, LEAGUE_AVG, PARK_FACTORS } from './constants.js';
import { weightedOutcome } from './math.js';
import {
  applyParkFactor,
  applyStatcastAdjustments,
  batterProbabilitiesForMatchup,
  blendWithPitcher,
} from './probability.js';
import {
  buildPitcherArsenal,
  generatePitchSequence,
} from './pitchTheater.js';

export function getPaProbabilities(batter, pitcher, homeTeamId) {
  const pitcherHand = pitcher?.throwsHand || 'R';
  let probs = batterProbabilitiesForMatchup(batter, pitcherHand);
  probs = applyStatcastAdjustments(probs, batter?.statcastStats, { apply: false });
  probs = blendWithPitcher(probs, pitcher);
  probs = applyParkFactor(probs, homeTeamId);
  return probs;
}

function packageBip(bipResult) {
  if (!bipResult) return {};
  return {
    exitVelocity: bipResult.ev,
    launchAngle: bipResult.la,
    hitDistance: bipResult.dist,
    sprayAngle: bipResult.spray,
    hitField: bipResult.field,
    hardHit: bipResult.hardHit,
    barrel: bipResult.barrel,
    battedBallType: bipResult.battedBallType,
    bipMeta: {
      la: bipResult.la,
      ev: bipResult.ev,
      dist: bipResult.dist,
      spray: bipResult.spray,
      battedBallType: bipResult.battedBallType,
      field: bipResult.field,
      fieldPhrase: bipResult.fieldPhrase,
    },
  };
}

const BIP_OUTCOMES = new Set(['HR', '3B', '2B', '1B', 'OUT']);

/**
 * @param {object} batter
 * @param {object} pitcher
 * @param {number} homeTeamId
 * @param {{ forceWalk?: boolean }} options
 */
export function simulateAtBat(batter, pitcher, homeTeamId, options = {}) {
  const { forceWalk = false } = options;
  const pitcherStats = pitcher?.pitchingStats;
  const arsenal = buildPitcherArsenal(pitcherStats);
  const paProbs = getPaProbabilities(batter, pitcher, homeTeamId);
  const park = PARK_FACTORS[homeTeamId] || DEFAULT_PARK;

  if (forceWalk) {
    return {
      outcome: 'IBB',
      pitches: [],
      pitchCount: 0,
      intentionalWalk: true,
      paProbs,
    };
  }

  // 1) Canonical outcome from matchup rates
  const outcome = weightedOutcome(paProbs) || 'OUT';

  // 2) BIP theater locked to outcome
  let bipResult = null;
  if (BIP_OUTCOMES.has(outcome)) {
    bipResult = bipForForcedOutcome(outcome, batter, 'FF', 0, park.hr);
  }

  // 3) Pitch sequence that ends on this outcome
  const pitches = generatePitchSequence(outcome, {
    arsenal,
    pitcherStats,
    paProbs,
    bipExtras: bipResult
      ? { ev: bipResult.ev, la: bipResult.la, dist: bipResult.dist }
      : null,
  });

  // If BIP, re-roll spray/EV using final pitch location for coherence
  if (bipResult && pitches.length) {
    const last = pitches[pitches.length - 1];
    if (last?.result === 'X') {
      bipResult = bipForForcedOutcome(
        outcome,
        batter,
        last.type || 'FF',
        last.plateX ?? 0,
        park.hr,
      );
      last.ev = bipResult.ev;
      last.la = bipResult.la;
      last.dist = bipResult.dist;
    }
  }

  return {
    outcome,
    pitches,
    pitchCount: Math.max(pitches.length, outcome === 'HBP' ? 1 : pitches.length),
    paProbs,
    ...packageBip(bipResult),
  };
}

/** Monte Carlo check: outcome-first AB rates vs input rates (league pitcher ≈ identity). */
export function calibrateSimulateAtBat(batter, n = 10000, homeTeamId = null) {
  const leaguePitcher = {
    throwsHand: 'R',
    pitchingStats: null,
    pitchRates: { ...LEAGUE_AVG, sample: 999 },
  };
  const counts = {
    HR: 0, '3B': 0, '2B': 0, '1B': 0, BB: 0, HBP: 0, K: 0, OUT: 0,
  };

  for (let i = 0; i < n; i++) {
    const { outcome } = simulateAtBat(batter, leaguePitcher, homeTeamId);
    if (counts[outcome] != null) counts[outcome] += 1;
    else counts.OUT += 1;
  }

  const target = getPaProbabilities(batter, leaguePitcher, homeTeamId);
  const empirical = {};
  let maxRelErr = 0;
  for (const key of Object.keys(counts)) {
    empirical[key] = counts[key] / n;
    const exp = target[key] || 0;
    if (exp > 0.01) {
      maxRelErr = Math.max(maxRelErr, Math.abs(empirical[key] - exp) / exp);
    }
  }

  return { target, empirical, maxRelErr, n };
}
