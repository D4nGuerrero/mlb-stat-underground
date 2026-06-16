import { useEffect } from 'react';
import { getPitchResultKind } from '../utils/liveRecentPlays';

const RESULT_STYLES = {
  strike: 'border-red-500/50 bg-red-500/15 text-red-200',
  ball: 'border-green-500/50 bg-green-500/15 text-green-200',
  in_play: 'border-blue-500/50 bg-blue-500/15 text-blue-200',
  play: 'border-yellow-500/50 bg-yellow-500/15 text-yellow-100',
  out: 'border-slate-400/50 bg-slate-500/15 text-slate-100',
  runner: 'border-sky-500/50 bg-sky-500/15 text-sky-100',
  misc: 'border-orange-500/50 bg-orange-500/15 text-orange-100',
};

function toastFromPitch(pitch) {
  if (!pitch) return null;
  const description = pitch.details?.description || pitch.details?.call?.description || 'Pitch';
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
      className={`absolute left-1/2 -bottom-6 z-30 pointer-events-none pitch-toast-float w-[min(100vw,300px)] max-w-[calc(100vw-2rem)] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md ${style}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-snug text-center">{toast.title}</p>
      {toast.subtitle && (
        <p className="text-[11px] text-center opacity-80 mt-0.5 font-mono">
          {toast.subtitle}
        </p>
      )}
    </div>
  );
}
