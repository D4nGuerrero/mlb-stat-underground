import { useEffect, useRef, useState } from 'react';

export function useVsStats(batterId, pitcherId) {
  const [vsStats, setVsStats] = useState(null);
  const [vsStatsByMatchup, setVsStatsByMatchup] = useState({});
  const vsStatsCacheRef = useRef({});

  useEffect(() => {
    if (!batterId || !pitcherId) return undefined;

    const key = `${batterId}-${pitcherId}`;
    if (vsStatsCacheRef.current[key] !== undefined) return undefined;

    const season = new Date().getFullYear();
    fetch(
      `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=batting,type=vsPlayerTotal,opposingPlayerId=${pitcherId},season=${season})`,
    )
      .then((r) => r.json())
      .then((data) => {
        const stat =
          data.people?.[0]?.stats?.find(
            (s) =>
              s.type?.displayName === 'vsPlayerTotal' ||
              s.type?.displayName === 'vsPlayer',
          )?.splits?.[0]?.stat || null;
        vsStatsCacheRef.current[key] = stat;
        setVsStatsByMatchup((prev) => ({ ...prev, [key]: stat }));
        setVsStats(stat);
      })
      .catch(() => {
        vsStatsCacheRef.current[key] = null;
        setVsStatsByMatchup((prev) => ({ ...prev, [key]: null }));
        setVsStats(null);
      });

    return undefined;
  }, [batterId, pitcherId]);

  const vsStatsKey = batterId && pitcherId ? `${batterId}-${pitcherId}` : null;
  const visibleVsStats = vsStatsKey
    ? (vsStatsByMatchup[vsStatsKey] ?? vsStats)
    : null;

  return { visibleVsStats };
}
