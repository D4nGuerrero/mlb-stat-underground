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

function tokenize(text) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function scoreHighlightMatch(item, highlight) {
  const desc = (item.description ?? '').toLowerCase();
  const headline = (highlight.headline ?? '').toLowerCase();
  const tokens = tokenize(desc);
  let score = 0;
  for (const t of tokens) {
    if (headline.includes(t)) score += 2;
    if ((highlight.description ?? '').toLowerCase().includes(t)) score += 1;
  }

  const eventType = item.eventType ?? '';
  if (eventType === 'home_run' && highlight.taxonomies.includes('home-run')) score += 5;
  if (eventType.includes('stolen') && /steal/i.test(highlight.headline)) score += 5;
  if (/grand slam/i.test(desc) && /grand slam/i.test(highlight.headline)) score += 8;
  if (/solo home run/i.test(headline) && /homers?\s*\(\d+\)/i.test(desc)) score += 4;
  if (/rbi/i.test(headline) && (item.isScoring || /\bscores?\b/i.test(desc))) score += 2;

  return score;
}

/** Match a scoring summary item to the best highlight video, if any. */
export function matchHighlightForItem(item, highlights) {
  if (!item?.isScoring || !highlights?.length) return null;

  const batterId = item.batterId;
  let pool = highlights;

  if (batterId) {
    const byPlayer = highlights.filter((h) => h.playerIds.includes(batterId));
    if (byPlayer.length) pool = byPlayer;
  }

  const ranked = pool
    .map((h) => ({ h, score: scoreHighlightMatch(item, h) }))
    .filter(({ score }) => score >= 4)
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
      .filter(({ score }) => score >= 4)
      .sort((a, b) => b.score - a.score);

    const batterMatches = item.batterId
      ? candidates.filter(({ h }) => h.playerIds.includes(item.batterId))
      : candidates;

    const pick = (batterMatches[0] ?? candidates[0])?.h;
    if (pick && (pick.mp4Url || pick.hlsUrl)) {
      map[item.key] = pick;
      used.add(pick.id);
    }
  }

  return map;
}

export async function fetchGameContent(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/content`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}