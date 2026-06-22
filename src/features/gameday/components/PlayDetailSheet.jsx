import { Modal } from '../../../components/ui';
import LiveAtBatVisual from '../../../components/LiveAtBatVisual';
import { formatPitchDescriptionWithAbsContext } from '../../../utils/absChallenge';
import { playerHeadshotUrl } from '../../../utils/mlbHelpers';
import {
  BaseDiamondIndicator,
  OutsIndicator,
  getPlayDetailSituation,
} from '../../../components/LiveGameIndicators';

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
  const pitcherId = play.matchup?.pitcher?.id;
  const batterId = play.matchup?.batter?.id;
  const situation = getPlayDetailSituation(play, allPlays);
  const batSide = play.matchup?.batSide?.code || 'R';
  const batterIsAway = play.about?.halfInning === 'top';
  const batterTeamId = batterIsAway ? away.id : home.id;

  return (
    <Modal
      open
      onClose={closeSheet}
      size="lg"
      panelClassName="max-h-[88vh] sm:max-h-[92vh] overflow-y-auto bg-[#101827] border-slate-700/10 p-0"
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

      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex items-start gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-3 py-2.5">
          <span
            className={`inline-flex items-center text-[11px] px-2.5 py-1 rounded-full border font-bold flex-shrink-0 ${badge.cls}`}
          >
            {badge.label}
          </span>
          <p className="text-slate-200 text-sm leading-snug pt-0.5">
            {play.result?.description}
          </p>
        </div>

        {renderHitDataPanel(hitData)}

        <div className="bg-slate-900/70 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest px-3 pt-2.5 pb-1">
            At Bat Matchup
          </div>
          <div className="flex items-stretch">
            <button
              className="flex-1 flex flex-col items-center gap-1.5 p-3 hover:bg-slate-700/30 transition-colors border-r border-slate-700/40"
              onClick={() => onPlayerSelect(pitcherId)}
            >
              <img
                src={playerHeadshotUrl(pitcherId)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-700"
                alt=""
              />
              <div className="text-center">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  {pitcherName}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {play.matchup?.pitchHand?.code
                    ? `${play.matchup.pitchHand.code}H Pitcher`
                    : 'Pitcher'}
                </div>
              </div>
            </button>

            <div className="flex flex-col items-center justify-center px-3 gap-2">
              <BaseDiamondIndicator {...situation.bases} size="md" />
              <span className="text-base font-bold font-mono text-slate-200 tabular-nums leading-none">
                {situation.balls}-{situation.strikes}
              </span>
              <OutsIndicator outs={situation.outs} size="md" />
            </div>

            <button
              className="flex-1 flex flex-col items-center gap-1.5 p-3 hover:bg-slate-700/30 transition-colors border-l border-slate-700/40"
              onClick={() => onPlayerSelect(batterId)}
            >
              <img
                src={playerHeadshotUrl(batterId)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-700"
                alt=""
              />
              <div className="text-center">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  {batterName}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {play.matchup?.batSide?.code
                    ? `Bats ${play.matchup.batSide.code}`
                    : 'Batter'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {pitches.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest px-3 pt-2.5 pb-2">
              At Bat View
            </div>
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
              className="rounded-none border-x-0 border-b-0 border-t border-slate-700/50"
            />
            <div
              className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500 justify-center"
            >
              {[
                { color: '#c61b2b', label: 'Strike' },
                { color: '#098314', label: 'Ball' },
                { color: '#0062e3', label: 'In Play' },
                { color: '#7756b3', label: 'Out' },
                showPitchTrails ? { color: '#ffffff', label: 'Trail' } : null,
              ]
                .filter(Boolean)
                .map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full border border-slate-500 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </span>
                ))}
            </div>
          </div>
        )}

        {pitches.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 px-1">
              Pitch Sequence / {pitches.length} pitch{pitches.length !== 1 ? 'es' : ''}
            </div>
            <div className="space-y-2">
              {pitches.map(({ event: pitch, eventIdx }, index) => {
                const desc = formatPitchDescriptionWithAbsContext(
                  pitch.details?.description || '',
                  pitch,
                  play.playEvents || [],
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
                const isBall =
                  desc.toLowerCase().includes('ball') &&
                  !desc.toLowerCase().includes('in play');
                const isInPlay = desc.toLowerCase().includes('in play');
                const isFoul = desc.toLowerCase().includes('foul');
                const isSwingK = desc.toLowerCase().includes('swinging');
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
                    className={`flex items-center gap-3 rounded-2xl  border bg-[#0f1a23] ${rowBg}`}
                  >
                    <div
                      className={`w-7 h-7  rounded-full flex-shrink-0 flex items-center justify-center text-2xl  font-extrabold text-white ring-2 ring-white/80 shadow-sm ${dotColor}`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-2xl font-extrabold text-white leading-tight">{desc || '-'}</div>
                      <div className="mt-0.5 text-sm sm:text-xl text-white leading-tight">
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
                          {breakIn && (
                            <span className="text-slate-500">
                              <span className="text-slate-400">
                                {parseFloat(breakIn).toFixed(1)}
                              </span>
                              " brk
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[3.5rem]">
                      <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">
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
        )}
      </div>
    </Modal>
  );
}
