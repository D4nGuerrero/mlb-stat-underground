import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isMlbLeagueLevel,
  leagueLevelLeagueId,
  leagueLevelSportId,
} from '../constants/leagueLevels.js';
import { fetchStatsApiJson } from '../lib/mlb/client';
import {
  CURRENT_CALENDAR_YEAR,
  groupScheduleGamesAsSeries,
  isStrikeCancelledYear,
  normalizePostseasonPayload,
  scheduleGamesFromPayload,
} from '../utils/postseason';

const LIVE_POLL_MS = 15_000;
const POSTSEASON_GAME_TYPES = 'F,D,L,W,C';

function fetchMlbSeries(year, { signal, ttl }) {
  return fetchStatsApiJson('/api/v1/schedule/postseason/series', {
    query: {
      season: String(year),
      sportId: 1,
      hydrate: 'team,linescore,decisions,probablePitcher',
    },
    ttl,
    retries: 1,
    signal,
  });
}

function fetchMinorSeries(year, level, { signal, ttl }) {
  const sportId = leagueLevelSportId(level);
  const leagueId = leagueLevelLeagueId(level);
  const query = {
    sportId,
    hydrate: 'team,linescore,decisions,probablePitcher',
    gameTypes: POSTSEASON_GAME_TYPES,
  };

  if (level === 'lmb') {
    query.startDate = `${year}-06-01`;
    query.endDate = `${year}-10-15`;
    if (leagueId) query.leagueId = leagueId;
  } else {
    query.season = String(year);
  }

  return fetchStatsApiJson('/api/v1/schedule', {
    query,
    ttl,
    retries: 1,
    signal,
  }).then((data) => ({
    series: groupScheduleGamesAsSeries(scheduleGamesFromPayload(data)),
  }));
}

export function usePostseasonBracket(year, { level = 'mlb' } = {}) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

  const isMlb = isMlbLeagueLevel(level);
  const cancelled = isMlb && isStrikeCancelledYear(year);
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
        const ttl = isCurrentYear ? 8_000 : 30 * 60_000;
        const data = isMlb
          ? await fetchMlbSeries(year, { signal: controller.signal, ttl })
          : await fetchMinorSeries(year, level, { signal: controller.signal, ttl });
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
  }, [year, level, cancelled, isCurrentYear, isMlb, reloadToken]);

  const bracket = useMemo(
    () => normalizePostseasonPayload(cancelled ? null : raw, year, { level }),
    [raw, year, cancelled, level],
  );

  return {
    bracket,
    loading: cancelled ? false : loading,
    error: cancelled ? null : error,
    cancelled,
    reload,
  };
}
