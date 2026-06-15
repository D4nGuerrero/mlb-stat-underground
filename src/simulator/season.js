import { fetchScheduleSummary } from './schedule';
import { simulateMatchupGame } from './series';

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function simulateTeamSeason({
  team,
  season,
  lineupMode = 'realistic',
  onProgress,
}) {
  const { schedule, completed, remaining } = await fetchScheduleSummary(team.id, season);
  if (!schedule.length) throw new Error('No regular-season games found for this team and year.');
  if (!remaining.length) {
    throw new Error('Season is complete — all games have final scores. Pick the current season to simulate the rest.');
  }

  let wins = 0;
  let losses = 0;
  let actualWins = 0;
  let actualLosses = 0;
  let simWins = 0;
  let simLosses = 0;
  let runsScored = 0;
  let runsAllowed = 0;
  const gameLog = [];
  const rotation = { team: completed.length, opp: completed.length };

  for (const game of completed) {
    const teamScore = game.isHome ? game.homeScore : game.awayScore;
    const oppScore = game.isHome ? game.awayScore : game.homeScore;
    const won = teamScore > oppScore;

    if (won) {
      wins += 1;
      actualWins += 1;
    } else {
      losses += 1;
      actualLosses += 1;
    }
    runsScored += teamScore;
    runsAllowed += oppScore;

    gameLog.push({
      gameNum: gameLog.length + 1,
      gamePk: game.gamePk,
      date: game.date,
      opponent: game.opponent,
      isHome: game.isHome,
      teamScore,
      oppScore,
      won,
      awayScore: game.awayScore,
      homeScore: game.homeScore,
      simulated: false,
      status: game.status,
      gameResult: null,
    });
  }

  for (let i = 0; i < remaining.length; i += 1) {
    const game = remaining[i];
    const awayTeam = game.isHome ? game.opponent : team;
    const homeTeam = game.isHome ? team : game.opponent;

    const result = await simulateMatchupGame({
      awayTeam,
      homeTeam,
      season,
      awaySeason: season,
      homeSeason: season,
      lineupMode,
      awayRotation: game.isHome ? rotation.opp : rotation.team,
      homeRotation: game.isHome ? rotation.team : rotation.opp,
    });

    const teamScore = game.isHome ? result.homeScore : result.awayScore;
    const oppScore = game.isHome ? result.awayScore : result.homeScore;
    const won = teamScore > oppScore;

    if (won) {
      wins += 1;
      simWins += 1;
    } else {
      losses += 1;
      simLosses += 1;
    }
    runsScored += teamScore;
    runsAllowed += oppScore;
    rotation.team += 1;
    rotation.opp += 1;

    gameLog.push({
      gameNum: gameLog.length + 1,
      gamePk: game.gamePk,
      date: game.date,
      opponent: game.opponent,
      isHome: game.isHome,
      teamScore,
      oppScore,
      won,
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      simulated: true,
      status: 'Simulated',
      gameResult: result,
    });

    onProgress?.({
      phase: 'simulating',
      current: i + 1,
      total: remaining.length,
      completed: completed.length,
      wins,
      losses,
      opponent: game.opponent.abbr,
    });

    if ((i + 1) % 4 === 0) await yieldToUi();
  }

  const pct = wins + losses > 0
    ? (wins / (wins + losses)).toFixed(3).replace('0.', '.')
    : '.000';

  return {
    team,
    season,
    gamesPlayed: gameLog.length,
    scheduleTotal: schedule.length,
    completedTotal: completed.length,
    remainingTotal: remaining.length,
    simulatedTotal: remaining.length,
    wins,
    losses,
    actualWins,
    actualLosses,
    simWins,
    simLosses,
    pct,
    runsScored,
    runsAllowed,
    runDiff: runsScored - runsAllowed,
    gameLog,
  };
}