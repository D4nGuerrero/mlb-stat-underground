// At Bat pitch visualization — port of MLB Gameday responsive-pitch-fx.

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createScaler,
  buildPitchFromEvent,
  buildPitchTrajectory,
  getPitchShader,
  drawAtBatStrikeZone,
  drawAtBatHotZones,
  drawAtBatTrail,
  drawAtBatBall,
  drawAtBatSpinningBaseball,
  drawAtBatPitchDot,
  hasRenderablePitchData,
  AT_BAT_ANIMATION_MS,
  AT_BAT_FIXED_WIDTH,
  AT_BAT_STRIKE_ZONE_CLIP,
  AT_BAT_STRIKE_ZONE_VIEW,
  computeAtBatStrikeZoneCrop,
  resolveStrikeZoneDims,
} from '../pitchfx/atBatPitchFx';

const TRAIL_OPACITY = 0.8;
const OLD_PITCH_ALPHA = 0.82;
const TRUE_SPIN_RADIANS_PER_MS_PER_RPM = (Math.PI * 2) / 60_000;
const DEG_90 = Math.PI / 2;

function normalizedAxisMix(mix = {}) {
  const x = Number(mix.x || 0);
  const y = Number(mix.y || 0);
  const z = Number(mix.z || 0);
  const total = Math.abs(x) + Math.abs(y) + Math.abs(z);
  if (!total) return { x: 1, y: 0, z: 0 };
  return { x: x / total, y: y / total, z: z / total };
}

function pitchSpinProfile(pitch) {
  const type = pitch?.type || pitch?.details?.type?.code || '';
  const rpm = Number(pitch?.spinRate) || null;

  if (type === 'CU' || type === 'KC') {
    return {
      axisMix: { x: 1, y: 0, z: 0 },
      direction: 1,
      rpm: rpm || 2600,
      startRotation: { x: DEG_90, y: DEG_90, z: DEG_90 },
    };
  }
  if (type === 'SL' || type === 'ST' || type === 'SV') {
    return {
      axisMix: { x: 0, y: 0.4, z: 0.6 },
      direction: -1,
      rpm: rpm || 2500,
      startRotation: { x: 0, y: 0, z: 0 },
    };
  }
  if (type === 'CH' || type === 'FS') {
    return {
      axisMix: { x: 1, y: 0, z: 0 },
      direction: -1,
      rpm: rpm || 1900,
      startRotation: { x: 0, y: 0, z: DEG_90 },
    };
  }
  return {
    axisMix: { x: 1, y: 0, z: 0 },
    direction: -1,
    rpm: rpm || 2400,
    startRotation: { x: 0, y: 0, z: DEG_90 },
  };
}

function lerp(a = 0, b = 0, t = 0) {
  return a + (b - a) * t;
}

function interpolateTrajectoryPoint(traj, progress) {
  if (!traj?.length) return null;
  if (traj.length === 1) return traj[0];
  const exact = Math.min(Math.max(progress, 0), 1) * (traj.length - 1);
  const fromIdx = Math.floor(exact);
  const toIdx = Math.min(fromIdx + 1, traj.length - 1);
  const t = exact - fromIdx;
  const from = traj[fromIdx];
  const to = traj[toIdx];
  return [
    lerp(from[0], to[0], t),
    lerp(from[1], to[1], t),
    lerp(from[2], to[2], t),
    lerp(from[3], to[3], t),
    lerp(from[4], to[4], t),
  ];
}

function trajectoryThroughProgress(traj, progress) {
  if (!traj?.length) return [];
  const point = interpolateTrajectoryPoint(traj, progress);
  if (!point) return [];
  const exact = Math.min(Math.max(progress, 0), 1) * (traj.length - 1);
  const endIdx = Math.max(0, Math.floor(exact));
  const points = traj.slice(0, endIdx + 1);
  const last = points[points.length - 1];
  if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
  return points;
}

function mapPointToCanvas(point, crop, width, height) {
  if (!point) return null;
  if (!crop) return { x: point[0], y: point[1], scaleX: 1, scaleY: 1 };
  return {
    x: (point[0] - crop.x) * (width / crop.w),
    y: (point[1] - crop.y) * (height / crop.h),
    scaleX: width / crop.w,
    scaleY: height / crop.h,
  };
}

function storageKey(gamePk) {
  return gamePk != null ? `mlbPc:lastPitch:${gamePk}` : null;
}

export default function PitchCanvas({
  playEvents = [],
  szTop = 3.55,
  szBot = 1.47,
  width = 300,
  height = null,
  className = '',
  gamePk = null,
  responsive = false,
  viewMode = 'full',
  showPitchTrails = false,
  showHotZones = false,
  usePurpleInPlayOuts = false,
  onPitchLanded,
  baseballModelUrl = null,
}) {
  const strikeZoneView = viewMode === 'strikeZone';
  const containerRef = useRef(null);
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const modelCanvasRef = useRef(null);
  const animRef = useRef(null);
  const animateRef = useRef(null);
  const onPitchLandedRef = useRef(onPitchLanded);
  const threeRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(() => (responsive ? null : width));
  const stateRef = useRef({
    prevPitchId: null,
    landedPitchId: null,
    animProgress: 1,
    phase: 'idle',
    animStart: null,
    scaler: null,
    pitches: [],
    trajectories: [],
    currentTrajectory: null,
  });

  useEffect(() => {
    onPitchLandedRef.current = onPitchLanded;
  }, [onPitchLanded]);

  useEffect(() => {
    if (!responsive) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setMeasuredWidth(Math.max(1, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, width, strikeZoneView]);

  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const baseWidth = width ?? (strikeZoneView ? AT_BAT_STRIKE_ZONE_CLIP.width : 300);
  const baseHeight = height ?? (strikeZoneView ? AT_BAT_STRIKE_ZONE_CLIP.height : Math.round((baseWidth / 1158) * 869));
  const W = responsive ? (measuredWidth ?? baseWidth) : baseWidth;
  const H = responsive
    ? Math.round((W / baseWidth) * baseHeight)
    : baseHeight;

  useEffect(() => {
    if (!baseballModelUrl || !modelCanvasRef.current) return undefined;

    const canvas = modelCanvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, W, H, 0, -1000, 1000);
    camera.position.z = 100;

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(-2, -3, 5);
    scene.add(keyLight);

    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const state = {
      renderer,
      scene,
      camera,
      group,
      model: null,
      disposed: false,
    };
    threeRef.current = state;

    const loader = new GLTFLoader();
    loader.load(baseballModelUrl, (gltf) => {
      if (state.disposed) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      model.position.sub(center);
      model.scale.setScalar(1 / maxDim);
      group.add(model);
      state.model = model;
      renderer.render(scene, camera);
    });

    return () => {
      state.disposed = true;
      if (threeRef.current === state) threeRef.current = null;
      renderer.dispose();
    };
  }, [baseballModelUrl, W, H, DPR]);

  const scaler = useMemo(() => {
    const overrides = { usePurpleInPlayOuts };
    if (strikeZoneView) {
      return createScaler(AT_BAT_FIXED_WIDTH, { ...AT_BAT_STRIKE_ZONE_VIEW, ...overrides });
    }
    return createScaler(W, overrides);
  }, [W, strikeZoneView, usePurpleInPlayOuts]);

  const pitches = useMemo(() => {
    const list = [];
    let n = 0;
    for (const [eventIdx, ev] of playEvents.entries()) {
      if (!ev.isPitch || !hasRenderablePitchData(ev.pitchData)) continue;
      n += 1;
      const pitch = buildPitchFromEvent(ev, n, null, playEvents, eventIdx);
      if (pitch) {
        pitch.playScored = Boolean(
          ev.__playScored ||
          ev.__playContext?.about?.isScoringPlay ||
          ev.__playContext?.about?.hasScoreChange ||
          ev.__playContext?.result?.isScoringPlay,
        );
      }
      if (pitch) list.push(pitch);
    }
    return list;
  }, [playEvents]);

  const refPitchForCrop = useMemo(() => resolveStrikeZoneDims({
    strikeZoneTop: szTop,
    strikeZoneBottom: szBot,
  }), [szTop, szBot]);

  const crop = useMemo(() => {
    if (!strikeZoneView) return null;
    const ref = pitches.length
      ? pitches[pitches.length - 1]
      : refPitchForCrop;
    const baseCrop = computeAtBatStrikeZoneCrop(scaler, ref);
    const pitchPoints = pitches
      .map((pitch) => {
        const traj = buildPitchTrajectory(pitch, scaler);
        return traj?.[traj.length - 1] ?? null;
      })
      .filter(Boolean);
    if (!pitchPoints.length) return baseCrop;

    const pad = 28;
    let left = baseCrop.x;
    let top = baseCrop.y;
    let right = baseCrop.x + baseCrop.w;
    let bottom = baseCrop.y + baseCrop.h;
    for (const point of pitchPoints) {
      const r = point[4] || scaler.ballRadius || 8;
      left = Math.min(left, point[0] - r - pad);
      right = Math.max(right, point[0] + r + pad);
      top = Math.min(top, point[1] - r - pad);
      bottom = Math.max(bottom, point[1] + r + pad);
    }
    return {
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
    };
  }, [strikeZoneView, scaler, pitches, refPitchForCrop]);

  const trajectories = useMemo(
    () => pitches.map((p) => buildPitchTrajectory(p, scaler)),
    [pitches, scaler],
  );

  const setupCanvas = useCallback(
    (canvas) => {
      if (!canvas) return null;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (crop) {
        const sx = W / crop.w;
        const sy = H / crop.h;
        ctx.scale(sx, sy);
        ctx.translate(-crop.x, -crop.y);
      }
      return ctx;
    },
    [W, H, DPR, crop],
  );

  const renderBg = useCallback(
    (pitchList, trajList, currentIdx, progress) => {
      const ctx = setupCanvas(bgRef.current);
      if (!ctx) return;
      ctx.clearRect(crop?.x ?? 0, crop?.y ?? 0, crop?.w ?? W, crop?.h ?? H);
      if (!showPitchTrails) return;
      ctx.globalAlpha = TRAIL_OPACITY;

      for (let i = 0; i < pitchList.length - 1; i += 1) {
        const traj = trajList[i];
        if (!traj?.length) continue;
        const shader = getPitchShader(pitchList[i], scaler);
        const end = traj.length - 1;
        drawAtBatTrail(ctx, traj, shader, 0, end);
      }

      if (currentIdx >= 0) {
        const traj = trajList[currentIdx];
        const shader = getPitchShader(pitchList[currentIdx], scaler);
        if (traj?.length > 1) {
          const animatedTrail = trajectoryThroughProgress(traj, progress);
          drawAtBatTrail(ctx, animatedTrail, shader, 0, animatedTrail.length - 1);
        }
      }
      ctx.globalAlpha = 1;
    },
    [W, H, scaler, setupCanvas, crop, showPitchTrails],
  );

  const renderModelBaseball = useCallback(
    (point, progress, pitch, visible) => {
      const state = threeRef.current;
      if (!state) return;
      const { renderer, scene, camera, group, model } = state;
      if (!visible || !point || !model) {
        group.visible = false;
        renderer.clear();
        return;
      }

      const mapped = mapPointToCanvas(point, crop, W, H);
      if (!mapped) return;
      const depthRadius = (point[4] || scaler.ballRadius) * mapped.scaleX;
      const landedRadius = Math.max(scaler.ballRadius * mapped.scaleX, strikeZoneView ? 8 : 5);
      const radius = Math.max(depthRadius, landedRadius * 0.28);
      const profile = pitchSpinProfile(pitch);
      const mix = normalizedAxisMix(profile.axisMix);
      const elapsedMs = progress * AT_BAT_ANIMATION_MS;
      const spin = elapsedMs * profile.rpm * TRUE_SPIN_RADIANS_PER_MS_PER_RPM * profile.direction;
      const base = profile.startRotation || { x: 0, y: 0, z: 0 };

      group.visible = true;
      // Three's orthographic Y axis points up; canvas pitch coordinates point down.
      group.position.set(mapped.x, H - mapped.y, 0);
      group.scale.setScalar(radius * 2);
      group.rotation.set(
        base.x + spin * mix.x,
        base.y + spin * mix.y,
        base.z + spin * mix.z,
      );

      renderer.clear();
      renderer.render(scene, camera);
    },
    [W, H, crop, scaler, strikeZoneView],
  );

  const renderFg = useCallback(
    (pitchList, trajList, currentIdx, progress, phase) => {
      const ctx = setupCanvas(fgRef.current);
      if (!ctx) return;
      ctx.clearRect(crop?.x ?? 0, crop?.y ?? 0, crop?.w ?? W, crop?.h ?? H);
      renderModelBaseball(null, progress, null, false);

      const refPitch = pitchList[pitchList.length - 1] || refPitchForCrop;
      drawAtBatStrikeZone(ctx, refPitch, scaler);
      if (showHotZones) drawAtBatHotZones(ctx, refPitch, scaler);

      for (let i = 0; i < pitchList.length - 1; i += 1) {
        const traj = trajList[i];
        if (!traj?.length) continue;
        const last = traj[traj.length - 1];
        drawAtBatPitchDot(ctx, last, pitchList[i], scaler, getPitchShader(pitchList[i], scaler), OLD_PITCH_ALPHA);
      }

      if (currentIdx < 0) return;
      const traj = trajList[currentIdx];
      const pitch = pitchList[currentIdx];
      const shader = getPitchShader(pitch, scaler);
      if (!traj?.length) return;

      if (phase === 'settled') {
        const last = traj[traj.length - 1];
        drawAtBatBall(ctx, last, pitch, scaler, shader, 1);
        return;
      }

      const animatedPoint = interpolateTrajectoryPoint(traj, progress);
      if (baseballModelUrl) {
        renderModelBaseball(animatedPoint, progress, pitch, true);
        return;
      }
      drawAtBatSpinningBaseball(ctx, animatedPoint, progress, scaler, pitch, 1);
    },
    [W, H, scaler, setupCanvas, refPitchForCrop, crop, baseballModelUrl, renderModelBaseball, showHotZones],
  );

  const animate = useCallback(
    (timestamp) => {
      const s = stateRef.current;
      if (!s.animStart) s.animStart = timestamp;
      const elapsed = timestamp - s.animStart;
      const currentIdx = s.pitches.length - 1;

      if (s.phase === 'flying') {
        const t = Math.min(elapsed / AT_BAT_ANIMATION_MS, 1);
        s.animProgress = t < 1 ? 1 - (1 - t) ** 2 : 1;
        if (t >= 1) {
          s.phase = 'settled';
          s.animProgress = 1;
          const last = s.pitches[s.pitches.length - 1];
          const lid = last?.event?.playId ?? last?.num ?? s.pitches.length;
          const sk = storageKey(gamePk);
          if (sk) {
            try { sessionStorage.setItem(sk, String(lid)); } catch { /* ignore */ }
          }
          if (s.landedPitchId == null || String(s.landedPitchId) !== String(lid)) {
            s.landedPitchId = lid;
            onPitchLandedRef.current?.(last);
          }
        }
      }

      renderBg(s.pitches, s.trajectories, currentIdx, s.animProgress);
      renderFg(s.pitches, s.trajectories, currentIdx, s.animProgress, s.phase);

      if (s.phase === 'flying') {
        animRef.current = requestAnimationFrame(animateRef.current);
      }
    },
    [renderBg, renderFg, gamePk],
  );

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    setupCanvas(bgRef.current);
    setupCanvas(fgRef.current);
  }, [setupCanvas]);

  useEffect(() => {
    const s = stateRef.current;
    s.scaler = scaler;
    s.pitches = pitches;
    s.trajectories = trajectories;

    if (!pitches.length) {
      renderFg([], [], -1, 1, 'settled');
      renderBg([], [], -1, 1);
      s.prevPitchId = null;
      return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }

    const last = pitches[pitches.length - 1];
    const pitchId = last.event?.playId ?? last.num ?? pitches.length;
    const pitchIdStr = String(pitchId);

    const sk = storageKey(gamePk);
    let storedLast;
    try { storedLast = sk ? sessionStorage.getItem(sk) : null; } catch { storedLast = null; }

    const samePitch = s.prevPitchId != null && String(s.prevPitchId) === pitchIdStr;
    const isNewPitch = s.prevPitchId != null && String(s.prevPitchId) !== pitchIdStr;
    const hydrateSettled = pitches.length > 1 || (storedLast != null && storedLast === pitchIdStr);

    if (isNewPitch) {
      s.prevPitchId = pitchId;
      s.landedPitchId = null;
      s.phase = 'flying';
      s.animProgress = 0;
      s.animStart = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animateRef.current);
      return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }

    if (hydrateSettled || samePitch) {
      s.prevPitchId = pitchId;
      s.phase = 'settled';
      s.animProgress = 1;
      renderBg(pitches, trajectories, pitches.length - 1, 1);
      renderFg(pitches, trajectories, pitches.length - 1, 1, 'settled');
      return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }

    s.prevPitchId = pitchId;
    s.landedPitchId = null;
    s.phase = 'flying';
    s.animProgress = 0;
    s.animStart = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animateRef.current);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [pitches, trajectories, scaler, animate, renderBg, renderFg, gamePk]);

  const ready = strikeZoneView || !responsive || measuredWidth != null;

  return (
    <div
      ref={responsive ? containerRef : undefined}
      className={`relative overflow-hidden ${responsive ? 'w-full' : ''} ${className}`}
      style={
        responsive
          ? { width: '100%', aspectRatio: `${baseWidth} / ${baseHeight}` }
          : { width: W, height: H }
      }
    >
      {ready && (
        <>
          <canvas
            ref={bgRef}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
            aria-hidden
          />
          <canvas
            ref={fgRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
          />
          {baseballModelUrl && (
            <canvas
              ref={modelCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden
            />
          )}
        </>
      )}
    </div>
  );
}
