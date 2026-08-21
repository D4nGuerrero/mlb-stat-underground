import catalog from '../data/postseasonEventLogos.json';

const cache = new Map();

function catalogKeys(series) {
  const type = series?.gameType;
  const league = series?.league === 'NL' ? 'NL' : series?.league === 'AL' ? 'AL' : null;
  if (type === 'W') return ['W'];
  if (type === 'L' || type === 'C') return league ? [`L:${league}`] : ['L:AL', 'L:NL'];
  if (type === 'D') return league ? [`D:${league}`] : ['D:AL', 'D:NL'];
  if (type === 'F') return league ? [`F:${league}`] : ['F:AL', 'F:NL'];
  return [];
}

/** Official SportsLogos.Net marks. Dark-on-navy first unless darkOnly. */
export function sportsLogosEventSrc(series, year, { darkOnly = false } = {}) {
  if (!series || !year) return null;
  const y = String(year);
  const keys = catalogKeys(series);
  for (const key of keys) {
    const src = catalog[key]?.dark?.[y];
    if (src) return src;
  }
  if (darkOnly) return null;
  for (const key of keys) {
    const src = catalog[key]?.primary?.[y];
    if (src) return src;
  }
  return catalog.P?.dark?.[y] || catalog.P?.primary?.[y] || null;
}

function wikiTitlesForSeries(series, year) {
  const leagueName = series?.league === 'NL' ? 'National' : 'American';
  const type = series?.gameType;
  if (type === 'W') return [`${year}_World_Series`];
  if (type === 'L' || type === 'C') {
    return [`${year}_${leagueName}_League_Championship_Series`];
  }
  if (type === 'D') {
    return [`${year}_${leagueName}_League_Division_Series`];
  }
  if (type === 'F') {
    return [
      `${year}_${leagueName}_League_Wild_Card_Series`,
      `${year}_${leagueName}_League_Wild_Card_Game`,
    ];
  }
  return [`${year}_World_Series`];
}

function looksLikeEventLogo(source) {
  const url = String(source ?? '');
  if (!url) return false;
  if (/logo|\.svg/i.test(url)) return true;
  if (/\b(jpg|jpeg|JPG|JPEG)\b/.test(url) && /_(Game|Series|ALCS|NLCS|ALDS|NLDS)/i.test(url)) {
    return true;
  }
  return false;
}

async function fetchWikiThumbnail(title, signal) {
  const cached = cache.get(title);
  if (cached !== undefined) return cached;

  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
    action: 'query',
    origin: '*',
    format: 'json',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '720',
    pilicense: 'any',
    redirects: '1',
    titles: title,
  })}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      cache.set(title, null);
      return null;
    }
    const data = await response.json();
    const page = Object.values(data?.query?.pages ?? {})[0];
    const source = page?.thumbnail?.source;
    const resolved = looksLikeEventLogo(source) ? source.split('?')[0] : null;
    cache.set(title, resolved);
    return resolved;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    cache.set(title, null);
    return null;
  }
}

export async function resolvePostseasonEventLogo(series, year, signal) {
  if (!series || !year) return null;
  const dark = sportsLogosEventSrc(series, year, { darkOnly: true });
  if (dark) return dark;

  const key = `wiki:${year}:${series.gameType}:${series.league}`;
  if (cache.has(key)) {
    return cache.get(key) || sportsLogosEventSrc(series, year);
  }

  for (const title of wikiTitlesForSeries(series, year)) {
    const src = await fetchWikiThumbnail(title, signal);
    if (src) {
      cache.set(key, src);
      return src;
    }
  }
  cache.set(key, null);
  return sportsLogosEventSrc(series, year);
}
