function collectChallengeText(value, depth = 0, out = []) {
  if (value == null || depth > 4) return out;
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
    return out;
  }
  if (typeof value !== 'object') return out;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('__')) continue;
    out.push(key);
    collectChallengeText(child, depth + 1, out);
  }
  return out;
}

function collectChallengeValues(value, depth = 0, out = []) {
  if (value == null || depth > 4) return out;
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
    return out;
  }
  if (typeof value !== 'object') return out;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('__')) continue;
    collectChallengeValues(child, depth + 1, out);
  }
  return out;
}

export function getAbsChallengeOutcome(event) {
  if (event?.reviewDetails?.isOverturned === true) return 'Overturned';
  if (event?.reviewDetails?.isOverturned === false && isAbsChallengeSignal(event)) return 'Upheld';

  const haystack = collectChallengeText(event).join(' ').toLowerCase();
  if (/\b(overturn(?:ed)?|reversed|changed|successful)\b/.test(haystack)) return 'Overturned';
  if (/\b(upheld|confirmed|stands|unsuccessful)\b/.test(haystack)) return 'Upheld';
  return null;
}

function isAbsChallengeSignal(event) {
  if (event?.details?.hasReview === true) return true;
  if (
    event?.reviewDetails &&
    (
      typeof event.reviewDetails.isOverturned === 'boolean' ||
      event.reviewDetails.inProgress === true ||
      event.reviewDetails.reviewType ||
      event.reviewDetails.challengeTeamId
    )
  ) {
    return true;
  }

  const haystack = collectChallengeValues(event).join(' ').toLowerCase();
  return /(abs|automated\s*ball|ball.?strike|challenge|challenged|under review|reviewing)/i.test(haystack);
}

export function getAbsChallengePitchLabel(event) {
  const outcome = getAbsChallengeOutcome(event);
  if (outcome) return outcome;
  return isAbsChallengeSignal(event) ? 'Under Review' : null;
}

function compactTimerLabel(eventType = '', text = '') {
  const haystack = `${eventType} ${text}`.toLowerCase();
  if (
    /batter/.test(haystack) &&
    /timer|clock|violation/.test(haystack)
  ) {
    return 'Batter Timer Violation';
  }
  if (
    /pitcher/.test(haystack) &&
    /timer|clock|violation/.test(haystack)
  ) {
    return 'Pitcher Timer Violation';
  }
  if (/timer|clock/.test(haystack)) return 'Timer Violation';
  return null;
}

export function getAutomaticPitchTimerCall(event) {
  const eventType = String(event?.details?.eventType || event?.type || '').trim();
  const description = String(event?.details?.description || event?.details?.call?.description || '').trim();
  const violationType = String(event?.details?.violation?.type || '').trim();
  const violationDesc = String(event?.details?.violation?.description || '').trim();
  const code = String(event?.details?.code || event?.details?.call?.code || '').trim();
  const haystack = `${eventType} ${description} ${violationType} ${violationDesc}`.toLowerCase();
  const isPitchTimer =
    ((code === 'VP' || code === 'VS') && (event?.details?.isBall === true || event?.details?.isStrike === true)) ||
    /pitcher_pitch_timer|batter_pitch_timer|pitch_timer/.test(haystack) ||
    /automatic strike|auto strike|automatic ball|auto ball/.test(haystack) ||
    /timer violation|pitch clock violation/.test(haystack);

  if (!isPitchTimer) return null;

  const detail = compactTimerLabel(eventType, `${description} ${violationType} ${violationDesc}`)
    ?? (event?.details?.isStrike ? 'Batter Timer Violation'
      : event?.details?.isBall ? 'Pitcher Timer Violation'
        : 'Timer Violation');

  if (
    event?.details?.isStrike === true ||
    /batter_pitch_timer/.test(haystack) ||
    /automatic strike|auto strike/.test(haystack)
  ) {
    return { label: 'Automatic Strike', detail };
  }

  if (
    event?.details?.isBall === true ||
    /pitcher_pitch_timer/.test(haystack) ||
    /automatic ball|auto ball/.test(haystack)
  ) {
    return { label: 'Automatic Ball', detail };
  }

  if (/batter/.test(haystack)) {
    return {
      label: 'Automatic Strike',
      detail: detail === 'Timer Violation' ? 'Batter Timer Violation' : detail,
    };
  }
  if (/pitcher/.test(haystack)) {
    return {
      label: 'Automatic Ball',
      detail: detail === 'Timer Violation' ? 'Pitcher Timer Violation' : detail,
    };
  }

  return null;
}

/** Thrown pitches plus pitch-timer automatic balls/strikes in an at-bat. */
export function isAtBatPitchSequenceEvent(event) {
  return Boolean(event?.isPitch || getAutomaticPitchTimerCall(event));
}

export function formatAutomaticPitchTimerCall(event, fallback = '') {
  const automaticCall = getAutomaticPitchTimerCall(event);
  if (!automaticCall) return fallback || '';
  return `${automaticCall.label} (${automaticCall.detail})`;
}

export function formatPitchDescriptionWithAbs(description, event) {
  const automaticCall = formatAutomaticPitchTimerCall(event);
  if (automaticCall) return automaticCall;

  const text = description || 'Pitch';
  if (/(?:\s[-–]\s|\()(overturned|upheld|under review)\)?$/i.test(text)) return text;
  const label = getAbsChallengePitchLabel(event);
  return label ? `${text} - ${label}` : text;
}

export function getAbsChallengeOutcomeForPitch(playEvents = [], pitchEventIndex = -1) {
  if (pitchEventIndex < 0) return null;
  for (let idx = pitchEventIndex; idx < playEvents.length; idx += 1) {
    if (idx > pitchEventIndex && playEvents[idx]?.isPitch) break;
    const outcome = getAbsChallengeOutcome(playEvents[idx]);
    if (outcome) return outcome;
  }
  return getPlayLevelAbsChallengeLabelForPitch(playEvents, pitchEventIndex);
}

function getPlayContext(playEvents = [], pitchEventIndex = -1) {
  if (pitchEventIndex < 0) return null;
  return playEvents[pitchEventIndex]?.__playContext ?? null;
}

function getTerminalPitchEventIndex(playEvents = []) {
  for (let idx = playEvents.length - 1; idx >= 0; idx -= 1) {
    if (playEvents[idx]?.isPitch) return idx;
  }
  return -1;
}

export function getAbsChallengeOutcomeFromPlayResult(play) {
  const text = String(play?.result?.description || play?.result?.event || '').toLowerCase();
  if (!/(challenged|challenge|pitch result|call on the field)/.test(text)) return null;
  if (/\b(overturn(?:ed)?|reversed|changed|successful)\b/.test(text)) return 'Overturned';
  if (/\b(upheld|confirmed|stands|unsuccessful)\b/.test(text)) return 'Upheld';
  return null;
}

export function getPlayLevelAbsChallengeLabelForPitch(playEvents = [], pitchEventIndex = -1) {
  const play = getPlayContext(playEvents, pitchEventIndex);
  if (!play) return null;
  const terminalPitchIdx = getTerminalPitchEventIndex(playEvents);
  if (pitchEventIndex !== terminalPitchIdx) return null;
  return getAbsChallengeOutcomeFromPlayResult(play);
}

export function getAbsChallengePitchLabelForPitch(playEvents = [], pitchEventIndex = -1) {
  if (pitchEventIndex < 0) return null;
  for (let idx = pitchEventIndex; idx < playEvents.length; idx += 1) {
    if (idx > pitchEventIndex && playEvents[idx]?.isPitch) break;
    const label = getAbsChallengePitchLabel(playEvents[idx]);
    if (label) return label;
  }
  return getPlayLevelAbsChallengeLabelForPitch(playEvents, pitchEventIndex);
}

export function formatPitchDescriptionWithAbsContext(description, event, playEvents, pitchEventIndex) {
  const automaticCall = formatAutomaticPitchTimerCall(event);
  if (automaticCall) return automaticCall;

  const text = description || 'Pitch';
  if (/(?:\s[-–]\s|\()(overturned|upheld|under review)\)?$/i.test(text)) return text;
  const label =
    getAbsChallengePitchLabel(event) ||
    getAbsChallengePitchLabelForPitch(playEvents, pitchEventIndex);
  return label ? `${text} - ${label}` : text;
}

export function getAbsChallengeOutcomeFromPlay(play) {
  const events = play?.playEvents ?? [];
  for (let idx = events.length - 1; idx >= 0; idx -= 1) {
    const outcome = getAbsChallengeOutcome(events[idx]);
    if (outcome) return outcome;
  }
  return getAbsChallengeOutcomeFromPlayResult(play) || getAbsChallengeOutcome(play);
}

export function formatPlayDescriptionWithAbs(description, playOrEvent) {
  const text = description || '';
  if (!text || /\((overturned|upheld)\)$/i.test(text)) return text;
  const outcome =
    getAbsChallengeOutcome(playOrEvent) ||
    getAbsChallengeOutcomeFromPlay(playOrEvent);
  return outcome ? `${text} (${outcome})` : text;
}
