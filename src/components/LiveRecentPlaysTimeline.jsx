import { useLayoutEffect, useRef, useState } from 'react';
import {
  teamLogoUrl,
  playerHeadshotUrl,
} from '../utils/mlbHelpers';
import {
  formatUpdatedScore,
  getSummaryPlayIconKind,
} from '../utils/gamePlaySummary';
import { getPitchResultKind } from '../utils/liveRecentPlays';
import { BaseDiamondIndicator } from './LiveGameIndicators';

const ROW_PAD_X = 'px-2';
const AVATAR_SLOT = 'w-16';
const PLAYER_SIZE = 'w-16 h-16';
const ICON_SIZE = 'w-11 h-11';
const PITCH_SIZE = 'w-8 h-8';
// px-2 (0.5rem) + half of w-16 (2rem) = 2.5rem
const TIMELINE_CENTER = 'left-10';

const STATUS_CHANGE_BADGE = {
  label: 'Game Advisory',
  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

const PITCHING_CHANGE_BADGE = {
  label: 'Pitching Substitution',
  cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
};

const PITCH_RESULT_COLORS = {
  strike: 'bg-red-500',
  ball: 'bg-green-500',
  in_play: 'bg-blue-500',
};

function IconAvatar({ children, className = '' }) {
  return (
    <div
      className={`${ICON_SIZE} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}

function PitchNumberAvatar({ number, resultKind }) {
  return (
    <div
      className={`h-10 w-10 rounded-full ${PITCH_RESULT_COLORS[resultKind]} flex items-center justify-center text-lg font-extrabold text-white border-2 border-white/85 shadow-sm`}
      aria-hidden
    >
      {number}
    </div>
  );
}

const AVATAR_SCALE = {
  pitch: { slot: 'h-10', backdrop: PITCH_SIZE, align: 'items-center' },
  icon: { slot: 'min-h-16', backdrop: ICON_SIZE, align: 'items-center' },
  player: { slot: 'min-h-16', backdrop: PLAYER_SIZE, align: 'items-start' },
};

function LiveTimelineRow({ avatar, children, onClick, avatarScale = 'icon', className = '' }) {
  const scale = AVATAR_SCALE[avatarScale] ?? AVATAR_SCALE.icon;

  return (
    <div
      onClick={onClick}
      className={`flex gap-2.5 py-2 ${ROW_PAD_X} relative z-10 ${scale.align} ${onClick ? 'cursor-pointer hover:bg-slate-800/50 transition-all' : ''} ${className}`}
    >
      <div
        className={`${AVATAR_SLOT} ${scale.slot} flex-shrink-0 flex items-center justify-center relative z-10`}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className={`${scale.backdrop} rounded-full bg-slate-900`} />
        </div>
        <div className="relative flex items-center justify-center">{avatar}</div>
      </div>
      <div className="min-w-0 flex-1 py-0.5">{children}</div>
    </div>
  );
}

function LiveActionAvatar({ row, onPlayerClick }) {
  const iconKind = getSummaryPlayIconKind(row);

  if (iconKind === 'shoe') {
    return (
      <IconAvatar>
        <i className="fa-solid fa-shoe-prints text-base text-blue-400 -rotate-12" />
      </IconAvatar>
    );
  }

  if (iconKind === 'pitch') {
    return (
      <IconAvatar>
        <i className="fa-solid fa-baseball text-base text-orange-400" />
      </IconAvatar>
    );
  }

  if (iconKind === 'runner_placed') {
    return (
      <IconAvatar>
        <i className="fa-solid fa-diamond text-base text-blue-300" />
      </IconAvatar>
    );
  }

  if (!row.batterId) {
    return <div className={`${ICON_SIZE} rounded-full bg-slate-800/80 border-2 border-slate-600`} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPlayerClick?.(e, row.batterId);
      }}
      className="flex-shrink-0"
    >
      <img src={playerHeadshotUrl(row.batterId, 2)} className={`${PLAYER_SIZE} object-cover rounded-full`} alt="" />
    </button>
  );
}

function AdvisoryIconAvatar({ row }) {
  const iconKind = getSummaryPlayIconKind(row);
  const icons = {
    field_delay: 'fa-person-digging',
    weather_delay: 'fa-cloud-showers-heavy',
    postponed: 'fa-ban',
    medical: 'fa-kit-medical',
    warning: 'fa-triangle-exclamation',
    delay: 'fa-clock',
    advisory: 'fa-circle-info',
  };
  const colors = {
    field_delay: 'text-lime-300',
    weather_delay: 'text-amber-400',
    postponed: 'text-red-400',
    medical: 'text-rose-300',
    warning: 'text-yellow-300',
    delay: 'text-orange-300',
    advisory: 'text-sky-300',
  };

  return (
    <IconAvatar>
      <i className={`fa-solid ${icons[iconKind] || icons.advisory} text-base ${colors[iconKind] || colors.advisory}`} />
    </IconAvatar>
  );
}

function LiveRecentPlayRow({
  row,
  away,
  home,
  getPlayBadge,
  highlightByItemKey,
  expandedVideoKey,
  pinnedVideo,
  onPlayerClick,
  onOpenPlay,
  onToggleVideo,
  ScoringPlayVideo,
}) {
  if (row.kind === 'live_pitch') {
    const resultKind = getPitchResultKind(row.description, row.isInPlay);
    return (
      <LiveTimelineRow
        avatarScale="pitch"
        avatar={(
          <PitchNumberAvatar number={row.pitchNumber} resultKind={resultKind} />
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-slate-100 leading-tight">{row.description}</p>
            {(row.pitchType || row.mph != null) && (
              <p className="mt-0.5 text-sm text-white leading-tight">
                {row.mph != null && <span className="font-extrabold">{Math.round(row.mph)} mph</span>}
                {row.mph != null && row.pitchType && <span className="text-white/80"> </span>}
                {row.pitchType && <span className="text-white/90">{row.pitchType}</span>}
              </p>
            )}
          </div>
          {row.balls != null && row.strikes != null && (
            <div className="min-w-[3rem] flex-shrink-0 text-right">
              <p className="text-2xl font-extrabold tabular-nums leading-none text-white">
                {row.balls} - {row.strikes}
              </p>
            </div>
          )}
        </div>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'batter_timeout') {
    return (
      <LiveTimelineRow
        avatarScale="icon"
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-stopwatch text-base text-amber-300" />
          </IconAvatar>
        )}
      >
        <p className="text-sm text-slate-300 leading-snug">{row.description || 'Batter Timeout'}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'automatic_pitch') {
    const resultKind = getPitchResultKind(row.description, false);
    return (
      <LiveTimelineRow
        avatarScale="pitch"
        avatar={(
          <div
            className={`h-10 w-10 rounded-full ${PITCH_RESULT_COLORS[resultKind]} flex items-center justify-center text-base font-extrabold text-white border-2 border-white/85 shadow-sm`}
            aria-hidden
          >
            A
          </div>
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-slate-100 leading-tight">{row.description}</p>
          </div>
          {row.balls != null && row.strikes != null && (
            <div className="min-w-[3rem] flex-shrink-0 text-right">
              <p className="text-2xl font-extrabold tabular-nums leading-none text-white">
                {row.balls} - {row.strikes}
              </p>
            </div>
          )}
        </div>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'pickoff_attempt') {
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-hand text-base text-orange-300/80" />
          </IconAvatar>
        )}
      >
        <p className="text-sm text-slate-300 leading-snug">{row.description}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'pickoff') {
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-hand-fist text-base text-orange-400" />
          </IconAvatar>
        )}
      >
        <p className="text-sm text-slate-200 leading-snug">{row.description}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'mound_visit') {
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-circle-pause text-base text-violet-300" />
          </IconAvatar>
        )}
      >
        <p className="text-sm text-slate-300 leading-snug">Mound Visit</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'offensive_substitution' || row.kind === 'defensive_substitution') {
    const isDefense = row.kind === 'defensive_substitution';
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className={`fa-solid fa-right-left text-base ${isDefense ? 'text-cyan-300' : 'text-emerald-300'}`} />
          </IconAvatar>
        )}
      >
        <p className="text-sm text-slate-200 leading-snug">{row.description}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'status_change') {
    return (
      <LiveTimelineRow
        avatar={<AdvisoryIconAvatar row={row} />}
      >
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${STATUS_CHANGE_BADGE.cls}`}>
          {STATUS_CHANGE_BADGE.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">{row.description}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'pitching_change') {
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-right-left text-base text-sky-400" />
          </IconAvatar>
        )}
      >
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${PITCHING_CHANGE_BADGE.cls}`}>
          {PITCHING_CHANGE_BADGE.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">{row.description}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'scoring_update') {
    const team = row.scoringSide === 'away' ? away : home;
    return (
      <LiveTimelineRow
        avatar={(
          <img
            src={teamLogoUrl(team.id, 100)}
            className={`${ICON_SIZE} object-contain`}
            alt=""
          />
        )}
      >
        <p className="text-xl text-white font-bold leading-snug">
          {formatUpdatedScore(away.abbreviation, home.abbreviation, row.awayScore, row.homeScore)}
        </p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'runners') {
    return (
      <LiveTimelineRow
        avatar={(
          <BaseDiamondIndicator
            onFirst={row.bases.onFirst}
            onSecond={row.bases.onSecond}
            onThird={row.bases.onThird}
            size="lg"
          />
        )}
      >
        <p className="text-sm text-slate-300 leading-snug">{row.label}</p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'action') {
    const b = getPlayBadge(row.eventType, row);
    return (
      <LiveTimelineRow
        avatarScale={row.batterId ? 'player' : 'icon'}
        avatar={<LiveActionAvatar row={row} onPlayerClick={onPlayerClick} />}
        onClick={row.play ? () => onOpenPlay(row.play) : undefined}
      >
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${b.cls}`}>
          {b.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">
          {row.description}
          {row.outsLabel && (
            <>
              {' '}
              <span className="whitespace-nowrap font-bold text-slate-100">{row.outsLabel}</span>
            </>
          )}
        </p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'play') {
    const b = getPlayBadge(row.eventType, row);
    const video =
      expandedVideoKey === row.key && pinnedVideo
        ? pinnedVideo
        : highlightByItemKey[row.key];

    return (
      <LiveTimelineRow
        avatarScale={row.batterId ? 'player' : 'icon'}
        avatar={(
          row.batterId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayerClick?.(e, row.batterId);
              }}
              className="flex-shrink-0"
            >
              <img src={playerHeadshotUrl(row.batterId, 2)} className={`${PLAYER_SIZE} object-cover rounded-full`} alt="" />
            </button>
          ) : (
            <div className={`${ICON_SIZE} rounded-full bg-slate-800/80 border-2 border-slate-600`} aria-hidden />
          )
        )}
        onClick={row.play ? () => onOpenPlay(row.play) : undefined}
      >
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${b.cls}`}>
          {b.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">
          {row.description}
          {row.outsLabel && (
            <>
              {' '}
              <span className="whitespace-nowrap font-bold text-slate-100">{row.outsLabel}</span>
            </>
          )}
        </p>
        {row.isScoring && video && ScoringPlayVideo && (
          <ScoringPlayVideo
            video={video}
            isExpanded={expandedVideoKey === row.key}
            onToggle={() => onToggleVideo(row.key, video)}
          />
        )}
      </LiveTimelineRow>
    );
  }

  return null;
}

function LiveFirstPitchRow({ item }) {
  return (
    <LiveTimelineRow
      avatar={(
        <IconAvatar>
          <i className="fa-solid fa-baseball text-base text-orange-400" />
        </IconAvatar>
      )}
    >
      <div className="space-y-0.5">
        <div className="font-semibold text-slate-100 text-base">{item.title}</div>
        <div className="text-slate-400 font-mono text-sm">{item.timeLine}</div>
        <div className="text-slate-500 text-sm">{item.venueLine}</div>
      </div>
    </LiveTimelineRow>
  );
}

export default function LiveRecentPlaysTimeline({
  groups,
  firstPitch,
  away,
  home,
  getPlayBadge,
  highlightByItemKey,
  expandedVideoKey,
  pinnedVideo,
  onPlayerClick,
  onOpenPlay,
  onToggleVideo,
  ScoringPlayVideo,
}) {
  const hasRows = groups.some((g) => g.rows.length > 0);
  const knownRowKeysRef = useRef(null);
  const [newRowKeys, setNewRowKeys] = useState(() => new Set());

  useLayoutEffect(() => {
    const keys = groups.flatMap((group) => group.rows.map((row) => row.key));
    if (knownRowKeysRef.current == null) {
      knownRowKeysRef.current = new Set(keys);
      return undefined;
    }

    const previous = knownRowKeysRef.current;
    const added = keys.filter((key) => !previous.has(key));
    knownRowKeysRef.current = new Set(keys);
    if (!added.length) return undefined;

    setNewRowKeys(new Set(added));
    const timer = setTimeout(() => setNewRowKeys(new Set()), 900);
    return () => clearTimeout(timer);
  }, [groups]);

  return (
    <div className="relative">
      {(hasRows || firstPitch) && (
        <div
          className={`absolute ${TIMELINE_CENTER} top-8 bottom-8 w-px -translate-x-1/2 bg-slate-600/60 pointer-events-none z-0`}
          aria-hidden
        />
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.key}>
            {group.showHeader && (
              <div className="text-2xl font-bold text-slate-300 mb-2 pl-[4.5rem]">
                {group.key}
              </div>
            )}
            <div className="space-y-1.5">
              {group.rows.map((row) => (
                <div
                  key={row.key}
                  className={newRowKeys.has(row.key) ? 'recent-play-insert' : undefined}
                >
                  <LiveRecentPlayRow
                    row={row}
                    away={away}
                    home={home}
                    getPlayBadge={getPlayBadge}
                    highlightByItemKey={highlightByItemKey}
                    expandedVideoKey={expandedVideoKey}
                    pinnedVideo={pinnedVideo}
                    onPlayerClick={onPlayerClick}
                    onOpenPlay={onOpenPlay}
                    onToggleVideo={onToggleVideo}
                    ScoringPlayVideo={ScoringPlayVideo}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {!hasRows && (
          <div className="text-xs text-slate-600 italic text-center pt-4 pl-[4.5rem]">
            No plays yet
          </div>
        )}

        {firstPitch && (
          <div className="pt-2 border-t border-slate-800/60">
            <LiveFirstPitchRow item={firstPitch} />
          </div>
        )}
      </div>
    </div>
  );
}
