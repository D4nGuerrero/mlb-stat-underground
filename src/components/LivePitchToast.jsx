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

export default function LivePitchToast({ item, pitch, onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 2400);
    return () => clearTimeout(timer);
  }, [item, pitch, onComplete]);

  const toast = item || toastFromPitch(pitch);
  if (!toast) return null;

  const style = RESULT_STYLES[toast.resultKind] ?? RESULT_STYLES.misc;

  return (
    <div
      className={`absolute left-1/2 bottom-4 z-30 pointer-events-none pitch-toast-float w-[min(100vw,360px)] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border bg-slate-900/95 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md xl:w-[260px] xl:px-3 xl:py-2 ${style}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-base font-extrabold leading-tight text-center xl:text-sm">{toast.title}</p>
      {toast.subtitle && (
        <p className="text-xs text-center text-slate-300 mt-1 font-mono xl:text-[10px]">
          {toast.subtitle}
        </p>
      )}
    </div>
  );
}
