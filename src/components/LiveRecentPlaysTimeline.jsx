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

const AVATAR_SLOT = 'w-16';
const PLAYER_SIZE = 'w-16 h-16';
const ICON_SIZE = 'w-11 h-11';
const PITCH_SIZE = 'w-8 h-8';
const TIMELINE_CENTER = 'left-8';

const STATUS_CHANGE_BADGE = {
  label: 'Status Change',
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
      className={`${PITCH_SIZE} rounded-full ${PITCH_RESULT_COLORS[resultKind]} flex items-center justify-center text-[11px] font-bold text-white shadow-sm`}
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
      className={`flex gap-2.5 py-2 px-2 relative z-10 ${scale.align} ${onClick ? 'cursor-pointer hover:bg-slate-800/50 transition-all' : ''} ${className}`}
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
        <p className="text-sm text-slate-200 leading-snug">{row.description}</p>
        {(row.pitchType || row.mph != null) && (
          <p className="text-xs text-slate-500 mt-0.5">
            {[row.pitchType, row.mph != null ? `${Math.round(row.mph)} mph` : null].filter(Boolean).join(' · ')}
          </p>
        )}
        {row.balls != null && row.strikes != null && (
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">
            Count {row.balls}-{row.strikes}
          </p>
        )}
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
        <p className="text-sm text-slate-300 leading-snug">Batter Timeout</p>
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

  if (row.kind === 'offensive_substitution') {
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-right-left text-base text-emerald-300" />
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
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-cloud-showers-heavy text-base text-amber-400" />
          </IconAvatar>
        )}
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

  if (row.kind === 'due_up') {
    return (
      <LiveTimelineRow
        avatar={(
          <IconAvatar>
            <i className="fa-solid fa-clock text-base text-sky-300" />
          </IconAvatar>
        )}
      >
        <p className="text-sm font-semibold text-slate-200 leading-snug">{row.title}</p>
        <ul className="mt-1.5 space-y-0.5">
          {row.batters.map((batter, idx) => (
            <li key={`${row.key}-${batter.id}`} className="text-sm text-slate-400 leading-snug">
              <span className="text-slate-600 font-mono text-xs mr-1.5">{idx + 1}.</span>
              {batter.name}
            </li>
          ))}
        </ul>
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
    const b = getPlayBadge(row.eventType);
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
              <span className="font-bold text-slate-100">{row.outsLabel}</span>
            </>
          )}
        </p>
      </LiveTimelineRow>
    );
  }

  if (row.kind === 'play') {
    const b = getPlayBadge(row.eventType);
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
              <span className="font-bold text-slate-100">{row.outsLabel}</span>
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

  return (
    <div className="relative">
      {(hasRows || firstPitch) && (
        <div
          className={`absolute ${TIMELINE_CENTER} top-8 bottom-8 w-px bg-slate-600/60 pointer-events-none z-0`}
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
                <LiveRecentPlayRow
                  key={row.key}
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