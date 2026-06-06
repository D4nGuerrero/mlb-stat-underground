import { CURRENT_SEASON } from './constants';

export function defaultPlayer(teamId, idx) {
  return {
    id: `${teamId}-p${idx}`,
    name: `Player ${idx + 1}`,
    pos: ['CF', 'SS', '1B', '3B', 'RF', 'LF', 'DH', '2B', 'C'][idx % 9],
    stats: null,
    pitchingStats: null,
  };
}

function statOBP(stats) {
  if (!stats) return 0.310;
  const hits = stats.hits || 0;
  const walks = stats.baseOnBalls || 0;
  const hbp = stats.hitByPitch || 0;
  const ab = stats.atBats || 0;
  const sf = stats.sacFlies || 0;
  const pa = ab + walks + hbp + sf;
  return pa >= 10 ? (hits + walks + hbp) / pa : 0.310;
}

function statSLG(stats) {
  if (!stats) return 0.380;
  const ab = stats.atBats || 0;
  if (ab < 5) return 0.380;
  const tb = stats.totalBases
    || (stats.hits || 0) + (stats.doubles || 0) + (stats.triples || 0) * 2 + (stats.homeRuns || 0) * 3;
  return tb / ab;
}

export function statOPS(stats) {
  return statOBP(stats) + statSLG(stats);
}

function opsFromStat(stats) {
  if (!stats) return 0;
  if (stats.ops) return parseFloat(stats.ops);
  if (stats.obp && stats.slg) return parseFloat(stats.obp) + parseFloat(stats.slg);
  return statOPS(stats);
}

function parsePlayerStats(rosterEntry, group = 'hitting') {
  const stats = rosterEntry?.person?.stats?.find((entry) => entry.group?.displayName?.toLowerCase() === group);
  return stats?.splits?.[0]?.stat || null;
}

function parseStatcastStats(rosterEntry) {
  const stats = rosterEntry?.person?.stats?.find((entry) => entry.type?.displayName === 'statcastBatting');
  return stats?.splits?.[0]?.stat || null;
}

export function buildPlayerFromRoster(entry) {
  return {
    id: entry.person.id,
    name: entry.person.fullName,
    pos: entry.position?.abbreviation || 'DH',
    posType: entry.position?.type || '',
    jerseyNumber: entry.jerseyNumber,
    batsHand: entry.person?.batSide?.code || 'R',
    throwsHand: entry.person?.pitchHand?.code || 'R',
    stats: parsePlayerStats(entry, 'hitting'),
    pitchingStats: parsePlayerStats(entry, 'pitching'),
    statcastStats: parseStatcastStats(entry),
    orderSplits: [],
    sitSplits: {},
    bestSlot: null,
    bestSlotABs: 0,
  };
}

export async function fetchTeamRoster(teamId, season = CURRENT_SEASON) {
  try {
    const hydrate = `person(stats(type=[season,statcastBatting],season=${season},group=[hitting,pitching]))`;
    const activeRes = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster/active?season=${season}&hydrate=${encodeURIComponent(hydrate)}`,
    );
    const activeData = await activeRes.json();
    if (activeData.roster?.length) return activeData.roster;

    const fullRes = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster/fullRoster?season=${season}&hydrate=${encodeURIComponent(hydrate)}`,
    );
    const fullData = await fullRes.json();
    return (fullData.roster || []).filter((entry) => {
      const stats = entry.person?.stats?.find((stat) =>
        stat.group?.displayName?.toLowerCase() === 'hitting'
        || stat.group?.displayName?.toLowerCase() === 'pitching',
      );
      return stats?.splits?.[0]?.stat;
    }).slice(0, 26);
  } catch {
    return [];
  }
}

export async function fetchPlayerSplits(playerId, season) {
  try {
    const sitCodes = 'b1,b2,b3,b4,b5,b6,b7,b8,b9,vl,vr,d,n,h,a';
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=statSplits&sitCodes=${sitCodes}&season=${season}&group=hitting`,
    );
    const data = await res.json();
    const splits = data.stats?.[0]?.splits || [];
    const orderSplits = [];
    const sitSplits = {};

    for (const split of splits) {
      const code = split.split?.code || '';
      const stat = split.stat || {};
      const obp = parseFloat(stat.obp) || 0;
      const slg = parseFloat(stat.slg) || 0;
      if (/^b[1-9]$/.test(code)) {
        const slot = parseInt(code[1], 10);
        const ab = stat.atBats || 0;
        if (ab > 0) orderSplits.push({ slot, ab, ops: obp + slg });
      } else if (['vl', 'vr', 'd', 'n', 'h', 'a'].includes(code)) {
        sitSplits[code] = stat;
      }
    }

    const bestEntry = orderSplits.length
      ? orderSplits.reduce((best, entry) => (entry.ab > best.ab ? entry : best), orderSplits[0])
      : null;

    return {
      orderSplits,
      sitSplits,
      bestSlot: bestEntry?.slot || null,
      bestSlotABs: bestEntry?.ab || 0,
    };
  } catch {
    return { orderSplits: [], sitSplits: {}, bestSlot: null, bestSlotABs: 0 };
  }
}

function buildRealisticLineup(players, context = {}) {
  const { opposingHand, isDayGame, isHome } = context;
  const pool = players.filter((player) => player.posType !== 'Pitcher');
  const used = new Set();
  const result = [];

  const contextOPS = (player) => {
    const sit = player.sitSplits || {};
    if (opposingHand) {
      const handKey = opposingHand === 'L' ? 'vl' : 'vr';
      const handOPS = opsFromStat(sit[handKey]);
      if (handOPS > 0) return handOPS;
    }
    if (isDayGame !== undefined) {
      const dayNightOPS = opsFromStat(sit[isDayGame ? 'd' : 'n']);
      if (dayNightOPS > 0) return dayNightOPS;
    }
    if (isHome !== undefined) {
      const homeAwayOPS = opsFromStat(sit[isHome ? 'h' : 'a']);
      if (homeAwayOPS > 0) return homeAwayOPS;
    }
    return statOPS(player.stats);
  };

  for (let slot = 1; slot <= 9; slot++) {
    const candidates = pool
      .filter((player) => !used.has(player.id))
      .map((player) => {
        const splitEntry = player.orderSplits?.find((entry) => entry.slot === slot);
        return { player, volume: splitEntry?.ab || 0 };
      })
      .sort((a, b) => {
        const volumeDiff = b.volume - a.volume;
        const maxVolume = Math.max(a.volume, b.volume);
        if (maxVolume > 0 && Math.abs(volumeDiff) / maxVolume <= 0.15) {
          const opsA = contextOPS(a.player);
          const opsB = contextOPS(b.player);
          if (Math.abs(opsA - opsB) > 0.001) return opsB - opsA;
        }
        return volumeDiff;
      });

    if (!candidates.length) break;
    const winner = candidates[0];
    used.add(winner.player.id);
    result.push({
      ...winner.player,
      lineupSlot: slot,
      slotABs: winner.volume,
      selectionReason: winner.volume >= 5
        ? `${winner.volume} ABs batting ${slot}${slot === 1 ? 'st' : slot === 2 ? 'nd' : slot === 3 ? 'rd' : 'th'} this season`
        : 'Best available (limited data)',
    });
  }

  return result.slice(0, 9);
}

function buildSabermetricLineup(players) {
  const scored = players.map((player) => ({
    ...player,
    _ops: statOPS(player.stats),
    _obp: statOBP(player.stats),
    _slg: statSLG(player.stats),
    _hr: player.stats?.homeRuns || 0,
    _sb: player.stats?.stolenBases || 0,
    _pa: player.stats?.plateAppearances || player.stats?.atBats || 200,
    _avg: parseFloat(player.stats?.avg) || 0.240,
  }));
  const pool = [...scored].sort((a, b) => b._ops - a._ops).slice(0, 9);
  const pick = (fn) => {
    const best = pool.reduce((current, player) => (fn(player) > fn(current) ? player : current), pool[0]);
    pool.splice(pool.indexOf(best), 1);
    return best;
  };
  const slots = [
    pick((player) => player._obp * 0.55 + (player._sb / Math.max(player._pa, 1)) * 15 + player._avg * 0.25),
    pick((player) => player._ops),
    pick((player) => player._avg * 0.5 + player._obp * 0.5),
    pick((player) => player._slg * 0.6 + (player._hr / Math.max(player._pa, 1)) * 80),
    pick((player) => player._slg * 0.5 + player._hr * 0.5),
    pick((player) => player._ops),
    pick((player) => player._ops),
  ];
  const catcherIdx = pool.findIndex((player) => player.pos === 'C');
  slots.push(catcherIdx >= 0 ? pool.splice(catcherIdx, 1)[0] : pick((player) => player._ops));
  if (pool[0]) slots.push(pool[0]);

  return slots.filter(Boolean).map((player, index) => ({
    ...player,
    lineupSlot: index + 1,
    slotABs: 0,
    selectionReason: 'Sabermetric model',
  }));
}

export function buildOptimalLineup(players, context = {}, mode = 'realistic') {
  if (!players || players.length < 9) return players || [];
  const batters = players.filter((player) => player.posType !== 'Pitcher');
  if (mode === 'optimized') return buildSabermetricLineup(batters, context);
  const hasEnoughData = batters.filter((player) => player.bestSlotABs >= 5).length >= 5;
  return hasEnoughData ? buildRealisticLineup(batters, context) : buildSabermetricLineup(batters, context);
}

export function assignGamePositions(lineup) {
  if (!lineup?.length) return lineup;
  const POS_PREF = {
    C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', INF: '2B',
    LF: 'LF', CF: 'CF', RF: 'RF', OF: 'LF', DH: 'DH', UTL: 'DH', P: null,
  };
  const INF_SLOTS = ['1B', '2B', '3B', 'SS'];
  const OF_SLOTS = ['LF', 'CF', 'RF'];
  const ALL_SLOTS = ['C', 'SS', '2B', '3B', '1B', 'CF', 'LF', 'RF', 'DH'];
  const claimed = new Set();
  const gamePos = new Array(lineup.length).fill(null);

  for (let i = 0; i < lineup.length; i++) {
    const pref = POS_PREF[lineup[i].pos] || null;
    if (pref && !claimed.has(pref)) {
      gamePos[i] = pref;
      claimed.add(pref);
    }
  }

  for (let i = 0; i < lineup.length; i++) {
    if (gamePos[i]) continue;
    const player = lineup[i];
    let pool;
    if (player.posType === 'Outfielder' || ['LF', 'CF', 'RF', 'OF'].includes(player.pos)) pool = OF_SLOTS;
    else if (player.posType === 'Infielder' || ['1B', '2B', '3B', 'SS', 'INF'].includes(player.pos)) pool = INF_SLOTS;
    else if (player.pos === 'C' || player.posType === 'Catcher') pool = ['C'];
    else pool = INF_SLOTS;
    const open = pool.find((slot) => !claimed.has(slot));
    if (open) { gamePos[i] = open; claimed.add(open); }
  }

  for (let i = 0; i < lineup.length; i++) {
    if (gamePos[i]) continue;
    const open = ALL_SLOTS.find((slot) => !claimed.has(slot));
    if (open) { gamePos[i] = open; claimed.add(open); }
    else gamePos[i] = 'DH';
  }

  return lineup.map((player, index) => ({ ...player, gamePos: gamePos[index] }));
}

export function sortPitchersByRole(pitcherPlayers) {
  const withStats = pitcherPlayers.map((player) => ({
    ...player,
    _ip: parseFloat(player.pitchingStats?.inningsPitched || 0),
    _era: parseFloat(player.pitchingStats?.era || 9.99),
    _gs: player.pitchingStats?.gamesStarted || 0,
    _g: player.pitchingStats?.gamesPlayed || player.pitchingStats?.gamesPitched || 1,
  }));

  const starters = withStats.filter((player) => (player._gs / Math.max(player._g, 1)) >= 0.4 || (player._gs >= 5 && player._ip > 30));
  const relievers = withStats.filter((player) => !starters.includes(player));

  starters.sort((a, b) => a._era - b._era || b._ip - a._ip);
  relievers.sort((a, b) => a._era - b._era);

  if (!starters.length) {
    withStats.sort((a, b) => b._ip - a._ip || a._era - b._era);
    return { starter: withStats[0], bullpen: withStats.slice(1, 5) };
  }

  return {
    starter: starters[0],
    bullpen: [...starters.slice(1, 3), ...relievers.slice(0, 3)],
  };
}

export async function loadTeamForGame(team, season, context, mode = 'realistic') {
  const roster = await fetchTeamRoster(team.id, season);
  const allPlayers = roster.map(buildPlayerFromRoster);
  const batters = allPlayers.filter((player) => player.posType !== 'Pitcher' && player.posType !== 'Two-Way Player');
  const pitchers = allPlayers.filter((player) => player.posType === 'Pitcher');
  const splits = await Promise.all(batters.map((player) => fetchPlayerSplits(player.id, season)));
  const enrichedBatters = batters.map((player, index) => ({ ...player, ...splits[index] }));
  const pitcherRoles = pitchers.length
    ? sortPitchersByRole(pitchers)
    : { starter: defaultPlayer(team.id, 99), bullpen: [] };
  const lineup = enrichedBatters.length >= 9
    ? assignGamePositions(buildOptimalLineup(enrichedBatters, context, mode))
    : Array.from({ length: 9 }, (_, index) => defaultPlayer(team.id, index));

  const lineupIds = new Set(lineup.map((player) => player.id));
  const bench = enrichedBatters
    .filter((player) => !lineupIds.has(player.id))
    .sort((a, b) => statOPS(b.stats) - statOPS(a.stats))
    .slice(0, 10);

  return {
    lineup,
    bench,
    starter: pitcherRoles.starter,
    bullpen: pitcherRoles.bullpen,
    pitchers: [pitcherRoles.starter, ...pitcherRoles.bullpen].filter(Boolean),
    rosterCount: roster.length,
  };
}