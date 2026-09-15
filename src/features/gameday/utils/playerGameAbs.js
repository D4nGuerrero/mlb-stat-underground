const INNING_ORDINALS = [
  '',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
  '13th',
  '14th',
  '15th',
  '16th',
  '17th',
  '18th',
];

const EVENT_PHRASES = {
  groundout: 'grounded out',
  grounded_into_double_play: 'grounded into a double play',
  grounded_into_dp: 'grounded into a double play',
  force_out: 'grounded into a force out',
  double_play: 'grounded into a double play',
  flyout: 'flied out',
  sac_fly: 'hit a sacrifice fly',
  sac_bunt: 'laid down a sacrifice bunt',
  lineout: 'lined out',
  pop_out: 'popped out',
  popup: 'popped out',
  strikeout: 'struck out',
  strikeout_double_play: 'struck out',
  walk: 'walked',
  intent_walk: 'walked intentionally',
  hit_by_pitch: 'was hit by a pitch',
  single: 'singled',
  double: 'doubled',
  triple: 'tripled',
  home_run: 'homered',
  field_error: 'reached on an error',
  fielders_choice: 'reached on a fielder\'s choice',
  fielders_choice_out: 'reached on a fielder\'s choice',
  catcher_interf: 'reached on catcher interference',
};

function playKey(play) {
  if (play?.about?.atBatIndex != null) return `ab-${play.about.atBatIndex}`;
  if (play?.atBatIndex != null) return `ab-${play.atBatIndex}`;
  return `${play?.about?.startTime ?? ''}:${play?.matchup?.batter?.id ?? ''}:${play?.result?.event ?? ''}`;
}

function isCompletePa(play) {
  return Boolean(play?.result?.event && play?.matchup?.batter?.id);
}

export function inningOrdinal(inning) {
  const num = Number(inning);
  if (!Number.isFinite(num) || num <= 0) return '';
  return INNING_ORDINALS[num] || `${num}th`;
}

export function formatPlayInning(play) {
  const ordinal = inningOrdinal(play?.about?.inning);
  if (!ordinal) return '—';
  const half = play?.about?.halfInning === 'top' ? 'Top' : 'Bot';
  return `${half} ${ordinal}`;
}

function normalizeEventKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[\s-]+/g, '_');
}

export function eventPhrase(play) {
  const type = normalizeEventKey(play?.result?.eventType);
  const label = normalizeEventKey(play?.result?.event);
  if (EVENT_PHRASES[type]) return EVENT_PHRASES[type];
  if (EVENT_PHRASES[label]) return EVENT_PHRASES[label];
  const raw = String(play?.result?.event ?? '').trim();
  if (!raw) return 'in progress';
  return raw.toLowerCase();
}

export function collectPlayerGameAbs(allPlays = [], playerId, currentPlay = null) {
  const id = Number(playerId);
  const batting = [];
  const pitching = [];
  const seenBatting = new Set();
  const seenPitching = new Set();

  if (!id) {
    return { batting, pitching, currentBatting: null, currentPitching: null };
  }

  const pushUnique = (list, seen, play) => {
    const key = playKey(play);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(play);
  };

  for (const play of allPlays) {
    if (!isCompletePa(play)) continue;
    if (Number(play.matchup?.batter?.id) === id) pushUnique(batting, seenBatting, play);
    if (Number(play.matchup?.pitcher?.id) === id) pushUnique(pitching, seenPitching, play);
  }

  const currentIncomplete = currentPlay && !currentPlay?.about?.isComplete && currentPlay?.matchup?.batter?.id;
  const currentBatting = currentIncomplete && Number(currentPlay.matchup?.batter?.id) === id
    ? currentPlay
    : null;
  const currentPitching = currentIncomplete && Number(currentPlay.matchup?.pitcher?.id) === id
    ? currentPlay
    : null;

  return { batting, pitching, currentBatting, currentPitching };
}

export function formatAbsRecap(plays, playerName) {
  const name = String(playerName || 'This player').trim();
  if (!plays?.length) return `${name} has no completed plate appearances yet.`;

  const bits = plays.map((play) => {
    const phrase = eventPhrase(play);
    const ordinal = inningOrdinal(play?.about?.inning) || 'that inning';
    return `${phrase} in the ${ordinal}`;
  });

  if (bits.length === 1) return `${name} ${bits[0]}.`;
  if (bits.length === 2) return `${name} ${bits[0]} and ${bits[1]}.`;
  return `${name} ${bits.slice(0, -1).join(', ')}, and ${bits.at(-1)}.`;
}

export function formatCurrentPaBlurb(play) {
  if (!play) return 'At bat';
  const balls = play.count?.balls ?? 0;
  const strikes = play.count?.strikes ?? 0;
  const outs = play.count?.outs ?? play.about?.outs ?? 0;
  return `${balls}-${strikes} count, ${outs} out${outs === 1 ? '' : 's'}`;
}

export function formatGameBattingLine(stat) {
  if (!stat) return '0-0';
  const parts = [`${stat.hits ?? 0}-${stat.atBats ?? 0}`];
  if (Number(stat.runs) > 0) parts.push(`${stat.runs} R`);
  if (Number(stat.rbi) > 0) parts.push(`${stat.rbi} RBI`);
  if (Number(stat.homeRuns) > 0) parts.push(`${stat.homeRuns} HR`);
  if (Number(stat.baseOnBalls) > 0) parts.push(`${stat.baseOnBalls} BB`);
  if (Number(stat.strikeOuts) > 0) parts.push(`${stat.strikeOuts} K`);
  return parts.join(', ');
}

export function formatGamePitchingLine(stat) {
  if (!stat) return null;
  const parts = [];
  if (stat.inningsPitched != null) parts.push(`${stat.inningsPitched} IP`);
  if (stat.hits != null) parts.push(`${stat.hits} H`);
  if (stat.earnedRuns != null) parts.push(`${stat.earnedRuns} ER`);
  if (stat.baseOnBalls != null) parts.push(`${stat.baseOnBalls} BB`);
  if (stat.strikeOuts != null) parts.push(`${stat.strikeOuts} K`);
  return parts.length ? parts.join(', ') : null;
}
