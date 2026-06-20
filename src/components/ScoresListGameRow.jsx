import { teamLogoUrl, formatFinalStatus } from '../utils/mlbHelpers';
import { LiveSituationStack } from './LiveGameIndicators';

export const LIST_GAME_ROW_GRID =
  'grid grid-cols-[4rem_3.5rem_minmax(0,1fr)_3.5rem_4rem] items-center gap-x-3';

const COMPACT_GAME_ROW_GRID =
  'grid grid-cols-[2.5rem_1.75rem_minmax(0,1fr)_1.75rem_2.5rem] items-center gap-x-1.5';

const ULTRA_COMPACT_GAME_ROW_GRID =
  'grid grid-cols-[2rem_1.35rem_minmax(0,1fr)_1.35rem_2rem] items-center gap-x-1';

function ListTeamLogo({ team, record, onTeamClick, compact = false, ultraCompact = false }) {
  return (
    <div className={`flex flex-col items-center justify-self-center ${ultraCompact ? 'w-8 gap-0' : compact ? 'w-10 gap-0.5' : 'w-16 gap-1'}`}>
      <img
        src={teamLogoUrl(team.id)}
        className={`object-contain ${onTeamClick ? 'cursor-pointer' : ''} ${ultraCompact ? 'w-7 h-7' : compact ? 'w-9 h-9' : 'w-14 h-14'}`}
        alt={team.abbreviation}
        onClick={onTeamClick}
      />
      <span className={`font-bold text-slate-500 font-mono leading-none tabular-nums ${ultraCompact ? 'text-[8px] h-2.5' : compact ? 'text-[9px] h-3' : 'text-[14px] h-3.5'}`}>
        {record ? `${record.wins}-${record.losses}` : '\u00A0'}
      </span>
    </div>
  );
}

function ListGameScore({ score, isWinner, isFinal, show, compact = false, ultraCompact = false }) {
  return (
    <div className={`flex items-center justify-center justify-self-center w-full ${ultraCompact ? 'min-h-[1.6rem]' : compact ? 'min-h-[2rem]' : 'min-h-[3rem]'}`}>
      {show && (
        <span
          className={`font-display tabular-nums leading-none ${
            ultraCompact ? 'text-2xl' : compact ? 'text-3xl' : 'text-5xl'
          } ${isWinner ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function getGameStatusInfo(game) {
  const state = game.status?.abstractGameState ?? '';
  const detail = game.status?.detailedState || '';
  const coded = game.status?.codedGameState || '';
  const isLive = state === 'Live';
  const isFinal = state === 'Final';
  const isDelayed = detail.toLowerCase().includes('delay') || coded === 'D';
  const isPostponed = detail.toLowerCase().includes('postponed') || coded === 'PO';
  return { isLive, isFinal, isDelayed, isPostponed, detail };
}

function liveSituationProps(compact, ultraCompact) {
  if (!compact && !ultraCompact) {
    return { size: 'sm', showCount: false };
  }
  if (ultraCompact) {
    return {
      size: 'xs',
      showCount: false,
      inningClassName: 'text-[7px] font-bold text-slate-300 tracking-wide font-mono leading-none',
    };
  }
  return {
    size: 'xs',
    showCount: false,
    inningClassName: 'text-[8px] font-bold text-slate-300 tracking-wide font-mono leading-none',
  };
}

function ListGameCenter({ game, status, noHitAlerts, compact = false, ultraCompact = false }) {
  const { isLive, isFinal, isDelayed, isPostponed } = status;
  const isPreview = !isFinal && !isLive;
  const situation = liveSituationProps(compact, ultraCompact);

  return (
    <div className={`flex flex-col items-center justify-center text-center min-w-0 justify-self-center ${ultraCompact ? 'gap-0' : compact ? 'gap-0.5' : 'gap-1'}`}>
      {isPostponed ? (
        <span className={`font-bold text-orange-400 tracking-widest ${ultraCompact ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[10px]'}`}>PPD</span>
      ) : isDelayed && isLive && game.linescore ? (
        <div className="flex flex-col items-center gap-0.5">
          <span className={`font-bold text-yellow-400 tracking-wide ${ultraCompact ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[9px]'}`}>DELAYED</span>
          <LiveSituationStack linescore={game.linescore} {...situation} />
        </div>
      ) : isDelayed && isLive ? (
        <span className={`font-bold text-yellow-400 tracking-wide ${ultraCompact ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[10px]'}`}>DELAYED</span>
      ) : isDelayed ? (
        <>
          <span className={`font-bold text-yellow-400 tracking-wide ${ultraCompact ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[10px]'}`}>DELAYED</span>
          {game.gameDate && (
            <span className={`text-slate-600 font-mono ${ultraCompact ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[9px]'}`}>
              {new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </>
      ) : isLive && game.linescore ? (
        <LiveSituationStack linescore={game.linescore} {...situation} />
      ) : isLive ? (
        <span className={`flex items-center gap-1 font-bold text-red-400 ${ultraCompact ? 'text-[8px]' : compact ? 'text-[9px]' : 'text-[11px]'}`}>
          <span className={`bg-red-400 rounded-full live-pulse ${ultraCompact ? 'w-1 h-1' : compact ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
          LIVE
        </span>
      ) : isFinal ? (
        <span className={`font-bold text-slate-400 tracking-widest ${ultraCompact ? 'text-[8px]' : compact ? 'text-[9px]' : 'text-xs'}`}>
          {formatFinalStatus(game.linescore)}
        </span>
      ) : (
        <span className={`text-slate-400 font-semibold ${ultraCompact ? 'text-[8px]' : compact ? 'text-[9px]' : 'text-xs'}`}>
          {game.gameDate
            ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : '—'}
        </span>
      )}
      {isPreview && !isPostponed && !ultraCompact && (
        <div className={`text-slate-600 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
          {game.teams.away.team.abbreviation} @ {game.teams.home.team.abbreviation}
        </div>
      )}
      {noHitAlerts?.map((a) => (
        <span
          key={a.side}
          className={`mt-2 font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 ${ultraCompact ? 'text-[7px]' : compact ? 'text-[8px]' : 'text-[9px]'}`}
        >
          {a.label}
        </span>
      ))}
    </div>
  );
}

export default function ScoresListGameRow({
  game,
  onClick,
  onAwayTeamClick,
  onHomeTeamClick,
  noHitAlerts = null,
  className = '',
  isSelected = false,
  compact = false,
  ultraCompact = false,
}) {
  const status = getGameStatusInfo(game);
  const { isLive, isFinal } = status;
  const isPreview = !isFinal && !isLive;
  const awayScore = parseInt(game.teams?.away?.score ?? 0, 10);
  const homeScore = parseInt(game.teams?.home?.score ?? 0, 10);
  const awayWin = isFinal && awayScore > homeScore;
  const homeWin = isFinal && homeScore > awayScore;
  const awayRec = game.teams?.away?.leagueRecord;
  const homeRec = game.teams?.home?.leagueRecord;

  const handleAwayTeamClick = onAwayTeamClick
    ? (e) => {
        e.stopPropagation();
        onAwayTeamClick(e);
      }
    : undefined;

  const handleHomeTeamClick = onHomeTeamClick
    ? (e) => {
        e.stopPropagation();
        onHomeTeamClick(e);
      }
    : undefined;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      className={[
        ultraCompact ? ULTRA_COMPACT_GAME_ROW_GRID : compact ? COMPACT_GAME_ROW_GRID : LIST_GAME_ROW_GRID,
        ultraCompact ? 'px-1.5 py-1' : compact ? 'px-2 py-2' : 'px-4 py-4',
        'transition-colors',
        onClick ? 'cursor-pointer hover:bg-slate-800/30 active:bg-slate-800/40' : '',
        isSelected ? 'bg-slate-800/80' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <ListTeamLogo
        team={game.teams.away.team}
        record={awayRec}
        onTeamClick={handleAwayTeamClick}
        compact={compact}
        ultraCompact={ultraCompact}
      />
      <ListGameScore
        score={awayScore}
        isWinner={awayWin}
        isFinal={isFinal}
        show={!isPreview}
        compact={compact}
        ultraCompact={ultraCompact}
      />
      <ListGameCenter game={game} status={status} noHitAlerts={noHitAlerts} compact={compact} ultraCompact={ultraCompact} />
      <ListGameScore
        score={homeScore}
        isWinner={homeWin}
        isFinal={isFinal}
        show={!isPreview}
        compact={compact}
        ultraCompact={ultraCompact}
      />
      <ListTeamLogo
        team={game.teams.home.team}
        record={homeRec}
        onTeamClick={handleHomeTeamClick}
        compact={compact}
        ultraCompact={ultraCompact}
      />
    </div>
  );
}
