const WATCH_TYPES = new Set(['TV', 'INTERNET']);
const LISTEN_TYPES = new Set(['FM', 'AM']);

async function fetchPersonStats(personId, params) {
  const qs = new URLSearchParams({ sportId: '1', ...params });
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/people/${personId}/stats?${qs}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.stats?.[0]?.splits ?? [];
}

function formatRate(value) {
  if (value == null || Number.isNaN(value)) return '.000';
  const fixed = value.toFixed(3);
  return fixed.startsWith('0') ? fixed.slice(1) : fixed;
}

function aggregateBatterStat(stat) {
  return {
    atBats: Number(stat?.atBats) || 0,
    homeRuns: Number(stat?.homeRuns) || 0,
    rbi: Number(stat?.rbi) || 0,
    hits: Number(stat?.hits) || 0,
    doubles: Number(stat?.doubles) || 0,
    triples: Number(stat?.triples) || 0,
    baseOnBalls: Number(stat?.baseOnBalls) || 0,
    hitByPitch: Number(stat?.hitByPitch) || 0,
    sacFlies: Number(stat?.sacFlies) || 0,
  };
}

function mergeBatterStats(target, stat) {
  const next = aggregateBatterStat(stat);
  return {
    atBats: target.atBats + next.atBats,
    homeRuns: target.homeRuns + next.homeRuns,
    rbi: target.rbi + next.rbi,
    hits: target.hits + next.hits,
    doubles: target.doubles + next.doubles,
    triples: target.triples + next.triples,
    baseOnBalls: target.baseOnBalls + next.baseOnBalls,
    hitByPitch: target.hitByPitch + next.hitByPitch,
    sacFlies: target.sacFlies + next.sacFlies,
  };
}

function finalizeBatterStat(totals) {
  const ab = totals.atBats;
  const h = totals.hits;
  const bb = totals.baseOnBalls;
  const hbp = totals.hitByPitch;
  const sf = totals.sacFlies;
  const pa = ab + bb + hbp + sf;
  const singles = h - totals.doubles - totals.triples - totals.homeRuns;
  const slg = ab > 0
    ? (singles + 2 * totals.doubles + 3 * totals.triples + 4 * totals.homeRuns) / ab
    : 0;
  const obp = pa > 0 ? (h + bb + hbp) / pa : 0;
  return {
    ...totals,
    avg: ab > 0 ? formatRate(h / ab) : '.000',
    ops: formatRate(obp + slg),
  };
}

function mapBatterMatchupSplits(splits) {
  const byId = new Map();

  for (const split of splits ?? []) {
    if (!split.batter?.id) continue;
    const id = split.batter.id;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        batterId: id,
        lastName: split.batter.lastName ?? split.batter.fullName?.split(' ').slice(-1)[0] ?? '—',
        fullName: split.batter.fullName,
        totals: mergeBatterStats(
          { atBats: 0, homeRuns: 0, rbi: 0, hits: 0, doubles: 0, triples: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0 },
          split.stat,
        ),
      });
    } else {
      existing.totals = mergeBatterStats(existing.totals, split.stat);
    }
  }

  return [...byId.values()]
    .map((row) => ({ ...row, stat: finalizeBatterStat(row.totals) }))
    .filter((row) => row.stat.atBats > 0)
    .sort((a, b) => b.stat.atBats - a.stat.atBats);
}

async function fetchOpposingBatterMatchups(pitcherId, opposingTeamId, season) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/${opposingTeamId}/roster?rosterType=active&season=${season}`,
  );
  if (!res.ok) return [];
  const roster = (await res.json()).roster ?? [];
  const hitters = roster.filter((entry) => entry.position?.type !== 'Pitcher');

  const rows = await Promise.all(
    hitters.map(async (entry) => {
      const splits = await fetchPersonStats(entry.person.id, {
        stats: 'vsPlayerTotal',
        group: 'hitting',
        opposingPlayerId: String(pitcherId),
      });
      const stat = splits?.[0]?.stat;
      if (!stat?.atBats) return null;
      return {
        batterId: entry.person.id,
        lastName: entry.person.fullName?.split(' ').slice(-1)[0] ?? '—',
        fullName: entry.person.fullName,
        stat,
      };
    }),
  );

  return rows
    .filter(Boolean)
    .sort((a, b) => (b.stat?.atBats ?? 0) - (a.stat?.atBats ?? 0));
}

export function formatGameStartDisplay(datetime, venue) {
  if (!datetime?.dateTime) {
    return { dateLine: 'Date TBD', timeLine: '' };
  }
  const tz = venue?.timeZone?.id || 'America/New_York';
  const dt = new Date(datetime.dateTime);
  const dateLine = dt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  });
  const timeLine = dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  });
  return { dateLine, timeLine };
}

export function formatVenueLine(venue) {
  if (!venue?.name) return null;
  const loc = venue.location;
  const city = loc?.city;
  const state = loc?.stateAbbrev || loc?.state;
  if (city && state) return `${venue.name} · ${city}, ${state}`;
  return venue.name;
}

export function partitionBroadcasts(broadcasts) {
  const watch = [];
  const listen = [];
  for (const b of broadcasts ?? []) {
    const type = String(b.type ?? '').toUpperCase();
    if (WATCH_TYPES.has(type)) watch.push(b.name);
    else if (LISTEN_TYPES.has(type)) listen.push(b.name);
  }
  return {
    watch: [...new Set(watch.filter(Boolean))],
    listen: [...new Set(listen.filter(Boolean))],
  };
}

export async function fetchGameBroadcasts(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?gamePk=${gamePk}&hydrate=broadcasts(all)`,
  );
  if (!res.ok) return [];
  const game = (await res.json()).dates?.[0]?.games?.[0];
  return game?.broadcasts ?? [];
}

export async function fetchProbablePitcherCard(pitcherRef, opposingTeamId, season) {
  if (!pitcherRef?.id) {
    return { tbd: true };
  }

  const id = pitcherRef.id;

  try {
    const [personRes, seasonSplits, vsTeamTotalSplits, vsTeamSplits] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}`),
      fetchPersonStats(id, { stats: 'season', group: 'pitching', season: String(season) }),
      opposingTeamId
        ? fetchPersonStats(id, {
            stats: 'vsTeamTotal',
            group: 'pitching',
            opposingTeamId: String(opposingTeamId),
          })
        : Promise.resolve([]),
      opposingTeamId
        ? fetchPersonStats(id, {
            stats: 'vsTeam',
            group: 'pitching',
            opposingTeamId: String(opposingTeamId),
          })
        : Promise.resolve([]),
    ]);

    const person = personRes.ok ? (await personRes.json()).people?.[0] : null;
    const seasonStat = seasonSplits?.[0]?.stat ?? null;
    const vsTeamStat = vsTeamTotalSplits?.[0]?.stat ?? null;
    let batterMatchups = mapBatterMatchupSplits(vsTeamSplits);
    if (!batterMatchups.length && opposingTeamId) {
      batterMatchups = await fetchOpposingBatterMatchups(id, opposingTeamId, season);
    }

    return {
      tbd: false,
      id: person?.id ?? id,
      fullName: person?.fullName ?? pitcherRef.fullName,
      lastName: person?.lastName ?? pitcherRef.fullName?.split(' ').slice(-1)[0] ?? '—',
      pitchHand: person?.pitchHand?.code ?? null,
      number: person?.primaryNumber ?? null,
      seasonStat,
      vsTeamStat,
      batterMatchups,
    };
  } catch {
    return {
      tbd: false,
      id,
      fullName: pitcherRef.fullName,
      lastName: pitcherRef.fullName?.split(' ').slice(-1)[0] ?? '—',
      batterMatchups: [],
    };
  }
}

export async function loadGamePreviewData({
  gamePk,
  probablePitchers,
  awayTeamId,
  homeTeamId,
  season,
}) {
  const [broadcasts, awayPitcher, homePitcher] = await Promise.all([
    fetchGameBroadcasts(gamePk),
    fetchProbablePitcherCard(probablePitchers?.away, homeTeamId, season),
    fetchProbablePitcherCard(probablePitchers?.home, awayTeamId, season),
  ]);

  return {
    broadcasts: partitionBroadcasts(broadcasts),
    awayPitcher,
    homePitcher,
  };
}

export function formatPitcherHand(hand) {
  if (!hand) return '—';
  const code = String(hand).toUpperCase();
  if (code === 'R' || code === 'L' || code === 'S') return `${code}HP`;
  return code;
}

export function formatPitcherSeasonLine(seasonStat) {
  if (!seasonStat) return null;
  const wl = `${seasonStat.wins ?? 0} - ${seasonStat.losses ?? 0}`;
  const era = seasonStat.era != null ? `${parseFloat(seasonStat.era).toFixed(2)} ERA` : null;
  const k = seasonStat.strikeOuts != null ? `${seasonStat.strikeOuts} K` : null;
  return [wl, era, k].filter(Boolean).join(' | ');
}

export function formatMatchupStat(stat) {
  if (!stat || (stat.atBats == null && stat.plateAppearances == null)) return null;
  return {
    hr: stat.homeRuns ?? 0,
    rbi: stat.rbi ?? 0,
    ab: stat.atBats ?? 0,
    avg: stat.avg ?? '.000',
    ops: stat.ops ?? '.000',
  };
}