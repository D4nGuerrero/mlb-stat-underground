import { THEME_COLOR } from '../../../theme/theme.js';
import {
  pitcherActionShotUrl,
  playerActionShotUrl,
  playerHeadshotUrl,
  compactPlayerName,
} from '../../../utils/mlbHelpers';
import {
  BaseDiamondIndicator,
  OutsIndicator,
  getRunnersOnBase,
} from '../../../components/LiveGameIndicators';

function LiveMatchupPlayerCard({
  fallbackSrc,
  name,
  onSelect,
  playerId,
  role,
  stat,
}) {
  return (
    <button
      className="flex flex-col items-center hover:bg-slate-800/40 transition-colors p-2"
      onClick={() => onSelect(playerId)}
      // style={{
      //   backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
      //   backgroundSize: 'cover',
      //   backgroundPosition: 'top',
      //   backgroundRepeat: 'no-repeat',
      // }}
    >
      {/* <div className="text-[8px] text-slate-500 uppercase tracking-widest">{label}</div> */}
      <div
        className={`w-14 h-14  overflow-hidden  flex-shrink-0`}
      >
        <img
          src={playerHeadshotUrl(playerId,2)}
          className="w-full h-full object-cover object-top"
          alt=""
          onError={(e) => {
            e.target.src = fallbackSrc;
          }}
        />
      </div>
      {/* DUE UP */}
      <div className="text-[11px] font-semibold text-slate-200 text-center leading-tight max-w-[88px] truncate">
        <span>{name || '—'}</span>
        {role && <span className="ml-1 text-[10px] font-black text-slate-500">{role}</span>}
      </div>
      <div className="text-[12px] text-white-500 font-mono text-center font-bold font-sans">
        {stat}
      </div>
    </button>
  );
}

function formatBatterContribution(stat) {
  if (!stat) return '0-0';
  const parts = [];
  const line = `${stat.hits ?? 0}-${stat.atBats ?? 0}`;
  if (Number(stat.rbi) > 0) parts.push(`${stat.rbi} RBI`);
  if (Number(stat.runs) > 0) parts.push(`${stat.runs} R`);
  if (Number(stat.homeRuns) > 0) parts.push(`${stat.homeRuns} HR`);
  if (Number(stat.doubles) > 0) parts.push(`${stat.doubles} 2B`);
  if (Number(stat.triples) > 0) parts.push(`${stat.triples} 3B`);
  if (Number(stat.baseOnBalls) > 0) parts.push(`${stat.baseOnBalls} BB`);
  if (Number(stat.stolenBases) > 0) parts.push(`${stat.stolenBases} SB`);
  return parts.length ? `${line} | ${parts.join(', ')}` : line;
}

function formatPitcherRole(currentPlay, linescore) {
  const hand =
    currentPlay?.matchup?.pitchHand?.code ||
    linescore?.defense?.pitcher?.pitchHand?.code;
  return /^[LR]$/i.test(hand || '') ? `${String(hand).toUpperCase()}HP` : null;
}

function formatBatterRole(player, currentPlay, linescore) {
  return (
    player?.position?.abbreviation ||
    currentPlay?.matchup?.batter?.primaryPosition?.abbreviation ||
    linescore?.offense?.batter?.position?.abbreviation ||
    null
  );
}

export default function LiveMatchupStrip({
  currentPlay,
  dueUpBatters,
  dueUpHalfLabel,
  dueUpInningOrdinal,
  finalMessage = null,
  getBatterGameStat,
  getGamePlayer,
  getPitcherGameStat,
  linescore,
  onPlayerSelect,
  showDueUpMatchup,
}) {
  const pitcherStatObj = getPitcherGameStat(linescore?.defense?.pitcher?.id);
  const batterPlayer = getGamePlayer?.(linescore?.offense?.batter?.id);
  const batterRole = formatBatterRole(batterPlayer, currentPlay, linescore);
  const pitcherRole = formatPitcherRole(currentPlay, linescore);

function formatPitcherStat(s) {
  if (!s) return null;

  const pitches = s.pitchesThrown ?? s.pitches ?? s.P;
  const outs = s.outs ?? s.outsPitched ?? s.outs_recorded ?? s.outsRecorded;
  const inningsRaw = s.inningsPitched ?? s.ip ?? s.innings;

  let inningsStr = '';

  if (outs != null) {
    inningsStr = `${Math.floor(outs / 3)}.${outs % 3}`;
  } else if (inningsRaw != null) {
    inningsStr = typeof inningsRaw === 'number' ? String(inningsRaw) : inningsRaw;
  }

  const ks = s.strikeouts ?? s.k ?? s.K ?? s.Ks;
  const er = s.earnedRuns ?? s.er ?? s.ER;

  const stats = [];

  if (inningsStr) stats.push(`${inningsStr} IP`);
  if (ks != null) stats.push(`${ks}K`);
  if (er != null) stats.push(`${er} ER`);

  if (pitches == null && !stats.length) return null;

  return (
    <>
      {pitches != null && (
        <>
          <span>{pitches} P</span>
          {stats.length > 0 && (
            <span className="px-0.5 text-white/30 font-bold">|</span>
          )}
        </>
      )}

      {stats.length > 0 && <span>{stats.join(', ')}</span>}
    </>
  );
}
  return (
    <div className="bg-slate-900 border border-slate-700/60 sm:rounded-2xl overflow-hidden ">
      {finalMessage ? (
        <div className="px-4 py-5 text-center">
          <div className="text-[9px] text-slate-500 uppercase tracking-[0.22em] font-semibold">
            Final
          </div>
          <div className={`mt-1 text-sm font-bold text-${THEME_COLOR}-300`}>
            {finalMessage}
          </div>
        </div>
      ) : showDueUpMatchup ? (
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
                stat={formatBatterContribution(getBatterGameStat(batter.id))}
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
            name={compactPlayerName(linescore?.defense?.pitcher)}
            onSelect={onPlayerSelect}
            playerId={linescore?.defense?.pitcher?.id}
            role={pitcherRole}
            stat={
              pitcherStatObj ? (
                <div className="text-white/50">
                  {formatPitcherStat(pitcherStatObj)}
                </div>
              ) : null
            }
          />

          <div className="flex flex-col items-center justify-center  p-3">
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
            name={compactPlayerName(linescore?.offense?.batter)}
            onSelect={onPlayerSelect}
            playerId={linescore?.offense?.batter?.id}
            role={batterRole}
            stat={
              getBatterGameStat(linescore?.offense?.batter?.id) != null ? (
                <div className={`text-white/50 `}>
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
