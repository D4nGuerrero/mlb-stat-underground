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

export function getAbsChallengeOutcome(event) {
  const haystack = collectChallengeText(event).join(' ').toLowerCase();
  if (!/(abs|automated\s*ball|ball.?strike|challenge|challenged|review)/i.test(haystack)) return null;
  if (/overturn|overturned|reversed|changed|successful/.test(haystack)) return 'Overturned';
  if (/upheld|confirmed|stands|unsuccessful/.test(haystack)) return 'Upheld';
  return null;
}

export function formatPitchDescriptionWithAbs(description, event) {
  const text = description || 'Pitch';
  if (/\((overturned|upheld)\)$/i.test(text)) return text;
  const outcome = getAbsChallengeOutcome(event);
  return outcome ? `${text} (${outcome})` : text;
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

export function formatPitchDescriptionWithAbsContext(description, event, playEvents, pitchEventIndex) {
  const text = description || 'Pitch';
  if (/\((overturned|upheld)\)$/i.test(text)) return text;
  const outcome =
    getAbsChallengeOutcome(event) ||
    getAbsChallengeOutcomeForPitch(playEvents, pitchEventIndex);
  return outcome ? `${text} (${outcome})` : text;
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
