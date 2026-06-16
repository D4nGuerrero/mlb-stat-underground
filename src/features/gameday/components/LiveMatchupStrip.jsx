import { THEME_COLOR } from '../../../theme/theme.js';
import {
  pitcherActionShotUrl,
  playerActionShotUrl,
  playerHeadshotUrl,
} from '../../../utils/mlbHelpers';
import {
  BaseDiamondIndicator,
  OutsIndicator,
  getRunnersOnBase,
} from '../../../components/LiveGameIndicators';

function LiveMatchupPlayerCard({
  accent = false,
  fallbackSrc,
  imageSrc,
  label,
  name,
  onSelect,
  playerId,
  stat,
}) {
  return (
    <button
      className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-800/40 transition-colors"
      onClick={() => onSelect(playerId)}
    >
      <div className="text-[8px] text-slate-500 uppercase tracking-widest">{label}</div>
      <div
        className={`w-14 h-14 rounded-xl overflow-hidden ${accent ? `border-2 border-${THEME_COLOR}-500/40` : 'border border-slate-700'} flex-shrink-0`}
      >
        <img
          src={imageSrc}
          className="w-full h-full object-cover object-top"
          alt=""
          onError={(e) => {
            e.target.src = fallbackSrc;
          }}
        />
      </div>
      <div className="text-[11px] font-semibold text-slate-200 text-center leading-tight max-w-[72px] truncate">
        {name || '—'}
      </div>
      <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
        {stat}
      </div>
    </button>
  );
}

export default function LiveMatchupStrip({
  currentPlay,
  dueUpBatters,
  dueUpHalfLabel,
  dueUpInningOrdinal,
  getBatterGameStat,
  getPitcherGameStat,
  linescore,
  onPlayerSelect,
  showDueUpMatchup,
}) {
  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
      {showDueUpMatchup ? (
        <div>
          <div className="px-4 pt-3 text-center">
            <div className={`text-[9px] text-${THEME_COLOR}-300 uppercase tracking-[0.22em] font-semibold`}>
              Due Up
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {dueUpHalfLabel} {dueUpInningOrdinal}
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-800">
            {dueUpBatters.map((batter, idx) => (
              <LiveMatchupPlayerCard
                key={batter.id}
                accent={idx === 0}
                fallbackSrc={playerHeadshotUrl(batter.id)}
                imageSrc={playerActionShotUrl(batter.id)}
                label={idx === 0 ? 'Batter' : idx === 1 ? 'On Deck' : 'In Hole'}
                name={batter.name || batter.fullName}
                onSelect={onPlayerSelect}
                playerId={batter.id}
                stat={null}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-slate-800">
          <LiveMatchupPlayerCard
            fallbackSrc={playerHeadshotUrl(linescore?.defense?.pitcher?.id)}
            imageSrc={pitcherActionShotUrl(linescore?.defense?.pitcher?.id)}
            label="Pitching"
            name={linescore?.defense?.pitcher?.fullName?.split(' ').slice(-1)[0]}
            onSelect={onPlayerSelect}
            playerId={linescore?.defense?.pitcher?.id}
            stat={
              getPitcherGameStat(linescore?.defense?.pitcher?.id)?.pitchesThrown != null ? (
                <div className="text-slate-400">
                  {getPitcherGameStat(linescore?.defense?.pitcher?.id).pitchesThrown} pitches
                </div>
              ) : null
            }
          />

          <div className="flex flex-col items-center justify-center gap-2.5 p-3">
            <BaseDiamondIndicator {...getRunnersOnBase(linescore, currentPlay)} size="md" />
            <span className="text-sm font-bold font-mono text-slate-200 tabular-nums">
              {linescore?.balls ?? 0}-{linescore?.strikes ?? 0}
            </span>
            <OutsIndicator outs={linescore?.outs ?? 0} size="md" />
          </div>

          <LiveMatchupPlayerCard
            accent
            fallbackSrc={playerHeadshotUrl(linescore?.offense?.batter?.id)}
            imageSrc={playerActionShotUrl(linescore?.offense?.batter?.id)}
            label="At Bat"
            name={linescore?.offense?.batter?.fullName?.split(' ').slice(-1)[0]}
            onSelect={onPlayerSelect}
            playerId={linescore?.offense?.batter?.id}
            stat={
              getBatterGameStat(linescore?.offense?.batter?.id) != null ? (
                <div className={`text-${THEME_COLOR}-400/80 font-semibold`}>
                  {getBatterGameStat(linescore?.offense?.batter?.id).hits ?? 0}-
                  {getBatterGameStat(linescore?.offense?.batter?.id).atBats ?? 0}
                </div>
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
