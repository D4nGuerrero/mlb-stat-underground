import { classifyBattedBall, randn } from './math';

const BALL_LABEL = { GB: 'ground ball', LD: 'line drive', FB: 'fly ball', PU: 'popup' };

/** Carry distance (ft) tuned to Statcast-like ranges; high LA + modest EV stays short. */
export function estimateHitDistance(ev, la) {
  if (la >= 50) {
    return Math.round(55 + Math.max(0, ev - 68) * 1.1 - (la - 50) * 2.5);
  }
  if (la >= 38) {
    return Math.round(95 + Math.max(0, ev - 72) * 2.2 - (la - 38) * 5);
  }
  if (la < -4) {
    return Math.round(8 + ev * 0.3);
  }

  const optimalLa = 28;
  const spread = la < 18 ? 15 : 12;
  const laFactor = Math.exp(-0.5 * ((la - optimalLa) / spread) ** 2);
  const evTerm = (Math.max(0, ev - 50) / 55) ** 1.38;

  return Math.round(Math.max(55, Math.min(505, 470 * evTerm * laFactor)));
}

export function simulateSprayAngle(batter, plateX, pitchType) {
  const statcast = batter?.statcastStats || {};
  const bats = batter?.batsHand || 'R';
  const isLeft = bats === 'L';

  let pullWt = (statcast.pullPercent ?? 40) / 100;
  let centWt = (statcast.centPercent ?? 35) / 100;
  let oppoWt = (statcast.oppoPercent ?? 25) / 100;

  const inside = isLeft ? plateX < -0.18 : plateX > 0.18;
  const outside = isLeft ? plateX > 0.18 : plateX < -0.18;
  const awayBreak = ['SL', 'SW', 'CU', 'CH', 'FS'].includes(pitchType);

  if (inside) { pullWt *= 1.55; oppoWt *= 0.65; }
  if (outside) { oppoWt *= 1.45; pullWt *= 0.70; }
  if (awayBreak && outside) { oppoWt *= 1.35; pullWt *= 0.75; }
  if (awayBreak && inside) { pullWt *= 1.2; }

  const total = pullWt + centWt + oppoWt;
  const roll = Math.random() * total;
  let bucket = 'cent';
  if (roll < pullWt) bucket = 'pull';
  else if (roll < pullWt + centWt) bucket = 'cent';
  else bucket = 'oppo';

  const ranges = {
    pull: isLeft ? [18, 42] : [-42, -18],
    cent: [-14, 14],
    oppo: isLeft ? [-42, -18] : [18, 42],
  };
  const [lo, hi] = ranges[bucket];
  return Math.round((lo + Math.random() * (hi - lo) + randn() * 3) * 10) / 10;
}

export function sprayToField(spray) {
  if (spray < -30) return 'left field';
  if (spray < -12) return 'left-center field';
  if (spray <= 12) return 'center field';
  if (spray <= 30) return 'right-center field';
  return 'right field';
}

function fieldPhrase(spray, type, dist) {
  if (type === 'GB') {
    if (spray < -14) return 'the left side of the infield';
    if (spray > 14) return 'the right side of the infield';
    return 'up the middle';
  }
  if (type === 'PU') {
    if (Math.abs(spray) <= 12) return 'shallow center field';
    return `shallow ${sprayToField(spray)}`;
  }

  let depth;
  if (dist < 170) depth = 'shallow';
  else if (dist < 280) depth = 'medium';
  else if (dist < 360) depth = 'deep';
  else depth = 'deep';

  return `${depth} ${sprayToField(spray)}`;
}

function reconcileOutcome(outcome, ev, la, dist, parkHr) {
  if (outcome === 'HR' && dist < 325) {
    return dist >= 280 && ev >= 95 ? '2B' : 'OUT';
  }
  if (outcome === '3B' && dist < 300 && la < 8) return '1B';
  if (la >= 40 && ev < 93 && outcome !== 'OUT' && Math.random() < 0.88) return 'OUT';
  if (dist < 200 && la >= 35 && outcome === '1B') return 'OUT';
  if (dist >= 395 && ev >= 100 && la >= 24 && la <= 34 && outcome === 'OUT' && Math.random() < 0.35 * parkHr) {
    return 'HR';
  }
  return outcome;
}

export function buildBipResult({
  ev, la, spray, outcome, parkHr = 1, batter = null,
}) {
  const roundedEv = Math.round(ev * 10) / 10;
  const roundedLa = Math.round(la * 10) / 10;
  let dist = estimateHitDistance(roundedEv, roundedLa);
  const battedBallType = classifyBattedBall(roundedLa);
  const finalOutcome = reconcileOutcome(outcome, roundedEv, roundedLa, dist, parkHr);

  if (finalOutcome === 'HR' && dist < 340) {
    dist = Math.round(340 + Math.max(0, roundedEv - 95) * 2.5 + Math.random() * 25);
  }

  return {
    ev: roundedEv,
    la: roundedLa,
    dist,
    spray,
    battedBallType,
    field: sprayToField(spray),
    fieldPhrase: fieldPhrase(spray, battedBallType, dist),
    outcome: finalOutcome,
  };
}

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function describeBipPlay(hitType, bip, runsScored = 0) {
  const ball = BALL_LABEL[bip.battedBallType] || 'ball';
  const where = bip.fieldPhrase || sprayToField(bip.spray);

  if (hitType === 'HR') {
    const distNote = bip.dist ? ` (${bip.dist} ft)` : '';
    return runsScored === 1
      ? `homers on a ${ball} to ${where}${distNote}`
      : `hits a ${runsScored}-run home run on a ${ball} to ${where}${distNote}`;
  }
  if (hitType === '3B') {
    return `triples on a ${ball} to ${where}`;
  }
  if (hitType === '2B') {
    return `doubles on a ${ball} to ${where}`;
  }
  if (hitType === '1B') {
    return `singles on a ${ball} to ${where}`;
  }
  if (hitType === 'OUT') {
    if (runsScored > 0) {
      return pick([
        `sacrifices on a ${ball} to ${where}`,
        `flies out deep enough to ${where} — run scores`,
      ]);
    }
    const verbs = {
      GB: ['grounds out', 'chops out', 'rolls out'],
      LD: ['lines out', 'lines out sharply'],
      FB: ['flies out', 'flies out to the track'],
      PU: ['pops out', 'lifts a popup'],
    };
    const verb = pick(verbs[bip.battedBallType] || ['is out']);
    return `${verb} to ${where}`;
  }
  return hitType;
}