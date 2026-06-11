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

export function getSummaryPlayIconKind(eventType) {
  if (SHOE_ICON_TYPES.has(eventType)) return 'shoe';
  if (PITCH_ICON_TYPES.has(eventType)) return 'pitch';
  return null;
}

export function isScoringDescription(description) {
  return /\bscores?\b/i.test(description || '');
}

export function buildSummaryItems(allPlays) {
  const items = [];

  for (const play of allPlays) {
    const events = play.playEvents || [];
    events.forEach((ev, eventIdx) => {
      const eventType = ev.details?.eventType;
      if (!eventType || !SUMMARY_ACTION_TYPES.has(eventType)) return;

      const description = ev.details?.description || ev.details?.call?.description || '';
      items.push({
        kind: 'action',
        key: `action-${play.about?.atBatIndex}-${eventIdx}`,
        play,
        eventType,
        description,
        about: play.about,
        batterId: play.matchup?.batter?.id,
        awayScore: ev.details?.awayScore,
        homeScore: ev.details?.homeScore,
        isScoring: isScoringDescription(description),
      });
    });

    if (play.about?.isComplete && play.result?.event) {
      items.push({
        kind: 'atbat',
        key: `atbat-${play.about?.atBatIndex}`,
        play,
        eventType: play.result?.eventType,
        description: play.result?.description,
        about: play.about,
        batterId: play.matchup?.batter?.id,
        awayScore: play.result?.awayScore,
        homeScore: play.result?.homeScore,
        isScoring: Boolean(play.about?.isScoringPlay),
      });
    }
  }

  return items;
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

export function formatUpdatedScore(awayAbbr, homeAbbr, awayScore, homeScore) {
  if (awayScore == null || homeScore == null) return null;
  return `${awayAbbr} ${awayScore}, ${homeAbbr} ${homeScore}`;
}