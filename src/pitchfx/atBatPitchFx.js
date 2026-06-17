/**
 * Port of MLB Gameday `responsive-pitch-fx` (from mlb-atbat-data / gd.min.js).
 * Coordinate math, strike-zone layout, and pitch rendering match At Bat defaults.
 */

import { getPitchResultKind } from '../utils/liveRecentPlays';

const BASE_FOOT = 12;
const PIXEL_FOOT = 75;
const EYE_TO_SCREEN = 10;
/** Plate width in feet (17 inches). gd.min.js: `r = 17/12` */
export const STRIKE_ZONE_WIDTH_FT = 17 / BASE_FOOT;
/** Zone depth in feet (8.5 inches). gd.min.js: `a = 8.5/12` */
export const STRIKE_ZONE_DEPTH_FT = 8.5 / BASE_FOOT;
const PLATE_WIDTH_FT = STRIKE_ZONE_WIDTH_FT;
const GD5_OFFSET = 133;
const PERSPECTIVE_SHIFT_Y = 186;
const STRIKE_ZONE_PITCH_NUMBER_FONT_SIZE = 10;
const FULL_VIEW_PITCH_NUMBER_FONT_SIZE = 9;
const PITCH_NUMBER_RADIUS_SCALE = 1.15;

export const AT_BAT_BALL_COLORS = {
  ballColorStrike: 'rgba(198, 27, 43, 1)',
  ballColorBall: 'rgba(9, 131, 20, 1)',
  ballColorInPlay: 'rgba(0, 98, 227, 1)',
  ballColorInPlayOuts: 'rgba(119, 86, 179, 1)',
  ballStrokeColor: 'rgba(255, 255, 255, 0.8)',
  ballTextColor: 'rgba(255, 255, 255, 1)',
};

/** Trail colors by pitch type — from MLB live feed `details.trailColor`. */
export const AT_BAT_PITCH_TRAIL_COLORS = {
  FF: 'rgba(188, 0, 33, 1.0)',
  FA: 'rgba(188, 0, 33, 1.0)',
  FT: 'rgba(188, 0, 33, 1.0)',
  FC: 'rgba(152, 0, 101, 1.0)',
  FS: 'rgba(119, 0, 152, 1.0)',
  SI: 'rgba(50, 0, 221, 1.0)',
  SL: 'rgba(0, 0, 254, 1.0)',
  CU: 'rgba(0, 34, 255, 1.0)',
  KC: 'rgba(153, 171, 0, 1.0)',
  CH: 'rgba(0, 85, 254, 1.0)',
  ST: 'rgba(50, 50, 50, 1.0)',
  SV: 'rgba(50, 50, 50, 1.0)',
  KN: 'rgba(50, 50, 50, 1.0)',
  EP: 'rgba(0, 85, 254, 1.0)',
};

/**
 * Strike-zone viewport. MLB's original crop is about 220px wide; we keep the
 * zone math the same but show more side padding so chase pitches do not clip.
 * LiveAtBatVisual positions this viewport as a percentage of MLB's 1158px
 * field width, so changing width here also changes the live zone's visual size.
 */
export const AT_BAT_STRIKE_ZONE_CLIP = { width: 340, height: 290 };

/** Internal render width — must match MLB `fixed_width: 960` or the zone shrinks. */
export const AT_BAT_FIXED_WIDTH = 960;
export const AT_BAT_BALL_SIZE = 2.9;
export const AT_BAT_STRIKE_ZONE_BALL_SIZE = 3.15;

export const AT_BAT_STRIKE_ZONE_VIEW = {
  mode: '3d',
  clip: AT_BAT_STRIKE_ZONE_CLIP,
  fontSize: 92,
  ballSize: AT_BAT_STRIKE_ZONE_BALL_SIZE,
  canvasDensity: 1,
};

const DEFAULT_CONFIG = {
  base_width: 1158,
  base_height: 869,
  pixelFoot: PIXEL_FOOT,
  foot: BASE_FOOT,
  eyeToScreen: EYE_TO_SCREEN,
  homePlateWidth: PLATE_WIDTH_FT,
  homePlateFrontY: PLATE_WIDTH_FT,
  ballSize: AT_BAT_BALL_SIZE,
  fontSize: 80,
  x_center: 0.5,
  y_center: 0.5,
  x_offset: 0,
  y_offset: PERSPECTIVE_SHIFT_Y + GD5_OFFSET / 5,
  viewBottomMargin: PERSPECTIVE_SHIFT_Y + GD5_OFFSET,
  perspectiveShiftY: PERSPECTIVE_SHIFT_Y,
  interpolatedPlateFront: PLATE_WIDTH_FT * PIXEL_FOOT,
  adjust2d: {
    width: 1.14,
    x: PLATE_WIDTH_FT,
    y: PLATE_WIDTH_FT,
    margin: -30 / 869,
  },
  strikeZone: { szBot: 1.47, szTop: 3.55 },
  defaultStrikeZone: false,
  szBorder: 8,
  hotColdZoneGridStroke: 1,
  hotColdZoneColorOpacity: 0.5,
  hotColdZoneGridOpacity: 1,
  hotColdZoneDefaultColor: 'rgba(255, 255, 255, 1)',
  hotColdZoneGridColor: 'rgba(0, 0, 0, 1)',
  hotColdZoneBorderColor: 'rgba(0, 0, 0, 1)',
  numberOfAnimationPoints: 1000 / 40,
  timing: 1000 / 36,
  perspective: 'catcher',
  mode: '3d',
  canvasDensity: typeof window !== 'undefined' ? Number((window.devicePixelRatio || 2).toFixed(2)) : 2,
  ...AT_BAT_BALL_COLORS,
};

function precision(num) {
  return Number(num.toFixed(8));
}

function floatCoords(coords = {}) {
  const out = {};
  for (const [key, val] of Object.entries(coords)) {
    out[key] = parseFloat(val);
    out[key.toLowerCase()] = parseFloat(val);
  }
  return out;
}

/**
 * Per-pitch strike zone dimensions — gd.min.js:
 * `width: u ? u/12 : r`, `depth: c ? c/12 : a` (inches → feet).
 */
export function resolveStrikeZoneDims(pitchData, batter = null) {
  const pd = pitchData || {};
  if (pd.strikeZoneTop != null || pd.strikeZoneBottom != null) {
    const widthIn = pd.strikeZoneWidth;
    const depthIn = pd.strikeZoneDepth;
    return {
      szTop: pd.strikeZoneTop,
      szBot: pd.strikeZoneBottom,
      szWidth: widthIn ? widthIn / BASE_FOOT : PLATE_WIDTH_FT,
      szDepth: depthIn ? depthIn / BASE_FOOT : STRIKE_ZONE_DEPTH_FT,
    };
  }
  if (batter?.strikeZoneTop != null && batter?.strikeZoneBottom != null) {
    return {
      szTop: batter.strikeZoneTop,
      szBot: batter.strikeZoneBottom,
      szWidth: PLATE_WIDTH_FT,
      szDepth: STRIKE_ZONE_DEPTH_FT,
    };
  }
  return {
    szTop: DEFAULT_CONFIG.strikeZone.szTop,
    szBot: DEFAULT_CONFIG.strikeZone.szBot,
    szWidth: PLATE_WIDTH_FT,
    szDepth: STRIKE_ZONE_DEPTH_FT,
  };
}

export function createScaler(width, overrides = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...overrides };
  const w = width || cfg.base_width;
  const h = (w / cfg.base_width) * cfg.base_height;
  const relativeXScale = cfg.pixelFoot / cfg.base_width;
  const relativeYScale = cfg.pixelFoot / cfg.base_height;
  const x = relativeXScale * w;
  const y = relativeYScale * h;
  const viewBottomMargin = (cfg.viewBottomMargin / cfg.base_height) * h;
  const x_offset = (cfg.x_offset / cfg.base_width) * w;
  const y_offset = (cfg.y_offset / cfg.base_height) * h;

  const fullBounds = { left: 0, right: w, top: 0, bottom: h };
  let bounds = fullBounds;
  const clip = cfg.clip;
  if (clip?.width && clip?.height) {
    const centerx = w * cfg.x_center;
    const centery = h * cfg.y_center + viewBottomMargin / 2;
    const density = cfg.canvasDensity > 1 ? cfg.canvasDensity : 1;
    const xbound = ((clip.width * density) || w) / 2;
    const ybound = ((clip.height * density) || h) / 2;
    bounds = {
      left: centerx - xbound,
      right: centerx + xbound,
      top: centery - ybound,
      bottom: centery + ybound,
    };
  }

  return {
    ...cfg,
    eyetoScreen: cfg.eyeToScreen,
    width: w,
    height: h,
    x,
    y,
    relativeXScale,
    relativeYScale,
    viewBottomMargin,
    x_offset,
    y_offset,
    fakeBallSize: (cfg.ballSize / cfg.foot / 2) * y,
    ballRadius: (cfg.ballSize / cfg.foot / 2) * x,
    maxlinewidth: (cfg.ballSize / cfg.foot / 2) * y * 2,
    szBorder: (cfg.szBorder / cfg.base_width) * w,
    hotColdZoneGridStroke: cfg.hotColdZoneGridStroke * (cfg.canvasDensity > 1 ? cfg.canvasDensity : 1),
    fullBounds,
    bounds,
    cropWidth: bounds.right - bounds.left,
    cropHeight: bounds.bottom - bounds.top,
  };
}

function positionAtTime(coords, axis, t) {
  const p0 = coords[`${axis}0`];
  const vp0 = coords[`v${axis}0`];
  const ap = coords[`a${axis}`];
  if (p0 == null || Number.isNaN(p0)) return coords[axis];
  return p0 + vp0 * t + 0.5 * ap * t * t;
}

function pointOnGrid(scalers, x, y, z) {
  const eye = scalers.eyetoScreen ?? scalers.eyeToScreen;
  const newY = (((scalers.height - scalers.viewBottomMargin) / scalers.y) * scalers.y_center) - y;
  const perspectiveX = x * (eye / Math.abs(eye - z));
  const perspectiveY = newY * (eye / Math.abs(eye - z));
  const perspectiveRad = (x + scalers.ballSize / 12 / 2) * (eye / Math.abs(eye - z));

  let screenX = perspectiveX * scalers.x + scalers.width * scalers.x_center;
  let screenY = perspectiveY * scalers.y + scalers.height * scalers.y_center - scalers.viewBottomMargin + scalers.y_offset;
  const screenRad = perspectiveRad * scalers.x + scalers.width * scalers.x_center;

  const bounds = scalers.fullBounds;
  screenX = Math.min(Math.max(screenX, bounds.left), bounds.right);
  screenY = Math.min(Math.max(screenY, bounds.top), bounds.bottom);

  return [precision(screenX), precision(screenY), precision(z * scalers.x - scalers.viewBottomMargin), 0.1, screenRad - screenX];
}

function timeAtYPosition(coords, yPosition) {
  const a = -1 * coords.vy0;
  const b = Math.sqrt(coords.vy0 * coords.vy0 - 2 * coords.ay * (coords.y0 - yPosition));
  const time1 = (a + b) / coords.ay;
  const time2 = (a - b) / coords.ay;
  return Math.min(time1, time2);
}

function points3D(pitch, scalers, step, numberOfPoints) {
  const coords = pitch.coords;
  const time = step * (timeAtYPosition(coords, pitch.szDepth) / numberOfPoints);
  const x = positionAtTime(coords, 'x', time);
  const y = positionAtTime(coords, 'z', time);
  const z = -positionAtTime(coords, 'y', time) || 0.1;

  if (y <= 0.01) return null;

  const startSpeed = pitch.startSpeed || 95;
  const endSpeed = pitch.endSpeed || startSpeed * 0.92;
  const speedChange = startSpeed - endSpeed;
  const widthAdjuster = Math.pow((scalers.ballRadius) / speedChange / numberOfPoints * Math.pow(step, 2), 0.8);

  const point = pointOnGrid(scalers, x, y, z);
  point[3] = Math.min(widthAdjuster, scalers.maxlinewidth);
  return point;
}

function pitchNumberFontSize(scalers, radius) {
  const baseFontSize = (scalers.fontSize / scalers.base_width) * scalers.fakeBallSize * 0.72;
  const minFontSize = scalers.clip
    ? STRIKE_ZONE_PITCH_NUMBER_FONT_SIZE
    : FULL_VIEW_PITCH_NUMBER_FONT_SIZE;
  return Math.max(baseFontSize, radius * PITCH_NUMBER_RADIUS_SCALE, minFontSize);
}

function points2D(pitch, scalers) {
  const coords = pitch.coords;
  if (pitch.is3DPitch) {
    // MLB's physical axes:
    // x = horizontal distance from plate center
    // y = distance from home plate toward the mound
    // z = vertical height above the ground
    //
    // Place the dot where the trajectory intersects the strike-zone depth
    // plane instead of using pX/pZ, which reference a different plate plane.
    const time = timeAtYPosition(coords, pitch.szDepth);
    const plateX = positionAtTime(coords, 'x', time);
    const plateZ = positionAtTime(coords, 'z', time);
    if (Number.isFinite(plateX) && Number.isFinite(plateZ)) {
      return pointOnGrid(scalers, plateX, plateZ, -pitch.szDepth);
    }
  }

  // pX/pZ share the same physical coordinate space as the strike zone.
  if (Number.isFinite(coords.pX) && Number.isFinite(coords.pZ)) {
    return pointOnGrid(scalers, coords.pX, coords.pZ, -pitch.szDepth);
  }

  // Fall back to MLB's legacy pre-rasterized coordinate pair when needed.
  if (Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
    const screenX = (-coords.x / scalers.pixelFoot + scalers.adjust2d.x) * scalers.adjust2d.x;
    const screenY = ((-coords.y + scalers.perspectiveShiftY + scalers.interpolatedPlateFront) / scalers.pixelFoot) * scalers.adjust2d.y;
    return pointOnGrid(scalers, screenX, screenY, 0);
  }
  return null;
}

const IN_PLAY_CODES = new Set(['X', 'Y', 'D', 'E', 'J']);
const BALL_CODES = new Set(['B', 'I', 'P', '*B']);

export function inferPitchResult(event) {
  const details = event?.details || {};
  if (details.isInPlay) return { isInPlay: true, isBall: false, isStrike: false };
  if (details.isBall) return { isBall: true, isStrike: false, isInPlay: false };
  if (details.isStrike) return { isBall: false, isStrike: true, isInPlay: false };

  const code = details.code;
  if (code && IN_PLAY_CODES.has(code)) {
    return { isInPlay: true, isBall: false, isStrike: false };
  }
  if (code && BALL_CODES.has(code)) {
    return { isBall: true, isStrike: false, isInPlay: false };
  }

  const desc = details.description || details.call?.description || '';
  const kind = getPitchResultKind(desc, false);
  if (kind === 'in_play') return { isInPlay: true, isBall: false, isStrike: false };
  if (kind === 'ball') return { isBall: true, isStrike: false, isInPlay: false };
  return { isBall: false, isStrike: true, isInPlay: false };
}

export function buildPitchFromEvent(event, pitchNumber, batter = null) {
  const pitchData = event.pitchData;
  if (!pitchData?.coordinates) return null;

  const coords = floatCoords(pitchData.coordinates);
  const details = event.details || {};
  const result = inferPitchResult(event);
  const has3d = !!(coords.y0 && coords.x0 && coords.z0);
  const sz = resolveStrikeZoneDims(pitchData, batter);

  return {
    event,
    coords,
    details,
    isPitch: true,
    isBall: result.isBall,
    isStrike: result.isStrike,
    isInPlay: result.isInPlay,
    code: details.code,
    startSpeed: pitchData.startSpeed,
    endSpeed: pitchData.endSpeed,
    spinRate: pitchData.breaks?.spinRate ?? null,
    spinDirection: pitchData.breaks?.spinDirection ?? null,
    szTop: sz.szTop,
    szBot: sz.szBot,
    szWidth: sz.szWidth,
    szDepth: sz.szDepth,
    num: pitchNumber,
    is3DPitch: has3d,
    type: details.type?.code || '',
    trailColor: details.trailColor || null,
    ballColor: details.ballColor || null,
    result: details.description || '',
  };
}

export function getPitchTrailColor(pitch) {
  if (pitch.trailColor) return pitch.trailColor;
  if (pitch.details?.trailColor) return pitch.details.trailColor;
  if (pitch.type && AT_BAT_PITCH_TRAIL_COLORS[pitch.type]) {
    return AT_BAT_PITCH_TRAIL_COLORS[pitch.type];
  }
  return 'rgba(255, 255, 255, 1)';
}

export function buildPitchTrajectory(pitch, scalers) {
  if (!pitch.is3DPitch || scalers.mode === '2d') {
    const pt = points2D(pitch, scalers);
    return pt ? [pt] : [];
  }

  const n = Math.floor(scalers.numberOfAnimationPoints);
  const points = [];
  for (let step = 1; step <= n; step += 1) {
    const pt = points3D(pitch, scalers, step, n);
    if (pt == null) break;
    points.push(pt);
  }
  return points;
}

function strikeZoneCorners(pitch, scalers) {
  const sz = pitch.szTop != null && pitch.szBot != null && !scalers.defaultStrikeZone
    ? { szTop: pitch.szTop, szBot: pitch.szBot }
    : scalers.strikeZone;
  const half = pitch.szWidth / 2;

  const topLeft = pointOnGrid(scalers, -half, sz.szTop, -pitch.szDepth);
  const bottomRight = pointOnGrid(scalers, half, sz.szBot, -pitch.szDepth);
  return { topLeft, bottomRight, sz };
}

/**
 * Crop viewport centered on the strike zone (white + black border).
 * MLB's default bounds use viewBottomMargin and crop the top ~85px in 2d mode;
 * At Bat live view instead CSS-shifts the field (`translate(-50%, -67%)`).
 */
export function computeAtBatStrikeZoneCrop(scaler, pitch) {
  const { topLeft, bottomRight } = strikeZoneCorners(pitch, scaler);
  const szBorder = scaler.szBorder;
  const zoneLeft = topLeft[0] - szBorder;
  const zoneTop = topLeft[1] - szBorder;
  const zoneW = bottomRight[0] - topLeft[0] + szBorder * 2;
  const zoneH = bottomRight[1] - topLeft[1] + szBorder * 2;
  const zoneCx = zoneLeft + zoneW / 2;
  const zoneCy = zoneTop + zoneH / 2;

  const clip = scaler.clip || AT_BAT_STRIKE_ZONE_CLIP;
  return {
    x: zoneCx - clip.width / 2,
    y: zoneCy - clip.height / 2,
    w: clip.width,
    h: clip.height,
  };
}

function shiftGradientColor(fill) {
  return fill.replace(/(\d+),/g, (_, n) => `${Math.max(0, Number(n) - 120)},`);
}

export function getPitchShader(pitch, scalers) {
  let ballKey = null;
  if (pitch.isBall) ballKey = 'ballColorBall';
  else if (pitch.isStrike) ballKey = 'ballColorStrike';
  else if (pitch.isInPlay) {
    ballKey = 'ballColorInPlay';
    if ((pitch.code === 'X' || pitch.code === 'Y') && scalers.ballColorInPlayOuts) {
      ballKey = 'ballColorInPlayOuts';
    }
  }

  const fill = getPitchTrailColor(pitch);
  const ball = pitch.ballColor || pitch.details?.ballColor
    || (ballKey ? scalers[ballKey] : fill);

  return {
    fill,
    ball,
    ballStroke: scalers.ballStrokeColor,
    text: scalers.ballTextColor,
    gradientStart: shiftGradientColor(fill),
    gradientStop: fill,
  };
}

export function drawAtBatStrikeZone(ctx, pitch, scalers) {
  const { topLeft, bottomRight } = strikeZoneCorners(pitch, scalers);
  const szBorder = scalers.szBorder;
  // MLB's hot/cold outlier frame extends two border units beyond the zone.
  const outerBorder = szBorder * 2;
  const x = topLeft[0] - outerBorder;
  const y = topLeft[1] - outerBorder;
  const boundX = bottomRight[0] - topLeft[0] + outerBorder * 2;
  const boundY = bottomRight[1] - topLeft[1] + outerBorder * 2;
  const strokeWidth = scalers.hotColdZoneGridStroke;

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = scalers.hotColdZoneColorOpacity;
  ctx.lineWidth = strokeWidth;
  ctx.fillStyle = scalers.hotColdZoneDefaultColor;
  ctx.fillRect(x, y, boundX, boundY);
  ctx.globalAlpha = scalers.hotColdZoneGridOpacity;
  ctx.strokeStyle = scalers.hotColdZoneBorderColor;
  ctx.strokeRect(x, y, boundX, boundY);

  ctx.clearRect(topLeft[0] - 1, topLeft[1] - 1, bottomRight[0] - topLeft[0] + 2, bottomRight[1] - topLeft[1] + 2);

  ctx.globalAlpha = scalers.hotColdZoneColorOpacity;
  ctx.fillStyle = scalers.hotColdZoneDefaultColor;
  ctx.fillRect(topLeft[0], topLeft[1], bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]);
  ctx.globalAlpha = scalers.hotColdZoneGridOpacity;
  ctx.strokeStyle = scalers.hotColdZoneGridColor;
  ctx.strokeRect(topLeft[0], topLeft[1], bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]);

  for (let i = 1; i <= 2; i += 1) {
    const xg = topLeft[0] + ((bottomRight[0] - topLeft[0]) * i) / 3;
    const yg = topLeft[1] + ((bottomRight[1] - topLeft[1]) * i) / 3;
    ctx.beginPath();
    ctx.moveTo(xg, topLeft[1]);
    ctx.lineTo(xg, bottomRight[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(topLeft[0], yg);
    ctx.lineTo(bottomRight[0], yg);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  return { topLeft, bottomRight };
}

export function drawAtBatTrail(ctx, points, shader, fromIdx, toIdx) {
  if (toIdx <= fromIdx || points.length < 2) return;

  const start = points[fromIdx];
  const end = points[toIdx];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = fromIdx + 1; i <= toIdx; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const width = Math.max(0.8, next[3] || 2);
    const t = (i - fromIdx) / Math.max(1, toIdx - fromIdx);

    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(next[0], next[1]);
    ctx.globalAlpha = Math.min(1, 0.35 + t * 0.65);
    ctx.lineWidth = width;
    ctx.strokeStyle = shader.fill;
    ctx.stroke();
  }

  const grad = ctx.createLinearGradient(start[0], start[1], end[0], end[1]);
  grad.addColorStop(0, shader.gradientStart);
  grad.addColorStop(0.25, shader.gradientStop);
  for (let i = fromIdx + 1; i <= toIdx; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const width = Math.max(0.8, next[3] || 2);
    const t = (i - fromIdx) / Math.max(1, toIdx - fromIdx);

    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(next[0], next[1]);
    ctx.globalAlpha = Math.min(1, 0.35 + t * 0.65);
    ctx.lineWidth = width;
    ctx.strokeStyle = grad;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAtBatBall(ctx, point, pitch, scalers, shader, alpha = 1) {
  if (!point) return;
  const [x, y] = point;
  const radius = point[4] || scalers.ballRadius;
  const strokeWidth = (scalers.canvasDensity > 1 ? scalers.canvasDensity : 1) * 1;
  const safeStroke = radius - strokeWidth / 2;
  const fontSize = pitchNumberFontSize(scalers, radius);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'source-over';

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = shader.ball;
  ctx.fill();
  ctx.closePath();

  ctx.font = `bold ${fontSize}px Helvetica Neue, Helvetica, Arial, sans-serif`;
  ctx.fillStyle = shader.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, fontSize * 0.18);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.strokeText(String(pitch.num ?? ''), x, y);
  ctx.fillText(String(pitch.num ?? ''), x, y);

  ctx.beginPath();
  ctx.arc(x, y, safeStroke, 0, Math.PI * 2);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = shader.ballStroke;
  ctx.stroke();
  ctx.restore();
}

function drawBaseballSeam(ctx, radius, offset, rotation, flip = 1) {
  ctx.save();
  ctx.rotate(rotation);
  ctx.scale(flip, 1);
  ctx.beginPath();
  ctx.ellipse(offset, 0, radius * 0.34, radius * 0.94, 0, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.strokeStyle = 'rgba(185, 28, 28, 0.95)';
  ctx.stroke();

  // Tiny stitch marks sell the spin without needing a bitmap sprite.
  ctx.lineWidth = Math.max(0.7, radius * 0.055);
  for (let i = -3; i <= 3; i += 1) {
    const y = (i / 3) * radius * 0.62;
    const x = offset + Math.cos((y / radius) * 1.1) * radius * 0.18;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.14, y - radius * 0.05);
    ctx.lineTo(x + radius * 0.14, y + radius * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function pitchSpinDirection(pitch) {
  const type = pitch?.type || pitch?.details?.type?.code || '';
  if (type === 'CU' || type === 'KC' || type === 'SV') return 1;
  return -1;
}

export function drawAtBatSpinningBaseball(ctx, point, progress, scalers, pitch = null, alpha = 1) {
  if (!point) return;
  const [x, y] = point;
  const depthRadius = point[4] || scalers.ballRadius;
  const landedRadius = Math.max(scalers.ballRadius, scalers.clip ? 8 : 5);
  const radius = Math.max(depthRadius, landedRadius * 0.28);
  const spin = progress * Math.PI * 100 * pitchSpinDirection(pitch);
  const seamTravel = Math.sin(spin) * radius * 0.2;
  const squash = 0.82 + Math.abs(Math.cos(spin)) * 0.18;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(squash, 1);

  const grad = ctx.createRadialGradient(
    -radius * 0.34,
    -radius * 0.42,
    radius * 0.08,
    0,
    0,
    radius,
  );
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.56, 'rgba(244, 241, 231, 1)');
  grad.addColorStop(1, 'rgba(184, 176, 158, 1)');

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();

  drawBaseballSeam(ctx, radius, -radius * 0.48 + seamTravel, spin * 0.16, 1);
  drawBaseballSeam(ctx, radius, radius * 0.48 + seamTravel, -spin * 0.16, -1);

  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, radius * 0.1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.stroke();
  ctx.restore();
}

export function drawAtBatPitchDot(ctx, point, pitch, scalers, shader, alpha = 0.55) {
  if (!point) return;
  const [x, y] = point;
  const radius = point[4] || scalers.ballRadius;
  const strokeWidth = (scalers.canvasDensity > 1 ? scalers.canvasDensity : 1) * 1;
  const fontSize = pitchNumberFontSize(scalers, radius);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = shader.ball;
  ctx.fill();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = shader.ballStroke;
  ctx.stroke();
  ctx.fillStyle = shader.text;
  ctx.font = `bold ${fontSize}px Helvetica Neue, Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, fontSize * 0.18);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.strokeText(String(pitch.num ?? ''), x, y);
  ctx.fillText(String(pitch.num ?? ''), x, y);
  ctx.restore();
}

export function hasRenderablePitchData(pitchData) {
  const c = pitchData?.coordinates;
  if (!c) return false;
  if (c.x0 != null && c.y0 != null && c.z0 != null) return true;
  if (c.x != null && c.y != null) return true;
  if (c.pX != null && c.pZ != null) return true;
  return false;
}

export const AT_BAT_ANIMATION_MS = Math.floor(DEFAULT_CONFIG.numberOfAnimationPoints * DEFAULT_CONFIG.timing);
