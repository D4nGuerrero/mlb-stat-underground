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
    if (old && occupied.get(old)?.id === runner.id) occupied.delete(old);
    occupied.set(base, runner);
    runnerLocations.set(runner.id, base);
  };

  const clearRunner = (runner) => {
    if (!runner?.id) return;
    const old = runnerLocations.get(runner.id);
    if (old && occupied.get(old)?.id === runner.id) occupied.delete(old);
    runnerLocations.delete(runner.id);
  };

  const getRunnerBase = (runner) => (
    runner?.id ? runnerLocations.get(runner.id) ?? null : null
  );

  if (initial.first) setRunner('1B', initial.first);
  if (initial.second) setRunner('2B', initial.second);
  if (initial.third) setRunner('3B', initial.third);

  return { occupied, setRunner, clearRunner, getRunnerBase };
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

function runnerNameFromPinchRunnerDescription(description = '') {
  return description.match(/pinch[-\s]?runner\s+(.+?)\s+replaces/i)?.[1]?.trim() ?? null;
}

export function isPinchRunnerSubstitution(ev) {
  if (ev?.details?.eventType !== 'offensive_substitution') return false;
  const position = ev.position;
  if (position?.abbreviation === 'PR' || position?.code === '12') return true;
  if (/pinch runner/i.test(position?.name || '')) return true;
  return /pinch[-\s]?runner/i.test(ev.details?.description || '');
}

function runnerFromPinchRunnerEvent(ev) {
  const player = ev?.details?.runner?.id ? ev.details.runner : ev?.player;
  if (!player?.id) return null;
  return {
    id: player.id,
    link: player.link,
    fullName:
      player.fullName
      || runnerNameFromPinchRunnerDescription(ev.details?.description)
      || 'Runner',
  };
}

function collectPlayRunnerMovements(play) {
  const runnerMovements = [...(play.runners ?? [])];

  for (const ev of play.playEvents ?? []) {
    const playIndex = ev.index ?? 0;

    if (ev?.details?.eventType === 'runner_placed') {
      const runner = runnerFromPlacedEvent(ev);
      if (!runner?.id) continue;
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
      continue;
    }

    if (!isPinchRunnerSubstitution(ev)) continue;

    const runner = runnerFromPinchRunnerEvent(ev);
    if (!runner?.id) continue;
    const hasMovement = runnerMovements.some((movement) => (
      movement?.details?.eventType === 'offensive_substitution' &&
      movement?.details?.runner?.id === runner.id &&
      movement?.details?.playIndex === playIndex
    ));
    if (hasMovement) continue;

    runnerMovements.push({
      details: {
        eventType: 'offensive_substitution',
        playIndex,
        runner,
        replacedPlayer: ev.replacedPlayer ?? null,
      },
      movement: {
        start: normalizeBaseCode(ev.base ?? ev.details?.base),
        end: normalizeBaseCode(ev.base ?? ev.details?.base),
        isOut: false,
      },
    });
  }

  return runnerMovements.sort(
    (a, b) => (a.details?.playIndex ?? 0) - (b.details?.playIndex ?? 0),
  );
}

function applyRunnerMovement(r, { occupied, setRunner, clearRunner, getRunnerBase }) {
  const m = r.movement;
  const runner = r.details?.runner;
  if (!runner?.id) return;

  if (r.details?.eventType === 'offensive_substitution') {
    const replaced = r.details?.replacedPlayer;
    let dest = normalizeBaseCode(m?.end) || normalizeBaseCode(m?.start);
    if (replaced?.id) {
      dest = dest || getRunnerBase(replaced);
      clearRunner(replaced);
    }
    if (dest === '1B' || dest === '2B' || dest === '3B') {
      const occupant = occupied.get(dest);
      if (occupant && occupant.id !== runner.id) clearRunner(occupant);
      setRunner(dest, runner);
    }
    return;
  }

  if (!m) return;

  const startBase = normalizeBaseCode(m.start);
  const wasOnBase = getRunnerBase(runner);
  clearRunner(runner);

  // Pinch-runner identity swap: MLB credits the new runner with the movement
  // (1B → 2B steal) without a runner-movement for the substitution itself.
  if (!wasOnBase && startBase) {
    const occupant = occupied.get(startBase);
    if (occupant && occupant.id !== runner.id) clearRunner(occupant);
  }

  if (m.isOut || m.end === 'score' || m.end === '4B') {
    return;
  }

  if (m.end === '1B' || m.end === '2B' || m.end === '3B') {
    setRunner(m.end, runner);
  }
}

/** Replay runner movements through a given play event index (inclusive). */
export function getBasesAtPlayIndex(play, allPlays = [], maxPlayIndex = Infinity, initialBases = null) {
  const initial = initialBases ?? getInitialBasesForPlay(play, allPlays);
  const occupancy = seedOccupied(initial);

  for (const r of collectPlayRunnerMovements(play)) {
    const playIndex = r.details?.playIndex;
    if (playIndex != null && playIndex > maxPlayIndex) break;
    applyRunnerMovement(r, occupancy);
  }

  return {
    first: occupancy.occupied.get('1B') ?? null,
    second: occupancy.occupied.get('2B') ?? null,
    third: occupancy.occupied.get('3B') ?? null,
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
