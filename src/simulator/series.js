import { simulateGame } from './game';
import { getCachedTeam, rotationStarters } from './teamCache';

const SERIES_HOME_PATTERNS = {
  1: [0],
  3: [0, 1, 0],
  5: [0, 0, 1, 1, 0],
  7: [0, 0, 1, 1, 0, 1, 0],
};

function winsNeeded(bestOf) {
  return Math.floor(bestOf / 2) + 1;
}

function yieldToUi(every = 3) {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && every > 0) {
      setTimeout(resolve, 0);
    } else {
      resolve();
    }
  });
}

/**
 * Load both teams for a matchup using season-specific stats, platoon-aware lineups,
 * and rotation slot starters. Shared by season, playoffs, and historical sims.
 */
export async function loadTeamsForMatchup({
  awayTeam,
  homeTeam,
  awaySeason,
  homeSeason,
  lineupMode = 'realistic',
  awayRotation = 0,
  homeRotation = 0,
}) {
  const awayPrime = await getCachedTeam(
    awayTeam,
    awaySeason,
    { isHome: false, opposingHand: 'R' },
    lineupMode,
  );
  const awayPrimeStarters = rotationStarters(awayPrime);
  const awayStarterGuess = awayPrimeStarters[awayRotation % awayPrimeStarters.length] || awayPrime.starter;

  const homePrime = await getCachedTeam(
    homeTeam,
    homeSeason,
    { isHome: true, opposingHand: awayStarterGuess?.throwsHand || 'R' },
    lineupMode,
  );
  const homePrimeStarters = rotationStarters(homePrime);
  const homeStarterGuess = homePrimeStarters[homeRotation % homePrimeStarters.length] || homePrime.starter;

  const awayBundle = await getCachedTeam(
    awayTeam,
    awaySeason,
    { isHome: false, opposingHand: homeStarterGuess?.throwsHand || 'R' },
    lineupMode,
  );
  const awayStarters = rotationStarters(awayBundle);
  const awayStarter = awayStarters[awayRotation % awayStarters.length] || awayBundle.starter;

  const homeBundle = await getCachedTeam(
    homeTeam,
    homeSeason,
    { isHome: true, opposingHand: awayStarter?.throwsHand || 'R' },
    lineupMode,
  );
  const homeStarters = rotationStarters(homeBundle);
  const homeStarter = homeStarters[homeRotation % homeStarters.length] || homeBundle.starter;

  return { awayBundle, homeBundle, awayStarter, homeStarter };
}

/** Pitch-by-pitch game using Log5 batter/pitcher matchups and season-year rosters. */
export async function simulateMatchupGame({
  awayTeam,
  homeTeam,
  season,
  awaySeason,
  homeSeason,
  lineupMode,
  awayRotation = 0,
  homeRotation = 0,
}) {
  const awayYear = awaySeason ?? season;
  const homeYear = homeSeason ?? season;

  const { awayBundle, homeBundle, awayStarter, homeStarter } = await loadTeamsForMatchup({
    awayTeam,
    homeTeam,
    awaySeason: awayYear,
    homeSeason: homeYear,
    lineupMode,
    awayRotation,
    homeRotation,
  });

  return simulateGame({
    awayTeam,
    homeTeam,
    awayLineup: awayBundle.lineup,
    homeLineup: homeBundle.lineup,
    awayStarter,
    homeStarter,
    awayBullpen: awayBundle.bullpen,
    homeBullpen: homeBundle.bullpen,
    awayBench: awayBundle.bench,
    homeBench: homeBundle.bench,
  });
}

export async function simulateSeries({
  higherSeed,
  lowerSeed,
  season,
  higherSeason,
  lowerSeason,
  lineupMode = 'realistic',
  bestOf = 7,
  label = 'Series',
  onProgress,
}) {
  const hSeason = higherSeason ?? season;
  const lSeason = lowerSeason ?? season;
  const pattern = SERIES_HOME_PATTERNS[bestOf] || SERIES_HOME_PATTERNS[7];
  const needed = winsNeeded(bestOf);
  let higherWins = 0;
  let lowerWins = 0;
  const games = [];
  let awayRotation = 0;
  let homeRotation = 0;

  while (higherWins < needed && lowerWins < needed) {
    const gameIndex = games.length;
    const higherHome = pattern[gameIndex % pattern.length] === 0;
    const homeTeam = higherHome ? higherSeed : lowerSeed;
    const awayTeam = higherHome ? lowerSeed : higherSeed;
    const gameAwaySeason = higherHome ? lSeason : hSeason;
    const gameHomeSeason = higherHome ? hSeason : lSeason;

    const result = await simulateMatchupGame({
      awayTeam,
      homeTeam,
      season,
      awaySeason: gameAwaySeason,
      homeSeason: gameHomeSeason,
      lineupMode,
      awayRotation: higherHome ? awayRotation : homeRotation,
      homeRotation: higherHome ? homeRotation : awayRotation,
    });

    const higherScore = higherHome ? result.homeScore : result.awayScore;
    const lowerScore = higherHome ? result.awayScore : result.homeScore;
    const higherWon = higherScore > lowerScore;

    if (higherWon) higherWins += 1;
    else lowerWins += 1;

    games.push({
      gameNum: gameIndex + 1,
      awayTeam,
      homeTeam,
      awaySeason: gameAwaySeason,
      homeSeason: gameHomeSeason,
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      winner: result.winner,
      higherWon,
      gameResult: result,
    });

    if (higherHome) {
      homeRotation += 1;
      awayRotation += 1;
    } else {
      awayRotation += 1;
      homeRotation += 1;
    }

    onProgress?.({
      label,
      higherSeed,
      lowerSeed,
      higherWins,
      lowerWins,
      needed,
      gameNum: games.length,
      bestOf,
    });

    await yieldToUi();
  }

  return {
    higherSeed,
    lowerSeed,
    higherSeason: hSeason,
    lowerSeason: lSeason,
    winner: higherWins > lowerWins ? higherSeed : lowerSeed,
    higherWins,
    lowerWins,
    bestOf,
    games,
  };
}