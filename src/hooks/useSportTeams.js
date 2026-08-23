import { useEffect, useState } from 'react';
import {
  isMlbLeagueLevel,
  leagueLevelLeagueId,
  leagueLevelSportId,
} from '../constants/leagueLevels.js';
import { fetchStatsApiJson } from '../lib/mlb/client';

const TEAMS_TTL_MS = 6 * 60 * 60 * 1000;

export function useSportTeams(level, season) {
  const [cache, setCache] = useState({
    key: null,
    teams: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!level || isMlbLeagueLevel(level) || !season) return undefined;

    const sportId = leagueLevelSportId(level);
    const leagueId = leagueLevelLeagueId(level);
    const key = `${level}:${season}`;
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      setCache((prev) => (
        prev.key === key ? prev : { key, teams: [], loading: true, error: null }
      ));
      try {
        const query = { sportId, season: String(season) };
        if (leagueId) query.leagueIds = leagueId;
        const data = await fetchStatsApiJson('/api/v1/teams', {
          query,
          ttl: TEAMS_TTL_MS,
          retries: 1,
          signal: controller.signal,
        });
        if (!active) return;
        const teams = (data?.teams ?? [])
          .filter((team) => team?.id && team?.name)
          .map((team) => ({
            id: Number(team.id),
            name: team.name,
            abbr: team.abbreviation || team.teamCode || team.name,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCache({ key, teams, loading: false, error: null });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (!active) return;
        setCache({
          key,
          teams: [],
          loading: false,
          error: err?.message || 'Failed to load teams',
        });
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [level, season]);

  if (!level || isMlbLeagueLevel(level)) {
    return { teams: [], loading: false, error: null };
  }
  const key = `${level}:${season}`;
  if (cache.key !== key) return { teams: [], loading: true, error: null };
  return cache;
}
