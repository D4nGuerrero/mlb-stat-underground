/**
 * True live pitch-by-pitch at-bat.
 * Each throwLivePitch() rolls location / swing / result; AB ends when K/BB/HBP/BIP.
 */
import { bipForForcedOutcome, buildBipResult, simulateSprayAngle } from './battedBall.js';
import { DEFAULT_PARK, LEAGUE_AVG, PARK_FACTORS, PITCH_DEFS } from './constants.js';
import { randn } from './math.js';
import { getPaProbabilities } from './atBat.js';
import { resolveBipOutcome } from './probability.js';
import {
  buildPitcherArsenal,
  generatePitchLocation,
  selectPitchType,
} from './pitchTheater.js';

function packageBip(bipResult) {
  if (!bipResult) return {};
  return {
    exitVelocity: bipResult.ev,
    launchAngle: bipResult.la,
    hitDistance: bipResult.dist,
    sprayAngle: bipResult.spray,
    hitField: bipResult.field,
    hardHit: bipResult.hardHit ?? bipResult.ev >= 95,
    barrel: bipResult.barrel ?? (bipResult.ev >= 98 && bipResult.la >= 8 && bipResult.la <= 32),
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

function simulateLiveBip(velocity, pitchType, inZone, zone, plateX, plateZ, batter, homeTeamId, paProbs) {
  const battingStats = batter?.stats;
  const statcast = batter?.statcastStats;
  let baseEV = 87.5;
  if (statcast?.avgHitSpeed) baseEV = statcast.avgHitSpeed;
  else if (battingStats) {
    const pa = battingStats.plateAppearances || battingStats.atBats || 400;
    if (pa > 30) baseEV = 85 + ((battingStats.slg || 0.400) - (battingStats.avg || 0.250)) * 28;
  }

  const contactQuality =
    ((paProbs.HR / LEAGUE_AVG.HR) * 0.35
      + (paProbs['2B'] / LEAGUE_AVG['2B']) * 0.25
      + (paProbs['1B'] / LEAGUE_AVG['1B']) * 0.20
      + (paProbs.K / LEAGUE_AVG.K) * -0.28);
  baseEV *= Math.max(0.84, Math.min(1.22, Math.sqrt(Math.max(0.45, contactQuality))));

  const velMean = PITCH_DEFS[pitchType]?.velMean || 90;
  const locationPenalty = !inZone ? -2.5 : zone === 5 ? 1.5 : 0;
  const exitVelocity = Math.max(50, baseEV - (velocity - velMean) * 0.12 + locationPenalty + randn() * 7);

  let launchRoll = Math.random();
  if (plateZ < 2.0) launchRoll = Math.min(launchRoll, 0.50);
  else if (plateZ > 3.1) launchRoll = Math.max(launchRoll, 0.78);
  if (!inZone && plateZ < 1.8) launchRoll = Math.min(launchRoll, 0.35);

  let launchAngle;
  if (launchRoll < 0.43) launchAngle = -5 + Math.random() * 14;
  else if (launchRoll < 0.68) launchAngle = 10 + Math.random() * 14;
  else if (launchRoll < 0.90) launchAngle = 25 + Math.random() * 22;
  else launchAngle = 50 + Math.random() * 30;

  const sprayAngle = simulateSprayAngle(batter, plateX, pitchType);
  const park = PARK_FACTORS[homeTeamId] || DEFAULT_PARK;
  const outcome = resolveBipOutcome(paProbs, {
    exitVelocity,
    launchAngle,
    parkHr: park.hr,
  });

  // Lock bip physics to the rolled outcome for coherent theater
  const locked = bipForForcedOutcome(outcome, batter, pitchType, plateX, park.hr);
  const bip = buildBipResult({
    ev: locked.ev ?? exitVelocity,
    la: locked.la ?? launchAngle,
    spray: locked.spray ?? sprayAngle,
    outcome,
    parkHr: park.hr,
    lockOutcome: true,
  });

  return {
    ...bip,
    hardHit: bip.ev >= 95,
    barrel: bip.ev >= 98 && bip.la >= 8 && bip.la <= 32,
  };
}

/**
 * Start a live at-bat (no pitches yet).
 */
export function createLiveAtBat(batter, pitcher, homeTeamId, options = {}) {
  const { forceWalk = false } = options;
  const pitcherStats = pitcher?.pitchingStats;
  return {
    batter,
    pitcher,
    homeTeamId,
    pitcherStats,
    arsenal: buildPitcherArsenal(pitcherStats),
    paProbs: getPaProbabilities(batter, pitcher, homeTeamId),
    balls: 0,
    strikes: 0,
    pitches: [],
    complete: false,
    outcome: null,
    intentionalWalk: Boolean(forceWalk),
    forceWalk: Boolean(forceWalk),
    ...packageBip(null),
  };
}

/**
 * Roll one pitch. Mutates a copy of state; returns new state + pitch record.
 */
export function throwLivePitch(atBat) {
  if (!atBat || atBat.complete) {
    return { atBat, pitch: null, justCompleted: false };
  }

  // Intentional walk — no pitches
  if (atBat.forceWalk) {
    const done = {
      ...atBat,
      complete: true,
      outcome: 'IBB',
      intentionalWalk: true,
      pitchCount: 0,
    };
    return { atBat: done, pitch: null, justCompleted: true };
  }

  const {
    arsenal, pitcherStats, paProbs, batter, homeTeamId,
  } = atBat;
  let { balls, strikes } = atBat;
  const pitches = [...atBat.pitches];

  // Rare HBP before/with a pitch when count is quiet
  if (pitches.length === 0 && Math.random() < (paProbs.HBP || LEAGUE_AVG.HBP) * 0.85) {
    const location = generatePitchLocation(pitcherStats, balls, { forceInZone: false });
    const pitchType = selectPitchType(arsenal, balls, strikes);
    const pitchDef = PITCH_DEFS[pitchType] || PITCH_DEFS.FF;
    const velocity = pitchDef.velMean + randn() * pitchDef.velStd;
    const pitch = {
      num: 1,
      type: pitchType,
      typeName: pitchDef.name,
      velocity: Math.round(velocity * 10) / 10,
      spinRate: Math.round(pitchDef.spinMean + randn() * 150),
      plateX: location.plateX,
      plateZ: location.plateZ,
      zone: location.zone,
      inZone: location.inZone,
      result: 'HBP',
      count: `${balls}-${strikes}`,
    };
    const done = {
      ...atBat,
      pitches: [pitch],
      complete: true,
      outcome: 'HBP',
      pitchCount: 1,
    };
    return { atBat: done, pitch, justCompleted: true };
  }

  const pitchType = selectPitchType(arsenal, balls, strikes);
  const pitchDef = PITCH_DEFS[pitchType] || PITCH_DEFS.FF;
  const velocity = pitchDef.velMean + randn() * pitchDef.velStd;
  const location = generatePitchLocation(pitcherStats, balls);

  const kSkill = (paProbs.K || LEAGUE_AVG.K) / LEAGUE_AVG.K;
  const bbSkill = (paProbs.BB || LEAGUE_AVG.BB) / LEAGUE_AVG.BB;
  const contactSkill =
    ((paProbs.HR + paProbs['2B'] + paProbs['1B'])
      / (LEAGUE_AVG.HR + LEAGUE_AVG['2B'] + LEAGUE_AVG['1B']));

  let zoneSwing = 0.68 * Math.max(0.85, Math.min(1.12, 1.08 - (kSkill - 1) * 0.12));
  let chaseSwing = 0.28 * Math.max(0.75, Math.min(1.35, 1 + (kSkill - 1) * 0.22 - (bbSkill - 1) * 0.08));
  if (balls >= 3) { zoneSwing *= 1.05; chaseSwing *= 0.70; }
  if (strikes >= 2) { zoneSwing *= 1.08; chaseSwing *= 1.35; }
  if (!balls && !strikes) chaseSwing *= 0.85;

  const swings = Math.random() < (location.inZone ? zoneSwing : chaseSwing);
  let pitchResult;
  let bipResult = null;
  let outcome = null;

  if (!swings) {
    const ballBias = bbSkill > 1.1 ? 0.08 : 0;
    pitchResult = location.inZone ? 'CS' : (Math.random() < 0.92 - ballBias ? 'B' : 'CS');
    if (pitchResult === 'B') balls += 1;
    else {
      strikes += 1;
      if (strikes >= 3) outcome = 'K';
    }
  } else {
    const whiffBase = { FF: 0.22, SI: 0.18, FC: 0.24, SL: 0.28, SW: 0.33, CU: 0.26, CH: 0.30, FS: 0.32 };
    let whiff = (whiffBase[pitchType] || 0.25) * (!location.inZone ? 1.25 : location.zone === 5 ? 0.78 : 1.0);
    const velocityDiff = velocity - (pitchDef.velMean || 90);
    const kBlend = 0.72 + kSkill * 0.28;
    const contactBlend = Math.max(0.88, Math.min(1.18, contactSkill));
    whiff = Math.max(0.05, Math.min(0.52, (whiff + velocityDiff * 0.0025) * kBlend / contactBlend));

    if (Math.random() > whiff) {
      const isFoul = Math.random() < (location.inZone ? 0.33 : 0.50);
      if (isFoul) {
        pitchResult = 'F';
        if (strikes < 2) strikes += 1;
      } else {
        pitchResult = 'X';
        bipResult = simulateLiveBip(
          velocity, pitchType, location.inZone, location.zone,
          location.plateX, location.plateZ, batter, homeTeamId, paProbs,
        );
        outcome = bipResult.outcome;
      }
    } else {
      pitchResult = 'SS';
      strikes += 1;
      if (strikes >= 3) outcome = 'K';
    }
  }

  if (balls >= 4) outcome = 'BB';

  const pitch = {
    num: pitches.length + 1,
    type: pitchType,
    typeName: pitchDef.name,
    velocity: Math.round(velocity * 10) / 10,
    spinRate: Math.round(pitchDef.spinMean + randn() * 150),
    plateX: location.plateX,
    plateZ: location.plateZ,
    zone: location.zone,
    inZone: location.inZone,
    result: pitchResult,
    count: `${balls}-${strikes}`,
    ...(pitchResult === 'X' && bipResult ? {
      ev: bipResult.ev,
      la: bipResult.la,
      dist: bipResult.dist,
    } : {}),
  };
  pitches.push(pitch);

  const complete = outcome != null;
  const next = {
    ...atBat,
    balls,
    strikes,
    pitches,
    complete,
    outcome: complete ? outcome : null,
    pitchCount: pitches.length,
    ...(complete && bipResult ? packageBip(bipResult) : {}),
  };

  return { atBat: next, pitch, justCompleted: complete };
}

/** Snapshot for UI / outcome stage (looks like a game play row). */
export function liveAtBatToPlayView(atBat, meta = {}) {
  return {
    ...meta,
    batter: atBat.batter?.name,
    batterId: atBat.batter?.id,
    pitcher: atBat.pitcher?.name,
    pitcherId: atBat.pitcher?.id,
    outcome: atBat.outcome,
    pitches: atBat.pitches,
    atBatPitches: atBat.pitches.length,
    intentionalWalk: atBat.intentionalWalk,
    exitVelocity: atBat.exitVelocity,
    launchAngle: atBat.launchAngle,
    hitDistance: atBat.hitDistance,
    sprayAngle: atBat.sprayAngle,
    hitField: atBat.hitField,
    hardHit: atBat.hardHit,
    barrel: atBat.barrel,
    battedBallType: atBat.battedBallType,
    bipMeta: atBat.bipMeta,
    balls: atBat.balls,
    strikes: atBat.strikes,
    complete: atBat.complete,
  };
}
