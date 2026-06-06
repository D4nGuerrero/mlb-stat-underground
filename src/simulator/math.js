import { LEAGUE_AVG } from './constants';

export function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function normalizeProbabilities(probs) {
  const total = Object.values(probs).reduce((sum, value) => sum + value, 0);
  if (total === 0) return { ...LEAGUE_AVG };
  const result = {};
  for (const key of Object.keys(probs)) result[key] = probs[key] / total;
  return result;
}

export function weightedOutcome(probs) {
  const roll = Math.random();
  let cumulative = 0;
  for (const [key, probability] of Object.entries(probs)) {
    cumulative += probability;
    if (roll < cumulative) return key;
  }
  return 'OUT';
}

/** Statcast-style bucket from launch angle (degrees). */
export function classifyBattedBall(la) {
  if (la >= 50) return 'PU';
  if (la >= 25) return 'FB';
  if (la >= 10) return 'LD';
  return 'GB';
}
