export const CURRENT_SEASON = 2026;
export const HISTORICAL_SEASON_MIN = 2003;

export const SIM_SEASON_OPTIONS = Array.from(
  { length: CURRENT_SEASON - HISTORICAL_SEASON_MIN + 1 },
  (_, index) => String(CURRENT_SEASON - index),
);

export const SERIES_LENGTH_OPTIONS = [
  { value: 1, label: 'Single Game' },
  { value: 3, label: 'Best of 3' },
  { value: 5, label: 'Best of 5' },
  { value: 7, label: 'Best of 7' },
];

/** PA outcome rates — league average (engine + Log5 baseline). */
export const LEAGUE_AVG = {
  HR: 0.033, '3B': 0.005, '2B': 0.048, '1B': 0.145,
  BB: 0.080, HBP: 0.010, K: 0.227, OUT: 0.452,
};

/** Bayesian prior strength: effective "ghost" PAs / BF mixed toward league. */
export const RATE_SHRINK_PA = 120;
export const RATE_SHRINK_BF = 80;

/**
 * Rating anchors: rate at overall ~40 (poor) and ~80 (elite).
 * Linear map: 40..80 between anchors, clamp 25..99. 50 ≈ league when rate ≈ mid.
 */
export const RATING_ANCHORS = {
  contact: { low: 0.68, high: 0.84 },       // 1 − K/PA  (league ~0.773)
  power: { low: 0.012, high: 0.058 },       // HR/PA
  gap: { low: 0.030, high: 0.075 },         // (2B+3B)/PA
  eye: { low: 0.040, high: 0.140 },         // BB/PA
  speed: { low: 0.005, high: 0.080 },       // SB/PA proxy blended with 3B
  stuff: { low: 0.140, high: 0.320 },       // K/BF
  control: { low: 0.050, high: 0.130 },     // BB/BF — inverted (low BB = high rating)
  hrAvoid: { low: 0.015, high: 0.055 },     // HR/BF — inverted
};

export const RATING_MIN = 25;
export const RATING_MAX = 99;
export const RATING_FLOOR = 40;
export const RATING_CEIL = 80;

export const PARK_FACTORS = {
  115: { hr: 1.30, hits: 1.12, name: 'Coors Field' },
  113: { hr: 1.15, hits: 1.05, name: 'Great American Ballpark' },
  111: { hr: 1.10, hits: 1.07, name: 'Fenway Park' },
  147: { hr: 1.08, hits: 1.02, name: 'Yankee Stadium' },
  114: { hr: 1.05, hits: 1.01, name: 'Progressive Field' },
  140: { hr: 1.06, hits: 1.02, name: 'Globe Life Field' },
  117: { hr: 0.95, hits: 0.97, name: 'Minute Maid Park' },
  136: { hr: 0.92, hits: 0.95, name: 'T-Mobile Park' },
  119: { hr: 0.90, hits: 0.96, name: 'Dodger Stadium' },
  135: { hr: 0.88, hits: 0.94, name: 'Petco Park' },
  137: { hr: 0.87, hits: 0.93, name: 'Oracle Park' },
};

export const DEFAULT_PARK = { hr: 1.0, hits: 1.0, name: 'Neutral Park' };

/** MLB teamId → home venueId (Gameday stadium image ids). */
export const TEAM_VENUE_ID = {
  109: 15, 144: 4705, 110: 2, 111: 3, 112: 17, 145: 4, 113: 2602, 114: 5,
  115: 19, 116: 2394, 117: 2392, 118: 7, 108: 1, 119: 22, 146: 4169, 158: 32,
  142: 3312, 121: 3289, 147: 3313, 133: 10, 143: 2681, 134: 31, 135: 2680,
  137: 2395, 136: 680, 138: 2889, 139: 12, 140: 5325, 141: 14, 120: 3309,
};

export function venueIdForTeam(teamId) {
  return TEAM_VENUE_ID[teamId] ?? null;
}

export const PITCH_DEFS = {
  FF: { name: '4-Seam Fastball', short: 'FF', velMean: 93.5, velStd: 2.5, spinMean: 2270, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  SI: { name: 'Sinker', short: 'SI', velMean: 92.5, velStd: 2.0, spinMean: 2100, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  FC: { name: 'Cutter', short: 'FC', velMean: 89.0, velStd: 1.8, spinMean: 2400, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  SL: { name: 'Slider', short: 'SL', velMean: 85.0, velStd: 2.5, spinMean: 2400, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  SW: { name: 'Sweeper', short: 'SW', velMean: 82.0, velStd: 2.0, spinMean: 2600, color: 'text-teal-400', bg: 'bg-teal-400/10 border-teal-400/20' },
  CU: { name: 'Curveball', short: 'CU', velMean: 77.0, velStd: 2.5, spinMean: 2500, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  CH: { name: 'Changeup', short: 'CH', velMean: 84.0, velStd: 2.5, spinMean: 1800, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
  FS: { name: 'Splitter', short: 'FS', velMean: 85.0, velStd: 2.0, spinMean: 1600, color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20' },
};

export const PITCH_RESULT_LABELS = { B: 'Ball', CS: 'Called Strike', SS: 'Swing & Miss', F: 'Foul', X: 'In Play' };

export const PITCH_RESULT_BG = {
  B: 'bg-green-500/15 border-green-500/30',
  CS: 'bg-red-500/15 border-red-500/30',
  SS: 'bg-red-500/15 border-red-500/30',
  F: 'bg-slate-500/15 border-slate-500/30',
  X: 'bg-blue-500/15 border-blue-500/30',
};