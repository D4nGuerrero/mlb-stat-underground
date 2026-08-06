import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../../utils/baseUrl.js';
import {
  stadiumExteriorUrl,
  stadiumInfieldUrl,
  stadiumTimeOfDay,
  batterPlateUrl,
  batterPlateFallbackUrl,
} from '../../utils/mlbHelpers';
import { buildOutcomeTrajectory, outcomeTitle } from './outcomeTrajectory.js';

const BIP_OUTCOMES = new Set(['HR', '3B', '2B', '1B', 'OUT', 'SF', 'DP']);

/**
 * At-bat RESULT theater only (not pitch flight).
 * Uses in-repo baseball GLB + stadium/batter stills — no downloaded swing animations.
 */
export default function SimOutcomeStage({
  play,
  venueId = null,
  batSide = 'R',
  onContinue,
  className = '',
}) {
  const outcome = play?.outcome || 'OUT';
  const lastPitch = play?.pitches?.[play.pitches.length - 1];
  const whiff = lastPitch?.result === 'SS';
  const showFlight = BIP_OUTCOMES.has(outcome);

  const bip = useMemo(() => ({
    exitVelocity: play?.exitVelocity,
    launchAngle: play?.launchAngle,
    sprayAngle: play?.sprayAngle,
    hitDistance: play?.hitDistance,
    outcome,
    whiff,
  }), [play?.exitVelocity, play?.launchAngle, play?.sprayAngle, play?.hitDistance, outcome, whiff]);

  const title = outcomeTitle(outcome, bip);
  const canvasRef = useRef(null);
  const [clipDone, setClipDone] = useState(false);
  const [progress, setProgress] = useState(0);

  // Non-BIP results: timed banner (no external swing clips)
  useEffect(() => {
    if (showFlight) return undefined;
    const ms = outcome === 'K' ? 2000 : 1400;
    const t = window.setTimeout(() => setClipDone(true), ms);
    return () => window.clearTimeout(t);
  }, [showFlight, outcome]);

  // BIP / HR: ball flight with existing baseball.glb
  useEffect(() => {
    if (!showFlight || !canvasRef.current) return undefined;

    const canvas = canvasRef.current;
    const width = Math.max(canvas.clientWidth || 360, 280);
    const height = Math.max(canvas.clientHeight || 280, 240);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x020617, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 2000);
    camera.position.set(8, -70, 32);
    camera.lookAt(0, 100, 12);

    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-30, -40, 90);
    scene.add(sun);

    // Field plane (Y = toward CF in our coords)
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(220, 48),
      new THREE.MeshLambertMaterial({ color: 0x166534 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 90, 0);
    scene.add(grass);

    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(32, 32),
      new THREE.MeshLambertMaterial({ color: 0xa16207 }),
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0.3, 0);
    scene.add(dirt);

    // Plate marker
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf8fafc }),
    );
    plate.position.set(0, 0, 0.2);
    scene.add(plate);

    // Outfield wall
    const isHr = outcome === 'HR';
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(200, 6, 12),
      new THREE.MeshLambertMaterial({ color: isHr ? 0x1e3a5f : 0x334155 }),
    );
    wall.position.set(0, 175, 6);
    scene.add(wall);

    const ballGroup = new THREE.Group();
    scene.add(ballGroup);

    const { points } = buildOutcomeTrajectory(bip);
    const toScene = (p) => new THREE.Vector3(p.x * 0.72, p.y * 0.72, Math.max(0.5, p.z * 0.72));

    let ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 }),
    );
    ballGroup.add(ballMesh);

    const modelUrl = assetUrl('baseball-centered.glb');
    const loader = new GLTFLoader();
    let disposed = false;
    loader.load(modelUrl, (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(2.8 / maxDim);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center.multiplyScalar(model.scale.x));
      ballGroup.remove(ballMesh);
      ballMesh.geometry.dispose();
      ballMesh.material.dispose();
      ballMesh = model;
      ballGroup.add(model);
    });

    const trailGeom = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({
      color: isHr ? 0xfbbf24 : 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const trail = new THREE.Line(trailGeom, trailMat);
    scene.add(trail);

    const duration = isHr ? 3200 : 2200;
    const start = performance.now();
    let frame = null;

    const animate = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - (1 - t) ** 2;
      const idx = Math.min(points.length - 1, Math.floor(e * (points.length - 1)));
      const p = toScene(points[idx]);
      ballGroup.position.copy(p);
      ballGroup.rotation.x += 0.25;
      ballGroup.rotation.z += 0.12;

      // Follow ball slightly
      const camTarget = new THREE.Vector3(
        p.x * 0.2,
        Math.min(p.y * 0.45 - 50, 40),
        28 + e * (isHr ? 40 : 18),
      );
      camera.position.lerp(camTarget, 0.06);
      camera.lookAt(p.x * 0.3, p.y * 0.7, p.z);

      const trailPts = points.slice(0, idx + 1).map(toScene);
      if (trailPts.length >= 2) trailGeom.setFromPoints(trailPts);

      setProgress(Math.round(e * 100));
      renderer.render(scene, camera);

      if (t < 1) frame = requestAnimationFrame(animate);
      else setClipDone(true);
    };
    frame = requestAnimationFrame(animate);
    const unlock = window.setTimeout(() => setClipDone(true), duration + 300);

    return () => {
      disposed = true;
      window.clearTimeout(unlock);
      if (frame) cancelAnimationFrame(frame);
      renderer.dispose();
      grass.geometry.dispose();
      grass.material.dispose();
      dirt.geometry.dispose();
      dirt.material.dispose();
      wall.geometry.dispose();
      wall.material.dispose();
      plate.geometry.dispose();
      plate.material.dispose();
      trailGeom.dispose();
      trailMat.dispose();
    };
  }, [showFlight, bip, outcome]);

  const exterior = venueId
    ? stadiumExteriorUrl(venueId, stadiumTimeOfDay(new Date().toISOString()))
    : null;
  const batterSide = play?.battingSide === 'home' ? 'home' : 'away';
  const stand = String(batSide || 'R').toUpperCase() === 'L' ? 'L' : 'R';

  const subtitle = (() => {
    if (outcome === 'K') return whiff ? 'Swinging strike three' : 'Called strike three';
    if (outcome === 'HR') return play?.hitDistance ? `${Math.round(play.hitDistance)} ft` : 'Gone';
    if (BIP_OUTCOMES.has(outcome)) {
      const bits = [];
      if (play?.exitVelocity != null) bits.push(`${play.exitVelocity} mph`);
      if (play?.launchAngle != null) bits.push(`${play.launchAngle}°`);
      if (play?.hitDistance != null) bits.push(`${play.hitDistance} ft`);
      return bits.join(' · ') || play?.hitField || '';
    }
    if (outcome === 'BB' || outcome === 'IBB') return 'Takes first base';
    if (outcome === 'HBP') return 'Awarded first base';
    return play?.desc || '';
  })();

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden ${className}`}>
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">At-bat result</div>
        <div className={`text-sm font-bold text-accent-300`}>{title}</div>
      </div>

      <div className="relative min-h-[280px] sm:min-h-[320px] bg-slate-950">
        {showFlight ? (
          <>
            {exterior && (
              <div
                className="absolute inset-0 opacity-40 bg-cover bg-center"
                style={{ backgroundImage: `url(${exterior})` }}
              />
            )}
            <div
              className="absolute inset-0 opacity-50 bg-cover bg-bottom"
              style={{ backgroundImage: `url(${stadiumInfieldUrl()})` }}
            />
            <canvas
              ref={canvasRef}
              className="relative z-10 w-full h-[280px] sm:h-[320px]"
            />
            <div className="absolute top-3 left-0 right-0 z-20 flex justify-center pointer-events-none">
              <div className={`px-4 py-1.5 rounded-full text-sm font-display tracking-wide border shadow-lg ${
                outcome === 'HR'
                  ? 'bg-amber-500/90 border-amber-300 text-slate-900'
                  : `bg-slate-900/85 border-accent-500/40 text-white`
              }`}
              >
                {title}
              </div>
            </div>
            <div className="absolute bottom-2 left-3 z-20 text-[10px] font-mono text-slate-200/90 drop-shadow">
              {subtitle}
              {progress > 0 && progress < 100 ? ` · ${progress}%` : ''}
            </div>
          </>
        ) : (
          <div className="min-h-[280px] sm:min-h-[320px] flex flex-col items-center justify-center gap-4 px-4 text-center relative overflow-hidden">
            {exterior && (
              <div
                className="absolute inset-0 opacity-25 bg-cover bg-center"
                style={{ backgroundImage: `url(${exterior})` }}
              />
            )}
            <div
              className={[
                'absolute inset-0 opacity-30 animate-pulse',
                outcome === 'K' && whiff ? 'bg-red-600' : '',
                outcome === 'K' && !whiff ? 'bg-amber-600' : '',
                outcome === 'BB' || outcome === 'IBB' ? 'bg-emerald-700' : '',
                outcome === 'HBP' ? 'bg-orange-700' : '',
              ].filter(Boolean).join(' ')}
            />

            {/* Existing Gameday plate still only — no swing clips / online assets */}
            <div className="relative z-10 h-28 w-12 opacity-90">
              <img
                src={batterPlateUrl(stand, batterSide)}
                alt=""
                className={[
                  'h-full w-full object-contain object-bottom',
                  outcome === 'K' && whiff ? '-rotate-6 translate-x-1' : '',
                  outcome === 'K' && !whiff ? 'opacity-80' : '',
                ].join(' ')}
                onError={(e) => {
                  if (!e.target.dataset.fallback) {
                    e.target.dataset.fallback = '1';
                    e.target.src = batterPlateFallbackUrl(stand, batterSide);
                  }
                }}
              />
            </div>

            <div className="relative z-10 text-2xl sm:text-3xl font-display tracking-tight text-white drop-shadow-lg">
              {title}
            </div>
            {subtitle && (
              <div className="relative z-10 text-sm text-slate-300 font-medium">{subtitle}</div>
            )}
            <div className="relative z-10 text-xs text-slate-500 font-mono">
              {play?.batter} · {play?.inning}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-800">
        <button
          type="button"
          disabled={!clipDone}
          onClick={onContinue}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5 ${
            clipDone
              ? `bg-accent-600 hover:bg-accent-500 border-accent-500/40 text-white`
              : 'bg-slate-800 border-slate-700 text-slate-500 cursor-wait'
          }`}
        >
          <span>Next at-bat</span>
          <span className="text-[11px] font-mono font-normal opacity-70">
            {clipDone ? 'Continue' : 'Playing result…'}
          </span>
        </button>
        {!clipDone && (
          <button
            type="button"
            className="mt-2 w-full text-[11px] text-slate-500 hover:text-slate-300"
            onClick={() => setClipDone(true)}
          >
            Skip result
          </button>
        )}
      </div>
    </div>
  );
}
