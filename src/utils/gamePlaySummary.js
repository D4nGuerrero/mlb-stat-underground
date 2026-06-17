import { formatGameStartDisplay, formatVenueLine } from './gamePreview';
import {
  getOutsBeforeEvent,
  getPlayStartOuts,
} from './playSituation';

/** Non-pitch action events shown as their own summary rows. */
export const SUMMARY_ACTION_TYPES = new Set([
  'stolen_base_2b',
  'stolen_base_3b',
  'stolen_base_home',
  'caught_stealing_2b',
  'caught_stealing_3b',
  'caught_stealing_home',
  'wild_pitch',
  'passed_ball',
  'balk',
  'pickoff_1b',
  'pickoff_2b',
  'pickoff_caught_stealing_2b',
  'pickoff_caught_stealing_3b',
  'defensive_indiff',
]);

const SHOE_ICON_TYPES = new Set([
  'stolen_base_2b',
  'stolen_base_3b',
  'stolen_base_home',
  'caught_stealing_2b',
  'caught_stealing_3b',
  'caught_stealing_home',
  'pickoff_caught_stealing_2b',
  'pickoff_caught_stealing_3b',
]);

const PITCH_ICON_TYPES = new Set([
  'wild_pitch',
  'passed_ball',
  'balk',
  'pickoff_1b',
  'pickoff_2b',
  'defensive_indiff',
]);

export function getGameAdvisoryIconKind(item) {
  const text = `${item?.description || ''} ${item?.title || ''}`.toLowerCase();
  if (/on[-\s]?field delay|field delay/.test(text)) return 'field_delay';
  if (/suspend|rain|weather|lightning|inclement/.test(text)) return 'weather_delay';
  if (/postpon|cancel/.test(text)) return 'postponed';
  if (/injur|medical|emergency/.test(text)) return 'medical';
  if (/review|warning|eject/.test(text)) return 'warning';
  if (/delay|delayed/.test(text)) return 'delay';
  return 'advisory';
}

export function getSummaryPlayIconKind(item) {
  if (item?.kind === 'first_pitch') return 'baseball';
  if (item?.kind === 'status_change') return getGameAdvisoryIconKind(item);
  if (item?.kind === 'pitching_change') return 'pitching_sub';
  const eventType = item?.eventType;
  if (SHOE_ICON_TYPES.has(eventType)) return 'shoe';
  if (PITCH_ICON_TYPES.has(eventType)) return 'pitch';
  return null;
}

const ROUTINE_STATUS_CHANGES = new Set([
  'pre-game',
  'warmup',
  'in progress',
  'game in progress',
]);

function parseStatusChangeLabel(description) {
  const match = (description || '').match(/^status change\s*-\s*(.+)$/i);
  return (match?.[1] || description || '').trim();
}

function isNotableStatusChange(label) {
  const normalized = label.toLowerCase();
  if (!normalized) return false;
  if (ROUTINE_STATUS_CHANGES.has(normalized)) return false;
  return /delay|rain|injur|suspend|postpon|cancel|eject|review|warning|curfew|lightning|weather|death|emergency/i.test(normalized);
}

export function formatGameAdvisoryDescription(description) {
  const raw = (description || '').trim();
  const label = parseStatusChangeLabel(raw);
  if (!label) return '';
  return /^status change\s*-/i.test(raw) ? `Status Changed - ${label}` : label;
}

export function isNotableGameAdvisory(description) {
  return isNotableStatusChange(parseStatusChangeLabel(description));
}

function formatStatusChangeTime(iso, venue) {
  if (!iso) return null;
  const tz = venue?.timeZone?.id || 'America/New_York';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  });
}

export function buildFirstPitchItem(gameData) {
  const venue = gameData?.venue;
  const firstPitchIso = gameData?.gameInfo?.firstPitch;
  const scheduled = gameData?.datetime;
  const startDisplay = formatGameStartDisplay(
    firstPitchIso ? { dateTime: firstPitchIso } : scheduled,
    venue,
  );
  const venueLine = formatVenueLine(venue) || venue?.name || '—';
  const timeLine = startDisplay.timeLine
    ? `${startDisplay.timeLine}`
    : startDisplay.dateLine;

  return {
    kind: 'first_pitch',
    key: 'first-pitch',
    title: 'First Pitch',
    timeLine,
    venueLine,
    sortTime: firstPitchIso || scheduled?.dateTime || null,
  };
}

function buildStatusChangeItems(allPlays, alerts, venue) {
  const items = [];
  const seen = new Set();

  for (const play of allPlays) {
    for (const [eventIdx, ev] of (play.playEvents || []).entries()) {
      if (ev.details?.eventType !== 'game_advisory') continue;
      const raw = ev.details?.description || ev.details?.event || '';
      if (!isNotableGameAdvisory(raw)) continue;

      const key = `status-${ev.startTime || `${play.about?.atBatIndex}-${eventIdx}`}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        kind: 'status_change',
        key,
        eventType: 'game_advisory',
        title: 'Game Advisory',
        description: formatGameAdvisoryDescription(raw),
        timeLine: formatStatusChangeTime(ev.startTime, venue),
        about: play.about,
        sortTime: ev.startTime || play.about?.startTime || null,
      });
    }
  }

  for (const [idx, alert] of (alerts ?? []).entries()) {
    const message = alert?.message || alert?.detail || alert?.description;
    if (!message) continue;
    const key = `alert-${alert?.timestamp || idx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      kind: 'status_change',
      key,
      eventType: 'alert',
      title: 'Game Advisory',
      description: formatGameAdvisoryDescription(message),
      timeLine: formatStatusChangeTime(alert?.timestamp, venue),
      about: { inning: 1, halfInning: 'top' },
      sortTime: alert?.timestamp || null,
    });
  }

  return items;
}

export function buildSummaryLeadIn(gameData) {
  return buildFirstPitchItem(gameData);
}

export function isScoringDescription(description) {
  return /\bscores?\b/i.test(description || '');
}

const OUTS_SUFFIX_RE = /\s*\b\d+\s+outs?\.?\s*$/i;

export function formatOutsLabel(outs) {
  if (outs == null) return null;
  const n = Number(outs);
  if (Number.isNaN(n)) return null;
  return `${n} out${n === 1 ? '' : 's'}.`;
}

function stripOutsSuffix(description) {
  return (description || '').trim().replace(OUTS_SUFFIX_RE, '').trim();
}

function normalizeDescription(description) {
  const desc = stripOutsSuffix(description);
  if (!desc) return '';
  return desc.endsWith('.') ? desc : `${desc}.`;
}

export function playRecordedOut(play) {
  const startOuts = getPlayStartOuts(play.playEvents || []);
  const endOuts = play.count?.outs;
  if (startOuts == null || endOuts == null) return false;
  return endOuts > startOuts;
}

export function playEventRecordedOut(play, eventIdx, event) {
  const playEvents = play.playEvents || [];
  const outsAfter = event.count?.outs ?? play.count?.outs;
  const outsBefore = getOutsBeforeEvent(playEvents, eventIdx);
  if (outsAfter == null || outsBefore == null) return false;
  return outsAfter > outsBefore;
}

export function formatPitchingChangeDescription(raw) {
  const text = (raw || '').trim();
  if (!text) return '';
  const body = /^pitching change:\s*/i.test(text)
    ? text
    : `Pitching Change: ${text}`;
  return normalizeDescription(body);
}

/** Build summary copy; outsLabel is set only when an out was recorded on the play. */
export function buildPlayDescription(description, outs, outOccurred) {
  const text = normalizeDescription(description);
  const outsLabel = outOccurred ? formatOutsLabel(outs) : null;
  return { description: text, outsLabel };
}

export function buildSummaryItems(allPlays, gameData) {
  const items = [];

  for (const play of allPlays) {
    const events = play.playEvents || [];
    events.forEach((ev, eventIdx) => {
      const eventType = ev.details?.eventType;
      if (!eventType) return;

      if (eventType === 'pitching_substitution') {
        const rawDescription = ev.details?.description || ev.details?.call?.description || '';
        items.push({
          kind: 'pitching_change',
          key: `pitching-${play.about?.atBatIndex}-${eventIdx}`,
          eventType,
          title: 'Pitching Substitution',
          description: formatPitchingChangeDescription(rawDescription),
          about: play.about,
          sortTime: ev.startTime || play.about?.startTime || null,
        });
        return;
      }

      if (!SUMMARY_ACTION_TYPES.has(eventType)) return;

      const rawDescription = ev.details?.description || ev.details?.call?.description || '';
      const outOccurred = playEventRecordedOut(play, eventIdx, ev);
      const { description, outsLabel } = buildPlayDescription(
        rawDescription,
        ev.count?.outs ?? play.count?.outs,
        outOccurred,
      );
      const sortTime = ev.startTime || play.about?.startTime || null;
      items.push({
        kind: 'action',
        key: `action-${play.about?.atBatIndex}-${eventIdx}`,
        play,
        eventType,
        description,
        outsLabel,
        about: play.about,
        batterId: play.matchup?.batter?.id,
        awayScore: ev.details?.awayScore,
        homeScore: ev.details?.homeScore,
        isScoring: isScoringDescription(description),
        sortTime,
      });
    });

    if (play.about?.isComplete && play.result?.event) {
      const { description, outsLabel } = buildPlayDescription(
        play.result?.description,
        play.count?.outs,
        playRecordedOut(play),
      );
      items.push({
        kind: 'atbat',
        key: `atbat-${play.about?.atBatIndex}`,
        play,
        eventType: play.result?.eventType,
        description,
        outsLabel,
        about: play.about,
        batterId: play.matchup?.batter?.id,
        awayScore: play.result?.awayScore,
        homeScore: play.result?.homeScore,
        isScoring: Boolean(play.about?.isScoringPlay),
        sortTime: play.about?.endTime || play.about?.startTime || null,
      });
    }
  }

  const statusChanges = buildStatusChangeItems(allPlays, gameData?.alerts, gameData?.venue);
  const merged = [...items, ...statusChanges];
  merged.sort((a, b) => {
    const ta = a.sortTime ? new Date(a.sortTime).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.sortTime ? new Date(b.sortTime).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });
  return merged;
}

export function filterSummaryItems(items, filter) {
  if (filter === 'scoring') {
    return items.filter((item) => item.isScoring);
  }
  return items;
}

export function groupSummaryByInning(items, ordinals) {
  return items.reduce((acc, item) => {
    const half = item.about?.halfInning === 'top' ? 'Top' : 'Bottom';
    const ord = ordinals[item.about?.inning] || item.about?.inning;
    const key = `${half} ${ord}`;
    const group = acc.find((g) => g.key === key);
    if (group) group.items.push(item);
    else acc.push({ key, items: [item] });
    return acc;
  }, []);
}

/** Same inning groups as groupSummaryByInning, but newest inning half and plays first. */
export function groupSummaryByInningReversed(items, ordinals) {
  return groupSummaryByInning(items, ordinals)
    .reverse()
    .map((group) => ({ ...group, items: [...group.items].reverse() }));
}

export function formatUpdatedScore(awayAbbr, homeAbbr, awayScore, homeScore) {
  if (awayScore == null || homeScore == null) return null;
  return `${awayAbbr} ${awayScore}, ${homeAbbr} ${homeScore}`;
}
