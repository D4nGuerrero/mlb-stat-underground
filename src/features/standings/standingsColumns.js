export const STANDINGS_COLUMN_STORAGE_KEY = 'mlb.standings.columns.v1';

export const STANDINGS_COLUMN_CATALOG = [
  { key: 'wins', label: 'W', name: 'Wins', required: true },
  { key: 'losses', label: 'L', name: 'Losses', required: true },
  { key: 'pct', label: 'PCT', name: 'Win percentage' },
  { key: 'gb', label: 'GB', name: 'Games back' },
  { key: 'elimNumber', label: 'E#', name: 'Elimination number' },
  { key: 'home', label: 'Home', name: 'Home record' },
  { key: 'away', label: 'Away', name: 'Away record' },
  { key: 'runsScored', label: 'RS', name: 'Runs scored' },
  { key: 'runsAllowed', label: 'RA', name: 'Runs allowed' },
  { key: 'runDiff', label: 'DIFF', name: 'Run differential' },
  { key: 'oneRun', label: '1-RUN', name: 'One-run games' },
  { key: 'extraInning', label: 'XTRA', name: 'Extra-inning games' },
  { key: 'streak', label: 'STRK', name: 'Current streak' },
  { key: 'lastTen', label: 'L10', name: 'Last 10 games', grouped: true },
];

export const DEFAULT_VISIBLE_STANDINGS_COLUMNS = ['wins', 'losses', 'gb', 'runDiff', 'streak', 'lastTen'];

export const DEFAULT_STANDINGS_COLUMN_PREFS = {
  order: STANDINGS_COLUMN_CATALOG.map((col) => col.key),
  visible: DEFAULT_VISIBLE_STANDINGS_COLUMNS,
};

const CATALOG_BY_KEY = Object.fromEntries(STANDINGS_COLUMN_CATALOG.map((col) => [col.key, col]));
const CATALOG_KEYS = STANDINGS_COLUMN_CATALOG.map((col) => col.key);
const REQUIRED_KEYS = STANDINGS_COLUMN_CATALOG.filter((col) => col.required).map((col) => col.key);

export const WILDCARD_COLUMNS = [
  { key: 'wins', label: 'W' },
  { key: 'losses', label: 'L' },
  { key: 'pct', label: 'PCT' },
  { key: 'wcGb', label: 'WCGB' },
  { key: 'wcElimNumber', label: 'E#' },
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
  { key: 'runsScored', label: 'RS' },
  { key: 'runsAllowed', label: 'RA' },
  { key: 'runDiff', label: 'DIFF' },
  { key: 'oneRun', label: '1-RUN' },
  { key: 'extraInning', label: 'XTRA' },
  { key: 'streak', label: 'STRK' },
  { key: 'lastTen', label: 'L10', grouped: true },
];

export const EXPANDED_COLUMNS = [
  { key: 'wins', label: 'W' },
  { key: 'losses', label: 'L' },
  { key: 'pct', label: 'PCT' },
  { key: 'gb', label: 'GB' },
  { key: 'elimNumber', label: 'E#' },
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
  { key: 'runsScored', label: 'RS' },
  { key: 'runsAllowed', label: 'RA' },
  { key: 'runDiff', label: 'DIFF' },
  { key: 'oneRun', label: '1-RUN' },
  { key: 'extraInning', label: 'XTRA' },
  { key: 'streak', label: 'STRK' },
  { key: 'lastTen', label: 'L10', grouped: true },
];

export const VS_DIVISION_COLUMNS = [
  { key: 'vsEast', label: 'EAST' },
  { key: 'vsCentral', label: 'CENT' },
  { key: 'vsWest', label: 'WEST' },
  { key: 'vsIntr', label: 'INTR' },
  { key: 'vsRhp', label: 'RHP' },
  { key: 'vsLhp', label: 'LHP' },
];

export const COLUMN_GLOSSARY = {
  elimNumber: 'Division elimination number',
  wcElimNumber: 'Wild card elimination number',
  wcGb: 'Wild card games back',
  oneRun: 'One-run games',
  extraInning: 'Extra-inning games',
  vsEast: 'Vs. East Division (in league)',
  vsCentral: 'Vs. Central Division (in league)',
  vsWest: 'Vs. West Division (in league)',
  vsIntr: 'Vs. Interleague opponents',
  vsRhp: 'Vs. right-handed pitchers',
  vsLhp: 'Vs. left-handed pitchers',
};

export function normalizeStandingsColumnPrefs(raw) {
  const incomingOrder = Array.isArray(raw?.order) ? raw.order : CATALOG_KEYS;
  const incomingVisible = Array.isArray(raw?.visible) ? raw.visible : DEFAULT_VISIBLE_STANDINGS_COLUMNS;
  const order = [];
  const seen = new Set();

  for (const key of incomingOrder) {
    if (CATALOG_BY_KEY[key] && !seen.has(key)) {
      order.push(key);
      seen.add(key);
    }
  }
  for (const key of CATALOG_KEYS) {
    if (!seen.has(key)) order.push(key);
  }

  const visibleSet = new Set(incomingVisible.filter((key) => CATALOG_BY_KEY[key]));
  for (const key of REQUIRED_KEYS) visibleSet.add(key);

  return {
    order,
    visible: order.filter((key) => visibleSet.has(key)),
  };
}

export function resolveStandingsColumns(prefs) {
  const { order, visible } = normalizeStandingsColumnPrefs(prefs);
  const visibleSet = new Set(visible);
  return order
    .filter((key) => visibleSet.has(key))
    .map((key) => CATALOG_BY_KEY[key])
    .filter(Boolean);
}

export function moveColumnKey(order, fromKey, toKey) {
  if (fromKey === toKey) return order;
  const next = [...order];
  const from = next.indexOf(fromKey);
  const to = next.indexOf(toKey);
  if (from < 0 || to < 0) return order;
  next.splice(from, 1);
  next.splice(to, 0, fromKey);
  return next;
}

export function glossaryForColumns(columns) {
  return columns
    .filter((col) => COLUMN_GLOSSARY[col.key])
    .map((col) => ({ key: col.label, text: COLUMN_GLOSSARY[col.key] }));
}
