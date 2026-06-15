import { getSituationBeforePlayResult } from '../utils/playSituation';

/** Catcher's view: left = 3rd, top = 2nd, right = 1st (MLB At Bat bases SVG). */
const BASES_SVG_WIDTH = {
  xs: 22,
  sm: 28,
  md: 33,
  lg: 37,
};

const OUTS_SIZES = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
};

export function formatLiveInningLabel(linescore) {
  if (!linescore) return '—';
  const half = linescore.inningHalf === 'Top' ? 'TOP' : 'BOT';
  return `${half} ${linescore.currentInning ?? '—'}`;
}

const EMPTY_BASES = { onFirst: false, onSecond: false, onThird: false };

function runnerOccupied(slot) {
  if (!slot) return false;
  if (typeof slot === 'object') return Boolean(slot.id ?? slot.fullName);
  return Boolean(slot);
}

function basesFromPlayRunners(play) {
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

function basesFromOffense(offense = {}) {
  return {
    first: offense.first ?? offense.onFirst ?? null,
    second: offense.second ?? offense.onSecond ?? null,
    third: offense.third ?? offense.onThird ?? null,
  };
}

function toIndicatorBases({ first, second, third }) {
  return {
    onFirst: runnerOccupied(first),
    onSecond: runnerOccupied(second),
    onThird: runnerOccupied(third),
  };
}

/** Resolve occupied bases from linescore (and optional current play). */
export function getRunnersOnBase(linescore, currentPlay = null) {
  if (!linescore) return EMPTY_BASES;

  const outs = Number(linescore.outs ?? 0);
  const inningState = linescore.inningState ?? '';

  if (outs >= 3 || inningState === 'Middle' || inningState === 'End') {
    return EMPTY_BASES;
  }

  if (currentPlay?.matchup) {
    const playOuts = Number(currentPlay.count?.outs ?? outs);
    if (playOuts >= 3) return EMPTY_BASES;

    if (currentPlay.about?.isComplete) {
      const m = currentPlay.matchup;
      return toIndicatorBases({
        first: m.postOnFirst,
        second: m.postOnSecond,
        third: m.postOnThird,
      });
    }

    const fromRunners = basesFromPlayRunners(currentPlay);
    const fromOffense = basesFromOffense(linescore.offense);
    return toIndicatorBases({
      first: fromRunners.first ?? fromOffense.first,
      second: fromRunners.second ?? fromOffense.second,
      third: fromRunners.third ?? fromOffense.third,
    });
  }

  return toIndicatorBases(basesFromOffense(linescore.offense));
}

/** Occupied bases before the at-bat result (play detail sheet). */
export function getRunnersOnBaseFromPlay(play, allPlays = null) {
  return getSituationBeforePlayResult(play, allPlays ?? []).bases;
}

/** Full situation before the at-bat result: bases, count, outs. */
export function getPlayDetailSituation(play, allPlays = null) {
  return getSituationBeforePlayResult(play, allPlays ?? []);
}

export function BaseDiamondIndicator({
  onFirst,
  onSecond,
  onThird,
  bases,
  size = 'md',
  className = '',
}) {
  const width = BASES_SVG_WIDTH[size] ?? BASES_SVG_WIDTH.md;
  const occupied = bases ?? { third: onThird, second: onSecond, first: onFirst };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      viewBox="0 0 24 17.25"
      className={`flex-shrink-0 ${className}`}
      aria-hidden
    >
      <title>Bases</title>
      <rect
        width="6"
        height="6"
        transform="translate(5.25, 7.25) rotate(-315)"
        fill={occupied.third ? '#ffffff' : 'transparent'}
        stroke="#ffffff"
        strokeWidth={1}
      />
      <rect
        width="6"
        height="6"
        transform="translate(12, 0.75) rotate(-315)"
        fill={occupied.second ? '#ffffff' : 'transparent'}
        stroke="#ffffff"
        strokeWidth={1}
      />
      <rect
        width="6"
        height="6"
        transform="translate(18.75, 7.25) rotate(-315)"
        fill={occupied.first ? '#ffffff' : 'transparent'}
        stroke="#ffffff"
        strokeWidth={1}
      />
    </svg>
  );
}

export function OutsIndicator({ outs = 0, size = 'md', className = '' }) {
  const dot = OUTS_SIZES[size] ?? OUTS_SIZES.md;
  const outCount = Math.min(Math.max(Number(outs) || 0, 0), 3);

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`} aria-label={`${outCount} outs`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`${dot} rounded-full border ${i < outCount ? 'bg-red-400 border-red-400' : 'bg-transparent border-slate-600'}`}
        />
      ))}
    </div>
  );
}

export function LiveSituationStack({ linescore, size = 'sm', showInning = true, className = '' }) {
  if (!linescore) return null;

  const balls = linescore.balls ?? 0;
  const strikes = linescore.strikes ?? 0;
  const outs = linescore.outs ?? 0;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {showInning && (
        <span className="text-[10px] font-bold text-slate-300 tracking-wide font-mono">
          {formatLiveInningLabel(linescore)}
        </span>
      )}
      <BaseDiamondIndicator
        {...getRunnersOnBase(linescore)}
        size={size}
      />
      <span className="text-[10px] text-slate-400 font-mono">
        {balls}-{strikes}, {outs} out{outs === 1 ? '' : 's'}
      </span>
    </div>
  );
}