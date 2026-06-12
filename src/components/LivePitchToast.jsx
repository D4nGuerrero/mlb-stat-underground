import { useEffect } from 'react';
import { getPitchResultKind } from '../utils/liveRecentPlays';

const RESULT_STYLES = {
  strike: 'border-red-500/50 bg-red-500/15 text-red-200',
  ball: 'border-green-500/50 bg-green-500/15 text-green-200',
  in_play: 'border-blue-500/50 bg-blue-500/15 text-blue-200',
};

export default function LivePitchToast({ pitch, onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 2400);
    return () => clearTimeout(timer);
  }, [pitch, onComplete]);

  if (!pitch) return null;

  const description = pitch.details?.description || pitch.details?.call?.description || 'Pitch';
  const pitchType = pitch.details?.type?.description;
  const mph = pitch.pitchData?.startSpeed ? Math.round(pitch.pitchData.startSpeed) : null;
  const resultKind = getPitchResultKind(description, pitch.details?.isInPlay);
  const style = RESULT_STYLES[resultKind] ?? RESULT_STYLES.strike;

  return (
    <div
      className={`absolute left-1/2 top-14 z-30 pointer-events-none pitch-toast-float max-w-[min(92%,280px)] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md ${style}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-snug text-center">{description}</p>
      {(pitchType || mph != null) && (
        <p className="text-[11px] text-center opacity-80 mt-0.5 font-mono">
          {[pitchType, mph != null ? `${mph} mph` : null].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}