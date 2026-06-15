/** Catcher's-view mini diamond: left = 3rd, top = 2nd, right = 1st. */
const DIAMOND_SIZES = {
  xs: {
    box: 'w-7 h-7',
    diamond: 'w-1.5 h-1.5',
    third: 'left-0.5 top-1/2 -translate-y-1/2',
    second: 'left-1/2 top-0.5 -translate-x-1/2',
    first: 'right-0.5 top-1/2 -translate-y-1/2',
  },
  sm: {
    box: 'w-10 h-10',
    diamond: 'w-2 h-2',
    third: 'left-1 top-1/2 -translate-y-1/2',
    second: 'left-1/2 top-1 -translate-x-1/2',
    first: 'right-1 top-1/2 -translate-y-1/2',
  },
  md: {
    box: 'w-12 h-12',
    diamond: 'w-2.5 h-2.5',
    third: 'left-1.5 top-1/2 -translate-y-1/2',
    second: 'left-1/2 top-1.5 -translate-x-1/2',
    first: 'right-1.5 top-1/2 -translate-y-1/2',
  },
  lg: {
    box: 'w-11 h-11',
    diamond: 'w-2.5 h-2.5',
    third: 'left-1.5 top-1/2 -translate-y-1/2',
    second: 'left-1/2 top-1.5 -translate-x-1/2',
    first: 'right-1.5 top-1/2 -translate-y-1/2',
  },
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

/** Resolve occupied bases from linescore (and optional current play). */
export function getRunnersOnBase(linescore, currentPlay = null) {
  if (!linescore) return EMPTY_BASES;

  const outs = Number(linescore.outs ?? 0);
  const inningState = linescore.inningState ?? '';

  if (outs === 0 || outs >= 3 || inningState === 'Middle' || inningState === 'End') {
    return EMPTY_BASES;
  }

  const offense = linescore.offense ?? {};
  let first = offense.first ?? offense.onFirst ?? null;
  let second = offense.second ?? offense.onSecond ?? null;
  let third = offense.third ?? offense.onThird ?? null;

  if (currentPlay?.matchup) {
    const playOuts = Number(currentPlay.count?.outs ?? outs);
    if (currentPlay.about?.isComplete && playOuts >= 3) {
      return EMPTY_BASES;
    }
    const m = currentPlay.matchup;
    first = m.postOnFirst ?? first;
    second = m.postOnSecond ?? second;
    third = m.postOnThird ?? third;
  }

  return {
    onFirst: Boolean(first),
    onSecond: Boolean(second),
    onThird: Boolean(third),
  };
}

export function BaseDiamondIndicator({ onFirst, onSecond, onThird, size = 'md', className = '' }) {
  const s = DIAMOND_SIZES[size] ?? DIAMOND_SIZES.md;
  const diamond = `absolute ${s.diamond} rotate-45 border border-white/90`;
  const filled = 'bg-white';
  const empty = 'bg-transparent';

  return (
    <div className={`${s.box} relative flex-shrink-0 ${className}`} aria-hidden>
      <div className={`${diamond} ${s.third} ${onThird ? filled : empty}`} />
      <div className={`${diamond} ${s.second} ${onSecond ? filled : empty}`} />
      <div className={`${diamond} ${s.first} ${onFirst ? filled : empty}`} />
    </div>
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