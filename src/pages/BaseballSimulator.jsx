import { useState, useCallback, useRef, useEffect } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { TeamPicker, SegmentedControl, Select, Collapsible } from '../components/ui';

// ── MLB Teams ────────────────────────────────────────────────────────────────
const MLB_TEAMS = [
  { id: 108, name: 'Los Angeles Angels',    abbr: 'LAA', league: 'AL', division: 'West',    venueId: 1 },
  { id: 109, name: 'Arizona Diamondbacks',  abbr: 'ARI', league: 'NL', division: 'West',    venueId: 15 },
  { id: 110, name: 'Baltimore Orioles',     abbr: 'BAL', league: 'AL', division: 'East',    venueId: 2 },
  { id: 111, name: 'Boston Red Sox',        abbr: 'BOS', league: 'AL', division: 'East',    venueId: 3 },
  { id: 112, name: 'Chicago Cubs',          abbr: 'CHC', league: 'NL', division: 'Central', venueId: 17 },
  { id: 113, name: 'Cincinnati Reds',       abbr: 'CIN', league: 'NL', division: 'Central', venueId: 18 },
  { id: 114, name: 'Cleveland Guardians',   abbr: 'CLE', league: 'AL', division: 'Central', venueId: 5 },
  { id: 115, name: 'Colorado Rockies',      abbr: 'COL', league: 'NL', division: 'West',    venueId: 19 },
  { id: 116, name: 'Detroit Tigers',        abbr: 'DET', league: 'AL', division: 'Central', venueId: 6 },
  { id: 117, name: 'Houston Astros',        abbr: 'HOU', league: 'AL', division: 'West',    venueId: 7 },
  { id: 118, name: 'Kansas City Royals',    abbr: 'KC',  league: 'AL', division: 'Central', venueId: 8 },
  { id: 119, name: 'Los Angeles Dodgers',   abbr: 'LAD', league: 'NL', division: 'West',    venueId: 22 },
  { id: 120, name: 'Washington Nationals',  abbr: 'WSH', league: 'NL', division: 'East',    venueId: 23 },
  { id: 121, name: 'New York Mets',         abbr: 'NYM', league: 'NL', division: 'East',    venueId: 24 },
  { id: 133, name: 'Oakland Athletics',     abbr: 'OAK', league: 'AL', division: 'West',    venueId: 10 },
  { id: 134, name: 'Pittsburgh Pirates',    abbr: 'PIT', league: 'NL', division: 'Central', venueId: 25 },
  { id: 135, name: 'San Diego Padres',      abbr: 'SD',  league: 'NL', division: 'West',    venueId: 26 },
  { id: 136, name: 'Seattle Mariners',      abbr: 'SEA', league: 'AL', division: 'West',    venueId: 12 },
  { id: 137, name: 'San Francisco Giants',  abbr: 'SF',  league: 'NL', division: 'West',    venueId: 27 },
  { id: 138, name: 'St. Louis Cardinals',   abbr: 'STL', league: 'NL', division: 'Central', venueId: 28 },
  { id: 139, name: 'Tampa Bay Rays',        abbr: 'TB',  league: 'AL', division: 'East',    venueId: 13 },
  { id: 140, name: 'Texas Rangers',         abbr: 'TEX', league: 'AL', division: 'West',    venueId: 14 },
  { id: 141, name: 'Toronto Blue Jays',     abbr: 'TOR', league: 'AL', division: 'East',    venueId: 29 },
  { id: 142, name: 'Minnesota Twins',       abbr: 'MIN', league: 'AL', division: 'Central', venueId: 9 },
  { id: 143, name: 'Philadelphia Phillies', abbr: 'PHI', league: 'NL', division: 'East',    venueId: 30 },
  { id: 144, name: 'Atlanta Braves',        abbr: 'ATL', league: 'NL', division: 'East',    venueId: 16 },
  { id: 145, name: 'Chicago White Sox',     abbr: 'CWS', league: 'AL', division: 'Central', venueId: 4 },
  { id: 146, name: 'Miami Marlins',         abbr: 'MIA', league: 'NL', division: 'East',    venueId: 20 },
  { id: 147, name: 'New York Yankees',      abbr: 'NYY', league: 'AL', division: 'East',    venueId: 11 },
  { id: 158, name: 'Milwaukee Brewers',     abbr: 'MIL', league: 'NL', division: 'Central', venueId: 21 },
].sort((a, b) => a.name.localeCompare(b.name));

// ── Park Factors (2024 approx — HR index, >1.0 = hitter friendly) ────────────
const PARK_FACTORS = {
  115: { hr: 1.30, hits: 1.12, name: 'Coors Field' },           // COL
  113: { hr: 1.15, hits: 1.05, name: 'Great American Ballpark' }, // CIN
  111: { hr: 1.10, hits: 1.07, name: 'Fenway Park' },            // BOS
  147: { hr: 1.08, hits: 1.02, name: 'Yankee Stadium' },         // NYY
  114: { hr: 1.05, hits: 1.01, name: 'Progressive Field' },      // CLE
  140: { hr: 1.06, hits: 1.02, name: 'Globe Life Field' },       // TEX
  117: { hr: 0.95, hits: 0.97, name: 'Minute Maid Park' },       // HOU
  136: { hr: 0.92, hits: 0.95, name: 'T-Mobile Park' },          // SEA
  119: { hr: 0.90, hits: 0.96, name: 'Dodger Stadium' },         // LAD
  135: { hr: 0.88, hits: 0.94, name: 'Petco Park' },             // SD
  137: { hr: 0.87, hits: 0.93, name: 'Oracle Park' },            // SF
};
const DEFAULT_PARK = { hr: 1.0, hits: 1.0 };

// ── Pitch Definitions ─────────────────────────────────────────────────────────
const PITCH_DEFS = {
  FF: { name: '4-Seam Fastball', short: 'FF', velMean: 93.5, velStd: 2.5, spinMean: 2270, color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' },
  SI: { name: 'Sinker',          short: 'SI', velMean: 92.5, velStd: 2.0, spinMean: 2100, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  FC: { name: 'Cutter',          short: 'FC', velMean: 89.0, velStd: 1.8, spinMean: 2400, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  SL: { name: 'Slider',          short: 'SL', velMean: 85.0, velStd: 2.5, spinMean: 2400, color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20' },
  SW: { name: 'Sweeper',         short: 'SW', velMean: 82.0, velStd: 2.0, spinMean: 2600, color: 'text-teal-400',   bg: 'bg-teal-400/10 border-teal-400/20' },
  CU: { name: 'Curveball',       short: 'CU', velMean: 77.0, velStd: 2.5, spinMean: 2500, color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
  CH: { name: 'Changeup',        short: 'CH', velMean: 84.0, velStd: 2.5, spinMean: 1800, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
  FS: { name: 'Splitter',        short: 'FS', velMean: 85.0, velStd: 2.0, spinMean: 1600, color: 'text-pink-400',   bg: 'bg-pink-400/10 border-pink-400/20' },
};

// Box-Muller normal distribution
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Build pitcher arsenal from real stats
function buildPitcherArsenal(pitcherStats) {
  if (!pitcherStats) return [{ type: 'FF', w: 0.55 }, { type: 'SL', w: 0.25 }, { type: 'CH', w: 0.20 }];
  const ip     = Math.max(pitcherStats.inningsPitched || 0, 5);
  const kPer9  = (pitcherStats.strikeOuts  || 0) / ip * 9;
  const bbPer9 = (pitcherStats.baseOnBalls || 0) / ip * 9;
  const hrPer9 = (pitcherStats.homeRuns    || 0) / ip * 9;
  if (kPer9 >= 10)   return [{ type: 'FF', w: 0.42 }, { type: 'SL', w: 0.30 }, { type: 'CH', w: 0.15 }, { type: 'CU', w: 0.13 }];
  if (hrPer9 < 0.8)  return [{ type: 'SI', w: 0.44 }, { type: 'SL', w: 0.24 }, { type: 'CH', w: 0.20 }, { type: 'FC', w: 0.12 }];
  if (bbPer9 < 2.0)  return [{ type: 'FF', w: 0.35 }, { type: 'FC', w: 0.22 }, { type: 'CU', w: 0.25 }, { type: 'CH', w: 0.18 }];
  return                    [{ type: 'FF', w: 0.50 }, { type: 'SL', w: 0.22 }, { type: 'CH', w: 0.18 }, { type: 'CU', w: 0.10 }];
}

// Count-aware pitch selection
function selectPitchType(arsenal, balls, strikes) {
  let adj = arsenal.map(p => ({ ...p }));
  if (balls >= 3 && strikes < 2)  adj = adj.map((p, i) => ({ ...p, w: i === 0 ? p.w * 2.0 : p.w * 0.5 }));
  if (strikes >= 2 && balls <= 1) adj = adj.map((p, i) => ({ ...p, w: i === 0 ? p.w * 0.7 : p.w * 1.5 }));
  const total = adj.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of adj) { r -= p.w; if (r <= 0) return p.type; }
  return adj[0].type;
}

// Generate pitch location & zone
function generatePitchLocation(pitcherStats, balls) {
  const bb   = pitcherStats?.baseOnBalls || 0;
  const bf   = Math.max((pitcherStats?.inningsPitched || 50) * 4.3, 50);
  const ctrl = Math.max(0.40, 0.58 - (bb / bf) * 0.5);
  const zonePct = balls >= 3 ? Math.min(0.80, ctrl * 1.4) : ctrl;
  const throwInZone = Math.random() < zonePct;

  let plateX, plateZ;
  if (throwInZone) {
    plateX = (Math.random() - 0.5) * 1.4;
    plateZ = 1.6 + Math.random() * 1.8;
  } else {
    const side = Math.floor(Math.random() * 4);
    if      (side === 0) { plateX = -0.85 - Math.random() * 0.4; plateZ = 1.6 + Math.random() * 1.8; }
    else if (side === 1) { plateX =  0.85 + Math.random() * 0.4; plateZ = 1.6 + Math.random() * 1.8; }
    else if (side === 2) { plateX = (Math.random() - 0.5) * 1.4; plateZ = 0.7 + Math.random() * 0.6; }
    else                 { plateX = (Math.random() - 0.5) * 1.4; plateZ = 3.6 + Math.random() * 0.5; }
  }
  const inZone = Math.abs(plateX) <= 0.71 && plateZ >= 1.5 && plateZ <= 3.5;
  let zone;
  if (inZone) {
    const col = plateX < -0.24 ? 0 : plateX < 0.24 ? 1 : 2;
    const row = plateZ > 2.83  ? 0 : plateZ > 2.17  ? 1 : 2;
    zone = row * 3 + col + 1;
  } else {
    zone = plateX < -0.71 ? 11 : plateX > 0.71 ? 12 : plateZ < 1.5 ? 13 : 14;
  }
  return { plateX: Math.round(plateX * 100) / 100, plateZ: Math.round(plateZ * 100) / 100, inZone, zone };
}

// Ball-in-play Statcast outcome
function simulateBip(vel, pitchType, inZone, zone, batter, pitcherStats, homeTeamId) {
  const bs = batter?.stats;
  const st = batter?.statcastStats;
  let baseEV = 87.5;
  if (st?.avgHitSpeed) baseEV = st.avgHitSpeed;
  else if (bs) {
    const pa = bs.plateAppearances || bs.atBats || 400;
    if (pa > 30) baseEV = 85 + ((bs.slg || 0.400) - (bs.avg || 0.250)) * 28;
  }
  if (pitcherStats) baseEV -= (4.0 - (parseFloat(pitcherStats.era) || 4.0)) * 0.6;

  const velMean    = PITCH_DEFS[pitchType]?.velMean || 90;
  const locPenalty = !inZone ? -2.5 : zone === 5 ? 1.5 : 0;
  const ev         = Math.max(50, baseEV - (vel - velMean) * 0.12 + locPenalty + randn() * 7);

  const laRoll = Math.random();
  let la;
  if      (laRoll < 0.43) la = -5  + Math.random() * 14;
  else if (laRoll < 0.68) la = 10  + Math.random() * 14;
  else if (laRoll < 0.90) la = 25  + Math.random() * 22;
  else                    la = 50  + Math.random() * 30;

  const spray    = (Math.random() - 0.4) * 80;
  const hardHit  = ev >= 95;
  const barrel   = ev >= 98 && la >= 8 && la <= 32;
  const pf       = PARK_FACTORS[homeTeamId] || DEFAULT_PARK;

  let outcome;
  if (la > 50) {
    outcome = 'OUT';
  } else if (la < 0) {
    outcome = Math.random() < (ev > 98 ? 0.35 : 0.24) ? '1B' : 'OUT';
  } else if (la < 10) {
    outcome = Math.random() < 0.28 ? '1B' : 'OUT';
  } else if (la < 25) {
    outcome = ev >= 95
      ? weightedOutcome({ '1B': 0.35, '2B': 0.28, '3B': 0.05, HR: 0.04 * pf.hr, OUT: 0.28 })
      : weightedOutcome({ '1B': 0.44, '2B': 0.18, OUT: 0.38 });
  } else if (la <= 35) {
    if      (ev >= 103) outcome = weightedOutcome({ HR: Math.min(0.90, 0.85 * pf.hr), '2B': 0.06, OUT: 0.09 });
    else if (ev >= 98)  outcome = weightedOutcome({ HR: Math.min(0.62, 0.55 * pf.hr), '2B': 0.22, OUT: 0.23 });
    else if (ev >= 90)  outcome = weightedOutcome({ HR: Math.min(0.22, 0.18 * pf.hr), '2B': 0.25, '1B': 0.10, OUT: 0.47 });
    else                outcome = weightedOutcome({ '1B': 0.15, '2B': 0.08, OUT: 0.77 });
  } else {
    if      (ev >= 100) outcome = weightedOutcome({ HR: Math.min(0.75, 0.68 * pf.hr), '2B': 0.12, OUT: 0.20 });
    else if (ev >= 90)  outcome = weightedOutcome({ HR: Math.min(0.28, 0.22 * pf.hr), '2B': 0.18, OUT: 0.60 });
    else                outcome = weightedOutcome({ '2B': 0.05, OUT: 0.95 });
  }
  return { ev: Math.round(ev * 10) / 10, la: Math.round(la * 10) / 10, spray: Math.round(spray * 10) / 10, hardHit, barrel, outcome };
}

// Full pitch-by-pitch at-bat simulation
function simulateAtBat(batter, pitcherPlayer, homeTeamId) {
  const pitcherStats = pitcherPlayer?.pitchingStats;
  const arsenal      = buildPitcherArsenal(pitcherStats);
  const bs           = batter?.stats;
  const pitches      = [];
  let balls = 0, strikes = 0, outcome = null, bipResult = null;

  // HBP pre-check
  if (Math.random() < 0.009) return { outcome: 'HBP', pitches: [], pitchCount: 1 };

  while (outcome === null) {
    const pt  = selectPitchType(arsenal, balls, strikes);
    const pd  = PITCH_DEFS[pt] || PITCH_DEFS.FF;
    const vel = pd.velMean + randn() * pd.velStd;
    const loc = generatePitchLocation(pitcherStats, balls);

    // Swing decision
    let zSwing = 0.68, cSwing = 0.28;
    if (balls >= 3)           { zSwing *= 1.05; cSwing *= 0.70; }
    if (strikes >= 2)         { zSwing *= 1.08; cSwing *= 1.35; }
    if (!balls && !strikes)   { cSwing *= 0.85; }
    if (bs) {
      const pa = bs.plateAppearances || bs.atBats || 400;
      if (pa > 30) {
        const kRate = (bs.strikeOuts || 0) / pa;
        if (kRate > 0.28) cSwing *= 1.15;
        if (kRate < 0.15) cSwing *= 0.85;
      }
    }
    const swings = Math.random() < (loc.inZone ? zSwing : cSwing);

    let pitchResult;
    if (!swings) {
      pitchResult = loc.inZone ? 'CS' : 'B';
      if (pitchResult === 'B') balls++;
      else { strikes = Math.min(strikes + 1, 2); if (strikes >= 3) outcome = 'K'; }
    } else {
      const whiffBase = { FF: 0.22, SI: 0.18, FC: 0.24, SL: 0.28, SW: 0.33, CU: 0.26, CH: 0.30, FS: 0.32 };
      let whiff = (whiffBase[pt] || 0.25) * (!loc.inZone ? 1.3 : loc.zone === 5 ? 0.75 : 1.0);
      const velDiff = vel - (pd.velMean || 90);
      whiff = Math.max(0.05, Math.min(0.65, whiff + velDiff * 0.003));
      if (bs) {
        const pa = bs.plateAppearances || bs.atBats || 400;
        if (pa > 30) whiff *= Math.min(2, Math.max(0.5, (bs.strikeOuts || 0) / pa / LEAGUE_AVG.K));
      }
      const contact = Math.random() > whiff;
      if (!contact) {
        pitchResult = 'SS';
        strikes = Math.min(strikes + 1, 2);
        if (strikes >= 3) outcome = 'K';
      } else {
        const isFoul = Math.random() < (loc.inZone ? 0.33 : 0.50);
        if (isFoul) {
          pitchResult = 'F';
          if (strikes < 2) strikes++;
        } else {
          pitchResult = 'X';
          bipResult = simulateBip(vel, pt, loc.inZone, loc.zone, batter, pitcherStats, homeTeamId);
          outcome = bipResult.outcome;
        }
      }
    }

    pitches.push({
      num:      pitches.length + 1,
      type:     pt,
      typeName: pd.name,
      velocity: Math.round(vel * 10) / 10,
      spinRate: Math.round((pd.spinMean + randn() * 150)),
      plateX:   loc.plateX,
      plateZ:   loc.plateZ,
      zone:     loc.zone,
      inZone:   loc.inZone,
      result:   pitchResult,
      count:    `${balls}-${strikes}`,
      ...(pitchResult === 'X' && bipResult ? { ev: bipResult.ev, la: bipResult.la } : {}),
    });

    if (balls >= 4) { outcome = 'BB'; break; }
    if (outcome !== null) break;
  }

  return {
    outcome,
    pitches,
    pitchCount: pitches.length,
    ...(bipResult ? { exitVelocity: bipResult.ev, launchAngle: bipResult.la, sprayAngle: bipResult.spray, hardHit: bipResult.hardHit, barrel: bipResult.barrel } : {}),
  };
}

// ── League-average per-PA probabilities (2024 MLB) ───────────────────────────
const LEAGUE_AVG = { HR: 0.033, '3B': 0.005, '2B': 0.048, '1B': 0.145, BB: 0.080, HBP: 0.010, K: 0.227, OUT: 0.452 };

const teamLogoUrl = (id) => `https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg`;

// ── Probability Model ────────────────────────────────────────────────────────

function normalizeProbabilities(probs) {
  const total = Object.values(probs).reduce((s, v) => s + v, 0);
  if (total === 0) return { ...LEAGUE_AVG };
  const result = {};
  for (const k in probs) result[k] = probs[k] / total;
  return result;
}

/** Build per-batter outcome probs from real MLB stats */
function batterProbabilities(stats) {
  if (!stats) return { ...LEAGUE_AVG };
  const pa = stats.plateAppearances || stats.atBats || 400;
  if (pa < 30) return { ...LEAGUE_AVG };
  const hr = (stats.homeRuns || 0) / pa;
  const triple = (stats.triples || 0) / pa;
  const double_ = (stats.doubles || 0) / pa;
  const singles = Math.max(0, ((stats.hits || 0) - (stats.homeRuns || 0) - (stats.triples || 0) - (stats.doubles || 0))) / pa;
  const bb = (stats.baseOnBalls || 0) / pa;
  const hbp = (stats.hitByPitch || 0) / pa;
  const k = (stats.strikeOuts || 0) / pa;
  const out = Math.max(0.05, 1 - hr - triple - double_ - singles - bb - hbp - k);
  return normalizeProbabilities({ HR: hr, '3B': triple, '2B': double_, '1B': singles, BB: bb, HBP: hbp, K: k, OUT: out });
}

/**
 * Blend batter probs with pitcher modifier (log5 / geometric blend).
 * pitcher power: 0 = all batter, 1 = all pitcher.
 */
function blendWithPitcher(batterProbs, pitcherStats) {
  if (!pitcherStats) return batterProbs;
  const ip = pitcherStats.inningsPitched || 50;
  if (ip < 5) return batterProbs;
  const bf = ip * 4.3;
  const pK  = Math.min(0.40, (pitcherStats.strikeOuts || 0) / bf);
  const pBB = Math.min(0.20, (pitcherStats.baseOnBalls || 0) / bf);
  const pHR = Math.min(0.08, (pitcherStats.homeRuns || 0) / bf);
  const kRatio  = (pK  + LEAGUE_AVG.K)   > 0 ? pK  / LEAGUE_AVG.K  : 1;
  const bbRatio = (pBB + LEAGUE_AVG.BB)  > 0 ? pBB / LEAGUE_AVG.BB : 1;
  const hrRatio = (pHR + LEAGUE_AVG.HR)  > 0 ? pHR / LEAGUE_AVG.HR : 1;
  const blended = {
    HR:  batterProbs.HR  * Math.sqrt(hrRatio),
    '3B': batterProbs['3B'],
    '2B': batterProbs['2B'],
    '1B': batterProbs['1B'],
    BB:  batterProbs.BB  * Math.sqrt(bbRatio),
    HBP: batterProbs.HBP,
    K:   batterProbs.K   * Math.sqrt(kRatio),
    OUT: batterProbs.OUT,
  };
  return normalizeProbabilities(blended);
}

/** Apply park factor to probabilities */
function applyParkFactor(probs, homeTeamId) {
  const pf = PARK_FACTORS[homeTeamId] || DEFAULT_PARK;
  const adjusted = {
    ...probs,
    HR:  probs.HR  * pf.hr,
    '2B': probs['2B'] * ((pf.hits - 1) * 0.5 + 1),
    '1B': probs['1B'] * ((pf.hits - 1) * 0.3 + 1),
  };
  return normalizeProbabilities(adjusted);
}

function weightedOutcome(probs) {
  const r = Math.random();
  let cum = 0;
  for (const [k, p] of Object.entries(probs)) {
    cum += p;
    if (r < cum) return k;
  }
  return 'OUT';
}

// ── Base Runner Logic (Markov-style state transitions) ───────────────────────

function advanceRunners(bases, hitType, outs) {
  let b = [...bases]; // [1B occupied, 2B occupied, 3B occupied]
  let runs = 0;

  if (hitType === 'HR') {
    runs = 1 + b.filter(Boolean).length;
    b = [false, false, false];
  } else if (hitType === '3B') {
    runs = b.filter(Boolean).length;
    b = [false, false, true];
  } else if (hitType === '2B') {
    if (b[2]) runs++;
    if (b[1]) runs++;
    const r1Scores = b[0] && Math.random() < 0.62;
    if (r1Scores) runs++;
    b = [false, true, b[0] && !r1Scores];
  } else if (hitType === '1B') {
    if (b[2]) runs++;
    const r2Scores = b[1] && Math.random() < 0.50;
    if (r2Scores) runs++;
    const nb = [true, !!b[0], !r2Scores && !!b[1]];
    b = nb;
  } else if (hitType === 'BB' || hitType === 'HBP') {
    if (b[0] && b[1] && b[2]) runs++;
    else if (b[0] && b[1]) b[2] = true;
    else if (b[0]) b[1] = true;
    b[0] = true;
  } else if (hitType === 'OUT' && outs < 2 && b[2]) {
    // Sac fly — 20% chance runner scores from 3rd
    if (Math.random() < 0.20) { runs++; b[2] = false; }
  }

  return { newBases: b, runsScored: runs };
}

// ── Play Description Generator ───────────────────────────────────────────────

const PLAY_DESCS = {
  HR:   (b, r) => r === 1 ? [`🚀 SOLO HOME RUN!`, `⚡ Goes deep — solo blast!`, `💥 Moonshot solo shot!`] :
                             [`💥 ${r}-RUN HOMER!`, `🔥 ${r}-run blast!`, `🚀 Grand slam!`.slice(0, r === 4 ? 100 : 0) || `🔥 ${r}-run bomb!`],
  '3B': (b, r) => [`🏃 Triples!${r ? ` ${r} score.` : ''}`, `⚡ Legged out a triple!${r ? ` Run scores.` : ''}`],
  '2B': (b, r) => [`✌️ Doubles!${r ? ` ${r} run${r > 1 ? 's' : ''} score.` : ''}`, `📏 Gaps it for a double!${r ? ` ${r} in.` : ''}`],
  '1B': (b, r) => [`👟 Singles!${r ? ` Run scores!` : ''}`, `✅ Lines a single!${r ? ` ${r} in.` : ''}`, `📍 Grounds a single through the left side.`],
  BB:   (b, r) => [`🚶 Draws a walk.${r ? ' Forced run!' : ''}`, `📋 Takes ball four.${r ? ' RBI walk.' : ''}`],
  HBP:  (b, r) => [`🤕 Hit by pitch.${r ? ' Run forced in.' : ''}`, `⚠️ Gets plunked.${r ? ' RBI HBP.' : ''}`],
  K:    ()     => [`🌀 Struck out.`, `❌ Fans on a breaking ball.`, `🌀 Swings through it — strikeout!`, `❌ Called strike three.`],
  OUT:  ()     => [`⬛ Grounds out.`, `🔵 Flies out.`, `📍 Lines out.`, `⬛ Infield popup.`, `🔵 Deep fly ball caught.`, `⬛ Weak grounder.`],
};

function descPlay(hitType, batterName, pitcherName, runsScored) {
  const pool = PLAY_DESCS[hitType]?.(null, runsScored) ?? [`${hitType}`];
  const base = pool[Math.floor(Math.random() * pool.length)];
  return `${batterName}: ${base}`;
}

// ── Bullpen / Fatigue Model ──────────────────────────────────────────────────

function pitchesForOutcome(outcome) {
  const avg = { HR: 4.5, '3B': 3.5, '2B': 4.0, '1B': 3.8, BB: 5.0, HBP: 3.0, K: 5.5, OUT: 3.8 };
  return (avg[outcome] || 4) + (Math.random() * 2 - 1);
}

/** Returns a tiredness multiplier 1.0 → 1.4+ based on pitch count */
function fatigueFactor(pitchCount) {
  if (pitchCount < 60) return 1.0;
  if (pitchCount < 80) return 1.05;
  if (pitchCount < 95) return 1.12;
  if (pitchCount < 105) return 1.20;
  return 1.35;
}

/** Degrade pitcher stats based on fatigue */
function applyFatigue(probs, pitchCount) {
  const f = fatigueFactor(pitchCount);
  if (f <= 1.0) return probs;
  const adjusted = {
    ...probs,
    K:   probs.K   / f,
    BB:  probs.BB  * f,
    HR:  probs.HR  * f,
    OUT: probs.OUT / f,
  };
  return normalizeProbabilities(adjusted);
}

// ── Full Game Simulation ─────────────────────────────────────────────────────

function buildLineupProbs(lineup, pitcherStats, homeTeamId) {
  return lineup.map(p => {
    const raw       = batterProbabilities(p.stats);
    const statcast  = applyStatcastAdjustments(raw, p.statcastStats);
    const mixed     = blendWithPitcher(statcast, pitcherStats);
    return applyParkFactor(mixed, homeTeamId);
  });
}

function defaultPlayer(teamId, idx) {
  return {
    id: `${teamId}-p${idx}`,
    name: `Player ${idx + 1}`,
    pos: ['CF', 'SS', '1B', '3B', 'RF', 'LF', 'DH', '2B', 'C'][idx % 9],
    stats: null,
    pitchingStats: null,
  };
}

function simulateGame(awayTeam, homeTeam, awayLineup, homeLineup, awayStarter, homeStarter, awayBullpen, homeBullpen) {
  const INNINGS = 9;
  const innings  = [];
  const plays    = [];

  let awayBatIdx = 0;
  let homeBatIdx = 0;

  const pitcherState = {
    away: { current: homeStarter, pitchCount: 0, bullpenIdx: 0, bullpen: awayBullpen },
    home: { current: awayStarter, pitchCount: 0, bullpenIdx: 0, bullpen: homeBullpen },
  };

  function getCurrentPitcher(battingTeam) {
    const ps    = battingTeam === 'away' ? pitcherState.away : pitcherState.home;
    const tired = ps.pitchCount > 105 || (ps.pitchCount > 85 && Math.random() < 0.25);
    if (tired && ps.bullpenIdx < ps.bullpen.length) {
      ps.current    = ps.bullpen[ps.bullpenIdx++];
      ps.pitchCount = 0;
    }
    return ps;
  }

  function simulateHalf(inningNum, battingTeam, startBases = [false, false, false]) {
    const lineup    = battingTeam === 'away' ? awayLineup : homeLineup;
    const batIdxRef = battingTeam === 'away' ? { v: awayBatIdx } : { v: homeBatIdx };
    const ps        = getCurrentPitcher(battingTeam);
    const half      = battingTeam === 'away' ? '▲' : '▼';

    let outs = 0, runs = 0, bases = [...startBases];

    while (outs < 3) {
      const batter  = lineup[batIdxRef.v % lineup.length];
      const atBat   = simulateAtBat(batter, ps.current, homeTeam.id);
      const outcome = atBat.outcome;
      ps.pitchCount += atBat.pitchCount;

      const { newBases, runsScored } = advanceRunners(bases, outcome, outs);
      bases = newBases;
      runs += runsScored;

      const basesStr = `${bases[0]?'●':'○'}${bases[1]?'●':'○'}${bases[2]?'●':'○'}`;
      const desc     = descPlay(outcome, batter.name, ps.current?.name || 'Pitcher', runsScored);

      plays.push({
        inning:      `${half}${inningNum + 1}`,
        battingTeam,
        batter:      batter.name,
        batterId:    batter.id,
        pitcher:     ps.current?.name || '—',
        pitcherId:   ps.current?.id   || '—',
        outcome,
        runs:        runsScored,
        desc,
        outsAfter:   (outcome === 'K' || outcome === 'OUT') ? outs + 1 : outs,
        bases:       basesStr,
        pitchCount:  Math.round(ps.pitchCount),
        pitches:     atBat.pitches,
        atBatPitches:atBat.pitchCount,
        exitVelocity:atBat.exitVelocity,
        launchAngle: atBat.launchAngle,
        sprayAngle:  atBat.sprayAngle,
        hardHit:     atBat.hardHit,
        barrel:      atBat.barrel,
      });

      if (outcome === 'K' || outcome === 'OUT') outs++;
      batIdxRef.v++;
    }

    if (battingTeam === 'away') awayBatIdx = batIdxRef.v % lineup.length;
    else                        homeBatIdx = batIdxRef.v % lineup.length;

    return runs;
  }

  // 9 regular innings
  for (let i = 0; i < INNINGS; i++) {
    const awayRuns  = simulateHalf(i, 'away');
    const awayTotal = innings.reduce((s, x) => s + x.away, 0) + awayRuns;
    const homeTotal = innings.reduce((s, x) => s + x.home, 0);
    const homeRuns  = simulateHalf(i, 'home');
    innings.push({ away: awayRuns, home: homeRuns });
    if (i >= INNINGS - 1 && (homeTotal + homeRuns) > awayTotal) {
      plays[plays.length - 1].walkOff = true;
      break;
    }
  }

  // Extra innings
  let extraInning = innings.length;
  const getTotals = () => ({
    away: innings.reduce((s, x) => s + x.away, 0),
    home: innings.reduce((s, x) => s + x.home, 0),
  });

  while (getTotals().away === getTotals().home && extraInning < 15) {
    const awayRuns  = simulateHalf(extraInning, 'away', [false, true, false]);
    const awayTotal = getTotals().away + awayRuns;
    const homeRunsExt = simulateHalf(extraInning, 'home', [false, true, false]);

    // Walk-off check
    const lastPlay = plays[plays.length - 1];
    if (getTotals().home + homeRunsExt > awayTotal && lastPlay) lastPlay.walkOff = true;
    innings.push({ away: awayRuns, home: homeRunsExt });
    extraInning++;
  }

  const final    = getTotals();
  const awayFinal = final.away;
  const homeFinal = final.home;

  // ── Enhanced box score ─────────────────────────────────────────────────────
  function buildBatLine(player, team) {
    const pPlays = plays.filter(pl => pl.battingTeam === team && pl.batter === player.name);
    const ab  = pPlays.filter(pl => !['BB','HBP'].includes(pl.outcome)).length;
    const h   = pPlays.filter(pl => ['HR','3B','2B','1B'].includes(pl.outcome)).length;
    const d   = pPlays.filter(pl => pl.outcome === '2B').length;
    const t   = pPlays.filter(pl => pl.outcome === '3B').length;
    const hr  = pPlays.filter(pl => pl.outcome === 'HR').length;
    const bb  = pPlays.filter(pl => pl.outcome === 'BB').length;
    const hbp = pPlays.filter(pl => pl.outcome === 'HBP').length;
    const k   = pPlays.filter(pl => pl.outcome === 'K').length;
    const rbi = pPlays.reduce((s, pl) => s + pl.runs, 0);
    const tb  = h + d + t * 2 + hr * 3;
    const avg = ab > 0 ? (h / ab).toFixed(3).replace('0.', '.') : '.000';
    const obp = (ab + bb + hbp) > 0 ? ((h + bb + hbp) / (ab + bb + hbp)).toFixed(3).replace('0.', '.') : '.000';
    const slg = ab > 0 ? ((tb) / ab).toFixed(3).replace('0.', '.') : '.000';
    const opsN = ab > 0 ? (parseFloat(obp) + parseFloat(slg)) : 0;
    const ops  = opsN.toFixed(3).replace('0.', '.');
    const evArr  = pPlays.filter(pl => pl.exitVelocity).map(pl => pl.exitVelocity);
    const avgEV  = evArr.length ? Math.round(evArr.reduce((a, b) => a + b, 0) / evArr.length * 10) / 10 : null;
    const maxEV  = evArr.length ? Math.max(...evArr) : null;
    const hh     = pPlays.filter(pl => pl.hardHit).length;
    const brl    = pPlays.filter(pl => pl.barrel).length;
    const pc     = pPlays.reduce((s, pl) => s + (pl.atBatPitches || 0), 0);
    return { ...player, ab, h, d, t, hr, bb, hbp, k, rbi, tb, avg, obp, slg, ops, avgEV, maxEV, hh, brl, pc };
  }

  const boxAway = awayLineup.map(p => buildBatLine(p, 'away'));
  const boxHome = homeLineup.map(p => buildBatLine(p, 'home'));

  // ── Pitcher lines ──────────────────────────────────────────────────────────
  function buildPitcherLines(pitchingTeam) {
    // pitchingTeam = 'away' means they pitch while HOME bats
    const battingTeam = pitchingTeam === 'away' ? 'home' : 'away';
    const teamPlays   = plays.filter(pl => pl.battingTeam === battingTeam);
    const map = {};
    let order = [];
    for (const pl of teamPlays) {
      const key = pl.pitcherId || pl.pitcher;
      if (!map[key]) { map[key] = { name: pl.pitcher, id: pl.pitcherId, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, pc: 0 }; order.push(key); }
      const line = map[key];
      line.pc += pl.atBatPitches || 0;
      if (['HR','3B','2B','1B'].includes(pl.outcome)) line.h++;
      line.r  += pl.runs;
      line.er += pl.runs; // simplified (no unearned tracking)
      if (pl.outcome === 'BB')  line.bb++;
      if (pl.outcome === 'K')   line.k++;
      if (pl.outcome === 'HR')  line.hr++;
      if (pl.outcome === 'HBP') line.hbp++;
      if (pl.outcome === 'K' || pl.outcome === 'OUT') line.outs++;
    }
    return order.map(k => {
      const l  = map[k];
      const ip = `${Math.floor(l.outs / 3)}.${l.outs % 3}`;
      return { ...l, ip };
    });
  }

  const pitcherLinesAway = buildPitcherLines('away');
  const pitcherLinesHome = buildPitcherLines('home');

  return {
    awayTeam, homeTeam,
    awayLineup, homeLineup,
    awayStarter, homeStarter,
    innings,
    awayScore: awayFinal,
    homeScore: homeFinal,
    winner: awayFinal > homeFinal ? awayTeam : homeTeam,
    plays: [...plays].reverse(),
    boxAway, boxHome,
    pitcherLinesAway, pitcherLinesHome,
  };
}

// ── Statcast-Enhanced Probability Model ─────────────────────────────────────

/**
 * Adjust batter probs using Statcast metrics:
 *   hardHitRate  → boost XBH (2B, 3B, HR)
 *   barrelRate   → boost HR specifically
 *   avgExitVelocity → scale overall power
 */
function applyStatcastAdjustments(probs, statcastStats) {
  if (!statcastStats) return probs;
  const hhRate   = statcastStats.hardHitPercent   ?? statcastStats.hardHitRate   ?? null;
  const brlRate  = statcastStats.barrelBatRate     ?? statcastStats.barrelPercent ?? null;
  const avgEV    = statcastStats.avgHitSpeed       ?? statcastStats.avgExitVelocity ?? null;

  if (hhRate === null && brlRate === null && avgEV === null) return probs;

  // Baseline MLB averages (2024)
  const lgHH  = 38.5; // hard hit %
  const lgBrl = 8.0;  // barrel %
  const lgEV  = 87.5; // mph

  const hhFactor  = hhRate  !== null ? (hhRate  / lgHH)  : 1.0;
  const brlFactor = brlRate !== null ? (brlRate / lgBrl)  : 1.0;
  const evFactor  = avgEV   !== null ? (avgEV   / lgEV)   : 1.0;

  // Power factor blended
  const powerBoost = (hhFactor * 0.5 + Math.sqrt(brlFactor) * 0.3 + evFactor * 0.2);

  const adjusted = {
    ...probs,
    HR:   probs.HR   * Math.sqrt(brlFactor) * Math.sqrt(evFactor),
    '2B': probs['2B'] * Math.sqrt(hhFactor),
    '3B': probs['3B'] * Math.sqrt(hhFactor),
    '1B': probs['1B'] * (1 / Math.sqrt(powerBoost)),   // hard contact means fewer weak singles
    OUT:  probs.OUT  * (1 / Math.sqrt(powerBoost)),
  };
  return normalizeProbabilities(adjusted);
}

// ── Real API helpers ─────────────────────────────────────────────────────────

const CURRENT_SEASON = 2026;

async function fetchTeamSchedule(teamId) {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${CURRENT_SEASON}&teamId=${teamId}&gameType=R`
    );
    const data = await res.json();
    return (data.dates || []).flatMap(d => d.games || []);
  } catch { return []; }
}

async function fetchCurrentStandings() {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${CURRENT_SEASON}&standingsType=regularSeason&hydrate=team`
    );
    const data = await res.json();
    return data.records || [];
  } catch { return []; }
}

// ── Season Simulation (uses real schedule for completed games) ───────────────

async function simulateSeason(myTeam) {
  const schedule = await fetchTeamSchedule(myTeam.id);
  const opponents = MLB_TEAMS.filter(t => t.id !== myTeam.id);
  let wins = 0, losses = 0;
  const gameLog = [];

  // Fetch my team's roster to estimate win probability vs opponents
  let myWinPct = 0.500;
  try {
    const myRoster = await fetchTeamRoster(myTeam.id);
    const myPlayers = myRoster.map((p, i) => buildPlayerFromRoster(p, i));
    const myBatters = myPlayers.filter(p => p.posType !== 'Pitcher');
    const myOPS = myBatters.length
      ? myBatters.reduce((s, p) => s + statOPS(p.stats), 0) / myBatters.length
      : 0.720;
    // MLB avg OPS ≈ .720 → .500 win%; each .010 OPS above/below ≈ 0.8% win%
    myWinPct = Math.min(0.65, Math.max(0.35, 0.500 + (myOPS - 0.720) * 0.8));
  } catch { /* keep default */ }

  if (schedule.length > 0) {
    for (let i = 0; i < schedule.length; i++) {
      const g = schedule[i];
      const state = g.status?.abstractGameState;
      const isHome = g.teams?.home?.team?.id === myTeam.id;
      const opp = isHome ? g.teams?.away?.team : g.teams?.home?.team;
      const oppTeam = MLB_TEAMS.find(t => t.id === opp?.id) || { id: opp?.id || 0, name: opp?.name || 'Unknown', abbr: opp?.abbreviation || '???', logo: '' };

      if (state === 'Final') {
        const myScore  = isHome ? (g.teams?.home?.score ?? 0) : (g.teams?.away?.score ?? 0);
        const oppScore = isHome ? (g.teams?.away?.score ?? 0) : (g.teams?.home?.score ?? 0);
        const myWin = myScore > oppScore;
        if (myWin) wins++; else losses++;
        gameLog.push({ gameNum: i + 1, opponent: oppTeam, isHome, myWin, myScore, oppScore, actual: true });
      } else {
        // Future game — use roster-derived win probability (home field +3%)
        const wpAdj = myWinPct + (isHome ? 0.03 : -0.03);
        const myWin = Math.random() < Math.min(0.70, Math.max(0.30, wpAdj));
        const myScore  = myWin ? Math.floor(Math.random() * 7) + 1 : Math.floor(Math.random() * 4);
        const oppScore = myWin ? Math.floor(Math.random() * 4)     : Math.floor(Math.random() * 7) + 1;
        if (myWin) wins++; else losses++;
        gameLog.push({ gameNum: i + 1, opponent: oppTeam, isHome, myWin, myScore, oppScore, actual: false });
      }
    }
  } else {
    // Fallback – strength-adjusted 162
    for (let g = 0; g < 162; g++) {
      const opp = opponents[g % opponents.length];
      const isHome = g % 2 === 0;
      const wpAdj = myWinPct + (isHome ? 0.03 : -0.03);
      const myWin = Math.random() < Math.min(0.70, Math.max(0.30, wpAdj));
      const myScore  = myWin ? Math.floor(Math.random() * 7) + 1 : Math.floor(Math.random() * 4);
      const oppScore = myWin ? Math.floor(Math.random() * 4)     : Math.floor(Math.random() * 7) + 1;
      if (myWin) wins++; else losses++;
      gameLog.push({ gameNum: g + 1, opponent: opp, isHome, myWin, myScore, oppScore, actual: false });
    }
  }

  // Simulate all other teams' records
  const standings = MLB_TEAMS.map(t => {
    if (t.id === myTeam.id) return { team: t, wins, losses };
    const w = Math.floor(68 + Math.random() * 30);
    return { team: t, wins: w, losses: 162 - w };
  });
  standings.sort((a, b) => b.wins - a.wins);
  return { myTeam, wins, losses, gameLog, standings };
}

// ── Playoff Bracket Seeding (uses real standings) ────────────────────────────

async function pickPlayoffTeams() {
  const records = await fetchCurrentStandings();
  const byLeague = { AL: [], NL: [] };

  if (records.length > 0) {
    records.forEach(divRecord => {
      divRecord.teamRecords?.forEach(tr => {
        const t = MLB_TEAMS.find(x => x.id === tr.team.id);
        if (!t) return;
        const remaining = 162 - (tr.wins + tr.losses);
        const projWins = tr.wins + Math.round(remaining * 0.500 + (Math.random() - 0.5) * Math.sqrt(remaining));
        byLeague[t.league]?.push({ team: t, wins: Math.max(0, Math.min(162, projWins)), losses: 162 - Math.max(0, Math.min(162, projWins)) });
      });
    });
  }

  // Fallback – random records if API unavailable
  if (!byLeague.AL.length || !byLeague.NL.length) {
    MLB_TEAMS.forEach(t => {
      const wins = Math.floor(72 + Math.random() * 25);
      byLeague[t.league]?.push({ team: t, wins, losses: 162 - wins });
    });
  }

  ['AL', 'NL'].forEach(lg => byLeague[lg].sort((a, b) => b.wins - a.wins));

  const seeds = {};
  ['AL', 'NL'].forEach(lg => {
    const divWinners = [];
    ['East', 'Central', 'West'].forEach(div => {
      const top = byLeague[lg].find(t => t.team.division === div);
      if (top) divWinners.push(top);
    });
    const wildCards = byLeague[lg].filter(t => !divWinners.find(d => d.team.id === t.team.id)).slice(0, 3);
    seeds[lg] = [...divWinners, ...wildCards].slice(0, 6);
  });
  return seeds;
}

function simSeries(teamA, teamB, seriesLen) {
  let wA = 0, wB = 0;
  const needed = Math.ceil(seriesLen / 2);
  const games = [];
  while (wA < needed && wB < needed) {
    const aWins = Math.random() < 0.50;
    if (aWins) wA++; else wB++;
    games.push({ winner: aWins ? teamA : teamB, aScore: Math.floor(Math.random() * 6) + 1, bScore: Math.floor(Math.random() * 6) + 1 });
  }
  return { winner: wA >= needed ? teamA : teamB, wA, wB, games };
}

// ── API Data Fetching ────────────────────────────────────────────────────────

async function fetchTeamRoster(teamId, season = CURRENT_SEASON) {
  try {
    // Simple hydration: only season stats + statcast (no byOrder/statSplits via hydrate — those
    // must be fetched per-player via /v1/people/{id}/stats?stats=statSplits)
    const hydrate = `person(stats(type=[season,statcastBatting],season=${season},group=[hitting,pitching]))`;
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster/active?season=${season}&hydrate=${encodeURIComponent(hydrate)}`
    );
    const data = await res.json();
    if (data.roster?.length) return data.roster;

    // Fallback for historical seasons
    const res2 = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster/fullRoster?season=${season}&hydrate=${encodeURIComponent(hydrate)}`
    );
    const data2 = await res2.json();
    const withStats = (data2.roster || []).filter(p => {
      const s = p.person?.stats?.find(st =>
        st.group?.displayName?.toLowerCase() === 'hitting' ||
        st.group?.displayName?.toLowerCase() === 'pitching'
      );
      return s?.splits?.[0]?.stat;
    });
    return withStats.slice(0, 26);
  } catch { return []; }
}

/**
 * Fetch batting-order splits (b1–b9) + situational splits (vl,vr,d,n,h,a) for a player.
 * Correct endpoint: /v1/people/{id}/stats?stats=statSplits&sitCodes=b1,...,b9,vl,vr,d,n,h,a
 *
 * Returns: { orderSplits: [{slot, ab, ops}], sitSplits: {vl, vr, d, n, h, a} }
 */
async function fetchPlayerSplits(playerId, season) {
  try {
    const sitCodes = 'b1,b2,b3,b4,b5,b6,b7,b8,b9,vl,vr,d,n,h,a';
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=statSplits&sitCodes=${sitCodes}&season=${season}&group=hitting`;
    const res = await fetch(url);
    const data = await res.json();
    const splits = data.stats?.[0]?.splits || [];

    const orderSplits = [];
    const sitSplits   = {};

    for (const sp of splits) {
      const code = sp.split?.code || '';
      const s    = sp.stat || {};
      const obp  = parseFloat(s.obp) || 0;
      const slg  = parseFloat(s.slg) || 0;

      // b1–b9 → batting order slot
      if (/^b[1-9]$/.test(code)) {
        const slot = parseInt(code[1], 10);
        const ab   = s.atBats || 0;
        if (ab > 0) orderSplits.push({ slot, ab, ops: obp + slg });
      } else if (['vl','vr','d','n','h','a'].includes(code)) {
        sitSplits[code] = s;
      }
    }

    const bestEntry = orderSplits.length
      ? orderSplits.reduce((b, x) => x.ab > b.ab ? x : b, orderSplits[0])
      : null;

    return {
      orderSplits,
      sitSplits,
      bestSlot:    bestEntry?.slot  || null,
      bestSlotABs: bestEntry?.ab    || 0,
    };
  } catch {
    return { orderSplits: [], sitSplits: {}, bestSlot: null, bestSlotABs: 0 };
  }
}

function parsePlayerStats(rosterEntry, group = 'hitting') {
  const stats = rosterEntry?.person?.stats?.find(s => s.group?.displayName?.toLowerCase() === group);
  return stats?.splits?.[0]?.stat || null;
}

function parseStatcastStats(rosterEntry) {
  const stats = rosterEntry?.person?.stats?.find(s => s.type?.displayName === 'statcastBatting');
  return stats?.splits?.[0]?.stat || null;
}

function buildPlayerFromRoster(entry) {
  const batting  = parsePlayerStats(entry, 'hitting');
  const pitching = parsePlayerStats(entry, 'pitching');
  const statcast = parseStatcastStats(entry);

  return {
    id:           entry.person.id,
    name:         entry.person.fullName,
    pos:          entry.position?.abbreviation || 'DH',
    posType:      entry.position?.type || '',
    jerseyNumber: entry.jerseyNumber,
    batsHand:     entry.person?.batSide?.code  || 'R',
    throwsHand:   entry.person?.pitchHand?.code || 'R',
    stats:        batting,
    pitchingStats: pitching,
    statcastStats: statcast,
    // splits populated later by fetchPlayerSplits()
    orderSplits:  [],
    sitSplits:    {},
    bestSlot:     null,
    bestSlotABs:  0,
  };
}

// ── Stat helpers ─────────────────────────────────────────────────────────────

function statOBP(s) {
  if (!s) return 0.310;
  const h = s.hits || 0, bb = s.baseOnBalls || 0, hbp = s.hitByPitch || 0;
  const ab = s.atBats || 0, sf = s.sacFlies || 0;
  const pa = ab + bb + hbp + sf;
  return pa >= 10 ? (h + bb + hbp) / pa : 0.310;
}

function statSLG(s) {
  if (!s) return 0.380;
  const ab = s.atBats || 0;
  if (ab < 5) return 0.380;
  const tb = s.totalBases ||
    (s.hits || 0) + (s.doubles || 0) + (s.triples || 0) * 2 + (s.homeRuns || 0) * 3;
  return tb / ab;
}

function statOPS(s) { return statOBP(s) + statSLG(s); }

/** OPS from a raw stat object (uses pre-computed fields when available) */
function opsFromStat(s) {
  if (!s) return 0;
  if (s.ops)  return parseFloat(s.ops);
  if (s.obp && s.slg) return parseFloat(s.obp) + parseFloat(s.slg);
  return statOPS(s);
}

// ── Volume-First Realistic Lineup Builder (spec v2) ──────────────────────────

/**
 * buildRealisticLineup — volume-first per batting slot.
 *
 * Context:
 *  opposingHand — 'L' | 'R' (opposing SP hand for vs-split tiebreaker)
 *  isDayGame    — boolean
 *  isHome       — boolean (from the batting team's perspective)
 *
 * Algorithm per slot 1→9 (greedy top-down):
 *  1. Rank unused players by AB in this slot (descending).
 *  2. If top two players are within 15% AB volume → tiebreak:
 *       a. vs opposing hand OPS (vl or vr split)
 *       b. day/night OPS
 *       c. home/away OPS
 *       d. overall season OPS
 *  3. Assign best candidate, mark used, continue.
 *  4. Players with 0 ABs in a slot get score 0 (rarely chosen unless roster thin).
 *
 * Returns players with lineupSlot, slotABs, selectionReason stamped.
 */
function buildRealisticLineup(players, context = {}) {
  if (!players || players.length < 1) return players || [];

  const { opposingHand, isDayGame, isHome } = context;
  const pool    = players.filter(p => p.posType !== 'Pitcher');
  const used    = new Set();
  const result  = [];

  // Helper: get tiebreaker OPS for a player given context
  const contextOPS = p => {
    const sit = p.sitSplits || {};
    // vs opposing pitcher hand
    if (opposingHand) {
      const handKey = opposingHand === 'L' ? 'vl' : 'vr';
      const handOPS = opsFromStat(sit[handKey]);
      if (handOPS > 0) return handOPS;
    }
    // day / night
    if (isDayGame !== undefined) {
      const dnOPS = opsFromStat(sit[isDayGame ? 'd' : 'n']);
      if (dnOPS > 0) return dnOPS;
    }
    // home / away
    if (isHome !== undefined) {
      const haOPS = opsFromStat(sit[isHome ? 'h' : 'a']);
      if (haOPS > 0) return haOPS;
    }
    // overall season OPS as final fallback
    return statOPS(p.stats);
  };

  for (let slot = 1; slot <= 9; slot++) {
    const candidates = pool
      .filter(p => !used.has(p.id))
      .map(p => {
        const splitEntry = p.orderSplits?.find(x => x.slot === slot);
        return { player: p, volume: splitEntry?.ab || 0, splitOPS: splitEntry?.ops || 0 };
      })
      .sort((a, b) => {
        // Primary sort: volume descending
        const volDiff = b.volume - a.volume;
        // Within 15% volume → tiebreak by context OPS
        const maxVol = Math.max(a.volume, b.volume);
        if (maxVol > 0 && Math.abs(volDiff) / maxVol <= 0.15) {
          const opsA = contextOPS(a.player);
          const opsB = contextOPS(b.player);
          if (Math.abs(opsA - opsB) > 0.001) return opsB - opsA;
        }
        return volDiff;
      });

    if (!candidates.length) break;
    const winner = candidates[0];
    const p      = winner.player;
    used.add(p.id);

    let selectionReason;
    if (winner.volume >= 5) {
      selectionReason = `${winner.volume} ABs batting ${slot}${slot === 1 ? 'st' : slot === 2 ? 'nd' : slot === 3 ? 'rd' : 'th'} this season`;
    } else {
      selectionReason = 'Best available (limited data)';
    }

    result.push({ ...p, lineupSlot: slot, slotABs: winner.volume, selectionReason });
  }

  return result.slice(0, 9);
}

/**
 * Sabermetric lineup fallback — used when byOrder data is too sparse.
 */
function buildSabermetricLineup(players, context = {}) {
  if (!players || players.length < 1) return players || [];
  const scored = players.map(p => ({
    ...p,
    _ops: statOPS(p.stats),
    _obp: statOBP(p.stats),
    _slg: statSLG(p.stats),
    _hr:  p.stats?.homeRuns        || 0,
    _sb:  p.stats?.stolenBases     || 0,
    _pa:  p.stats?.plateAppearances || p.stats?.atBats || 200,
    _avg: parseFloat(p.stats?.avg) || 0.240,
  }));
  const pool = [...scored].sort((a, b) => b._ops - a._ops).slice(0, 9);
  const pick = fn => {
    const best = pool.reduce((b, p) => fn(p) > fn(b) ? p : b, pool[0]);
    pool.splice(pool.indexOf(best), 1);
    return best;
  };
  const slots = [
    pick(p => p._obp * 0.55 + (p._sb / Math.max(p._pa, 1)) * 15 + p._avg * 0.25),
    pick(p => p._ops),
    pick(p => p._avg * 0.5 + p._obp * 0.5),
    pick(p => p._slg * 0.6 + (p._hr / Math.max(p._pa, 1)) * 80),
    pick(p => p._slg * 0.5 + p._hr * 0.5),
    pick(p => p._ops),
    pick(p => p._ops),
  ];
  const catcherIdx = pool.findIndex(p => p.pos === 'C');
  slots.push(catcherIdx >= 0 ? pool.splice(catcherIdx, 1)[0] : pick(p => p._ops));
  if (pool[0]) slots.push(pool[0]);
  return slots.filter(Boolean).map((p, i) => ({
    ...p, lineupSlot: i + 1, slotABs: 0, selectionReason: 'Sabermetric model',
  }));
}

/**
 * Main lineup builder — chooses realistic (volume-first) or optimized (OPS) mode.
 * mode: 'realistic' | 'optimized'
 */
function buildOptimalLineup(players, context = {}, mode = 'realistic') {
  if (!players || players.length < 9) return players || [];
  const batters = players.filter(p => p.posType !== 'Pitcher');

  if (mode === 'optimized') return buildSabermetricLineup(batters, context);

  // Realistic: use volume-first, fallback to sabermetric if data too sparse
  const hasEnoughData = batters.filter(p => p.bestSlotABs >= 5).length >= 5;
  return hasEnoughData
    ? buildRealisticLineup(batters, context)
    : buildSabermetricLineup(batters, context);
}

/**
 * Assign unique game-day defensive positions to the 9-man lineup.
 * Fills all standard slots (C, SS, 2B, 3B, 1B, CF, LF, RF, DH) without duplicates.
 * The player's roster pos/posType is used as a preference; duplicates are resolved
 * by sliding to the next open slot of the same type, with leftover players becoming DH.
 */
function assignGamePositions(lineup) {
  if (!lineup || !lineup.length) return lineup;

  // Preferred slot by roster position abbreviation
  const POS_PREF = {
    C: 'C',
    '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', INF: '2B',
    LF: 'LF',  CF: 'CF',  RF: 'RF',  OF: 'LF',
    DH: 'DH',  UTL: 'DH', P: null,
  };
  // Fallback pools by posType
  const INF_SLOTS = ['1B', '2B', '3B', 'SS'];
  const OF_SLOTS  = ['LF', 'CF', 'RF'];
  const ALL_SLOTS = ['C', 'SS', '2B', '3B', '1B', 'CF', 'LF', 'RF', 'DH'];

  const claimed  = new Set();
  const gamePos  = new Array(lineup.length).fill(null);

  // Pass 1: assign exact preferred position if the slot is open
  for (let i = 0; i < lineup.length; i++) {
    const p    = lineup[i];
    const pref = POS_PREF[p.pos] || null;
    if (pref && !claimed.has(pref)) {
      gamePos[i] = pref;
      claimed.add(pref);
    }
  }

  // Pass 2: unassigned players get next open slot from their type's pool
  for (let i = 0; i < lineup.length; i++) {
    if (gamePos[i]) continue;
    const p = lineup[i];
    let pool;
    if (p.posType === 'Outfielder' || ['LF','CF','RF','OF'].includes(p.pos)) {
      pool = OF_SLOTS;
    } else if (p.posType === 'Infielder' || ['1B','2B','3B','SS','INF'].includes(p.pos)) {
      pool = INF_SLOTS;
    } else if (p.pos === 'C' || p.posType === 'Catcher') {
      pool = ['C'];
    } else {
      pool = INF_SLOTS; // default for unknowns
    }
    const open = pool.find(s => !claimed.has(s));
    if (open) { gamePos[i] = open; claimed.add(open); }
  }

  // Pass 3: still unassigned → DH first, then any remaining ALL_SLOTS slot
  for (let i = 0; i < lineup.length; i++) {
    if (gamePos[i]) continue;
    const open = ALL_SLOTS.find(s => !claimed.has(s));
    if (open) { gamePos[i] = open; claimed.add(open); }
    else       { gamePos[i] = 'DH'; } // absolute fallback
  }

  return lineup.map((p, i) => ({ ...p, gamePos: gamePos[i] }));
}

/**
 * Sort pitchers into [starter, ...bullpen].
 * Starters: high IP, low ERA, high GS ratio.
 * Bullpen: relievers sorted by ERA ascending.
 */
function sortPitchersByRole(pitcherPlayers) {
  const withStats = pitcherPlayers.map(p => ({
    ...p,
    _ip:  parseFloat(p.pitchingStats?.inningsPitched || 0),
    _era: parseFloat(p.pitchingStats?.era || 9.99),
    _gs:  p.pitchingStats?.gamesStarted || 0,
    _g:   p.pitchingStats?.gamesPlayed  || p.pitchingStats?.gamesPitched || 1,
  }));

  // Classify: starter if GS/G >= 0.4 OR IP > 30
  const starters  = withStats.filter(p => (p._gs / Math.max(p._g, 1)) >= 0.4 || (p._gs >= 5 && p._ip > 30));
  const relievers = withStats.filter(p => !starters.includes(p));

  starters.sort((a, b) => a._era - b._era || b._ip - a._ip);
  relievers.sort((a, b) => a._era - b._era);

  // If no classified starters, fall back to highest-IP pitchers
  if (!starters.length) {
    withStats.sort((a, b) => b._ip - a._ip || a._era - b._era);
    return { starter: withStats[0], bullpen: withStats.slice(1, 5) };
  }

  return { starter: starters[0], bullpen: [...starters.slice(1, 3), ...relievers.slice(0, 3)] };
}

// ── UI Helpers ───────────────────────────────────────────────────────────────

const OUTCOME_COLORS = {
  HR: 'text-yellow-400', '3B': 'text-orange-400', '2B': 'text-blue-400',
  '1B': 'text-green-400', BB: 'text-sky-400', HBP: 'text-purple-400',
  K: 'text-red-400', OUT: 'text-slate-500',
};

const OUTCOME_BG = {
  HR: 'bg-yellow-400/10 border-yellow-400/20', '3B': 'bg-orange-400/10 border-orange-400/20',
  '2B': 'bg-blue-400/10 border-blue-400/20', '1B': 'bg-green-400/10 border-green-400/20',
  BB: 'bg-sky-400/10 border-sky-400/20', K: 'bg-red-400/10 border-red-400/20',
  OUT: 'bg-slate-700/20 border-slate-700/20', HBP: 'bg-purple-400/10 border-purple-400/20',
};

// ── LineupBuilder Component ──────────────────────────────────────────────────

function LineupBuilder({ lineup, onMove, starters, onPickStarter, title, loading, mode, onModeChange }) {
  const ordSuffix = n => ['st','nd','rd'][n-1] || 'th';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-300">{title} Lineup</span>
        <div className="flex items-center gap-2">
          {loading && <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Loading…</span>}
          {onModeChange && (
            <div className="flex rounded-lg overflow-hidden border border-slate-700 text-[10px] font-semibold p-0.5">
              <SegmentedControl
                value={mode}
                onChange={onModeChange}
                variant="speed"
                size="xs"
                rounded="lg"
                options={[
                  { value: 'realistic', label: 'Realistic' },
                  { value: 'optimized', label: 'Optimized' },
                ]}
              />
            </div>
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-800/50">
        {lineup.map((player, idx) => (
          <div key={player.id} className="flex items-center gap-2 px-4 py-2.5 group">
            <span className="text-slate-600 font-mono text-xs w-4 flex-shrink-0">{idx + 1}</span>
            <span className="text-[10px] text-slate-500 w-7 flex-shrink-0 font-mono">{player.gamePos || player.pos}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-200 truncate block">{player.name}</span>
              {player.slotABs >= 5 ? (
                <span className="text-[10px] text-emerald-500/80 font-mono">
                  {player.slotABs} ABs batting {idx + 1}{ordSuffix(idx + 1)}
                </span>
              ) : player.selectionReason ? (
                <span className="text-[10px] text-slate-600 font-mono">{player.selectionReason}</span>
              ) : null}
            </div>
            {player.stats && (
              <span className="text-[10px] text-slate-500 font-mono hidden sm:block flex-shrink-0">
                {player.stats.avg ? `.${String(Math.round(player.stats.avg * 1000)).padStart(3, '0')}` : '—'}
                {' '}·{' '}{player.stats.homeRuns ?? 0}HR
              </span>
            )}
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onMove(idx, -1)} disabled={idx === 0}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-white disabled:opacity-20 transition-colors text-xs">▲</button>
              <button onClick={() => onMove(idx, 1)} disabled={idx === lineup.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-white disabled:opacity-20 transition-colors text-xs">▼</button>
            </div>
          </div>
        ))}
      </div>
      {starters && starters.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Starting Pitcher</div>
          <div className="flex gap-2 flex-wrap">
            {starters.slice(0, 5).map(p => (
              <button key={p.id} onClick={() => onPickStarter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${onPickStarter._selected?.id === p.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                {p.name.split(' ').pop()}
                {p.pitchingStats && <span className="ml-1 text-slate-500 font-mono">{p.pitchingStats.era}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── InningBox Component ──────────────────────────────────────────────────────

function InningBox({ innings, awayTeam, homeTeam }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono text-center" style={{ minWidth: Math.max(280, innings.length * 28 + 100) }}>
        <thead>
          <tr className="text-slate-600">
            <th className="px-2 py-1 text-left w-12">Team</th>
            {innings.map((_, i) => <th key={i} className="px-1 py-1 w-7">{i + 1}</th>)}
            <th className="px-2 py-1 text-slate-400 font-bold">R</th>
          </tr>
        </thead>
        <tbody>
          {[{ team: awayTeam, key: 'away' }, { team: homeTeam, key: 'home' }].map(({ team, key }) => {
            const total = innings.reduce((s, x) => s + (x[key] || 0), 0);
            return (
              <tr key={key} className="border-t border-slate-800">
                <td className="px-2 py-2 text-left text-slate-300 font-semibold">{team.abbr}</td>
                {innings.map((inn, i) => (
                  <td key={i} className={`px-1 py-2 ${inn[key] > 0 ? 'text-white font-semibold' : 'text-slate-700'}`}>{inn[key]}</td>
                ))}
                <td className="px-2 py-2 font-bold text-white text-sm">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Pitch result labels ───────────────────────────────────────────────────────
const PITCH_RESULT_LABELS = { B: 'Ball', CS: 'Called Strike', SS: 'Swing & Miss', F: 'Foul', X: 'In Play' };

// ── AtBatCard — expandable pitch sequence ────────────────────────────────────
function AtBatCard({ play, index }) {
  const outcome = play.outcome;
  const outcomeColor = {
    HR: 'text-yellow-400', '3B': 'text-orange-400', '2B': 'text-blue-400',
    '1B': 'text-green-400', BB: 'text-cyan-400', HBP: 'text-purple-400',
    K: 'text-red-400', OUT: 'text-slate-500',
  }[outcome] || 'text-slate-400';

  const hasPitches = play.pitches?.length > 0;

  const renderHeader = (open = false) => (
    <>
      <span className="text-slate-600 font-mono text-[10px] w-4 mt-0.5 shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-xs ${outcomeColor}`}>{outcome}</span>
          <span className="text-slate-300 text-xs truncate">{play.batter}</span>
          {play.runs > 0 && <span className="text-green-400 font-bold text-[10px] bg-green-400/10 px-1 rounded">{play.runs > 1 ? `+${play.runs}R` : '+1R'}</span>}
          {play.walkOff && <span className="text-yellow-400 text-[10px] font-bold bg-yellow-400/10 px-1 rounded">WALK-OFF</span>}
          {play.barrel && <span className="text-orange-400 text-[10px] bg-orange-400/10 px-1 rounded">🛢 BARREL</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-slate-600 text-[10px]">vs {play.pitcher}</span>
          {hasPitches && <span className="text-slate-600 text-[10px]">{play.pitches.length}p</span>}
          {play.exitVelocity && <span className="text-slate-500 text-[10px] font-mono">{play.exitVelocity} mph EV</span>}
          {play.launchAngle !== undefined && play.launchAngle !== null && <span className="text-slate-500 text-[10px] font-mono">{play.launchAngle}° LA</span>}
          {play.hardHit && <span className="text-orange-400 text-[10px]">Hard Hit</span>}
        </div>
        <p className="text-slate-500 text-[11px] mt-0.5 leading-tight">{play.desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-slate-600 font-mono text-[10px]">{play.inning}</span>
        {hasPitches && (
          <span className={`text-slate-600 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        )}
      </div>
    </>
  );

  if (!hasPitches) {
    return (
      <div className="border-b border-slate-800/50 w-full text-left px-3 py-2.5 flex items-start gap-2">
        {renderHeader()}
      </div>
    );
  }

  return (
    <Disclosure as="div" className="border-b border-slate-800/50">
      <DisclosureButton className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-slate-800/30 transition-colors focus:outline-none">
        {({ open }) => renderHeader(open)}
      </DisclosureButton>
      <DisclosurePanel className="bg-slate-950/60 px-3 pb-3 focus:outline-none">
          <div className="flex flex-col gap-1">
            {play.pitches.map((p, i) => {
              const def = PITCH_DEFS[p.type] || PITCH_DEFS.FF;
              const isLast = i === play.pitches.length - 1;
              return (
                <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded text-[11px] border ${def.bg}`}>
                  <span className="text-slate-600 font-mono w-4 shrink-0">{p.num}</span>
                  <span className={`${def.color} font-bold w-6 shrink-0`}>{p.type}</span>
                  <span className="text-slate-300 font-mono w-12 shrink-0">{p.velocity} mph</span>
                  <span className="text-slate-500 font-mono w-16 shrink-0">{p.spinRate} rpm</span>
                  <span className={`font-semibold shrink-0 w-20 ${
                    p.result === 'B'  ? 'text-cyan-400' :
                    p.result === 'CS' ? 'text-yellow-400' :
                    p.result === 'SS' ? 'text-red-400' :
                    p.result === 'F'  ? 'text-orange-400' :
                    p.result === 'X'  ? 'text-green-400' : 'text-slate-400'
                  }`}>{PITCH_RESULT_LABELS[p.result] || p.result}</span>
                  <span className="text-slate-600 text-[10px] font-mono shrink-0">{p.count}</span>
                  {isLast && p.result === 'X' && p.ev && (
                    <span className="text-slate-400 font-mono ml-auto">{p.ev} mph · {p.la}°</span>
                  )}
                </div>
              );
            })}
          </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

// ── PitcherBox ────────────────────────────────────────────────────────────────
function PitcherBox({ lines, title }) {
  if (!lines?.length) return null;
  return (
    <div className="overflow-x-auto mt-4">
      <div className="text-slate-500 text-[10px] font-mono uppercase tracking-wider px-2 pb-1">{title} Pitching</div>
      <table className="w-full text-xs min-w-[380px]">
        <thead>
          <tr className="text-slate-600 border-b border-slate-800">
            <th className="px-2 py-1 text-left font-mono text-[10px]">Pitcher</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">IP</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">H</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">R</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">ER</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">BB</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">K</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">HR</th>
            <th className="px-2 py-1 text-center font-mono text-[10px]">PC</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/20">
              <td className="px-2 py-1.5 text-slate-300 font-medium">{l.name?.split(' ').pop() || '—'}</td>
              <td className="px-2 py-1.5 text-center text-slate-300 font-mono font-semibold">{l.ip}</td>
              <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{l.h}</td>
              <td className={`px-2 py-1.5 text-center font-mono ${l.r > 3 ? 'text-red-400' : 'text-slate-400'}`}>{l.r}</td>
              <td className={`px-2 py-1.5 text-center font-mono ${l.er > 3 ? 'text-red-400' : 'text-slate-400'}`}>{l.er}</td>
              <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{l.bb}</td>
              <td className="px-2 py-1.5 text-center text-green-400 font-mono font-semibold">{l.k}</td>
              <td className={`px-2 py-1.5 text-center font-mono ${l.hr > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{l.hr || '—'}</td>
              <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{l.pc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── BoxScore Component ────────────────────────────────────────────────────────
function BoxScore({ players, teamName, pitcherLines }) {
  const totals = players.reduce((acc, p) => ({
    ab: acc.ab + p.ab, h: acc.h + p.h, d: acc.d + (p.d||0), t: acc.t + (p.t||0),
    hr: acc.hr + p.hr, bb: acc.bb + p.bb, k: acc.k + p.k, rbi: acc.rbi + p.rbi,
  }), { ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0, rbi: 0 });
  const totAvg = totals.ab > 0 ? (totals.h / totals.ab).toFixed(3).replace('0.', '.') : '.000';
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[480px]">
          <thead>
            <tr className="text-slate-600 border-b border-slate-800">
              <th className="px-2 py-1.5 text-left font-mono text-[10px] sticky left-0 bg-slate-900">{teamName}</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">AB</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">H</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">2B</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">3B</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">HR</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">RBI</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">BB</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">K</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">AVG</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">OBP</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">SLG</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">EV</th>
              <th className="px-2 py-1.5 text-center font-mono text-[10px]">BRL</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                <td className="px-2 py-1.5 sticky left-0 bg-slate-900">
                  <span className="text-slate-500 font-mono text-[10px] w-4 inline-block text-center mr-1">{p.lineupSlot || ''}</span>
                  <span className="text-slate-300 font-medium">{p.name.split(' ').pop()}</span>
                  <span className="text-emerald-600/80 text-[10px] ml-1 font-mono">{p.gamePos || p.pos}</span>
                  {p.stats?.atBats != null && (
                    <span className="text-slate-600 text-[10px] ml-1 font-mono">({p.stats.atBats}AB)</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.ab}</td>
                <td className="px-2 py-1.5 text-center text-slate-300 font-mono font-semibold">{p.h}</td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.d || '—'}</td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.t || '—'}</td>
                <td className={`px-2 py-1.5 text-center font-mono font-semibold ${p.hr > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{p.hr || '—'}</td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.rbi}</td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.bb || '—'}</td>
                <td className={`px-2 py-1.5 text-center font-mono ${p.k > 2 ? 'text-red-400' : 'text-slate-600'}`}>{p.k || '—'}</td>
                <td className={`px-2 py-1.5 text-center font-mono ${parseFloat(p.avg) > 0.300 ? 'text-green-400' : 'text-slate-400'}`}>{p.avg || '.000'}</td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.obp || '.000'}</td>
                <td className="px-2 py-1.5 text-center text-slate-400 font-mono">{p.slg || '.000'}</td>
                <td className={`px-2 py-1.5 text-center font-mono text-[10px] ${p.avgEV >= 95 ? 'text-orange-400' : 'text-slate-500'}`}>{p.avgEV ? `${p.avgEV}` : '—'}</td>
                <td className={`px-2 py-1.5 text-center font-mono ${p.brl > 0 ? 'text-orange-400 font-bold' : 'text-slate-600'}`}>{p.brl || '—'}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-700 bg-slate-800/20 font-bold">
              <td className="px-2 py-1 text-slate-500 font-mono text-[10px] sticky left-0 bg-slate-900">TOTALS</td>
              <td className="px-2 py-1 text-center text-slate-300 font-mono text-[10px]">{totals.ab}</td>
              <td className="px-2 py-1 text-center text-slate-300 font-mono text-[10px]">{totals.h}</td>
              <td className="px-2 py-1 text-center text-slate-400 font-mono text-[10px]">{totals.d}</td>
              <td className="px-2 py-1 text-center text-slate-400 font-mono text-[10px]">{totals.t}</td>
              <td className="px-2 py-1 text-center text-yellow-400 font-mono text-[10px]">{totals.hr}</td>
              <td className="px-2 py-1 text-center text-slate-300 font-mono text-[10px]">{totals.rbi}</td>
              <td className="px-2 py-1 text-center text-slate-400 font-mono text-[10px]">{totals.bb}</td>
              <td className="px-2 py-1 text-center text-slate-400 font-mono text-[10px]">{totals.k}</td>
              <td className="px-2 py-1 text-center text-slate-400 font-mono text-[10px]">{totAvg}</td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>
      {pitcherLines && <PitcherBox lines={pitcherLines} title={teamName} />}
    </div>
  );
}

// ── PlayoffBracket Component ─────────────────────────────────────────────────

function PlayoffBracket() {
  const [seeds, setSeeds]       = useState(null);
  const [bracket, setBracket]   = useState(null);
  const [simming, setSimming]   = useState(false);

  const generate = async () => {
    setSeeds(null);
    setBracket(null);
    setSimming(true);
    try {
      const s = await pickPlayoffTeams();
      setSeeds(s);
    } finally {
      setSimming(false);
    }
  };

  const simulate = () => {
    if (!seeds) return;
    setSimming(true);
    setTimeout(() => {
      const t = x => x?.team || x; // normalize seed object → team object
      const results = {};
      ['AL', 'NL'].forEach(lg => {
        const s = seeds[lg]; // s[i] = { team, wins, losses }
        // Wild card round (best-of-3): 4v3, 5v2, 6v1
        const wc1 = simSeries(t(s[3]), t(s[2]), 3);
        const wc2 = simSeries(t(s[4]), t(s[1]), 3);
        const wc3 = simSeries(t(s[5]), t(s[0]), 3);
        // Division series (best-of-5)
        const ds1 = simSeries(wc3.winner, wc1.winner, 5);
        const ds2 = simSeries(t(s[1]), wc2.winner, 5);
        // Championship series (best-of-7)
        const csA = ds1.winner, csB = ds2.winner;
        const cs = simSeries(csA, csB, 7);
        results[lg] = { seeds: s, wildCard: [wc1, wc2, wc3], divSeries: [ds1, ds2], champSeries: cs, pennant: cs.winner, csTeamA: csA, csTeamB: csB };
      });
      const ws = simSeries(results.AL.pennant, results.NL.pennant, 7);
      setBracket({ ...results, worldSeries: ws, wsTeamA: results.AL.pennant, wsTeamB: results.NL.pennant });
      setSimming(false);
    }, 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={generate} disabled={simming}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-all disabled:opacity-50">
          {simming && !seeds ? '⏳ Fetching Standings…' : '🎲 Generate Bracket Seeds'}
        </button>
        <button onClick={simulate} disabled={!seeds || simming}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition-all">
          {simming ? '⏳ Simulating…' : '▶ Simulate Playoffs'}
        </button>
      </div>

      {seeds && !bracket && (
        <div className="grid grid-cols-2 gap-4">
          {['AL', 'NL'].map(lg => (
            <div key={lg} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{lg} Seeds</div>
              <div className="space-y-2">
                {seeds[lg].map((s, i) => (
                  <div key={s.team.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 font-mono w-4">{i + 1}</span>
                    <img src={teamLogoUrl(s.team.id)} className="w-5 h-5 object-contain" alt={s.team.abbr} />
                    <span className="text-xs text-slate-300 flex-1">{s.team.abbr}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{s.wins}W</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {bracket && (
        <div className="space-y-4">
          {/* World Series */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-700/5 border border-yellow-500/30 rounded-2xl p-5">
            <div className="text-[10px] text-yellow-400 uppercase tracking-widest mb-3 text-center">🏆 World Series</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <img src={teamLogoUrl(bracket.wsTeamA?.id)} className="w-12 h-12 object-contain" alt={bracket.wsTeamA?.abbr} />
                <span className="text-xs text-slate-400 font-mono">{bracket.wsTeamA?.abbr ?? '—'}</span>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display font-bold text-white">
                  {bracket.worldSeries.wA} – {bracket.worldSeries.wB}
                </div>
                <div className="text-[10px] text-yellow-300 font-semibold mt-1">
                  🏆 {bracket.worldSeries.winner?.name ?? bracket.worldSeries.winner?.abbr} Win!
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <img src={teamLogoUrl(bracket.wsTeamB?.id)} className="w-12 h-12 object-contain" alt={bracket.wsTeamB?.abbr} />
                <span className="text-xs text-slate-400 font-mono">{bracket.wsTeamB?.abbr ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* League Results */}
          {['AL', 'NL'].map(lg => (
            <div key={lg} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{lg} Championship Series</div>
              <div className="flex items-center justify-center gap-3 text-sm">
                <div className="flex flex-col items-center gap-1">
                  <img src={teamLogoUrl(bracket[lg].csTeamA?.id)} className="w-8 h-8 object-contain" alt={bracket[lg].csTeamA?.abbr} />
                  <span className={`text-[10px] font-mono ${bracket[lg].pennant?.id === bracket[lg].csTeamA?.id ? 'text-emerald-400 font-bold' : 'text-slate-500 line-through'}`}>{bracket[lg].csTeamA?.abbr}</span>
                </div>
                <span className="text-slate-300 font-mono">{bracket[lg].champSeries.wA} – {bracket[lg].champSeries.wB}</span>
                <div className="flex flex-col items-center gap-1">
                  <img src={teamLogoUrl(bracket[lg].csTeamB?.id)} className="w-8 h-8 object-contain" alt={bracket[lg].csTeamB?.abbr} />
                  <span className={`text-[10px] font-mono ${bracket[lg].pennant?.id === bracket[lg].csTeamB?.id ? 'text-emerald-400 font-bold' : 'text-slate-500 line-through'}`}>{bracket[lg].csTeamB?.abbr}</span>
                </div>
              </div>
              <div className="text-center text-xs text-emerald-400 font-semibold mt-2">
                🏅 Pennant: {bracket[lg].pennant?.name ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SeasonMode Component ─────────────────────────────────────────────────────

function SeasonMode() {
  const [myTeam,  setMyTeam]  = useState(null);
  const [result,  setResult]  = useState(null);
  const [simming, setSimming] = useState(false);
  const [tab,     setTab]     = useState('log');

  const run = async () => {
    if (!myTeam) return;
    setSimming(true);
    try {
      const res = await simulateSeason(myTeam);
      setResult(res);
      setTab('log');
    } finally {
      setSimming(false);
    }
  };

  const grouped = result ? (() => {
    const g = {};
    ['AL', 'NL'].forEach(lg => {
      g[lg] = {};
      ['East', 'Central', 'West'].forEach(div => {
        g[lg][div] = result.standings.filter(s => s.team.league === lg && s.team.division === div).sort((a, b) => b.wins - a.wins);
      });
    });
    return g;
  })() : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Your Team</div>
          <button onClick={() => { setResult(null); }} className="hidden" />
          <TeamPicker label="Your Team" teams={MLB_TEAMS} selected={myTeam} onSelect={t => { setMyTeam(t); setResult(null); }} exclude={null} />
        </div>
        <div className="flex flex-col gap-2 pt-6">
          <button onClick={run} disabled={!myTeam || simming}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap">
            {simming ? '⏳ Simulating 162…' : '▶ Sim Season'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          {/* My team record */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <img src={teamLogoUrl(result.myTeam.id)} className="w-14 h-14 object-contain" alt={result.myTeam.abbr} />
            <div>
              <div className="font-display text-3xl text-white">{result.wins}–{result.losses}</div>
              <div className="text-sm text-slate-400">{result.myTeam.name} · {CURRENT_SEASON} Season</div>
              <div className={`text-xs font-semibold mt-1 ${result.wins >= 90 ? 'text-emerald-400' : result.wins >= 82 ? 'text-yellow-400' : 'text-red-400'}`}>
                {result.wins >= 95 ? '🏆 Division Title Contender' : result.wins >= 90 ? '🎯 Wild Card Contender' : result.wins >= 82 ? '⚾ Above .500' : '📉 Below .500'}
              </div>
            </div>
          </div>

          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <SegmentedControl
              value={tab}
              onChange={setTab}
              variant="simulator"
              size="sm"
              rounded="lg"
              className="flex-1"
              optionClassName="flex-1"
              options={[
                { value: 'log', label: 'Game Log' },
                { value: 'standings', label: 'Standings' },
              ]}
            />
          </div>

          {tab === 'log' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">{result.gameLog.length} Games</span>
                <span className="text-xs font-mono text-emerald-400">{result.wins}W {result.losses}L</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/40">
                {result.gameLog.map(g => (
                  <div key={g.gameNum} className={`flex items-center gap-3 px-4 py-2 ${g.actual ? '' : 'opacity-70'}`}>
                    <span className="text-[10px] text-slate-600 font-mono w-5">{g.gameNum}</span>
                    <span className="text-[10px] text-slate-500">{g.isHome ? 'vs' : '@'}</span>
                    <img src={teamLogoUrl(g.opponent.id)} className="w-5 h-5 object-contain" alt={g.opponent.abbr} />
                    <span className="text-xs text-slate-400 flex-1">{g.opponent.abbr}</span>
                    {g.actual && <span className="text-[8px] text-sky-500 font-mono">REAL</span>}
                    <span className={`text-xs font-bold font-mono ${g.myWin ? 'text-emerald-400' : 'text-red-400'}`}>{g.myWin ? 'W' : 'L'}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{g.myWin ? `${g.myScore}–${g.oppScore}` : `${g.oppScore}–${g.myScore}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'standings' && grouped && (
            <div className="space-y-3">
              {['AL', 'NL'].map(lg => (
                <div key={lg}>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{lg}</div>
                  <div className="space-y-2">
                    {['East', 'Central', 'West'].map(div => (
                      <div key={div} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-1.5 bg-slate-800/50 text-[10px] text-slate-500 uppercase tracking-widest">{lg} {div}</div>
                        {grouped[lg][div].map((s, i) => (
                          <div key={s.team.id} className={`flex items-center gap-3 px-4 py-2 border-t border-slate-800/50 ${s.team.id === result.myTeam.id ? 'bg-emerald-500/5' : ''}`}>
                            <span className="text-[10px] text-slate-600 font-mono w-3">{i + 1}</span>
                            <img src={teamLogoUrl(s.team.id)} className="w-5 h-5 object-contain" alt={s.team.abbr} />
                            <span className={`text-xs flex-1 ${s.team.id === result.myTeam.id ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>{s.team.abbr}</span>
                            <span className="text-xs font-mono text-slate-400">{s.wins}–{s.losses}</span>
                            <span className="text-[10px] font-mono text-slate-600">.{String(Math.round(s.wins / 162 * 1000)).padStart(3, '0')}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── HistoricalReplay Component ───────────────────────────────────────────────

const YEAR_OPTIONS = Array.from({ length: 2025 - 1900 }, (_, i) => 2024 - i);

function YearPicker({ value, onChange }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      size="sm"
      options={YEAR_OPTIONS.map((y) => ({ value: y, label: String(y) }))}
    />
  );
}

function HistoricalReplay() {
  const [awayTeam,  setAwayTeam]  = useState(null);
  const [homeTeam,  setHomeTeam]  = useState(null);
  const [awayYear,  setAwayYear]  = useState(2004);
  const [homeYear,  setHomeYear]  = useState(2004);
  const [result,    setResult]    = useState(null);
  const [simming,   setSimming]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [note,      setNote]      = useState('');
  const [resultTab, setResultTab] = useState('plays');

  const simulate = async () => {
    if (!awayTeam || !homeTeam) return;
    setSimming(true);
    setLoading(true);
    setResult(null);
    setNote('');
    try {
      const [awayRoster, homeRoster] = await Promise.all([
        fetchTeamRoster(awayTeam.id, awayYear),
        fetchTeamRoster(homeTeam.id, homeYear),
      ]);

      const buildRoster = (roster, year) => {
        const allPlayers     = roster.map(p => buildPlayerFromRoster(p));
        const posBatters     = allPlayers.filter(p => p.posType !== 'Pitcher' && p.posType !== 'Two-Way Player');
        const pitcherPlayers = allPlayers.filter(p => p.posType === 'Pitcher');
        return { posBatters, pitcherPlayers };
      };

      const { posBatters: awayBatters, pitcherPlayers: awayPitcherPlayers } = buildRoster(awayRoster, awayYear);
      const { posBatters: homeBatters, pitcherPlayers: homePitcherPlayers } = buildRoster(homeRoster, homeYear);

      // Fetch batting-order splits for all batters from both teams in parallel
      const [awaySplits, homeSplits] = await Promise.all([
        Promise.all(awayBatters.map(p => fetchPlayerSplits(p.id, awayYear))),
        Promise.all(homeBatters.map(p => fetchPlayerSplits(p.id, homeYear))),
      ]);
      const awayEnriched = awayBatters.map((p, i) => ({ ...p, ...awaySplits[i] }));
      const homeEnriched = homeBatters.map((p, i) => ({ ...p, ...homeSplits[i] }));

      const awayPitchersBuilt = awayPitcherPlayers.length ? sortPitchersByRole(awayPitcherPlayers) : { starter: defaultPlayer(awayTeam.id, 99), bullpen: [] };
      const homePitchersBuilt = homePitcherPlayers.length ? sortPitchersByRole(homePitcherPlayers) : { starter: defaultPlayer(homeTeam.id, 99), bullpen: [] };

      const awayLineupBuilt = awayEnriched.length >= 9
        ? assignGamePositions(buildOptimalLineup(awayEnriched, {}, 'realistic'))
        : Array.from({ length: 9 }, (_, i) => defaultPlayer(awayTeam.id, i));
      const homeLineupBuilt = homeEnriched.length >= 9
        ? assignGamePositions(buildOptimalLineup(homeEnriched, {}, 'realistic'))
        : Array.from({ length: 9 }, (_, i) => defaultPlayer(homeTeam.id, i));

      const away = { lineup: awayLineupBuilt, starter: awayPitchersBuilt.starter, bullpen: awayPitchersBuilt.bullpen };
      const home = { lineup: homeLineupBuilt, starter: homePitchersBuilt.starter, bullpen: homePitchersBuilt.bullpen };

      const awayBull = away.bullpen;
      const homeBull = home.bullpen;

      setLoading(false);
      const hasRealData = awayRoster.length > 0 && homeRoster.length > 0;
      if (!hasRealData) setNote('⚠️ Historical roster data unavailable for one or both teams — using estimates.');
      else setNote(`✅ Loaded ${awayRoster.length} ${awayTeam.abbr} players (${awayYear}) and ${homeRoster.length} ${homeTeam.abbr} players (${homeYear})`);

      setTimeout(() => {
        const res = simulateGame(awayTeam, homeTeam, away.lineup, home.lineup, away.starter, home.starter, awayBull, homeBull);
        setResult(res);
        setResultTab('plays');
        setSimming(false);
      }, 80);
    } catch (e) {
      setNote('❌ Failed to load historical data.');
      setSimming(false);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
        <p className="text-xs text-amber-400/80 leading-relaxed">
          <span className="font-semibold text-amber-400">Historical Replays</span> — Pick any two teams from any era and simulate a matchup using real historical rosters and stats from MLB's records.
          Try the 1927 Yankees vs 1975 Reds, or replay the 2016 World Series!
        </p>
      </div>

      {/* Away Team + Year */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <TeamPicker label="Away Team" teams={MLB_TEAMS} selected={awayTeam} onSelect={t => { setAwayTeam(t); setResult(null); }} exclude={homeTeam} />
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-slate-500">Season:</span>
            <YearPicker value={awayYear} onChange={y => { setAwayYear(y); setResult(null); }} />
          </div>
        </div>
        <div className="space-y-2">
          <TeamPicker label="Home Team" teams={MLB_TEAMS} selected={homeTeam} onSelect={t => { setHomeTeam(t); setResult(null); }} exclude={awayTeam} />
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-slate-500">Season:</span>
            <YearPicker value={homeYear} onChange={y => { setHomeYear(y); setResult(null); }} />
          </div>
        </div>
      </div>

      {/* Famous matchup presets */}
      <div>
        <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Classic Matchups</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '27 NYY vs 27 PIT',  awayId: 147, awayY: 1927, homeId: 134, homeY: 1927 },
            { label: '75 CIN vs 75 BOS',  awayId: 113, awayY: 1975, homeId: 111, homeY: 1975 },
            { label: '98 NYY vs 98 SD',   awayId: 147, awayY: 1998, homeId: 135, homeY: 1998 },
            { label: '16 WS: CHC vs CLE', awayId: 112, awayY: 2016, homeId: 114, homeY: 2016 },
            { label: '04 BOS vs 04 STL',  awayId: 111, awayY: 2004, homeId: 138, homeY: 2004 },
          ].map(p => (
            <button key={p.label}
              onClick={() => {
                const at = MLB_TEAMS.find(t => t.id === p.awayId);
                const ht = MLB_TEAMS.find(t => t.id === p.homeId);
                setAwayTeam(at); setAwayYear(p.awayY);
                setHomeTeam(ht); setHomeYear(p.homeY);
                setResult(null);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-[10px] text-slate-400 hover:text-white transition-all">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={simulate} disabled={!awayTeam || !homeTeam || simming}
        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
        {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading historical rosters…</> :
         simming  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Simulating…</> :
         '📜 Simulate Historical Game'}
      </button>

      {note && <p className="text-[10px] text-center text-slate-500">{note}</p>}

      {result && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-[10px] text-amber-400/70 uppercase tracking-widest text-center mb-1">
              Historical Replay · {awayYear} vs {homeYear}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-4">Final</div>
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              <div className="flex flex-col items-center gap-2">
                <img src={teamLogoUrl(result.awayTeam.id)} className="w-14 h-14 object-contain" alt={result.awayTeam.abbr} />
                <span className="text-[11px] text-slate-500 font-mono">{result.awayTeam.abbr} '{String(awayYear).slice(2)}</span>
              </div>
              <span className={`font-display text-6xl tabular-nums ${result.awayScore > result.homeScore ? 'text-white' : 'text-slate-600'}`}>{result.awayScore}</span>
              <span className="text-slate-700 font-mono text-xl">—</span>
              <span className={`font-display text-6xl tabular-nums ${result.homeScore > result.awayScore ? 'text-white' : 'text-slate-600'}`}>{result.homeScore}</span>
              <div className="flex flex-col items-center gap-2">
                <img src={teamLogoUrl(result.homeTeam.id)} className="w-14 h-14 object-contain" alt={result.homeTeam.abbr} />
                <span className="text-[11px] text-slate-500 font-mono">{result.homeTeam.abbr} '{String(homeYear).slice(2)}</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-semibold">
                🏆 {result.winner.name} win{result.innings.length > 9 ? ` (F/${result.innings.length})` : '!'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Linescore</div>
            <InningBox innings={result.innings} awayTeam={result.awayTeam} homeTeam={result.homeTeam} />
          </div>

          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <SegmentedControl
              value={resultTab}
              onChange={setResultTab}
              variant="simulator"
              size="sm"
              rounded="lg"
              className="flex-1"
              optionClassName="flex-1 py-1.5"
              options={[
                { value: 'plays', label: 'Play-by-Play' },
                { value: 'box', label: 'Box Score' },
              ]}
            />
          </div>

          {resultTab === 'plays' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {result.plays.map((play, i) => (
                  <AtBatCard key={i} play={play} index={i} />
                ))}
              </div>
            </div>
          )}

          {resultTab === 'box' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2">
              <div className="mb-2 text-[10px] text-slate-500 px-2">{result.awayTeam.abbr} '{String(awayYear).slice(2)}</div>
              <BoxScore players={result.boxAway} teamName={result.awayTeam.name} pitcherLines={result.pitcherLinesAway} />
              <div className="mt-4 mb-2 text-[10px] text-slate-500 px-2">{result.homeTeam.abbr} '{String(homeYear).slice(2)}</div>
              <BoxScore players={result.boxHome} teamName={result.homeTeam.name} pitcherLines={result.pitcherLinesHome} />
            </div>
          )}

          <button onClick={simulate} disabled={simming}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-all">
            🔄 Replay Again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Planned Features & Research Panel ───────────────────────────────────────

const PLANNED_FEATURES = [
  { icon: '⚾', title: 'Game Simulation', badge: 'Core', color: 'emerald', desc: 'Simulate full 9-inning games using real player statistics, bullpen management, and advanced probability models.', done: true },
  { icon: '📅', title: 'Season Mode', badge: 'Season', color: 'blue', desc: 'Play through a full 162-game season with real schedules, managing your roster and making strategic decisions.', done: true },
  { icon: '📡', title: 'Statcast-Powered', badge: 'Analytics', color: 'purple', desc: 'Outcomes enhanced by exit velocity, barrel rate, and hard-hit percentage from real MLB Statcast data.', done: true },
  { icon: '🏆', title: 'Playoffs & World Series', badge: 'Postseason', color: 'yellow', desc: 'Survive the bracket and battle to the championship using real standings-based seeding.', done: true },
  { icon: '📋', title: 'Lineup Builder', badge: 'Strategy', color: 'orange', desc: 'Construct your ideal lineup, choose your ace, and set your bullpen — using real MLB roster data.', done: true },
  { icon: '📜', title: 'Historical Replays', badge: 'History', color: 'amber', desc: 'Replay classic seasons or alternate-history scenarios: 1927 Yankees vs 1975 Reds? Now possible.', done: true },
];

const RESEARCH_QUESTIONS = [
  { q: 'Probability model accuracy', a: 'Monte Carlo simulation using per-PA outcome probabilities derived from real season stats, blended via Log5 batter/pitcher weighting.' },
  { q: 'Batter vs. pitcher matchup weighting', a: 'Pitcher K%, BB%, and HR/BF rates are used to geometrically scale batter probabilities — platoon splits and recent form are future improvements.' },
  { q: 'Park factor integration', a: 'HR index and hits factor applied per home team — e.g. Coors Field (1.30× HR) vs Petco Park (0.88× HR).' },
  { q: 'Bullpen fatigue modeling', a: 'Pitch count curve: 1.0× at <60 pitches, escalating to 1.35× at 105+. Pitcher swapped when limit reached or random 25% chance past 85 pitches.' },
  { q: 'Monte Carlo vs. Markov chain', a: 'Hybrid approach: Monte Carlo for at-bat outcomes, Markov-style base runner state machine for runner advancement with stochastic advancement probabilities.' },
];

function FeaturesPanel() {
  return (
    <Collapsible
      className="mb-6"
      title="Simulation Engine"
      badge={
        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">
          {PLANNED_FEATURES.filter(f => f.done).length}/{PLANNED_FEATURES.length} features
        </span>
      }
    >
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-800">
            {PLANNED_FEATURES.map(f => (
              <div key={f.title} className="bg-slate-900 p-4 flex gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-200">{f.title}</span>
                    {f.done
                      ? <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">✓ Live</span>
                      : <span className="text-[9px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">Planned</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Research Questions</div>
            <div className="space-y-3">
              {RESEARCH_QUESTIONS.map(r => (
                <div key={r.q} className="text-xs">
                  <span className="text-slate-400 font-semibold">{r.q}: </span>
                  <span className="text-slate-600">{r.a}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-slate-700 border-t border-slate-800 pt-3">
              Simulation engine built using real MLB Stats API — Statcast, GUMBO feed, and historical records.
            </div>
          </div>
        </div>
    </Collapsible>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BaseballSimulator() {
  const [tab,       setTab]      = useState('game');
  const [awayTeam,  setAwayTeam] = useState(null);
  const [homeTeam,  setHomeTeam] = useState(null);
  const [result,    setResult]   = useState(null);
  const [simming,   setSimming]  = useState(false);
  const [speed,     setSpeed]    = useState('instant');
  const [liveIdx,   setLiveIdx]  = useState(0);
  const [resultTab, setResultTab]= useState('plays');
  const [boxTab,    setBoxTab]   = useState('away');
  const liveTimer = useRef(null);

  // Lineup state
  const [awayLineup, setAwayLineup] = useState([]);
  const [homeLineup, setHomeLineup] = useState([]);
  const [awayStarter, setAwayStarter] = useState(null);
  const [homeStarter, setHomeStarter] = useState(null);
  const [awayPitchers, setAwayPitchers] = useState([]);
  const [homePitchers, setHomePitchers] = useState([]);
  const [awayLoading, setAwayLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [showLineup, setShowLineup] = useState(false);
  const [lineupMode, setLineupMode] = useState('realistic'); // 'realistic' | 'optimized'

  // Fetch real roster when team selected
  useEffect(() => {
    if (!awayTeam) return;
    setAwayLoading(true);
    setAwayLineup([]);
    setAwayStarter(null);
    const season = CURRENT_SEASON;
    fetchTeamRoster(awayTeam.id, season).then(async roster => {
      const allPlayers     = roster.map(p => buildPlayerFromRoster(p));
      const posBatters     = allPlayers.filter(p => p.posType !== 'Pitcher' && p.posType !== 'Two-Way Player');
      const pitcherPlayers = allPlayers.filter(p => p.posType === 'Pitcher');

      // Fetch batting-order + situational splits for all batters in parallel
      const splitsArr = await Promise.all(posBatters.map(p => fetchPlayerSplits(p.id, season)));
      const enriched  = posBatters.map((p, i) => ({ ...p, ...splitsArr[i] }));

      const { starter, bullpen } = pitcherPlayers.length ? sortPitchersByRole(pitcherPlayers) : { starter: null, bullpen: [] };
      const context = { opposingHand: homeStarter?.throwsHand || 'R', isHome: false };
      const lineup  = enriched.length >= 9
        ? assignGamePositions(buildOptimalLineup(enriched, context, lineupMode))
        : Array.from({ length: 9 }, (_, i) => defaultPlayer(awayTeam.id, i));

      setAwayLineup(lineup);
      setAwayPitchers([starter, ...bullpen].filter(Boolean));
      if (starter) setAwayStarter(starter);
      setAwayLoading(false);
    }).catch(() => {
      setAwayLineup(Array.from({ length: 9 }, (_, i) => defaultPlayer(awayTeam.id, i)));
      setAwayLoading(false);
    });
  }, [awayTeam, lineupMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!homeTeam) return;
    setHomeLoading(true);
    setHomeLineup([]);
    setHomeStarter(null);
    const season = CURRENT_SEASON;
    fetchTeamRoster(homeTeam.id, season).then(async roster => {
      const allPlayers     = roster.map(p => buildPlayerFromRoster(p));
      const posBatters     = allPlayers.filter(p => p.posType !== 'Pitcher' && p.posType !== 'Two-Way Player');
      const pitcherPlayers = allPlayers.filter(p => p.posType === 'Pitcher');

      // Fetch batting-order + situational splits for all batters in parallel
      const splitsArr = await Promise.all(posBatters.map(p => fetchPlayerSplits(p.id, season)));
      const enriched  = posBatters.map((p, i) => ({ ...p, ...splitsArr[i] }));

      const { starter, bullpen } = pitcherPlayers.length ? sortPitchersByRole(pitcherPlayers) : { starter: null, bullpen: [] };
      const context = { opposingHand: awayStarter?.throwsHand || 'R', isHome: true };
      const lineup  = enriched.length >= 9
        ? assignGamePositions(buildOptimalLineup(enriched, context, lineupMode))
        : Array.from({ length: 9 }, (_, i) => defaultPlayer(homeTeam.id, i));

      setHomeLineup(lineup);
      setHomePitchers([starter, ...bullpen].filter(Boolean));
      if (starter) setHomeStarter(starter);
      setHomeLoading(false);
    }).catch(() => {
      setHomeLineup(Array.from({ length: 9 }, (_, i) => defaultPlayer(homeTeam.id, i)));
      setHomeLoading(false);
    });
  }, [homeTeam, lineupMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const movePlayer = (lineup, setLineup, idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= lineup.length) return;
    const next = [...lineup];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setLineup(next);
  };

  const runSimulation = useCallback(() => {
    if (!awayTeam || !homeTeam) return;
    const al = awayLineup.length >= 9 ? awayLineup : Array.from({ length: 9 }, (_, i) => defaultPlayer(awayTeam.id, i));
    const hl = homeLineup.length >= 9 ? homeLineup : Array.from({ length: 9 }, (_, i) => defaultPlayer(homeTeam.id, i));
    const awayBull = awayPitchers.filter(p => p.id !== awayStarter?.id).slice(0, 5);
    const homeBull = homePitchers.filter(p => p.id !== homeStarter?.id).slice(0, 5);

    setSimming(true);
    setResult(null);
    setLiveIdx(0);
    clearInterval(liveTimer.current);

    setTimeout(() => {
      const res = simulateGame(awayTeam, homeTeam, al, hl, awayStarter, homeStarter, awayBull, homeBull);
      setResult(res);
      setResultTab('plays');
      setSimming(false);

      if (speed === 'live') {
        let idx = 0;
        const allPlays = [...res.plays].reverse();
        liveTimer.current = setInterval(() => {
          idx++;
          setLiveIdx(idx);
          if (idx >= allPlays.length) clearInterval(liveTimer.current);
        }, 250);
      }
    }, 80);
  }, [awayTeam, homeTeam, awayLineup, homeLineup, awayStarter, homeStarter, awayPitchers, homePitchers, speed]);

  const isLiveMode = speed === 'live' && result && liveIdx < (result?.plays?.length ?? 0);
  const visiblePlays = result
    ? (speed === 'live' ? result.plays.slice(result.plays.length - liveIdx) : result.plays)
    : [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-emerald-400 text-[10px] font-mono tracking-[3px] uppercase mb-1">Beta</div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tighter mb-1">Baseball Simulator</h1>
        <p className="text-slate-500 text-sm">Monte Carlo simulation powered by real MLB Stats API data</p>
      </div>

      {/* Features Panel */}
      <FeaturesPanel />

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

      {/* Season Tab */}
      {tab === 'season' && <SeasonMode />}

      {/* Playoffs Tab */}
      {tab === 'playoffs' && <PlayoffBracket />}

      {/* History Tab */}
      {tab === 'history' && <HistoricalReplay />}

      {/* Game Tab */}
      {tab === 'game' && (
        <>
          {/* Team Pickers */}
          <div className="flex items-stretch gap-3 mb-4">
            <TeamPicker label="Away" teams={MLB_TEAMS} selected={awayTeam} onSelect={t => { setAwayTeam(t); setResult(null); }} exclude={homeTeam} />
            <div className="flex flex-col items-center justify-center flex-shrink-0 gap-1 pt-6">
              <span className="text-slate-700 font-mono text-lg">@</span>
            </div>
            <TeamPicker label="Home" teams={MLB_TEAMS} selected={homeTeam} onSelect={t => { setHomeTeam(t); setResult(null); }} exclude={awayTeam} />
          </div>

          {/* Venue info */}
          {homeTeam && PARK_FACTORS[homeTeam.id] && (
            <div className="text-center mb-3">
              <span className="text-[10px] text-slate-600 font-mono">
                🏟 {PARK_FACTORS[homeTeam.id].name} · HR factor {PARK_FACTORS[homeTeam.id].hr.toFixed(2)}x
              </span>
            </div>
          )}

          {/* Lineup editor toggle */}
          {awayTeam && homeTeam && (
            <button onClick={() => setShowLineup(v => !v)}
              className="w-full mb-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2">
              <span>{showLineup ? '▲ Hide' : '▼ Edit'} Lineups & Pitchers</span>
              {(awayLoading || homeLoading) && <span className="text-emerald-400 animate-pulse">Loading real stats…</span>}
            </button>
          )}

          {showLineup && awayTeam && homeTeam && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <LineupBuilder title={awayTeam.abbr} lineup={awayLineup} loading={awayLoading}
                onMove={(i, d) => movePlayer(awayLineup, setAwayLineup, i, d)}
                starters={awayPitchers} onPickStarter={setAwayStarter}
                mode={lineupMode} onModeChange={m => { setLineupMode(m); }} />
              <LineupBuilder title={homeTeam.abbr} lineup={homeLineup} loading={homeLoading}
                onMove={(i, d) => movePlayer(homeLineup, setHomeLineup, i, d)}
                starters={homePitchers} onPickStarter={setHomeStarter}
                mode={lineupMode} onModeChange={m => { setLineupMode(m); }} />
            </div>
          )}

          {/* Speed + Sim Button */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-0.5 gap-0.5 flex-shrink-0">
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
            </div>
            <button onClick={runSimulation} disabled={!awayTeam || !homeTeam || simming || awayLoading || homeLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all active:scale-[0.97] text-sm">
              {simming ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Simulating…</> : <>▶ Simulate Game</>}
            </button>
          </div>

          {/* Methodology note */}
          <div className="mb-5 p-3 bg-slate-900/50 border border-slate-800/60 rounded-xl">
            <div className="text-[10px] text-slate-600 leading-relaxed">
              <span className="text-slate-500 font-semibold">Model: </span>
              Monte Carlo simulation · Real MLB batter/pitcher stats via MLB Stats API ·
              Statcast exit velocity &amp; barrel rate adjustments · Log5 pitcher–batter blending ·
              Park factors · Bullpen fatigue curves (pitch count) ·
              Markov-style base-state transitions · Extra-inning international rule
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Final Score */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-4">
                  {isLiveMode ? 'In Progress' : result.innings.length > 9 ? `Final / ${result.innings.length}` : 'Final'}
                </div>
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                  <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => { setAwayTeam(result.homeTeam); setHomeTeam(result.awayTeam); setResult(null); }}>
                    <img src={teamLogoUrl(result.awayTeam.id)} className="w-14 h-14 object-contain" alt={result.awayTeam.abbr} />
                    <span className="text-[11px] text-slate-500 font-mono">{result.awayTeam.abbr}</span>
                  </div>
                  <span className={`font-display text-6xl sm:text-7xl tabular-nums ${result.awayScore > result.homeScore ? 'text-white' : 'text-slate-600'}`}>{result.awayScore}</span>
                  <span className="text-slate-700 font-mono text-xl">—</span>
                  <span className={`font-display text-6xl sm:text-7xl tabular-nums ${result.homeScore > result.awayScore ? 'text-white' : 'text-slate-600'}`}>{result.homeScore}</span>
                  <div className="flex flex-col items-center gap-2">
                    <img src={teamLogoUrl(result.homeTeam.id)} className="w-14 h-14 object-contain" alt={result.homeTeam.abbr} />
                    <span className="text-[11px] text-slate-500 font-mono">{result.homeTeam.abbr}</span>
                  </div>
                </div>
                {!isLiveMode && (
                  <div className="mt-4 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-semibold">
                      🏆 {result.winner.name} win{result.innings.length > 9 ? ` (F/${result.innings.length})` : '!'}
                    </span>
                  </div>
                )}
              </div>

              {/* Linescore */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Linescore</div>
                <InningBox innings={result.innings} awayTeam={result.awayTeam} homeTeam={result.homeTeam} />
              </div>

              {/* SP Lines */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: `${result.awayTeam.abbr} SP`, pitcher: result.homeStarter },
                  { label: `${result.homeTeam.abbr} SP`, pitcher: result.awayStarter },
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

              <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
                <SegmentedControl
                  value={resultTab}
                  onChange={setResultTab}
                  variant="simulator"
                  size="sm"
                  rounded="lg"
                  className="flex-1"
                  optionClassName="flex-1 py-1.5"
                  options={[
                    { value: 'plays', label: 'Play-by-Play' },
                    { value: 'box', label: 'Box Score' },
                  ]}
                />
              </div>

              {resultTab === 'plays' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Play by Play</span>
                    <span className="text-[10px] text-slate-600 font-mono">{visiblePlays.length} plays</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {visiblePlays.map((play, i) => (
                      <AtBatCard key={i} play={play} index={i} />
                    ))}
                    {isLiveMode && (
                      <div className="px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />Simulating…
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

              <button onClick={runSimulation}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-all active:scale-[0.97]">
                🔄 Simulate Again
              </button>
            </div>
          )}

          {!result && !simming && (
            <div className="text-center py-10 text-slate-600 text-sm">
              {awayTeam && homeTeam ? 'Ready to simulate — click ▶ Simulate Game' : 'Pick two teams above to get started'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
