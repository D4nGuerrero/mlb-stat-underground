import { fetchStatsApiJson } from '../lib/mlb/client';
import { leagueLevelSportId } from '../constants/leagueLevels.js';

export const DIVISION_META = {
  201: { short: 'East', league: 'AL', order: 0 },
  202: { short: 'Central', league: 'AL', order: 1 },
  200: { short: 'West', league: 'AL', order: 2 },
  204: { short: 'East', league: 'NL', order: 0 },
  205: { short: 'Central', league: 'NL', order: 1 },
  203: { short: 'West', league: 'NL', order: 2 },
};

export const LEAGUE_DIV_IDS = {
  103: { east: 201, central: 202, west: 200, intrLeague: 104 },
  104: { east: 204, central: 205, west: 203, intrLeague: 103 },
};

export const CLINCH_LABELS = {
  z: 'Clinched best record in league',
  y: 'Clinched Division',
  x: 'Clinched Postseason',
  w: 'Clinched Wild Card',
};

export function leagueKeyFromName(name) {
  if (/\bamerican league\b|\bAL\b/i.test(name ?? '')) return 'AL';
  if (/\bnational league\b|\bNL\b/i.test(name ?? '')) return 'NL';
  return null;
}

export function divisionShortName(divId, fallback) {
  return DIVISION_META[divId]?.short ?? fallback?.replace(/American League |National League /, '') ?? 'Division';
}

export function sortDivisions(divisions) {
  return [...divisions].sort((a, b) => {
    const am = DIVISION_META[a.divId] ?? { league: 'ZZ', order: 99 };
    const bm = DIVISION_META[b.divId] ?? { league: 'ZZ', order: 99 };
    if (am.league !== bm.league) return am.league === 'AL' ? -1 : 1;
    return am.order - bm.order;
  });
}

export function fmtWL(w, l) {
  if (w == null || l == null) return '—';
  return `${w}-${l}`;
}

export function parseWL(value) {
  if (!value || value === '—') return 0;
  const [w] = String(value).split('-').map((n) => parseInt(n, 10));
  return Number.isNaN(w) ? 0 : w;
}

export function parseGamesBack(value) {
  if (value == null || value === '' || value === '-' || value === '—') return 0;
  const s = String(value).trim();
  if (s.startsWith('+')) {
    const n = parseFloat(s.slice(1));
    return Number.isNaN(n) ? -1000 : -1000 - n;
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function resolveClinchIndicator(tr) {
  const raw = String(tr?.clinchIndicator ?? '').trim().toLowerCase();
  if (raw && CLINCH_LABELS[raw]) return raw;
  if (tr?.divisionChamp) return 'y';
  if (tr?.clinched) return 'x';
  return null;
}

export function formatElimNumber(value) {
  if (value == null || value === '' || value === '-' || value === '—') return '—';
  const text = String(value).trim().toUpperCase();
  if (text === 'E' || text === 'ELIMINATED') return 'E';
  return text;
}

export function parseElimNumber(value) {
  if (value == null || value === '' || value === '-' || value === '—') return -1;
  const text = String(value).trim().toUpperCase();
  if (text === 'E' || text === 'ELIMINATED') return 1000;
  const n = parseInt(text, 10);
  return Number.isNaN(n) ? 999 : n;
}

/** MLB wild-card berths by season. Other leagues fall back to this same history. */
export function wildCardBerthCount(season) {
  const year = Number(season);
  if (!Number.isFinite(year)) return 3;
  if (year >= 2022) return 3;
  if (year >= 2012) return 2;
  if (year >= 1995) return 1;
  return 0;
}

/** Index of the last in-berth team in default wild-card order, or -1 if none. */
export function wildCardCutoffIndex(teams, season) {
  const berths = wildCardBerthCount(season);
  if (berths <= 0 || !teams?.length) return -1;
  let lastIn = -1;
  teams.forEach((team, index) => {
    const rank = Number(team.wildCardRank);
    if (Number.isFinite(rank) && rank > 0 && rank <= berths) lastIn = index;
  });
  if (lastIn >= 0) return lastIn;
  return Math.min(berths, teams.length) - 1;
}

export function formatGamesBack(value) {
  if (value == null || value === '' || value === '-' || value === '—' || value === '0.0') return '—';
  const s = String(value).trim();
  const n = parseFloat(s.startsWith('+') ? s.slice(1) : s);
  if (Number.isNaN(n)) return '—';
  const num = Number.isInteger(n) ? String(n) : String(n);
  return s.startsWith('+') ? `+${num}` : num;
}

export function formatWinPct(wins, losses) {
  const games = Number(wins) + Number(losses);
  if (!games) return '.000';
  return (wins / games).toFixed(3).replace(/^0/, '');
}

export function gamesBackFromLeader(team, leader) {
  if (!team || !leader) return '-';
  const gamesBack = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
  if (!Number.isFinite(gamesBack) || gamesBack <= 0) return '-';
  return Number.isInteger(gamesBack) ? String(gamesBack) : gamesBack.toFixed(1);
}

export function getGroupLeader(teams, rankKey) {
  return [...teams].sort((a, b) => {
    const ar = Number.isFinite(a[rankKey]) ? a[rankKey] : 99;
    const br = Number.isFinite(b[rankKey]) ? b[rankKey] : 99;
    if (ar !== br) return ar - br;
    const pctDiff = (parseFloat(b.pct) || 0) - (parseFloat(a.pct) || 0);
    if (pctDiff !== 0) return pctDiff;
    return (b.wins ?? 0) - (a.wins ?? 0);
  })[0];
}

export function withGamesBackFromGroupLeader(teams, rankKey) {
  const leader = getGroupLeader(teams, rankKey);
  return teams.map((team) => ({
    ...team,
    gb: gamesBackFromLeader(team, leader),
  }));
}

export function parseSortValue(col, value) {
  if (col === 'streak') {
    if (!value || value === '-') return 0;
    const num = parseInt(String(value).slice(1), 10) || 0;
    return String(value).startsWith('W') ? num : -num;
  }
  if (col === 'wcGb' || col === 'gb') return parseGamesBack(value);
  if (col === 'elimNumber' || col === 'wcElimNumber') return parseElimNumber(value);
  if (col === 'pct' || col === 'vsDivPct') return parseFloat(value) || 0;
  if (['oneRun', 'extraInning', 'vsEast', 'vsCentral', 'vsWest', 'vsIntr', 'vsRhp', 'vsLhp', 'lastTen', 'home', 'away'].includes(col)) {
    return parseWL(value);
  }
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value ?? 0;
}

export function buildTeamRow(tr, { leagueId, divId } = {}) {
  const splits = tr.records?.splitRecords || [];
  const home = splits.find((s) => s.type === 'home');
  const away = splits.find((s) => s.type === 'away');
  const lastTen = splits.find((s) => s.type === 'lastTen');
  const oneRun = splits.find((s) => s.type === 'oneRun');
  const extraInning = splits.find((s) => s.type === 'extraInning');
  const vsLeft = splits.find((s) => s.type === 'left');
  const vsRight = splits.find((s) => s.type === 'right');

  const ownLeagueId = tr.team?.league?.id ?? leagueId;
  const ownDivisionId = tr.team?.division?.id ?? divId;
  const divMap = LEAGUE_DIV_IDS[ownLeagueId] ?? {};
  const divisionRecords = tr.records?.divisionRecords || [];
  const leagueRecords = tr.records?.leagueRecords || [];

  const getDivRecord = (id) => divisionRecords.find((d) => d.division?.id === id);
  const east = getDivRecord(divMap.east);
  const central = getDivRecord(divMap.central);
  const west = getDivRecord(divMap.west);
  const intr = leagueRecords.find((l) => l.league?.id === divMap.intrLeague);

  return {
    teamId: tr.team?.id,
    team: tr.team,
    teamName: tr.team?.name,
    wins: tr.wins ?? 0,
    losses: tr.losses ?? 0,
    pct: tr.leagueRecord?.pct ?? '.000',
    gb: tr.divisionGamesBack ?? '-',
    lgGb: tr.leagueGamesBack ?? '-',
    wcGb: tr.wildCardGamesBack ?? '-',
    home: home ? fmtWL(home.wins, home.losses) : '—',
    away: away ? fmtWL(away.wins, away.losses) : '—',
    lastTen: lastTen ? fmtWL(lastTen.wins, lastTen.losses) : '—',
    oneRun: oneRun ? fmtWL(oneRun.wins, oneRun.losses) : '—',
    extraInning: extraInning ? fmtWL(extraInning.wins, extraInning.losses) : '—',
    runsScored: tr.runsScored ?? null,
    runsAllowed: tr.runsAllowed ?? null,
    streak: tr.streak?.streakCode ?? '-',
    runDiff: tr.runDifferential ?? 0,
    divisionRank: parseInt(tr.divisionRank ?? '99', 10),
    leagueRank: parseInt(tr.leagueRank ?? '99', 10),
    sportRank: parseInt(tr.sportRank ?? '99', 10),
    wildCardRank: parseInt(tr.wildCardRank ?? '99', 10),
    gamesPlayed: tr.gamesPlayed ?? 0,
    divisionChamp: tr.divisionChamp ?? false,
    clinched: tr.clinched ?? false,
    clinchIndicator: resolveClinchIndicator(tr),
    elimNumber: tr.eliminationNumberDivision ?? tr.eliminationNumber ?? '-',
    wcElimNumber: tr.wildCardEliminationNumber ?? '-',
    magicNumber: tr.magicNumber ?? '-',
    wildCard: tr.wildCard ?? false,
    leagueId: ownLeagueId,
    divId: ownDivisionId,
    vsEast: east ? fmtWL(east.wins, east.losses) : '—',
    vsCentral: central ? fmtWL(central.wins, central.losses) : '—',
    vsWest: west ? fmtWL(west.wins, west.losses) : '—',
    vsIntr: intr ? fmtWL(intr.wins, intr.losses) : '—',
    vsRhp: vsRight ? fmtWL(vsRight.wins, vsRight.losses) : '—',
    vsLhp: vsLeft ? fmtWL(vsLeft.wins, vsLeft.losses) : '—',
  };
}

export function parseStandings(records) {
  if (!records) return { divisions: [], wildCardGroups: [] };
  const divisions = {};
  const wildCardGroups = {};

  records.forEach((record) => {
    const firstTeam = record.teamRecords?.[0]?.team;
    const leagueId = record.league?.id ?? firstTeam?.league?.id;
    const leagueName = record.league?.name ?? firstTeam?.league?.name ?? 'League';
    const divId = record.division?.id ?? firstTeam?.division?.id ?? `league-${leagueId ?? 'unknown'}`;
    const divName = record.division?.name ?? firstTeam?.division?.name ?? leagueName;

    if (record.standingsType === 'wildCard') {
      const key = leagueId ?? 'league';
      if (!wildCardGroups[key]) wildCardGroups[key] = { leagueId, name: leagueName, teams: [] };
      (record.teamRecords || []).forEach((tr) => {
        wildCardGroups[key].teams.push(buildTeamRow(tr, { leagueId, divId }));
      });
      return;
    }

    if (!divId || leagueId == null) return;

    if (!divisions[divId]) {
      divisions[divId] = {
        divId,
        name: divisionShortName(divId, divName),
        leagueId,
        leagueLabel: leagueName,
        teams: [],
      };
    }

    (record.teamRecords || []).forEach((tr) => {
      divisions[divId].teams.push(buildTeamRow(tr, { leagueId, divId }));
    });
  });

  Object.values(divisions).forEach((div) => {
    div.teams.sort((a, b) => a.divisionRank - b.divisionRank);
  });

  Object.values(wildCardGroups).forEach((group) => {
    group.teams.sort((a, b) => (a.wildCardRank ?? 99) - (b.wildCardRank ?? 99));
  });

  return {
    divisions: Object.values(divisions),
    wildCardGroups: Object.values(wildCardGroups),
  };
}

export function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }
  return null;
}

export function toApiDate(isoDate) {
  const iso = toIsoDate(isoDate);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}

export function addDaysIso(isoDate, days) {
  const iso = toIsoDate(isoDate);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(startIso, endIso) {
  const start = toIsoDate(startIso);
  const end = toIsoDate(endIso);
  if (!start || !end) return 0;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const a = Date.UTC(sy, sm - 1, sd);
  const b = Date.UTC(ey, em - 1, ed);
  return Math.round((b - a) / 86_400_000);
}

export function isoFromIndex(startIso, index) {
  return addDaysIso(startIso, index);
}

export function formatSliderDate(isoDate) {
  const iso = toIsoDate(isoDate);
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatSliderDateLong(isoDate) {
  const iso = toIsoDate(isoDate);
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function clampIsoDate(isoDate, minIso, maxIso) {
  const iso = toIsoDate(isoDate);
  const min = toIsoDate(minIso);
  const max = toIsoDate(maxIso);
  if (!iso) return min;
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export async function fetchSeasonDateBounds({ season, leagueLevel, signal } = {}) {
  const sportId = leagueLevelSportId(leagueLevel);
  const data = await fetchStatsApiJson('/api/v1/seasons', {
    query: { sportId, season },
    ttl: 6 * 60 * 60_000,
    retries: 1,
    signal,
  });
  const seasonRow = data?.seasons?.[0] ?? {};
  const start = toIsoDate(seasonRow.regularSeasonStartDate) || `${season}-03-20`;
  const officialEnd = toIsoDate(seasonRow.regularSeasonEndDate) || `${season}-09-30`;
  const today = toIsoDate(new Date());
  const currentYear = String(new Date().getFullYear());
  let end = officialEnd;
  if (String(season) === currentYear && today) {
    if (today < start) end = start;
    else if (today < officialEnd) end = today;
  }
  return { start, end, officialEnd };
}

export async function fetchStandingsSnapshot({
  season,
  dateIso,
  leagueParams,
  standingsType = 'regularSeason',
  signal,
} = {}) {
  return fetchStatsApiJson('/api/v1/standings', {
    query: {
      ...leagueParams,
      season,
      standingsTypes: standingsType,
      date: toApiDate(dateIso),
      hydrate: 'team(division,league),records(divisionRecords,splitRecords,leagueRecords)',
    },
    ttl: 5 * 60_000,
    retries: 1,
    signal,
  });
}

function flattenTeams(parsed) {
  const byId = new Map();
  for (const division of parsed?.divisions ?? []) {
    for (const team of division.teams ?? []) {
      byId.set(team.teamId, team);
    }
  }
  return byId;
}

function rankTeams(teams, key) {
  const sorted = [...teams].sort((a, b) => {
    const pctDiff = (parseFloat(b.pct) || 0) - (parseFloat(a.pct) || 0);
    if (pctDiff !== 0) return pctDiff;
    if ((b.wins ?? 0) !== (a.wins ?? 0)) return (b.wins ?? 0) - (a.wins ?? 0);
    return (a.losses ?? 0) - (b.losses ?? 0);
  });
  sorted.forEach((team, index) => {
    team[key] = index + 1;
  });
  return sorted;
}

function subtractWl(endValue, startValue) {
  if (!endValue || endValue === '—') return '—';
  const [ew, el] = String(endValue).split('-').map((n) => parseInt(n, 10));
  const [sw, sl] = String(startValue || '0-0').split('-').map((n) => parseInt(n, 10) || 0);
  if (Number.isNaN(ew) || Number.isNaN(el)) return '—';
  return fmtWL(Math.max(0, ew - sw), Math.max(0, el - sl));
}

export function computeWindowStandings(endParsed, startParsed) {
  const startById = flattenTeams(startParsed);
  const divisions = (endParsed?.divisions ?? []).map((division) => {
    const teams = (division.teams ?? []).map((endTeam) => {
      const startTeam = startById.get(endTeam.teamId);
      const wins = Math.max(0, (endTeam.wins ?? 0) - (startTeam?.wins ?? 0));
      const losses = Math.max(0, (endTeam.losses ?? 0) - (startTeam?.losses ?? 0));
      const runsScored = Math.max(0, (endTeam.runsScored ?? 0) - (startTeam?.runsScored ?? 0));
      const runsAllowed = Math.max(0, (endTeam.runsAllowed ?? 0) - (startTeam?.runsAllowed ?? 0));
      return {
        ...endTeam,
        wins,
        losses,
        pct: formatWinPct(wins, losses),
        gamesPlayed: wins + losses,
        runsScored,
        runsAllowed,
        runDiff: runsScored - runsAllowed,
        home: subtractWl(endTeam.home, startTeam?.home),
        away: subtractWl(endTeam.away, startTeam?.away),
        lastTen: '—',
        oneRun: subtractWl(endTeam.oneRun, startTeam?.oneRun),
        extraInning: subtractWl(endTeam.extraInning, startTeam?.extraInning),
        vsEast: subtractWl(endTeam.vsEast, startTeam?.vsEast),
        vsCentral: subtractWl(endTeam.vsCentral, startTeam?.vsCentral),
        vsWest: subtractWl(endTeam.vsWest, startTeam?.vsWest),
        vsIntr: subtractWl(endTeam.vsIntr, startTeam?.vsIntr),
        vsRhp: subtractWl(endTeam.vsRhp, startTeam?.vsRhp),
        vsLhp: subtractWl(endTeam.vsLhp, startTeam?.vsLhp),
        streak: '—',
        clinchIndicator: null,
        divisionChamp: false,
        clinched: false,
      };
    });
    const ranked = rankTeams(teams, 'divisionRank');
    return { ...division, teams: withGamesBackFromGroupLeader(ranked, 'divisionRank') };
  });

  const byLeague = new Map();
  const allTeams = [];
  divisions.forEach((division) => {
    const list = byLeague.get(division.leagueId) ?? [];
    list.push(...division.teams);
    byLeague.set(division.leagueId, list);
    allTeams.push(...division.teams);
  });
  byLeague.forEach((teams) => {
    rankTeams(teams, 'leagueRank');
  });
  rankTeams(allTeams, 'sportRank');

  return { divisions, wildCardGroups: [] };
}
