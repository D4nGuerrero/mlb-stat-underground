/**
 * Simple field-space ballistic path for sim outcome theater.
 * Coordinates: origin at plate, +Y toward CF, +X toward 1B (RF for RHH spray convention).
 * Units: feet on the field plane; Z is height.
 */

/**
 * @param {{ exitVelocity?: number, launchAngle?: number, sprayAngle?: number, hitDistance?: number, outcome?: string }} bip
 * @param {{ steps?: number }} opts
 * @returns {{ points: Array<{x:number,y:number,z:number}>, landDist: number, isHr: boolean }}
 */
export function buildOutcomeTrajectory(bip = {}, opts = {}) {
  const steps = opts.steps ?? 48;
  const ev = Number(bip.exitVelocity ?? bip.ev) || 90;
  const la = Number(bip.launchAngle ?? bip.la) || 20;
  const spray = Number(bip.sprayAngle ?? bip.spray) || 0;
  const isHr = bip.outcome === 'HR' || opts.forceHr;
  let dist = Number(bip.hitDistance ?? bip.dist) || 0;

  if (!dist) {
    // Rough carry from EV/LA
    const laRad = (la * Math.PI) / 180;
    dist = Math.max(40, Math.min(480, (ev * 2.8) * Math.sin(Math.max(0.05, laRad * 1.1))));
  }
  if (isHr && dist < 340) dist = 340 + Math.random() * 40;

  const sprayRad = (spray * Math.PI) / 180;
  const laRad = (Math.max(-10, Math.min(50, la)) * Math.PI) / 180;
  // Peak height ~ f(LA, EV)
  const peakZ = Math.max(4, Math.min(140, dist * Math.tan(Math.max(0.05, laRad)) * 0.55 + (ev - 80) * 0.4));

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease out slightly for carry
    const s = t;
    const range = dist * s;
    const x = Math.sin(sprayRad) * range;
    const y = Math.cos(sprayRad) * range;
    // Parabola: z = 4h t (1-t) scaled to peak, with slight hang
    const z = peakZ * 4 * s * (1 - s) * (isHr ? 1.15 : 1);
    points.push({ x, y, z: Math.max(0, z) });
  }

  // HR: end slightly above fence height at wall
  if (isHr) {
    const last = points[points.length - 1];
    if (last) last.z = Math.max(last.z, 12);
  }

  return { points, landDist: Math.round(dist), isHr: Boolean(isHr), peakZ };
}

export function outcomeTitle(outcome, bip = {}) {
  switch (outcome) {
    case 'HR':
      return bip.hitDistance || bip.dist
        ? `HOME RUN · ${Math.round(bip.hitDistance || bip.dist)} ft`
        : 'HOME RUN';
    case '3B':
      return 'TRIPLE';
    case '2B':
      return 'DOUBLE';
    case '1B':
      return 'SINGLE';
    case 'K':
      return bip.whiff ? 'STRIKEOUT · SWINGING' : 'STRIKEOUT · LOOKING';
    case 'BB':
      return 'WALK';
    case 'IBB':
      return 'INTENTIONAL WALK';
    case 'HBP':
      return 'HIT BY PITCH';
    case 'OUT':
    case 'SF':
    case 'DP':
    case 'SAC':
      return outcome === 'DP' ? 'DOUBLE PLAY' : outcome === 'SF' ? 'SACRIFICE FLY' : 'OUT';
    default:
      return outcome || 'PLAY';
  }
}
