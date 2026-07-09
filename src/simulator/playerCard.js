/**
 * Player cards: real counting stats → PA/BF rates (engine truth) → 0–99 ratings (display).
 * Ratings invert cleanly back to rates so card edits (future) stay calibrated.
 */
import {
  LEAGUE_AVG,
  RATE_SHRINK_BF,
  RATE_SHRINK_PA,
  RATING_ANCHORS,
  RATING_CEIL,
  RATING_FLOOR,
  RATING_MAX,
  RATING_MIN,
} from './constants.js';
import { normalizeProbabilities } from './math.js';

export const OUTCOME_KEYS = ['HR', '3B', '2B', '1B', 'BB', 'HBP', 'K', 'OUT'];

export function leagueRates() {
  return { ...LEAGUE_AVG };
}

/**
 * Map a rate onto 25–99 using fixed anchors:
 * rate≈low → 40 (poor), rate≈high → 80 (elite). Extrapolates outside for 99s.
 */
export function ratingFromRate(rate, anchors, { invert = false } = {}) {
  if (rate == null || Number.isNaN(rate) || !anchors) return 50;
  const { low, high } = anchors;
  if (high === low) return 50;

  let t = (rate - low) / (high - low);
  if (invert) t = 1 - t;
  // Do not clamp t — allow superstar (99) and replacement (25) extremes
  const raw = RATING_FLOOR + t * (RATING_CEIL - RATING_FLOOR);
  return Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, raw)));
}

/** Inverse of ratingFromRate — used if cards become editable later. */
export function rateFromRating(rating, anchors, { invert = false } = {}) {
  if (rating == null || !anchors) return null;
  const { low, high } = anchors;
  const clamped = Math.max(RATING_MIN, Math.min(RATING_MAX, rating));
  let t = (clamped - RATING_FLOOR) / (RATING_CEIL - RATING_FLOOR);
  if (invert) t = 1 - t;
  return low + t * (high - low);
}

function shrinkRate(playerRate, leagueRate, sample, prior) {
  if (sample <= 0) return leagueRate;
  const w = sample / (sample + prior);
  return w * playerRate + (1 - w) * leagueRate;
}

function shrinkRates(rates, sample, prior) {
  const out = {};
  for (const key of OUTCOME_KEYS) {
    out[key] = shrinkRate(rates[key] ?? LEAGUE_AVG[key], LEAGUE_AVG[key], sample, prior);
  }
  return normalizeProbabilities(out);
}

/**
 * Build PA outcome rates from MLB season hitting splits.
 * Returns null only when there is essentially no data (caller may fall back to league).
 */
export function batterRatesFromStats(stats, { shrink = true } = {}) {
  if (!stats) return { ...LEAGUE_AVG, sample: 0, shrunk: true };

  const pa = stats.plateAppearances || stats.atBats || 0;
  if (pa < 1) return { ...LEAGUE_AVG, sample: 0, shrunk: true };

  const hr = (stats.homeRuns || 0) / pa;
  const triple = (stats.triples || 0) / pa;
  const doubles = (stats.doubles || 0) / pa;
  const singles = Math.max(
    0,
    ((stats.hits || 0) - (stats.homeRuns || 0) - (stats.triples || 0) - (stats.doubles || 0)),
  ) / pa;
  const bb = (stats.baseOnBalls || 0) / pa;
  const hbp = (stats.hitByPitch || 0) / pa;
  const k = (stats.strikeOuts || 0) / pa;
  const out = Math.max(0.05, 1 - hr - triple - doubles - singles - bb - hbp - k);

  let rates = normalizeProbabilities({
    HR: hr,
    '3B': triple,
    '2B': doubles,
    '1B': singles,
    BB: bb,
    HBP: hbp,
    K: k,
    OUT: out,
  });

  const didShrink = shrink && pa < RATE_SHRINK_PA * 2;
  if (didShrink) rates = shrinkRates(rates, pa, RATE_SHRINK_PA);

  return { ...rates, sample: pa, shrunk: didShrink };
}

/**
 * Pitcher allowed rates per batters faced (Log5 side).
 * Prefer BF if present; else ~4.3 BF/IP.
 */
export function pitcherRatesFromStats(pitchingStats, { shrink = true } = {}) {
  if (!pitchingStats) return { ...LEAGUE_AVG, sample: 0, shrunk: true };

  const ip = parseFloat(pitchingStats.inningsPitched) || 0;
  const bf = pitchingStats.battersFaced
    || pitchingStats.battersFacedTotal
    || (ip > 0 ? ip * 4.3 : 0);

  if (bf < 5 && ip < 5) return { ...LEAGUE_AVG, sample: 0, shrunk: true };

  const denom = Math.max(bf, 1);
  const hits = pitchingStats.hits || 0;
  const hr = pitchingStats.homeRuns || 0;
  const triple = pitchingStats.triples || 0;
  const doubles = pitchingStats.doubles || 0;
  const singles = Math.max(0, hits - hr - triple - doubles);
  const bb = pitchingStats.baseOnBalls || 0;
  const hbp = pitchingStats.hitByPitch || 0;
  const k = pitchingStats.strikeOuts || 0;
  const out = Math.max(0.05, 1 - (hr + triple + doubles + singles + bb + hbp + k) / denom);

  let rates = normalizeProbabilities({
    HR: hr / denom,
    '3B': triple / denom,
    '2B': doubles / denom,
    '1B': singles / denom,
    BB: bb / denom,
    HBP: hbp / denom,
    K: k / denom,
    OUT: out,
  });

  const sample = Math.round(denom);
  const didShrink = shrink && sample < RATE_SHRINK_BF * 2;
  if (didShrink) rates = shrinkRates(rates, sample, RATE_SHRINK_BF);

  return { ...rates, sample, shrunk: didShrink };
}

function speedProxy(stats, rates) {
  if (!stats) return rates['3B'] * 4;
  const pa = Math.max(stats.plateAppearances || stats.atBats || 1, 1);
  const sb = (stats.stolenBases || 0) / pa;
  const cs = (stats.caughtStealing || 0) / pa;
  const attempts = sb + cs;
  const success = attempts > 0.005 ? sb / attempts : 0.7;
  // Blend steal volume, success, and triples rate
  return sb * 0.55 + attempts * success * 0.15 + (rates['3B'] || 0) * 3.5;
}

function blendPowerWithStatcast(hrRate, statcast) {
  if (!statcast) return hrRate;
  const brl = statcast.barrelBatRate ?? statcast.barrelPercent ?? null;
  const avgEV = statcast.avgHitSpeed ?? statcast.avgExitVelocity ?? null;
  if (brl == null && avgEV == null) return hrRate;

  // Light flavor only for the POW number — does not change engine rates.
  let mult = 1;
  if (brl != null) mult *= Math.sqrt(Math.max(0.4, Math.min(2.2, brl / 8.0)));
  if (avgEV != null) mult *= Math.sqrt(Math.max(0.85, Math.min(1.15, avgEV / 87.5)));
  return hrRate * (0.75 + 0.25 * mult);
}

function weightedOvr(parts) {
  let sum = 0;
  let w = 0;
  for (const [rating, weight] of parts) {
    sum += rating * weight;
    w += weight;
  }
  return Math.round(sum / Math.max(w, 1));
}

export function buildBatterCard(rates, stats = null, statcast = null) {
  const r = rates || LEAGUE_AVG;
  const contactRate = 1 - (r.K ?? LEAGUE_AVG.K);
  const powerRate = blendPowerWithStatcast(r.HR ?? LEAGUE_AVG.HR, statcast);
  const gapRate = (r['2B'] ?? 0) + (r['3B'] ?? 0);
  const eyeRate = r.BB ?? LEAGUE_AVG.BB;
  const spdRate = speedProxy(stats, r);

  const CON = ratingFromRate(contactRate, RATING_ANCHORS.contact);
  const POW = ratingFromRate(powerRate, RATING_ANCHORS.power);
  const GAP = ratingFromRate(gapRate, RATING_ANCHORS.gap);
  const EYE = ratingFromRate(eyeRate, RATING_ANCHORS.eye);
  const SPD = ratingFromRate(spdRate, RATING_ANCHORS.speed);
  const OVR = weightedOvr([
    [CON, 0.28],
    [POW, 0.28],
    [EYE, 0.18],
    [GAP, 0.14],
    [SPD, 0.12],
  ]);

  return {
    role: 'batter',
    CON,
    POW,
    GAP,
    EYE,
    SPD,
    OVR,
    // canonical rates snapshot used for display tooltips / invert
    rates: {
      HR: r.HR,
      '3B': r['3B'],
      '2B': r['2B'],
      '1B': r['1B'],
      BB: r.BB,
      HBP: r.HBP,
      K: r.K,
      OUT: r.OUT,
    },
    sample: r.sample ?? null,
    shrunk: Boolean(r.shrunk),
  };
}

export function buildPitcherCard(rates, pitchingStats = null) {
  const r = rates || LEAGUE_AVG;
  const STF = ratingFromRate(r.K ?? LEAGUE_AVG.K, RATING_ANCHORS.stuff);
  const CTL = ratingFromRate(r.BB ?? LEAGUE_AVG.BB, RATING_ANCHORS.control, { invert: true });
  const HRA = ratingFromRate(r.HR ?? LEAGUE_AVG.HR, RATING_ANCHORS.hrAvoid, { invert: true });
  // Soft movement proxy: low contact allowed + low HR
  const contactAllowed = (r['1B'] ?? 0) + (r['2B'] ?? 0) + (r['3B'] ?? 0) + (r.HR ?? 0);
  const MOV = ratingFromRate(contactAllowed, { low: 0.18, high: 0.32 }, { invert: true });
  const OVR = weightedOvr([
    [STF, 0.35],
    [CTL, 0.25],
    [HRA, 0.25],
    [MOV, 0.15],
  ]);

  return {
    role: 'pitcher',
    STF,
    CTL,
    HRA,
    MOV,
    OVR,
    rates: {
      HR: r.HR,
      '3B': r['3B'],
      '2B': r['2B'],
      '1B': r['1B'],
      BB: r.BB,
      HBP: r.HBP,
      K: r.K,
      OUT: r.OUT,
    },
    sample: r.sample ?? null,
    shrunk: Boolean(r.shrunk),
    era: pitchingStats?.era ?? null,
  };
}

/** Attach rates + card to a roster player (mutates copy). */
export function enrichPlayerWithCard(player) {
  if (!player) return player;

  const isPitcher = player.posType === 'Pitcher'
    || (player.pitchingStats && !player.stats)
    || (player.pos === 'P');

  if (isPitcher && player.pitchingStats) {
    const pitchRates = pitcherRatesFromStats(player.pitchingStats);
    return {
      ...player,
      rates: null,
      pitchRates,
      card: buildPitcherCard(pitchRates, player.pitchingStats),
    };
  }

  const rates = batterRatesFromStats(player.stats);
  const card = buildBatterCard(rates, player.stats, player.statcastStats);

  // Two-way / batters with pitching stats also get pitch card stash
  let pitchRates = null;
  let pitchCard = null;
  if (player.pitchingStats) {
    pitchRates = pitcherRatesFromStats(player.pitchingStats);
    pitchCard = buildPitcherCard(pitchRates, player.pitchingStats);
  }

  return {
    ...player,
    rates,
    pitchRates,
    card,
    pitchCard,
  };
}

/**
 * Rebuild engine rates from a batter card's ratings (future editor).
 * Preserves relative 1B/HBP shape from baseRates, then renormalizes.
 */
export function ratesFromBatterCard(card, baseRates = LEAGUE_AVG) {
  if (!card) return { ...baseRates };

  const contact = rateFromRating(card.CON, RATING_ANCHORS.contact);
  const K = Math.max(0.05, Math.min(0.45, 1 - contact));
  const HR = Math.max(0, rateFromRating(card.POW, RATING_ANCHORS.power));
  const gap = Math.max(0, rateFromRating(card.GAP, RATING_ANCHORS.gap));
  const BB = Math.max(0, rateFromRating(card.EYE, RATING_ANCHORS.eye));
  const tripleShare = 0.1;
  const triples = gap * tripleShare;
  const doubles = gap * (1 - tripleShare);
  const HBP = baseRates.HBP ?? LEAGUE_AVG.HBP;

  // Scale singles from residual non-K contact mass vs base shape
  const baseContactHits = (baseRates['1B'] ?? 0) + (baseRates['2B'] ?? 0)
    + (baseRates['3B'] ?? 0) + (baseRates.HR ?? 0);
  const targetHits = Math.max(0.05, contact - BB - HBP) * 0.55;
  const singles = baseContactHits > 0
    ? Math.max(0.04, (baseRates['1B'] ?? LEAGUE_AVG['1B']) * (targetHits / baseContactHits))
    : LEAGUE_AVG['1B'];

  const used = HR + triples + doubles + singles + BB + HBP + K;
  const OUT = Math.max(0.05, 1 - used);

  return normalizeProbabilities({
    HR,
    '3B': triples,
    '2B': doubles,
    '1B': singles,
    BB,
    HBP,
    K,
    OUT,
  });
}

/** Outcome-rate object only (strip metadata). */
export function pureRates(ratesOrNull) {
  if (!ratesOrNull) return { ...LEAGUE_AVG };
  const out = {};
  for (const key of OUTCOME_KEYS) out[key] = ratesOrNull[key] ?? LEAGUE_AVG[key];
  return normalizeProbabilities(out);
}

/**
 * Monte Carlo: N plate appearances vs league-average pitcher, neutral park.
 * Returns empirical rates + max relative error vs input batter rates.
 */
export function calibrateBatterRates(batterRates, n = 10000, rng = Math.random) {
  const target = pureRates(batterRates);
  // vs league pitcher Log5 leaves rates unchanged
  const counts = Object.fromEntries(OUTCOME_KEYS.map((k) => [k, 0]));

  for (let i = 0; i < n; i++) {
    let roll = rng();
    let cumulative = 0;
    let picked = 'OUT';
    for (const key of OUTCOME_KEYS) {
      cumulative += target[key];
      if (roll < cumulative) {
        picked = key;
        break;
      }
    }
    counts[picked] += 1;
  }

  const empirical = {};
  let maxRelErr = 0;
  for (const key of OUTCOME_KEYS) {
    empirical[key] = counts[key] / n;
    const exp = target[key];
    if (exp > 0.01) {
      maxRelErr = Math.max(maxRelErr, Math.abs(empirical[key] - exp) / exp);
    }
  }

  return { target, empirical, maxRelErr, n };
}
