import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import PitchCanvas from './PitchCanvas';
import { AT_BAT_STRIKE_ZONE_CLIP } from '../pitchfx/atBatPitchFx';
import LivePitchToast from './LivePitchToast';
import { getPitchResultKind } from '../utils/liveRecentPlays';
import { formatPitchDescriptionWithAbsContext } from '../utils/absChallenge';
import {
  stadiumExteriorUrl,
  stadiumInfieldUrl,
  stadiumTimeOfDay,
  batterPlateUrl,
  batterPlateFallbackUrl,
  batterLayeredPlateUrls,
} from '../utils/mlbHelpers';

function pitchEventsSignature(playEvents) {
  const pitches = (playEvents ?? []).filter((e) => e.isPitch);
  if (!pitches.length) return '0';
  const last = pitches[pitches.length - 1];
  return `${pitches.length}|${last.playId ?? ''}|${last.pitchNumber ?? ''}|${last.endTime ?? last.startTime ?? ''}|${last.details?.description ?? ''}`;
}

function hasRenderablePitchEvents(playEvents) {
  return (playEvents ?? []).some((event) => event?.isPitch && event?.pitchData?.coordinates);
}

function classifyPlayToast(eventType = '') {
  if (/stolen|caught_stealing|pickoff/i.test(eventType)) return 'runner';
  if (/out|strikeout|double_play|force/i.test(eventType)) return 'out';
  if (/single|double|triple|home_run|hit/i.test(eventType)) return 'play';
  return 'misc';
}

function buildLiveToastItem(playEvents, currentPlay) {
  if (currentPlay?.about?.isComplete && currentPlay?.result?.description) {
    const eventType = currentPlay.result.eventType || currentPlay.result.event || '';
    return {
      id: `play-${currentPlay.about?.atBatIndex}-${currentPlay.about?.endTime ?? currentPlay.result.description}`,
      title: currentPlay.result.event || currentPlay.result.eventType?.replace(/_/g, ' ') || 'Play Result',
      subtitle: currentPlay.result.description,
      resultKind: classifyPlayToast(eventType),
    };
  }

  const events = playEvents ?? [];
  const last = events[events.length - 1];
  if (!last) return null;

  if (last.isPitch) {
    const lastPitchEventIndex = (() => {
      for (let idx = events.length - 1; idx >= 0; idx -= 1) {
        if (events[idx] === last) return idx;
      }
      return -1;
    })();
    const description = formatPitchDescriptionWithAbsContext(
      last.details?.description || last.details?.call?.description || 'Pitch',
      last,
      events,
      lastPitchEventIndex,
    );
    const pitchType = last.details?.type?.description;
    const mph = last.pitchData?.startSpeed ? Math.round(last.pitchData.startSpeed) : null;
    return {
      id: `pitch-${last.playId ?? ''}-${last.pitchNumber ?? ''}-${last.endTime ?? last.startTime ?? events.length}`,
      title: description,
      subtitle: [pitchType, mph != null ? `${mph} mph` : null].filter(Boolean).join(' · '),
      resultKind: getPitchResultKind(description, last.details?.isInPlay),
    };
  }

  const eventType = last.details?.eventType || last.details?.code || '';
  const description = last.details?.description || last.details?.event || 'Game Event';
  return {
    id: `event-${currentPlay?.about?.atBatIndex ?? ''}-${last.playId ?? ''}-${last.endTime ?? last.startTime ?? events.length}`,
    title: last.details?.event || eventType.replace(/_/g, ' ') || 'Game Event',
    subtitle: description,
    resultKind: classifyPlayToast(eventType),
  };
}

function latestPitchRowKey(playEvents, currentPlay) {
  const events = playEvents ?? [];
  for (let idx = events.length - 1; idx >= 0; idx -= 1) {
    if (events[idx]?.isPitch) {
      return `live-pitch-${currentPlay?.about?.atBatIndex}-${idx}`;
    }
  }
  return null;
}

const FIELD_ASPECT = 315 / 270;
const STRIKE_ZONE_FIELD_WIDTH_PCT = (AT_BAT_STRIKE_ZONE_CLIP.width / 1158) * 100;
// Horizontal placement of the strike-zone/pitch overlay inside the stadium field.
// Lower than 50 moves the whole zone/trail/dots left; higher moves it right.
const STRIKE_ZONE_FIELD_LEFT_PCT = 49.1;
// Raise/lower the strike-zone canvas within the stadium field. Smaller = higher, larger = lower.
const STRIKE_ZONE_FIELD_TOP_PCT = 34.2;
const BATTER_FIELD_WIDTH_PCT = 17.1278;
const BATTER_FIELD_TOP_PCT = 24.5;
const BATTER_FIELD_SIDE_OFFSET_PCT = 26.5;

const LiveAtBatVisual = memo(function LiveAtBatVisual({
  venueId,
  exteriorFailed,
  gameDateTime,
  currentPlay,
  playEvents,
  szTop,
  szBot,
  gamePk,
  batSide,
  batterIsAway,
  batterTeamId = null,
  season = null,
  onRecentRowReady,
  baseballModelUrl = null,
  strikeZoneTopImageUrl = null,
  strikeZoneBottomImageUrl = null,
  singleFieldImageUrl = null,
  showPitchToast = true,
  showPitchTrails = true,
  showHotZones = false,
  usePurpleInPlayOuts = false,
  immersiveField = false,
  className = '',
}) {
  const incomingAtBatIndex = currentPlay?.about?.atBatIndex ?? null;
  const sig = useMemo(() => pitchEventsSignature(playEvents), [playEvents]);
  const incomingHasPitches = hasRenderablePitchEvents(playEvents);
  const clearHeldPlayTimerRef = useRef(null);
  const [displaySnapshot, setDisplaySnapshot] = useState(() => ({
    atBatIndex: incomingAtBatIndex,
    currentPlay,
    playEvents,
  }));

  useEffect(() => () => {
    if (clearHeldPlayTimerRef.current) window.clearTimeout(clearHeldPlayTimerRef.current);
  }, []);

  useEffect(() => {
    if (clearHeldPlayTimerRef.current) {
      window.clearTimeout(clearHeldPlayTimerRef.current);
      clearHeldPlayTimerRef.current = null;
    }

    setDisplaySnapshot((prev) => {
      const prevHasPitches = hasRenderablePitchEvents(prev.playEvents);
      const sameAtBat = prev.atBatIndex === incomingAtBatIndex;

      if (incomingHasPitches || sameAtBat || !prevHasPitches) {
        return { atBatIndex: incomingAtBatIndex, currentPlay, playEvents };
      }

      // MLB can advance currentPlay to the next batter before it includes any
      // new playEvents. Hold the completed visual briefly so the final pitch
      // does not clear, flash back in, then clear again during handoff.
      clearHeldPlayTimerRef.current = window.setTimeout(() => {
        clearHeldPlayTimerRef.current = null;
        setDisplaySnapshot({ atBatIndex: incomingAtBatIndex, currentPlay, playEvents });
      }, 1800);
      return prev;
    });
  }, [incomingAtBatIndex, incomingHasPitches, sig, currentPlay, playEvents]);

  const stablePlayEvents = displaySnapshot.playEvents;
  const visualCurrentPlay = displaySnapshot.currentPlay;

  const [toastItem, setToastItem] = useState(null);
  const lastToastIdRef = useRef(null);
  const lastLandedPitchIdRef = useRef(null);
  const toastItemRef = useRef(null);
  const pendingToastRef = useRef(null);

  useEffect(() => {
    toastItemRef.current = toastItem;
  }, [toastItem]);

  useEffect(() => {
    if (!showPitchToast) return;
    const item = buildLiveToastItem(stablePlayEvents, visualCurrentPlay);
    if (!item || !item.id?.startsWith('play-') || lastToastIdRef.current === item.id) return;

    const lastPitch = [...(stablePlayEvents ?? [])].reverse().find((event) => event?.isPitch);
    const lastPitchId = lastPitch?.playId ?? lastPitch?.pitchNumber;
    if (
      lastPitchId != null &&
      String(lastLandedPitchIdRef.current) !== String(lastPitchId)
    ) {
      return;
    }

    lastToastIdRef.current = item.id;
    const nextToast = {
      ...item,
      rowKey: visualCurrentPlay?.about?.atBatIndex != null
        ? `atbat-${visualCurrentPlay.about.atBatIndex}`
        : null,
    };
    if (toastItemRef.current) {
      pendingToastRef.current = nextToast;
      return;
    }
    setToastItem(nextToast);
  }, [sig, stablePlayEvents, visualCurrentPlay, showPitchToast]);

  const showLandedPitchToast = useCallback((pitch) => {
    if (!showPitchToast) return;
    const pitchId = pitch?.event?.playId ?? pitch?.num;
    if (pitchId != null && String(lastLandedPitchIdRef.current) === String(pitchId)) return;

    const item = buildLiveToastItem(stablePlayEvents, visualCurrentPlay);
    if (!item || lastToastIdRef.current === item.id) return;

    lastLandedPitchIdRef.current = pitchId;
    lastToastIdRef.current = item.id;
    setToastItem({
      ...item,
      rowKey: latestPitchRowKey(stablePlayEvents, visualCurrentPlay),
    });
  }, [stablePlayEvents, visualCurrentPlay, showPitchToast]);

  const clearToast = useCallback(() => {
    setToastItem((current) => {
      if (current?.rowKey) onRecentRowReady?.(current.rowKey);
      const pending = pendingToastRef.current;
      if (pending) {
        pendingToastRef.current = null;
        return pending;
      }
      return null;
    });
  }, [onRecentRowReady]);

  const exteriorTimeOfDay = stadiumTimeOfDay(gameDateTime);
  const batterSide = batterIsAway ? 'away' : 'home';
  const batterLayerUrls = batterLayeredPlateUrls({
    season,
    stand: batSide,
    teamId: batterTeamId,
  });
  const hasLayeredBatterArt = Boolean(batterLayerUrls.jersey && batterLayerUrls.pants);
  const [batterArtFailed, setBatterArtFailed] = useState(false);
  const strikeZoneTopSrc =
    strikeZoneTopImageUrl ??
    (venueId && !exteriorFailed ? stadiumExteriorUrl(venueId, exteriorTimeOfDay) : null);
  const strikeZoneBottomSrc = strikeZoneBottomImageUrl ?? stadiumInfieldUrl();
  const useSingleFieldImage = Boolean(singleFieldImageUrl);
  const batterFieldSideStyle =
    String(batSide).toUpperCase() === 'L'
      ? { right: `${BATTER_FIELD_SIDE_OFFSET_PCT}%` }
      : { left: `${BATTER_FIELD_SIDE_OFFSET_PCT}%` };
  const batterArt = hasLayeredBatterArt && !batterArtFailed ? (
    <div className="absolute inset-0">
      {[batterLayerUrls.pants, batterLayerUrls.jersey].map((src) => (
        <img
          key={src}
          src={src}
          className="absolute inset-0 h-full w-full object-contain object-top"
          alt=""
          onError={() => setBatterArtFailed(true)}
        />
      ))}
    </div>
  ) : (
    <img
      src={batterPlateUrl(batSide, batterSide)}
      className="h-full w-full object-contain object-top"
      alt=""
      onError={(e) => {
        if (!e.target.dataset.fallback) {
          e.target.dataset.fallback = '1';
          e.target.src = batterPlateFallbackUrl(batSide, batterSide);
          return;
        }
        e.target.style.display = 'none';
      }}
    />
  );

  useEffect(() => {
    setBatterArtFailed(false);
  }, [batterLayerUrls.jersey, batterLayerUrls.pants]);

  const fieldLayerClass = immersiveField
    ? 'absolute left-1/2 top-1/2 w-[285%] -translate-x-1/2 -translate-y-1/2 sm:w-[185%] md:w-[140%] lg:w-[155%] 2xl:w-[145%]'
    : 'absolute left-1/2 top-1/2 w-[285%] -translate-x-1/2 -translate-y-1/2 sm:w-[185%] md:w-[140%] lg:w-full';
  const pitchOverlayFieldClass = immersiveField
    ? 'absolute left-1/2 top-1/2 w-[285%] -translate-x-1/2 -translate-y-1/2 sm:w-[185%] md:w-[140%] lg:w-[155%] 2xl:w-[145%]'
    : 'absolute left-1/2 top-1/2 w-[285%] -translate-x-1/2 -translate-y-1/2 sm:w-[185%] md:w-[140%] lg:w-full';
  const fieldAnchoredBatterClass = immersiveField
    ? 'absolute z-20 pointer-events-none'
    : 'absolute z-20 pointer-events-none lg:hidden';

  return (
    <div
      // MLB uses an invisible spacer image for this same idea: width is owned by
      // the layout, and height follows the fixed stadium field aspect ratio.
      className={`relative overflow-hidden sm:rounded-2xl border border-slate-700/60 flex flex-col ${className}`}
      style={{ aspectRatio: `${FIELD_ASPECT}` }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* MLB-style field scaling: keep a fixed-ratio field larger than the viewport, then crop it. */}
        <div
          className={fieldLayerClass}
          style={{
            aspectRatio: `${FIELD_ASPECT}`,
            backgroundColor: !strikeZoneTopSrc && !singleFieldImageUrl ? '#0f172a' : undefined,
          }}
        >
          {useSingleFieldImage ? (
            <div
              className="absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${singleFieldImageUrl})`,
                // LMB uses one full-field image. Keep its ratio intact and crop inside the same MLB field viewport.
                // backgroundSize: 'cover',
                backgroundPosition: '20% -70%',
                backgroundSize: '105% auto',
              }}
            />
          ) : (
            <>
              <div
                className="absolute inset-x-0 top-0 h-auto bg-no-repeat"
                style={{
                  backgroundImage: strikeZoneTopSrc ? `url(${strikeZoneTopSrc})` : undefined,
                  // Preserve image ratio while the oversized field layer scales up/down.
                  backgroundSize: 'calc(100% + 1px) auto',
                  aspectRatio: '4 / 3',
                  // backgroundPosition: '50% 0%',
                  backgroundPositionX: '50%, 50%',
                  backgroundPositionY: '2%, 100%'
                
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0  bg-no-repeat"
                style={{
                  backgroundImage: strikeZoneBottomSrc ? `url(${strikeZoneBottomSrc})` : undefined,
                  backgroundSize: 'calc(100% + 1px) auto',
                  backgroundPosition: '50% 74.1%',
                  aspectRatio: 4 /3,
                
                }}
              />
            </>
          )}
        </div>
      </div>

      <div
        className={`pointer-events-none absolute z-20 ${immersiveField ? 'hidden' : 'hidden lg:block'}`}
        style={{
          top: `${BATTER_FIELD_TOP_PCT}%`,
          width: `${BATTER_FIELD_WIDTH_PCT}%`,
          aspectRatio: '144 / 400',
          ...batterFieldSideStyle,
        }}
      >
        {batterArt}
      </div>


{/* TOP LEFT AND TOP RIGHT PILLS VISUAL AT BAT */}
      {/* <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-red-400 tracking-wide">LIVE</span>
          <span className="text-[10px] text-white/80 font-mono ml-1">
            {inningHalf === 'Top' ? '▲' : '▼'}{currentInningOrdinal}
          </span>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-[10px] font-mono text-white font-bold">
            {balls ?? 0}–{strikes ?? 0} · {outs ?? 0} out{outs !== 1 ? 's' : ''}
          </span>
        </div>
      </div> */}

      <div className="absolute inset-0 z-10 overflow-hidden">
        {/* This overlay repeats the same field transform so the strike zone scales with the background. */}
        <div
          className={pitchOverlayFieldClass}
          style={{ aspectRatio: `${FIELD_ASPECT}` }}
        >
          <div
            className={fieldAnchoredBatterClass}
            style={{
              top: `${BATTER_FIELD_TOP_PCT}%`,
              width: `${BATTER_FIELD_WIDTH_PCT}%`,
              aspectRatio: '144 / 400',
              ...batterFieldSideStyle,
            }}
          >
            {batterArt}
          </div>

          <div
            // Tune these percentages to move the zone within the fixed 1158x869 field coordinate space.
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              left: `${STRIKE_ZONE_FIELD_LEFT_PCT}%`,
              top: `${STRIKE_ZONE_FIELD_TOP_PCT}%`,
              width: `${STRIKE_ZONE_FIELD_WIDTH_PCT}%`,
            }}
          >
            <PitchCanvas
              playEvents={stablePlayEvents}
              szTop={szTop}
              szBot={szBot}
              gamePk={gamePk}
              viewMode="strikeZone"
              width={AT_BAT_STRIKE_ZONE_CLIP.width}
              height={AT_BAT_STRIKE_ZONE_CLIP.height}
              responsive
              showPitchTrails={showPitchTrails}
              showHotZones={showHotZones}
              usePurpleInPlayOuts={usePurpleInPlayOuts}
              onPitchLanded={showPitchToast ? showLandedPitchToast : undefined}
              baseballModelUrl={baseballModelUrl}
              className="mx-auto shrink-0"
            />
            {showPitchToast && <LivePitchToast item={toastItem} onComplete={clearToast} />}
          </div>
        </div>
      </div>
    </div>
  );
});

export default LiveAtBatVisual;
