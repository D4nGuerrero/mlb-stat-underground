import {
  buildFirstPitchItem,
  buildPlayDescription,
  playRecordedOut,
  formatPitchingChangeDescription,
  formatRunnerPlacedDescription,
  formatSubstitutionDescription,
  formatGameAdvisoryDescription,
  isNotableGameAdvisory,
  SUMMARY_ACTION_TYPES,
} from './gamePlaySummary';
import {
  formatRunnersSituationLabel,
  getBasesAfterPlay,
  getBasesAtPlayIndex,
  toIndicatorBases,
} from './playSituation';
import { compactPlayerName } from './mlbHelpers';
import {
  formatAutomaticPitchTimerCall,
  formatPitchDescriptionWithAbsContext,
} from './absChallenge';

const LIVE_EXTRA_EVENT_TYPES = new Set([
  'mound_visit',
  'offensive_substitution',
  'defensive_substitution',
  'defensive_switch',
  'pitching_substitution',
  'game_advisory',
]);

function isPickoffEventType(eventType) {
  return typeof eventType === 'string' && /^pickoff_/i.test(eventType);
}

export function getPitchResultKind(description, isInPlay = false) {
  const d = (description || '').toLowerCase();
  if (isInPlay || d.includes('in play')) return 'in_play';
  if (d.includes('ball') && !d.includes('in play')) return 'ball';
  return 'strike';
}

function lastName(person) {
  return compactPlayerName(person);
}

function inningMeta(about, ordinals) {
  const half = about?.halfInning === 'top' ? 'top' : 'bottom';
  const inning = about?.inning ?? 1;
  const halfLabel = half === 'top' ? 'Top' : 'Bottom';
  const ord = ordinals[inning] || inning;
  return { inning, half, inningKey: `${halfLabel} ${ord}` };
}

function playMovedRunners(play) {
  return (play.runners ?? []).some((r) => {
    const m = r.movement;
    if (!m) return false;
    if (m.isOut) return true;
    if (m.end === 'score' || m.end === '4B') return true;
    if (m.end === '1B' || m.end === '2B' || m.end === '3B') {
      return m.start !== m.end;
    }
    return false;
  });
}

function baseRunnerId(runner) {
  return runner?.id ? String(runner.id) : '';
}

function basesSignature(bases) {
  return [
    baseRunnerId(bases.first),
    baseRunnerId(bases.second),
    baseRunnerId(bases.third),
  ].join('|');
}

function basesChanged(before, after) {
  return basesSignature(before) !== basesSignature(after);
}

function pushRunnersRow(
  rows,
  play,
  keySuffix,
  meta,
  sortTime,
  allPlays,
  maxPlayIndex = null,
  { outsAfter = null } = {},
) {
  if (maxPlayIndex == null && !playMovedRunners(play)) return;

  // MLB At Bat does not show a follow-up base-state row for the inning-ending
  // PA. Keep mid-PA runner updates, but suppress states once the inning is over.
  const resolvedOutsAfter = Number(outsAfter ?? (maxPlayIndex == null ? play.count?.outs : null));
  if (Number.isFinite(resolvedOutsAfter) && resolvedOutsAfter >= 3) return;

  const bases = maxPlayIndex != null
    ? getBasesAtPlayIndex(play, allPlays, maxPlayIndex)
    : getBasesAfterPlay(play, allPlays);
  const beforeBases = maxPlayIndex != null
    ? getBasesAtPlayIndex(play, allPlays, maxPlayIndex - 1)
    : getBasesAtPlayIndex(play, allPlays, -1);

  if (!basesChanged(beforeBases, bases)) return;

  const label = formatRunnersSituationLabel(bases) || 'Bases Empty';
  rows.push({
    kind: 'runners',
    key: `runners-${keySuffix}`,
    bases: toIndicatorBases(bases),
    label,
    ...meta,
    sortTime,
  });
}

function scoringTeamSide(play) {
  return play.about?.halfInning === 'top' ? 'away' : 'home';
}

export function dueUpFromOffense(offense) {
  return [offense?.batter, offense?.onDeck, offense?.inHole]
    .filter((p) => p?.id)
    .map((p) => ({ id: p.id, name: p.fullName || p.name || lastName(p), fullName: p.fullName }));
}

function isPickoffAttempt(ev) {
  if (ev?.type === 'pickoff' && !ev?.details?.eventType) return true;
  const desc = (ev?.details?.description || '').trim();
  return /^pickoff attempt/i.test(desc);
}

function pushPickoffEventRow(rows, play, ev, eventIdx, ordinals, allPlays, { includeAttempts = true } = {}) {
  const eventType = ev.details?.eventType;
  const meta = inningMeta(play.about, ordinals);
  const sortTime = ev.startTime || ev.endTime || play.about?.startTime || null;

  if (isPickoffAttempt(ev)) {
    if (!includeAttempts) return true;
    rows.push({
      kind: 'pickoff_attempt',
      key: `pickoff-attempt-${play.about?.atBatIndex}-${eventIdx}`,
      description: ev.details?.description || 'Pickoff Attempt',
      ...meta,
      sortTime,
    });
    return true;
  }

  if (!isPickoffEventType(eventType)) return false;

  const raw = ev.details?.description || ev.details?.call?.description || 'Pickoff';
  const { description } = buildPlayDescription(
    raw,
    ev.count?.outs ?? play.count?.outs,
    false,
  );
  rows.push({
    kind: 'pickoff',
    key: `pickoff-${play.about?.atBatIndex}-${eventIdx}`,
    description,
    ...meta,
    sortTime,
  });
  pushRunnersRow(
    rows,
    play,
    `${play.about?.atBatIndex}-${eventIdx}`,
    meta,
    sortTime,
    allPlays,
    ev.index ?? eventIdx,
    { outsAfter: ev.count?.outs },
  );
  return true;
}

function pushPlayEventRows(rows, play, ev, eventIdx, ordinals) {
  const eventType = ev.details?.eventType;
  if (!eventType || !LIVE_EXTRA_EVENT_TYPES.has(eventType)) return;

  const meta = inningMeta(play.about, ordinals);
  const sortTime = ev.startTime || play.about?.startTime || null;

  if (eventType === 'mound_visit') {
    rows.push({
      kind: 'mound_visit',
      key: `mound-${play.about?.atBatIndex}-${eventIdx}`,
      description: ev.details?.description || 'Mound Visit',
      ...meta,
      sortTime,
    });
    return;
  }

  if (eventType === 'offensive_substitution') {
    rows.push({
      kind: 'offensive_substitution',
      key: `offensive-sub-${play.about?.atBatIndex}-${eventIdx}`,
      description: formatSubstitutionDescription(
        ev.details?.description || ev.details?.call?.description || '',
        'Offensive Substitution',
      ),
      ...meta,
      sortTime,
    });
    return;
  }

  if (eventType === 'defensive_substitution' || eventType === 'defensive_switch') {
    const title = eventType === 'defensive_switch' ? 'Defensive Switch' : 'Defensive Substitution';
    rows.push({
      kind: 'defensive_substitution',
      key: `defensive-sub-${play.about?.atBatIndex}-${eventIdx}`,
      description: formatSubstitutionDescription(
        ev.details?.description || ev.details?.call?.description || '',
        title,
      ),
      ...meta,
      sortTime,
    });
    return;
  }

  if (eventType === 'pitching_substitution') {
    rows.push({
      kind: 'pitching_change',
      key: `pitching-${play.about?.atBatIndex}-${eventIdx}`,
      description: formatPitchingChangeDescription(
        ev.details?.description || ev.details?.call?.description || '',
      ),
      ...meta,
      sortTime,
    });
    return;
  }

  if (eventType === 'game_advisory') {
    const raw = ev.details?.description || ev.details?.event || '';
    if (!isNotableGameAdvisory(raw)) return;
    rows.push({
      kind: 'status_change',
      key: `status-${play.about?.atBatIndex}-${eventIdx}`,
      eventType,
      title: 'Game Advisory',
      description: formatGameAdvisoryDescription(raw),
      ...meta,
      sortTime,
    });
  }
}

function pushActionRow(rows, play, ev, eventIdx, ordinals, allPlays) {
  const eventType = ev.details?.eventType;
  if (!eventType || !SUMMARY_ACTION_TYPES.has(eventType)) return;
  if (isPickoffEventType(eventType)) return;

  const raw = ev.details?.description || ev.details?.call?.description || '';
  const { description, outsLabel } = eventType === 'runner_placed'
    ? { description: formatRunnerPlacedDescription(ev, play), outsLabel: null }
    : buildPlayDescription(
        raw,
        ev.count?.outs ?? play.count?.outs,
        false,
      );
  const meta = inningMeta(play.about, ordinals);
  const sortTime = ev.startTime || play.about?.startTime || null;
  rows.push({
    kind: 'action',
    key: `action-${play.about?.atBatIndex}-${eventIdx}`,
    play,
    eventType,
    description,
    outsLabel,
    batterId: play.matchup?.batter?.id,
    ...meta,
    sortTime,
  });
  if (eventType === 'runner_placed') return;
  pushRunnersRow(
    rows,
    play,
    `${play.about?.atBatIndex}-${eventIdx}`,
    meta,
    sortTime,
    allPlays,
    ev.index ?? eventIdx,
    { outsAfter: ev.count?.outs },
  );
}

function pushActiveAtBatEventRows(rows, play, ordinals, allPlays, { includePickoffAttempts = true } = {}) {
  const meta = inningMeta(play.about, ordinals);
  let pitchNumber = 0;
  const playEventsWithContext = (play.playEvents ?? []).map((event) => ({
    ...event,
    __playContext: play,
  }));

  playEventsWithContext.forEach((ev, eventIdx) => {
    pushPlayEventRows(rows, play, ev, eventIdx, ordinals);

    if (pushPickoffEventRow(rows, play, ev, eventIdx, ordinals, allPlays, { includeAttempts: includePickoffAttempts })) {
      return;
    }

    pushActionRow(rows, play, ev, eventIdx, ordinals, allPlays);

    const automaticPitchCall = formatAutomaticPitchTimerCall(ev);
    if (automaticPitchCall) {
      rows.push({
        kind: 'automatic_pitch',
        key: `automatic-pitch-${play.about?.atBatIndex}-${eventIdx}`,
        description: automaticPitchCall,
        balls: ev.count?.balls,
        strikes: ev.count?.strikes,
        ...meta,
        sortTime: ev.endTime || ev.startTime || play.about?.startTime || new Date().toISOString(),
      });
      return;
    }

    if (ev.details?.eventType === 'batter_timeout') {
      rows.push({
        kind: 'batter_timeout',
        key: `batter-timeout-${play.about?.atBatIndex}-${eventIdx}`,
        description: ev.details?.description || 'Batter Timeout',
        ...meta,
        sortTime: ev.endTime || ev.startTime || play.about?.startTime || new Date().toISOString(),
      });
      return;
    }

    if (!ev.isPitch) return;

    pitchNumber += 1;
    const description = formatPitchDescriptionWithAbsContext(
      ev.details?.description || ev.details?.call?.description || 'Pitch',
      ev,
      playEventsWithContext,
      eventIdx,
    );
    rows.push({
      kind: 'live_pitch',
      key: `live-pitch-${play.about?.atBatIndex}-${eventIdx}`,
      pitchNumber,
      description,
      pitchType: ev.details?.type?.description || null,
      mph: ev.pitchData?.startSpeed ? parseFloat(ev.pitchData.startSpeed) : null,
      isInPlay: Boolean(ev.details?.isInPlay),
      balls: ev.count?.balls,
      strikes: ev.count?.strikes,
      ...meta,
      sortTime: ev.endTime || ev.startTime || play.about?.startTime || new Date().toISOString(),
    });
  });
}

function pushCompletedPlayRows(rows, play, ordinals, allPlays) {
  if (!play.about?.isComplete || !play.result?.event) return;

  const outOccurred = playRecordedOut(play);
  const { description, outsLabel } = buildPlayDescription(
    play.result?.description,
    play.count?.outs,
    outOccurred,
  );
  const meta = inningMeta(play.about, ordinals);
  const sortTime = play.about?.endTime || play.about?.startTime || null;

  rows.push({
    kind: 'play',
    key: `atbat-${play.about?.atBatIndex}`,
    play,
    eventType: play.result?.eventType,
    description,
    outsLabel,
    batterId: play.matchup?.batter?.id,
    isScoring: Boolean(play.about?.isScoringPlay),
    ...meta,
    sortTime,
  });

  if (play.about?.isScoringPlay) {
    rows.push({
      kind: 'scoring_update',
      key: `score-${play.about?.atBatIndex}`,
      scoringSide: scoringTeamSide(play),
      awayScore: play.result?.awayScore,
      homeScore: play.result?.homeScore,
      ...meta,
      sortTime,
    });
  }

  pushRunnersRow(rows, play, play.about?.atBatIndex, meta, sortTime, allPlays);
}

/**
 * Build chronological live recent-plays rows (oldest → newest).
 * Caller reverses for display and pins first pitch at the bottom.
 */
export function buildLiveRecentPlaysRows({
  allPlays,
  currentPlay,
  isLive,
  ordinals,
}) {
  const rows = [];
  const currentAtBatIndex = currentPlay?.about?.atBatIndex;
  let activeAtBatEmitted = false;

  for (let playIdx = 0; playIdx < allPlays.length; playIdx += 1) {
    const play = allPlays[playIdx];
    const isCurrentAtBat =
      isLive &&
      currentAtBatIndex != null &&
      play.about?.atBatIndex === currentAtBatIndex;

    if (isCurrentAtBat) {
      // Keep the current at-bat pitch sequence visible through the final pitch
      // handoff. Once MLB advances currentPlay to the next at-bat, this play
      // falls through below and becomes the normal completed summary row.
      pushActiveAtBatEventRows(rows, play, ordinals, allPlays, {
        includePickoffAttempts: !play.about?.isComplete,
      });
      if (play.about?.isComplete) {
        pushCompletedPlayRows(rows, play, ordinals, allPlays);
      }
      activeAtBatEmitted = true;
      continue;
    }

    (play.playEvents ?? []).forEach((ev, eventIdx) => {
      pushPlayEventRows(rows, play, ev, eventIdx, ordinals);
      if (!pushPickoffEventRow(rows, play, ev, eventIdx, ordinals, allPlays, { includeAttempts: false })) {
        pushActionRow(rows, play, ev, eventIdx, ordinals, allPlays);
      }
    });

    pushCompletedPlayRows(rows, play, ordinals, allPlays);
  }

  if (isLive && currentPlay && !activeAtBatEmitted) {
    pushActiveAtBatEventRows(rows, currentPlay, ordinals, allPlays, {
      includePickoffAttempts: !currentPlay.about?.isComplete,
    });
    if (currentPlay.about?.isComplete) {
      pushCompletedPlayRows(rows, currentPlay, ordinals, allPlays);
    }
  }

  rows.sort((a, b) => {
    const ta = a.sortTime ? new Date(a.sortTime).getTime() : 0;
    const tb = b.sortTime ? new Date(b.sortTime).getTime() : 0;
    return ta - tb;
  });

  return rows;
}

export function buildLiveRecentPlaysFeed(props) {
  const chronological = buildLiveRecentPlaysRows(props);
  const firstPitch = {
    kind: 'first_pitch',
    key: 'first-pitch',
    ...buildFirstPitchItem(props.gameData),
  };
  const displayRows = [...chronological].reverse();
  return { displayRows, firstPitch };
}

export function groupLiveRecentRows(displayRows, { isLive, currentInning, currentHalf }) {
  const groups = [];
  let group = null;

  for (const row of displayRows) {
    if (row.kind === 'first_pitch') continue;
    const key = row.inningKey ?? 'Game';
    if (!group || group.key !== key) {
      group = {
        key,
        inning: row.inning,
        half: row.half,
        showHeader: !(
          isLive &&
          row.inning === currentInning &&
          row.half === currentHalf
        ),
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push(row);
  }

  return groups;
}
