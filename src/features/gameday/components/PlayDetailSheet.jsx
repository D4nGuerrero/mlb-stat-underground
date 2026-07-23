import { useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui';
import LiveAtBatVisual from '../../../components/LiveAtBatVisual';
import { formatPitchDescriptionWithAbsContext } from '../../../utils/absChallenge';
import { playerHeadshotUrl } from '../../../utils/mlbHelpers';
import {
  BaseDiamondIndicator,
  OutsIndicator,
  getPlayDetailSituation,
} from '../../../components/LiveGameIndicators';

function formatPlayerShortName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name || '-';
  const suffixes = new Set(['Jr.', 'Sr.', 'II', 'III', 'IV', 'V']);
  const suffix = suffixes.has(parts[parts.length - 1]) ? ` ${parts.pop()}` : '';
  return `${parts.at(-1)}${suffix}`;
}

function formatHitMetric(value, digits = 0, fallback = '-') {
  if (value == null || Number.isNaN(Number(value))) return fallback;
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

function PlayDetailStatcastStrip({ hitData }) {
  if (!hitData) return null;
  const hasData = hitData.launchSpeed != null || hitData.totalDistance != null || hitData.launchAngle != null;
  if (!hasData) return null;

  const stats = [
    { label: 'Exit Velocity', value: `${formatHitMetric(hitData.launchSpeed, 1)} mph` },
    { label: 'Distance', value: `${formatHitMetric(hitData.totalDistance, 0)} ft` },
    { label: 'Launch Angle', value: `${formatHitMetric(hitData.launchAngle, 0)} deg` },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 border-y border-slate-700/50 py-3">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className="text-[11px] font-black text-slate-500">{stat.label}</div>
          <div className="mt-0.5 text-xl font-black leading-none text-white tabular-nums">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function PlayDetailSheet({
  selectedPlay,
  closeSheet,
  away,
  home,
  allPlays,
  gamePk,
  onPlayerSelect,
  getPlayBadge,
  getPlayHitData,
  renderHitDataPanel,
  showPitchTrails = false,
  venueId,
  exteriorFailed = false,
  gameDateTime,
  season,
  baseballModelUrl,
  singleFieldImageUrl = null,
  strikeZoneTopImageUrl = null,
  highlightedPitchKey = null,
}) {
  if (!selectedPlay) return null;

  const play = selectedPlay;
  const pitches = (play.playEvents || [])
    .map((event, eventIdx) => ({ event, eventIdx }))
    .filter(({ event }) => event.isPitch);
  const playScored = Boolean(play.about?.isScoringPlay || play.about?.hasScoreChange);
  const playEventsWithContext = (play.playEvents || []).map((event) => ({
    ...event,
    __playScored: playScored,
    __playContext: play,
  }));
  const hitData = getPlayHitData(play);
  const badge = getPlayBadge(play.result?.eventType, play);
  const szT = pitches[pitches.length - 1]?.pitchData?.strikeZoneTop || 3.55;
  const szB = pitches[pitches.length - 1]?.pitchData?.strikeZoneBottom || 1.47;
  const inningStr = `${play.about?.halfInning === 'top' ? 'TOP' : 'BOT'} ${play.about?.inning}`;
  const scoreStr = `${away.abbreviation} ${play.result?.awayScore ?? 0} - ${home.abbreviation} ${play.result?.homeScore ?? 0}`;

  const pitcherName = play.matchup?.pitcher?.fullName || '-';
  const batterName = play.matchup?.batter?.fullName || '-';
  const pitcherDisplay = formatPlayerShortName(pitcherName);
  const batterDisplay = formatPlayerShortName(batterName);
  const pitcherId = play.matchup?.pitcher?.id;
  const batterId = play.matchup?.batter?.id;
  const situation = getPlayDetailSituation(play, allPlays);
  const batSide = play.matchup?.batSide?.code || 'R';
  const batterIsAway = play.about?.halfInning === 'top';
  const batterTeamId = batterIsAway ? away.id : home.id;
  const pitchRowRefs = useRef({});

  useEffect(() => {
    if (!highlightedPitchKey) return;
    const node = pitchRowRefs.current[highlightedPitchKey];
    if (!node) return;
    window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  }, [highlightedPitchKey]);

  return (
    <Modal
      open
      onClose={closeSheet}
      size="lg"
      className="px-0 py-0 sm:px-4 sm:py-4"
      panelClassName="max-h-[88vh] overflow-hidden bg-[#101827] border-slate-700/10 p-0 flex flex-col"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-[#101827] z-10">
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>

      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[#101827]/95 backdrop-blur px-4 sm:px-5 pt-3 pb-3 border-b border-slate-700/40">
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-slate-100 tracking-wide">At Bat Details</span>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-bold text-slate-400 font-mono">{inningStr}</span>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-500 font-mono">{scoreStr}</span>
        </div>
        <button
          onClick={closeSheet}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-sm"
        >
          x
        </button>
      </div>

      <div className="gameday-scroll-rail min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="space-y-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black text-slate-300">
              <span>{inningStr}</span>
              <span className="text-slate-600">|</span>
              <span>{scoreStr}</span>
            </div>
            <div className="text-2xl font-black leading-tight text-white">{badge.label}</div>
            <p className="mt-3 text-base font-bold leading-snug text-slate-100">
              {play.result?.description}
            </p>
          </div>

          <PlayDetailStatcastStrip hitData={hitData} />

          <div className="border- border-slate-700/50 py-4">
            <div className="flex items-center justify-between gap-3">
                <button
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-85"
                  onClick={() => onPlayerSelect(pitcherId)}
                >
                  <img
                    src={playerHeadshotUrl(pitcherId)}
                    className="h-14 w-14 rounded-full object-cover border border-slate-700"
                    alt=""
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-100">
                      {pitcherDisplay}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-slate-500">
                      {play.matchup?.pitchHand?.code
                        ? `${play.matchup.pitchHand.code}HP`
                        : 'Pitcher'}
                      {play.matchup?.pitcher?.primaryNumber ? ` | #${play.matchup.pitcher.primaryNumber}` : ''}
                    </div>
                  </div>
                </button>

                <div className="flex flex-shrink-0 flex-col items-center justify-center gap-1">
                  <BaseDiamondIndicator {...situation.bases} size="md" />
                  <span className="text-base font-bold font-mono text-slate-200 tabular-nums leading-none">
                    {situation.balls}-{situation.strikes}
                  </span>
                  <OutsIndicator outs={situation.outs} size="md" />
                </div>

                <button
                  className="group flex min-w-0 flex-1 items-center justify-end gap-3 text-right transition-opacity hover:opacity-85"
                  onClick={() => onPlayerSelect(batterId)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-100">
                      {batterDisplay}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-slate-500">
                      {play.matchup?.batSide?.code
                        ? `${play.matchup?.batter?.primaryPosition?.abbreviation || ''} | ${play.matchup.batSide.code}`
                        : 'Batter'}
                      {play.matchup?.batter?.primaryNumber ? ` | #${play.matchup.batter.primaryNumber}` : ''}
                    </div>
                  </div>
                  <img
                    src={playerHeadshotUrl(batterId)}
                    className="h-14 w-14 rounded-full object-cover border border-slate-700"
                    alt=""
                  />
                </button>
            </div>
          </div>

          {pitches.length > 0 && (
            <div className="grid gap-4 md:grid-cols-[minmax(16rem,0.95fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/70 md:min-h-[20rem]">
                <LiveAtBatVisual
                  venueId={venueId}
                  exteriorFailed={exteriorFailed}
                  gameDateTime={gameDateTime}
                  currentPlay={play}
                  playEvents={playEventsWithContext}
                  szTop={szT}
                  szBot={szB}
                  gamePk={gamePk}
                  batSide={batSide}
                  batterIsAway={batterIsAway}
                  batterTeamId={batterTeamId}
                  season={season}
                  showPitchTrails={showPitchTrails}
                  showPitchToast={false}
                  usePurpleInPlayOuts
                  baseballModelUrl={baseballModelUrl}
                  singleFieldImageUrl={singleFieldImageUrl}
                  strikeZoneTopImageUrl={strikeZoneTopImageUrl}
                  fieldZoom={3}
                  fieldZoomFocusX={51.6}
                  className="rounded-none border-0 md:h-full md:min-h-[20rem]"
                />
              </div>

              <div className="min-w-0">
            {/* <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 px-1">
              Pitch Sequence / {pitches.length} pitch{pitches.length !== 1 ? 'es' : ''}
            </div> */}
            <div className="space-y-2">
              {pitches.map(({ event: pitch, eventIdx }, index) => {
                const pitchKey = pitch.playId ?? pitch.index ?? eventIdx;
                const isHighlighted = highlightedPitchKey != null && String(pitchKey) === String(highlightedPitchKey);
                const desc = formatPitchDescriptionWithAbsContext(
                  pitch.details?.description || '',
                  pitch,
                  playEventsWithContext,
                  eventIdx,
                );
                const type = pitch.details?.type?.description || '';
                const mph = pitch.pitchData?.startSpeed
                  ? parseFloat(pitch.pitchData.startSpeed).toFixed(1)
                  : null;
                const effMph = pitch.pitchData?.effectiveSpeed
                  ? parseFloat(pitch.pitchData.effectiveSpeed).toFixed(1)
                  : null;
                const spinRate = pitch.pitchData?.breaks?.spinRate;
                const breakIn = pitch.pitchData?.breaks?.breakLength;
                const countAfter = pitch.count;
                const normalizedDesc = desc.toLowerCase();
                const isHitByPitch =
                  normalizedDesc.includes('hit by pitch') ||
                  normalizedDesc.includes('hit-by-pitch') ||
                  normalizedDesc.includes('hbp') ||
                  normalizedDesc.includes('plunk');
                const isBall =
                  (normalizedDesc.includes('ball') || isHitByPitch) &&
                  !normalizedDesc.includes('in play');
                const isInPlay = normalizedDesc.includes('in play');
                const isFoul = normalizedDesc.includes('foul');
                const isSwingK = normalizedDesc.includes('swinging');
                const isInPlayOut = isInPlay && (pitch.details?.code === 'X' || pitch.details?.code === 'Y') && !playScored;
                const dotColor = isInPlay
                  ? isInPlayOut
                    ? 'bg-[#7756b3]'
                    : 'bg-blue-500'
                  : isBall
                    ? 'bg-green-500'
                    : isFoul
                      ? 'bg-red-500'
                      : isSwingK
                        ? 'bg-red-500'
                        : 'bg-red-500';
                const rowBg = isInPlay
                  ? isInPlayOut
                    ? 'bg-purple-500/5 border-purple-500/10'
                    : 'bg-blue-500/5 border-blue-500/10'
                  : 'border-transparent';
                const countLabel = countAfter
                  ? `${countAfter.balls ?? 0} - ${countAfter.strikes ?? 0}`
                  : '';

                return (
                  <div
                    key={index}
                    ref={(node) => {
                      if (node) pitchRowRefs.current[pitchKey] = node;
                      else delete pitchRowRefs.current[pitchKey];
                    }}
                    className={`flex items-center gap-3 rounded-xl border border-transparent bg-transparent py-1 ${rowBg} ${isHighlighted ? 'pitch-sequence-target-pulse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-extrabold text-white shadow-sm ring-1 ring-white/35 ${dotColor}`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-white leading-tight">{desc || '-'}</div>
                      <div className="mt-0.5 text-sm text-white leading-tight">
                        {mph && <span className="font-extrabold">{mph} mph</span>}
                        {mph && type && <span className="text-white/80"> </span>}
                        {type && <span className="font-normal text-white/90">{type}</span>}
                      </div>
                      {(spinRate || breakIn) && (
                        <div className="flex gap-3 mt-1 text-[10px]">
                          {/* {spinRate && (
                            <span className="text-slate-500">
                              <span className="text-slate-400">{Math.round(spinRate)}</span>{' '}
                              rpm
                            </span>
                          )} */}
                          {/* {breakIn && (
                            <span className="text-slate-500">
                              <span className="text-slate-400">
                                {parseFloat(breakIn).toFixed(1)}
                              </span>
                              " brk
                            </span>
                          )} */}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[3.5rem]">
                      <div className="text-sm font-extrabold text-white tabular-nums">
                        {countLabel}
                      </div>
                      {effMph && mph !== effMph && (
                        <div className="text-[10px] text-slate-500 font-mono">{effMph} eff</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
