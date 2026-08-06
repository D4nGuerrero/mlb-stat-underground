/**
 * National TV broadcaster IDs and logos from MLB static CDN (2026).
 * Light:  https://www.mlbstatic.com/team-logos/broadcasters-on-light/{id}.svg
 * Dark:   https://www.mlbstatic.com/team-logos/broadcasters-on-dark/{id}.svg
 *
 * logoFit:
 *   - "wide"   (default) — wordmarks; keep short height, allow more width
 *   - "narrow" — square/tall marks (e.g. MLB Network); taller so they don't look tiny
 */
export const NATIONAL_BROADCAST_NETWORKS = {
  142: { label: 'ESPN', match: ['espn'], logoFit: 'wide' },
  144: { label: 'FOX', match: ['fox'], logoFit: 'wide' },
  4725: { label: 'FS1', match: ['fs1'], logoFit: 'wide' },
  6019: { label: 'Apple TV', match: ['apple'], logoFit: 'wide' },
  5725: { label: 'Peacock', match: ['peacock', 'nbcsn'], logoFit: 'wide' },
  6021: { label: 'NBC', match: ['nbc'], logoFit: 'wide' },
  129: { label: 'TBS', match: ['tbs'], logoFit: 'wide' },
  5773: { label: 'MLB Network', match: ['mlb network', 'mlbn'], logoFit: 'narrow' },
};

/**
 * Tailwind classes for national broadcast logos.
 * Wide logos stay compact (h-4); narrow marks get a bit more height so they read.
 */
export function broadcastLogoClassName(networkId, { compact = false, size = 'sm' } = {}) {
  const id = Number(networkId);
  const fit = NATIONAL_BROADCAST_NETWORKS[id]?.logoFit || 'wide';

  if (fit === 'narrow') {
    // Square / tall marks: extra height so visual weight matches wide wordmarks
    if (size === 'md') return 'h-7 w-auto max-w-[2.75rem] object-contain';
    return compact
      ? 'h-5 w-auto max-w-[2.25rem] object-contain'
      : 'h-5 w-auto max-w-[2.5rem] object-contain';
  }

  // Wide wordmarks (ESPN, FOX, TBS, …)
  if (size === 'md') return 'h-7 w-auto max-w-[6.5rem] object-contain';
  return compact
    ? 'h-4 w-auto max-w-[5.5rem] object-contain'
    : 'h-4 w-auto max-w-[6.5rem] object-contain';
}

const KNOWN_NATIONAL_IDS = new Set(
  Object.keys(NATIONAL_BROADCAST_NETWORKS).map(Number),
);

/** @deprecated Prefer NATIONAL_BROADCAST_NETWORKS; kept for call sites that only need labels by id. */
export const KNOWN_NATIONAL_BROADCAST_LABELS = Object.fromEntries(
  Object.entries(NATIONAL_BROADCAST_NETWORKS).map(([id, net]) => [Number(id), net.label]),
);

function rawBroadcastText(broadcast) {
  return String(broadcast?.callSign || broadcast?.name || '').trim();
}

/**
 * Resolve a Stats API broadcast entry to a known national network id, if any.
 */
export function resolveNationalBroadcastId(broadcast) {
  const id = Number(broadcast?.id);
  if (Number.isFinite(id) && KNOWN_NATIONAL_IDS.has(id)) return id;

  const normalized = rawBroadcastText(broadcast).toLowerCase();
  if (!normalized) return null;

  for (const [netId, net] of Object.entries(NATIONAL_BROADCAST_NETWORKS)) {
    for (const token of net.match) {
      if (token === 'fox') {
        // Avoid matching FS1 / Fox Sports regional as plain FOX
        if (normalized === 'fox' || normalized.includes(' fox') || normalized.startsWith('fox ')) {
          return Number(netId);
        }
        continue;
      }
      if (token === 'nbc') {
        // Avoid Peacock / NBCSN regional false-positives already handled by other entries
        if (
          (normalized === 'nbc' || normalized.includes(' nbc') || normalized.startsWith('nbc '))
          && !normalized.includes('peacock')
          && !normalized.includes('nbcsn')
          && !normalized.includes('nbcs')
        ) {
          return Number(netId);
        }
        continue;
      }
      if (normalized.includes(token) || normalized === token) {
        return Number(netId);
      }
    }
  }
  return null;
}

export function normalizeBroadcastLabel(broadcast) {
  const id = resolveNationalBroadcastId(broadcast);
  if (id != null && NATIONAL_BROADCAST_NETWORKS[id]) {
    return NATIONAL_BROADCAST_NETWORKS[id].label;
  }

  const raw = rawBroadcastText(broadcast);
  const normalized = raw.toLowerCase();
  if (!raw) return null;
  if (normalized.includes('apple')) return 'Apple TV';
  if (normalized === 'fox' || normalized.includes(' fox')) return 'FOX';
  if (normalized === 'fs1') return 'FS1';
  if (normalized.includes('espn')) return 'ESPN';
  if (normalized.includes('tbs')) return 'TBS';
  if (normalized.includes('roku')) return 'Roku';
  if (normalized.includes('peacock')) return 'Peacock';
  if (normalized.includes('mlb network') || normalized === 'mlbn') return 'MLB Network';
  return raw;
}

export function broadcastLogoUrl(networkId, { preferDark = true } = {}) {
  const id = Number(networkId);
  if (!Number.isFinite(id)) return null;
  const variant = preferDark ? 'broadcasters-on-dark' : 'broadcasters-on-light';
  return `https://www.mlbstatic.com/team-logos/${variant}/${id}.svg`;
}

/**
 * National TV networks for a game (deduped by network id / label).
 * @returns {{ id: number|null, label: string }[]}
 */
export function getNationalTvBroadcasts(gameOrBroadcasts) {
  const broadcasts = Array.isArray(gameOrBroadcasts)
    ? gameOrBroadcasts
    : gameOrBroadcasts?.broadcasts;
  const items = [];
  const seen = new Set();

  for (const broadcast of broadcasts ?? []) {
    const isTv = String(broadcast?.type ?? '').toUpperCase() === 'TV';
    if (!isTv) continue;

    const networkId = resolveNationalBroadcastId(broadcast);
    const isKnownNational = networkId != null;
    if (!broadcast?.isNational && !isKnownNational) continue;

    const label = normalizeBroadcastLabel(broadcast);
    if (!label) continue;

    const key = networkId != null ? `id:${networkId}` : `label:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ id: networkId, label });
  }

  return items;
}

export function getNationalTvBroadcastLabels(gameOrBroadcasts) {
  return getNationalTvBroadcasts(gameOrBroadcasts).map((b) => b.label);
}

export function formatNationalBroadcastLine(gameOrBroadcasts) {
  const labels = getNationalTvBroadcastLabels(gameOrBroadcasts);
  return labels.length ? `Watch on ${labels.join(', ')}` : null;
}
