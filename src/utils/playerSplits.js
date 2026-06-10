const MONTH_NAMES = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

export const SPLIT_DISPLAY_COLS = [
  { key: 'atBats', label: 'AB' },
  { key: 'runs', label: 'R' },
  { key: 'hits', label: 'H' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'baseOnBalls', label: 'BB' },
  { key: 'hitByPitch', label: 'HBP' },
  { key: 'strikeOuts', label: 'SO' },
  { key: 'stolenBases', label: 'SB' },
  { key: 'caughtStealing', label: 'CS' },
  { key: 'avg', label: 'AVG' },
  { key: 'obp', label: 'OB' },
  { key: 'slg', label: 'SLG' },
  { key: 'ops', label: 'OPS' },
];

const BREAKDOWN_ROWS = [
  { code: 'vl', label: 'vs. Left' },
  { code: 'vr', label: 'vs. Right' },
  { code: 'h', label: 'Home' },
  { code: 'a', label: 'Away' },
  { code: 'd', label: 'Day' },
  { code: 'n', label: 'Night' },
];

const SITUATION_ROWS = [
  { code: 'r0', label: 'None On' },
  { code: 'ron', label: 'Runners On' },
  { code: 'risp', label: 'Scoring Position' },
  { code: 'r123', label: 'Bases Loaded' },
  { code: 'lo', label: 'Lead Off Inning' },
  { code: 'o2', label: '2 out' },
];

const COUNT_ROWS = [
  { code: 'c00', label: 'Count 0-0' },
  { code: 'c01', label: 'Count 0-1' },
  { code: 'c02', label: 'Count 0-2' },
  { code: 'c10', label: 'Count 1-0' },
  { code: 'c11', label: 'Count 1-1' },
  { code: 'c12', label: 'Count 1-2' },
  { code: 'c20', label: 'Count 2-0' },
  { code: 'c21', label: 'Count 2-1' },
  { code: 'c22', label: 'Count 2-2' },
  { code: 'c30', label: 'Count 3-0' },
  { code: 'c31', label: 'Count 3-1' },
  { code: 'c32', label: 'Count 3-2' },
];

const BATTING_ORDER_ROWS = Array.from({ length: 9 }, (_, i) => ({
  code: `b${i + 1}`,
  label: `Batting #${i + 1}`,
}));

const STAT_SPLIT_CODES = [
  ...BREAKDOWN_ROWS,
  ...SITUATION_ROWS,
  ...COUNT_ROWS,
  ...BATTING_ORDER_ROWS,
].map((r) => r.code).join(',');

function formatDate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function splitHasActivity(stat) {
  if (!stat) return false;
  return (stat.atBats ?? 0) > 0 || (stat.plateAppearances ?? 0) > 0;
}

function mapStatRow(label, stat, id) {
  if (!splitHasActivity(stat)) return null;
  return { id: id ?? label, label, stat, ...stat };
}

function mapCodeRows(rows, splitMap) {
  return rows
    .map((row) => {
      const sp = splitMap.get(row.code);
      return mapStatRow(row.label, sp?.stat, row.code);
    })
    .filter(Boolean);
}

export async function fetchPlayerSplitSections(playerId, season, level = 'mlb') {
  const sportParam = level === 'mlb' ? '&sportId=1' : '';
  const base = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats`;

  const statSplitsUrl = `${base}?stats=statSplits&sitCodes=${STAT_SPLIT_CODES}&season=${season}&group=hitting&gameType=R${sportParam}`;
  const byMonthUrl = `${base}?stats=byMonth&season=${season}&group=hitting&gameType=R${sportParam}`;

  const today = new Date();
  const ranges = [7, 15, 30].map((days) => {
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    return {
      days,
      label: `Last ${days} Days`,
      url: `${base}?stats=byDateRange&group=hitting&startDate=${formatDate(start)}&endDate=${formatDate(today)}&gameType=R${sportParam}`,
    };
  });

  const [statSplitsData, byMonthData, ...rangeData] = await Promise.all([
    fetchJson(statSplitsUrl),
    fetchJson(byMonthUrl),
    ...ranges.map((r) => fetchJson(r.url)),
  ]);

  const codeSplits = statSplitsData.stats?.[0]?.splits ?? [];
  const splitMap = new Map(codeSplits.map((sp) => [sp.split?.code, sp]));

  const monthRows = (byMonthData.stats?.[0]?.splits ?? [])
    .map((sp) => {
      const monthNum = sp.month ?? sp.split?.month;
      const label = MONTH_NAMES[monthNum] ?? `Month ${monthNum}`;
      return mapStatRow(label, sp.stat, `month-${monthNum}`);
    })
    .filter(Boolean)
    .sort((a, b) => {
      const am = Object.entries(MONTH_NAMES).find(([, n]) => n === a.label)?.[0] ?? 0;
      const bm = Object.entries(MONTH_NAMES).find(([, n]) => n === b.label)?.[0] ?? 0;
      return Number(am) - Number(bm);
    });

  const dayMonthRows = [
    ...monthRows,
    ...ranges.map((r, i) => {
      const stat = rangeData[i]?.stats?.[0]?.splits?.[0]?.stat;
      return mapStatRow(r.label, stat, `last-${r.days}`);
    }).filter(Boolean),
  ];

  return [
    { title: 'Breakdown', rows: mapCodeRows(BREAKDOWN_ROWS, splitMap) },
    { title: 'DAY/MONTH', rows: dayMonthRows },
    { title: 'COUNT', rows: mapCodeRows(COUNT_ROWS, splitMap) },
    { title: 'BATTING ORDER', rows: mapCodeRows(BATTING_ORDER_ROWS, splitMap) },
    { title: 'SITUATION', rows: mapCodeRows(SITUATION_ROWS, splitMap) },
  ].filter((section) => section.rows.length > 0);
}