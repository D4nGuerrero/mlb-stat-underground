
function ratingColor(value) {
  if (value >= 90) return 'text-amber-300';
  if (value >= 80) return 'text-emerald-400';
  if (value >= 70) return `text-accent-400`;
  if (value >= 50) return 'text-slate-200';
  if (value >= 40) return 'text-slate-400';
  return 'text-slate-500';
}

function RatingPip({ label, value }) {
  return (
    <div className="flex flex-col items-center min-w-[2rem]">
      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <span className={`text-sm font-mono font-bold tabular-nums ${ratingColor(value)}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

/** Compact inline ratings for lineup rows. */
export function CardRatingsInline({ card, className = '' }) {
  if (!card) return null;

  if (card.role === 'pitcher') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`text-xs font-mono font-bold ${ratingColor(card.OVR)}`}>{card.OVR}</span>
        <div className="flex gap-1.5 text-[10px] font-mono text-slate-500">
          <span>STF <span className={ratingColor(card.STF)}>{card.STF}</span></span>
          <span>CTL <span className={ratingColor(card.CTL)}>{card.CTL}</span></span>
          <span>HRA <span className={ratingColor(card.HRA)}>{card.HRA}</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`text-xs font-mono font-bold ${ratingColor(card.OVR)}`}>{card.OVR}</span>
      <div className="flex gap-1.5 text-[10px] font-mono text-slate-500">
        <span>CON <span className={ratingColor(card.CON)}>{card.CON}</span></span>
        <span>POW <span className={ratingColor(card.POW)}>{card.POW}</span></span>
        <span>EYE <span className={ratingColor(card.EYE)}>{card.EYE}</span></span>
      </div>
    </div>
  );
}

/** Full player card face (video-game style). */
export default function PlayerCard({ player, className = '', compact = false }) {
  const card = player?.card || player?.pitchCard;
  if (!player || !card) return null;

  const isPitcher = card.role === 'pitcher';
  const ovrColor = ratingColor(card.OVR);

  return (
    <div
      className={[
        'rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-800/90 to-slate-900',
        'shadow-lg shadow-black/30 overflow-hidden',
        compact ? 'p-2.5' : 'p-3.5',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            {player.gamePos || player.pos}
            {player.batsHand ? ` · ${player.batsHand}HB` : ''}
            {isPitcher && player.throwsHand ? ` · ${player.throwsHand}HP` : ''}
          </div>
          <div className={`font-semibold text-slate-100 truncate ${compact ? 'text-sm' : 'text-base'}`}>
            {player.name}
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[9px] uppercase text-slate-500 tracking-wider">OVR</span>
          <span className={`font-mono font-black leading-none ${ovrColor} ${compact ? 'text-2xl' : 'text-3xl'}`}>
            {card.OVR}
          </span>
        </div>
      </div>

      {isPitcher ? (
        <div className="flex justify-between gap-1 pt-2 border-t border-slate-700/60">
          <RatingPip label="STF" value={card.STF} />
          <RatingPip label="CTL" value={card.CTL} />
          <RatingPip label="HRA" value={card.HRA} />
          <RatingPip label="MOV" value={card.MOV} />
        </div>
      ) : (
        <div className="flex justify-between gap-1 pt-2 border-t border-slate-700/60">
          <RatingPip label="CON" value={card.CON} />
          <RatingPip label="POW" value={card.POW} />
          <RatingPip label="GAP" value={card.GAP} />
          <RatingPip label="EYE" value={card.EYE} />
          <RatingPip label="SPD" value={card.SPD} />
        </div>
      )}

      {card.shrunk && (
        <div className="mt-2 text-[9px] text-amber-500/80 font-mono">
          Limited sample — regressed to league
        </div>
      )}
    </div>
  );
}
