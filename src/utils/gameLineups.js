import { compactPlayerName } from './mlbHelpers';

export function parseLineupPlayers(players = []) {
  return players.map((player, index) => ({
    id: player.id,
    fullName: player.fullName,
    lastName: compactPlayerName(player),
    useName: player.useName,
    position: player.primaryPosition?.abbreviation ?? '—',
    battingOrder: index + 1,
  }));
}

export function lineupsAvailable(lineups) {
  return Boolean(lineups?.away?.length && lineups?.home?.length);
}

export async function fetchGameLineups(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?gamePk=${gamePk}&hydrate=lineups`,
  );
  if (!res.ok) return null;

  const game = (await res.json()).dates?.[0]?.games?.[0];
  const raw = game?.lineups;
  if (!raw?.awayPlayers?.length && !raw?.homePlayers?.length) return null;

  return {
    away: parseLineupPlayers(raw.awayPlayers ?? []),
    home: parseLineupPlayers(raw.homePlayers ?? []),
  };
}
