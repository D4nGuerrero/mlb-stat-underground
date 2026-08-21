import { useEffect, useState } from 'react';
import { fetchStatsApiJson } from '../lib/mlb/client';
import { mlbTeams } from '../utils/mlbHelpers';
import {
  CURRENT_CALENDAR_YEAR,
  appearanceFromBracket,
  normalizePostseasonPayload,
  parseAllWsChampByTeam,
} from '../utils/postseason';
import { buildTeamFactSource } from '../utils/postseasonFacts';

const FACTS_TTL_MS = 6 * 60 * 60 * 1000;
const TEAM_IDS = mlbTeams.map((team) => team.id);

let moduleCache = { at: 0, sources: null };

function fetchRoundYears(teamId, gameType, signal) {
  return fetchStatsApiJson(`/api/v1/teams/${teamId}/stats`, {
    query: {
      stats: 'yearByYear',
      group: 'hitting',
      gameType,
      sportIds: 1,
    },
    ttl: FACTS_TTL_MS,
    retries: 1,
    signal,
  }).catch((err) => {
    if (err?.name === 'AbortError') throw err;
    return null;
  });
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  };
  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => worker()));
  return out;
}

function mergeLiveAppearance(source, live) {
  if (!live) return source;
  const year = Number(live.year);
  const nextYears = { ...source.yearsByType };
  const add = (key) => {
    if (!nextYears[key].includes(year)) nextYears[key] = [year, ...nextYears[key]];
  };
  add('P');
  if (live.gameType === 'W') add('W');
  if (live.gameType === 'L' || live.gameType === 'C') add('L');
  if (live.gameType === 'D') add('D');
  if (live.gameType === 'F') add('F');
  const appearances = [live, ...source.appearances.filter((item) => item.year !== year)];
  const titles = live.wonWs && !source.titles.includes(year)
    ? [year, ...source.titles]
    : source.titles;
  return { ...source, yearsByType: nextYears, appearances, titles };
}

export function usePostseasonFacts(enabled = true) {
  const [state, setState] = useState(() => (
    moduleCache.sources
      ? { sources: moduleCache.sources, loading: false, error: null }
      : { sources: [], loading: Boolean(enabled), error: null }
  ));

  useEffect(() => {
    if (!enabled && !moduleCache.sources) return undefined;

    const fresh = moduleCache.sources && (Date.now() - moduleCache.at) < FACTS_TTL_MS;
    if (fresh) {
      setState({ sources: moduleCache.sources, loading: false, error: null });
      return undefined;
    }

    setState((prev) => ({
      sources: prev.sources,
      loading: !prev.sources.length,
      error: null,
    }));

    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        const champPayload = await fetchStatsApiJson('/api/v1/awards/WSCHAMP/recipients', {
          query: { fields: 'awards,season,team,id' },
          ttl: FACTS_TTL_MS,
          retries: 1,
          signal: controller.signal,
        }).catch(() => null);
        const titlesByTeam = champPayload ? parseAllWsChampByTeam(champPayload) : new Map();

        const paint = (sources) => {
          if (!active) return;
          moduleCache = { at: Date.now(), sources };
          setState({ sources, loading: false, error: null });
        };

        const byTeamType = {};
        const firstPass = await mapPool(TEAM_IDS, 8, async (teamId) => {
          const payload = await fetchRoundYears(teamId, 'P', controller.signal);
          byTeamType[teamId] = { P: payload };
          return buildTeamFactSource(teamId, byTeamType[teamId], titlesByTeam.get(teamId) ?? new Set());
        });
        paint(firstPass);

        const remaining = ['W', 'L', 'D', 'F'];
        const full = await mapPool(TEAM_IDS, 8, async (teamId) => {
          const extra = await Promise.all(
            remaining.map((type) => fetchRoundYears(teamId, type, controller.signal)),
          );
          extra.forEach((payload, index) => {
            byTeamType[teamId][remaining[index]] = payload;
          });
          return buildTeamFactSource(teamId, byTeamType[teamId], titlesByTeam.get(teamId) ?? new Set());
        });
        const sources = full;

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
          const bracket = normalizePostseasonPayload(current, CURRENT_CALENDAR_YEAR);
          for (let i = 0; i < sources.length; i += 1) {
            const live = appearanceFromBracket(bracket, sources[i].teamId);
            if (live) sources[i] = mergeLiveAppearance(sources[i], live);
          }
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }

        if (!active) return;
        moduleCache = { at: Date.now(), sources };
        setState({ sources, loading: false, error: null });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (!active) return;
        setState((prev) => ({
          sources: prev.sources,
          loading: false,
          error: err?.message || 'Failed to load October facts',
        }));
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled]);

  return state;
}
