/** YoY composite score: 0 ≈ same, + = better, − = worse (scaled ~±100). */

const NEUTRAL_THRESHOLD = 5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normDelta = (curr, prev, scale, invert = false) => {
  const c = toNum(curr);
  const p = toNum(prev);
  if (c == null || p == null || !scale) return null;
  const norm = clamp((c - p) / scale, -1, 1);
  return invert ? -norm : norm;
};

const ratePct = (num, denom) => {
  const n = toNum(num);
  const d = toNum(denom);
  if (n == null || !d) return null;
  return (n / d) * 100;
};

const weightedMean = (entries) => {
  const valid = entries.filter((e) => e.norm != null);
  if (!valid.length) return 0;
  const weightSum = valid.reduce((sum, e) => sum + e.weight, 0);
  const score = valid.reduce((sum, e) => sum + e.norm * e.weight, 0) / weightSum;
  return Number((score * 100).toFixed(1));
};

export function getScoreTone(score) {
  if (score > NEUTRAL_THRESHOLD) return 'positive';
  if (score < -NEUTRAL_THRESHOLD) return 'negative';
  return 'neutral';
}

export function formatDeltaScore(score) {
  if (score > 0) return `+${score.toFixed(1)}`;
  if (score < 0) return score.toFixed(1);
  return '±0.0';
}

export function computeHitterDeltaScore({ prevYear, currYear, prevSab, currSab, prevCast, currCast }) {
  const prevK = ratePct(prevYear?.strikeOuts, prevYear?.plateAppearances);
  const currK = ratePct(currYear?.strikeOuts, currYear?.plateAppearances);
  const prevBB = ratePct(prevYear?.baseOnBalls, prevYear?.plateAppearances);
  const currBB = ratePct(currYear?.baseOnBalls, currYear?.plateAppearances);

  const entries = [
    { norm: normDelta(currSab?.wRcPlus, prevSab?.wRcPlus, 20), weight: 0.45 },
    { norm: normDelta(currSab?.war, prevSab?.war, 2), weight: 0.2 },
    { norm: normDelta(currSab?.woba, prevSab?.woba, 0.04), weight: 0.08 },
    { norm: normDelta(currCast?.xwoba ?? currSab?.woba, prevCast?.xwoba ?? prevSab?.woba, 0.04), weight: 0.07 },
    { norm: normDelta(currCast?.avgHitSpeed, prevCast?.avgHitSpeed, 3), weight: 0.05 },
    { norm: normDelta(currCast?.hardHitPercent, prevCast?.hardHitPercent, 8), weight: 0.05 },
    { norm: normDelta(currK, prevK, 8, true), weight: 0.04 },
    { norm: normDelta(currBB, prevBB, 4), weight: 0.03 },
    { norm: normDelta(currSab?.spd, prevSab?.spd, 2), weight: 0.02 },
    { norm: normDelta(currSab?.fielding, prevSab?.fielding, 3), weight: 0.01 },
  ];

  return weightedMean(entries);
}

export function computePitcherDeltaScore({ prevYear, currYear, prevSab, currSab }) {
  const entries = [
    { norm: normDelta(currSab?.xfip, prevSab?.xfip, 0.75, true), weight: 0.35 },
    { norm: normDelta(currSab?.war, prevSab?.war, 1.5), weight: 0.3 },
    { norm: normDelta(currSab?.fip, prevSab?.fip, 0.75, true), weight: 0.1 },
    { norm: normDelta(currYear?.strikeoutsPer9Inn, prevYear?.strikeoutsPer9Inn, 2), weight: 0.1 },
    { norm: normDelta(currYear?.walksPer9Inn, prevYear?.walksPer9Inn, 1.5, true), weight: 0.1 },
    { norm: normDelta(currSab?.eraMinus, prevSab?.eraMinus, 15, true), weight: 0.05 },
  ];

  return weightedMean(entries);
}

export function computePlayerDeltaScore(player) {
  const input = {
    prevYear: player.statsPrev,
    currYear: player.statsCurrent,
    prevSab: player.sabermetricsPrev,
    currSab: player.sabermetricsCurrent,
    prevCast: player.statcastPrev,
    currCast: player.statcastCurrent,
  };

  return player.group === 'pitching'
    ? computePitcherDeltaScore(input)
    : computeHitterDeltaScore(input);
}

export async function fetchPlayerSabermetrics(playerId, season, group) {
  const hydrate = encodeURIComponent(`stats(type=sabermetrics,season=${season},group=${group})`);
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=${hydrate}`);
    if (!res.ok) return null;
    const data = await res.json();
    const block = data.people?.[0]?.stats?.find(
      (s) => s.type?.displayName === 'sabermetrics'
        && s.group?.displayName?.toLowerCase() === group,
    );
    return block?.splits?.[0]?.stat ?? null;
  } catch {
    return null;
  }
}

export async function fetchPlayerStatcastBatting(playerId, season) {
  const hydrate = encodeURIComponent(`stats(type=statcastBatting,season=${season},group=hitting)`);
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=${hydrate}`);
    if (!res.ok) return null;
    const data = await res.json();
    const block = data.people?.[0]?.stats?.find((s) => s.type?.displayName === 'statcastBatting');
    return block?.splits?.[0]?.stat ?? null;
  } catch {
    return null;
  }
}

export async function enrichMoversWithDeltaScores(movers) {
  const batchSize = 6;
  const enriched = [];

  for (let i = 0; i < movers.length; i += batchSize) {
    const batch = movers.slice(i, i + batchSize);
    const scored = await Promise.all(
      batch.map(async (mover) => {
        const [prevSab, currSab, prevCast, currCast] = await Promise.all([
          fetchPlayerSabermetrics(mover.playerId, '2025', mover.group),
          fetchPlayerSabermetrics(mover.playerId, '2026', mover.group),
          mover.group === 'hitting' ? fetchPlayerStatcastBatting(mover.playerId, '2025') : null,
          mover.group === 'hitting' ? fetchPlayerStatcastBatting(mover.playerId, '2026') : null,
        ]);

        const payload = {
          ...mover,
          sabermetricsPrev: prevSab,
          sabermetricsCurrent: currSab,
          statcastPrev: prevCast,
          statcastCurrent: currCast,
        };
        const deltaScore = computePlayerDeltaScore(payload);
        return { ...payload, deltaScore, scoreTone: getScoreTone(deltaScore) };
      }),
    );
    enriched.push(...scored);
  }

  return enriched;
}