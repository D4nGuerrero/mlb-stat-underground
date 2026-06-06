/** Defense & baserunning helpers — uses available season stats as proxies. */

export function runnerSpeed(batter) {
  const stats = batter?.stats;
  if (!stats) return 0.5;
  const pa = stats.plateAppearances || stats.atBats || 400;
  const sb = stats.stolenBases || 0;
  const triples = stats.triples || 0;
  return Math.min(1, Math.max(0.2, 0.35 + (sb / pa) * 10 + (triples / pa) * 20));
}

export function teamDefenseRating(lineup) {
  if (!lineup?.length) return 1;
  let sum = 0;
  let n = 0;
  for (const player of lineup) {
    const stats = player.stats;
    if (!stats) continue;
    const pa = stats.plateAppearances || stats.atBats || 1;
    const k = stats.strikeOuts || 0;
    const defenseProxy = 1 - Math.min(0.15, k / pa) * 0.5;
    sum += defenseProxy;
    n++;
  }
  return n ? sum / n : 1;
}

export function isPullSpray(batsHand, spray) {
  return (batsHand === 'L' && spray > 12) || (batsHand !== 'L' && spray < -12);
}

export function doublePlayChance(bip, batter, defenseRating, bases, outs) {
  if (!bip || outs >= 2 || !bases[0]) return 0;
  if (bip.battedBallType !== 'GB') return 0;
  let p = 0.11;
  if (bip.ev < 80) p += 0.09;
  else if (bip.ev < 86) p += 0.05;
  else if (bip.ev > 94) p -= 0.04;
  if (bases[1]) p += 0.03;
  p *= defenseRating;
  p *= 1.15 - runnerSpeed(batter) * 0.2;
  return Math.max(0.04, Math.min(0.32, p));
}

export function errorChance(bip, defenseRating) {
  let p = 0.012;
  if (bip?.battedBallType === 'GB') p = 0.024;
  if (bip?.battedBallType === 'LD' && bip.ev >= 100) p = 0.008;
  return Math.min(0.055, p / defenseRating);
}

/** Shift / defense converts would-be hits to outs. */
export function fieldingHitConversion(bip, batter, defenseRating) {
  if (!bip) return 0;
  let p = 0;
  if (bip.battedBallType === 'GB' && bip.ev < 88) {
    p = 0.08;
    if (isPullSpray(batter?.batsHand || 'R', bip.spray)) p += 0.06;
  }
  if (bip.battedBallType === 'LD' && bip.ev < 92) p = 0.05;
  if (bip.battedBallType === 'FB' && bip.dist < 260) p = 0.04;
  return Math.min(0.22, p * defenseRating);
}

export function sacFlyEligible(bip, bases, outs) {
  if (!bases[2] || outs >= 2 || !bip) return false;
  if (!['FB', 'LD'].includes(bip.battedBallType)) return false;
  return bip.dist >= 200 || (bip.la >= 22 && bip.ev >= 85);
}