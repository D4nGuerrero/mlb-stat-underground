import { useEffect, useState } from 'react';

export function useDaySchedule(officialDate, normalizeGames) {
  const [daySchedule, setDaySchedule] = useState([]);

  useEffect(() => {
    if (!officialDate) return undefined;

    let cancelled = false;
    fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${officialDate}&hydrate=team(record),linescore`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const games = normalizeGames((json.dates ?? []).flatMap((d) => d.games ?? []));
        setDaySchedule(games);
      })
      .catch(() => {
        if (!cancelled) setDaySchedule([]);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizeGames, officialDate]);

  return {
    daySchedule,
    dayScheduleLoading: Boolean(officialDate) && daySchedule.length === 0,
  };
}
