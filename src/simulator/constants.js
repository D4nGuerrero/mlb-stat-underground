export const CURRENT_SEASON = 2026;

export const LEAGUE_AVG = {
  HR: 0.033, '3B': 0.005, '2B': 0.048, '1B': 0.145,
  BB: 0.080, HBP: 0.010, K: 0.227, OUT: 0.452,
};

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