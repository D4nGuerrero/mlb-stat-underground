const BIRTH_COUNTRY_FLAG_CODES = {
  afghanistan: 'af',
  'american samoa': 'as',
  aruba: 'aw',
  australia: 'au',
  austria: 'at',
  bahamas: 'bs',
  belgium: 'be',
  bohemia: 'cz',
  brazil: 'br',
  'british honduras': 'bz',
  canada: 'ca',
  china: 'cn',
  colombia: 'co',
  cuba: 'cu',
  curacao: 'cw',
  czechoslovakia: 'cz',
  denmark: 'dk',
  england: 'gb-eng',
  finland: 'fi',
  france: 'fr',
  germany: 'de',
  greece: 'gr',
  guam: 'gu',
  honduras: 'hn',
  indonesia: 'id',
  ireland: 'ie',
  italy: 'it',
  jamaica: 'jm',
  japan: 'jp',
  korea: 'kr',
  lithuania: 'lt',
  mexico: 'mx',
  netherlands: 'nl',
  nicaragua: 'ni',
  'northern ireland': 'gb-nir',
  norway: 'no',
  panama: 'pa',
  'panama canal zone': 'pa',
  peru: 'pe',
  philippines: 'ph',
  poland: 'pl',
  portugal: 'pt',
  'republic of korea': 'kr',
  russia: 'ru',
  'russian federation': 'ru',
  'saudi arabia': 'sa',
  scotland: 'gb-sct',
  singapore: 'sg',
  slovakia: 'sk',
  'south africa': 'za',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  taiwan: 'tw',
  usa: 'us',
  venezuela: 've',
  vietnam: 'vn',
  wales: 'gb-wls',
  'west germany': 'de',
  'dominican republic': 'do',
  'puerto rico': 'pr',
  'south korea': 'kr',
  'united kingdom': 'gb',
  'united states': 'us',
  ussr: 'ru',
  'u.s.a.': 'us',
  'us virgin islands': 'vi',
  'u.s. virgin islands': 'vi',
  'u. s. virgin islands': 'vi',
};

const COUNTRY_ALIASES = {
  abw: 'Aruba',
  aus: 'Australia',
  aru: 'Aruba',
  bah: 'Bahamas',
  bra: 'Brazil',
  can: 'Canada',
  col: 'Colombia',
  cub: 'Cuba',
  cur: 'Curacao',
  cuw: 'Curacao',
  deu: 'Germany',
  dom: 'Dominican Republic',
  ga: 'USA',
  ger: 'Germany',
  gum: 'Guam',
  hon: 'Honduras',
  jam: 'Jamaica',
  jap: 'Japan',
  jpn: 'Japan',
  kor: 'South Korea',
  mex: 'Mexico',
  nca: 'Nicaragua',
  nic: 'Nicaragua',
  ned: 'Netherlands',
  nld: 'Netherlands',
  pan: 'Panama',
  pri: 'Puerto Rico',
  pur: 'Puerto Rico',
  pr: 'Puerto Rico',
  nir: 'Northern Ireland',
  twn: 'Taiwan',
  tpe: 'Taiwan',
  usa: 'USA',
  us: 'USA',
  ven: 'Venezuela',
  'u. s. virgin islands': 'U.S. Virgin Islands',
  'us virgin islands': 'U.S. Virgin Islands',
  vir: 'U.S. Virgin Islands',
};

function normalizeCountryText(country) {
  return String(country ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function normalizeCountryName(country) {
  const normalized = normalizeCountryText(country);
  return normalizeCountryText(COUNTRY_ALIASES[normalized] ?? normalized);
}

export function displayCountryName(country) {
  const normalized = normalizeCountryText(country);
  return COUNTRY_ALIASES[normalized] ?? String(country ?? '').trim();
}

export function countryFlagCode(country) {
  return BIRTH_COUNTRY_FLAG_CODES[normalizeCountryName(country)] ?? null;
}

export function countryFlagUrl(country) {
  const code = countryFlagCode(country);
  return code ? `https://flagcdn.com/w40/${code}.png` : null;
}
