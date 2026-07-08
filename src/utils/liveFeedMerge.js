/** Whether a feed has the minimum structure required to render GameDay. */
export function isValidLiveFeed(feed) {
  return Boolean(
    feed?.gameData?.status &&
    feed?.gameData?.teams?.away &&
    feed?.gameData?.teams?.home &&
    feed?.liveData,
  );
}

/** Compare MLB timecodes (YYYYMMDD_HHMMSS). Returns negative if a < b. */
export function compareTimecodes(a, b) {
  if (!a || !b) return 0;
  return String(a).localeCompare(String(b));
}

const RUNNER_SLOTS = ['first', 'second', 'third', 'onFirst', 'onSecond', 'onThird'];

function clearStaleRunners(offense, patchOffense) {
  if (!offense) return offense;
  const cleared = { ...offense };
  for (const slot of RUNNER_SLOTS) {
    cleared[slot] = patchOffense?.[slot] ?? null;
  }
  return cleared;
}

function mergeLinescore(prev, next) {
  const merged = deepMerge(prev, next);
  if (!next || typeof next !== 'object') return merged;

  const outs = next.outs ?? merged.outs;
  const inningChanged =
    (next.currentInning != null && prev?.currentInning != null && next.currentInning !== prev.currentInning)
    || (next.inningHalf != null && prev?.inningHalf != null && next.inningHalf !== prev.inningHalf);

  if (outs >= 3 || (outs === 0 && inningChanged)) {
    merged.offense = clearStaleRunners(merged.offense, next.offense);
  }

  return merged;
}

function deepMerge(prev, next) {
  if (next == null) return prev;
  if (prev == null) return next;
  if (Array.isArray(next)) return next;
  if (typeof next !== 'object') return next;

  const result = { ...prev };
  for (const key of Object.keys(next)) {
    const nv = next[key];
    if (nv === undefined) continue;
    const pv = prev[key];
    if (
      key === 'currentPlay' &&
      nv !== null &&
      typeof nv === 'object' &&
      pv !== null &&
      typeof pv === 'object' &&
      nv.about?.atBatIndex != null &&
      pv.about?.atBatIndex != null &&
      nv.about.atBatIndex !== pv.about.atBatIndex
    ) {
      if (Number(nv.about.atBatIndex) < Number(pv.about.atBatIndex)) {
        result[key] = pv;
        continue;
      }
      // A new at-bat can arrive before MLB includes its first playEvents array.
      // Replace instead of deep-merging so the previous at-bat's final pitch
      // cannot flash back into the live visual under the new currentPlay.
      result[key] = nv;
      continue;
    }
    if (key === 'linescore' && nv !== null && typeof nv === 'object') {
      result[key] = mergeLinescore(pv ?? {}, nv);
      continue;
    }
    if (Array.isArray(nv)) {
      result[key] = nv;
    } else if (
      nv !== null &&
      typeof nv === 'object' &&
      pv !== null &&
      typeof pv === 'object' &&
      !Array.isArray(pv)
    ) {
      result[key] = deepMerge(pv, nv);
    } else {
      result[key] = nv;
    }
  }
  return result;
}

/**
 * Merge a diffPatch (or full) response into the existing live feed.
 * Keeps prior sections when the patch omits them so partial payloads cannot blank the UI.
 */
export function mergeLiveFeed(prev, patch, options = {}) {
  if (!patch) return prev ?? null;
  if (!prev) return patch;

  const liveData = patch.liveData ? deepMerge(prev.liveData, patch.liveData) : prev.liveData;
  if (options.replaceLinescore && patch.liveData?.linescore) {
    liveData.linescore = patch.liveData.linescore;
  }

  return {
    ...prev,
    ...patch,
    metaData: patch.metaData ?? prev.metaData,
    gameData: patch.gameData ? deepMerge(prev.gameData, patch.gameData) : prev.gameData,
    liveData,
  };
}
