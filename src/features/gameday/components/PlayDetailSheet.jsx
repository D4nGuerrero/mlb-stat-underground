import { Modal } from '../../../components/ui';
import LiveAtBatVisual from '../../../components/LiveAtBatVisual';
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
}) {
  if (!selectedPlay) return null;

  const play = selectedPlay;
  const pitches = (play.playEvents || []).filter((event) => event.isPitch);
  const hitData = getPlayHitData(play);
  const badge = getPlayBadge(play.result?.eventType);
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
      panelClassName="max-h-[88vh] sm:max-h-[92vh] overflow-y-auto bg-[#0d1520] border-slate-700/70 p-0"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-[#0d1520] z-10">
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>

      <div className="flex items-center justify-between px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-700/40">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-100 tracking-wide">At Bat Details</span>
          <span className="text-slate-700">.</span>
          <span className="text-xs font-bold text-slate-400 font-mono">{inningStr}</span>
          <span className="text-slate-700">.</span>
          <span className="text-xs text-slate-500 font-mono">{scoreStr}</span>
        </div>
        <button
          onClick={closeSheet}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-sm"
        >
          x
        </button>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex items-center text-xs px-3 py-1.5 rounded-full border font-bold flex-shrink-0 ${badge.cls}`}
          >
            {badge.label}
          </span>
          <p className="text-slate-200 text-sm leading-snug pt-0.5">
            {play.result?.description}
          </p>
        </div>

        {renderHitDataPanel(hitData)}

        <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest px-4 pt-3 pb-1">
            At Bat Matchup
          </div>
          <div className="flex items-stretch">
            <button
              className="flex-1 flex flex-col items-center gap-2 p-4 hover:bg-slate-700/30 transition-colors border-r border-slate-700/40"
              onClick={() => onPlayerSelect(pitcherId)}
            >
              <img
                src={playerHeadshotUrl(pitcherId)}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700"
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

            <div className="flex flex-col items-center justify-center px-4 gap-2.5">
              <BaseDiamondIndicator {...situation.bases} size="md" />
              <span className="text-lg font-bold font-mono text-slate-200 tabular-nums leading-none">
                {situation.balls}-{situation.strikes}
              </span>
              <OutsIndicator outs={situation.outs} size="md" />
            </div>

            <button
              className="flex-1 flex flex-col items-center gap-2 p-4 hover:bg-slate-700/30 transition-colors border-l border-slate-700/40"
              onClick={() => onPlayerSelect(batterId)}
            >
              <img
                src={playerHeadshotUrl(batterId)}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700"
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
          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest px-4 pt-3 pb-2">
              At Bat View
            </div>
            <LiveAtBatVisual
              venueId={venueId}
              exteriorFailed={exteriorFailed}
              gameDateTime={gameDateTime}
              currentPlay={play}
              playEvents={play.playEvents || []}
              szTop={szT}
              szBot={szB}
              gamePk={gamePk}
              batSide={batSide}
              batterIsAway={batterIsAway}
              batterTeamId={batterTeamId}
              season={season}
              showPitchTrails={showPitchTrails}
              showPitchToast={false}
              baseballModelUrl={baseballModelUrl}
              className="rounded-none border-x-0 border-b-0 border-t border-slate-700/50"
            />
            <div
              className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500 justify-center"
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
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
              Pitch Sequence . {pitches.length} pitch{pitches.length !== 1 ? 'es' : ''}
            </div>
            <div className="space-y-1.5">
              {pitches.map((pitch, index) => {
                const desc = pitch.details?.description || '';
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
                const dotColor = isInPlay
                  ? 'bg-blue-500'
                  : isBall
                    ? 'bg-green-500'
                    : isFoul
                      ? 'bg-slate-400'
                      : isSwingK
                        ? 'bg-orange-400'
                        : 'bg-red-500';
                const rowBg = isInPlay
                  ? 'bg-blue-500/5 border-blue-500/10'
                  : 'border-transparent';

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 text-xs rounded-xl px-2.5 py-2.5 border ${rowBg}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5 ${dotColor}`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 leading-tight">{desc || '-'}</div>
                      {type && (
                        <div className="text-slate-600 text-[10px] mt-0.5">{type}</div>
                      )}
                      {(spinRate || breakIn) && (
                        <div className="flex gap-3 mt-1">
                          {spinRate && (
                            <span className="text-[10px] text-slate-500">
                              <span className="text-slate-400">{Math.round(spinRate)}</span>{' '}
                              rpm
                            </span>
                          )}
                          {breakIn && (
                            <span className="text-[10px] text-slate-500">
                              <span className="text-slate-400">
                                {parseFloat(breakIn).toFixed(1)}
                              </span>
                              " brk
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {mph && (
                        <div>
                          <span className="font-bold text-slate-300 font-mono">{mph}</span>
                          <span className="text-slate-600 text-[9px] ml-0.5">mph</span>
                          {effMph && mph !== effMph && (
                            <span className="text-slate-600 text-[9px] ml-1">
                              ({effMph} eff)
                            </span>
                          )}
                        </div>
                      )}
                      {countAfter && (
                        <div className="font-mono text-[10px] text-slate-500">
                          {countAfter.balls}-{countAfter.strikes}
                        </div>
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
