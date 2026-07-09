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

  for (const child of Object.values(value)) {
    collectChallengeValues(child, depth + 1, out);
  }
  return out;
}

export function getAbsChallengeOutcome(event) {
  const haystack = collectChallengeText(event).join(' ').toLowerCase();
  if (/\b(upheld|confirmed|stands|unsuccessful)\b/.test(haystack)) return 'Upheld';
  if (/\b(overturn|overturned|reversed|changed|successful)\b/.test(haystack)) return 'Overturned';
  if (event?.reviewDetails?.isOverturned === true) return 'Overturned';
  return null;
}

function isAbsChallengeSignal(event) {
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
  if (/timer violation.*batter|batter.*timer violation|pitch clock violation.*batter|batter.*pitch clock violation|automatic strike|auto strike|batter[_\s-]?timer[_\s-]?violation/.test(haystack)) {
    return 'Batter Timer Violation';
  }
  if (/timer violation.*pitch|pitch(?:er)?.*timer violation|pitch clock violation.*pitch|pitch(?:er)?.*pitch clock violation|automatic ball|auto ball|pitch(?:er)?[_\s-]?timer[_\s-]?violation/.test(haystack)) {
    return 'Pitcher Timer Violation';
  }
  if (/timer|clock/.test(haystack)) return 'Timer Violation';
  return null;
}

export function getAutomaticPitchTimerCall(event) {
  const eventType = String(event?.details?.eventType || event?.type || '').trim();
  const description = String(event?.details?.description || event?.details?.call?.description || '').trim();
  const haystack = `${eventType} ${description}`.toLowerCase();

  if (
    /automatic strike|auto strike|timer violation.*batter|batter.*timer violation|pitch clock violation.*batter|batter.*pitch clock violation|batter[_\s-]?timer[_\s-]?violation/.test(haystack)
  ) {
    return {
      label: 'Automatic Strike',
      detail: compactTimerLabel(eventType, description) ?? 'Batter Timer Violation',
    };
  }

  if (
    /automatic ball|auto ball|timer violation.*pitch|pitch(?:er)?.*timer violation|pitch clock violation.*pitch|pitch(?:er)?.*pitch clock violation|pitch(?:er)?[_\s-]?timer[_\s-]?violation/.test(haystack)
  ) {
    return {
      label: 'Automatic Ball',
      detail: compactTimerLabel(eventType, description) ?? 'Pitcher Timer Violation',
    };
  }

  return null;
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
  if (/\((overturned|upheld|under review)\)$/i.test(text)) return text;
  const label = getAbsChallengePitchLabel(event);
  return label ? `${text} (${label})` : text;
}

export function getAbsChallengeOutcomeForPitch(playEvents = [], pitchEventIndex = -1) {
  if (pitchEventIndex < 0) return null;
  for (let idx = pitchEventIndex; idx < playEvents.length; idx += 1) {
    if (idx > pitchEventIndex && playEvents[idx]?.isPitch) break;
    const outcome = getAbsChallengeOutcome(playEvents[idx]);
    if (outcome) return outcome;
  }
  return null;
}

export function getAbsChallengePitchLabelForPitch(playEvents = [], pitchEventIndex = -1) {
  if (pitchEventIndex < 0) return null;
  for (let idx = pitchEventIndex; idx < playEvents.length; idx += 1) {
    if (idx > pitchEventIndex && playEvents[idx]?.isPitch) break;
    const label = getAbsChallengePitchLabel(playEvents[idx]);
    if (label) return label;
  }
  return null;
}

export function formatPitchDescriptionWithAbsContext(description, event, playEvents, pitchEventIndex) {
  const automaticCall = formatAutomaticPitchTimerCall(event);
  if (automaticCall) return automaticCall;

  const text = description || 'Pitch';
  if (/\((overturned|upheld|under review)\)$/i.test(text)) return text;
  const label =
    getAbsChallengePitchLabel(event) ||
    getAbsChallengePitchLabelForPitch(playEvents, pitchEventIndex);
  return label ? `${text} (${label})` : text;
}

export function getAbsChallengeOutcomeFromPlay(play) {
  const events = play?.playEvents ?? [];
  for (let idx = events.length - 1; idx >= 0; idx -= 1) {
    const outcome = getAbsChallengeOutcome(events[idx]);
    if (outcome) return outcome;
  }
  return getAbsChallengeOutcome(play);
}

export function formatPlayDescriptionWithAbs(description, playOrEvent) {
  const text = description || '';
  if (!text || /\((overturned|upheld)\)$/i.test(text)) return text;
  const outcome =
    getAbsChallengeOutcome(playOrEvent) ||
    getAbsChallengeOutcomeFromPlay(playOrEvent);
  return outcome ? `${text} (${outcome})` : text;
}
