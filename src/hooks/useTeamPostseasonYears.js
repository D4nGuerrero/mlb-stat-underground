import { useEffect, useState } from 'react';
import { fetchStatsApiJson } from '../lib/mlb/client';
import {
  CURRENT_CALENDAR_YEAR,
  appearanceFromBracket,
  normalizePostseasonPayload,
  parseTeamPostseasonAppearances,
  parseWsChampYears,
} from '../utils/postseason';

const YEARS_TTL_MS = 6 * 60 * 60 * 1000;
const ROUND_TYPES = ['F', 'D', 'L', 'W', 'P'];

function fetchRoundYears(teamId, gameType, signal) {
  return fetchStatsApiJson(`/api/v1/teams/${teamId}/stats`, {
    query: {
      stats: 'yearByYear',
      group: 'hitting',
      gameType,
      sportIds: 1,
    },
    ttl: YEARS_TTL_MS,
    retries: 1,
    signal,
  }).catch((err) => {
    // MLB 404s a gameType the club never played (SEA has no WS, LAA has no WC).
    if (err?.name === 'AbortError') throw err;
    return null;
  });
}

function fetchWsChampions(signal) {
  return fetchStatsApiJson('/api/v1/awards/WSCHAMP/recipients', {
    query: { fields: 'awards,season,team,id' },
    ttl: YEARS_TTL_MS,
    retries: 1,
    signal,
  });
}

export function useTeamPostseasonYears(teamId) {
  const [cache, setCache] = useState({
    teamId: null,
    years: [],
    appearances: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!teamId) return undefined;

    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        const [roundPayloads, champPayload] = await Promise.all([
          Promise.all(ROUND_TYPES.map((type) => fetchRoundYears(teamId, type, controller.signal))),
          fetchWsChampions(controller.signal).catch(() => null),
        ]);
        if (!active) return;

        const byType = Object.fromEntries(
          ROUND_TYPES.map((type, index) => [type, roundPayloads[index]]),
        );
        let appearances = parseTeamPostseasonAppearances({
          byType,
          champYears: champPayload ? parseWsChampYears(champPayload, teamId) : new Set(),
          teamId,
        });

        try {
          const current = await fetchStatsApiJson('/api/v1/schedule/postseason/series', {
            query: {
              season: String(CURRENT_CALENDAR_YEAR),
              sportId: 1,
              hydrate: 'team',
            },
            ttl: 8_000,
            retries: 1,
            signal: controller.signal,
          });
          if (!active) return;
          const bracket = normalizePostseasonPayload(current, CURRENT_CALENDAR_YEAR);
          const live = appearanceFromBracket(bracket, teamId);
          if (live) {
            appearances = [live, ...appearances.filter((item) => item.year !== live.year)];
          }
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }

        appearances.sort((a, b) => b.year - a.year);
        setCache({
          teamId,
          years: appearances.map((item) => item.year),
          appearances,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (!active) return;
        setCache({
          teamId,
          years: [],
          appearances: [],
          loading: false,
          error: err?.message || 'Failed to load team postseasons',
        });
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [teamId]);

  if (!teamId) return { years: [], appearances: [], loading: false, error: null };
  if (cache.teamId !== teamId) return { years: [], appearances: [], loading: true, error: null };
  return {
    years: cache.years,
    appearances: cache.appearances,
    loading: cache.loading,
    error: cache.error,
  };
}
