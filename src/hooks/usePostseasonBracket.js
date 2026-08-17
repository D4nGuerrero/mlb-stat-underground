import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchStatsApiJson } from '../lib/mlb/client';
import {
  CURRENT_CALENDAR_YEAR,
  isStrikeCancelledYear,
  normalizePostseasonPayload,
} from '../utils/postseason';

const LIVE_POLL_MS = 15_000;

export function usePostseasonBracket(year) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

  const cancelled = isStrikeCancelledYear(year);
  const isCurrentYear = Number(year) === CURRENT_CALENDAR_YEAR;
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (cancelled) return undefined;

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let pollId = 0;

    const load = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchStatsApiJson('/api/v1/schedule/postseason/series', {
          query: {
            season: String(year),
            sportId: 1,
            hydrate: 'team,linescore,decisions,probablePitcher',
          },
          ttl: isCurrentYear ? 8_000 : 30 * 60_000,
          retries: 1,
          signal: controller.signal,
        });
        if (requestIdRef.current !== requestId) return;
        setRaw(data);
        setError(null);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (requestIdRef.current !== requestId) return;
        setError(err?.message || 'Failed to load postseason');
      } finally {
        if (!silent && requestIdRef.current === requestId) setLoading(false);
      }
    };

    void load();

    if (isCurrentYear) {
      pollId = window.setInterval(() => {
        void load({ silent: true });
      }, LIVE_POLL_MS);
    }

    return () => {
      controller.abort();
      if (pollId) window.clearInterval(pollId);
    };
  }, [year, cancelled, isCurrentYear, reloadToken]);

  const bracket = useMemo(
    () => normalizePostseasonPayload(cancelled ? null : raw, year),
    [raw, year, cancelled],
  );

  return {
    bracket,
    loading: cancelled ? false : loading,
    error: cancelled ? null : error,
    cancelled,
    reload,
  };
}
