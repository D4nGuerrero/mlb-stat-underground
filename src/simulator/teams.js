import { mlbTeams } from '../utils/mlbHelpers';

const TEAM_BY_ID = Object.fromEntries(mlbTeams.map((team) => [team.id, team]));

export function resolveTeam(apiTeam) {
  if (!apiTeam?.id) return null;
  const known = TEAM_BY_ID[apiTeam.id];
  if (known) return known;
  return {
    id: apiTeam.id,
    name: apiTeam.name || apiTeam.teamName || 'Unknown',
    abbr: apiTeam.abbreviation || apiTeam.teamName?.slice(0, 3)?.toUpperCase() || '???',
  };
}

export function resolveTeamById(teamId) {
  return TEAM_BY_ID[teamId] ?? null;
}