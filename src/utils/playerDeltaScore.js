/** Role-adjusted YoY value score: 0 ≈ same, + = better, − = worse. */

const NEUTRAL_THRESHOLD = 5;
const CURRENT_SEASON = '2026';
const PREVIOUS_SEASON = '2025';

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

const weightedRawMean = (entries) => {
  const valid = entries.filter((e) => e.value != null);
  if (!valid.length) return 0;
  const weightSum = valid.reduce((sum, e) => sum + e.weight, 0);
  return valid.reduce((sum, e) => sum + e.value * e.weight, 0) / weightSum;
};

const normVsAverage = (value, average, scale, invert = false) => {
  const v = toNum(value);
  if (v == null || !scale) return null;
  const norm = clamp((v - average) / scale, -1, 1);
  return invert ? -norm : norm;
};

const parseInnings = (value) => {
  if (value == null || value === '') return 0;
  const raw = String(value);
  const [whole, frac = '0'] = raw.split('.');
  const outs = Number(whole) * 3 + clamp(Number(frac) || 0, 0, 2);
  return outs / 3;
};

const seasonProgress = () => {
  const now = new Date();
  const year = Number(CURRENT_SEASON);
  if (now.getFullYear() > year) return 1;
  if (now.getFullYear() < year) return 0.15;

  const start = new Date(`${CURRENT_SEASON}-03-27T12:00:00`);
  const end = new Date(`${CURRENT_SEASON}-09-28T12:00:00`);
  return clamp((now - start) / (end - start), 0.15, 1);
};

const projectedFullSeason = (current, progress) => {
  const n = toNum(current) ?? 0;
  return progress > 0 ? n / progress : n;
};

const hitterPa = (stat) => toNum(stat?.plateAppearances) ?? toNum(stat?.atBats) ?? 0;
const pitcherIp = (stat) => parseInnings(stat?.inningsPitched);

const hitterRoleWeight = (prevYear, currYear) => {
  const progress = seasonProgress();
  const prevPa = hitterPa(prevYear);
  const projectedPa = projectedFullSeason(hitterPa(currYear), progress);
  const rolePa = Math.max(prevPa, projectedPa);
  return clamp(Math.sqrt(rolePa / 520), 0.25, 1.15);
};

const pitcherRoleWeight = (prevYear, currYear) => {
  const progress = seasonProgress();
  const prevIp = pitcherIp(prevYear);
  const projectedIp = projectedFullSeason(pitcherIp(currYear), progress);
  const roleIp = Math.max(prevIp, projectedIp);
  return clamp(Math.sqrt(roleIp / 160), 0.25, 1.15);
};

const hitterReliability = (currYear) => clamp(hitterPa(currYear) / 180, 0.15, 0.9);
const pitcherReliability = (currYear) => clamp(pitcherIp(currYear) / 55, 0.15, 0.9);

const blendSmallSample = (currentValue, previousValue, reliability) =>
  previousValue * (1 - reliability) + currentValue * reliability;

const iso = (stat) => {
  const slg = toNum(stat?.slg);
  const avg = toNum(stat?.avg);
  if (slg == null || avg == null) return null;
  return slg - avg;
};

const perNine = (count, innings) => {
  const c = toNum(count);
  if (c == null || !innings) return null;
  return (c * 9) / innings;
};

export function computeHitterSeasonValue({ year, sab, cast }) {
  const pa = hitterPa(year);
  const strikeoutRate = ratePct(year?.strikeOuts, year?.plateAppearances);
  const walkRate = ratePct(year?.baseOnBalls, year?.plateAppearances);
  const discipline = strikeoutRate == null || walkRate == null ? null : walkRate - strikeoutRate;
  const sb = toNum(year?.stolenBases) ?? 0;
  const cs = toNum(year?.caughtStealing) ?? 0;
  const speedRuns = pa ? ((sb * 0.2 - cs * 0.4) / pa) * 600 : null;
  const warPer600 = pa ? ((toNum(sab?.war) ?? 0) / pa) * 600 : null;

  const quality = weightedRawMean([
    { value: normVsAverage(sab?.wRcPlus, 100, 35), weight: 0.26 },
    { value: normVsAverage(year?.ops, 0.72, 0.18), weight: 0.22 },
    { value: normVsAverage(warPer600, 2, 3), weight: 0.16 },
    { value: normVsAverage(sab?.woba ?? year?.obp, 0.315, 0.055), weight: 0.1 },
    { value: normVsAverage(cast?.xwoba, 0.315, 0.055), weight: 0.08 },
    { value: normVsAverage(iso(year), 0.16, 0.09), weight: 0.06 },
    { value: normVsAverage(cast?.hardHitPercent, 39, 10), weight: 0.04 },
    { value: normVsAverage(cast?.avgHitSpeed, 88.5, 4), weight: 0.03 },
    { value: normVsAverage(discipline, -14, 12), weight: 0.03 },
    { value: normVsAverage(speedRuns, 0, 5), weight: 0.02 },
  ]);

  return Number((quality * 100).toFixed(1));
}

export function computePitcherSeasonValue({ year, sab }) {
  const ip = pitcherIp(year);
  const k9 = toNum(year?.strikeoutsPer9Inn) ?? perNine(year?.strikeOuts, ip);
  const bb9 = toNum(year?.walksPer9Inn) ?? perNine(year?.baseOnBalls, ip);
  const hr9 = perNine(year?.homeRuns, ip);
  const warPer180 = ip ? ((toNum(sab?.war) ?? 0) / ip) * 180 : null;

  const quality = weightedRawMean([
    { value: normVsAverage(sab?.xfip ?? sab?.fip ?? year?.era, 4.1, 0.9, true), weight: 0.26 },
    { value: normVsAverage(warPer180, 2.2, 3), weight: 0.22 },
    { value: normVsAverage(year?.era, 4.2, 1.2, true), weight: 0.14 },
    { value: normVsAverage(year?.whip, 1.3, 0.25, true), weight: 0.12 },
    { value: normVsAverage(k9, 8.5, 2.5), weight: 0.1 },
    { value: normVsAverage(bb9, 3.1, 1.2, true), weight: 0.08 },
    { value: normVsAverage(hr9, 1.15, 0.45, true), weight: 0.04 },
    { value: normVsAverage(sab?.eraMinus, 100, 20, true), weight: 0.04 },
  ]);

  return Number((quality * 100).toFixed(1));
}

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

export function computePlayerImpactRating(player) {
  const isPitcher = player.group === 'pitching';
  const prevValue = isPitcher
    ? computePitcherSeasonValue({ year: player.statsPrev, sab: player.sabermetricsPrev })
    : computeHitterSeasonValue({
        year: player.statsPrev,
        sab: player.sabermetricsPrev,
        cast: player.statcastPrev,
      });
  const rawCurrentValue = isPitcher
    ? computePitcherSeasonValue({ year: player.statsCurrent, sab: player.sabermetricsCurrent })
    : computeHitterSeasonValue({
        year: player.statsCurrent,
        sab: player.sabermetricsCurrent,
        cast: player.statcastCurrent,
      });
  const sampleReliability = isPitcher
    ? pitcherReliability(player.statsCurrent)
    : hitterReliability(player.statsCurrent);
  const roleWeight = isPitcher
    ? pitcherRoleWeight(player.statsPrev, player.statsCurrent)
    : hitterRoleWeight(player.statsPrev, player.statsCurrent);
  const currentValue = blendSmallSample(rawCurrentValue, prevValue, sampleReliability);
  const deltaScore = clamp((currentValue - prevValue) * roleWeight, -100, 100);

  return {
    deltaScore: Number(deltaScore.toFixed(1)),
    prevValue: Number(prevValue.toFixed(1)),
    rawCurrentValue: Number(rawCurrentValue.toFixed(1)),
    currentValue: Number(currentValue.toFixed(1)),
    roleWeight: Number(roleWeight.toFixed(2)),
    sampleReliability: Number(sampleReliability.toFixed(2)),
  };
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
          fetchPlayerSabermetrics(mover.playerId, PREVIOUS_SEASON, mover.group),
          fetchPlayerSabermetrics(mover.playerId, CURRENT_SEASON, mover.group),
          mover.group === 'hitting' ? fetchPlayerStatcastBatting(mover.playerId, PREVIOUS_SEASON) : null,
          mover.group === 'hitting' ? fetchPlayerStatcastBatting(mover.playerId, CURRENT_SEASON) : null,
        ]);

        const payload = {
          ...mover,
          sabermetricsPrev: prevSab,
          sabermetricsCurrent: currSab,
          statcastPrev: prevCast,
          statcastCurrent: currCast,
        };
        const impact = computePlayerImpactRating(payload);
        return {
          ...payload,
          ...impact,
          legacyDeltaScore: computePlayerDeltaScore(payload),
          scoreTone: getScoreTone(impact.deltaScore),
        };
      }),
    );
    enriched.push(...scored);
  }

  return enriched;
}
