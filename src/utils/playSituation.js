import { compactPlayerName } from './mlbHelpers';

function lastName(person) {
  return compactPlayerName(person);
}

export function getPlayStartOuts(playEvents) {
  return playEvents.find((e) => e.count?.outs != null)?.count?.outs ?? null;
}

export function getOutsBeforeEvent(playEvents, eventIdx) {
  for (let i = eventIdx - 1; i >= 0; i -= 1) {
    if (playEvents[i].count?.outs != null) return playEvents[i].count.outs;
  }
  return getPlayStartOuts(playEvents);
}

export function findPreviousPlay(play, allPlays = []) {
  const arrIdx = allPlays.indexOf(play);
  if (arrIdx > 0) {
    const prev = allPlays[arrIdx - 1];
    if (sameHalfInning(play, prev)) return prev;
  }

  const atBatIndex = play?.about?.atBatIndex;
  if (atBatIndex != null && atBatIndex > 0) {
    return allPlays.find(
      (p) => p.about?.atBatIndex === atBatIndex - 1 && sameHalfInning(p, play),
    ) ?? null;
  }

  return null;
}

function sameHalfInning(a, b) {
  return a?.about?.inning === b?.about?.inning
    && a?.about?.halfInning === b?.about?.halfInning;
}

function getInitialBasesForPlay(play, allPlays = []) {
  const prev = findPreviousPlay(play, allPlays);
  if (prev && Number(prev.count?.outs) < 3) {
    return {
      first: prev.matchup?.postOnFirst ?? null,
      second: prev.matchup?.postOnSecond ?? null,
      third: prev.matchup?.postOnThird ?? null,
    };
  }
  return { first: null, second: null, third: null };
}

function seedOccupied(initial) {
  const occupied = new Map();
  const runnerLocations = new Map();

  const setRunner = (base, runner) => {
    if (!runner?.id) return;
    const old = runnerLocations.get(runner.id);
    if (old) occupied.delete(old);
    occupied.set(base, runner);
    runnerLocations.set(runner.id, base);
  };

  const clearRunner = (runner) => {
    if (!runner?.id) return;
    const old = runnerLocations.get(runner.id);
    if (old) occupied.delete(old);
    runnerLocations.delete(runner.id);
  };

  if (initial.first) setRunner('1B', initial.first);
  if (initial.second) setRunner('2B', initial.second);
  if (initial.third) setRunner('3B', initial.third);

  return { occupied, setRunner, clearRunner };
}

function normalizeBaseCode(base) {
  if (base === 1 || base === '1' || base === '1B') return '1B';
  if (base === 2 || base === '2' || base === '2B') return '2B';
  if (base === 3 || base === '3' || base === '3B') return '3B';
  return null;
}

function runnerNameFromPlacedDescription(description = '') {
  return description.match(/^(.+?)\s+starts inning at\s+\d(?:st|nd|rd|th)\s+base\.?$/i)?.[1]?.trim() ?? null;
}

function runnerFromPlacedEvent(ev) {
  if (ev?.details?.runner?.id) return ev.details.runner;
  if (!ev?.player?.id) return null;
  return {
    id: ev.player.id,
    link: ev.player.link,
    fullName: runnerNameFromPlacedDescription(ev.details?.description) || ev.player.fullName || 'Runner',
  };
}

/** Replay runner movements through a given play event index (inclusive). */
export function getBasesAtPlayIndex(play, allPlays = [], maxPlayIndex = Infinity) {
  const initial = getInitialBasesForPlay(play, allPlays);
  const { occupied, setRunner, clearRunner } = seedOccupied(initial);
  const runnerMovements = [...(play.runners ?? [])];

  for (const ev of play.playEvents ?? []) {
    if (ev?.details?.eventType !== 'runner_placed') continue;
    const runner = runnerFromPlacedEvent(ev);
    if (!runner?.id) continue;
    const playIndex = ev.index ?? 0;
    const hasMovement = runnerMovements.some((movement) => (
      movement?.details?.eventType === 'runner_placed' &&
      movement?.details?.runner?.id === runner.id &&
      movement?.details?.playIndex === playIndex
    ));
    if (hasMovement) continue;

    runnerMovements.push({
      details: {
        eventType: 'runner_placed',
        playIndex,
        runner,
      },
      movement: {
        start: null,
        end: normalizeBaseCode(ev.base ?? ev.details?.base) || '2B',
        isOut: false,
      },
    });
  }

  const sorted = runnerMovements.sort(
    (a, b) => (a.details?.playIndex ?? 0) - (b.details?.playIndex ?? 0),
  );

  for (const r of sorted) {
    const playIndex = r.details?.playIndex;
    if (playIndex != null && playIndex > maxPlayIndex) break;

    const m = r.movement;
    const runner = r.details?.runner;
    if (!m || !runner?.id) continue;

    clearRunner(runner);

    if (m.isOut || m.end === 'score' || m.end === '4B') {
      continue;
    }

    if (m.end === '1B' || m.end === '2B' || m.end === '3B') {
      setRunner(m.end, runner);
    }
  }

  return {
    first: occupied.get('1B') ?? null,
    second: occupied.get('2B') ?? null,
    third: occupied.get('3B') ?? null,
  };
}

export function getTerminalPlayIndex(play) {
  const events = play.playEvents ?? [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].details?.isInPlay) {
      return events[i].index ?? i;
    }
  }

  const runnerIndexes = (play.runners ?? [])
    .filter((r) => r.details?.eventType !== 'runner_placed')
    .map((r) => r.details?.playIndex)
    .filter((n) => n != null);
  if (runnerIndexes.length) return Math.max(...runnerIndexes);

  return events.length ? (events[events.length - 1].index ?? events.length - 1) : 0;
}

function getTerminalEventArrayIndex(play) {
  const terminalPlayIndex = getTerminalPlayIndex(play);
  const events = play.playEvents ?? [];
  const idx = events.findIndex((ev) => (ev.index ?? events.indexOf(ev)) === terminalPlayIndex);
  return idx >= 0 ? idx : events.length;
}

export function toIndicatorBases({ first, second, third }) {
  return {
    onFirst: Boolean(first?.id ?? first),
    onSecond: Boolean(second?.id ?? second),
    onThird: Boolean(third?.id ?? third),
  };
}

export function formatRunnersSituationLabel(bases) {
  const parts = [];
  if (bases.first) parts.push(`${lastName(bases.first)} on 1st`);
  if (bases.second) parts.push(`${lastName(bases.second)} at 2nd`);
  if (bases.third) parts.push(`${lastName(bases.third)} at 3rd`);
  return parts.join(', ');
}

/** Situation immediately before the at-bat result (same logic as All Plays runner rows). */
export function getSituationBeforePlayResult(play, allPlays = []) {
  if (!play?.matchup) {
    return {
      bases: { onFirst: false, onSecond: false, onThird: false },
      balls: 0,
      strikes: 0,
      outs: 0,
      runners: { first: null, second: null, third: null },
    };
  }

  const terminalPlayIndex = getTerminalPlayIndex(play);
  const bases = getBasesAtPlayIndex(play, allPlays, terminalPlayIndex - 1);
  const events = play.playEvents ?? [];
  const terminalEventIdx = getTerminalEventArrayIndex(play);
  const outs = getOutsBeforeEvent(events, terminalEventIdx)
    ?? getPlayStartOuts(events)
    ?? Number(play.count?.outs ?? 0);

  return {
    bases: toIndicatorBases(bases),
    balls: Number(play.count?.balls ?? 0),
    strikes: Number(play.count?.strikes ?? 0),
    outs: Number(outs),
    runners: bases,
  };
}

export function getBasesAfterPlay(play, allPlays = []) {
  if (Number(play.count?.outs) >= 3) {
    return { first: null, second: null, third: null };
  }

  if (play.about?.isComplete) {
    return {
      first: play.matchup?.postOnFirst ?? null,
      second: play.matchup?.postOnSecond ?? null,
      third: play.matchup?.postOnThird ?? null,
    };
  }

  return getBasesAtPlayIndex(play, allPlays, Infinity);
}
