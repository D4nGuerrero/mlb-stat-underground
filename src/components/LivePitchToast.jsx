import { useEffect } from 'react';
import { getPitchResultKind } from '../utils/liveRecentPlays';
import { formatPitchDescriptionWithAbsContext } from '../utils/absChallenge';

const RESULT_STYLES = {
  strike: 'border-red-500/45 text-red-100',
  ball: 'border-green-500/45 text-green-100',
  in_play: 'border-blue-500/45 text-blue-100',
  play: 'border-yellow-500/45 text-yellow-100',
  out: 'border-slate-400/45 text-slate-100',
  runner: 'border-sky-500/45 text-sky-100',
  misc: 'border-orange-500/45 text-orange-100',
};

const TOAST_DURATION_MS = 2400;
const TOAST_EXIT_START_MS = Math.round(TOAST_DURATION_MS * 0.58);

function toastFromPitch(pitch) {
  if (!pitch) return null;
  const description = formatPitchDescriptionWithAbsContext(
    pitch.details?.description || pitch.details?.call?.description || 'Pitch',
    pitch,
    [pitch],
    0,
  );
  const pitchType = pitch.details?.type?.description;
  const mph = pitch.pitchData?.startSpeed ? Math.round(pitch.pitchData.startSpeed) : null;
  return {
    title: description,
    subtitle: [pitchType, mph != null ? `${mph} mph` : null].filter(Boolean).join(' · '),
    resultKind: getPitchResultKind(description, pitch.details?.isInPlay),
  };
}

export default function LivePitchToast({ item, pitch, onComplete, onExitStart }) {
  useEffect(() => {
    const exitTimer = setTimeout(() => onExitStart?.(), TOAST_EXIT_START_MS);
    const completeTimer = setTimeout(() => onComplete?.(), TOAST_DURATION_MS);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [item, pitch, onComplete, onExitStart]);

  const toast = item || toastFromPitch(pitch);
  if (!toast) return null;

  const style = RESULT_STYLES[toast.resultKind] ?? RESULT_STYLES.misc;
  const ballColor =
    toast.resultKind === 'ball'
      ? 'bg-green-500'
      : toast.resultKind === 'in_play'
        ? 'bg-blue-500'
        : toast.resultKind === 'out'
          ? 'bg-slate-500'
          : 'bg-red-500';

  return (
    <div
      className={`absolute left-1/2 bottom-6 z-10 pointer-events-none pitch-toast-float w-[min(100vw,360px)] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border bg-slate-950/95 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-md xl:w-[260px] ${style}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        {toast.pitchNumber != null && (
          <span className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-white/80 text-sm font-black text-white shadow-sm ${ballColor}`}>
            {toast.pitchNumber}
          </span>
        )}
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-extrabold leading-tight text-white">{toast.title}</p>
          {toast.subtitle && (
            <p className="mt-0.5 truncate text-xs font-bold leading-tight text-slate-200">
              {toast.subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
