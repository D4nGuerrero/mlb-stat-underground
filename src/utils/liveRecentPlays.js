import {
  buildFirstPitchItem,
  buildPlayDescription,
  playRecordedOut,
  formatPitchingChangeDescription,
  SUMMARY_ACTION_TYPES,
} from './gamePlaySummary';

const LIVE_EXTRA_EVENT_TYPES = new Set([
  'mound_visit',
  'offensive_substitution',
  'pitching_substitution',
  'game_advisory',
]);

function isPickoffEventType(eventType) {
  return typeof eventType === 'string' && /^pickoff_/i.test(eventType);
}

function formatOffensiveSubstitutionDescription(raw) {
  const text = (raw || '').trim();
  if (!text) return 'Offensive Substitution.';
  const body = /^offensive substitution:\s*/i.test(text)
    ? text
    : `Offensive Substitution: ${text}`;
  return body.endsWith('.') ? body : `${body}.`;
}

export function getPitchResultKind(description, isInPlay = false) {
  const d = (description || '').toLowerCase();
  if (isInPlay || d.includes('in play')) return 'in_play';
  if (d.includes('ball') && !d.includes('in play')) return 'ball';
  return 'strike';
}

const ROUTINE_STATUS = new Set(['pre-game', 'warmup', 'in progress', 'game in progress']);

function lastName(person) {
  return person?.fullName?.split(' ').slice(-1)[0] ?? person?.fullName ?? '—';
}

function inningMeta(about, ordinals) {
  const half = about?.halfInning === 'top' ? 'top' : 'bottom';
  const inning = about?.inning ?? 1;
  const halfLabel = half === 'top' ? 'Top' : 'Bottom';
  const ord = ordinals[inning] || inning;
  return { inning, half, inningKey: `${halfLabel} ${ord}` };
}

function parseStatusLabel(description) {
  const match = (description || '').match(/^status change\s*-\s*(.+)$/i);
  return (match?.[1] || description || '').trim();
}

function isNotableStatus(label) {
  const n = label.toLowerCase();
  if (!n || ROUTINE_STATUS.has(n)) return false;
  return /delay|rain|injur|suspend|postpon|cancel|eject|review|warning|curfew|lightning|weather|emergency/i.test(n);
}

function getBasesFromRunners(play) {
  const occupied = new Map();
  const runnerBase = new Map();

  for (const r of play.runners ?? []) {
    const m = r.movement;
    const runner = r.details?.runner;
    if (!m || !runner?.id) continue;

    const prev = runnerBase.get(runner.id);
    if (prev) occupied.delete(prev);

    if (m.isOut) {
      runnerBase.delete(runner.id);
      continue;
    }

    if (m.end === 'score' || m.end === '4B') {
      runnerBase.delete(runner.id);
      continue;
    }

    if (m.end === '1B' || m.end === '2B' || m.end === '3B') {
      occupied.set(m.end, runner);
      runnerBase.set(runner.id, m.end);
    }
  }

  return {
    first: occupied.get('1B') ?? null,
    second: occupied.get('2B') ?? null,
    third: occupied.get('3B') ?? null,
  };
}

function getBasesAfterPlay(play) {
  if (play.count?.outs === 3) {
    return { first: null, second: null, third: null };
  }

  if (play.about?.isComplete) {
    return {
      first: play.matchup?.postOnFirst ?? null,
      second: play.matchup?.postOnSecond ?? null,
      third: play.matchup?.postOnThird ?? null,
    };
  }

  return getBasesFromRunners(play);
}

function playMovedRunners(play) {
  return (play.runners ?? []).some((r) => {
    const m = r.movement;
    if (!m || m.isOut) return false;
    return m.end === '1B' || m.end === '2B' || m.end === '3B' || m.end === 'score';
  });
}

function pushRunnersRow(rows, play, keySuffix, meta, sortTime) {
  if (!playMovedRunners(play)) return;
  if (play.count?.outs === 3) return;
  const bases = getBasesAfterPlay(play);
  const label = formatRunnersLabel(bases);
  if (!label) return;
  rows.push({
    kind: 'runners',
    key: `runners-${keySuffix}`,
    bases: {
      onFirst: Boolean(bases.first),
      onSecond: Boolean(bases.second),
      onThird: Boolean(bases.third),
    },
    label,
    ...meta,
    sortTime,
  });
}

function formatRunnersLabel(bases) {
  const parts = [];
  if (bases.first) parts.push(`${lastName(bases.first)} on 1st`);
  if (bases.second) parts.push(`${lastName(bases.second)} at 2nd`);
  if (bases.third) parts.push(`${lastName(bases.third)} at 3rd`);
  return parts.join(', ');
}

function scoringTeamSide(play) {
  return play.about?.halfInning === 'top' ? 'away' : 'home';
}

function halfInningEnded(play, nextPlay) {
  if (!play.about?.isComplete || !nextPlay?.about) return false;
  const pi = play.about.inning;
  const ph = play.about.halfInning;
  const ni = nextPlay.about.inning;
  const nh = nextPlay.about.halfInning;
  return pi !== ni || ph !== nh;
}

function nextHalfInfo(afterPlay, ordinals) {
  const inning = afterPlay.about.inning;
  const half = afterPlay.about.halfInning;
  if (half === 'top') {
    const ord = ordinals[inning] || inning;
    return { inning, half: 'bottom', halfLabel: 'Bottom', ord, inningKey: `Bottom ${ord}` };
  }
  const nextInning = inning + 1;
  const ord = ordinals[nextInning] || nextInning;
  return { inning: nextInning, half: 'top', halfLabel: 'Top', ord, inningKey: `Top ${ord}` };
}

function getLineupBatters(boxscore, side) {
  const players = boxscore?.teams?.[side]?.players;
  if (!players) return [];
  return Object.values(players)
    .filter((p) => p.battingOrder)
    .sort((a, b) => parseInt(a.battingOrder, 10) - parseInt(b.battingOrder, 10));
}

function getDueUpBatters(boxscore, side, leadoffBatterId, fallbackBatter) {
  const lineup = getLineupBatters(boxscore, side);
  if (!lineup.length) {
    if (fallbackBatter?.id) {
      return [{ id: fallbackBatter.id, name: lastName(fallbackBatter) }];
    }
    return [];
  }

  let idx = leadoffBatterId
    ? lineup.findIndex((p) => p.person?.id === leadoffBatterId)
    : 0;
  if (idx < 0) idx = 0;

  const batters = [];
  for (let i = 0; i < 3; i += 1) {
    const p = lineup[(idx + i) % lineup.length];
    if (p?.person?.id) {
      batters.push({ id: p.person.id, name: lastName(p.person) });
    }
  }
  return batters;
}

function dueUpFromOffense(offense) {
  return [offense?.batter, offense?.onDeck, offense?.inHole]
    .filter((p) => p?.id)
    .map((p) => ({ id: p.id, name: lastName(p) }));
}

function pushDueUpRow(rows, { key, title, batters, meta, sortTime }) {
  if (!batters?.length) return;
  if (rows.some((r) => r.kind === 'due_up' && r.key === key)) return;
  rows.push({
    kind: 'due_up',
    key,
    title,
    batters,
    ...meta,
    sortTime,
  });
}

function halfKey(inning, half) {
  return `${inning}-${half}`;
}

function playHalfKey(play) {
  if (!play?.about) return null;
  const half = play.about.halfInning === 'top' ? 'top' : 'bottom';
  return halfKey(play.about.inning, half);
}

/** Halves that have at least one pitch thrown or a completed plate appearance. */
function getStartedHalfKeys(allPlays, currentPlay, isLive) {
  const started = new Set();

  const markIfStarted = (play) => {
    const key = playHalfKey(play);
    if (!key) return;
    const hasPitch = (play.playEvents ?? []).some((e) => e.isPitch);
    if (play.about?.isComplete || hasPitch) {
      started.add(key);
    }
  };

  for (const play of allPlays) markIfStarted(play);
  if (isLive && currentPlay) markIfStarted(currentPlay);

  return started;
}

function pruneDueUpRows(rows, { allPlays, currentPlay, isLive }) {
  if (!isLive) {
    return rows.filter((row) => row.kind !== 'due_up');
  }

  const started = getStartedHalfKeys(allPlays, currentPlay, isLive);

  return rows.filter((row) => {
    if (row.kind !== 'due_up') return true;
    return !started.has(halfKey(row.inning, row.half));
  });
}

function isPickoffAttempt(ev) {
  if (ev?.type === 'pickoff' && !ev?.details?.eventType) return true;
  const desc = (ev?.details?.description || '').trim();
  return /^pickoff attempt/i.test(desc);
}

function pushPickoffEventRow(rows, play, ev, eventIdx, ordinals) {
  const eventType = ev.details?.eventType;
  const meta = inningMeta(play.about, ordinals);
  const sortTime = ev.startTime || ev.endTime || play.about?.startTime || null;

  if (isPickoffAttempt(ev)) {
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
  pushRunnersRow(rows, play, `${play.about?.atBatIndex}-${eventIdx}`, meta, sortTime);
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
      description: formatOffensiveSubstitutionDescription(
        ev.details?.description || ev.details?.call?.description || '',
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
    const raw = ev.details?.description || '';
    if (!/^status change\s*-/i.test(raw)) return;
    const label = parseStatusLabel(raw);
    if (!isNotableStatus(label)) return;
    rows.push({
      kind: 'status_change',
      key: `status-${play.about?.atBatIndex}-${eventIdx}`,
      description: label,
      ...meta,
      sortTime,
    });
  }
}

function pushActionRow(rows, play, ev, eventIdx, ordinals) {
  const eventType = ev.details?.eventType;
  if (!eventType || !SUMMARY_ACTION_TYPES.has(eventType)) return;
  if (isPickoffEventType(eventType)) return;

  const raw = ev.details?.description || ev.details?.call?.description || '';
  const { description, outsLabel } = buildPlayDescription(
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
  pushRunnersRow(rows, play, `${play.about?.atBatIndex}-${eventIdx}`, meta, sortTime);
}

/**
 * Build chronological live recent-plays rows (oldest → newest).
 * Caller reverses for display and pins first pitch at the bottom.
 */
export function buildLiveRecentPlaysRows({
  allPlays,
  gameData,
  boxscore,
  linescore,
  currentPlay,
  isLive,
  ordinals,
}) {
  const rows = [];
  const currentAtBatIndex = currentPlay?.about?.atBatIndex;

  for (let playIdx = 0; playIdx < allPlays.length; playIdx += 1) {
    const play = allPlays[playIdx];
    const isActiveAtBat =
      isLive &&
      !play.about?.isComplete &&
      currentAtBatIndex != null &&
      play.about?.atBatIndex === currentAtBatIndex;

    (play.playEvents ?? []).forEach((ev, eventIdx) => {
      pushPlayEventRows(rows, play, ev, eventIdx, ordinals);
      if (!pushPickoffEventRow(rows, play, ev, eventIdx, ordinals)) {
        pushActionRow(rows, play, ev, eventIdx, ordinals);
      }
    });

    if (isActiveAtBat) continue;

    if (play.about?.isComplete && play.result?.event) {
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

      pushRunnersRow(rows, play, play.about?.atBatIndex, meta, sortTime);

      const nextPlay = allPlays[playIdx + 1];
      if (halfInningEnded(play, nextPlay)) {
        const next = nextHalfInfo(play, ordinals);
        const side = next.half === 'top' ? 'away' : 'home';
        const batters = getDueUpBatters(
          boxscore,
          side,
          nextPlay.matchup?.batter?.id,
          nextPlay.matchup?.batter,
        );
        const nextStart = nextPlay.about?.startTime || play.about?.endTime;
        pushDueUpRow(rows, {
          key: `due-up-${next.inning}-${next.half}`,
          title: `Due Up - ${next.halfLabel} ${next.ord}`,
          batters,
          meta: { inning: next.inning, half: next.half, inningKey: next.inningKey },
          sortTime: nextStart
            ? new Date(new Date(nextStart).getTime() - 1).toISOString()
            : sortTime,
        });
      }
    }
  }

  if (isLive && linescore?.inningState === 'Middle' && linescore.offense?.batter) {
    const half = linescore.inningHalf === 'Top' ? 'top' : 'bottom';
    const inning = linescore.currentInning ?? 1;
    const halfLabel = half === 'top' ? 'Top' : 'Bottom';
    const ord = ordinals[inning] || inning;
    const key = `due-up-${inning}-${half}`;
    if (!getStartedHalfKeys(allPlays, currentPlay, isLive).has(halfKey(inning, half))) {
      pushDueUpRow(rows, {
        key,
        title: `Due Up - ${halfLabel} ${ord}`,
        batters: dueUpFromOffense(linescore.offense),
        meta: { inning, half, inningKey: `${halfLabel} ${ord}` },
        sortTime: new Date().toISOString(),
      });
    }
  }

  if (isLive && currentPlay && !currentPlay.about?.isComplete) {
    const meta = inningMeta(currentPlay.about, ordinals);
    let pitchNumber = 0;

    (currentPlay.playEvents ?? []).forEach((ev, eventIdx) => {
      if (ev.details?.eventType === 'batter_timeout') {
        rows.push({
          kind: 'batter_timeout',
          key: `batter-timeout-${currentPlay.about?.atBatIndex}-${eventIdx}`,
          description: 'Batter Timeout',
          ...meta,
          sortTime: ev.endTime || ev.startTime || currentPlay.about?.startTime || new Date().toISOString(),
        });
        return;
      }

      if (!ev.isPitch) return;
      pitchNumber += 1;
      const description = ev.details?.description || ev.details?.call?.description || 'Pitch';
      rows.push({
        kind: 'live_pitch',
        key: `live-pitch-${currentPlay.about?.atBatIndex}-${eventIdx}`,
        pitchNumber,
        description,
        pitchType: ev.details?.type?.description || null,
        mph: ev.pitchData?.startSpeed ? parseFloat(ev.pitchData.startSpeed) : null,
        isInPlay: Boolean(ev.details?.isInPlay),
        balls: ev.count?.balls,
        strikes: ev.count?.strikes,
        ...meta,
        sortTime: ev.endTime || ev.startTime || currentPlay.about?.startTime || new Date().toISOString(),
      });
    });
  }

  rows.sort((a, b) => {
    const ta = a.sortTime ? new Date(a.sortTime).getTime() : 0;
    const tb = b.sortTime ? new Date(b.sortTime).getTime() : 0;
    return ta - tb;
  });

  return pruneDueUpRows(rows, { allPlays, currentPlay, isLive });
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