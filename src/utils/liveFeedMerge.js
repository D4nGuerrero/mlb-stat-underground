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
export function mergeLiveFeed(prev, patch) {
  if (!patch) return prev ?? null;
  if (!prev) return patch;

  return {
    ...prev,
    ...patch,
    metaData: patch.metaData ?? prev.metaData,
    gameData: patch.gameData ? deepMerge(prev.gameData, patch.gameData) : prev.gameData,
    liveData: patch.liveData ? deepMerge(prev.liveData, patch.liveData) : prev.liveData,
  };
}