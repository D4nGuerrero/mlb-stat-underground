import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const LIVE_SCHEDULE_REFRESH_MS = 10_000;

function scheduleHasActiveGames(games = []) {
  return games.some((game) => {
    const state = game?.status?.abstractGameState;
    return state === 'Live' || state === 'Preview';
  });
}

export function useDaySchedule(officialDate, normalizeGames, sportId = 1) {
  const [daySchedule, setDaySchedule] = useState([]);
  const [dayScheduleLoading, setDayScheduleLoading] = useState(false);
  const [lastLoadedKey, setLastLoadedKey] = useState(null);
  const requestSeqRef = useRef(0);
  const scheduleKey = useMemo(
    () => officialDate ? `${sportId || 1}:${officialDate}` : null,
    [officialDate, sportId],
  );

  const fetchDaySchedule = useCallback(async ({ showLoading = false } = {}) => {
    if (!officialDate) return;

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    if (showLoading) setDayScheduleLoading(true);
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId || 1}&date=${officialDate}&hydrate=team(record),linescore`);
      const json = await response.json();
      const games = normalizeGames((json.dates ?? []).flatMap((d) => d.games ?? []));
      if (requestSeq !== requestSeqRef.current) return;
      setDaySchedule(games);
      setLastLoadedKey(scheduleKey);
    } finally {
      if (showLoading && requestSeq === requestSeqRef.current) setDayScheduleLoading(false);
    }
  }, [normalizeGames, officialDate, scheduleKey, sportId]);

  useEffect(() => {
    if (!officialDate) return undefined;

    let cancelled = false;
    setDaySchedule([]);
    setDayScheduleLoading(true);
    fetchDaySchedule()
      .then(() => {
        if (!cancelled) setDayScheduleLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setDaySchedule([]);
          setDayScheduleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDaySchedule, officialDate]);

  useEffect(() => {
    if (!officialDate || !scheduleHasActiveGames(daySchedule)) return undefined;

    const id = setInterval(() => {
      void fetchDaySchedule();
    }, LIVE_SCHEDULE_REFRESH_MS);

    return () => clearInterval(id);
  }, [daySchedule, fetchDaySchedule, officialDate]);

  useEffect(() => {
    if (!officialDate) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void fetchDaySchedule();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [fetchDaySchedule, officialDate]);

  return {
    daySchedule,
    dayScheduleLoading,
    refreshDaySchedule: fetchDaySchedule,
    dayScheduleStale: Boolean(scheduleKey && lastLoadedKey && scheduleKey !== lastLoadedKey),
  };
}
