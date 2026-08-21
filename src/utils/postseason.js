import { getTeamAbbr, mlbTeams } from './mlbHelpers';

export const MIN_POSTSEASON_YEAR = 1903;
export const CURRENT_CALENDAR_YEAR = new Date().getFullYear();

const MLB_TEAM_ID_SET = new Set(mlbTeams.map((team) => team.id));

/** Official postseason game types. Regular-season leftovers (e.g. 1995) are dropped. */
export const POSTSEASON_GAME_TYPES = new Set(['F', 'D', 'L', 'W', 'C']);

export const ROUND_META = {
  F: { key: 'F', label: 'Wild Card', short: 'WC', order: 0 },
  D: { key: 'D', label: 'Division Series', short: 'DS', order: 1 },
  L: { key: 'L', label: 'League Championship', short: 'LCS', order: 2 },
  C: { key: 'C', label: 'Championship', short: 'CS', order: 2 },
  W: { key: 'W', label: 'World Series', short: 'WS', order: 3 },
};

export const LEAGUE_META = {
  AL: {
    key: 'AL',
    label: 'American League',
    short: 'AL',
    logo: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/159.svg',
    logoLight: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/159.svg',
  },
  NL: {
    key: 'NL',
    label: 'National League',
    short: 'NL',
    logo: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/160.svg',
    logoLight: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/160.svg',
  },
  WS: {
    key: 'WS',
    label: 'World Series',
    short: 'WS',
    logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg',
    logoLight: 'https://www.mlbstatic.com/team-logos/league-on-light/1.svg',
  },
};

export function leagueLogoSrc(meta, isDark = true) {
  if (!meta) return '';
  return isDark ? meta.logo : (meta.logoLight ?? meta.logo);
}

const STRIKE_YEARS = new Set([1994]);

export function clampPostseasonYear(value, now = new Date()) {
  const year = Number(value);
  if (!Number.isFinite(year)) return defaultPostseasonYear(now);
  return Math.min(CURRENT_CALENDAR_YEAR, Math.max(MIN_POSTSEASON_YEAR, Math.round(year)));
}

/**
 * Default to the most recently completed (or in-progress) October.
 * Regular-season months stay on last year's bracket.
 */
export function defaultPostseasonYear(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  if (month > 8 || (month === 8 && day >= 28)) return year;
  return Math.max(MIN_POSTSEASON_YEAR, year - 1);
}

export function isStrikeCancelledYear(year) {
  return STRIKE_YEARS.has(Number(year));
}

export function postseasonYearOptions(years) {
  const list = Array.isArray(years) && years.length
    ? [...new Set(years.map(Number))].filter((year) => Number.isFinite(year)).sort((a, b) => b - a)
    : null;
  if (list) {
    return list.map((year) => ({
      value: year,
      label: STRIKE_YEARS.has(year) ? `${year} (cancelled)` : String(year),
    }));
  }
  return Array.from(
    { length: CURRENT_CALENDAR_YEAR - MIN_POSTSEASON_YEAR + 1 },
    (_, index) => {
      const year = CURRENT_CALENDAR_YEAR - index;
      return {
        value: year,
        label: STRIKE_YEARS.has(year) ? `${year} (cancelled)` : String(year),
      };
    },
  );
}

export function parseTeamPostseasonYears(data) {
  const splits = data?.stats?.[0]?.splits ?? [];
  const years = new Set();
  for (const split of splits) {
    const year = Number(split.season);
    if (!Number.isFinite(year)) continue;
    if (year < MIN_POSTSEASON_YEAR || year > CURRENT_CALENDAR_YEAR) continue;
    if (isStrikeCancelledYear(year)) continue;
    const games = Number(split.stat?.gamesPlayed);
    if (Number.isFinite(games) && games <= 0) continue;
    years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

const AL_FRANCHISE_IDS = new Set([
  108, 110, 111, 114, 116, 117, 118, 133, 136, 139, 140, 141, 142, 145, 147,
]);

const ROUND_RANK = { F: 0, D: 1, L: 2, C: 2, W: 3 };

export function teamLeagueInYear(teamId, year) {
  const id = Number(teamId);
  const season = Number(year);
  if (id === 117) return season >= 2013 ? 'AL' : 'NL';
  if (id === 158) return season >= 1998 ? 'NL' : 'AL';
  return AL_FRANCHISE_IDS.has(id) ? 'AL' : 'NL';
}

function teamLeagueFromSeriesTeam(team, year) {
  if (Number(team?.leagueId) === 103) return 'AL';
  if (Number(team?.leagueId) === 104) return 'NL';
  if (team?.id != null) return teamLeagueInYear(team.id, year);
  return null;
}

/** World Series: AL on the left, NL on the right. Other series stay away/home. */
export function seriesDisplayTeams(series, year) {
  const [first, second] = series?.teams ?? [];
  if (!first || !second) return { left: first ?? null, right: second ?? null };
  if (series.gameType !== 'W') return { left: first, right: second };

  const leftLeague = teamLeagueFromSeriesTeam(first, year);
  const rightLeague = teamLeagueFromSeriesTeam(second, year);
  if (leftLeague === 'NL' && rightLeague === 'AL') {
    return { left: second, right: first };
  }
  return { left: first, right: second };
}

export function furthestRoundLabel(gameType, league) {
  const lg = league === 'AL' || league === 'NL' ? league : '';
  if (gameType === 'W') return 'WS';
  if (gameType === 'L' || gameType === 'C') return lg ? `${lg}CS` : 'LCS';
  if (gameType === 'D') return lg ? `${lg}DS` : 'DS';
  if (gameType === 'F') return 'WC';
  return ROUND_META[gameType]?.short ?? 'PS';
}

export function parseWsChampYears(data, teamId) {
  const years = new Set();
  const id = Number(teamId);
  for (const rec of data?.awards ?? []) {
    if (Number(rec.team?.id) !== id) continue;
    const year = Number(rec.season);
    if (Number.isFinite(year)) years.add(year);
  }
  return years;
}

export function parseAllWsChampByTeam(data) {
  const byTeam = new Map();
  for (const rec of data?.awards ?? []) {
    const teamId = Number(rec.team?.id);
    const year = Number(rec.season);
    if (!Number.isFinite(teamId) || !Number.isFinite(year)) continue;
    if (year < MIN_POSTSEASON_YEAR || year > CURRENT_CALENDAR_YEAR) continue;
    if (!byTeam.has(teamId)) byTeam.set(teamId, new Set());
    byTeam.get(teamId).add(year);
  }
  return byTeam;
}

export function parseTeamPostseasonAppearances({ byType, champYears, teamId }) {
  const best = new Map();
  for (const [type, payload] of Object.entries(byType ?? {})) {
    if (!POSTSEASON_GAME_TYPES.has(type)) continue;
    for (const year of parseTeamPostseasonYears(payload)) {
      const prev = best.get(year);
      if (prev == null || (ROUND_RANK[type] ?? -1) > (ROUND_RANK[prev] ?? -1)) {
        best.set(year, type);
      }
    }
  }
  // gameType=P is the full October slate — fill years a round endpoint omitted.
  for (const year of parseTeamPostseasonYears(byType?.P)) {
    if (!best.has(year)) best.set(year, 'P');
  }

  const champs = champYears instanceof Set ? champYears : new Set(champYears ?? []);
  return [...best.entries()]
    .map(([year, gameType]) => {
      const league = teamLeagueInYear(teamId, year);
      return {
        year,
        gameType,
        label: furthestRoundLabel(gameType, league),
        wonWs: gameType === 'W' && champs.has(year),
      };
    })
    .sort((a, b) => b.year - a.year);
}

export function appearanceFromBracket(bracket, teamId) {
  const played = (bracket?.series ?? []).filter((series) =>
    series.teams.some((team) => Number(team.id) === Number(teamId) && !team.placeholder),
  );
  if (!played.length) return null;

  let best = played[0];
  for (const series of played) {
    const nextRank = ROUND_RANK[series.gameType] ?? -1;
    const bestRank = ROUND_RANK[best.gameType] ?? -1;
    if (nextRank > bestRank) best = series;
  }

  const league = best.league === 'AL' || best.league === 'NL'
    ? best.league
    : teamLeagueInYear(teamId, bracket.year);
  const wonWs = best.gameType === 'W'
    && best.winner
    && !best.winner.placeholder
    && Number(best.winner.id) === Number(teamId);

  return {
    year: Number(bracket.year),
    gameType: best.gameType,
    label: furthestRoundLabel(best.gameType, league),
    wonWs,
  };
}

export function teamPostseasonYearOptions(appearances, years, currentYear) {
  const byYear = new Map((appearances ?? []).map((item) => [item.year, item]));
  const list = (Array.isArray(years) && years.length
    ? [...years]
    : (appearances ?? []).map((item) => item.year));
  if (currentYear && !list.includes(currentYear)) list.unshift(currentYear);
  return list.map((year) => {
    const appearance = byYear.get(year);
    return {
      value: year,
      label: String(year),
      suffix: appearance?.label,
      trophy: Boolean(appearance?.wonWs),
    };
  });
}

export function adjacentFilteredYear(years, year, direction) {
  if (!Array.isArray(years) || !years.length) return null;
  const idx = years.indexOf(Number(year));
  if (idx < 0) return null;
  if (direction === 'older') return years[idx + 1] ?? null;
  return years[idx - 1] ?? null;
}

export function postseasonHref(year, seriesId, teamId) {
  const base = seriesId
    ? `/postseason/${year}/${encodeURIComponent(seriesId)}`
    : `/postseason/${year}`;
  return teamId ? `${base}?team=${teamId}` : base;
}

export function isPlaceholderTeam(team) {
  if (!team) return true;
  if (team.placeholder === true) return true;
  if (team.id == null) return true;
  if (!MLB_TEAM_ID_SET.has(Number(team.id))) {
    const name = String(team.name ?? team.teamName ?? '');
    if (/(seed|winner|champion|wild card\s*#)/i.test(name)) return true;
  }
  return false;
}

export function isCompletedGame(game) {
  const status = game?.status ?? {};
  const detailed = String(status.detailedState ?? '').toLowerCase();
  const coded = String(status.codedGameState ?? '').toUpperCase();
  if (status.abstractGameState !== 'Final') return false;
  if (coded === 'PO' || detailed.includes('postponed') || detailed.includes('cancel')) {
    return false;
  }
  return true;
}

export function isLiveGame(game) {
  return game?.status?.abstractGameState === 'Live';
}

export function isIfNecessaryUnplayed(game) {
  return game?.ifNecessary === 'Y' && !isCompletedGame(game) && !isLiveGame(game);
}

function gameWinnerSide(game) {
  if (!isCompletedGame(game) || game.isTie) return null;
  const away = game.teams?.away;
  const home = game.teams?.home;
  if (away?.isWinner) return 'away';
  if (home?.isWinner) return 'home';
  const awayScore = Number(away?.score);
  const homeScore = Number(home?.score);
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore) || awayScore === homeScore) {
    return null;
  }
  return awayScore > homeScore ? 'away' : 'home';
}

function teamKey(team) {
  if (team?.id != null) return `id:${team.id}`;
  return `name:${team?.name ?? team?.teamName ?? 'unknown'}`;
}

function compactTeam(team) {
  if (!team) {
    return {
      id: null,
      name: 'TBD',
      abbr: 'TBD',
      teamName: 'TBD',
      placeholder: true,
      leagueId: null,
    };
  }

  const placeholder = isPlaceholderTeam(team);
  return {
    id: team.id ?? null,
    name: team.name ?? team.teamName ?? 'TBD',
    abbr: placeholder
      ? (team.abbreviation || getTeamAbbr(team) || 'TBD')
      : (getTeamAbbr(team) || team.abbreviation || 'TBD'),
    teamName: team.teamName ?? team.clubName ?? team.name ?? 'TBD',
    placeholder,
    leagueId: team.league?.id ?? null,
    locationName: team.locationName ?? null,
  };
}

function inferLeague({ gameType, seriesId, description, teams }) {
  if (gameType === 'W') return 'WS';

  const desc = String(description ?? '');
  if (/^AL\b|American League/i.test(desc)) return 'AL';
  if (/^NL\b|National League/i.test(desc)) return 'NL';

  for (const team of teams) {
    if (team?.leagueId === 103) return 'AL';
    if (team?.leagueId === 104) return 'NL';
  }

  const [, rawNum] = String(seriesId ?? '').split('_');
  const num = Number(rawNum);
  const prefix = String(seriesId ?? '').split('_')[0];
  if (prefix === 'L') return num === 1 ? 'AL' : 'NL';
  if (prefix === 'D') return num <= 2 ? 'AL' : 'NL';
  if (prefix === 'F') {
    if (num >= 5) return 'NL';
    if (num <= 2) return 'AL';
  }

  return 'MLB';
}

function seriesLength(games) {
  const scheduled = games
    .map((game) => Number(game.gamesInSeries))
    .filter((value) => Number.isFinite(value) && value > 0);
  const bestOf = scheduled.length ? Math.max(...scheduled) : games.length;
  return {
    bestOf: Math.max(1, bestOf),
    winsNeeded: Math.max(1, Math.ceil(bestOf / 2)),
  };
}

function sortGames(games) {
  return [...games].sort((a, b) => {
    const aNum = Number(a.seriesGameNumber ?? a.gameNumber ?? 0);
    const bNum = Number(b.seriesGameNumber ?? b.gameNumber ?? 0);
    if (aNum !== bNum) return aNum - bNum;
    return String(a.officialDate ?? a.gameDate ?? '').localeCompare(
      String(b.officialDate ?? b.gameDate ?? ''),
    );
  });
}

function resolveSeriesTeams(games) {
  const wins = new Map();
  const seen = new Map();

  for (const game of games) {
    for (const side of ['away', 'home']) {
      const team = compactTeam(game.teams?.[side]?.team);
      const key = teamKey(game.teams?.[side]?.team);
      if (!seen.has(key)) seen.set(key, team);
    }

    const winnerSide = gameWinnerSide(game);
    if (!winnerSide) continue;
    const winnerTeam = game.teams?.[winnerSide]?.team;
    const key = teamKey(winnerTeam);
    wins.set(key, (wins.get(key) ?? 0) + 1);
  }

  const teams = [...seen.values()];
  // Prefer the first completed/live game's pairing so home/away seed order is stable.
  const seedGame = games.find((game) => !isIfNecessaryUnplayed(game)) ?? games[0];
  const first = compactTeam(seedGame?.teams?.away?.team);
  const second = compactTeam(seedGame?.teams?.home?.team);

  const ordered = [];
  const used = new Set();
  for (const candidate of [first, second, ...teams]) {
    const key = teamKey(candidate);
    if (used.has(key)) continue;
    used.add(key);
    ordered.push({
      ...candidate,
      wins: wins.get(key) ?? 0,
    });
    if (ordered.length === 2) break;
  }

  while (ordered.length < 2) {
    ordered.push({
      id: null,
      name: 'TBD',
      abbr: 'TBD',
      teamName: 'TBD',
      placeholder: true,
      leagueId: null,
      wins: 0,
    });
  }

  const { bestOf, winsNeeded } = seriesLength(games);
  const [a, b] = ordered;
  const complete = a.wins >= winsNeeded || b.wins >= winsNeeded;
  let winner = null;
  if (complete) {
    winner = a.wins === b.wins ? null : (a.wins > b.wins ? a : b);
  }

  return { teams: ordered, winsNeeded, bestOf, winner, complete };
}

function shortRoundLabel(description, gameType) {
  const desc = String(description ?? '');
  if (/world series/i.test(desc)) return 'World Series';
  if (/\bALCS\b|AL Championship/i.test(desc)) return 'ALCS';
  if (/\bNLCS\b|NL Championship/i.test(desc)) return 'NLCS';
  if (/\bALDS\b|AL Division/i.test(desc)) return 'ALDS';
  if (/\bNLDS\b|NL Division/i.test(desc)) return 'NLDS';
  if (/AL Wild Card/i.test(desc)) return 'AL Wild Card';
  if (/NL Wild Card/i.test(desc)) return 'NL Wild Card';
  return ROUND_META[gameType]?.label ?? desc ?? 'Series';
}

function seriesDateRange(games) {
  const dates = games
    .filter((game) => !isIfNecessaryUnplayed(game))
    .map((game) => game.officialDate)
    .filter(Boolean)
    .sort();
  return {
    start: dates[0] ?? null,
    end: dates[dates.length - 1] ?? null,
  };
}

export function normalizeSeries(entry) {
  const meta = entry?.series ?? {};
  const gameType = meta.gameType ?? entry?.games?.[0]?.gameType;
  if (!POSTSEASON_GAME_TYPES.has(gameType)) return null;

  const games = sortGames(entry.games ?? []);
  if (!games.length) return null;

  const description = games[0]?.seriesDescription || ROUND_META[gameType]?.label || 'Series';
  const { teams, winsNeeded, bestOf, winner, complete } = resolveSeriesTeams(games);
  const league = inferLeague({
    gameType,
    seriesId: meta.id,
    description,
    teams,
  });
  const dates = seriesDateRange(games);
  const live = games.some(isLiveGame);
  const playedCount = games.filter(isCompletedGame).length;

  return {
    id: String(meta.id ?? `${gameType}_${meta.sortNumber ?? games[0]?.gamePk}`),
    gameType,
    sortNumber: Number(meta.sortNumber ?? 0),
    sortOrder: Number(entry.sortOrder ?? 0),
    description,
    shortLabel: shortRoundLabel(description, gameType),
    league,
    teams,
    winner,
    complete,
    live,
    winsNeeded,
    bestOf,
    games,
    playedCount,
    startDate: dates.start,
    endDate: dates.end,
    hasPlaceholders: teams.some((team) => team.placeholder),
  };
}

export function normalizePostseasonPayload(data, year) {
  const series = (data?.series ?? [])
    .map((entry) => normalizeSeries(entry))
    .filter(Boolean)
    .sort((a, b) => {
      const aOrder = ROUND_META[a.gameType]?.order ?? 99;
      const bOrder = ROUND_META[b.gameType]?.order ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.league !== b.league) {
        if (a.league === 'AL') return -1;
        if (b.league === 'AL') return 1;
        if (a.league === 'WS') return 1;
        if (b.league === 'WS') return -1;
      }
      return a.sortNumber - b.sortNumber || a.id.localeCompare(b.id);
    });

  const rounds = [];
  const byType = new Map();
  for (const item of series) {
    const meta = ROUND_META[item.gameType] ?? {
      key: item.gameType,
      label: item.shortLabel,
      short: item.gameType,
      order: 50,
    };
    if (!byType.has(meta.key)) {
      const round = { ...meta, series: [] };
      byType.set(meta.key, round);
      rounds.push(round);
    }
    byType.get(meta.key).series.push(item);
  }
  rounds.sort((a, b) => a.order - b.order);

  const worldSeries = series.find((item) => item.gameType === 'W') ?? null;
  const champion = worldSeries?.winner ?? null;

  return {
    year: Number(year),
    series,
    rounds,
    worldSeries,
    champion,
    hasLive: series.some((item) => item.live),
    isPreview: series.length > 0 && series.every((item) => item.hasPlaceholders),
    cancelled: isStrikeCancelledYear(year),
  };
}

export function formatSeriesScore(series) {
  if (!series?.teams?.length) return '';
  const [a, b] = series.teams;
  return `${a.wins}–${b.wins}`;
}

export function formatOfficialDate(iso, { includeYear = false } = {}) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: includeYear ? 'short' : 'short',
      month: 'short',
      day: 'numeric',
      year: includeYear ? 'numeric' : undefined,
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

export function formatGameClock(gameDate) {
  if (!gameDate) return '';
  try {
    return new Date(gameDate).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function seriesInvolvesTeam(series, teamId) {
  if (!teamId) return false;
  return series.teams.some((team) => Number(team.id) === Number(teamId));
}

const CHAMPIONSHIP_TYPES = new Set(['L', 'C']);

export function parseSeriesId(id) {
  const [type, raw] = String(id ?? '').split('_');
  const num = Number(raw);
  return { type, num: Number.isFinite(num) ? num : 0 };
}

export function compareSeriesOrder(a, b) {
  const aSort = Number(a?.sortNumber ?? 0);
  const bSort = Number(b?.sortNumber ?? 0);
  if (aSort !== bSort) return aSort - bSort;
  const aNum = parseSeriesId(a?.id).num;
  const bNum = parseSeriesId(b?.id).num;
  if (aNum !== bNum) return aNum - bNum;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

export function seriesTeamIds(series) {
  return (series?.teams ?? [])
    .filter((team) => team?.id != null && !team.placeholder)
    .map((team) => Number(team.id));
}

export function seriesSharesTeam(a, b) {
  const ids = new Set(seriesTeamIds(a));
  return seriesTeamIds(b).some((id) => ids.has(id));
}

function conventionalWcIdsForDs(dsId, wcCount) {
  const { num } = parseSeriesId(dsId);
  if (wcCount >= 8) {
    return ({
      1: ['F_1', 'F_4'],
      2: ['F_2', 'F_3'],
      3: ['F_5', 'F_8'],
      4: ['F_6', 'F_7'],
    })[num] ?? [];
  }
  if (wcCount >= 4) {
    return ({
      1: ['F_2'],
      2: ['F_1'],
      3: ['F_4'],
      4: ['F_3'],
    })[num] ?? [];
  }
  if (wcCount === 2) {
    return ({
      1: ['F_1'],
      2: ['F_1'],
      3: ['F_2'],
      4: ['F_2'],
    })[num] ?? [];
  }
  return [];
}

function pickWcFeeders(ds, wcSeries, usedIds, wcCount) {
  const available = wcSeries.filter((series) => !usedIds.has(series.id));
  const overlapped = available.filter((wc) => seriesSharesTeam(ds, wc));
  if (overlapped.length) return overlapped.sort(compareSeriesOrder);

  const byId = new Map(available.map((series) => [series.id, series]));
  return conventionalWcIdsForDs(ds.id, wcCount)
    .map((id) => byId.get(id))
    .filter(Boolean);
}

function pickByeTeam(ds, feeders) {
  if (feeders.length !== 1) return null;
  const feederIds = new Set(feeders.flatMap(seriesTeamIds));
  const seedNamed = ds.teams.find((team) => (
    team && !feederIds.has(Number(team.id)) && /#\s*[12]\s*Seed|\bbye\b/i.test(team.name ?? '')
  ));
  if (seedNamed) return seedNamed;
  const notFromFeeder = ds.teams.find((team) => (
    team && team.id && !team.placeholder && !feederIds.has(Number(team.id))
  ));
  if (notFromFeeder) return notFromFeeder;
  return ds.teams.find((team) => team && !/winner/i.test(team.name ?? '')) ?? null;
}

function makeByeNode(team, parentSeries) {
  return {
    kind: 'bye',
    id: `bye:${parentSeries.id}`,
    series: null,
    team,
    children: [],
  };
}

function makeSeriesNode(series, children) {
  return {
    kind: 'series',
    id: series.id,
    series,
    team: null,
    children,
  };
}

export function buildLeagueBracketTree(allSeries, league) {
  const ofLeague = allSeries.filter((series) => series.league === league);
  const championships = ofLeague
    .filter((series) => CHAMPIONSHIP_TYPES.has(series.gameType))
    .sort(compareSeriesOrder);
  const ds = ofLeague.filter((series) => series.gameType === 'D').sort(compareSeriesOrder);
  const wc = ofLeague.filter((series) => series.gameType === 'F').sort(compareSeriesOrder);
  const wcCount = allSeries.filter((series) => series.gameType === 'F').length;
  const used = new Set();

  const dsNodes = ds.map((dsSeries) => {
    const feeders = pickWcFeeders(dsSeries, wc, used, wcCount);
    feeders.forEach((feeder) => used.add(feeder.id));
    const children = feeders.map((feeder) => makeSeriesNode(feeder, []));
    const bye = pickByeTeam(dsSeries, feeders);
    if (bye) children.unshift(makeByeNode(bye, dsSeries));
    used.add(dsSeries.id);
    return makeSeriesNode(dsSeries, children);
  });

  let roots;
  if (championships.length) {
    const [primary, ...rest] = championships;
    used.add(primary.id);
    rest.forEach((series) => used.add(series.id));
    roots = [
      makeSeriesNode(primary, dsNodes),
      ...rest.map((series) => makeSeriesNode(series, [])),
    ];
  } else if (dsNodes.length) {
    roots = dsNodes;
  } else {
    roots = wc.map((series) => {
      used.add(series.id);
      return makeSeriesNode(series, []);
    });
  }

  for (const extra of ofLeague) {
    if (used.has(extra.id) || extra.gameType === 'W') continue;
    roots.push(makeSeriesNode(extra, []));
  }

  return roots;
}

export function orderWorldSeriesTeams(worldSeries, allSeries) {
  if (!worldSeries?.teams?.length) return worldSeries?.teams ?? [];
  const [first, second] = worldSeries.teams;
  if (!second) return worldSeries.teams;

  const alcs = allSeries.find((series) => CHAMPIONSHIP_TYPES.has(series.gameType) && series.league === 'AL');
  const nlcs = allSeries.find((series) => CHAMPIONSHIP_TYPES.has(series.gameType) && series.league === 'NL');

  const leagueOf = (team) => {
    if (Number(team.leagueId) === 103) return 'AL';
    if (Number(team.leagueId) === 104) return 'NL';
    if (team.id && alcs && seriesTeamIds(alcs).includes(Number(team.id))) return 'AL';
    if (team.id && nlcs && seriesTeamIds(nlcs).includes(Number(team.id))) return 'NL';
    return null;
  };

  const firstLeague = leagueOf(first);
  const secondLeague = leagueOf(second);
  if (firstLeague === 'NL' && secondLeague !== 'NL') return [second, first];
  if (secondLeague === 'AL' && firstLeague !== 'AL') return [second, first];
  return [first, second];
}

export function buildBracketDiagram(bracket) {
  const series = bracket?.series ?? [];
  const worldSeries = bracket?.worldSeries ?? series.find((item) => item.gameType === 'W') ?? null;
  return {
    al: buildLeagueBracketTree(series, 'AL'),
    nl: buildLeagueBracketTree(series, 'NL'),
    worldSeries,
    worldSeriesTeams: orderWorldSeriesTeams(worldSeries, series),
  };
}
