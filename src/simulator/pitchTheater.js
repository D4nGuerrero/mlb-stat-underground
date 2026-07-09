/**
 * Pitch-sequence theater for outcome-first at-bats.
 * Builds a plausible pitch list that is guaranteed to end on a forced PA outcome.
 */
import { PITCH_DEFS } from './constants.js';
import { randn } from './math.js';

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildPitcherArsenal(pitcherStats) {
  if (!pitcherStats) return [{ type: 'FF', w: 0.55 }, { type: 'SL', w: 0.25 }, { type: 'CH', w: 0.20 }];
  const ip = Math.max(parseFloat(pitcherStats.inningsPitched) || 0, 5);
  const kPer9 = ((pitcherStats.strikeOuts || 0) / ip) * 9;
  const bbPer9 = ((pitcherStats.baseOnBalls || 0) / ip) * 9;
  const hrPer9 = ((pitcherStats.homeRuns || 0) / ip) * 9;
  if (kPer9 >= 10) return [{ type: 'FF', w: 0.42 }, { type: 'SL', w: 0.30 }, { type: 'CH', w: 0.15 }, { type: 'CU', w: 0.13 }];
  if (hrPer9 < 0.8) return [{ type: 'SI', w: 0.44 }, { type: 'SL', w: 0.24 }, { type: 'CH', w: 0.20 }, { type: 'FC', w: 0.12 }];
  if (bbPer9 < 2.0) return [{ type: 'FF', w: 0.35 }, { type: 'FC', w: 0.22 }, { type: 'CU', w: 0.25 }, { type: 'CH', w: 0.18 }];
  return [{ type: 'FF', w: 0.50 }, { type: 'SL', w: 0.22 }, { type: 'CH', w: 0.18 }, { type: 'CU', w: 0.10 }];
}

export function selectPitchType(arsenal, balls, strikes) {
  let adjusted = arsenal.map((pitch) => ({ ...pitch }));
  if (balls >= 3 && strikes < 2) {
    adjusted = adjusted.map((pitch, index) => ({
      ...pitch,
      w: index === 0 ? pitch.w * 2.0 : pitch.w * 0.5,
    }));
  }
  if (strikes >= 2 && balls <= 1) {
    adjusted = adjusted.map((pitch, index) => ({
      ...pitch,
      w: index === 0 ? pitch.w * 0.7 : pitch.w * 1.5,
    }));
  }
  const total = adjusted.reduce((sum, pitch) => sum + pitch.w, 0);
  let roll = Math.random() * total;
  for (const pitch of adjusted) {
    roll -= pitch.w;
    if (roll <= 0) return pitch.type;
  }
  return adjusted[0]?.type || 'FF';
}

/** Force in-zone or out-of-zone location for theater consistency. */
export function generatePitchLocation(pitcherStats, balls, { forceInZone = null } = {}) {
  const walks = pitcherStats?.baseOnBalls || 0;
  const battersFaced = Math.max((parseFloat(pitcherStats?.inningsPitched) || 50) * 4.3, 50);
  const control = Math.max(0.40, 0.58 - (walks / battersFaced) * 0.5);
  const zonePct = balls >= 3 ? Math.min(0.80, control * 1.4) : control;
  const throwInZone = forceInZone == null ? Math.random() < zonePct : forceInZone;

  let plateX;
  let plateZ;
  if (throwInZone) {
    plateX = (Math.random() - 0.5) * 1.4;
    plateZ = 1.6 + Math.random() * 1.8;
  } else {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { plateX = -0.85 - Math.random() * 0.4; plateZ = 1.6 + Math.random() * 1.8; }
    else if (side === 1) { plateX = 0.85 + Math.random() * 0.4; plateZ = 1.6 + Math.random() * 1.8; }
    else if (side === 2) { plateX = (Math.random() - 0.5) * 1.4; plateZ = 0.7 + Math.random() * 0.6; }
    else { plateX = (Math.random() - 0.5) * 1.4; plateZ = 3.6 + Math.random() * 0.5; }
  }

  const inZone = Math.abs(plateX) <= 0.71 && plateZ >= 1.5 && plateZ <= 3.5;
  let zone;
  if (inZone) {
    const col = plateX < -0.24 ? 0 : plateX < 0.24 ? 1 : 2;
    const row = plateZ > 2.83 ? 0 : plateZ > 2.17 ? 1 : 2;
    zone = row * 3 + col + 1;
  } else {
    zone = plateX < -0.71 ? 11 : plateX > 0.71 ? 12 : plateZ < 1.5 ? 13 : 14;
  }

  return {
    plateX: Math.round(plateX * 100) / 100,
    plateZ: Math.round(plateZ * 100) / 100,
    inZone,
    zone,
  };
}

function makePitchRecord({
  num, arsenal, balls, strikes, result, pitcherStats, bipExtras = null, forceInZone = null,
}) {
  const pitchType = selectPitchType(arsenal, balls, strikes);
  const pitchDef = PITCH_DEFS[pitchType] || PITCH_DEFS.FF;
  const velocity = pitchDef.velMean + randn() * pitchDef.velStd;
  let location = generatePitchLocation(pitcherStats, balls, { forceInZone });

  // Align location with result for believable theater
  if (result === 'B' && location.inZone) {
    location = generatePitchLocation(pitcherStats, balls, { forceInZone: false });
  }
  if ((result === 'CS' || result === 'SS') && !location.inZone && Math.random() < 0.7) {
    location = generatePitchLocation(pitcherStats, balls, { forceInZone: true });
  }
  if (result === 'X' && !location.inZone && Math.random() < 0.55) {
    location = generatePitchLocation(pitcherStats, balls, { forceInZone: true });
  }

  let nextBalls = balls;
  let nextStrikes = strikes;
  if (result === 'B') nextBalls += 1;
  else if (result === 'CS' || result === 'SS') nextStrikes += 1;
  else if (result === 'F' && strikes < 2) nextStrikes += 1;

  return {
    num,
    type: pitchType,
    typeName: pitchDef.name,
    velocity: Math.round(velocity * 10) / 10,
    spinRate: Math.round(pitchDef.spinMean + randn() * 150),
    plateX: location.plateX,
    plateZ: location.plateZ,
    zone: location.zone,
    inZone: location.inZone,
    result,
    count: `${nextBalls}-${nextStrikes}`,
    ...(result === 'X' && bipExtras ? {
      ev: bipExtras.ev,
      la: bipExtras.la,
      dist: bipExtras.dist,
    } : {}),
    _balls: nextBalls,
    _strikes: nextStrikes,
  };
}

/**
 * Walk count to (targetBalls, targetStrikes) without ending the AB, then return pitches.
 */
function buildCountTo(targetBalls, targetStrikes, arsenal, pitcherStats, kFlavor = 1) {
  const pitches = [];
  let balls = 0;
  let strikes = 0;
  let guard = 0;

  while ((balls < targetBalls || strikes < targetStrikes) && guard < 20) {
    guard += 1;
    const needBall = balls < targetBalls;
    const needStrike = strikes < targetStrikes;
    let result;

    if (needBall && needStrike) {
      // Prefer strike if high-K matchup; else mix
      if (Math.random() < 0.45 * kFlavor) {
        result = strikes === 2 ? 'F' : pick(['CS', 'SS', 'F']);
      } else {
        result = 'B';
      }
    } else if (needBall) {
      result = 'B';
    } else if (strikes === 2 && targetStrikes === 2) {
      // Already at 2 strikes — only fouls allowed before final pitch
      result = 'F';
      // Occasionally add a foul for length, then stop if at targets
      if (balls === targetBalls && Math.random() < 0.55) break;
    } else {
      result = pick(['CS', 'SS', 'F']);
    }

    // Don't accidentally walk or K during setup
    if (result === 'B' && balls + 1 >= 4) result = strikes < 2 ? 'F' : 'SS';
    if ((result === 'CS' || result === 'SS') && strikes + 1 >= 3) {
      result = strikes < 2 ? 'F' : 'B';
      if (balls >= 3 && result === 'B') result = 'F';
    }

    const pitch = makePitchRecord({
      num: pitches.length + 1,
      arsenal,
      balls,
      strikes,
      result,
      pitcherStats,
    });
    pitches.push(pitch);
    balls = pitch._balls;
    strikes = pitch._strikes;

    if (balls === targetBalls && strikes === targetStrikes) break;
    // Extra fouls at 2 strikes for drama
    if (balls === targetBalls && strikes === targetStrikes) break;
  }

  return { pitches, balls, strikes };
}

/**
 * @param {string} outcome - HR|3B|2B|1B|BB|HBP|K|OUT (or IBB handled by caller)
 * @param {object} ctx
 */
export function generatePitchSequence(outcome, ctx = {}) {
  const {
    arsenal = buildPitcherArsenal(null),
    pitcherStats = null,
    paProbs = null,
    bipExtras = null,
  } = ctx;

  const kFlavor = paProbs?.K != null ? Math.max(0.7, Math.min(1.4, paProbs.K / 0.227)) : 1;

  if (outcome === 'IBB') {
    return [];
  }

  if (outcome === 'HBP') {
    const setupBalls = randomInt(0, 2);
    const setupStrikes = randomInt(0, 1);
    const { pitches, balls, strikes } = buildCountTo(setupBalls, setupStrikes, arsenal, pitcherStats, kFlavor);
    // Final "pitch" that hits the batter — treat as ball-location chase
    const hbpPitch = makePitchRecord({
      num: pitches.length + 1,
      arsenal,
      balls,
      strikes,
      result: 'B',
      pitcherStats,
      forceInZone: false,
    });
    hbpPitch.result = 'HBP';
    hbpPitch.count = `${balls}-${strikes}`;
    pitches.push(hbpPitch);
    return pitches.map(stripInternal);
  }

  if (outcome === 'K') {
    const targetBalls = randomInt(0, 3);
    const { pitches, balls, strikes } = buildCountTo(targetBalls, 2, arsenal, pitcherStats, kFlavor);
    // Ensure we actually have 2 strikes
    let b = balls;
    let s = strikes;
    while (s < 2 && pitches.length < 18) {
      const pitch = makePitchRecord({
        num: pitches.length + 1,
        arsenal,
        balls: b,
        strikes: s,
        result: pick(['CS', 'SS']),
        pitcherStats,
        forceInZone: true,
      });
      pitches.push(pitch);
      b = pitch._balls;
      s = pitch._strikes;
    }
    const finalResult = Math.random() < 0.62 * kFlavor ? 'SS' : 'CS';
    const finalPitch = makePitchRecord({
      num: pitches.length + 1,
      arsenal,
      balls: b,
      strikes: Math.min(s, 2),
      result: finalResult,
      pitcherStats,
      forceInZone: finalResult === 'CS' ? true : null,
    });
    pitches.push(finalPitch);
    return pitches.map(stripInternal);
  }

  if (outcome === 'BB') {
    const targetStrikes = randomInt(0, 2);
    const { pitches, balls, strikes } = buildCountTo(3, targetStrikes, arsenal, pitcherStats, kFlavor);
    let b = balls;
    let s = strikes;
    while (b < 3 && pitches.length < 18) {
      const pitch = makePitchRecord({
        num: pitches.length + 1,
        arsenal,
        balls: b,
        strikes: s,
        result: 'B',
        pitcherStats,
        forceInZone: false,
      });
      pitches.push(pitch);
      b = pitch._balls;
      s = pitch._strikes;
    }
    const finalPitch = makePitchRecord({
      num: pitches.length + 1,
      arsenal,
      balls: Math.min(b, 3),
      strikes: s,
      result: 'B',
      pitcherStats,
      forceInZone: false,
    });
    pitches.push(finalPitch);
    return pitches.map(stripInternal);
  }

  // BIP: HR, 3B, 2B, 1B, OUT
  const targetBalls = randomInt(0, 3);
  const targetStrikes = randomInt(0, 2);
  const { pitches, balls, strikes } = buildCountTo(targetBalls, targetStrikes, arsenal, pitcherStats, kFlavor);
  const finalPitch = makePitchRecord({
    num: pitches.length + 1,
    arsenal,
    balls,
    strikes,
    result: 'X',
    pitcherStats,
    bipExtras,
    forceInZone: true,
  });
  pitches.push(finalPitch);
  return pitches.map(stripInternal);
}

function stripInternal(pitch) {
  const rest = { ...pitch };
  delete rest._balls;
  delete rest._strikes;
  return rest;
}

/** Physics templates aligned with Debug / MLB Gameday pitch trajectories. */
const STRIKE_ZONE_TOP = 3.23;
const STRIKE_ZONE_BOTTOM = 1.63;
const STRIKE_ZONE_DEPTH = 8.5 / 12;
const RELEASE_Y0 = 50;

const PITCH_PHYSICS = {
  FF: { x0: 2.1, z0: 6.05, vy0: -139, ay: 25, ax: -7.5, az: -27, spinDir: 180 },
  SI: { x0: 2.0, z0: 5.95, vy0: -136, ay: 24, ax: -9, az: -30, spinDir: 210 },
  FC: { x0: 2.15, z0: 5.9, vy0: -132, ay: 24, ax: -5, az: -28, spinDir: 200 },
  SL: { x0: 2.35, z0: 5.72, vy0: -126, ay: 24, ax: -14, az: -34, spinDir: 240 },
  SW: { x0: 2.4, z0: 5.7, vy0: -122, ay: 23, ax: -16, az: -32, spinDir: 250 },
  CU: { x0: 1.85, z0: 5.85, vy0: -116, ay: 22, ax: 11, az: -39, spinDir: 0 },
  CH: { x0: 2.0, z0: 5.92, vy0: -122, ay: 23, ax: 6, az: -31, spinDir: 180 },
  FS: { x0: 2.05, z0: 5.88, vy0: -124, ay: 23, ax: 4, az: -33, spinDir: 170 },
};

const RESULT_META = {
  B: { code: 'B', description: 'Ball', isBall: true, isStrike: false, isInPlay: false },
  CS: { code: 'C', description: 'Called Strike', isBall: false, isStrike: true, isInPlay: false },
  SS: { code: 'S', description: 'Swinging Strike', isBall: false, isStrike: true, isInPlay: false },
  F: { code: 'F', description: 'Foul', isBall: false, isStrike: true, isInPlay: false },
  X: { code: 'X', description: 'In play', isBall: false, isStrike: false, isInPlay: true },
  HBP: { code: 'H', description: 'Hit By Pitch', isBall: true, isStrike: false, isInPlay: false },
};

function timeAtPlateDepth({ y0, vy0, ay }) {
  const a = 0.5 * ay;
  const b = vy0;
  const c = y0 - STRIKE_ZONE_DEPTH;
  const disc = Math.max(0, b * b - 4 * a * c);
  const t1 = (-b + Math.sqrt(disc)) / (2 * a);
  const t2 = (-b - Math.sqrt(disc)) / (2 * a);
  const t = Math.min(t1, t2);
  return Number.isFinite(t) && t > 0 ? t : 0.4;
}

function velocityForTarget({ start, target, accel, time }) {
  if (!time) return 0;
  return (target - start - 0.5 * accel * time * time) / time;
}

/**
 * Convert one sim pitch → Gameday playEvent (Debug-quality 3D path).
 * Stable playId so PitchCanvas re-animates only on new pitches.
 */
export function simPitchToPlayEvent(pitch, pitchNumber, { playKey = 'sim' } = {}) {
  const type = pitch.type || 'FF';
  const phys = PITCH_PHYSICS[type] || PITCH_PHYSICS.FF;
  const def = PITCH_DEFS[type] || PITCH_DEFS.FF;
  const meta = RESULT_META[pitch.result] || RESULT_META.B;
  const pX = pitch.plateX ?? 0;
  const pZ = pitch.plateZ ?? 2.5;
  const startSpeed = pitch.velocity || def.velMean || 92;
  // Scale vy0 roughly with velocity (presets assume ~94 FF)
  const speedScale = startSpeed / 94;
  const vy0 = phys.vy0 * speedScale;
  const ay = phys.ay;
  const y0 = RELEASE_Y0;
  const t = timeAtPlateDepth({ y0, vy0, ay });
  const x0 = phys.x0 * (pX >= 0 ? 1 : -0.85);
  const z0 = phys.z0;
  const ax = phys.ax;
  const az = phys.az;
  const vx0 = velocityForTarget({ start: x0, target: pX, accel: ax, time: t });
  const vz0 = velocityForTarget({ start: z0, target: pZ, accel: az, time: t });

  return {
    isPitch: true,
    playId: `${playKey}-p${pitchNumber}-${pitch.result}-${type}`,
    pitchNumber,
    startTime: new Date(0).toISOString(),
    endTime: new Date(0).toISOString(),
    details: {
      code: meta.code,
      description: meta.description,
      isBall: meta.isBall,
      isStrike: meta.isStrike,
      isInPlay: meta.isInPlay,
      call: { code: meta.code, description: meta.description },
      type: {
        code: type,
        description: pitch.typeName || def.name || type,
      },
    },
    pitchData: {
      strikeZoneTop: STRIKE_ZONE_TOP,
      strikeZoneBottom: STRIKE_ZONE_BOTTOM,
      strikeZoneWidth: 17,
      strikeZoneDepth: 8.5,
      startSpeed,
      endSpeed: Math.round(startSpeed * 0.91 * 10) / 10,
      breaks: {
        spinRate: pitch.spinRate || def.spinMean || 2200,
        spinDirection: phys.spinDir,
      },
      coordinates: {
        pX,
        pZ,
        x0,
        y0,
        z0,
        vX0: vx0,
        vY0: vy0,
        vZ0: vz0,
        aX: ax,
        aY: ay,
        aZ: az,
      },
    },
    type,
    result: pitch.result,
  };
}

/** Convert simulator pitch list → Gameday playEvents for LiveAtBatVisual / PitchCanvas. */
export function simPitchesToPlayEvents(pitches = [], options = {}) {
  return pitches.map((pitch, index) => simPitchToPlayEvent(pitch, index + 1, options));
}
