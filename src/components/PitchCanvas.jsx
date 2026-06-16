// At Bat pitch visualization — port of MLB Gameday responsive-pitch-fx.

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  createScaler,
  buildPitchFromEvent,
  buildPitchTrajectory,
  getPitchShader,
  drawAtBatStrikeZone,
  drawAtBatTrail,
  drawAtBatBall,
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

function storageKey(gamePk) {
  return gamePk != null ? `mlbPc:lastPitch:${gamePk}` : null;
}

export { hasRenderablePitchData };

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
}) {
  const strikeZoneView = viewMode === 'strikeZone';
  const containerRef = useRef(null);
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const animRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(responsive ? null : width);
  const stateRef = useRef({
    prevPitchId: null,
    animProgress: 1,
    phase: 'idle',
    animStart: null,
    scaler: null,
    pitches: [],
    trajectories: [],
    currentTrajectory: null,
  });

  useEffect(() => {
    if (!responsive || strikeZoneView) {
      setMeasuredWidth(width);
      return undefined;
    }
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setMeasuredWidth(Math.max(320, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, width, strikeZoneView]);

  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const W = strikeZoneView
    ? (width ?? AT_BAT_STRIKE_ZONE_CLIP.width)
    : (measuredWidth ?? width);
  const H = strikeZoneView
    ? (height ?? AT_BAT_STRIKE_ZONE_CLIP.height)
    : (height ?? Math.round((W / 1158) * 869));

  const scaler = useMemo(() => {
    if (strikeZoneView) {
      return createScaler(AT_BAT_FIXED_WIDTH, AT_BAT_STRIKE_ZONE_VIEW);
    }
    return createScaler(W);
  }, [W, strikeZoneView]);

  const pitches = useMemo(() => {
    const list = [];
    let n = 0;
    for (const ev of playEvents) {
      if (!ev.isPitch || !hasRenderablePitchData(ev.pitchData)) continue;
      n += 1;
      const pitch = buildPitchFromEvent(ev, n);
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
    return computeAtBatStrikeZoneCrop(scaler, ref);
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
          const end = Math.min(Math.max(1, Math.floor((traj.length - 1) * progress)), traj.length - 1);
          drawAtBatTrail(ctx, traj, shader, 0, end);
        }
      }
      ctx.globalAlpha = 1;
    },
    [W, H, scaler, setupCanvas, crop, showPitchTrails],
  );

  const renderFg = useCallback(
    (pitchList, trajList, currentIdx, progress, phase) => {
      const ctx = setupCanvas(fgRef.current);
      if (!ctx) return;
      ctx.clearRect(crop?.x ?? 0, crop?.y ?? 0, crop?.w ?? W, crop?.h ?? H);

      const refPitch = pitchList[pitchList.length - 1] || refPitchForCrop;
      drawAtBatStrikeZone(ctx, refPitch, scaler);

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

      const idx = Math.min(Math.floor(progress * (traj.length - 1)), traj.length - 1);
      drawAtBatBall(ctx, traj[idx], pitch, scaler, shader, 1);
    },
    [W, H, scaler, setupCanvas, refPitchForCrop, crop],
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
          const sk = storageKey(gamePk);
          if (sk) {
            const last = s.pitches[s.pitches.length - 1];
            const lid = last?.event?.playId ?? last?.num ?? s.pitches.length;
            try { sessionStorage.setItem(sk, String(lid)); } catch { /* ignore */ }
          }
        }
      }

      renderBg(s.pitches, s.trajectories, currentIdx, s.animProgress);
      renderFg(s.pitches, s.trajectories, currentIdx, s.animProgress, s.phase);

      if (s.phase === 'flying') {
        animRef.current = requestAnimationFrame(animate);
      }
    },
    [renderBg, renderFg, gamePk],
  );

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
    let storedLast = null;
    try { storedLast = sk ? sessionStorage.getItem(sk) : null; } catch { storedLast = null; }

    const samePitch = s.prevPitchId != null && String(s.prevPitchId) === pitchIdStr;
    const isNewPitch = s.prevPitchId != null && String(s.prevPitchId) !== pitchIdStr;
    const hydrateSettled = pitches.length > 1 || (storedLast != null && storedLast === pitchIdStr);

    if (isNewPitch) {
      s.prevPitchId = pitchId;
      s.phase = 'flying';
      s.animProgress = 0;
      s.animStart = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animate);
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
    s.phase = 'flying';
    s.animProgress = 0;
    s.animStart = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [pitches, trajectories, scaler, animate, renderBg, renderFg, gamePk]);

  const ready = strikeZoneView || !responsive || measuredWidth != null;

  return (
    <div
      ref={responsive && !strikeZoneView ? containerRef : undefined}
      className={`relative overflow-hidden ${responsive && !strikeZoneView ? 'w-full aspect-[1158/869]' : ''} ${className}`}
      style={{ width: W, height: H }}
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
        </>
      )}
    </div>
  );
}
