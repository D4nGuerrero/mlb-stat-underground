import { buildBipResult, simulateSprayAngle } from './battedBall';
import { DEFAULT_PARK, LEAGUE_AVG, PARK_FACTORS, PITCH_DEFS } from './constants';
import { randn, weightedOutcome } from './math';
import {
  applyParkFactor,
  applyStatcastAdjustments,
  batterProbabilities,
  blendWithPitcher,
} from './probability';

function getPaProbabilities(batter, pitcherStats, homeTeamId) {
  let probs = batterProbabilities(batter?.stats);
  probs = applyStatcastAdjustments(probs, batter?.statcastStats);
  probs = blendWithPitcher(probs, pitcherStats);
  probs = applyParkFactor(probs, homeTeamId);
  return probs;
}

function scaleWeights(base, paProbs, parkHr = 1) {
  const scaled = {};
  for (const [key, weight] of Object.entries(base)) {
    const rate = paProbs[key] ?? LEAGUE_AVG[key] ?? 0.1;
    const league = LEAGUE_AVG[key] ?? 0.1;
    scaled[key] = weight * (rate / league) * (key === 'HR' ? parkHr : 1);
  }
  return scaled;
}

function buildPitcherArsenal(pitcherStats) {
  if (!pitcherStats) return [{ type: 'FF', w: 0.55 }, { type: 'SL', w: 0.25 }, { type: 'CH', w: 0.20 }];
  const ip = Math.max(pitcherStats.inningsPitched || 0, 5);
  const kPer9 = (pitcherStats.strikeOuts || 0) / ip * 9;
  const bbPer9 = (pitcherStats.baseOnBalls || 0) / ip * 9;
  const hrPer9 = (pitcherStats.homeRuns || 0) / ip * 9;
  if (kPer9 >= 10) return [{ type: 'FF', w: 0.42 }, { type: 'SL', w: 0.30 }, { type: 'CH', w: 0.15 }, { type: 'CU', w: 0.13 }];
  if (hrPer9 < 0.8) return [{ type: 'SI', w: 0.44 }, { type: 'SL', w: 0.24 }, { type: 'CH', w: 0.20 }, { type: 'FC', w: 0.12 }];
  if (bbPer9 < 2.0) return [{ type: 'FF', w: 0.35 }, { type: 'FC', w: 0.22 }, { type: 'CU', w: 0.25 }, { type: 'CH', w: 0.18 }];
  return [{ type: 'FF', w: 0.50 }, { type: 'SL', w: 0.22 }, { type: 'CH', w: 0.18 }, { type: 'CU', w: 0.10 }];
}

function selectPitchType(arsenal, balls, strikes) {
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
  return adjusted[0].type;
}

function generatePitchLocation(pitcherStats, balls) {
  const walks = pitcherStats?.baseOnBalls || 0;
  const battersFaced = Math.max((pitcherStats?.inningsPitched || 50) * 4.3, 50);
  const control = Math.max(0.40, 0.58 - (walks / battersFaced) * 0.5);
  const zonePct = balls >= 3 ? Math.min(0.80, control * 1.4) : control;
  const throwInZone = Math.random() < zonePct;

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

function simulateBip(velocity, pitchType, inZone, zone, plateX, plateZ, batter, pitcherStats, homeTeamId, paProbs) {
  const battingStats = batter?.stats;
  const statcast = batter?.statcastStats;
  let baseEV = 87.5;

  if (statcast?.avgHitSpeed) baseEV = statcast.avgHitSpeed;
  else if (battingStats) {
    const pa = battingStats.plateAppearances || battingStats.atBats || 400;
    if (pa > 30) baseEV = 85 + ((battingStats.slg || 0.400) - (battingStats.avg || 0.250)) * 28;
  }
  if (pitcherStats) baseEV -= (4.0 - (parseFloat(pitcherStats.era) || 4.0)) * 0.6;

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

  let outcome;
  if (launchAngle > 50) outcome = 'OUT';
  else if (launchAngle < 0) {
    outcome = Math.random() < (exitVelocity > 98 ? 0.35 : 0.24)
      ? '1B'
      : weightedOutcome(scaleWeights({ OUT: 0.76, '1B': 0.24 }, paProbs));
  } else if (launchAngle < 10) {
    outcome = weightedOutcome(scaleWeights(
      exitVelocity > 95 ? { '1B': 0.32, OUT: 0.68 } : { '1B': 0.26, OUT: 0.74 },
      paProbs,
    ));
  } else if (launchAngle < 25) {
    outcome = exitVelocity >= 95
      ? weightedOutcome(scaleWeights({ '1B': 0.35, '2B': 0.28, '3B': 0.05, HR: 0.04, OUT: 0.28 }, paProbs, park.hr))
      : weightedOutcome(scaleWeights({ '1B': 0.44, '2B': 0.18, OUT: 0.38 }, paProbs));
  } else if (launchAngle <= 35) {
    if (exitVelocity >= 103) outcome = weightedOutcome(scaleWeights({ HR: 0.85, '2B': 0.06, OUT: 0.09 }, paProbs, park.hr));
    else if (exitVelocity >= 98) outcome = weightedOutcome(scaleWeights({ HR: 0.55, '2B': 0.22, OUT: 0.23 }, paProbs, park.hr));
    else if (exitVelocity >= 90) outcome = weightedOutcome(scaleWeights({ HR: 0.18, '2B': 0.25, '1B': 0.10, OUT: 0.47 }, paProbs, park.hr));
    else outcome = weightedOutcome(scaleWeights({ '1B': 0.15, '2B': 0.08, OUT: 0.77 }, paProbs));
  } else if (exitVelocity >= 100) {
    outcome = weightedOutcome(scaleWeights({ HR: 0.68, '2B': 0.12, OUT: 0.20 }, paProbs, park.hr));
  } else if (exitVelocity >= 90) {
    outcome = weightedOutcome(scaleWeights({ HR: 0.22, '2B': 0.18, OUT: 0.60 }, paProbs, park.hr));
  } else {
    outcome = weightedOutcome(scaleWeights({ '2B': 0.05, OUT: 0.95 }, paProbs));
  }

  const bip = buildBipResult({
    ev: exitVelocity,
    la: launchAngle,
    spray: sprayAngle,
    outcome,
    parkHr: park.hr,
    batter,
  });

  return {
    ...bip,
    hardHit: bip.ev >= 95,
    barrel: bip.ev >= 98 && bip.la >= 8 && bip.la <= 32,
  };
}

export function simulateAtBat(batter, pitcher, homeTeamId, options = {}) {
  const { forceWalk = false } = options;
  const pitcherStats = pitcher?.pitchingStats;
  const arsenal = buildPitcherArsenal(pitcherStats);
  const battingStats = batter?.stats;
  const paProbs = getPaProbabilities(batter, pitcherStats, homeTeamId);
  const pitches = [];
  let balls = 0;
  let strikes = 0;
  let outcome = null;
  let bipResult = null;

  if (forceWalk) {
    return { outcome: 'IBB', pitches: [], pitchCount: 0, intentionalWalk: true };
  }

  if (Math.random() < (paProbs.HBP || LEAGUE_AVG.HBP)) {
    return { outcome: 'HBP', pitches: [], pitchCount: 1 };
  }

  while (outcome === null) {
    const pitchType = selectPitchType(arsenal, balls, strikes);
    const pitchDef = PITCH_DEFS[pitchType] || PITCH_DEFS.FF;
    const velocity = pitchDef.velMean + randn() * pitchDef.velStd;
    const location = generatePitchLocation(pitcherStats, balls);
    const kSkill = (paProbs.K || LEAGUE_AVG.K) / LEAGUE_AVG.K;
    const bbSkill = (paProbs.BB || LEAGUE_AVG.BB) / LEAGUE_AVG.BB;

    let zoneSwing = 0.68;
    let chaseSwing = 0.28;
    if (balls >= 3) { zoneSwing *= 1.05; chaseSwing *= 0.70; }
    if (strikes >= 2) { zoneSwing *= 1.08; chaseSwing *= 1.35; }
    if (!balls && !strikes) chaseSwing *= 0.85;
    if (battingStats) {
      const pa = battingStats.plateAppearances || battingStats.atBats || 400;
      if (pa > 30) {
        const kRate = (battingStats.strikeOuts || 0) / pa;
        if (kRate > 0.28) chaseSwing *= 1.15;
        if (kRate < 0.15) chaseSwing *= 0.85;
      }
    }

    const swings = Math.random() < (location.inZone ? zoneSwing : chaseSwing);
    let pitchResult;

    if (!swings) {
      const ballBias = bbSkill > 1.1 ? 0.08 : 0;
      pitchResult = location.inZone ? 'CS' : (Math.random() < 0.92 - ballBias ? 'B' : 'CS');
      if (pitchResult === 'B') balls++;
      else {
        strikes++;
        if (strikes >= 3) outcome = 'K';
      }
    } else {
      const whiffBase = { FF: 0.22, SI: 0.18, FC: 0.24, SL: 0.28, SW: 0.33, CU: 0.26, CH: 0.30, FS: 0.32 };
      let whiff = (whiffBase[pitchType] || 0.25) * (!location.inZone ? 1.3 : location.zone === 5 ? 0.75 : 1.0);
      const velocityDiff = velocity - (pitchDef.velMean || 90);
      whiff = Math.max(0.05, Math.min(0.65, (whiff + velocityDiff * 0.003) * kSkill));

      if (Math.random() > whiff) {
        const isFoul = Math.random() < (location.inZone ? 0.33 : 0.50);
        if (isFoul) {
          pitchResult = 'F';
          if (strikes < 2) strikes++;
        } else {
          pitchResult = 'X';
          bipResult = simulateBip(
            velocity, pitchType, location.inZone, location.zone, location.plateX, location.plateZ,
            batter, pitcherStats, homeTeamId, paProbs,
          );
          outcome = bipResult.outcome;
        }
      } else {
        pitchResult = 'SS';
        strikes++;
        if (strikes >= 3) outcome = 'K';
      }
    }

    pitches.push({
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
      ...(pitchResult === 'X' && bipResult ? { ev: bipResult.ev, la: bipResult.la, dist: bipResult.dist } : {}),
    });

    if (balls >= 4) { outcome = 'BB'; break; }
    if (outcome !== null) break;
  }

  return {
    outcome,
    pitches,
    pitchCount: pitches.length,
    ...(bipResult ? {
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
    } : {}),
  };
}