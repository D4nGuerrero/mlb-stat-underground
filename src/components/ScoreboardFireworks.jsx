import { useEffect, useRef } from 'react';
import { Fireworks } from 'fireworks-js';
import { getTeamFireworkColorList } from '../utils/teamColors';

const FIREWORK_OPTIONS = {
  autoresize: true,
  opacity: 0.9,
  acceleration: 1.06,
  friction: 0.94,
  gravity: 0.92,
  particles: 62,
  traceLength: 2,
  traceSpeed: 13,
  explosion: 4,
  intensity: 16,
  flickering: 82,
  lineStyle: 'round',
  hue: { min: 25, max: 190 },
  delay: { min: 8, max: 20 },
  rocketsPoint: { min: 18, max: 82 },
  lineWidth: {
    explosion: { min: 0.5, max: 1.45 },
    trace: { min: 0.45, max: 1.05 },
  },
  brightness: { min: 72, max: 96 },
  decay: { min: 0.012, max: 0.024 },
  mouse: { click: false, move: false, max: 0 },
  sound: { enabled: false },
};

const FALLBACK_HUES = [{ min: 25, max: 190 }];

function hexToHue(hex) {
  const normalized = String(hex).replace('#', '').trim();
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return null;

  let hue;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  return Math.round((hue * 60 + 360) % 360);
}

function hueBand(hue, spread = 10) {
  if (!Number.isFinite(hue)) return null;
  return {
    min: Math.max(0, hue - spread),
    max: Math.min(360, hue + spread),
  };
}

function getTeamHueBands(teamId) {
  const colors = getTeamFireworkColorList(teamId);
  if (!colors.length) return FALLBACK_HUES;
  const bands = colors
    .map((color) => hueBand(hexToHue(color)))
    .filter(Boolean);
  return bands.length ? bands : FALLBACK_HUES;
}

function createFireworkOptions(hueBands) {
  return {
    ...FIREWORK_OPTIONS,
    // fireworks-js supports hue ranges instead of literal hex colors. Start
    // inside the team palette so no default rainbow trace sneaks in on mount.
    hue: hueBands[0] ?? FALLBACK_HUES[0],
  };
}

function randomLaunchOptions(hueBands) {
  const center = 4 + Math.random() * 92;
  const spread = 8 + Math.random() * 16;
  const hue = hueBands[Math.floor(Math.random() * hueBands.length)] ?? FALLBACK_HUES[0];

  return {
    hue,
    rocketsPoint: {
      min: Math.max(0, center - spread),
      max: Math.min(100, center + spread),
    },
    boundaries: {
      x: 4 + Math.random() * 34,
      y: 4 + Math.random() * 34,
    },
  };
}

export default function ScoreboardFireworks({ teamId, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const hueBands = getTeamHueBands(teamId);
    const fireworks = new Fireworks(containerRef.current, createFireworkOptions(hueBands));
    const launchTeamBurst = (count = 2) => {
      fireworks.updateOptions(randomLaunchOptions(hueBands));
      fireworks.launch(count);
    };

    fireworks.start();
    launchTeamBurst(3);
    const launchTimer = window.setInterval(() => {
      launchTeamBurst(1 + Math.floor(Math.random() * 2));
    }, 520);

    return () => {
      window.clearInterval(launchTimer);
      fireworks.stop(true);
    };
  }, [teamId]);

  return (
    <span
      ref={containerRef}
      className={`scoreboard-fireworks-canvas ${className}`}
      aria-hidden
    />
  );
}
