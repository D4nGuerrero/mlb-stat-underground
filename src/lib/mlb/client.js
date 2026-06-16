const responseCache = new Map();
const inFlightRequests = new Map();

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
    }),
  ]);
}

function normalizeHeaders(headers) {
  if (!headers) return '';
  if (headers instanceof Headers) return [...headers.entries()].sort().map(([k, v]) => `${k}:${v}`).join('|');
  return Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|');
}

function buildCacheKey(url, init = {}) {
  return [
    init.method ?? 'GET',
    url,
    normalizeHeaders(init.headers),
    init.body ?? '',
  ].join('::');
}

function shouldRetry(error, attempt, retries) {
  if (attempt >= retries) return false;
  if (error?.name === 'AbortError') return false;
  if (typeof error?.status === 'number') return error.status >= 500;
  return true;
}

async function fetchWithRetry(url, init, retries) {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response;
    } catch (error) {
      if (!shouldRetry(error, attempt, retries)) throw error;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

export async function fetchJson(url, options = {}) {
  const {
    ttl = 0,
    retries = 0,
    signal,
    cacheKey = buildCacheKey(url, options),
    ...init
  } = options;

  const now = Date.now();
  const cached = ttl > 0 ? responseCache.get(cacheKey) : null;
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (signal?.aborted) throw createAbortError();

  let requestPromise = inFlightRequests.get(cacheKey);
  if (!requestPromise) {
    requestPromise = (async () => {
      const response = await fetchWithRetry(url, init, retries);
      const data = await response.json();
      if (ttl > 0) {
        responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
      }
      return data;
    })().finally(() => {
      inFlightRequests.delete(cacheKey);
    });

    inFlightRequests.set(cacheKey, requestPromise);
  }

  return raceWithAbort(requestPromise, signal);
}

export function statsApiUrl(path, query) {
  const qs = query instanceof URLSearchParams ? query.toString() : new URLSearchParams(query).toString();
  return `https://statsapi.mlb.com${path}${qs ? `?${qs}` : ''}`;
}

export function fetchStatsApiJson(path, options = {}) {
  const { query, ...rest } = options;
  return fetchJson(statsApiUrl(path, query), rest);
}

export function clearMlbCache(prefix = '') {
  for (const key of responseCache.keys()) {
    if (!prefix || key.includes(prefix)) responseCache.delete(key);
  }
}
