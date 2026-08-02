const KNOWN_NATIONAL_BROADCAST_LABELS = {
  144: 'FOX',
  4725: 'FS1',
  5725: 'Peacock',
  6019: 'Apple TV',
  6021: 'NBC / Peacock',
};

const normalizeBroadcastLabel = (broadcast) => {
  const idLabel = KNOWN_NATIONAL_BROADCAST_LABELS[Number(broadcast?.id)];
  if (idLabel) return idLabel;

  const raw = String(broadcast?.callSign || broadcast?.name || '').trim();
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
};

export function getNationalTvBroadcastLabels(gameOrBroadcasts) {
  const broadcasts = Array.isArray(gameOrBroadcasts)
    ? gameOrBroadcasts
    : gameOrBroadcasts?.broadcasts;
  const labels = [];
  const seen = new Set();

  for (const broadcast of broadcasts ?? []) {
    const isTv = String(broadcast?.type ?? '').toUpperCase() === 'TV';
    if (!isTv) continue;

    const isKnownNational = Boolean(KNOWN_NATIONAL_BROADCAST_LABELS[Number(broadcast?.id)]);
    if (!broadcast?.isNational && !isKnownNational) continue;

    const label = normalizeBroadcastLabel(broadcast);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels;
}

export function formatNationalBroadcastLine(gameOrBroadcasts) {
  const labels = getNationalTvBroadcastLabels(gameOrBroadcasts);
  return labels.length ? `Watch on ${labels.join(', ')}` : null;
}
