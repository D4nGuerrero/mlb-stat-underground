import { simulateSeries } from './series';

export async function simulateHistoricalMatchup({
  teamA,
  teamB,
  seasonA,
  seasonB,
  homeTeam,
  lineupMode = 'realistic',
  bestOf = 1,
  onProgress,
}) {
  const higherSeed = homeTeam?.id === teamA.id ? teamA : teamB;
  const lowerSeed = higherSeed.id === teamA.id ? teamB : teamA;
  const higherSeason = higherSeed.id === teamA.id ? seasonA : seasonB;
  const lowerSeason = higherSeed.id === teamA.id ? seasonB : seasonA;

  const series = await simulateSeries({
    higherSeed,
    lowerSeed,
    season: higherSeason,
    higherSeason,
    lowerSeason,
    lineupMode,
    bestOf,
    label: `${teamA.abbr} (${seasonA}) vs ${teamB.abbr} (${seasonB})`,
    onProgress,
  });

  return {
    teamA,
    teamB,
    seasonA,
    seasonB,
    bestOf,
    champion: series.winner,
    series,
  };
}