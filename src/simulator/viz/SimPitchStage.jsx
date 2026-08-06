import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import LiveAtBatVisual from '../../components/LiveAtBatVisual';
import { assetUrl } from '../../utils/baseUrl.js';
import { PITCH_RESULT_LABELS, PITCH_DEFS } from '../constants.js';
import { AT_BAT_ANIMATION_MS } from '../../pitchfx/atBatPitchFx.js';
import { simPitchesToPlayEvents } from '../pitchTheater.js';
import { CardRatingsInline } from '../components/PlayerCard';
import SimOutcomeStage from './SimOutcomeStage';

/**
 * Live pitch-by-pitch theater using existing Gameday LiveAtBatVisual (pitch flight).
 * Does not remount the visual every pitch — that broke flight animation.
 */
export default function SimPitchStage({
  play,
  batter = null,
  pitcher = null,
  venueId = null,
  batterTeamId = null,
  sessionId = 'sim',
  showOutcome = false,
  onThrowPitch,
  onOutcomeDone,
  paLabel = '',
  gameMeta = null,
  className = '',
}) {
  const pitches = useMemo(() => play?.pitches || [], [play?.pitches]);
  const pitchCount = pitches.length;
  const isComplete = Boolean(play?.complete || showOutcome);
  const isIbb = play?.outcome === 'IBB' || play?.intentionalWalk;

  // Soft gate: after throw, wait for anim duration (primary) + onPitchLanded (early unlock)
  const [gateOpen, setGateOpen] = useState(true);
  const gateTimerRef = useRef(null);

  const openGate = useCallback(() => {
    setGateOpen(true);
    if (gateTimerRef.current) {
      window.clearTimeout(gateTimerRef.current);
      gateTimerRef.current = null;
    }
  }, []);

  const closeGateBriefly = useCallback(() => {
    setGateOpen(false);
    if (gateTimerRef.current) window.clearTimeout(gateTimerRef.current);
    // Match Gameday pitch flight length; slightly longer so trail can finish
    gateTimerRef.current = window.setTimeout(openGate, AT_BAT_ANIMATION_MS + 200);
  }, [openGate]);

  useEffect(() => () => {
    if (gateTimerRef.current) window.clearTimeout(gateTimerRef.current);
  }, []);

  // Stable playKey for the AB so PitchCanvas sees isNewPitch (not full remount)
  const abKey = `${sessionId}-${play?.batterId ?? 'b'}-${play?.inning ?? 'i'}`;

  const playEvents = useMemo(
    () => simPitchesToPlayEvents(pitches, { playKey: abKey }),
    [pitches, abKey],
  );

  const batSide = batter?.batsHand || 'R';
  const currentPlay = useMemo(() => ({
    about: {
      atBatIndex: Number(play?.batterId) || 1,
      isComplete: false,
    },
    matchup: { batSide: { code: batSide } },
    playEvents,
  }), [play?.batterId, batSide, playEvents]);

  const handleLanded = useCallback(() => {
    openGate();
  }, [openGate]);

  const activePitch = pitchCount > 0 ? pitches[pitchCount - 1] : null;
  const countLabel = activePitch?.count
    ?? (play?.balls != null ? `${play.balls}-${play.strikes}` : '0-0');

  // Result theater (not pitch flight)
  if (showOutcome && play?.outcome) {
    return (
      <SimOutcomeStage
        key={`out-${abKey}-${play.outcome}-${pitchCount}`}
        play={play}
        venueId={venueId}
        batSide={batSide}
        onContinue={onOutcomeDone}
        className={className}
      />
    );
  }

  if (!play) {
    return (
      <div className={`rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center ${className}`}>
        <p className="text-slate-400 text-sm">Press throw pitch to start the at-bat.</p>
      </div>
    );
  }

  const canThrow = gateOpen && !isComplete;
  let advanceLabel = 'Throw next pitch';
  let advanceHint = `Count ${countLabel}`;
  if (isIbb && !isComplete) {
    advanceLabel = 'Issue IBB';
    advanceHint = paLabel;
  } else if (pitchCount === 0) {
    advanceLabel = 'Throw first pitch';
    advanceHint = 'Live — result rolled on throw';
  } else if (!gateOpen) {
    advanceLabel = 'Pitch in flight…';
    advanceHint = activePitch
      ? (PITCH_RESULT_LABELS[activePitch.result] || activePitch.result)
      : '';
  }

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden ${className}`}>
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            Live AB · {play.inning || ''}
            {paLabel ? ` · ${paLabel}` : ''}
          </div>
          <div className="text-sm text-slate-100 font-semibold truncate">
            {play.batter}
            <span className="text-slate-500 font-normal"> vs </span>
            {play.pitcher}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {gameMeta && (
            <div className="text-center hidden sm:block">
              <div className="text-[9px] uppercase text-slate-500">Game</div>
              <div className="font-mono text-xs text-slate-300">
                {gameMeta.awayScore}-{gameMeta.homeScore} · {gameMeta.outs} out
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-[9px] uppercase text-slate-500">Count</div>
            <div className={`font-mono text-lg font-bold text-accent-400`}>{countLabel}</div>
          </div>
        </div>
      </div>

      {(batter?.card || pitcher?.card) && (
        <div className="px-3 py-2 border-b border-slate-800/80 flex flex-wrap gap-3 justify-between">
          {batter?.card && (
            <div className="min-w-0">
              <div className="text-[9px] text-slate-500 uppercase mb-0.5">Batter</div>
              <CardRatingsInline card={batter.card} />
            </div>
          )}
          {pitcher?.card && (
            <div className="min-w-0 text-right">
              <div className="text-[9px] text-slate-500 uppercase mb-0.5">Pitcher</div>
              <CardRatingsInline card={pitcher.card} className="justify-end" />
            </div>
          )}
        </div>
      )}

      <div className="relative bg-slate-950">
        {playEvents.length > 0 ? (
          <LiveAtBatVisual
            key={abKey}
            venueId={venueId}
            exteriorFailed={!venueId}
            gameDateTime={new Date().toISOString()}
            currentPlay={currentPlay}
            playEvents={playEvents}
            szTop={3.23}
            szBot={1.63}
            gamePk={abKey}
            batSide={batSide}
            batterIsAway={play.battingSide === 'away'}
            batterTeamId={batterTeamId}
            baseballModelUrl={assetUrl('baseball-centered.glb')}
            showPitchToast
            showPitchTrails
            animateLatestPitchOnHydrate
            onPitchLanded={handleLanded}
            className="w-full border-0 rounded-none"
          />
        ) : (
          <div className="h-52 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-slate-200 text-sm font-semibold">0–0</p>
            <p className="text-slate-400 text-sm">Throw first pitch for Gameday flight animation.</p>
          </div>
        )}
      </div>

      {activePitch && (
        <div className="px-3 py-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
          <span className="font-mono text-slate-300">
            #{activePitch.num}{' '}
            <span className={PITCH_DEFS[activePitch.type]?.color || 'text-slate-400'}>
              {activePitch.type}
            </span>
            {' '}
            {activePitch.velocity} mph
          </span>
          <span className={`font-semibold ${
            activePitch.result === 'X' ? 'text-blue-300'
              : activePitch.result === 'B' || activePitch.result === 'HBP' ? 'text-emerald-300'
                : 'text-red-300'
          }`}
          >
            {PITCH_RESULT_LABELS[activePitch.result] || activePitch.result}
            {activePitch.ev != null && (
              <span className="ml-2 font-mono text-slate-500 font-normal">
                {activePitch.ev} ev · {activePitch.la}°
              </span>
            )}
          </span>
        </div>
      )}

      {pitchCount > 0 && (
        <div className="px-3 py-2 border-t border-slate-800/60 flex gap-1 flex-wrap items-center">
          <span className="text-[10px] text-slate-500 mr-1">Thrown:</span>
          {pitches.map((p) => (
            <span
              key={p.num}
              title={PITCH_RESULT_LABELS[p.result] || p.result}
              className={[
                'min-w-[1.5rem] h-6 px-1 rounded-md text-[10px] font-mono flex items-center justify-center border',
                `bg-accent-500/20 border-accent-500/40 text-accent-300`,
              ].join(' ')}
            >
              {p.num}:{p.result}
            </span>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-slate-800 bg-slate-900">
        <button
          type="button"
          onClick={() => {
            if (!canThrow) return;
            closeGateBriefly();
            onThrowPitch?.();
          }}
          disabled={!canThrow}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-black/20 ${
            canThrow
              ? `bg-accent-600 hover:bg-accent-500 border-accent-500/40 text-white active:scale-[0.99]`
              : 'bg-slate-800 border-slate-700 text-slate-500 cursor-wait'
          }`}
        >
          <span>{advanceLabel}</span>
          {advanceHint && (
            <span className="text-[11px] font-mono font-normal text-white/70">{advanceHint}</span>
          )}
        </button>
      </div>
    </div>
  );
}
