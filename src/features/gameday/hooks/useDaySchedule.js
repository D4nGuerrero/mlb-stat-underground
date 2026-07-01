import { useEffect, useState } from 'react';

export function useDaySchedule(officialDate, normalizeGames, sportId = 1) {
  const [daySchedule, setDaySchedule] = useState([]);
  const [dayScheduleLoading, setDayScheduleLoading] = useState(false);

  useEffect(() => {
    if (!officialDate) return undefined;

    let cancelled = false;
    setDaySchedule([]);
    setDayScheduleLoading(true);
    fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId || 1}&date=${officialDate}&hydrate=team(record),linescore`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const games = normalizeGames((json.dates ?? []).flatMap((d) => d.games ?? []));
        setDaySchedule(games);
        setDayScheduleLoading(false);
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
  }, [normalizeGames, officialDate, sportId]);

  return {
    daySchedule,
    dayScheduleLoading,
  };
}
