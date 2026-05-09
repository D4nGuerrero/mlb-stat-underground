// src/components/PitchCanvas.jsx
// Dual-canvas pitch visualization (trails + strike zone), catcher’s view.

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';

const PLATE_WIDTH_FT = 17 / 12;
const MOUND_Y = 60.5;
const PLATE_FRONT_Y = 1.417;
const N_TRAIL_POINTS = 100;

/**
 * Where the **straight-line fallback** trail starts (ft, catcher’s view) when the API only
 * provides end position (pX, pZ). Tweak `z` to move the release dot toward the top of the
 * chart; tweak `x` to bias left/right.
 */
export const PITCH_TRAIL_FALLBACK_RELEASE_X_FT = 0;
export const PITCH_TRAIL_FALLBACK_RELEASE_Z_FT = 6.5;
const ANIMATION_MS = 520;
const FADE_MS = 180;
const OLD_PITCH_ALPHA = 0.22;

const FONT_UI = '600 9px Inter, system-ui, sans-serif';
const FONT_UI_SM = '500 8px Inter, system-ui, sans-serif';
const FONT_DOT = 'bold 6px Inter, system-ui, sans-serif';
const FONT_LABEL = '700 10px Inter, system-ui, sans-serif';

const PITCH_TYPE_COLORS = {
  FF: { trail: '#FF3B2F', ball: '#FF6B5E', glow: 'rgba(255,59,47,0.5)' },
  FT: { trail: '#FF5A1F', ball: '#FF7A4A', glow: 'rgba(255,90,31,0.5)' },
  FC: { trail: '#FF8C00', ball: '#FFB347', glow: 'rgba(255,140,0,0.45)' },
  FS: { trail: '#FF4500', ball: '#FF6633', glow: 'rgba(255,69,0,0.5)' },
  SI: { trail: '#FF5A1F', ball: '#FF7A4A', glow: 'rgba(255,90,31,0.5)' },
  SL: { trail: '#007AFF', ball: '#4DA6FF', glow: 'rgba(0,122,255,0.5)' },
  CU: { trail: '#5856D6', ball: '#9D9CE8', glow: 'rgba(88,86,214,0.5)' },
  KC: { trail: '#6E5DB8', ball: '#A08FD6', glow: 'rgba(110,93,184,0.45)' },
  SV: { trail: '#00C3E0', ball: '#5DDAF0', glow: 'rgba(0,195,224,0.45)' },
  CH: { trail: '#34C759', ball: '#6DDD8A', glow: 'rgba(52,199,89,0.45)' },
  EP: { trail: '#30D158', ball: '#60DC80', glow: 'rgba(48,209,88,0.4)' },
  KN: { trail: '#FFD60A', ball: '#FFE566', glow: 'rgba(255,214,10,0.5)' },
  _: { trail: '#94a3b8', ball: '#cbd5e1', glow: 'rgba(148,163,184,0.45)' },
};

const RESULT_OVERLAY = {
  called_strike: { ring: '#f87171', label: 'CALLED STRIKE', labelColor: '#fecaca' },
  swinging_strike: { ring: '#fb923c', label: 'SWING & MISS', labelColor: '#fed7aa' },
  ball: { ring: '#34d399', label: 'BALL', labelColor: '#a7f3d0' },
  in_play: { ring: '#fbbf24', label: 'IN PLAY', labelColor: '#fde68a' },
  foul: { ring: '#94a3b8', label: 'FOUL', labelColor: '#cbd5e1' },
  hit_by_pitch: { ring: '#c084fc', label: 'HIT BY PITCH', labelColor: '#e9d5ff' },
};

function getPitchColors(typeCode) {
  return PITCH_TYPE_COLORS[typeCode] || PITCH_TYPE_COLORS._;
}

function getResultKey(description = '') {
  const d = description.toLowerCase();
  if (d.includes('called strike')) return 'called_strike';
  if (d.includes('swinging strike') || d.includes('missed')) return 'swinging_strike';
  if (d.includes('in play')) return 'in_play';
  if (d.includes('foul tip') || d.includes('foul')) return 'foul';
  if (d.includes('hit by')) return 'hit_by_pitch';
  if (d.includes('ball')) return 'ball';
  return null;
}

function evalPoly(coeffs, t) {
  if (!coeffs || coeffs.length < 2) return null;
  return coeffs[0] + coeffs[1] * t + (coeffs[2] || 0) * t * t + (coeffs[3] || 0) * t * t * t;
}

/** Human-readable trajectory source for tuning / debug readouts. */
export function getTrajectoryBranch(pitchData) {
  const c = pitchData?.coordinates;
  if (!c) return 'none';
  if (
    c.trajectoryPolynomialX?.length >= 2 &&
    c.trajectoryPolynomialY?.length >= 2 &&
    c.trajectoryPolynomialZ?.length >= 2
  ) {
    return 'polynomial';
  }
  if (c.vX0 != null && c.vZ0 != null && c.aX != null && c.aZ != null) return 'kinematic';
  if (c.pX != null && c.pZ != null) return 'pXpZ_fallback';
  return 'none';
}

/**
 * Shift perceived release toward mound while keeping plate end fixed: full bias at trail start,
 * zero at the plate (linear taper along the sampled polyline).
 */
function applyReleaseBias(points, biasX, biasZ) {
  if (!points?.length || (biasX === 0 && biasZ === 0)) return points;
  const n = Math.max(1, points.length - 1);
  return points.map((p, i) => {
    const w = 1 - i / n;
    return { x: p.x + biasX * w, z: p.z + biasZ * w };
  });
}

/** True if buildTrajectory can produce a path from this pitch payload. */
export function hasRenderablePitchData(pitchData) {
  if (!pitchData?.coordinates) return false;
  const c = pitchData.coordinates;
  if (
    c.trajectoryPolynomialX?.length >= 2 &&
    c.trajectoryPolynomialY?.length >= 2 &&
    c.trajectoryPolynomialZ?.length >= 2
  ) {
    return true;
  }
  if (c.vX0 != null && c.vZ0 != null && c.aX != null && c.aZ != null) return true;
  if (c.pX != null && c.pZ != null) return true;
  return false;
}

function buildTrajectory(pitchData, n = N_TRAIL_POINTS) {
  if (!pitchData) return null;
  const coords = pitchData.coordinates || {};
  const points = [];

  const px = coords.trajectoryPolynomialX;
  const py = coords.trajectoryPolynomialY;
  const pz = coords.trajectoryPolynomialZ;

  if (px && py && pz && px.length >= 2) {
    // `tRelease` is found by Y travel; to change where the trail “starts” visually, nudge
    // MOUND_Y / the `MOUND_Y - 6` threshold, or add a small offset to the first few points.
    const T_MAX = 0.5;
    const T_STEPS = 200;
    let tRelease = 0;
    let tPlate = T_MAX;
    let foundRelease = false;
    for (let i = 0; i <= T_STEPS; i++) {
      const t = (i / T_STEPS) * T_MAX;
      const y = evalPoly(py, t);
      if (!foundRelease && y < MOUND_Y - 6) {
        tRelease = t;
        foundRelease = true;
      }
      if (y < PLATE_FRONT_Y) {
        tPlate = t;
        break;
      }
    }
    for (let i = 0; i <= n; i++) {
      const t = tRelease + (i / n) * (tPlate - tRelease);
      points.push({ x: evalPoly(px, t), z: evalPoly(pz, t) });
    }
    return points;
  }

  const { aX, aZ, vX0, vZ0, x0, z0, pX, pZ } = coords;
  if (vX0 != null && vZ0 != null && aX != null && aZ != null) {
    const vY0 = coords.vY0 || -130;
    const y0c = coords.y0 || MOUND_Y;
    const tTotal = pitchData.zoneTime || Math.abs((y0c - PLATE_FRONT_Y) / vY0);
    const X0 = coords.x0 || 0;
    const Z0 = coords.z0 || 5.0;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * tTotal;
      points.push({
        x: X0 + vX0 * t + 0.5 * aX * t * t,
        z: Z0 + vZ0 * t + 0.5 * aZ * t * t,
      });
    }
    return points;
  }

  if (pX != null && pZ != null) {
    const startX = PITCH_TRAIL_FALLBACK_RELEASE_X_FT;
    const startZ = PITCH_TRAIL_FALLBACK_RELEASE_Z_FT;
    for (let i = 0; i <= n; i++) {
      const frac = i / n;
      points.push({ x: startX + frac * pX, z: startZ + frac * (pZ - startZ) });
    }
    return points;
  }

  return null;
}

function makeProjector(W, H, szTop, szBot) {
  const X_RANGE = 2.0;
  const Z_MIN = 0.5;
  const Z_MAX = 5.5;
  const PAD_L = 36;
  const PAD_R = 36;
  const PAD_T = 28;
  const PAD_B = 40;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const toCanvasX = (x) => PAD_L + ((x + X_RANGE) / (2 * X_RANGE)) * plotW;
  const toCanvasZ = (z) => PAD_T + plotH - ((z - Z_MIN) / (Z_MAX - Z_MIN)) * plotH;

  const hw = PLATE_WIDTH_FT / 2;
  const szX1 = toCanvasX(-hw);
  const szX2 = toCanvasX(hw);
  const szY1 = toCanvasZ(szTop);
  const szY2 = toCanvasZ(szBot);

  return { toCanvasX, toCanvasZ, szX1, szX2, szY1, szY2, PAD_L, PAD_R, PAD_T, PAD_B, W, H };
}

function drawStrikeZone(ctx, proj, szTop, szBot, variant = 'default') {
  const { szX1, szX2, szY1, szY2, W, H, PAD_B } = proj;
  const zw = szX2 - szX1;
  const zh = szY2 - szY1;
  const dark = variant === 'gamedayDark';

  ctx.save();
  const vgr = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, Math.max(W, H) * 0.65);
  vgr.addColorStop(0, 'rgba(0,0,0,0)');
  vgr.addColorStop(1, dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vgr;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = dark ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.03)';
  ctx.beginPath();
  ctx.rect(szX1, szY1, zw, zh);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(226,232,240,0.18)' : 'rgba(255,255,255,0.07)';
  ctx.lineWidth = dark ? 1 : 0.75;
  for (let i = 1; i <= 2; i++) {
    const xg = szX1 + (zw * i) / 3;
    const yg = szY1 + (zh * i) / 3;
    ctx.beginPath();
    ctx.moveTo(xg, szY1);
    ctx.lineTo(xg, szY2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(szX1, yg);
    ctx.lineTo(szX2, yg);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(248,250,252,0.75)' : 'rgba(255,255,255,0.55)';
  ctx.lineWidth = dark ? 2 : 1.5;
  ctx.shadowColor = dark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)';
  ctx.shadowBlur = dark ? 10 : 6;
  ctx.strokeRect(szX1, szY1, zw, zh);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = dark ? 'rgba(226,232,240,0.45)' : 'rgba(255,255,255,0.28)';
  ctx.font = FONT_UI;
  ctx.textAlign = 'right';
  ctx.fillText(`${szTop.toFixed(1)}'`, szX1 - 6, szY1 + 4);
  ctx.fillText(`${szBot.toFixed(1)}'`, szX1 - 6, szY2 + 4);
  ctx.restore();

  const pm = W / 2;
  const py = H - PAD_B + 14;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pm, py + 10);
  ctx.lineTo(pm - 8, py + 4);
  ctx.lineTo(pm - 8, py - 4);
  ctx.lineTo(pm + 8, py - 4);
  ctx.lineTo(pm + 8, py + 4);
  ctx.closePath();
  ctx.fillStyle = dark ? 'rgba(248,250,252,0.18)' : 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = dark ? 'rgba(248,250,252,0.45)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = dark ? 'rgba(226,232,240,0.22)' : 'rgba(255,255,255,0.16)';
  ctx.font = FONT_UI_SM;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0.08em';
  ctx.fillText("CATCHER'S VIEW", W / 2, H - 4);
  ctx.restore();
}

function drawPitchTrail(ctx, points, colors, alpha = 1, progress = 1) {
  if (!points || points.length < 2) return;
  const n = Math.floor(points.length * progress);
  if (n < 2) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  for (let i = 1; i < n; i++) {
    const frac = i / (points.length - 1);
    const trailAlpha = 0.15 + frac * 0.85;
    const width = 1.5 + frac * 3.5;

    ctx.beginPath();
    ctx.moveTo(points[i - 1].cx, points[i - 1].cy);
    ctx.lineTo(points[i].cx, points[i].cy);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = colors.trail;
    ctx.globalAlpha = alpha * trailAlpha * 0.75;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 8;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBall(ctx, x, y, colors, alpha = 1, r = 7) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.8);
  glow.addColorStop(0, colors.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, colors.ball);
  grad.addColorStop(1, colors.trail);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawResultRing(ctx, x, y, colors, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colors.ring;
  ctx.lineWidth = 2;
  ctx.shadowColor = colors.ring;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function storageKey(gamePk) {
  return gamePk != null ? `mlbPc:lastPitch:${gamePk}` : null;
}

/**
 * PitchCanvas — animated pitch trails + strike zone (catcher view).
 *
 * @param {'default'|'gamedayDark'} variant — higher contrast on busy backgrounds
 * @param {string} [gamePk] — enables refresh detection via sessionStorage
 * @param {boolean} [showReleaseTuner] — mound→plate release bias sliders + readouts (defaults on in dev)
 */
export default function PitchCanvas({
  playEvents = [],
  szTop = 3.5,
  szBot = 1.5,
  width = 300,
  height = 320,
  className = '',
  variant = 'default',
  gamePk = null,
  showReleaseTuner = import.meta.env.DEV,
}) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const animRef = useRef(null);
  const projCacheRef = useRef(new Map());
  const stateRef = useRef({
    prevPitchId: null,
    animProgress: 1,
    ballAlpha: 1,
    phase: 'idle',
    animStart: null,
    proj: null,
    allPitches: [],
    projPointsList: [],
    currentPoints: null,
  });

  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const W = width;
  const H = height;

  const [releaseBiasX, setReleaseBiasX] = useState(0);
  const [releaseBiasZ, setReleaseBiasZ] = useState(0);

  useEffect(() => {
    projCacheRef.current.clear();
  }, [releaseBiasX, releaseBiasZ]);

  const cacheKeyFor = useCallback(
    (ev, idx) =>
      `${ev.playId ?? ''}_${ev.pitchNumber ?? idx}_${szTop}_${szBot}_${W}_${H}_${releaseBiasX}_${releaseBiasZ}`,
    [szTop, szBot, W, H, releaseBiasX, releaseBiasZ],
  );

  const projectPitchPoints = useCallback(
    (pitchData, proj, ev, idx) => {
      const ck = cacheKeyFor(ev, idx);
      let pts = projCacheRef.current.get(ck);
      if (!pts) {
        const traj = buildTrajectory(pitchData);
        if (!traj) return null;
        const biased = applyReleaseBias(traj, releaseBiasX, releaseBiasZ);
        pts = biased.map(({ x, z }) => ({
          cx: proj.toCanvasX(x),
          cy: proj.toCanvasZ(z),
        }));
        projCacheRef.current.set(ck, pts);
      }
      return pts;
    },
    [cacheKeyFor, releaseBiasX, releaseBiasZ],
  );

  const lastPitchData = useMemo(() => {
    const pitches = playEvents.filter((e) => e.isPitch && hasRenderablePitchData(e.pitchData));
    return pitches.length ? pitches[pitches.length - 1].pitchData : null;
  }, [playEvents]);

  const tunerReadout = useMemo(() => {
    if (!lastPitchData) return null;
    const branch = getTrajectoryBranch(lastPitchData);
    const raw = buildTrajectory(lastPitchData);
    const c = lastPitchData.coordinates || {};
    if (!raw?.length) {
      return {
        branch,
        raw: null,
        missingTraj: true,
        api: {
          pX: c.pX,
          pZ: c.pZ,
          hasPoly: !!(
            c.trajectoryPolynomialX?.length >= 2 &&
            c.trajectoryPolynomialY?.length >= 2 &&
            c.trajectoryPolynomialZ?.length >= 2
          ),
          vX0: c.vX0,
          vZ0: c.vZ0,
          z0: c.z0,
          y0: c.y0,
        },
      };
    }
    const r0 = raw[0];
    const r1 = raw[raw.length - 1];
    const b0 = applyReleaseBias(raw, releaseBiasX, releaseBiasZ)[0];
    return {
      branch,
      rawStart: { x: r0.x, z: r0.z },
      rawEnd: { x: r1.x, z: r1.z },
      biasedStart: { x: b0.x, z: b0.z },
      api: {
        pX: c.pX,
        pZ: c.pZ,
        hasPoly: !!(
          c.trajectoryPolynomialX?.length >= 2 &&
          c.trajectoryPolynomialY?.length >= 2 &&
          c.trajectoryPolynomialZ?.length >= 2
        ),
        vX0: c.vX0,
        vZ0: c.vZ0,
        z0: c.z0,
        y0: c.y0,
      },
    };
  }, [lastPitchData, releaseBiasX, releaseBiasZ]);

  const renderBg = useCallback((pitches, projPointsList, currentPoints, progress, proj) => {
    const canvas = bgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < pitches.length - 1; i++) {
      const pts = projPointsList[i];
      if (!pts) continue;
      const colors = getPitchColors(pitches[i].details?.type?.code);
      drawPitchTrail(ctx, pts, colors, OLD_PITCH_ALPHA, 1);
    }

    if (currentPoints && pitches.length > 0) {
      const colors = getPitchColors(pitches[pitches.length - 1]?.details?.type?.code);
      drawPitchTrail(ctx, currentPoints, colors, 1, progress);
    }
  }, []);

  const renderFg = useCallback(
    (pitches, projPointsList, currentPoints, progress, ballAlpha, phase, proj) => {
      const canvas = fgRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawStrikeZone(ctx, proj, szTop, szBot, variant);

      for (let i = 0; i < pitches.length - 1; i++) {
        const pts = projPointsList[i];
        if (!pts?.length) continue;
        const last = pts[pts.length - 1];
        const colors = getPitchColors(pitches[i].details?.type?.code);
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = colors.trail;
        ctx.beginPath();
        ctx.arc(last.cx, last.cy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = FONT_DOT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), last.cx, last.cy);
        ctx.restore();
      }

      if (currentPoints && currentPoints.length > 1) {
        const idx = Math.min(
          Math.floor(progress * (currentPoints.length - 1)),
          currentPoints.length - 1,
        );
        const pos = currentPoints[idx];
        const colors = getPitchColors(pitches[pitches.length - 1]?.details?.type?.code);

        drawBall(ctx, pos.cx, pos.cy, colors, ballAlpha);

        if (phase === 'landing' || phase === 'settled') {
          const finalPos = currentPoints[currentPoints.length - 1];
          const resultKey = getResultKey(pitches[pitches.length - 1]?.details?.description);
          if (resultKey) {
            const overlay = RESULT_OVERLAY[resultKey];
            const ringAlpha = phase === 'landing' ? (1 - ballAlpha) * 1.4 : 1;
            drawResultRing(ctx, finalPos.cx, finalPos.cy, overlay, Math.min(1, ringAlpha));

            if (phase === 'settled') {
              ctx.save();
              ctx.globalAlpha = 0.92;
              ctx.fillStyle = overlay.labelColor;
              ctx.font = FONT_LABEL;
              ctx.textAlign = 'center';
              ctx.letterSpacing = '0.12em';
              ctx.shadowColor = overlay.labelColor;
              ctx.shadowBlur = 8;
              ctx.fillText(overlay.label, W / 2, proj.szY1 - 10);
              ctx.restore();

              const n = pitches.length;
              ctx.save();
              ctx.globalAlpha = 0.9;
              ctx.fillStyle = '#fff';
              ctx.font = FONT_DOT.replace('6px', '7px');
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(n), finalPos.cx, finalPos.cy);
              ctx.restore();
            }
          }
        }
      }
    },
    [szTop, szBot, W, variant],
  );

  const animate = useCallback(
    (timestamp) => {
      const s = stateRef.current;
      if (!s.currentPoints || !s.proj) return;

      if (!s.animStart) s.animStart = timestamp;
      const elapsed = timestamp - s.animStart;

      if (s.phase === 'flying') {
        const t = Math.min(elapsed / ANIMATION_MS, 1);
        s.animProgress = t < 1 ? 1 - (1 - t) ** 2.2 : 1;
        s.ballAlpha = 1;

        if (t >= 1) {
          s.phase = 'landing';
          s.animStart = timestamp;
        }
      } else if (s.phase === 'landing') {
        const t = Math.min(elapsed / FADE_MS, 1);
        s.animProgress = 1;
        s.ballAlpha = 1 - t * 0.6;
        if (t >= 1) {
          s.phase = 'settled';
          s.ballAlpha = 0.4;
          const sk = storageKey(gamePk);
          if (sk) {
            const last = s.allPitches[s.allPitches.length - 1];
            const lid = last?.playId ?? last?.pitchNumber ?? s.allPitches.length;
            try {
              sessionStorage.setItem(sk, String(lid));
            } catch {
              /* ignore */
            }
          }
        }
      }

      renderBg(s.allPitches, s.projPointsList, s.currentPoints, s.animProgress, s.proj);
      renderFg(
        s.allPitches,
        s.projPointsList,
        s.currentPoints,
        s.animProgress,
        s.ballAlpha,
        s.phase,
        s.proj,
      );

      if (s.phase !== 'settled') {
        animRef.current = requestAnimationFrame(animate);
      }
    },
    [renderBg, renderFg, gamePk],
  );

  useEffect(() => {
    [bgRef, fgRef].forEach((ref) => {
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(DPR, DPR);
    });
  }, [W, H, DPR]);

  useEffect(() => {
    const pitches = playEvents.filter((e) => e.isPitch && hasRenderablePitchData(e.pitchData));

    if (!pitches.length) {
      const proj = makeProjector(W, H, szTop, szBot);
      const canvas = fgRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawStrikeZone(ctx, proj, szTop, szBot, variant);
      }
      const bgCanvas = bgRef.current;
      if (bgCanvas) {
        bgCanvas.getContext('2d').clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      }
      stateRef.current.prevPitchId = null;
      return;
    }

    const proj = makeProjector(W, H, szTop, szBot);
    const projPointsList = pitches.map((p, i) => projectPitchPoints(p.pitchData, proj, p, i));

    const lastPitch = pitches[pitches.length - 1];
    const pitchId = lastPitch.playId ?? lastPitch.pitchNumber ?? pitches.length;
    const pitchIdStr = String(pitchId);

    const s = stateRef.current;
    s.proj = proj;
    s.allPitches = pitches;
    s.projPointsList = projPointsList;
    s.currentPoints = projPointsList[projPointsList.length - 1];

    const sk = storageKey(gamePk);
    let storedLast = null;
    try {
      storedLast = sk ? sessionStorage.getItem(sk) : null;
    } catch {
      storedLast = null;
    }

    const samePitch =
      s.prevPitchId != null && String(s.prevPitchId) === pitchIdStr;

    if (samePitch && (s.phase === 'flying' || s.phase === 'landing')) {
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    }

    const isNewPitch =
      s.prevPitchId != null && String(s.prevPitchId) !== pitchIdStr;

    if (isNewPitch) {
      s.prevPitchId = pitchId;
      s.phase = 'flying';
      s.animProgress = 0;
      s.ballAlpha = 1;
      s.animStart = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animate);
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    }

    const hydrateSettled =
      pitches.length > 1 || (storedLast != null && storedLast === pitchIdStr);

    if (hydrateSettled) {
      s.prevPitchId = pitchId;
      s.phase = 'settled';
      s.animProgress = 1;
      s.ballAlpha = 0.4;
      s.animStart = null;
      renderBg(pitches, projPointsList, s.currentPoints, 1, proj);
      renderFg(pitches, projPointsList, s.currentPoints, 1, 0.4, 'settled', proj);
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    }

    if (samePitch) {
      s.phase = 'settled';
      s.animProgress = 1;
      s.ballAlpha = 0.4;
      renderBg(pitches, projPointsList, s.currentPoints, 1, proj);
      renderFg(pitches, projPointsList, s.currentPoints, 1, 0.4, 'settled', proj);
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    }

    // Single pitch, first visit this tab session (no stored match)
    s.prevPitchId = pitchId;
    s.phase = 'flying';
    s.animProgress = 0;
    s.ballAlpha = 1;
    s.animStart = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [
    playEvents,
    szTop,
    szBot,
    W,
    H,
    animate,
    renderBg,
    renderFg,
    projectPitchPoints,
    variant,
    gamePk,
    releaseBiasX,
    releaseBiasZ,
  ]);

  return (
    <div className={`relative ${className}`} style={{ width: W, height: H }}>
      <canvas
        ref={bgRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
      <canvas
        ref={fgRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
      {showReleaseTuner = false && (
        <div
          className="absolute left-0 bottom-0 z-10 max-w-[min(100%,220px)] rounded-tr border border-slate-600 bg-slate-950/92 px-2 py-1.5 text-[10px] leading-tight text-slate-100 shadow-lg backdrop-blur-sm"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="mb-1 font-semibold tracking-wide text-slate-300">Release tuner (ft)</div>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-400">
              Bias X (catcher L/R){' '}
              <span className="font-mono text-slate-200">{releaseBiasX.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={releaseBiasX}
              onChange={(e) => setReleaseBiasX(Number(e.target.value))}
              className="w-full accent-sky-500"
              aria-label="Release bias X feet"
            />
          </label>
          <label className="mt-1 flex flex-col gap-0.5">
            <span className="text-slate-400">
              Bias Z (up/down){' '}
              <span className="font-mono text-slate-200">{releaseBiasZ.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={-2.5}
              max={2.5}
              step={0.05}
              value={releaseBiasZ}
              onChange={(e) => setReleaseBiasZ(Number(e.target.value))}
              className="w-full accent-sky-500"
              aria-label="Release bias Z feet"
            />
          </label>
          {tunerReadout ? (
            <dl className="mt-2 space-y-0.5 border-t border-slate-700 pt-1.5 font-mono text-[9px] text-slate-300">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">branch</dt>
                <dd className="text-sky-300">{tunerReadout.branch}</dd>
              </div>
              {tunerReadout.missingTraj ? (
                <p className="text-slate-500">Trajectory build failed for this payload.</p>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">raw start</dt>
                    <dd>
                      x{tunerReadout.rawStart.x.toFixed(2)} z{tunerReadout.rawStart.z.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">w/ bias start</dt>
                    <dd>
                      x{tunerReadout.biasedStart.x.toFixed(2)} z{tunerReadout.biasedStart.z.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">plate end</dt>
                    <dd>
                      x{tunerReadout.rawEnd.x.toFixed(2)} z{tunerReadout.rawEnd.z.toFixed(2)}
                    </dd>
                  </div>
                </>
              )}
              <div className="mt-1 text-[8px] leading-snug text-slate-500">
                Code hints: MOUND_Y={MOUND_Y} PLATE_Y={PLATE_FRONT_Y} · fallback release X/Z=
                {PITCH_TRAIL_FALLBACK_RELEASE_X_FT}/{PITCH_TRAIL_FALLBACK_RELEASE_Z_FT} · taper full→0
                mound→plate
              </div>
              {tunerReadout.api && (
                <div className="mt-1 text-[8px] text-slate-500">
                  API pX={tunerReadout.api.pX ?? '—'} pZ={tunerReadout.api.pZ ?? '—'} y0=
                  {tunerReadout.api.y0 ?? '—'} z0={tunerReadout.api.z0 ?? '—'}
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-1 text-[9px] text-slate-500">No pitch with coords yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
