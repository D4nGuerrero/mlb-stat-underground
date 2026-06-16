import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import PitchCanvas from './PitchCanvas';
import { AT_BAT_BALL_COLORS, AT_BAT_STRIKE_ZONE_CLIP } from '../pitchfx/atBatPitchFx';
import LivePitchToast from './LivePitchToast';
import { getPitchResultKind } from '../utils/liveRecentPlays';
import {
  stadiumExteriorUrl,
  stadiumInfieldUrl,
  stadiumTimeOfDay,
  batterPlateUrl,
  batterPlateFallbackUrl,
} from '../utils/mlbHelpers';

function pitchEventsSignature(playEvents) {
  const pitches = (playEvents ?? []).filter((e) => e.isPitch);
  if (!pitches.length) return '0';
  const last = pitches[pitches.length - 1];
  return `${pitches.length}|${last.playId ?? ''}|${last.pitchNumber ?? ''}|${last.endTime ?? last.startTime ?? ''}|${last.details?.description ?? ''}`;
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
    const description = last.details?.description || last.details?.call?.description || 'Pitch';
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
  inningHalf,
  currentInningOrdinal,
  balls,
  strikes,
  outs,
}) {
  const sig = useMemo(() => pitchEventsSignature(playEvents), [playEvents]);
  const stablePlayEvents = useMemo(() => playEvents, [sig]);

  const [toastItem, setToastItem] = useState(null);
  const lastToastIdRef = useRef(null);

  useEffect(() => {
    const item = buildLiveToastItem(playEvents, currentPlay);
    if (!item || lastToastIdRef.current === item.id) return;
    lastToastIdRef.current = item.id;
    setToastItem(item);
  }, [sig, playEvents, currentPlay]);

  const clearToast = useCallback(() => setToastItem(null), []);

  const exteriorTimeOfDay = stadiumTimeOfDay(gameDateTime);
  const batterSide = batterIsAway ? 'away' : 'home';

  const pitchLegend = [
    { color: AT_BAT_BALL_COLORS.ballColorStrike, label: 'Strike' },
    { color: AT_BAT_BALL_COLORS.ballColorBall, label: 'Ball' },
    { color: AT_BAT_BALL_COLORS.ballColorInPlay, label: 'In Play' },
    { color: '#BC0021', label: 'FF trail' },
    { color: '#980065', label: 'FC trail' },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 min-h-[380px] flex flex-col">
      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <div
          className="h-[48%] min-h-[130px] bg-cover bg-center bg-top"
          style={{
            backgroundImage:
              venueId && !exteriorFailed
                ? `url(${stadiumExteriorUrl(venueId, exteriorTimeOfDay)})`
                : undefined,
            backgroundColor: !venueId || exteriorFailed ? '#0f172a' : undefined,
          }}
        />
        <div
          className="flex-1 min-h-[130px] bg-cover"
          style={{
            backgroundImage: `url(${stadiumInfieldUrl()})`,
            backgroundPosition: 'center 30%',
          }}
        />
      </div>

      <div
        className="absolute left-0 right-0 top-[48%] h-16 -translate-y-1/2 z-[1] pointer-events-none bg-gradient-to-b from-transparent via-black/35 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/80 pointer-events-none z-[2]" />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
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
      </div>

      <div className="relative z-10 flex flex-col items-stretch pt-12 pb-20 px-3 w-full">
        <div
          className="relative mx-auto"
          style={{ width: `${AT_BAT_STRIKE_ZONE_CLIP.width}px` }}
        >
          <PitchCanvas
            playEvents={stablePlayEvents}
            szTop={szTop}
            szBot={szBot}
            gamePk={gamePk}
            viewMode="strikeZone"
            width={AT_BAT_STRIKE_ZONE_CLIP.width}
            height={AT_BAT_STRIKE_ZONE_CLIP.height}
            showPitchTrails
            className="mx-auto shrink-0"
          />
          <LivePitchToast item={toastItem} onComplete={clearToast} />
        </div>
     {/* TEST */}
      </div>

      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-end justify-center"
        style={{ height: '110px', width: '140px' }}
      >
        <img
          src={batterPlateUrl(batSide, batterSide)}
          className="max-h-full max-w-full object-contain object-bottom drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]"
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
      </div>
    </div>
  );
});

export default LiveAtBatVisual;
