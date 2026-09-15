import { useLongPress } from '../../../hooks/useLongPress';

export function PlayerAbsButton({
  playerId,
  onOpenAbs,
  compact = false,
  className = '',
}) {
  if (!playerId || !onOpenAbs) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenAbs(playerId);
      }}
      title="At-bats this game"
      aria-label="At-bats this game"
      className={[
        'flex-shrink-0 items-center justify-center rounded font-black uppercase tracking-wider text-slate-400 transition-colors hover:bg-slate-800 hover:text-accent-300',
        compact
          ? 'inline-flex h-4 min-w-[1.15rem] px-1 text-[8px]'
          : 'hidden md:inline-flex h-5 px-1.5 text-[9px]',
        className,
      ].join(' ')}
    >
      ABs
    </button>
  );
}

export function PlayerAbsNameButton({
  playerId,
  onOpenPlayer,
  onOpenAbs,
  className = '',
  title,
  children,
}) {
  const longPress = useLongPress({
    enabled: Boolean(playerId && onOpenAbs),
    onClick: () => onOpenPlayer?.(playerId),
    onLongPress: () => onOpenAbs?.(playerId),
  });

  return (
    <button
      type="button"
      title={title ?? (onOpenAbs ? 'Tap for player page. Hold for today\'s at-bats.' : undefined)}
      className={className}
      {...longPress}
    >
      {children}
    </button>
  );
}
