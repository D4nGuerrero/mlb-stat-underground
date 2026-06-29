const BIRTH_COUNTRY_FLAG_CODES = {
  aruba: 'aw',
  australia: 'au',
  bahamas: 'bs',
  brazil: 'br',
  canada: 'ca',
  colombia: 'co',
  cuba: 'cu',
  curacao: 'cw',
  germany: 'de',
  guam: 'gu',
  honduras: 'hn',
  jamaica: 'jm',
  japan: 'jp',
  korea: 'kr',
  mexico: 'mx',
  netherlands: 'nl',
  nicaragua: 'ni',
  panama: 'pa',
  taiwan: 'tw',
  usa: 'us',
  venezuela: 've',
  'dominican republic': 'do',
  'puerto rico': 'pr',
  'south korea': 'kr',
  'united states': 'us',
  'u.s.a.': 'us',
  'us virgin islands': 'vi',
  'u.s. virgin islands': 'vi',
};

export function normalizeCountryName(country) {
  return String(country ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function countryFlagCode(country) {
  return BIRTH_COUNTRY_FLAG_CODES[normalizeCountryName(country)] ?? null;
}

export function countryFlagUrl(country) {
  const code = countryFlagCode(country);
  return code ? `https://flagcdn.com/w40/${code}.png` : null;
}
