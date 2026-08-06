import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import LiveAtBatVisual from '../components/LiveAtBatVisual';
import { assetUrl } from '../utils/baseUrl.js';

const STRIKE_ZONE_TOP = 3.23;
const STRIKE_ZONE_BOTTOM = 1.63;
const STRIKE_ZONE_DEPTH = 8.5 / 12;

const PITCH_PRESETS = [
  {
    key: 'fastball',
    label: 'Fastball',
    description: 'Called Strike',
    typeCode: 'FF',
    typeDescription: '4-Seam Fastball',
    startSpeed: 97.2,
    endSpeed: 89.4,
    spinRate: 2400,
    spinDirection: 180,
    targetPX: -0.12,
    targetPZ: 2.72,
    x0: 2.1,
    z0: 6.05,
    vy0: -139,
    ay: 25,
    ax: -7.5,
    az: -27,
    code: 'C',
    isStrike: true,
  },
  {
    key: 'curveball',
    label: 'Curveball',
    description: 'Ball',
    typeCode: 'CU',
    typeDescription: 'Curveball',
    startSpeed: 79.8,
    endSpeed: 73.1,
    spinRate: 2600,
    spinDirection: 0,
    targetPX: 0.62,
    targetPZ: 1.35,
    x0: 1.85,
    z0: 5.85,
    vy0: -116,
    ay: 22,
    ax: 11,
    az: -39,
    code: 'B',
    isBall: true,
  },
  {
    key: 'slider',
    label: 'Slider',
    description: 'Swinging Strike',
    typeCode: 'SL',
    typeDescription: 'Slider',
    startSpeed: 86.5,
    endSpeed: 79.2,
    spinRate: 2500,
    spinDirection: 240,
    targetPX: -0.78,
    targetPZ: 2.08,
    x0: 2.35,
    z0: 5.72,
    vy0: -126,
    ay: 24,
    ax: -14,
    az: -34,
    code: 'S',
    isStrike: true,
  },
  {
    key: 'changeup',
    label: 'Changeup',
    description: 'In play, no out',
    typeCode: 'CH',
    typeDescription: 'Changeup',
    startSpeed: 84.1,
    endSpeed: 77.6,
    spinRate: 1900,
    spinDirection: 180,
    targetPX: 0.08,
    targetPZ: 2.41,
    x0: 2.0,
    z0: 5.92,
    vy0: -122,
    ay: 23,
    ax: 6,
    az: -31,
    code: 'X',
    isInPlay: true,
  },
];

const SPIN_PREVIEWS = [
  {
    key: 'ff',
    label: '4-Seam',
    typeCode: 'FF',
    spinLabel: 'Fast backspin',
    axis: 'x',
    axisMix: { x: 1, y: 0, z: 0 },
    direction: -1,
    rpm: 2400,
    maxRpm: 2800,
    visualSpin: 1,
    startRotation: { x: 0, y: 0, z: Math.PI / 2 },
  },
  {
    key: 'cu',
    label: 'Curveball',
    typeCode: 'CU',
    spinLabel: 'Forward topspin',
    axis: 'x',
    axisMix: { x: 1, y: 0, z: 0 },
    direction: 1,
    rpm: 2600,
    maxRpm: 3500,
    visualSpin: 1,
    startRotation: { x: Math.PI / 2, y: Math.PI / 2, z: Math.PI / 2 },
  },
  {
    key: 'sl',
    label: 'Slider',
    typeCode: 'SL',
    spinLabel: 'Tilted sidespin',
    axis: 'z',
    axisMix: { x: 0, y: 0.4, z: 0.6 },
    direction: -1,
    rpm: 2500,
    maxRpm: 3200,
    visualSpin: 1,
    startRotation: { x: 0, y: 0, z: 0 },
  },
  {
    key: 'ch',
    label: 'Changeup',
    typeCode: 'CH',
    spinLabel: 'Slower backspin',
    axis: 'x',
    axisMix: { x: 1, y: 0, z: 0 },
    direction: -1,
    rpm: 1900,
    maxRpm: 2600,
    visualSpin: 1,
    startRotation: { x: 0, y: 0, z: Math.PI / 2 },
  },
];

const SPIN_PREVIEW_SIZE = 190;
const TRUE_SPIN_RADIANS_PER_FRAME_PER_RPM = (Math.PI * 2) / (60 * 60);

const toDeg = (rad) => Math.round((rad * 180) / Math.PI);
const toRad = (deg) => (Number(deg) * Math.PI) / 180;
const normalizeRad = (rad) => {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
};
const normalizedAxisMix = (mix = {}) => {
  const x = Number(mix.x || 0);
  const y = Number(mix.y || 0);
  const z = Number(mix.z || 0);
  const total = Math.abs(x) + Math.abs(y) + Math.abs(z);
  if (!total) return { x: 1, y: 0, z: 0 };
  return { x: x / total, y: y / total, z: z / total };
};

function SpinPreviewBall({ modelUrl, preview, onChange, onCaptureFace }) {
  const canvasRef = useRef(null);
  const rotationRef = useRef({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const width = SPIN_PREVIEW_SIZE;
    const height = SPIN_PREVIEW_SIZE;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-2.5, 2.5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9fbaff, 1.4);
    rimLight.position.set(3, -1, 3);
    scene.add(rimLight);

    const group = new THREE.Group();
    group.rotation.set(
      preview.startRotation?.x || 0,
      preview.startRotation?.y || 0,
      preview.startRotation?.z || 0,
    );
    scene.add(group);

    let disposed = false;
    let frame = null;
    let model = null;
    const startTime = performance.now();

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      if (disposed) return;
      model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      model.position.sub(center);
      model.scale.setScalar(1.82 / maxDim);
      group.add(model);
    });

    const animate = () => {
      if (model) {
        const elapsedFrames = (performance.now() - startTime) / (1000 / 60);
        const visualSpeed = preview.rpm
          * TRUE_SPIN_RADIANS_PER_FRAME_PER_RPM
          * (preview.visualSpin / 10);
        const spin = elapsedFrames * visualSpeed * preview.direction;
        const base = preview.startRotation || { x: 0, y: 0, z: 0 };
        const mix = normalizedAxisMix(preview.axisMix || {
          x: preview.axis === 'x' ? 1 : 0,
          y: preview.axis === 'y' ? 1 : 0,
          z: preview.axis === 'z' ? 1 : 0,
        });
        group.rotation.set(
          base.x + spin * mix.x,
          base.y + spin * mix.y,
          base.z + spin * mix.z,
        );
        rotationRef.current = {
          x: normalizeRad(group.rotation.x),
          y: normalizeRad(group.rotation.y),
          z: normalizeRad(group.rotation.z),
        };
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      renderer.dispose();
    };
  }, [modelUrl, preview]);

  const update = (patch) => onChange(preview.key, patch);
  const startRotation = preview.startRotation || { x: 0, y: 0, z: 0 };
  const axisMix = normalizedAxisMix(preview.axisMix || {
    x: preview.axis === 'x' ? 1 : 0,
    y: preview.axis === 'y' ? 1 : 0,
    z: preview.axis === 'z' ? 1 : 0,
  });

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3 text-center">
      <div
        className="mx-auto overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_35%_25%,rgba(148,163,184,0.18),rgba(15,23,42,0.2)_42%,rgba(2,6,23,0.85))]"
        style={{ width: SPIN_PREVIEW_SIZE, height: SPIN_PREVIEW_SIZE }}
      >
        <canvas
          ref={canvasRef}
          width={SPIN_PREVIEW_SIZE}
          height={SPIN_PREVIEW_SIZE}
          className="h-full w-full"
          aria-label={`${preview.label} spin preview`}
        />
      </div>
      <div className="mt-3 text-sm font-bold text-slate-100">{preview.label}</div>
      <div className="mt-0.5 text-[11px] font-mono text-slate-500">{preview.typeCode}</div>
      <div className={`mt-1 text-xs text-accent-300`}>{preview.spinLabel}</div>
      <div className="mt-3 space-y-3 text-left">
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Spin rate</span>
            <span className="font-mono text-slate-500">{preview.rpm} RPM</span>
          </div>
          <input
            type="range"
            min="0"
            max={preview.maxRpm}
            step="25"
            value={preview.rpm}
            onChange={(e) => update({ rpm: Number(e.target.value) })}
            className="w-full accent-sky-400"
          />
          <div className="mt-0.5 flex justify-between text-[10px] font-mono text-slate-600">
            <span>0</span>
            <span>max {preview.maxRpm}</span>
          </div>
        </label>

        <label className="block">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Visual spin</span>
            <span className="font-mono text-slate-500">{preview.visualSpin.toFixed(1)}/10</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={preview.visualSpin}
            onChange={(e) => update({ visualSpin: Number(e.target.value) })}
            className="w-full accent-sky-400"
          />
          <div className="mt-0.5 flex justify-between text-[10px] font-mono text-slate-600">
            <span>0 slow</span>
            <span>10 true</span>
          </div>
        </label>

        <div className="grid grid-cols-1 gap-2">
          <label className="text-[11px] text-slate-400">
            Direction
            <select
              value={preview.direction}
              onChange={(e) => update({ direction: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            >
              <option value="-1">Back / reverse</option>
              <option value="1">Forward</option>
            </select>
          </label>
        </div>

        {[
          { axis: 'x', label: 'Top/backspin X' },
          { axis: 'y', label: 'Gyro Y' },
          { axis: 'z', label: 'Sidespin Z' },
        ].map(({ axis, label }) => (
          <label key={axis} className="block">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{label}</span>
              <span className="font-mono text-slate-500">{Math.round(axisMix[axis] * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={axisMix[axis]}
              onChange={(e) => update({
                axisMix: {
                  ...axisMix,
                  [axis]: Number(e.target.value),
                },
              })}
              className="w-full accent-sky-400"
            />
          </label>
        ))}

        {['x', 'y', 'z'].map((axis) => (
          <label key={axis} className="block">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Start face {axis.toUpperCase()}</span>
              <span className="font-mono text-slate-500">{toDeg(startRotation[axis] || 0)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={toDeg(startRotation[axis] || 0)}
              onChange={(e) => update({
                startRotation: {
                  ...startRotation,
                  [axis]: toRad(e.target.value),
                },
              })}
              className="w-full accent-sky-400"
            />
          </label>
        ))}

        <button
          type="button"
          onClick={() => onCaptureFace(preview.key, rotationRef.current)}
          className="w-full rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 transition-colors"
        >
          Use Current Face As Start
        </button>
      </div>
    </div>
  );
}

function timeAtPlateDepth({ y0, vy0, ay }) {
  const a = 0.5 * ay;
  const b = vy0;
  const c = y0 - STRIKE_ZONE_DEPTH;
  const disc = Math.max(0, b * b - 4 * a * c);
  const t1 = (-b + Math.sqrt(disc)) / (2 * a);
  const t2 = (-b - Math.sqrt(disc)) / (2 * a);
  return Math.min(t1, t2);
}

function velocityForTarget({ start, target, accel, time }) {
  return (target - start - 0.5 * accel * time * time) / time;
}

function createPitchEvent(preset, pitchNumber) {
  const y0 = 50;
  const t = timeAtPlateDepth({ y0, vy0: preset.vy0, ay: preset.ay });
  const vx0 = velocityForTarget({
    start: preset.x0,
    target: preset.targetPX,
    accel: preset.ax,
    time: t,
  });
  const vz0 = velocityForTarget({
    start: preset.z0,
    target: preset.targetPZ,
    accel: preset.az,
    time: t,
  });

  return {
    isPitch: true,
    playId: `${preset.key}-${pitchNumber}-${Date.now()}`,
    pitchNumber,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    details: {
      code: preset.code,
      description: preset.description,
      isBall: Boolean(preset.isBall),
      isStrike: Boolean(preset.isStrike),
      isInPlay: Boolean(preset.isInPlay),
      type: {
        code: preset.typeCode,
        description: preset.typeDescription,
      },
    },
    pitchData: {
      strikeZoneTop: STRIKE_ZONE_TOP,
      strikeZoneBottom: STRIKE_ZONE_BOTTOM,
      strikeZoneWidth: 17,
      strikeZoneDepth: 8.5,
      startSpeed: preset.startSpeed,
      endSpeed: preset.endSpeed,
      breaks: {
        spinRate: preset.spinRate,
        spinDirection: preset.spinDirection,
      },
      coordinates: {
        pX: preset.targetPX,
        pZ: preset.targetPZ,
        x0: preset.x0,
        y0,
        z0: preset.z0,
        vX0: vx0,
        vY0: preset.vy0,
        vZ0: vz0,
        aX: preset.ax,
        aY: preset.ay,
        aZ: preset.az,
      },
    },
  };
}

function countFromEvents(events) {
  return events.reduce(
    (count, event) => {
      if (event.details?.isBall) return { ...count, balls: Math.min(count.balls + 1, 3) };
      if (event.details?.isStrike) return { ...count, strikes: Math.min(count.strikes + 1, 2) };
      return count;
    },
    { balls: 0, strikes: 0 },
  );
}

export default function Debug() {
  const [playEvents, setPlayEvents] = useState([]);
  const [spinPreviews, setSpinPreviews] = useState(SPIN_PREVIEWS);
  const modelUrl = assetUrl('baseball-centered.glb');
  const count = useMemo(() => countFromEvents(playEvents), [playEvents]);
  const currentPlay = useMemo(() => ({
    about: {
      atBatIndex: 999,
      isComplete: false,
    },
    matchup: {
      batSide: { code: 'R' },
    },
    playEvents,
  }), [playEvents]);

  const addPitch = (preset) => {
    setPlayEvents((events) => [
      ...events,
      createPitchEvent(preset, events.filter((event) => event.isPitch).length + 1),
    ]);
  };

  const updateSpinPreview = (key, patch) => {
    setSpinPreviews((previews) => previews.map((preview) => (
      preview.key === key
        ? { ...preview, ...patch }
        : preview
    )));
  };

  const captureSpinFace = (key, rotation) => {
    updateSpinPreview(key, { startRotation: rotation });
  };

  const spinConfigOutput = useMemo(() => {
    const profiles = Object.fromEntries(spinPreviews.map((preview) => [
      preview.typeCode,
      {
        label: preview.label,
        axisMix: normalizedAxisMix(preview.axisMix),
        axisMixPercent: {
          x: Math.round(normalizedAxisMix(preview.axisMix).x * 100),
          y: Math.round(normalizedAxisMix(preview.axisMix).y * 100),
          z: Math.round(normalizedAxisMix(preview.axisMix).z * 100),
        },
        direction: preview.direction,
        rpm: preview.rpm,
        maxRpm: preview.maxRpm,
        visualSpin: preview.visualSpin,
        visualSpeed: Number((
          preview.rpm
          * TRUE_SPIN_RADIANS_PER_FRAME_PER_RPM
          * (preview.visualSpin / 10)
        ).toFixed(4)),
        visualSpinMeaning: '10 = true real-time spin; 60 RPM at 10 makes one full rotation per second',
        startRotation: {
          x: Number((preview.startRotation?.x || 0).toFixed(4)),
          y: Number((preview.startRotation?.y || 0).toFixed(4)),
          z: Number((preview.startRotation?.z || 0).toFixed(4)),
        },
        startRotationDeg: {
          x: toDeg(preview.startRotation?.x || 0),
          y: toDeg(preview.startRotation?.y || 0),
          z: toDeg(preview.startRotation?.z || 0),
        },
      },
    ]));
    return JSON.stringify({ baseballSpinProfiles: profiles }, null, 2);
  }, [spinPreviews]);

  const copySpinConfig = async () => {
    try {
      await navigator.clipboard.writeText(spinConfigOutput);
    } catch {
      /* If clipboard permissions are blocked, the textarea still contains it. */
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.24em] text-accent-400 font-semibold`}>
              Debug
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-white mt-1">
              PitchFX Animation Lab
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Synthetic MLB-style pitch data for testing the live trail, spinning baseball,
              landing dot, and toast timing when there are no live games.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPlayEvents([])}
            className="self-start sm:self-auto rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Reset AB
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PITCH_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => addPitch(preset)}
              className={`rounded-xl border border-accent-500/30 bg-accent-500/10 px-3 py-2 text-sm font-semibold text-accent-200 hover:bg-accent-500/20 transition-colors`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <LiveAtBatVisual
        venueId={null}
        exteriorFailed
        gameDateTime={new Date().toISOString()}
        currentPlay={currentPlay}
        playEvents={playEvents}
        szTop={STRIKE_ZONE_TOP}
        szBot={STRIKE_ZONE_BOTTOM}
        gamePk="debug"
        batSide="R"
        batterIsAway
        inningHalf="Top"
        currentInningOrdinal="Debug"
        balls={count.balls}
        strikes={count.strikes}
        outs={0}
        baseballModelUrl={modelUrl}
        animateLatestPitchOnHydrate
      />

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900 p-4 sm:p-5">
        <div className={`text-[10px] uppercase tracking-[0.24em] text-accent-400 font-semibold`}>
          GLB Spin Faces
        </div>
        <h2 className="font-display text-xl sm:text-2xl text-white mt-1">
          Large Spin Preview
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          These are oversized versions of the same baseball model so you can tune seam
          orientation, spin direction, and pitch-type feel without waiting on the pitch trail.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {spinPreviews.map((preview) => (
            <SpinPreviewBall
              key={preview.key}
              modelUrl={modelUrl}
              preview={preview}
              onChange={updateSpinPreview}
              onCaptureFace={captureSpinFace}
            />
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-slate-700/60 bg-slate-950/80 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-100">Spin config output</div>
              <div className="text-xs text-slate-500">
                Copy this JSON and send it back when the faces/spins look right.
              </div>
            </div>
            <button
              type="button"
              onClick={copySpinConfig}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Copy JSON
            </button>
          </div>
          <textarea
            readOnly
            value={spinConfigOutput}
            className="mt-3 h-56 w-full resize-y rounded-xl border border-slate-800 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none"
          />
        </div>
      </section>
    </main>
  );
}
