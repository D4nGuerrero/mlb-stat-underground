import { resolveTeam } from './teams';

export function isGameFinal(game) {
  const state = game.status?.abstractGameState || game.status?.codedGameState;
  return state === 'Final' || state === 'F';
}

function parseScheduleGame(day, game, teamId) {
  const homeApi = game.teams?.home?.team;
  const awayApi = game.teams?.away?.team;
  const home = resolveTeam(homeApi);
  const away = resolveTeam(awayApi);
  if (!home || !away) return null;

  const isHome = home.id === teamId;
  const isFinal = isGameFinal(game);

  return {
    gamePk: game.gamePk,
    date: day.date,
    home,
    away,
    isHome,
    opponent: isHome ? away : home,
    isFinal,
    awayScore: game.teams?.away?.score ?? null,
    homeScore: game.teams?.home?.score ?? null,
    status: game.status?.detailedState || game.status?.abstractGameState || 'Scheduled',
  };
}

export async function fetchTeamSchedule(teamId, season) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=1&gameType=R&hydrate=team`,
  );
  if (!res.ok) throw new Error(`Schedule fetch failed (${res.status})`);
  const data = await res.json();
  const games = [];

  for (const day of data.dates || []) {
    for (const game of day.games || []) {
      const parsed = parseScheduleGame(day, game, teamId);
      if (parsed) games.push(parsed);
    }
  }

  return games;
}

export async function fetchScheduleSummary(teamId, season) {
  const schedule = await fetchTeamSchedule(teamId, season);
  const completed = schedule.filter((game) => game.isFinal);
  const remaining = schedule.filter((game) => !game.isFinal);
  return { schedule, completed, remaining, total: schedule.length };
}