/** Pick a playback URL by name, with sensible fallbacks. */
export function pickPlayback(playbacks, preferredNames) {
  const names = Array.isArray(preferredNames) ? preferredNames : [preferredNames];
  for (const name of names) {
    const hit = playbacks?.find((p) => p.name === name && p.url);
    if (hit) return hit.url;
  }
  return playbacks?.find((p) => p.url)?.url ?? null;
}

/** Best thumbnail from MLB image cuts (prefer 16:9 ~640px). */
export function pickThumbnail(image) {
  const cuts = image?.cuts ?? [];
  const preferred =
    cuts.find((c) => c.aspectRatio === '16:9' && c.width === 640) ||
    cuts.find((c) => c.aspectRatio === '16:9' && c.width >= 480) ||
    cuts[0];
  return preferred?.src ?? null;
}

function slugifyMiLBVideoPart(text, maxLength = 80) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

function keywordValues(keywordsAll, type) {
  return (keywordsAll ?? [])
    .filter((k) => k.type === type)
    .map((k) => k.value);
}

function hasKeyword(keywordsAll, value) {
  return (keywordsAll ?? []).some((k) => k.value === value);
}

function hasKeywordType(keywordsAll, type) {
  return (keywordsAll ?? []).some((k) => k.type === type);
}

function isLegacyGameClip(item) {
  const keywords = item?.keywordsAll ?? [];
  return (
    hasKeywordType(keywords, 'game_pk') &&
    (hasKeywordType(keywords, 'player_id') || hasKeyword(keywords, 'highlight'))
  );
}

/** Parse in-game highlight videos from game content API. */
export function parseGameHighlightVideos(content) {
  const items = content?.highlights?.highlights?.items ?? [];
  const activeVideos = items.filter((it) => it.type === 'video' && it.state === 'A');
  const inGameHighlights = activeVideos
    .filter((it) => hasKeyword(it.keywordsAll, 'in-game-highlight'));

  // Newer MLB clips often include game-action-tracking, which is a safer signal
  // for play matching. Some real play clips still omit it, though, so keep the
  // tracked clips first and append the rest of the in-game highlights. The
  // matcher below stays strict enough to avoid attaching general/nearby clips.
  const trackedHighlights = inGameHighlights.filter((it) =>
    hasKeyword(it.keywordsAll, 'game-action-tracking')
  );
  // Some 2017-era clips have neither modern keyword, but still carry game/player
  // keywords and direct legacy media URLs. Only use this broad pool as a last
  // resort so newer games keep the stricter matching behavior.
  const legacyGameClips = activeVideos.filter(isLegacyGameClip);
  const trackedIds = new Set(trackedHighlights.map((it) => it.id));
  const playableHighlights = inGameHighlights.length
    ? [
        ...trackedHighlights,
        ...inGameHighlights.filter((it) => !trackedIds.has(it.id)),
      ]
    : legacyGameClips;

  return playableHighlights
    .map((it) => ({
      id: it.id,
      headline: it.headline ?? '',
      description: it.description ?? '',
      thumbnail: pickThumbnail(it.image),
      mp4Url: pickPlayback(it.playbacks, [
        'mp4Avc',
        'highBit',
        'FLASH_2500K_1280X720',
        'FLASH_1800K_960X540',
        'FLASH_1200K_640X360',
      ]),
      hlsUrl: pickPlayback(it.playbacks, [
        'hlsCloud',
        'HTTP_CLOUD_WIRED',
        'HTTP_CLOUD_WIRED_60',
        'HTTP_CLOUD_TABLET',
        'HTTP_CLOUD_MOBILE',
      ]),
      shareUrl: it.id ? `https://www.mlb.com/video/${it.id}` : null,
      playerIds: keywordValues(it.keywordsAll, 'player_id').map(Number).filter(Boolean),
      taxonomies: keywordValues(it.keywordsAll, 'taxonomy'),
    }));
}

function parseMiLBVideo(item) {
  if (!item?.id && !item?.content_id && !item?.slug) return null;
  const id = item.id ?? item.content_id ?? item.slug;
  return {
    id,
    headline: item.title ?? item.headline ?? '',
    description: item.description ?? item.blurb ?? '',
    thumbnail: pickThumbnail(item.image),
    mp4Url: pickPlayback(item.playbacks, ['mp4Avc', 'highBit']),
    hlsUrl: pickPlayback(item.playbacks, ['hlsCloud', 'HTTP_CLOUD_WIRED']),
    shareUrl: `https://www.milb.com/video/${item.slug ?? id}`,
    playerIds: [],
    taxonomies: [],
  };
}

/** Direct playable video URL (mp4 preferred, then hls). */
export function getHighlightVideoUrl(video) {
  return video?.mp4Url || video?.hlsUrl || null;
}

/** Public MLB.com page for a highlight. */
export function getHighlightShareUrl(video) {
  return video?.shareUrl ?? (video?.id ? `https://www.mlb.com/video/${video.id}` : null);
}

function formatYoutubeFallbackDate(gameData) {
  const rawDate =
    gameData?.datetime?.originalDate ||
    gameData?.datetime?.officialDate ||
    gameData?.game?.officialDate ||
    gameData?.datetime?.dateTime;
  if (!rawDate) return null;

  const [year, month, day] = String(rawDate).slice(0, 10).split('-');
  if (!year || !month || !day) return null;
  return `${year}/${month}/${day}`;
}

function lastNameForVideoSearch(fullName) {
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const last = parts.at(-1);
  if (parts.length > 1 && suffixes.has(last.toLowerCase())) return parts.at(-2);
  return last;
}

function isLegacyYoutubeFallbackSeason(gameData) {
  const season = Number(gameData?.game?.season);
  return season >= 2012 && season <= 2018;
}

export function buildYoutubeHighlightFallbackMap(summaryItems, gameData) {
  if (!isLegacyYoutubeFallbackSeason(gameData)) return {};

  const date = formatYoutubeFallbackDate(gameData);
  if (!date) return {};

  const map = {};
  for (const item of summaryItems ?? []) {
    if (!item?.isScoring) continue;

    const lastName = lastNameForVideoSearch(item.batterName);
    if (!lastName) continue;

    const query = `${date} ${lastName}`;
    map[item.key] = {
      id: `youtube-search-${item.key}`,
      provider: 'YouTube',
      isExternal: true,
      headline: `Search YouTube: ${query}`,
      description: item.description,
      shareUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      playerIds: item.batterId ? [Number(item.batterId)].filter(Boolean) : [],
      taxonomies: ['youtube-fallback'],
    };
  }

  return map;
}

/** Copy text with Clipboard API, falling back to execCommand for mobile browsers. */
export function copyToClipboard(text) {
  if (!text || typeof document === 'undefined') return Promise.resolve(false);

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => copyToClipboardLegacy(text));
  }

  return Promise.resolve(copyToClipboardLegacy(text));
}

function copyToClipboardLegacy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText =
      'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Native share sheet when available; otherwise copy link to clipboard. */
export async function shareHighlightVideo(video) {
  const url = getHighlightShareUrl(video);
  if (!url) return { ok: false, reason: 'no-url' };

  const title = video.headline || 'MLB Highlight';
  const text = video.description || title;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { ok: true, method: 'native' };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    }
  }

  const copied = await copyToClipboard(url);
  return copied
    ? { ok: true, method: 'clipboard' }
    : { ok: false, reason: 'clipboard-failed' };
}

export async function copyHighlightLink(video) {
  const url = getHighlightVideoUrl(video);
  if (!url) return false;
  return copyToClipboard(url);
}

function normalizeSearchText(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeSearchText(text)
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

const HEADLINE_ORDINALS = [
  ['second', 2],
  ['third', 3],
  ['fourth', 4],
];

const INNING_WORDS = new Map([
  ['first', 1],
  ['second', 2],
  ['third', 3],
  ['fourth', 4],
  ['fifth', 5],
  ['sixth', 6],
  ['seventh', 7],
  ['eighth', 8],
  ['ninth', 9],
  ['tenth', 10],
  ['eleventh', 11],
  ['twelfth', 12],
  ['thirteenth', 13],
  ['fourteenth', 14],
  ['fifteenth', 15],
]);

function playSlugCandidates(item) {
  const play = item?.play;
  const description = item?.description ?? play?.result?.description ?? '';
  const pitcher = play?.matchup?.pitcher?.fullName;
  const batter = play?.matchup?.batter?.fullName ?? item?.batterName;
  const pitcherBatterCandidates = pitcher && batter
    ? [
        `${pitcher} In play, run(s) to ${batter}`,
        `${pitcher} In play, out(s) to ${batter}`,
      ]
    : [];
  return [
    slugifyMiLBVideoPart(description, 120),
    slugifyMiLBVideoPart(description, 73),
    ...pitcherBatterCandidates.map((candidate) => slugifyMiLBVideoPart(candidate, 80)),
  ].filter(Boolean);
}

function slugHighlightScore(item, highlight) {
  const highlightId = String(highlight?.id ?? '');
  if (!highlightId) return 0;

  let best = 0;
  for (const candidate of playSlugCandidates(item)) {
    if (highlightId === candidate) return 100;
    if (highlightId.startsWith(candidate) || candidate.startsWith(highlightId)) {
      best = Math.max(best, 45);
      continue;
    }
    const parts = candidate.split('-').filter((part) => part.length > 3);
    const overlap = parts.filter((part) => highlightId.includes(part)).length;
    if (overlap >= 5) best = Math.max(best, 18 + overlap);
    else if (overlap >= 3) best = Math.max(best, 10 + overlap);
  }
  return best;
}

function headlineOrdinalMismatch(item, highlight, priorBatterScoringCount = 0) {
  const headline = (highlight?.headline ?? '').toLowerCase();
  for (const [word, ordinal] of HEADLINE_ORDINALS) {
    if (!headline.includes(word)) continue;
    if (priorBatterScoringCount !== ordinal - 1) return true;
  }
  return false;
}

function extractMentionedInnings(highlight) {
  const text = rawHighlightText(highlight);
  const innings = new Set();

  for (const match of text.matchAll(
    /\b(?:top|bottom)?(?:\s+of)?(?:\s+the)?\s*(\d{1,2})(?:st|nd|rd|th)\s+inning\b/g,
  )) {
    innings.add(Number(match[1]));
  }

  for (const match of text.matchAll(
    /\b(?:in|during|through|close|closes|closing|end|ends|ending|open|opens|opening)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/g,
  )) {
    innings.add(Number(match[1]));
  }

  for (const match of text.matchAll(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth)\s+inning\b/g)) {
    const inning = INNING_WORDS.get(match[1]);
    if (inning) innings.add(inning);
  }

  return innings;
}

function highlightInningMismatch(item, highlight) {
  const itemInning = Number(item?.about?.inning ?? item?.play?.about?.inning);
  if (!itemInning) return false;

  const mentionedInnings = extractMentionedInnings(highlight);
  return mentionedInnings.size > 0 && !mentionedInnings.has(itemInning);
}

function scoreHighlightMatch(item, highlight) {
  const desc = normalizeSearchText(item.description);
  const headline = normalizeSearchText(highlight.headline);
  const highlightDescription = normalizeSearchText(highlight.description);
  const tokens = tokenize(desc);
  let score = slugHighlightScore(item, highlight);
  for (const t of tokens) {
    if (headline.includes(t)) score += 2;
    if (highlightDescription.includes(t)) score += 1;
  }

  const eventType = item.eventType ?? '';
  if (eventType === 'home_run' && highlight.taxonomies.includes('home-run')) score += 5;
  if (['single', 'double', 'triple', 'sac_fly', 'hit_by_pitch'].includes(eventType) && eventTypeMatchesHighlight(item, highlight)) {
    score += 3;
  }
  if (eventType.includes('stolen') && /steal/i.test(highlight.headline)) score += 5;
  if (/grand slam/i.test(desc) && /grand slam/i.test(highlight.headline)) score += 8;
  if (/solo home run/i.test(headline) && /homers?\s*\(\d+\)/i.test(desc)) score += 4;
  if (/rbi/i.test(headline) && (item.isScoring || /\bscores?\b/i.test(desc))) score += 2;
  if (isCompilationHighlight(highlight)) score -= 6;

  return score;
}

function highlightText(highlight) {
  return normalizeSearchText(`${highlight?.headline ?? ''} ${highlight?.description ?? ''}`);
}

function rawHighlightText(highlight) {
  return `${highlight?.headline ?? ''} ${highlight?.description ?? ''}`.toLowerCase();
}

function isCompilationHighlight(highlight) {
  const text = rawHighlightText(highlight);
  return (
    highlight?.taxonomies?.includes('highlight-reel-offense') ||
    highlight?.taxonomies?.includes('highlight-reel-defense') ||
    /\b(two|three|four|multi)[-\s]?homer\b/.test(text) ||
    /\b(?:plates?|scores?)\s+\w+\s+(?:runs?\s+)?in\s+the\s+\d/.test(text) ||
    /\bcondensed game|game recap\b/.test(text)
  );
}

function extractPlayStatNumber(text) {
  const match = (text ?? '').match(/\((\d+)\)/);
  return match?.[1] ?? null;
}

function extractHighlightStatNumbers(highlight) {
  return [...rawHighlightText(highlight).matchAll(/\((\d+)\)/g)].map((match) => match[1]);
}

function eventTypeMatchesHighlight(item, highlight) {
  const eventType = item?.eventType ?? '';
  const text = highlightText(highlight);

  if (eventType === 'home_run') {
    return highlight.taxonomies.includes('home-run') || /home run|homer|homers/.test(text);
  }
  if (eventType === 'double') return /\bdouble|doubles\b/.test(text);
  if (eventType === 'triple') return /\btriple|triples\b/.test(text);
  if (eventType === 'single') return /\bsingle|singles\b/.test(text);
  if (eventType === 'sac_fly') return /sacrifice|sac fly/.test(text);
  if (eventType === 'hit_by_pitch') return /hit by (a )?pitch|hit-by-pitch|plunk|cartwheel/.test(text);
  if (eventType.includes('stolen')) return /steal|stolen/.test(text);

  return true;
}

const BATTER_OWNED_EVENTS = new Set([
  'home_run',
  'double',
  'triple',
  'single',
  'field_error',
  'fielders_choice',
  'fielders_choice_out',
  'hit_by_pitch',
  'sac_fly',
  'sac_bunt',
]);

function itemParticipantIds(item) {
  return [
    ...(item?.participantIds ?? []),
    item?.batterId,
  ]
    .map(Number)
    .filter(Boolean);
}

function highlightIncludesAnyPlayer(highlight, ids) {
  const wanted = new Set(ids);
  return highlight.playerIds.some((id) => wanted.has(id));
}

function playerIdentityMatches(item, highlight) {
  if (!highlight.playerIds.length) return false;

  const batterId = Number(item?.batterId);
  if (BATTER_OWNED_EVENTS.has(item?.eventType) && batterId) {
    return highlight.playerIds.includes(batterId);
  }

  return highlightIncludesAnyPlayer(highlight, itemParticipantIds(item));
}

function isReliableHighlightMatch(item, highlight, { priorBatterScoringCount = 0 } = {}) {
  if (!item || !highlight) return false;
  if (!highlight.mp4Url && !highlight.hlsUrl) return false;

  // MLB highlights can arrive later than the play text. Older clips can look
  // "close enough" by text, so require a real player overlap unless the
  // content slug is a very strong exact match. Some scoring clips are tagged to
  // the scoring runner instead of the batter, so participantIds includes both.
  const strongSlugMatch = slugHighlightScore(item, highlight) >= 45;
  if (!playerIdentityMatches(item, highlight) && !strongSlugMatch) return false;
  if (!eventTypeMatchesHighlight(item, highlight)) return false;
  if (highlightInningMismatch(item, highlight)) return false;
  if (item.isScoring && headlineOrdinalMismatch(item, highlight, priorBatterScoringCount)) return false;

  const itemStatNumber = extractPlayStatNumber(item.description);
  const highlightStatNumbers = extractHighlightStatNumbers(highlight);
  if (
    item?.eventType === 'home_run' &&
    itemStatNumber &&
    highlightStatNumbers.length > 0 &&
    !highlightStatNumbers.includes(itemStatNumber)
  ) {
    return false;
  }

  return scoreHighlightMatch(item, highlight) >= (item.isScoring ? 7 : 9);
}

/** Match a summary item to the best highlight video, if any. */
export function matchHighlightForItem(item, highlights) {
  if (!item || !highlights?.length) return null;

  const participantIds = itemParticipantIds(item);
  let pool = highlights;

  if (participantIds.length) {
    const byPlayer = highlights.filter((h) => highlightIncludesAnyPlayer(h, participantIds));
    if (byPlayer.length) pool = byPlayer;
  }

  const ranked = pool
    .map((h) => ({ h, score: scoreHighlightMatch(item, h) }))
    .filter(({ h, score }) => score >= (item.isScoring ? 7 : 9) && isReliableHighlightMatch(item, h))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.h;
  if (!best?.mp4Url && !best?.hlsUrl) return null;
  return best;
}

/** Build map of summary item key -> highlight video. */
export function buildHighlightMap(summaryItems, highlights) {
  const map = {};
  const used = new Set();
  const batterScoringCount = new Map();

  const playableItems = (summaryItems ?? []).filter((i) => i?.play && i?.eventType);
  const orderedItems = [
    ...playableItems.filter((i) => i.isScoring),
    ...playableItems.filter((i) => !i.isScoring),
  ];

  for (const item of orderedItems) {
    const batterId = Number(item?.batterId);
    const priorBatterScoringCount = batterId ? (batterScoringCount.get(batterId) ?? 0) : 0;
    const matchContext = { priorBatterScoringCount };

    const candidates = highlights
      .filter((h) => !used.has(h.id))
      .map((h) => ({ h, score: scoreHighlightMatch(item, h) }))
      .filter(({ h, score }) => score >= (item.isScoring ? 7 : 9) && isReliableHighlightMatch(item, h, matchContext))
      .sort((a, b) => b.score - a.score);

    const pick = candidates[0]?.h;
    if (pick && (pick.mp4Url || pick.hlsUrl)) {
      map[item.key] = pick;
      used.add(pick.id);
    }

    if (item.isScoring && batterId) batterScoringCount.set(batterId, priorBatterScoringCount + 1);
  }

  return map;
}

function scoringRunnerNames(play) {
  return (play?.runners ?? [])
    .filter((runner) => runner?.movement?.end === 'score')
    .map((runner) => runner?.details?.runner?.fullName)
    .filter(Boolean);
}

function buildMiLBVideoCandidates(item) {
  const play = item?.play;
  const pitcher = play?.matchup?.pitcher?.fullName;
  const batter = play?.matchup?.batter?.fullName ?? item?.batterName;
  const description = item?.description ?? play?.result?.description ?? '';
  const names = [batter, ...scoringRunnerNames(play)].filter(Boolean);

  const primaryCandidates = [
    slugifyMiLBVideoPart(description, 73),
    ...names.map((name) => `${pitcher} In play, run(s) to ${name}`)
      .map((candidate) => slugifyMiLBVideoPart(candidate, 80)),
  ];
  const fallbackTexts = [
    ...names.map((name) => `${pitcher} In play, run(s) to ${name}`),
    description,
    batter && description ? `${batter} ${description}` : null,
  ].filter(Boolean);

  return [...new Set(
    [
      ...primaryCandidates,
      // MiLB play-description content ids are commonly hard-truncated at 73 chars.
      ...fallbackTexts.flatMap((candidate) => [
        slugifyMiLBVideoPart(candidate, 73),
        slugifyMiLBVideoPart(candidate, 80),
        slugifyMiLBVideoPart(candidate, 120),
      ]),
    ],
  )].filter(Boolean);
}

const milbVideoCache = new Map();
const MILB_VIDEO_LOOKUP_TIMEOUT_MS = 3_500;

function timeoutSignal(parentSignal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const id = setTimeout(abort, timeoutMs);

  if (parentSignal) {
    if (parentSignal.aborted) abort();
    else parentSignal.addEventListener('abort', abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(id);
      parentSignal?.removeEventListener?.('abort', abort);
    },
  };
}

async function fetchMiLBVideoBySlug(slug, signal) {
  if (milbVideoCache.has(slug)) return milbVideoCache.get(slug);

  const timeout = timeoutSignal(signal, MILB_VIDEO_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.milb.com/data-service/en/videos/${encodeURIComponent(slug)}`,
      { signal: timeout.signal },
    );
    if (!res.ok) {
      milbVideoCache.set(slug, null);
      return null;
    }
    const video = parseMiLBVideo(await res.json());
    const playableVideo = video?.mp4Url || video?.hlsUrl ? video : null;
    milbVideoCache.set(slug, playableVideo);
    return playableVideo;
  } catch (err) {
    if (signal?.aborted) throw err;
    milbVideoCache.set(slug, null);
    return null;
  } finally {
    timeout.cleanup();
  }
}

async function findMiLBVideoForItem(item, signal) {
  const candidates = buildMiLBVideoCandidates(item);
  const primary = candidates.slice(0, 1 + scoringRunnerNames(item?.play).length + 1);
  const fallback = candidates.slice(primary.length);

  const primaryResults = await Promise.all(
    primary.map((slug) => fetchMiLBVideoBySlug(slug, signal)),
  );
  const primaryHit = primaryResults.find(Boolean);
  if (primaryHit) return primaryHit;

  const fallbackResults = await Promise.all(
    fallback.map((slug) => fetchMiLBVideoBySlug(slug, signal)),
  );
  return fallbackResults.find(Boolean) ?? null;
}

export async function buildMiLBHighlightMap(summaryItems, { signal } = {}) {
  const scoringItems = (summaryItems ?? []).filter((item) => item?.isScoring);
  const entries = await Promise.all(
    scoringItems.map(async (item) => [item.key, await findMiLBVideoForItem(item, signal)]),
  );

  return Object.fromEntries(entries.filter(([, video]) => video));
}

export async function fetchGameContent(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/content`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
