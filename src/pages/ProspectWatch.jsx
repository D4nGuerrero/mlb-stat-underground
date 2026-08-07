import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Gamepad2,
  ListOrdered,
  Search,
  Star,
  StickyNote,
  Table2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  mlbTeams,
  playerHeadshotUrl,
  teamLogoUrl,
  FALLBACK_HEADSHOT,
} from '../utils/mlbHelpers';
import { Select, BaseballSpinner, Modal } from '../components/ui';

const DEFAULT_ORG_ID = 140;
const ALL_MLB_ORG = 'all';
const MLB_LEAGUE_LOGO = 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg';
const PROSPECT_WATCHLIST_KEY = 'mlbProspectWatchlist';
const PROSPECT_NOTES_KEY = 'mlbProspectNotes';
const CURRENT_SEASON = 2026;
const MINOR_SPORT_IDS = new Set([11, 12, 13, 14, 16]);
// Same-origin Vite proxy (dev/preview). Direct data-graph.mlb.com is CORS-blocked in browsers.
const DATA_GRAPH_PROXY_URL = '/mlb-data-graph';
const PIPELINE_RANKINGS_SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/pipeline-rankings.json`;
const PROSPECT_PREVIEW_SEARCH_PARAM = 'prospect';
const SIGNING_TYPE_CODES = new Set(['SFA', 'SGN']);
const ORG_CITY_PREFIX_RE =
  /^(Arizona|Atlanta|Baltimore|Boston|Chicago|Cincinnati|Cleveland|Colorado|Detroit|Houston|Kansas City|Los Angeles|Miami|Milwaukee|Minnesota|New York|Sacramento|Philadelphia|Pittsburgh|San Diego|San Francisco|Seattle|St\. Louis|Tampa Bay|Texas|Toronto|Washington)\s+/;
const PROSPECT_HERO_GRAPH_KEY = 'formattedThumbnail({"aspectRatio":"16:9","width":640})';
const HTML_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '...',
  laquo: '\u00ab',
  lsquo: "'",
  mdash: '-',
  nbsp: ' ',
  ndash: '-',
  quot: '"',
  raquo: '\u00bb',
  rsquo: "'",
};
/** MLB Pipeline team nicknames used in ranking selection slugs (sel-pr-{year}-{slug}). */
const PIPELINE_TEAM_SLUGS = {
  108: 'angels',
  109: 'dbacks',
  110: 'orioles',
  111: 'redsox',
  112: 'cubs',
  113: 'reds',
  114: 'guardians',
  115: 'rockies',
  116: 'tigers',
  117: 'astros',
  118: 'royals',
  119: 'dodgers',
  120: 'nationals',
  121: 'mets',
  133: 'athletics',
  134: 'pirates',
  135: 'padres',
  136: 'mariners',
  137: 'giants',
  138: 'cardinals',
  139: 'rays',
  140: 'rangers',
  141: 'bluejays',
  142: 'twins',
  143: 'phillies',
  144: 'braves',
  145: 'whitesox',
  146: 'marlins',
  147: 'yankees',
  158: 'brewers',
};
const PAGE_TABS = [
  { id: 'overview', label: 'Overview', icon: Search },
  { id: 'rankings', label: 'Rankings', icon: ListOrdered },
  { id: 'table', label: 'Table', icon: null },
  { id: 'favorites', label: 'Favorites', icon: Star },
];
const PROSPECT_PREVIEW_TABS = [
  { id: 'bio', label: 'Bio' },
  { id: 'stats', label: 'Stats' },
  { id: 'notes', label: 'Notes' },
  { id: 'links', label: 'Links' },
];
const LEVEL_ORDER = {
  11: 1,
  12: 2,
  13: 3,
  14: 4,
  16: 5,
};
const LEVEL_SHORT = {
  11: 'AAA',
  12: 'AA',
  13: 'A+',
  14: 'A',
  16: 'Rookie',
};
const LEVEL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: '11', label: 'AAA' },
  { value: '12', label: 'AA' },
  { value: '13', label: 'A+' },
  { value: '14', label: 'A' },
  { value: '16', label: 'Rk' },
];

function LevelFilterBar({ value, onChange }) {
  return (
    <div className="flex w-full items-center gap-1">
      {LEVEL_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={[
            'min-w-0 flex-1 rounded-xl border px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors sm:px-2.5 sm:text-[11px]',
            value === filter.value
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200',
          ].join(' ')}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
const TEAM_OPTIONS = [
  {
    value: ALL_MLB_ORG,
    label: 'All MLB',
    icon: MLB_LEAGUE_LOGO,
  },
  ...mlbTeams.map((team) => ({
    value: team.id,
    label: `${team.name} (${team.abbr})`,
    icon: teamLogoUrl(team.id),
  })),
];

function isAllMlbOrg(orgId) {
  return orgId === ALL_MLB_ORG || orgId === 'all';
}

const miniStatCell = 'px-1.5 py-1 text-right tabular-nums';

function toLocalIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso() {
  return toLocalIsoDate(new Date());
}

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function prettyDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatMonthDayYear(isoDate, month = '2-digit') {
  if (!isoDate) return '—';
  const date = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month,
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatWeight(value) {
  if (value == null || value === '' || value === '—') return '—';
  return String(value).includes('lb') ? String(value) : `${value}`;
}

function orgFromId(teamId) {
  const id = Number(teamId);
  if (!id) return null;
  return mlbTeams.find((team) => Number(team.id) === id) ?? null;
}

function parentOrgForPlayer(player) {
  return (
    orgFromId(player?.affiliate?.parentOrgId) ??
    orgFromId(player?.currentTeam?.parentOrgId) ??
    orgFromId(player?.signingTransaction?.toTeam?.id)
  );
}

function orgNickname(org) {
  return String(org?.name ?? '')
    .replace(ORG_CITY_PREFIX_RE, '')
    || org?.name
    || 'Org';
}

function shortCountryLabel(country) {
  if (!country) return null;
  const mapped = {
    'Dominican Republic': 'DOM',
    'Republic of Korea': 'ROK',
    'United States': 'USA',
  }[country];
  return mapped ?? country;
}

function findSigningTransaction(transactions = []) {
  return [...transactions]
    .filter((txn) => (
      SIGNING_TYPE_CODES.has(txn?.typeCode) ||
      /signed/i.test(`${txn?.typeDesc ?? ''} ${txn?.description ?? ''}`)
    ))
    .sort((a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? '')))[0] ?? null;
}

function formatSigningLabel(player) {
  if (player?.signed) return player.signed;
  const signing = player?.signingTransaction ?? findSigningTransaction(player?.transactions);
  if (!signing) return player?.signed ?? '—';
  const org = orgFromId(signing.toTeam?.id) ?? parentOrgForPlayer(player);
  const date = formatMonthDayYear(signing.date, 'long');
  return [date, org?.abbr].filter((part) => part && part !== '—').join(' - ') || '—';
}

function prospectNameSlug(name, id) {
  const slugName = String(name || 'player')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slugName}-${id}`;
}

function officialPipelinePlayerUrl(player) {
  const org = parentOrgForPlayer(player);
  const slug = pipelineSlugForOrg(org?.id);
  const nameSlug = player?.nameSlug ?? prospectNameSlug(player?.name, player?.id);
  return slug && player?.id
    ? `https://www.mlb.com/milb/prospects/${slug}/${nameSlug}`
    : officialPipelineUrl(org?.id);
}

function isGenericProspectPhoto(url = '') {
  return /generic:headshot|headshot\/silo|\/silo\//i.test(String(url));
}

function prospectHeroImageUrl(player) {
  if (player?.heroImageUrl && !isGenericProspectPhoto(player.heroImageUrl)) return player.heroImageUrl;
  if (player?.photoUrl && !isGenericProspectPhoto(player.photoUrl)) return player.photoUrl;
  return player?.photoUrl || prospectHeadshotUrl(player?.id);
}

function attachProspectHeroFallback(event, player) {
  const img = event.currentTarget;
  if (!img.dataset.fallbackStage) {
    img.dataset.fallbackStage = 'headshot';
    img.src = prospectHeadshotUrl(player?.id);
    return;
  }
  attachHeadshotFallback(event, player?.id);
}

function hasStatData(stat = {}) {
  return Object.values(stat ?? {}).some((value) => value != null && value !== '' && value !== '—');
}

function decodeHtmlEntities(text = '') {
  return String(text).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_ENTITIES[normalized] ?? match;
  });
}

function htmlToPlainText(html = '') {
  return decodeHtmlEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function prospectBioParagraphs(contentText = '') {
  const html = String(contentText ?? '');
  const matches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const chunks = matches.length ? matches.map((match) => match[1]) : [html];
  return chunks
    .map(htmlToPlainText)
    .filter((text) => text && !/^Video scouting report/i.test(text));
}

function parseProspectBioEntry(entry) {
  const grades = [];
  const story = [];

  prospectBioParagraphs(entry?.contentText).forEach((paragraph) => {
    const scoutingMatch = paragraph.match(/^Scouting grades:\s*(.+)$/i);
    if (scoutingMatch) {
      grades.push(scoutingMatch[1].trim());
      return;
    }
    story.push(paragraph);
  });

  return {
    year: entry?.contentTitle ?? null,
    grades,
    story,
  };
}

function currentProspectBio(prospectBio = []) {
  const source = Array.isArray(prospectBio) ? prospectBio : [];
  const entries = source
    .map(parseProspectBioEntry)
    .filter((entry) => entry.grades.length || entry.story.length);

  if (!entries.length) return { year: null, grades: [], story: [] };

  return (
    entries.find((entry) => String(entry.year) === String(CURRENT_SEASON)) ??
    [...entries].sort((a, b) => {
      const ay = Number(a.year);
      const by = Number(b.year);
      return (Number.isFinite(by) ? by : -Infinity) - (Number.isFinite(ay) ? ay : -Infinity);
    })[0] ??
    entries[entries.length - 1]
  );
}

function mergeProspectPlayer(base, enriched) {
  if (!base) return enriched;
  if (!enriched) return base;
  const baseHasStat = hasStatData(base.stat);
  const baseHasSeason = hasStatData(base.season);
  const useBasePerformance = baseHasStat || baseHasSeason;
  const mergedTags = useBasePerformance && enriched.kind && enriched.kind !== base.kind
    ? base.tags ?? []
    : [...new Set([...(base.tags ?? []), ...(enriched.tags ?? [])])];
  return {
    ...base,
    ...enriched,
    affiliate: base.affiliate ?? enriched.affiliate,
    kind: useBasePerformance ? base.kind : enriched.kind ?? base.kind,
    mode: useBasePerformance ? base.mode : enriched.mode ?? base.mode,
    stat: baseHasStat ? base.stat : enriched.stat,
    season: baseHasSeason ? base.season : enriched.season,
    summary: base.summary && base.summary !== 'No stat line for this lens'
      ? base.summary
      : enriched.summary,
    heroImageUrl: enriched.heroImageUrl ?? base.heroImageUrl,
    signed: enriched.signed ?? base.signed,
    prospectBio: enriched.prospectBio?.length ? enriched.prospectBio : base.prospectBio,
    rankingType: enriched.rankingType ?? base.rankingType,
    score: base.score ?? enriched.score,
    tags: mergedTags,
  };
}

function initialOrgId() {
  try {
    const favoriteTeams = JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]');
    return Number(favoriteTeams?.[0]) || DEFAULT_ORG_ID;
  } catch {
    return DEFAULT_ORG_ID;
  }
}

function loadProspectWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(PROSPECT_WATCHLIST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function loadProspectNotes() {
  try {
    return JSON.parse(localStorage.getItem(PROSPECT_NOTES_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function watchedEntryFromPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    boxscoreName: player.boxscoreName ?? player.name,
    rank: player.rank ?? null,
    overallRank: player.overallRank ?? null,
    position: player.position,
    eta: player.eta,
    age: player.age,
    birthDate: player.birthDate,
    birthCountry: player.birthCountry,
    height: player.height,
    weight: player.weight,
    bats: player.bats,
    throws: player.throws,
    photoUrl: player.photoUrl,
    heroImageUrl: player.heroImageUrl,
    nameSlug: player.nameSlug,
    signed: player.signed,
    signingTransaction: player.signingTransaction,
    prospectBio: player.prospectBio,
    rankingType: player.rankingType,
    affiliate: {
      id: player.affiliate?.id,
      name: player.affiliate?.name,
      sportId: player.affiliate?.sport?.id ?? player.affiliate?.sportId,
      parentOrgId: player.affiliate?.parentOrgId,
    },
    kind: player.kind,
    summary: player.summary,
    season: player.season,
    updatedAt: new Date().toISOString(),
    tags: player.tags ?? [],
  };
}

function prospectHeadshotUrl(playerId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/c_fill,g_auto/w_180/v1/people/${playerId}/headshot/milb/current`;
}

function attachHeadshotFallback(event, playerId) {
  const img = event.currentTarget;
  if (!img.dataset.fallbackStage) {
    img.dataset.fallbackStage = 'mlb';
    img.src = playerHeadshotUrl(playerId);
    return;
  }
  img.src = FALLBACK_HEADSHOT;
}

function affiliateLogoUrl(team) {
  if (!team?.id) return '';
  if (team.parentOrgId === 140 && team.id === 2413) return 'https://www.mlbstatic.com/team-logos/625.svg';
  if (team.parentOrgId === 140 && team.id === 625) return 'https://www.mlbstatic.com/team-logos/411.svg';
  return `https://www.mlbstatic.com/team-logos/${team.id}.svg`;
}

function rookieFallbackLogo(team) {
  return teamLogoUrl(team.parentOrgId ?? DEFAULT_ORG_ID);
}

function sortAffiliates(teams) {
  return [...teams]
    .filter((team) => team.active && MINOR_SPORT_IDS.has(team.sport?.id))
    .sort((a, b) => {
      const levelDiff = (LEVEL_ORDER[a.sport?.id] ?? 99) - (LEVEL_ORDER[b.sport?.id] ?? 99);
      if (levelDiff) return levelDiff;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
}

function cleanNumber(value, fallback = '—') {
  if (value == null || value === '' || value === '.---' || value === '-.--' || value === '-') return fallback;
  return value;
}

function parseInnings(value) {
  if (!value) return 0;
  const [whole, frac = '0'] = String(value).split('.');
  return Number(whole) + (Number(frac) || 0) / 3;
}

function hitterScore(stat = {}) {
  return (
    (Number(stat.hits) || 0) * 2 +
    (Number(stat.doubles) || 0) * 2 +
    (Number(stat.triples) || 0) * 3 +
    (Number(stat.homeRuns) || 0) * 5 +
    (Number(stat.rbi) || 0) * 1.5 +
    (Number(stat.runs) || 0) +
    (Number(stat.baseOnBalls) || 0) +
    (Number(stat.stolenBases) || 0) * 1.5 -
    (Number(stat.strikeOuts) || 0) * 0.25
  );
}

function pitcherScore(stat = {}) {
  const ip = parseInnings(stat.inningsPitched);
  return (
    ip * 2.2 +
    (Number(stat.strikeOuts) || 0) * 1.4 -
    (Number(stat.earnedRuns) || 0) * 3 -
    (Number(stat.hits) || 0) * 0.65 -
    (Number(stat.baseOnBalls) || 0) * 0.8 +
    (Number(stat.wins) || 0) * 1.5 +
    (Number(stat.saves) || 0) * 1.5
  );
}

function statSummary(stat, kind, mode) {
  if (kind === 'batting') {
    const pieces = [
      `${cleanNumber(stat.avg)} AVG`,
      `OPS ${cleanNumber(stat.ops)}`,
      `${cleanNumber(stat.homeRuns, 0)} HR`,
    ];
    if (mode !== 'season') pieces.push(`${cleanNumber(stat.rbi, 0)} RBI`);
    return pieces.join(' · ');
  }

  const pieces = [
    `ERA ${cleanNumber(stat.era)}`,
    `WHIP ${cleanNumber(stat.whip)}`,
    `K/9 ${cleanNumber(stat.strikeoutsPer9Inn)}`,
  ];
  if (mode !== 'season') pieces.push(`${cleanNumber(stat.strikeOuts, 0)} K`);
  return pieces.join(' · ');
}

function playerAffiliationLabel(player) {
  const sportId = player.affiliate?.sport?.id ?? player.affiliate?.sportId;
  return LEVEL_SHORT[sportId] ?? player.affiliate?.name ?? null;
}

function formatSlashRate(value) {
  const raw = cleanNumber(value, '');
  if (!raw) return '—';
  // Keep API style (.266) but pad bare decimals if needed
  if (raw.startsWith('.')) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(3).replace(/^0/, '');
}

/** Compact season line: .266/.402/.448 (.850) 146 AB */
function seasonStatSnippet(player) {
  if (!player?.season) return '';
  if (player.kind === 'batting') {
    const s = player.season;
    const avg = formatSlashRate(s.avg);
    const obp = formatSlashRate(s.obp);
    const slg = formatSlashRate(s.slg);
    const ops = formatSlashRate(s.ops);
    const ab = cleanNumber(s.atBats ?? s.ab, null);
    const slash = `${avg}/${obp}/${slg} (${ops})`;
    return ab != null ? `${slash} ${ab} AB` : slash;
  }
  // Pitchers: keep short ERA/WHIP (no slash line)
  const s = player.season;
  const ip = cleanNumber(s.inningsPitched, null);
  const base = `ERA ${cleanNumber(s.era)} · WHIP ${cleanNumber(s.whip)} · K/9 ${cleanNumber(s.strikeoutsPer9Inn)}`;
  return ip != null ? `${base} · ${ip} IP` : base;
}

/**
 * Season-long “should I get excited?” score for Prospect Radar.
 * Favors strong rates with a sample, and a mild boost for lower minors.
 */
function prospectExcitementScore(player) {
  const season = player?.season ?? player?.stat ?? {};
  const sportId = player.affiliate?.sport?.id ?? player.affiliate?.sportId;
  const levelBoost = { 16: 1.18, 14: 1.12, 13: 1.08, 12: 1.04, 11: 1.0 }[sportId] ?? 1;

  if (player.kind === 'batting') {
    const ab = Number(season.atBats ?? season.ab) || 0;
    if (ab < 40) return 0;
    const ops = Number(season.ops) || 0;
    const obp = Number(season.obp) || 0;
    const slg = Number(season.slg) || 0;
    const avg = Number(season.avg) || 0;
    const hr = Number(season.homeRuns) || 0;
    const sb = Number(season.stolenBases) || 0;
    const bb = Number(season.baseOnBalls) || 0;
    const k = Number(season.strikeOuts) || 0;
    const bbK = k > 0 ? bb / k : bb > 0 ? 1 : 0;
    const sample = Math.min(1.25, 0.7 + ab / 250);
    return (
      (ops * 110 + obp * 45 + slg * 35 + avg * 25 + hr * 2.2 + sb * 1.6 + bbK * 12) * sample * levelBoost
    );
  }

  const ip = parseInnings(season.inningsPitched);
  if (ip < 15) return 0;
  const era = Number(season.era);
  const whip = Number(season.whip);
  const k9 = Number(season.strikeoutsPer9Inn) || 0;
  const bb9 = Number(season.walksPer9Inn ?? season.baseOnBallsPer9) || 0;
  const eraScore = Number.isFinite(era) ? Math.max(0, 5.5 - era) * 14 : 0;
  const whipScore = Number.isFinite(whip) ? Math.max(0, 1.55 - whip) * 28 : 0;
  const sample = Math.min(1.2, 0.75 + ip / 80);
  return (eraScore + whipScore + k9 * 4.2 - bb9 * 1.5 + ip * 0.35) * sample * levelBoost;
}

function buildDiscoveryTags(player) {
  const stat = player.stat ?? player.season ?? {};
  const sportId = player.affiliate?.sport?.id ?? player.affiliate?.sportId;
  const tags = [];

  if (player.kind === 'batting') {
    const ops = Number(stat.ops) || 0;
    const avg = Number(stat.avg) || 0;
    const hr = Number(stat.homeRuns) || 0;
    const sb = Number(stat.stolenBases) || 0;
    if (ops >= 0.9) tags.push('OPS .900+');
    if (avg >= 0.32) tags.push('Hot Bat');
    if (hr >= 2 || (player.mode === 'season' && hr >= 10)) tags.push('Power Spike');
    if (sb >= 3 || (player.mode === 'season' && sb >= 15)) tags.push('Speed Threat');
    if ((sportId === 13 || sportId === 14 || sportId === 16) && ops >= 0.82) tags.push('Sleeper Bat');
  } else {
    const era = Number(stat.era) || 99;
    const whip = Number(stat.whip) || 99;
    const k9 = Number(stat.strikeoutsPer9Inn) || 0;
    const bb9 = Number(stat.walksPer9Inn) || 0;
    if (era <= 2.75) tags.push('Shut-Down Arm');
    if (k9 >= 10.5) tags.push('K Machine');
    if (whip <= 1.1) tags.push('Command Zone');
    if (bb9 >= 4.5) tags.push('Control Issue');
    if ((sportId === 13 || sportId === 14 || sportId === 16) && era <= 3.5) tags.push('Sleeper Arm');
  }

  return tags.slice(0, 3);
}

function boxPlayerPosition(player) {
  const positions = [
    player.position?.abbreviation,
    ...(player.allPositions ?? []).map((pos) => pos?.abbreviation),
  ].filter(Boolean);
  return [...new Set(positions)].join('/') || '—';
}

function mapBoxPlayer(player, kind, affiliate, orderIndex = 0) {
  const stat = player.stats?.[kind] ?? {};
  const season = player.seasonStats?.[kind] ?? {};
  const mapped = {
    id: player.person?.id,
    name: player.person?.fullName,
    boxscoreName: player.person?.boxscoreName ?? player.person?.fullName,
    affiliate,
    stat,
    season,
    summary: stat.summary ?? '',
    score: kind === 'batting' ? hitterScore(stat) : pitcherScore(stat),
    kind,
    mode: 'today',
    orderIndex,
    battingOrder: player.battingOrder,
    position: boxPlayerPosition(player),
  };
  return { ...mapped, tags: buildDiscoveryTags(mapped) };
}

function mapStatSplitPlayer(split, kind, affiliate, mode) {
  const stat = split?.stat ?? {};
  const mapped = {
    id: split?.player?.id,
    name: split?.player?.fullName,
    boxscoreName: split?.player?.boxscoreName ?? split?.player?.fullName,
    affiliate,
    stat,
    season: stat,
    summary: statSummary(stat, kind, mode),
    score: kind === 'batting' ? hitterScore(stat) : pitcherScore(stat),
    kind,
    mode,
    position:
      split?.position?.abbreviation ??
      split?.player?.primaryPosition?.abbreviation ??
      split?.player?.position?.abbreviation ??
      '—',
  };
  return { ...mapped, tags: buildDiscoveryTags(mapped) };
}

function mapRosterPlayer(entry, affiliate) {
  const position = entry.position?.abbreviation ?? '—';
  const kind = position === 'P' ? 'pitching' : 'batting';
  return {
    id: entry.person?.id,
    name: entry.person?.fullName,
    boxscoreName: entry.person?.boxscoreName ?? entry.person?.fullName,
    affiliate,
    stat: {},
    season: {},
    summary: 'No stat line for this lens',
    score: null,
    kind,
    mode: 'roster',
    position,
    tags: [],
  };
}

function extractTeamPlayers(boxscore, side, affiliate) {
  const teamBox = boxscore?.teams?.[side];
  if (!teamBox?.players) return { hitters: [], pitchers: [] };

  const hitters = (teamBox.batters ?? [])
    .map((id, orderIndex) => ({ player: teamBox.players[`ID${id}`], orderIndex }))
    .filter(({ player }) => player?.person?.id && player?.stats?.batting)
    .map(({ player, orderIndex }) => mapBoxPlayer(player, 'batting', affiliate, orderIndex))
    .sort((a, b) => {
      const ao = parseInt(a.battingOrder, 10);
      const bo = parseInt(b.battingOrder, 10);
      if (!Number.isNaN(ao) && !Number.isNaN(bo) && ao !== bo) return ao - bo;
      if (!Number.isNaN(ao) && Number.isNaN(bo)) return -1;
      if (Number.isNaN(ao) && !Number.isNaN(bo)) return 1;
      return a.orderIndex - b.orderIndex;
    });

  const pitchers = (teamBox.pitchers ?? [])
    .map((id, orderIndex) => ({ player: teamBox.players[`ID${id}`], orderIndex }))
    .filter(({ player }) => player?.person?.id && player?.stats?.pitching)
    .map(({ player, orderIndex }) => mapBoxPlayer(player, 'pitching', affiliate, orderIndex))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return { hitters, pitchers };
}

function gameStatusLabel(game) {
  const state = game?.status?.abstractGameState;
  if (state === 'Final') return 'Final';
  if (state === 'Live') {
    return game.linescore?.currentInningOrdinal
      ? `${game.linescore.inningState ?? ''} ${game.linescore.currentInningOrdinal}`.trim()
      : 'Live';
  }
  return game?.status?.detailedState ?? 'Scheduled';
}

function scoreForSide(game, side) {
  return game?.teams?.[side]?.score ?? game?.linescore?.teams?.[side]?.runs ?? 0;
}

async function fetchSeasonStatGroup(team, group) {
  const params = new URLSearchParams({
    group,
    teamId: String(team.id),
    sportIds: String(team.sport.id),
    playerPool: 'all',
    limit: '200',
    stats: 'season',
    season: String(CURRENT_SEASON),
  });

  const response = await fetch(`https://statsapi.mlb.com/api/v1/stats?${params.toString()}`);
  const data = await response.json();
  return data.stats?.[0]?.splits ?? [];
}

async function fetchAffiliateActiveRoster(team) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=active&season=${CURRENT_SEASON}&hydrate=person(currentTeam)`,
  );
  const data = await response.json();
  const entries = (data.roster ?? []).filter(
    (entry) => entry.status?.code === 'A' && entry.person?.currentTeam?.id === team.id,
  );

  return {
    ids: new Set(
      entries
      .map((entry) => Number(entry.person?.id))
      .filter(Boolean),
    ),
    players: entries
      .filter((entry) => entry.person?.id)
      .map((entry) => mapRosterPlayer(entry, team)),
  };
}

function pipelineSlugForOrg(orgId) {
  return PIPELINE_TEAM_SLUGS[Number(orgId)] ?? null;
}

function officialPipelineUrl(orgId) {
  if (isAllMlbOrg(orgId)) return 'https://www.mlb.com/milb/prospects';
  const slug = pipelineSlugForOrg(orgId);
  return slug ? `https://www.mlb.com/milb/prospects/${slug}/` : 'https://www.mlb.com/milb/prospects';
}

let pipelineSnapshotPromise = null;

function loadPipelineSnapshot() {
  if (!pipelineSnapshotPromise) {
    pipelineSnapshotPromise = fetch(PIPELINE_RANKINGS_SNAPSHOT_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Rankings snapshot missing (${response.status})`);
        return response.json();
      })
      .catch((err) => {
        pipelineSnapshotPromise = null;
        throw err;
      });
  }
  return pipelineSnapshotPromise;
}

async function fetchPipelineRankingsFromGraph(selectionSlug, limit = 30) {
  const query = `
    query GetPlayerRankings($slug: String!, $limit: Int) {
      getPlayerRankingsFromSelection(slug: $slug, limit: $limit) {
        rank
        playerEntity {
          eta
          position
          heroImage: formattedThumbnail(aspectRatio: "16:9", width: 640)
          playerPhotoCustomUrl
          signed
          prospectBio {
            contentTitle
            contentText
          }
          player {
            id
            fullName
            birthDate
            currentAge
            height
            weight
            primaryPosition { abbreviation name }
          }
        }
      }
    }
  `;

  const response = await fetch(DATA_GRAPH_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { slug: selectionSlug, limit },
    }),
  });

  if (!response.ok) {
    throw new Error(`Pipeline rankings failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? 'Pipeline rankings error');
  }

  return payload.data?.getPlayerRankingsFromSelection ?? [];
}

async function fetchPipelineRankingsFromSnapshot(selectionSlug, limit = 30) {
  const snapshot = await loadPipelineSnapshot();
  const rows = snapshot?.selections?.[selectionSlug];
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`No snapshot rankings for ${selectionSlug}`);
  }
  return rows.slice(0, limit);
}

/** Live via same-origin proxy when available; fall back to build-time snapshot (CORS-safe). */
async function fetchPipelineRankings(selectionSlug, limit = 30) {
  try {
    return await fetchPipelineRankingsFromGraph(selectionSlug, limit);
  } catch (liveError) {
    try {
      return await fetchPipelineRankingsFromSnapshot(selectionSlug, limit);
    } catch {
      throw liveError instanceof Error
        ? liveError
        : new Error('Failed to fetch Pipeline rankings');
    }
  }
}

async function enrichRankedPeople(rankedRows) {
  const ids = rankedRows
    .map((row) => Number(row?.playerEntity?.player?.id))
    .filter(Boolean);
  if (!ids.length) {
    return { peopleById: new Map(), teamSportById: new Map() };
  }

  const peopleRes = await fetch(
    `https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(',')}&hydrate=currentTeam,transactions`,
  );
  const peopleData = await peopleRes.json();
  const peopleById = new Map(
    (peopleData.people ?? []).map((person) => [Number(person.id), person]),
  );

  const teamIds = [
    ...new Set(
      [...peopleById.values()]
        .map((person) => Number(person.currentTeam?.id))
        .filter(Boolean),
    ),
  ];

  const teamSportById = new Map();
  if (teamIds.length) {
    await Promise.all(
      teamIds.map(async (teamId) => {
        try {
          const teamRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}`);
          const teamData = await teamRes.json();
          const team = teamData.teams?.[0];
          if (team?.id) {
            teamSportById.set(Number(team.id), {
              id: team.id,
              name: team.name,
              sportId: team.sport?.id,
              sportName: team.sport?.name,
              parentOrgId: team.parentOrgId,
            });
          }
        } catch {
          /* ignore single-team failures */
        }
      }),
    );
  }

  return { peopleById, teamSportById };
}

function mapPipelineRankingRow(row, peopleById, teamSportById, overallRankById, rankingType = 'team') {
  const entity = row?.playerEntity ?? {};
  const graphPlayer = entity.player ?? {};
  const id = Number(graphPlayer.id);
  const person = peopleById.get(id);
  const teamMeta = person?.currentTeam?.id
    ? teamSportById.get(Number(person.currentTeam.id))
    : null;
  const position =
    entity.position ||
    person?.primaryPosition?.abbreviation ||
    graphPlayer.primaryPosition?.abbreviation ||
    '—';
  const isPitcher = /HP|P$|^P\b|RHP|LHP/i.test(String(position)) || position === 'P';

  return {
    id,
    rank: Number(row.rank) || null,
    overallRank: overallRankById.get(id) ?? null,
    rankingType,
    name: person?.fullName ?? graphPlayer.fullName ?? 'Unknown',
    boxscoreName: person?.boxscoreName ?? graphPlayer.fullName,
    position,
    eta: entity.eta ?? '—',
    age: person?.currentAge ?? graphPlayer.currentAge ?? '—',
    birthDate: person?.birthDate ?? graphPlayer.birthDate ?? null,
    birthCountry: person?.birthCountry ?? null,
    height: person?.height ?? graphPlayer.height ?? '—',
    weight: person?.weight ?? graphPlayer.weight ?? '—',
    bats: person?.batSide?.code ?? '—',
    throws: person?.pitchHand?.code ?? '—',
    photoUrl: entity.playerPhotoCustomUrl || prospectHeadshotUrl(id),
    heroImageUrl: entity.heroImage ?? entity[PROSPECT_HERO_GRAPH_KEY] ?? null,
    nameSlug: person?.nameSlug ?? prospectNameSlug(person?.fullName ?? graphPlayer.fullName, id),
    primaryNumber: person?.primaryNumber ?? null,
    signed: entity.signed ?? null,
    signingTransaction: findSigningTransaction(person?.transactions),
    prospectBio: entity.prospectBio ?? [],
    kind: isPitcher ? 'pitching' : 'batting',
    mode: 'ranking',
    summary: entity.eta ? `ETA ${entity.eta}` : 'Pipeline ranking',
    season: {},
    stat: {},
    score: null,
    tags: [],
    affiliate: teamMeta
      ? {
          id: teamMeta.id,
          name: teamMeta.name,
          sport: { id: teamMeta.sportId, name: teamMeta.sportName },
          sportId: teamMeta.sportId,
          parentOrgId: teamMeta.parentOrgId,
        }
      : person?.currentTeam
        ? {
            id: person.currentTeam.id,
            name: person.currentTeam.name,
            parentOrgId: person.currentTeam.parentOrgId,
          }
        : null,
  };
}

async function loadOfficialOrgRankings(orgId) {
  const top100Selection = `sel-pr-${CURRENT_SEASON}-top100`;

  if (isAllMlbOrg(orgId)) {
    const top100Rows = await fetchPipelineRankings(top100Selection, 100);
    const overallRankById = new Map(
      top100Rows
        .map((row) => [Number(row?.playerEntity?.player?.id), Number(row.rank)])
        .filter(([id, rank]) => id && rank),
    );
    const { peopleById, teamSportById } = await enrichRankedPeople(top100Rows);
    return top100Rows.map((row) =>
      mapPipelineRankingRow(row, peopleById, teamSportById, overallRankById, 'top100'),
    );
  }

  const teamSlug = pipelineSlugForOrg(orgId);
  if (!teamSlug) return [];

  const teamSelection = `sel-pr-${CURRENT_SEASON}-${teamSlug}`;

  const [teamRows, top100Rows] = await Promise.all([
    fetchPipelineRankings(teamSelection, 30),
    fetchPipelineRankings(top100Selection, 100).catch(() => []),
  ]);

  const overallRankById = new Map(
    top100Rows
      .map((row) => [Number(row?.playerEntity?.player?.id), Number(row.rank)])
      .filter(([id, rank]) => id && rank),
  );

  const { peopleById, teamSportById } = await enrichRankedPeople(teamRows);
  return teamRows.map((row) => mapPipelineRankingRow(row, peopleById, teamSportById, overallRankById, 'team'));
}

function AffiliateLogo({ team, className = 'w-16 h-16' }) {
  const [src, setSrc] = useState(affiliateLogoUrl(team));
  return (
    <img
      src={src}
      alt=""
      className={`${className} object-contain drop-shadow-xl`}
      onError={() => {
        if (team.sport?.id === 16 && src !== rookieFallbackLogo(team)) {
          setSrc(rookieFallbackLogo(team));
          return;
        }
        setSrc(rookieFallbackLogo(team));
      }}
    />
  );
}

function TagPill({ tag }) {
  return (
    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
      {tag}
    </span>
  );
}

function PlayerChip({
  player,
  onSelect,
  isWatched,
  onToggleWatch,
  showAffiliation = false,
  showSeasonStats = false,
  /** 'today' = recent line + optional season; 'season' = slash line only (Prospect Radar) */
  lineMode = 'today',
  accentHover = 'group-hover:text-emerald-300',
}) {
  const affiliation = showAffiliation ? playerAffiliationLabel(player) : null;
  const seasonStats = seasonStatSnippet(player);
  const primaryLine = lineMode === 'season'
    ? (seasonStats || player.summary || 'Season line')
    : (player.summary || 'Box score line');
  const secondarySeason = lineMode === 'today' && showSeasonStats ? seasonStats : '';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(player)}
      className="group relative w-full text-left flex items-center gap-2 rounded-xl bg-slate-950/45 p-2 pr-9 hover:bg-emerald-500/5 transition-colors"
    >
      <img
        src={prospectHeadshotUrl(player.id)}
        alt=""
        className="w-10 h-10 rounded-xl object-cover bg-slate-800"
        onError={(e) => attachHeadshotFallback(e, player.id)}
      />
      <div className="min-w-0">
        <div className={`text-sm font-bold text-white truncate ${accentHover}`}>
          {affiliation ? `${player.name} (${affiliation})` : player.name}
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          {primaryLine}
          {secondarySeason ? (
            <>
              <span className="text-slate-600"> · </span>
              <span className="text-slate-500">{secondarySeason}</span>
            </>
          ) : null}
        </div>
        {lineMode === 'season' && player.tags?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {player.tags.slice(0, 2).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        ) : null}
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatch?.(player);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onToggleWatch?.(player);
          }
        }}
        className={[
          'absolute right-2 top-1/2 -translate-y-1/2 rounded-full border p-1 transition-colors',
          isWatched
            ? 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300'
            : 'border-slate-700 bg-slate-900 text-slate-500 group-hover:text-yellow-300',
        ].join(' ')}
        aria-label={isWatched ? 'Remove from prospect watchlist' : 'Add to prospect watchlist'}
      >
        <Star size={13} fill={isWatched ? 'currentColor' : 'none'} />
      </span>
    </button>
  );
}

function PerformerCard({ title, player, tone = 'emerald', onSelectPlayer, isWatched, onToggleWatch }) {
  if (!player) {
    return (
      <div className="p-1">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{title}</div>
        <div className="mt-2 text-sm text-slate-500">No box score yet</div>
      </div>
    );
  }

  const accent = tone === 'orange'
    ? 'text-orange-300 border-orange-500/25'
    : 'text-emerald-300 border-emerald-500/25';

  return (
    <div className={`min-w-0 border-t border-slate-800/70 pt-3 ${accent}`}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{title}</div>
      <PlayerChip
        player={player}
        onSelect={onSelectPlayer}
        isWatched={isWatched?.(player.id)}
        onToggleWatch={onToggleWatch}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {player.tags?.map((tag) => <TagPill key={`${player.id}-${tag}`} tag={tag} />)}
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        Season {player.kind === 'batting'
          ? `OPS ${cleanNumber(player.season.ops)}`
          : `ERA ${cleanNumber(player.season.era)} · WHIP ${cleanNumber(player.season.whip)}`}
      </div>
    </div>
  );
}

function BoxScoreTable({ rows, kind, onSelectPlayer, isWatched, onToggleWatch }) {
  if (!rows.length) return null;
  const cols = kind === 'batting'
    ? ['AB', 'R', 'H', 'HR', 'RBI', 'BB', 'K', 'OPS']
    : ['IP', 'H', 'ER', 'BB', 'K', 'ERA', 'WHIP'];

  return (
    <div className="overflow-x-auto border-t border-slate-800/80 pt-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            <th className="text-left px-2 py-1.5 font-medium">{kind === 'batting' ? 'Batters' : 'Pitchers'}</th>
            {cols.map((col) => (
              <th key={col} className={`${miniStatCell} font-medium`}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => (
            <tr key={`${kind}-${player.id}`} className="border-b border-slate-900 last:border-none hover:bg-slate-900/70">
              <td className="px-2 py-1 min-w-28 max-w-32">
                <button
                  type="button"
                  onClick={() => onSelectPlayer?.(player)}
                  className="font-semibold text-slate-200 hover:text-emerald-300 truncate max-w-28 text-left"
                >
                  {player.boxscoreName}
                </button>
                {kind === 'batting' && player.position && player.position !== '—' && (
                  <span className="ml-1 text-[10px] font-semibold text-slate-600">
                    {player.position}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onToggleWatch?.(player)}
                  className={`ml-1 align-middle ${isWatched?.(player.id) ? 'text-yellow-300' : 'text-slate-600 hover:text-yellow-300'}`}
                  aria-label={isWatched?.(player.id) ? 'Remove from prospect watchlist' : 'Add to prospect watchlist'}
                >
                  <Star size={10} fill={isWatched?.(player.id) ? 'currentColor' : 'none'} />
                </button>
              </td>
              {kind === 'batting' ? (
                <>
                  <td className={miniStatCell}>{cleanNumber(player.stat.atBats, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.runs, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.hits, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.homeRuns, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.rbi, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.baseOnBalls, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.strikeOuts, 0)}</td>
                  <td className={`${miniStatCell} text-emerald-300`}>{cleanNumber(player.season.ops)}</td>
                </>
              ) : (
                <>
                  <td className={miniStatCell}>{cleanNumber(player.stat.inningsPitched, '0.0')}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.hits, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.earnedRuns, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.baseOnBalls, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.strikeOuts, 0)}</td>
                  <td className={`${miniStatCell} text-orange-300`}>{cleanNumber(player.season.era)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.season.whip)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PROSPECT_RATE_MIN_PA = 30;
const PROSPECT_RATE_SORT_KEYS = new Set(['avg', 'obp', 'slg', 'ops']);

function hitterPlateAppearances(stat = {}) {
  const explicitPa = Number(stat.plateAppearances);
  if (Number.isFinite(explicitPa) && explicitPa > 0) return explicitPa;

  return (
    (Number(stat.atBats) || 0) +
    (Number(stat.baseOnBalls) || 0) +
    (Number(stat.hitByPitch) || 0) +
    (Number(stat.sacFlies) || 0) +
    (Number(stat.sacBunts) || 0)
  );
}

function isQualifiedProspectRate(player) {
  if (player.kind !== 'batting') return false;
  return hitterPlateAppearances(player.stat) >= PROSPECT_RATE_MIN_PA;
}

function prospectSortValue(player, key) {
  const stat = player.stat ?? {};
  const affiliateLevel = player.affiliate?.sport?.id ?? player.affiliate?.sportId ?? 99;

  switch (key) {
    case 'name':
      return player.name ?? '';
    case 'position':
      return player.position ?? '';
    case 'level':
      return LEVEL_ORDER[affiliateLevel] ?? 99;
    case 'score':
      return player.score == null ? -999 : Number(player.score) || 0;
    case 'pa':
      return hitterPlateAppearances(stat);
    case 'avg':
      return Number(stat.avg) || -1;
    case 'obp':
      return Number(stat.obp) || -1;
    case 'slg':
      return Number(stat.slg) || -1;
    case 'ops':
      return Number(stat.ops) || -1;
    case 'hr':
      return Number(stat.homeRuns) || 0;
    case 'rbi':
      return Number(stat.rbi) || 0;
    case 'sb':
      return Number(stat.stolenBases) || 0;
    case 'bb':
      return Number(stat.baseOnBalls) || 0;
    case 'era':
      return Number(stat.era) || 99;
    case 'whip':
      return Number(stat.whip) || 99;
    case 'k':
      return Number(stat.strikeOuts) || 0;
    case 'ip':
      return parseInnings(stat.inningsPitched);
    default:
      return '';
  }
}

function ProspectOrgTable({
  players,
  modeLabel,
  sort,
  onSort,
  onSelectPlayer,
  isWatched,
  onToggleWatch,
}) {
  const [activeKind, setActiveKind] = useState('batting');
  const hitters = players.filter((player) => player.kind === 'batting');
  const pitchers = players.filter((player) => player.kind === 'pitching');
  const activePlayers = activeKind === 'batting' ? hitters : pitchers;
  const columns = activeKind === 'batting'
    ? [
        { key: 'name', label: 'Player', className: 'text-left min-w-52' },
        { key: 'position', label: 'POS' },
        { key: 'level', label: 'Lvl' },
        { key: 'score', label: 'Score' },
        { key: 'pa', label: 'PA' },
        { key: 'avg', label: 'AVG' },
        { key: 'obp', label: 'OBP' },
        { key: 'slg', label: 'SLG' },
        { key: 'ops', label: 'OPS' },
        { key: 'hr', label: 'HR' },
        { key: 'rbi', label: 'RBI' },
        { key: 'sb', label: 'SB' },
        { key: 'bb', label: 'BB' },
        { key: 'k', label: 'K' },
      ]
    : [
        { key: 'name', label: 'Player', className: 'text-left min-w-52' },
        { key: 'position', label: 'POS' },
        { key: 'level', label: 'Lvl' },
        { key: 'score', label: 'Score' },
        { key: 'ip', label: 'IP' },
        { key: 'era', label: 'ERA' },
        { key: 'whip', label: 'WHIP' },
        { key: 'k', label: 'K' },
        { key: 'bb', label: 'BB' },
        { key: 'hr', label: 'HR' },
      ];
  const columnKeys = new Set(columns.map((col) => col.key));
  const effectiveSort = columnKeys.has(sort.key) ? sort : { key: 'score', direction: 'desc' };

  const sortedPlayers = useMemo(() => {
    const direction = effectiveSort.direction === 'asc' ? 1 : -1;
    const isRateSort = PROSPECT_RATE_SORT_KEYS.has(effectiveSort.key);
    return [...activePlayers].sort((a, b) => {
      if (isRateSort) {
        const aq = isQualifiedProspectRate(a);
        const bq = isQualifiedProspectRate(b);
        if (aq !== bq) return aq ? -1 : 1;
      }

      const av = prospectSortValue(a, effectiveSort.key);
      const bv = prospectSortValue(b, effectiveSort.key);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * direction;
      }
      if (av === bv) return (Number(b.score) || 0) - (Number(a.score) || 0);
      return (av - bv) * direction;
    });
  }, [activePlayers, effectiveSort]);

  const sortLabel = columns.find((col) => col.key === effectiveSort.key)?.label ?? 'Score';
  const toggleSort = (key) => {
    const lowIsBest = new Set(['era', 'whip']);
    onSort((current) => ({
      key,
      direction: current.key === key
        ? current.direction === 'desc' ? 'asc' : 'desc'
        : lowIsBest.has(key) ? 'asc' : 'desc',
    }));
  };

  const battingValue = (player, key) => (
    player.kind === 'batting' ? cleanNumber(player.stat?.[key], key === 'avg' || key === 'ops' ? '—' : 0) : '—'
  );
  const pitchingValue = (player, key, fallback = '—') => (
    player.kind === 'pitching' ? cleanNumber(player.stat?.[key], fallback) : '—'
  );
  const activeLabel = activeKind === 'batting' ? 'hitters' : 'pitchers';

  return (
    <section className="mt-5 overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-slate-900/85 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
            <Table2 size={14} />
            Org Prospect Table
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {activePlayers.length} {activeLabel} · {modeLabel} lens · sorted by {sortLabel}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
            {[
              { key: 'batting', label: `Hitters ${hitters.length}` },
              { key: 'pitching', label: `Pitchers ${pitchers.length}` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveKind(tab.key)}
                className={[
                  'rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors',
                  activeKind === tab.key
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-slate-500 hover:text-slate-200',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            Tap a header to sort. Tap a player for notes/profile preview.
            {activeKind === 'batting' && PROSPECT_RATE_SORT_KEYS.has(effectiveSort.key) ? (
              <span className="ml-1 text-emerald-300/80">
                Rate sorts use {PROSPECT_RATE_MIN_PA}+ PA first.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto app-scrollbar">
        <table className="min-w-[780px] w-full text-xs">
          <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 shadow-[0_1px_0_rgba(30,41,59,1)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'px-3 py-2 text-right font-black uppercase tracking-wider',
                    col.className ?? '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={[
                      'inline-flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-800 hover:text-white',
                      effectiveSort.key === col.key ? 'text-emerald-300' : '',
                      col.key === 'name' ? 'justify-start' : 'justify-end',
                    ].join(' ')}
                  >
                    {col.label}
                    {effectiveSort.key === col.key && (
                      <span className="text-[9px]">{effectiveSort.direction === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.length ? sortedPlayers.map((player) => {
              const level = playerAffiliationLabel(player);
              return (
                <tr
                  key={`${player.mode}-${player.kind}-${player.id}`}
                  className="border-b border-slate-900/90 odd:bg-slate-950/35 even:bg-slate-900/35 hover:bg-emerald-500/10"
                >
                  <td className="px-3 py-2 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={prospectHeadshotUrl(player.id)}
                        alt=""
                        className="h-8 w-8 rounded-xl bg-slate-800 object-cover"
                        onError={(e) => attachHeadshotFallback(e, player.id)}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectPlayer?.(player)}
                        className="min-w-0 text-left"
                      >
                        <div className="truncate font-black text-slate-100 hover:text-emerald-300">
                          {player.name}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">
                          {player.affiliate?.name}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleWatch?.(player)}
                        className={`ml-auto rounded-full p-1 ${isWatched?.(player.id) ? 'text-yellow-300' : 'text-slate-600 hover:text-yellow-300'}`}
                        aria-label={isWatched?.(player.id) ? 'Remove from prospect watchlist' : 'Add to prospect watchlist'}
                      >
                        <Star size={13} fill={isWatched?.(player.id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-300">{player.position || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-300">{level ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-black text-white">
                    {player.score == null ? '—' : cleanNumber((Number(player.score) || 0).toFixed(1))}
                  </td>
                  {activeKind === 'batting' ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{cleanNumber(hitterPlateAppearances(player.stat), 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'avg')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'obp')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'slg')}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-300">{battingValue(player, 'ops')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'homeRuns')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'rbi')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'stolenBases')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'baseOnBalls')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{battingValue(player, 'strikeOuts')}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{pitchingValue(player, 'inningsPitched')}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-orange-300">{pitchingValue(player, 'era')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{pitchingValue(player, 'whip')}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{pitchingValue(player, 'strikeOuts', 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{pitchingValue(player, 'baseOnBalls', 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{pitchingValue(player, 'homeRuns', 0)}</td>
                    </>
                  )}
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                  No active roster or stat data loaded for this org yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AffiliateCard({ affiliate, onSelectPlayer, isWatched, onToggleWatch }) {
  const game = affiliate.game;
  const side = affiliate.side;
  const opponentSide = side === 'home' ? 'away' : 'home';
  const topHitter = [...affiliate.hitters].sort((a, b) => b.score - a.score)[0];
  const topPitcher = [...affiliate.pitchers].sort((a, b) => b.score - a.score)[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent pointer-events-none" />
      {!game && (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5  px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="relative inline-flex">
            <Gamepad2 size={18} />
            <Ban size={32} className="absolute text-red-400" style={{ top: '-7px', left: '-7px' }} />
          </span>
        </div>
      )}
      <div className="relative p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/team/${affiliate.id}`}
            className="group flex-shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label={`Open ${affiliate.name} team page`}
          >
            <AffiliateLogo
              team={affiliate}
              className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-200 group-hover:scale-105"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                {LEVEL_SHORT[affiliate.sport?.id] ?? affiliate.sport?.name}
              </span>
              <span className="text-[11px] text-slate-500">{affiliate.league?.name}</span>
            </div>
            <Link
              to={`/team/${affiliate.id}`}
              className="mt-1 inline-block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <h2 className="text-lg sm:text-xl font-display tracking-tight text-white transition-colors hover:text-emerald-200">
              {affiliate.name}
              </h2>
            </Link>
            <p className="text-sm text-slate-400">{affiliate.venue?.name ?? affiliate.locationName}</p>
          </div>
        </div>

        {game ? (
          <>
            <div className="mt-4 border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">{gameStatusLabel(game)}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                    <span className="font-semibold text-white">{affiliate.name}</span>
                    <span className="text-emerald-300 font-black tabular-nums">{scoreForSide(game, side)}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="truncate">{game.teams?.[opponentSide]?.team?.name}</span>
                    <span className="text-slate-300 font-black tabular-nums">{scoreForSide(game, opponentSide)}</span>
                  </div>
                </div>
                <Link
                  to={`/game/${game.gamePk}`}
                  className="rounded-xl border border-slate-700 bg-slate-950/45 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                >
                  Gameday
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <PerformerCard
                title="Top Hitter"
                player={topHitter}
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
              <PerformerCard
                title="Top Pitcher"
                player={topPitcher}
                tone="orange"
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <BoxScoreTable
                rows={affiliate.hitters}
                kind="batting"
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
              <BoxScoreTable
                rows={affiliate.pitchers}
                kind="pitching"
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function statLabel(player) {
  if (!player) return '';
  if (player.kind === 'batting') {
    return `Season ${cleanNumber(player.season.avg)} / ${cleanNumber(player.season.obp)} / ${cleanNumber(player.season.slg)} · OPS ${cleanNumber(player.season.ops)}`;
  }
  return `Season ERA ${cleanNumber(player.season.era)} · WHIP ${cleanNumber(player.season.whip)} · K/9 ${cleanNumber(player.season.strikeoutsPer9Inn)}`;
}

function recentLabel(player) {
  if (!player) return '';
  return player.summary || statLabel(player);
}

function prospectPreviewLevel(player) {
  const sportId = player?.affiliate?.sport?.id ?? player?.affiliate?.sportId;
  return LEVEL_SHORT[sportId] ?? playerAffiliationLabel(player) ?? 'MiLB';
}

function prospectPreviewSubtitle(player) {
  return [
    player?.position,
    player?.affiliate?.name,
    shortCountryLabel(player?.birthCountry),
  ].filter(Boolean).join(', ');
}

function prospectRankContext(player) {
  const org = parentOrgForPlayer(player);
  if (player?.rankingType === 'top100' || (!player?.rank && player?.overallRank)) {
    return 'MLB Top 100';
  }
  if (player?.rank) {
    return org ? `${orgNickname(org)} Top 30` : 'Team Top 30';
  }
  if (org?.abbr) return `${org.abbr} Org`;
  return player?.affiliate?.name ?? null;
}

function prospectDisplayRank(player) {
  if (player?.rankingType === 'top100') return player.overallRank ?? player.rank;
  return player?.rank ?? player?.overallRank ?? null;
}

function prospectStatTiles(player) {
  const stat = player?.season ?? player?.stat ?? {};
  if (player?.kind === 'pitching') {
    return [
      { label: 'IP', value: cleanNumber(stat.inningsPitched) },
      { label: 'ERA', value: cleanNumber(stat.era) },
      { label: 'WHIP', value: cleanNumber(stat.whip) },
      { label: 'K', value: cleanNumber(stat.strikeOuts, 0) },
      { label: 'BB', value: cleanNumber(stat.baseOnBalls, 0) },
      { label: 'K/9', value: cleanNumber(stat.strikeoutsPer9Inn) },
    ];
  }

  return [
    { label: 'PA', value: cleanNumber(hitterPlateAppearances(stat), 0) },
    { label: 'AVG', value: formatSlashRate(stat.avg) },
    { label: 'OBP', value: formatSlashRate(stat.obp) },
    { label: 'SLG', value: formatSlashRate(stat.slg) },
    { label: 'OPS', value: formatSlashRate(stat.ops) },
    { label: 'HR', value: cleanNumber(stat.homeRuns, 0) },
  ];
}

function ProspectBioPanel({ player }) {
  const profileBio = currentProspectBio(player.prospectBio);
  const bioRows = [
    { label: 'AGE', value: player.age ?? '—' },
    { label: 'BATS', value: player.bats ?? '—' },
    { label: 'DOB', value: formatMonthDayYear(player.birthDate) },
    { label: 'THROWS', value: player.throws ?? '—' },
    { label: 'HT', value: player.height ?? '—' },
    { label: 'SIGNED', value: formatSigningLabel(player) },
    { label: 'WT', value: formatWeight(player.weight) },
    { label: 'ETA', value: player.eta ?? '—' },
  ];
  const rankNumber = prospectDisplayRank(player);
  const snapshot = [
    rankNumber ? `#${rankNumber} ${prospectRankContext(player)}` : null,
    player.eta ? `ETA ${player.eta}` : null,
    player.affiliate?.name ?? prospectPreviewLevel(player),
  ].filter(Boolean).join(' | ');

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {bioRows.map((row) => (
          <div key={row.label} className="min-w-0">
            <div className="text-[10px] font-semibold uppercase text-zinc-500">{row.label}</div>
            <div className="mt-0.5 text-base font-semibold leading-snug text-zinc-100 [overflow-wrap:anywhere] sm:text-lg">
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {profileBio.grades.length || profileBio.story.length ? (
        <div className="mt-6 space-y-4 text-[15px] leading-7 text-zinc-100 [overflow-wrap:anywhere]">
          {profileBio.grades.map((grade, index) => (
            <p key={`grade-${index}`}>
              <span className="font-black">Scouting grades:</span> {grade}
            </p>
          ))}
          {profileBio.story.map((paragraph, index) => (
            <p key={`story-${index}`}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-2 border-t border-zinc-700 pt-4 text-sm leading-6 text-zinc-300">
        <p>
          <span className="font-black text-zinc-100">Pipeline snapshot:</span>{' '}
          {snapshot || recentLabel(player) || 'Profile data unavailable.'}
        </p>
        <p>
          <span className="font-black text-zinc-100">Season line:</span>{' '}
          {seasonStatSnippet(player) || statLabel(player)}
        </p>
      </div>
    </div>
  );
}

function ProspectStatsPanel({ player }) {
  const tiles = prospectStatTiles(player);
  const latestLine = player.summary || '—';
  const seasonLine = seasonStatSnippet(player) || statLabel(player);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-[#171717] p-3">
          <div className="text-[11px] font-semibold uppercase text-zinc-500">Latest Line</div>
          <div className="mt-1 text-base font-bold text-white">{latestLine}</div>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-[#171717] p-3">
          <div className="text-[11px] font-semibold uppercase text-zinc-500">Season</div>
          <div className="mt-1 text-base font-bold text-white">{seasonLine}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-zinc-700 bg-[#171717] px-3 py-3 text-center">
            <div className="text-[11px] font-semibold text-zinc-500">{tile.label}</div>
            <div className="mt-1 text-lg font-black tabular-nums text-white">{tile.value}</div>
          </div>
        ))}
      </div>

      {player.tags?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {player.tags.map((tag) => <TagPill key={`${player.id}-${tag}`} tag={tag} />)}
        </div>
      ) : null}
    </div>
  );
}

function ProspectNotesPanel({ note, onNoteChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-zinc-500">
        <StickyNote size={13} />
        Notes
      </div>
      <textarea
        value={note}
        onChange={(event) => onNoteChange?.(event.target.value)}
        placeholder="Add your own note about this prospect..."
        className="mt-3 w-full min-h-44 rounded-lg border border-zinc-700 bg-[#171717] px-3 py-3 text-base text-zinc-100 outline-none resize-y focus:border-sky-500/70"
      />
    </div>
  );
}

function ProspectLinksPanel({ player }) {
  return (
    <div className="grid gap-3">
      <Link
        to={`/player/${player.id}`}
        className="inline-flex items-center justify-center rounded-lg border border-sky-500/55 bg-sky-500 px-4 py-3 text-sm font-black text-white hover:bg-sky-400"
      >
        View Full Player Page
      </Link>
      <a
        href={officialPipelinePlayerUrl(player)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-[#171717] px-4 py-3 text-sm font-black text-zinc-100 hover:border-sky-500/70 hover:text-sky-300"
      >
        Open MLB Pipeline
        <ExternalLink size={15} />
      </a>
    </div>
  );
}

function ProspectPreviewModal({ player, open, onClose, isWatched, onToggleWatch, note, onNoteChange }) {
  const [activeTab, setActiveTab] = useState('bio');

  if (!player) return null;
  const watched = isWatched(player.id);
  const heroImage = prospectHeroImageUrl(player);
  const parentOrg = parentOrgForPlayer(player);
  const rankNumber = prospectDisplayRank(player);
  const subtitle = prospectPreviewSubtitle(player) || recentLabel(player);
  const rankContext = prospectRankContext(player);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      align="bottom"
      panelClassName="bg-[#202020] border-zinc-700 max-h-[92vh] overflow-y-auto sm:max-h-[88vh]"
    >
      <div className="bg-[#202020] text-white">
        <section className="relative h-[340px] overflow-hidden bg-zinc-900 sm:h-[390px]">
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => attachProspectHeroFallback(event, player)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/90" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#202020] to-transparent" />

          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-black/40 transition-colors hover:bg-black/25"
            aria-label="Close"
          >
            <X size={27} strokeWidth={2.5} />
          </button>

          {rankNumber ? (
            <div className="absolute right-5 top-4 z-10 text-6xl font-black leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
              {rankNumber}
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 px-5 pb-6 sm:px-6">
            <div className="min-w-0 max-w-[72%]">
              <div className="mb-2 inline-flex rounded-full bg-black/45 px-3 py-1 text-[11px] font-black uppercase text-white backdrop-blur-sm">
                {prospectPreviewLevel(player)}
              </div>
              <h2 className="text-4xl font-black leading-none text-white [overflow-wrap:anywhere] sm:text-5xl">
                {player.name}
              </h2>
              <p className="mt-3 text-lg font-black leading-tight text-white [overflow-wrap:anywhere]">
                {subtitle}
              </p>
            </div>

            <div className="flex w-24 flex-shrink-0 flex-col items-center text-center">
              {parentOrg?.id ? (
                <img
                  src={teamLogoUrl(parentOrg.id)}
                  alt=""
                  className="h-16 w-16 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
                />
              ) : null}
              {rankContext ? (
                <div className="mt-1 text-sm font-black leading-tight text-sky-400">
                  {rankContext}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <nav className="grid grid-cols-4 border-b border-zinc-700" role="tablist" aria-label="Prospect preview sections">
          {PROSPECT_PREVIEW_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'border-r border-sky-500/60 px-2 py-4 text-center text-sm font-medium transition-colors last:border-r-0',
                  active
                    ? 'bg-sky-500 text-white'
                    : 'bg-[#202020] text-sky-400 hover:bg-[#252525] hover:text-sky-300',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 pb-24 pt-5 sm:px-6">
          {activeTab === 'bio' && <ProspectBioPanel player={player} />}
          {activeTab === 'stats' && <ProspectStatsPanel player={player} />}
          {activeTab === 'notes' && <ProspectNotesPanel note={note} onNoteChange={onNoteChange} />}
          {activeTab === 'links' && <ProspectLinksPanel player={player} />}
        </div>

        <div className="sticky bottom-0 grid gap-2 border-t border-zinc-700 bg-[#202020]/95 p-3 backdrop-blur sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onToggleWatch(player)}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-black transition-colors',
              watched
                ? 'border-yellow-400/60 bg-yellow-400/20 text-yellow-200 hover:bg-yellow-400/25'
                : 'border-zinc-600 bg-[#171717] text-zinc-100 hover:border-yellow-400/60 hover:text-yellow-200',
            ].join(' ')}
          >
            <Star size={16} fill={watched ? 'currentColor' : 'none'} />
            {watched ? 'Watching' : 'Add to Watchlist'}
          </button>
          <Link
            to={`/player/${player.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-sky-500/55 bg-sky-500/15 px-4 py-3 text-sm font-black text-sky-300 hover:bg-sky-500/20"
          >
            View Full Player Page
          </Link>
        </div>
      </div>
    </Modal>
  );
}

function FavoritesPage({ players, notes, onSelectPlayer, onToggleWatch }) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300">
            <Star size={13} fill="currentColor" />
            My Prospects
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {players.length
              ? `${players.length} starred · tap a row for notes & profile`
              : 'Star prospects anywhere to save them here'}
          </p>
        </div>
      </div>

      {players.length ? (
        <div className="divide-y divide-slate-800/90 border-y border-slate-800">
          {players.map((player) => {
            const note = notes?.[player.id];
            const level = playerAffiliationLabel(player);
            const seasonLine = seasonStatSnippet(player);
            const line = seasonLine || player.summary || player.affiliate?.name || '—';

            return (
              <div
                key={`favorite-${player.id}`}
                className="flex items-stretch gap-2 hover:bg-slate-900/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectPlayer?.(player)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-1 py-3 text-left sm:px-2"
                >
                  <img
                    src={prospectHeadshotUrl(player.id)}
                    alt=""
                    className="h-11 w-11 flex-shrink-0 rounded-lg bg-slate-800 object-cover"
                    onError={(e) => attachHeadshotFallback(e, player.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-bold text-white hover:text-yellow-200">
                        {player.name}
                      </span>
                      {level ? (
                        <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-400/90">
                          {level}
                        </span>
                      ) : null}
                      {player.position && player.position !== '—' ? (
                        <span className="flex-shrink-0 text-[10px] font-semibold text-slate-500">
                          {player.position}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">
                      {line}
                    </div>
                    {note ? (
                      <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                        <StickyNote size={11} className="flex-shrink-0 text-yellow-400/70" />
                        <span className="truncate">{note}</span>
                      </div>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleWatch?.(player)}
                  className="flex flex-shrink-0 items-center px-3 text-yellow-300 hover:bg-yellow-400/5"
                  aria-label="Remove from prospect watchlist"
                >
                  <Star size={16} fill="currentColor" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-y border-dashed border-slate-800 py-12 text-center text-sm text-slate-500">
          No favorites yet. Use the star on any prospect to save them here.
        </div>
      )}
    </section>
  );
}

function RankingsPage({
  org,
  rankings,
  isLoading,
  error,
  onSelectPlayer,
  isWatched,
  onToggleWatch,
}) {
  const isAllMlb = isAllMlbOrg(org?.id);
  const pipelineUrl = officialPipelineUrl(org?.id);
  const title = isAllMlb ? 'MLB Top 100' : `${org?.name ?? 'Org'} Top 30`;
  const subtitle = isAllMlb
    ? `Official Pipeline Top 100 for ${CURRENT_SEASON} — rank, ETA, level, and tools snapshot.`
    : `Official Pipeline order for ${CURRENT_SEASON} — rank, ETA, level, and tools snapshot.`;

  return (
    <section className="mt-5 overflow-hidden rounded-[2rem] border border-sky-500/20 bg-slate-900/85 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
            <ListOrdered size={14} />
            MLB Pipeline Rankings
          </div>
          <h2 className="mt-1 font-display text-xl text-white sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {subtitle}
          </p>
        </div>
        <a
          href={pipelineUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-300 hover:bg-sky-500/15"
        >
          Open on MLB.com
          <ExternalLink size={14} />
        </a>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <BaseballSpinner size="xl" label="Loading Pipeline rankings…" />
        </div>
      ) : error ? (
        <div className="px-4 py-12 text-center text-sm text-rose-300 sm:px-6">
          {error}
        </div>
      ) : (
        <div className="max-h-[75vh] overflow-auto app-scrollbar">
          <table className="min-w-[860px] w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 shadow-[0_1px_0_rgba(30,41,59,1)]">
              <tr>
                <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider">Rk</th>
                <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider min-w-52">Player</th>
                <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider">Pos</th>
                <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider">Level</th>
                <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider">ETA</th>
                <th className="px-3 py-2.5 text-right font-black uppercase tracking-wider">Age</th>
                <th className="px-3 py-2.5 text-right font-black uppercase tracking-wider">Ht / Wt</th>
                <th className="px-3 py-2.5 text-right font-black uppercase tracking-wider">B</th>
                <th className="px-3 py-2.5 text-right font-black uppercase tracking-wider">T</th>
                {!isAllMlb ? (
                  <th className="px-3 py-2.5 text-right font-black uppercase tracking-wider">MLB</th>
                ) : (
                  <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider">Org</th>
                )}
                <th className="px-3 py-2.5 text-right font-black uppercase tracking-wider" aria-label="Watch" />
              </tr>
            </thead>
            <tbody>
              {rankings.length ? rankings.map((player) => {
                const level = playerAffiliationLabel(player);
                const parentOrgId = player.affiliate?.parentOrgId;
                const parentOrg = parentOrgId
                  ? mlbTeams.find((team) => team.id === Number(parentOrgId))
                  : null;
                return (
                  <tr
                    key={`rank-${player.rank}-${player.id}`}
                    className="border-b border-slate-900/90 odd:bg-slate-950/35 even:bg-slate-900/35 hover:bg-sky-500/10"
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sm font-black text-sky-300">
                        {player.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectPlayer?.(player)}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                      >
                        <img
                          src={player.photoUrl || prospectHeadshotUrl(player.id)}
                          alt=""
                          className="h-10 w-10 rounded-xl bg-slate-800 object-cover"
                          onError={(e) => attachHeadshotFallback(e, player.id)}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-100 hover:text-sky-300">
                            {player.name}
                          </div>
                          <div className="truncate text-[10px] text-slate-500">
                            {player.affiliate?.name ?? '—'}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-300">{player.position || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-0.5 font-bold text-emerald-300">
                        {level ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-black text-white">{player.eta || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{player.age ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                      {player.height || '—'}
                      {player.weight ? ` / ${player.weight}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-300">{player.bats || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-300">{player.throws || '—'}</td>
                    {!isAllMlb ? (
                      <td className="px-3 py-2.5 text-right">
                        {player.overallRank ? (
                          <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-300">
                            #{player.overallRank}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    ) : (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {parentOrg ? (
                            <img
                              src={teamLogoUrl(parentOrg.id)}
                              alt=""
                              className="h-5 w-5 object-contain"
                            />
                          ) : null}
                          <span className="font-bold text-slate-300">
                            {parentOrg?.abbr ?? '—'}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleWatch?.(player)}
                        className={`rounded-full p-1.5 ${isWatched?.(player.id) ? 'text-yellow-300' : 'text-slate-600 hover:text-yellow-300'}`}
                        aria-label={isWatched?.(player.id) ? 'Remove from prospect watchlist' : 'Add to prospect watchlist'}
                      >
                        <Star size={14} fill={isWatched?.(player.id) ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                    No Pipeline rankings available for this organization.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ProspectWatch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orgId, setOrgId] = useState(initialOrgId);
  const [date, setDate] = useState(todayIso);
  const [levelFilter, setLevelFilter] = useState('all');
  const [pageTab, setPageTab] = useState('overview');
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [prospectTableSort, setProspectTableSort] = useState({ key: 'score', direction: 'desc' });
  const [watchlist, setWatchlist] = useState(loadProspectWatchlist);
  const [notes, setNotes] = useState(loadProspectNotes);
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState(null);
  const allMlbSelected = isAllMlbOrg(orgId);
  const selectedOrg = allMlbSelected
    ? { id: ALL_MLB_ORG, name: 'All MLB', abbr: 'MLB' }
    : (
      mlbTeams.find((team) => team.id === Number(orgId)) ??
      mlbTeams.find((team) => team.id === DEFAULT_ORG_ID)
    );
  const selectedOrgLogo = allMlbSelected
    ? MLB_LEAGUE_LOGO
    : teamLogoUrl(selectedOrg?.id);
  const previewPlayerId = useMemo(() => {
    const id = Number(new URLSearchParams(location.search).get(PROSPECT_PREVIEW_SEARCH_PARAM));
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [location.search]);

  useEffect(() => {
    localStorage.setItem(PROSPECT_WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem(PROSPECT_NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    let cancelled = false;

    async function loadRankings() {
      setRankingsLoading(true);
      setRankingsError(null);
      setRankings([]);
      try {
        const rows = await loadOfficialOrgRankings(orgId);
        if (!cancelled) setRankings(rows);
      } catch (err) {
        if (!cancelled) {
          setRankings([]);
          setRankingsError(err?.message || 'Could not load Pipeline rankings.');
        }
      } finally {
        if (!cancelled) setRankingsLoading(false);
      }
    }

    loadRankings();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProspects() {
      setIsLoading(true);
      setCards([]);

      if (isAllMlbOrg(orgId)) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const affiliateRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${orgId}/affiliates`);
        const affiliateData = await affiliateRes.json();
        const activeAffiliates = sortAffiliates(affiliateData.teams ?? []);

        const loadedCards = await Promise.all(
          activeAffiliates.map(async (affiliate) => {
            const emptyForm = { season: { hitters: [], pitchers: [] } };
            try {
              const [
                scheduleRes,
                activeRosterIds,
                seasonHitters,
                seasonPitchers,
              ] = await Promise.all([
                fetch(
                  `https://statsapi.mlb.com/api/v1/schedule?teamId=${affiliate.id}&sportId=${affiliate.sport.id}&date=${date}&hydrate=team,linescore`,
                ),
                fetchAffiliateActiveRoster(affiliate),
                fetchSeasonStatGroup(affiliate, 'hitting'),
                fetchSeasonStatGroup(affiliate, 'pitching'),
              ]);

              const scheduleData = await scheduleRes.json();
              const game = scheduleData.dates?.[0]?.games?.[0] ?? null;
              let side = null;
              let hitters = [];
              let pitchers = [];

              if (game) {
                side = game.teams?.home?.team?.id === affiliate.id ? 'home' : 'away';
                const boxscoreRes = await fetch(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);
                const boxscore = await boxscoreRes.json();
                const todayPlayers = extractTeamPlayers(boxscore, side, affiliate);
                // Today's table should mirror the official game box score,
                // including rehab/temporary players who may not be active-roster.
                hitters = todayPlayers.hitters;
                pitchers = todayPlayers.pitchers;
              }

              return {
                ...affiliate,
                game,
                side,
                rosterPlayers: activeRosterIds.players,
                hitters,
                pitchers,
                forms: {
                  season: {
                    hitters: seasonHitters
                      .filter((split) => activeRosterIds.ids.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'batting', affiliate, 'season')),
                    pitchers: seasonPitchers
                      .filter((split) => activeRosterIds.ids.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'pitching', affiliate, 'season')),
                  },
                },
              };
            } catch {
              return {
                ...affiliate,
                game: null,
                side: null,
                rosterPlayers: [],
                hitters: [],
                pitchers: [],
                forms: emptyForm,
              };
            }
          }),
        );

        if (!cancelled) setCards(loadedCards);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProspects();
    return () => {
      cancelled = true;
    };
  }, [orgId, date]);

  const visibleCards = useMemo(
    () => cards.filter((card) => levelFilter === 'all' || String(card.sport?.id) === levelFilter),
    [cards, levelFilter],
  );

  const playerDirectory = useMemo(() => {
    const map = new Map();
    const register = (player) => {
      if (!player?.id) return;
      const id = Number(player.id);
      map.set(id, mergeProspectPlayer(map.get(id), player));
    };

    cards.forEach((card) => {
      card.hitters.forEach(register);
      card.pitchers.forEach(register);
      (card.rosterPlayers ?? []).forEach(register);
      Object.values(card.forms ?? {}).forEach((bucket) => {
        bucket.hitters.forEach(register);
        bucket.pitchers.forEach(register);
      });
    });
    rankings.forEach(register);

    return map;
  }, [cards, rankings]);

  const selectProspectPlayer = (player) => {
    const id = Number(player?.id);
    if (!id) return;
    setSelectedPlayer(mergeProspectPlayer(player, playerDirectory.get(id)));

    const params = new URLSearchParams(location.search);
    params.set(PROSPECT_PREVIEW_SEARCH_PARAM, String(id));
    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate(
        { pathname: location.pathname, search: `?${nextSearch}` },
        { state: { prospectPreview: true } },
      );
    }
  };

  const closeProspectPreview = () => {
    const params = new URLSearchParams(location.search);
    if (params.has(PROSPECT_PREVIEW_SEARCH_PARAM)) {
      if (location.state?.prospectPreview) {
        navigate(-1);
        return;
      }

      params.delete(PROSPECT_PREVIEW_SEARCH_PARAM);
      const nextSearch = params.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
        { replace: true },
      );
      return;
    }

    setSelectedPlayer(null);
  };
  const previewPlayer = useMemo(() => {
    if (!previewPlayerId) return null;
    const clickedPlayer = Number(selectedPlayer?.id) === previewPlayerId ? selectedPlayer : null;
    const directoryPlayer = playerDirectory.get(previewPlayerId);
    return mergeProspectPlayer(
      clickedPlayer ?? directoryPlayer,
      directoryPlayer,
    );
  }, [playerDirectory, previewPlayerId, selectedPlayer]);

  /** Always today's box-score standouts (not tied to form-mode filter). */
  const todayTopPerformances = useMemo(() => {
    const rows = [];
    visibleCards.forEach((card) => {
      (card.hitters ?? []).forEach((player) => rows.push(player));
      (card.pitchers ?? []).forEach((player) => rows.push(player));
    });
    return [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 6);
  }, [visibleCards]);

  /**
   * Season-based names to get excited about for future MLB impact —
   * rates + tools, mild boost for lower levels, min sample required.
   */
  const prospectRadar = useMemo(() => {
    const rows = [];
    const seen = new Set();
    visibleCards.forEach((card) => {
      const add = (player) => {
        if (!player?.id) return;
        const key = `${player.kind}-${Number(player.id)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const excitement = prospectExcitementScore(player);
        if (excitement <= 0) return;
        rows.push({ ...player, excitement });
      };
      (card.forms?.season?.hitters ?? []).forEach(add);
      (card.forms?.season?.pitchers ?? []).forEach(add);
    });
    return rows.sort((a, b) => b.excitement - a.excitement).slice(0, 6);
  }, [visibleCards]);

  const prospectTablePlayers = useMemo(() => {
    const rows = [];
    const seen = new Map();
    const add = (player) => {
      if (!player?.id) return;
      const key = `${player.kind}-${Number(player.id)}`;
      const existingIndex = seen.get(key);
      if (existingIndex != null) {
        const existing = rows[existingIndex];
        if ((!existing.position || existing.position === '—') && player.position && player.position !== '—') {
          rows[existingIndex] = { ...existing, position: player.position };
        }
        return;
      }
      seen.set(key, rows.length);
      rows.push(player);
    };

    visibleCards.forEach((card) => {
      (card.forms?.season?.hitters ?? []).forEach(add);
      (card.forms?.season?.pitchers ?? []).forEach(add);
    });
    visibleCards.forEach((card) => {
      (card.rosterPlayers ?? []).forEach(add);
    });

    return rows;
  }, [visibleCards]);

  const watchlistPlayers = useMemo(
    () =>
      watchlist
        .map((player) => playerDirectory.get(Number(player.id)) ?? player)
        .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0)),
    [playerDirectory, watchlist],
  );

  const watchedIds = useMemo(() => new Set(watchlist.map((player) => Number(player.id))), [watchlist]);
  const isWatched = (playerId) => watchedIds.has(Number(playerId));

  const toggleWatch = (player) => {
    setWatchlist((current) => {
      const id = Number(player.id);
      if (current.some((entry) => Number(entry.id) === id)) {
        return current.filter((entry) => Number(entry.id) !== id);
      }
      return [watchedEntryFromPlayer(player), ...current].slice(0, 80);
    });
  };

  const selectedNote = previewPlayer ? notes[previewPlayer.id] ?? '' : '';

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-3 sm:px-4">
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={selectedOrgLogo}
                alt=""
                className="h-11 w-11 flex-shrink-0 object-contain"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                  <Search size={12} />
                  Prospect Watch
                </div>
                <h1 className="truncate font-display text-xl tracking-tight text-white sm:text-2xl">
                  {allMlbSelected ? 'All MLB Prospects' : `${selectedOrg?.name} Pipeline`}
                </h1>
              </div>
            </div>
            <div className="sm:w-72">
              <Select
                value={orgId}
                onChange={setOrgId}
                options={TEAM_OPTIONS}
                buttonClassName="border-slate-700 bg-slate-950/70 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <nav
          className="mt-4 flex gap-0 overflow-x-auto border-b border-slate-800 app-scrollbar"
          aria-label="Prospect Watch sections"
          role="tablist"
        >
          {PAGE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pageTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setPageTab(tab.id)}
                className={[
                  'relative inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold tracking-wide transition-colors whitespace-nowrap sm:px-5',
                  isActive
                    ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-400'
                    : 'text-slate-500 hover:text-slate-200',
                ].join(' ')}
              >
                {Icon ? (
                  <Icon
                    size={14}
                    className={isActive ? 'opacity-90' : 'opacity-70'}
                    fill={tab.id === 'favorites' && isActive ? 'currentColor' : 'none'}
                  />
                ) : null}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {pageTab === 'overview' && (
          <>
            {allMlbSelected ? (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center">
                <img src={MLB_LEAGUE_LOGO} alt="" className="mx-auto mb-3 h-12 w-12 object-contain" />
                <p className="text-sm font-semibold text-slate-200">
                  All MLB is best on the Rankings tab (Pipeline Top 100).
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Pick a team above for farm-system overview, radar, and affiliate box scores.
                </p>
                <button
                  type="button"
                  onClick={() => setPageTab('rankings')}
                  className="mt-4 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-300 hover:bg-sky-500/15"
                >
                  Open Rankings
                </button>
              </div>
            ) : null}

            {!allMlbSelected && (
            <>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDate((value) => shiftDate(value, -1))}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white hover:border-slate-600"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setDate(todayIso())}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-200 hover:border-emerald-500/35 hover:text-emerald-300"
                >
                  {prettyDate(date)}
                </button>
                <button
                  type="button"
                  onClick={() => setDate((value) => shiftDate(value, 1))}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white hover:border-slate-600"
                  aria-label="Next day"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="min-w-0 w-full sm:max-w-md sm:ml-auto">
                <LevelFilterBar value={levelFilter} onChange={setLevelFilter} />
              </div>
            </div>

            <section className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-orange-300 font-black uppercase tracking-widest text-[10px]">
                  <Flame size={14} />
                  Today&apos;s Top Performances
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Biggest box-score days across the pipeline right now.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {todayTopPerformances.length ? todayTopPerformances.map((player) => (
                    <PlayerChip
                      key={`today-${player.kind}-${player.id}`}
                      player={player}
                      onSelect={selectProspectPlayer}
                      isWatched={isWatched(player.id)}
                      onToggleWatch={toggleWatch}
                      showAffiliation
                      showSeasonStats
                      lineMode="today"
                      accentHover="group-hover:text-orange-300"
                    />
                  )) : (
                    <div className="text-sm text-slate-500">
                      No big days yet — check back after games start or flip the date.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-500/20 bg-slate-900/80 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-emerald-300 font-black uppercase tracking-widest text-[10px]">
                  <TrendingUp size={14} />
                  Prospect Radar
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Season lines that jump off the page — future big-leaguers worth tracking now.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {prospectRadar.length ? prospectRadar.map((player) => (
                    <PlayerChip
                      key={`radar-${player.kind}-${player.id}`}
                      player={player}
                      onSelect={selectProspectPlayer}
                      isWatched={isWatched(player.id)}
                      onToggleWatch={toggleWatch}
                      showAffiliation
                      lineMode="season"
                      accentHover="group-hover:text-emerald-300"
                    />
                  )) : (
                    <div className="text-sm text-slate-500">
                      Season leaders load once affiliate stats finish syncing.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {isLoading ? (
              <div className="py-20 flex justify-center">
                <BaseballSpinner size="xl" label="Loading affiliate games and prospect signals…" />
              </div>
            ) : (
              <div className="mt-6 grid gap-5">
                {visibleCards.map((affiliate) => (
                  <AffiliateCard
                    key={affiliate.id}
                    affiliate={affiliate}
                    onSelectPlayer={selectProspectPlayer}
                    isWatched={isWatched}
                    onToggleWatch={toggleWatch}
                  />
                ))}
                {!visibleCards.length && (
                  <div className="rounded-[2rem] border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center text-slate-500">
                    No affiliates match this filter.
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </>
        )}

        {pageTab === 'rankings' && (
          <RankingsPage
            org={selectedOrg}
            rankings={rankings}
            isLoading={rankingsLoading}
            error={rankingsError}
            onSelectPlayer={selectProspectPlayer}
            isWatched={isWatched}
            onToggleWatch={toggleWatch}
          />
        )}

        {pageTab === 'table' && (
          <>
            {allMlbSelected ? (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center">
                <img src={MLB_LEAGUE_LOGO} alt="" className="mx-auto mb-3 h-12 w-12 object-contain" />
                <p className="text-sm font-semibold text-slate-200">
                  Season tables are org-specific.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Select a team for the full prospect table, or open Rankings for the MLB Top 100.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 min-w-0 w-full">
                  <LevelFilterBar value={levelFilter} onChange={setLevelFilter} />
                </div>
                {isLoading ? (
                  <div className="py-20 flex justify-center">
                    <BaseballSpinner size="xl" label="Loading org prospect table…" />
                  </div>
                ) : (
                  <ProspectOrgTable
                    players={prospectTablePlayers}
                    modeLabel="Season"
                    sort={prospectTableSort}
                    onSort={setProspectTableSort}
                    onSelectPlayer={selectProspectPlayer}
                    isWatched={isWatched}
                    onToggleWatch={toggleWatch}
                  />
                )}
              </>
            )}
          </>
        )}

        {pageTab === 'favorites' && (
          <FavoritesPage
            players={watchlistPlayers}
            notes={notes}
            onSelectPlayer={selectProspectPlayer}
            onToggleWatch={toggleWatch}
          />
        )}
      </div>

      <ProspectPreviewModal
        key={previewPlayer?.id ?? 'empty'}
        player={previewPlayer}
        open={Boolean(previewPlayer)}
        onClose={closeProspectPreview}
        isWatched={isWatched}
        onToggleWatch={toggleWatch}
        note={selectedNote}
        onNoteChange={(value) => {
          if (!previewPlayer) return;
          setNotes((current) => ({
            ...current,
            [previewPlayer.id]: value,
          }));
        }}
      />
    </div>
  );
}
