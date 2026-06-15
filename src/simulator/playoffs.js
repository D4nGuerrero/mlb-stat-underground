import { resolveTeam } from './teams';
import { simulateSeries } from './series';

const LEAGUE_IDS = { AL: 103, NL: 104 };

async function fetchStandingsTeams(season) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`,
  );
  if (!res.ok) throw new Error(`Standings fetch failed (${res.status})`);
  const data = await res.json();

  const leagues = { AL: [], NL: [] };

  for (const record of data.records || []) {
    const leagueKey = record.league?.id === LEAGUE_IDS.AL ? 'AL' : 'NL';
    for (const tr of record.teamRecords || []) {
      const team = resolveTeam(tr.team);
      if (!team) continue;
      leagues[leagueKey].push({
        team,
        wins: tr.wins ?? 0,
        losses: tr.losses ?? 0,
        leagueRank: parseInt(tr.leagueRank ?? '99', 10),
        divisionRank: parseInt(tr.divisionRank ?? '99', 10),
      });
    }
  }

  leagues.AL.sort((a, b) => a.leagueRank - b.leagueRank);
  leagues.NL.sort((a, b) => a.leagueRank - b.leagueRank);

  return {
    AL: leagues.AL.slice(0, 4).map((entry) => entry.team),
    NL: leagues.NL.slice(0, 4).map((entry) => entry.team),
  };
}

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function simulatePlayoffs({
  season,
  lineupMode = 'realistic',
  onProgress,
}) {
  const seeds = await fetchStandingsTeams(season);
  if (seeds.AL.length < 4 || seeds.NL.length < 4) {
    throw new Error('Could not load enough playoff teams from standings.');
  }

  const rounds = [];

  const alDs1 = await simulateSeries({
    higherSeed: seeds.AL[0],
    lowerSeed: seeds.AL[3],
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 5,
    label: 'AL Division Series',
    onProgress,
  });
  rounds.push({ round: 'ALDS 1', ...alDs1 });
  await yieldToUi();

  const alDs2 = await simulateSeries({
    higherSeed: seeds.AL[1],
    lowerSeed: seeds.AL[2],
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 5,
    label: 'ALDS 2',
    onProgress,
  });
  rounds.push({ round: 'ALDS 2', ...alDs2 });
  await yieldToUi();

  const alCs = await simulateSeries({
    higherSeed: alDs1.winner,
    lowerSeed: alDs2.winner,
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 7,
    label: 'AL Championship',
    onProgress,
  });
  rounds.push({ round: 'ALCS', ...alCs });
  await yieldToUi();

  const nlDs1 = await simulateSeries({
    higherSeed: seeds.NL[0],
    lowerSeed: seeds.NL[3],
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 5,
    label: 'NLDS 1',
    onProgress,
  });
  rounds.push({ round: 'NLDS 1', ...nlDs1 });
  await yieldToUi();

  const nlDs2 = await simulateSeries({
    higherSeed: seeds.NL[1],
    lowerSeed: seeds.NL[2],
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 5,
    label: 'NLDS 2',
    onProgress,
  });
  rounds.push({ round: 'NLDS 2', ...nlDs2 });
  await yieldToUi();

  const nlCs = await simulateSeries({
    higherSeed: nlDs1.winner,
    lowerSeed: nlDs2.winner,
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 7,
    label: 'NL Championship',
    onProgress,
  });
  rounds.push({ round: 'NLCS', ...nlCs });
  await yieldToUi();

  const worldSeries = await simulateSeries({
    higherSeed: alCs.winner,
    lowerSeed: nlCs.winner,
    season,
    higherSeason: season,
    lowerSeason: season,
    lineupMode,
    bestOf: 7,
    label: 'World Series',
    onProgress,
  });
  rounds.push({ round: 'World Series', ...worldSeries });

  return {
    season,
    seeds,
    rounds,
    champion: worldSeries.winner,
  };
}