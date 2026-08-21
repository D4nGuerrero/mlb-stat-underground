import { mlbTeams } from './mlbHelpers';
import {
  MIN_POSTSEASON_YEAR,
  defaultPostseasonYear,
  parseTeamPostseasonAppearances,
  parseTeamPostseasonYears,
} from './postseason';

export const FACTS_RANGE_OPTIONS = [
  { value: 'all', label: 'All-time' },
  { value: '2000', label: 'Since 2000' },
  { value: '20', label: '20 years' },
  { value: '10', label: '10 years' },
  { value: '5', label: '5 years' },
];

export const FACTS_SORT_OPTIONS = [
  { value: 'last', label: 'Last October' },
  { value: 'trips', label: 'Trips' },
  { value: 'ds', label: 'DS' },
  { value: 'cs', label: 'CS' },
  { value: 'ws', label: 'WS' },
  { value: 'drought', label: 'Drought' },
];

export function factsRangeBounds(range, now = new Date()) {
  const to = defaultPostseasonYear(now);
  if (range === '2000') return { from: 2000, to };
  if (range === '20') return { from: Math.max(MIN_POSTSEASON_YEAR, to - 19), to };
  if (range === '10') return { from: Math.max(MIN_POSTSEASON_YEAR, to - 9), to };
  if (range === '5') return { from: Math.max(MIN_POSTSEASON_YEAR, to - 4), to };
  return { from: MIN_POSTSEASON_YEAR, to };
}

function inRange(years, from, to) {
  return (years ?? []).filter((year) => year >= from && year <= to);
}

export function collectYearsByType(byType) {
  return {
    P: parseTeamPostseasonYears(byType?.P),
    F: parseTeamPostseasonYears(byType?.F),
    D: parseTeamPostseasonYears(byType?.D),
    L: parseTeamPostseasonYears(byType?.L),
    W: parseTeamPostseasonYears(byType?.W),
  };
}

export function buildTeamFactSource(teamId, byType, titleYears) {
  const yearsByType = collectYearsByType(byType);
  const appearances = parseTeamPostseasonAppearances({
    byType,
    champYears: titleYears,
    teamId,
  });
  return {
    teamId: Number(teamId),
    yearsByType,
    appearances,
    titles: [...(titleYears ?? [])].sort((a, b) => b - a),
  };
}

export function buildFactRows(sources, range, now = new Date()) {
  const { from, to } = factsRangeBounds(range, now);
  const latestOctober = defaultPostseasonYear(now);
  const byId = Object.fromEntries(mlbTeams.map((team) => [team.id, team]));

  return (sources ?? []).map((source) => {
    const team = byId[source.teamId];
    const octobers = inRange(source.yearsByType?.P, from, to);
    const wsApps = inRange(source.yearsByType?.W, from, to);
    const lcsApps = inRange(source.yearsByType?.L, from, to);
    const dsApps = inRange(source.yearsByType?.D, from, to);
    const titles = inRange(source.titles, from, to);
    const lastYear = octobers.length ? Math.max(...octobers) : null;
    const appearance = source.appearances?.find((item) => item.year === lastYear);
    return {
      teamId: source.teamId,
      team,
      lastYear,
      lastLabel: appearance?.label ?? null,
      wonLastWs: Boolean(appearance?.wonWs),
      titles: titles.length,
      wsApps: wsApps.length,
      lcsApps: lcsApps.length,
      dsApps: dsApps.length,
      octobers: octobers.length,
      drought: lastYear == null ? null : Math.max(0, latestOctober - lastYear),
    };
  }).filter((row) => row.team);
}

export function sortFactRows(rows, sort, dir = 'desc') {
  const list = [...rows];
  const byName = (a, b) => a.team.name.localeCompare(b.team.name);
  const sign = dir === 'asc' ? -1 : 1;
  list.sort((a, b) => {
    let cmp = 0;
    if (sort === 'titles') cmp = (b.titles - a.titles) || (b.wsApps - a.wsApps);
    else if (sort === 'ws') cmp = (b.wsApps - a.wsApps) || (b.titles - a.titles);
    else if (sort === 'cs' || sort === 'lcs') cmp = (b.lcsApps - a.lcsApps) || (b.wsApps - a.wsApps);
    else if (sort === 'ds') cmp = (b.dsApps - a.dsApps) || (b.lcsApps - a.lcsApps);
    else if (sort === 'trips' || sort === 'octobers') {
      cmp = (b.octobers - a.octobers) || ((b.lastYear ?? 0) - (a.lastYear ?? 0));
    } else if (sort === 'drought') {
      if (a.lastYear == null && b.lastYear != null) return sign < 0 ? 1 : -1;
      if (b.lastYear == null && a.lastYear != null) return sign < 0 ? -1 : 1;
      cmp = (b.drought ?? -1) - (a.drought ?? -1);
    } else {
      if (a.lastYear == null && b.lastYear != null) return 1;
      if (b.lastYear == null && a.lastYear != null) return -1;
      cmp = (b.lastYear ?? 0) - (a.lastYear ?? 0) || (b.titles - a.titles);
    }
    return (sign * cmp) || byName(a, b);
  });
  return list;
}

export function factLeaders(rows, key, limit = 5) {
  return [...rows]
    .filter((row) => (row[key] ?? 0) > 0)
    .sort((a, b) => (b[key] - a[key]) || ((b.lastYear ?? 0) - (a.lastYear ?? 0)))
    .slice(0, limit);
}

export function factDroughtLeaders(rows, limit = 5) {
  return [...rows]
    .filter((row) => row.lastYear != null && row.drought > 0)
    .sort((a, b) => (b.drought - a.drought) || a.team.name.localeCompare(b.team.name))
    .slice(0, limit);
}

export function factsRangeLabel(range, now = new Date()) {
  const { from, to } = factsRangeBounds(range, now);
  if (range === 'all') return `1903–${to}`;
  return `${from}–${to}`;
}
