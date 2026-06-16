import { useMemo, useState } from 'react';
import LiveAtBatVisual from '../components/LiveAtBatVisual';
import { THEME_COLOR } from '../theme/theme.js';

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

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.24em] text-${THEME_COLOR}-400 font-semibold`}>
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
              className={`rounded-xl border border-${THEME_COLOR}-500/30 bg-${THEME_COLOR}-500/10 px-3 py-2 text-sm font-semibold text-${THEME_COLOR}-200 hover:bg-${THEME_COLOR}-500/20 transition-colors`}
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
      />
    </main>
  );
}
