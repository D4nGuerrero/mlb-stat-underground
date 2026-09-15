import { useMemo } from 'react';
import { Modal } from '../../../components/ui';
import { compactPlayerName, playerHeadshotUrl, FALLBACK_HEADSHOT } from '../../../utils/mlbHelpers';
import {
  collectPlayerGameAbs,
  formatAbsRecap,
  formatCurrentPaBlurb,
  formatGameBattingLine,
  formatGamePitchingLine,
  formatPlayInning,
} from '../utils/playerGameAbs';

function AbsPlayRow({ play, current = false, away, home, getPlayBadge, onOpenPlay }) {
  const badge = getPlayBadge?.(play.result?.eventType, play);
  const inning = formatPlayInning(play);
  const score = `${away?.abbreviation ?? ''} ${play.result?.awayScore ?? 0}–${home?.abbreviation ?? ''} ${play.result?.homeScore ?? 0}`;
  const pitches = (play.playEvents ?? []).filter((event) => event?.isPitch).length;
  const title = current
    ? 'In progress'
    : (badge?.label || play.result?.event || 'Plate appearance');
  const detail = current
    ? formatCurrentPaBlurb(play)
    : (play.result?.description || play.result?.event);

  return (
    <button
      type="button"
      onClick={() => onOpenPlay?.(play)}
      className="block w-full px-3 py-3 text-left transition-colors hover:bg-slate-900/70 sm:px-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-16 flex-shrink-0 text-center">
          <div className="font-mono text-xs font-black text-slate-300">{inning}</div>
          {current && (
            <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-amber-300">
              Live
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${
                current
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : badge?.cls || 'border-slate-600 bg-slate-800 text-slate-200'
              }`}
            >
              {title}
            </span>
            {!current && (
              <>
                <span className="font-mono text-[11px] font-semibold text-slate-500">{score}</span>
                {pitches > 0 && (
                  <span className="font-mono text-[11px] font-semibold text-slate-500">
                    {pitches} pitch{pitches === 1 ? '' : 'es'}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-200">
            {detail}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PlayerGameAbsSheet({
  open,
  playerId,
  onClose,
  allPlays,
  currentPlay,
  away,
  home,
  getGamePlayer,
  getPlayBadge,
  onOpenPlay,
  onOpenPlayer,
}) {
  const boxPlayer = getGamePlayer?.(playerId);
  const person = boxPlayer?.person || boxPlayer;
  const lastName = compactPlayerName(person, person?.fullName || person?.lastName || 'Player');
  const fullName = person?.fullName || lastName;
  const battingStat = boxPlayer?.stats?.batting;
  const pitchingStat = boxPlayer?.stats?.pitching;
  const { batting, pitching, currentBatting, currentPitching } = useMemo(
    () => collectPlayerGameAbs(allPlays, playerId, currentPlay),
    [allPlays, playerId, currentPlay],
  );

  const recap = formatAbsRecap(batting, lastName);
  const battingLine = formatGameBattingLine(battingStat);
  const pitchingLine = formatGamePitchingLine(pitchingStat);
  const showBatting = batting.length > 0 || Boolean(currentBatting) || Number(battingStat?.plateAppearances || battingStat?.atBats) > 0;
  const showPitching = pitching.length > 0 || Boolean(currentPitching);

  return (
    <Modal
      open={open}
      onClose={onClose}
      backDismiss
      historyKey="playerGameAbs"
      align="bottom"
      size="lg"
      className="px-0 py-0 sm:px-4 sm:py-4"
      panelClassName="mx-auto max-h-[90vh] w-full bg-[#101827] border-slate-700/70 p-0 flex flex-col overflow-hidden sm:w-[min(96vw,36rem)]"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 z-20 bg-[#101827]">
        <div className="h-1 w-10 rounded-full bg-slate-600" />
      </div>

      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-[#101827]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={playerHeadshotUrl(playerId)}
            alt=""
            className="h-12 w-12 rounded-full object-cover border border-slate-700 bg-slate-800"
            onError={(event) => { event.currentTarget.src = FALLBACK_HEADSHOT; }}
          />
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-white">{fullName}</div>
            <div className="text-xs font-semibold text-slate-400">
              {showBatting ? battingLine : pitchingLine || 'Today\'s plate appearances'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-slate-900 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Close at-bats"
        >
          <i className="fa-solid fa-xmark" aria-hidden />
        </button>
      </div>

      <div className="gameday-scroll-rail min-h-0 flex-1 overflow-y-auto">
        {showBatting && (
          <div className="border-b border-slate-800 px-4 py-3 sm:px-5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1.5">
              Quick recap
            </div>
            <p className="text-sm font-semibold leading-snug text-slate-100">{recap}</p>
          </div>
        )}

        {showBatting && (
          <section>
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2 sm:px-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                At-bats
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {batting.length + (currentBatting ? 1 : 0)} PA
              </div>
            </div>
            {currentBatting || batting.length ? (
              <div className="divide-y divide-slate-800/80">
                {batting.map((play) => (
                  <AbsPlayRow
                    key={play.about?.atBatIndex ?? play.about?.startTime}
                    play={play}
                    away={away}
                    home={home}
                    getPlayBadge={getPlayBadge}
                    onOpenPlay={onOpenPlay}
                  />
                ))}
                {currentBatting && (
                  <AbsPlayRow
                    play={currentBatting}
                    current
                    away={away}
                    home={home}
                    getPlayBadge={getPlayBadge}
                    onOpenPlay={onOpenPlay}
                  />
                )}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No plate appearances yet this game.
              </div>
            )}
          </section>
        )}

        {showPitching && (
          <section className={showBatting ? 'border-t border-slate-800' : ''}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2 sm:px-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Batters faced
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {pitchingLine || `${pitching.length} PA`}
              </div>
            </div>
            <div className="divide-y divide-slate-800/80">
              {pitching.map((play) => (
                <AbsPlayRow
                  key={`p-${play.about?.atBatIndex ?? play.about?.startTime}`}
                  play={play}
                  away={away}
                  home={home}
                  getPlayBadge={getPlayBadge}
                  onOpenPlay={onOpenPlay}
                />
              ))}
              {currentPitching && (
                <AbsPlayRow
                  play={currentPitching}
                  current
                  away={away}
                  home={home}
                  getPlayBadge={getPlayBadge}
                  onOpenPlay={onOpenPlay}
                />
              )}
            </div>
          </section>
        )}

        {!showBatting && !showPitching && (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-black text-slate-200">No plate appearances yet</div>
            <div className="mt-1 text-xs text-slate-500">
              This player has not come to the plate or recorded a batter faced in this game.
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => onOpenPlayer?.(playerId)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-accent-500/40 hover:text-accent-300"
        >
          Open player page
        </button>
      </div>
    </Modal>
  );
}
