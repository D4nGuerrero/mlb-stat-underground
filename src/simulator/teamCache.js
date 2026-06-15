import { loadTeamForGame } from './roster';

const cache = new Map();

function cacheKey(teamId, season, mode, context = {}) {
  return [
    teamId,
    season,
    mode,
    context.isHome ? 'H' : 'A',
    context.opposingHand || 'R',
  ].join(':');
}

export async function getCachedTeam(team, season, context, mode = 'realistic') {
  const key = cacheKey(team.id, season, mode, context);
  if (!cache.has(key)) {
    cache.set(key, loadTeamForGame(team, season, context, mode));
  }
  return cache.get(key);
}

export function clearTeamCache() {
  cache.clear();
}

export function rotationStarters(bundle) {
  const pitchers = bundle?.pitchers?.length
    ? bundle.pitchers
    : [bundle?.starter].filter(Boolean);
  return pitchers.slice(0, 5);
}