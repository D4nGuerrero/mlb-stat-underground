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

/** Parse in-game highlight videos from game content API. */
export function parseGameHighlightVideos(content) {
  const items = content?.highlights?.highlights?.items ?? [];
  return items
    .filter((it) => it.type === 'video' && it.state === 'A')
    .filter((it) => hasKeyword(it.keywordsAll, 'in-game-highlight'))
    .filter((it) => hasKeyword(it.keywordsAll, 'game-action-tracking'))
    .map((it) => ({
      id: it.id,
      headline: it.headline ?? '',
      description: it.description ?? '',
      thumbnail: pickThumbnail(it.image),
      mp4Url: pickPlayback(it.playbacks, ['mp4Avc', 'highBit']),
      hlsUrl: pickPlayback(it.playbacks, ['hlsCloud', 'HTTP_CLOUD_WIRED']),
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

function scoreHighlightMatch(item, highlight) {
  const desc = normalizeSearchText(item.description);
  const headline = normalizeSearchText(highlight.headline);
  const highlightDescription = normalizeSearchText(highlight.description);
  const tokens = tokenize(desc);
  let score = 0;
  for (const t of tokens) {
    if (headline.includes(t)) score += 2;
    if (highlightDescription.includes(t)) score += 1;
  }

  const eventType = item.eventType ?? '';
  if (eventType === 'home_run' && highlight.taxonomies.includes('home-run')) score += 5;
  if (['single', 'double', 'triple', 'sac_fly'].includes(eventType) && eventTypeMatchesHighlight(item, highlight)) {
    score += 3;
  }
  if (eventType.includes('stolen') && /steal/i.test(highlight.headline)) score += 5;
  if (/grand slam/i.test(desc) && /grand slam/i.test(highlight.headline)) score += 8;
  if (/solo home run/i.test(headline) && /homers?\s*\(\d+\)/i.test(desc)) score += 4;
  if (/rbi/i.test(headline) && (item.isScoring || /\bscores?\b/i.test(desc))) score += 2;

  return score;
}

function highlightText(highlight) {
  return normalizeSearchText(`${highlight?.headline ?? ''} ${highlight?.description ?? ''}`);
}

function rawHighlightText(highlight) {
  return `${highlight?.headline ?? ''} ${highlight?.description ?? ''}`.toLowerCase();
}

function extractPlayStatNumber(text) {
  const match = (text ?? '').match(/\((\d+)\)/);
  return match?.[1] ?? null;
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

function isReliableHighlightMatch(item, highlight) {
  if (!item?.isScoring || !highlight) return false;
  if (!highlight.mp4Url && !highlight.hlsUrl) return false;

  // While MLB is still processing a new scoring-play video, older highlights
  // can look "close enough" by text. Require a real player overlap. Some MLB
  // scoring clips are tagged to the scoring runner instead of the batter
  // (example: "Caleb Durbin scores on groundout"), so participantIds includes
  // the batter plus runners who scored on the play.
  if (!playerIdentityMatches(item, highlight)) return false;
  if (!eventTypeMatchesHighlight(item, highlight)) return false;

  const itemStatNumber = extractPlayStatNumber(item.description);
  if (
    item?.eventType === 'home_run' &&
    itemStatNumber &&
    !rawHighlightText(highlight).includes(`(${itemStatNumber})`)
  ) {
    return false;
  }

  return scoreHighlightMatch(item, highlight) >= 7;
}

/** Match a scoring summary item to the best highlight video, if any. */
export function matchHighlightForItem(item, highlights) {
  if (!item?.isScoring || !highlights?.length) return null;

  const participantIds = itemParticipantIds(item);
  let pool = highlights;

  if (participantIds.length) {
    const byPlayer = highlights.filter((h) => highlightIncludesAnyPlayer(h, participantIds));
    if (byPlayer.length) pool = byPlayer;
  }

  const ranked = pool
    .map((h) => ({ h, score: scoreHighlightMatch(item, h) }))
    .filter(({ h, score }) => score >= 7 && isReliableHighlightMatch(item, h))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.h;
  if (!best?.mp4Url && !best?.hlsUrl) return null;
  return best;
}

/** Build map of summary item key -> highlight video. */
export function buildHighlightMap(summaryItems, highlights) {
  const map = {};
  const used = new Set();

  const scoringItems = summaryItems.filter((i) => i.isScoring);
  for (const item of scoringItems) {
    const candidates = highlights
      .filter((h) => !used.has(h.id))
      .map((h) => ({ h, score: scoreHighlightMatch(item, h) }))
      .filter(({ h, score }) => score >= 7 && isReliableHighlightMatch(item, h))
      .sort((a, b) => b.score - a.score);

    const pick = candidates[0]?.h;
    if (pick && (pick.mp4Url || pick.hlsUrl)) {
      map[item.key] = pick;
      used.add(pick.id);
    }
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
