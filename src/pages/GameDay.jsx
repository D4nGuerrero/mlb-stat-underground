import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { THEME_COLOR } from '../theme/theme.js';
import { BaseballSpinner } from '../components/ui';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMLBWebSocket } from '../hooks/useMLBWebSocket';
import {
  teamLogoUrl,
  playerHeadshotUrl,
  playerActionShotUrl,
  pitcherActionShotUrl,
  stadiumExteriorUrl,
  stadiumTimeOfDay,
  getLinescoreInningNums,
  formatFinalStatus,
  sumInningsPitched,
} from '../utils/mlbHelpers';
import PitchCanvas from '../components/PitchCanvas';
import {
  buildSummaryItems,
  buildSummaryLeadIn,
  filterSummaryItems,
  groupSummaryByInning,
  formatUpdatedScore,
  getSummaryPlayIconKind,
} from '../utils/gamePlaySummary';
import {
  fetchGameContent,
  parseGameHighlightVideos,
  buildHighlightMap,
  getHighlightShareUrl,
  getHighlightVideoUrl,
  shareHighlightVideo,
  copyHighlightLink,
} from '../utils/gameContent';
import { TabBar, Modal, SegmentedControl, stickyHead, stickyCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT } from '../components/ui';
import { TABLE_TEXT_CLASS } from '../theme/tableTheme';
import GamePreviewView from '../components/GamePreviewView';
import { formatGameStartDisplay, formatVenueLine } from '../utils/gamePreview';
import { mergeLiveFeed, isValidLiveFeed, compareTimecodes } from '../utils/liveFeedMerge';
import {
  buildLiveRecentPlaysFeed,
  groupLiveRecentRows,
} from '../utils/liveRecentPlays';
import LiveRecentPlaysTimeline from '../components/LiveRecentPlaysTimeline';
import LiveAtBatVisual from '../components/LiveAtBatVisual';
import { BaseDiamondIndicator, OutsIndicator } from '../components/LiveGameIndicators';

// ─── helpers ────────────────────────────────────────────────────────────────

const PLAY_BADGE = {
  single: {
    label: 'Single',
    cls: `bg-${THEME_COLOR}-500/20 text-${THEME_COLOR}-300 border-${THEME_COLOR}-500/40`,
  },
  double: {
    label: 'Double',
    cls: `bg-${THEME_COLOR}-500/20 text-${THEME_COLOR}-300 border-${THEME_COLOR}-500/40`,
  },
  triple: {
    label: 'Triple',
    cls: `bg-${THEME_COLOR}-400/20 text-${THEME_COLOR}-200 border-${THEME_COLOR}-400/50`,
  },
  home_run: {
    label: 'Home Run',
    //  cls: ' text-[#5CA5FF] border-[#5CA5FF]',
    cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  strikeout: {
    label: 'Strikeout',
    cls: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  walk: {
    label: 'Walk',
    cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  intent_walk: {
    label: 'Intentional Walk',
    cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  hit_by_pitch: {
    label: 'Hit By Pitch',
    cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  field_out: {
    label: 'Out',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  lineout: {
    label: 'Lineout',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  flyout: {
    label: 'Flyout',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  groundout: {
    label: 'Groundout',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  pop_out: {
    label: 'Pop Out',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  grounded_into_double_play: {
    label: 'Grounded Into DP',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  double_play: {
    label: 'Double Play',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  triple_play: {
    label: 'Triple Play!',
    cls: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  force_out: {
    label: 'Force Out',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  fielders_choice: {
    label: 'Fielder\'s Choice',
   cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  field_error: {
    label: 'Field Error',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
   catcher_interf: {
    label: 'Cathcher Interference',
   cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  sac_fly: {
    label: 'Sac Fly',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  sac_bunt: {
    label: 'Sac Bunt',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  stolen_base_2b: {
    label: 'Stolen Base 2B',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  stolen_base_3b: {
    label: 'Stolen Base',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  stolen_base_home: {
    label: 'Steal Home!',
    cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  caught_stealing_2b: {
    label: 'CS',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  caught_stealing_3b: {
    label: 'CS',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  wild_pitch: {
    label: 'Wild Pitch',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  passed_ball: {
    label: 'Passed Ball',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  balk: {
    label: 'Balk',
    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
 
};

const getPlayBadge = (et) =>
  PLAY_BADGE[et] || {
    label: et?.replace(/_/g, ' ') || '—',
    cls: 'bg-slate-700/40 text-slate-400 border-slate-700/40',
  };

const getAllBatters = (teamBox) =>
  Object.values(teamBox?.players || {})
    .filter((p) => p.battingOrder)
    .sort((a, b) => parseInt(a.battingOrder) - parseInt(b.battingOrder));

const getSubLetter = (order) => {
  const suffix = parseInt(order) % 100;
  return suffix === 0 ? null : String.fromCharCode(96 + suffix);
};

const fmtEra = (era) => (era != null ? parseFloat(era).toFixed(2) : null);

const ORDINALS = [
  '',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
  '13th',
];

const STATUS_CHANGE_BADGE = {
  label: 'Status Change',
  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

const PITCHING_CHANGE_BADGE = {
  label: 'Pitching Substitution',
  cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
};

function SummaryPlayAvatar({ item, onPlayerClick }) {
  const iconKind = getSummaryPlayIconKind(item);
  const sizeClass = 'w-16 h-16';
  const iconSize = 'text-xl';

  if (iconKind === 'baseball') {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center flex-shrink-0`}
        aria-hidden
      >
        <i className={`fa-solid fa-baseball ${iconSize} text-orange-400`} />
      </div>
    );
  }

  if (iconKind === 'status') {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center flex-shrink-0`}
        aria-hidden
      >
        <i className={`fa-solid fa-cloud-showers-heavy ${iconSize} text-amber-400`} />
      </div>
    );
  }

  if (iconKind === 'pitching_sub') {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center flex-shrink-0`}
        aria-hidden
      >
        <i className={`fa-solid fa-right-left ${iconSize} text-sky-400`} />
      </div>
    );
  }

  if (iconKind === 'shoe') {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center flex-shrink-0`}
        aria-hidden
      >
        <i className={`fa-solid fa-shoe-prints ${iconSize} text-blue-400 -rotate-12`} />
      </div>
    );
  }

  if (iconKind === 'pitch') {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center flex-shrink-0`}
        aria-hidden
      >
        <i className={`fa-solid fa-baseball ${iconSize} text-orange-400`} />
      </div>
    );
  }

  if (!item.batterId) {
    return (
      <div className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex-shrink-0`} aria-hidden />
    );
  }

  return (
    <button type="button" onClick={onPlayerClick} className="flex-shrink-0 mt-0.5">
      <img src={playerHeadshotUrl(item.batterId, 2)} className={`${sizeClass} object-cover`} alt="" />
    </button>
  );
}

function SummaryFirstPitchRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <SummaryPlayAvatar item={item} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-semibold text-slate-100 text-base">{item.title}</div>
        <div className="text-slate-400 font-mono text-sm">{item.timeLine}</div>
        <div className="text-slate-500 text-sm">{item.venueLine}</div>
      </div>
    </div>
  );
}

function SummaryStatusChangeRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <SummaryPlayAvatar item={item} />
      <div className="min-w-0 flex-1">
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${STATUS_CHANGE_BADGE.cls}`}>
          {STATUS_CHANGE_BADGE.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">{item.description}</p>
        {item.timeLine && (
          <p className="text-slate-500 font-mono mt-0.5 text-xs">{item.timeLine}</p>
        )}
      </div>
    </div>
  );
}

function SummaryPitchingChangeRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <SummaryPlayAvatar item={item} />
      <div className="min-w-0 flex-1">
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${PITCHING_CHANGE_BADGE.cls}`}>
          {PITCHING_CHANGE_BADGE.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">{item.description}</p>
      </div>
    </div>
  );
}

function SummaryPlayItemRow({
  item,
  awayAbbr,
  homeAbbr,
  highlightByItemKey,
  expandedVideoKey,
  pinnedVideo,
  onPlayerClick,
  onOpenPlay,
  onToggleVideo,
}) {
  if (item.kind === 'status_change') {
    return <SummaryStatusChangeRow item={item} />;
  }
  if (item.kind === 'pitching_change') {
    return <SummaryPitchingChangeRow item={item} />;
  }

  const b = getPlayBadge(item.eventType);
  const scoreLine = item.isScoring
    ? formatUpdatedScore(awayAbbr, homeAbbr, item.awayScore, item.homeScore)
    : null;
  const video =
    expandedVideoKey === item.key && pinnedVideo
      ? pinnedVideo
      : highlightByItemKey[item.key];

  return (
    <div
      onClick={() => item.play && onOpenPlay(item.play)}
      className={`flex items-start gap-2.5 p-2 transition-all ${item.play ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
    >
      <SummaryPlayAvatar item={item} onPlayerClick={onPlayerClick} />
      <div className="min-w-0 flex-1">
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${b.cls}`}>
          {b.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">
          {item.description}
          {item.outsLabel && (
            <>
              {' '}
              <span className="font-bold text-slate-100">{item.outsLabel}</span>
            </>
          )}
        </p>
        {scoreLine && (
          <p className="text-xl text-white-500 mt-1 font-bold">{scoreLine}</p>
        )}
        {item.isScoring && video && (
          <ScoringPlayVideo
            video={video}
            isExpanded={expandedVideoKey === item.key}
            onToggle={() => onToggleVideo(item.key, video)}
          />
        )}
      </div>
    </div>
  );
}

function VideoShareMenu({ video }) {
  const videoUrl = getHighlightVideoUrl(video);
  const pageUrl = getHighlightShareUrl(video);
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const handleNativeShare = async (e, close) => {
    e.preventDefault();
    e.stopPropagation();
    close?.();
    await shareHighlightVideo(video);
  };

  const handleCopy = (e, close) => {
    e.preventDefault();
    e.stopPropagation();
    close?.();
    if (videoUrl) copyHighlightLink(video);
  };

  if (!videoUrl && !pageUrl && !canNativeShare) return null;

  return (
    <Menu as="div" className="absolute top-2 right-2 z-20">
      <MenuButton
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center text-white transition-colors"
        aria-label="Video options"
      >
        <i className="fa-solid fa-ellipsis-vertical text-sm" aria-hidden />
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        transition
        className="z-50 mt-1 min-w-[10.5rem] rounded-xl bg-slate-900 border border-slate-700 py-1 shadow-xl focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {canNativeShare && (
          <MenuItem>
            {({ focus, close }) => (
              <button
                type="button"
                onClick={(e) => handleNativeShare(e, close)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-share-nodes text-xs w-4 text-center" aria-hidden />
                Share…
              </button>
            )}
          </MenuItem>
        )}
        {videoUrl && (
          <MenuItem>
            {({ focus, close }) => (
              <button
                type="button"
                onClick={(e) => handleCopy(e, close)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-link text-xs w-4 text-center" aria-hidden />
                Copy link
              </button>
            )}
          </MenuItem>
        )}
        {pageUrl && (
          <MenuItem>
            {({ focus }) => (
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`block px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs w-4 text-center" aria-hidden />
                Open on MLB.com
              </a>
            )}
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}

function ScoringPlayVideo({ video, isExpanded, onToggle }) {
  const videoRef = useRef(null);
  const playOnExpandRef = useRef(false);
  const src = video?.mp4Url || video?.hlsUrl;

  useEffect(() => {
    const el = videoRef.current;
    if (isExpanded && playOnExpandRef.current && el) {
      el.play().catch(() => {});
      playOnExpandRef.current = false;
    }
  }, [isExpanded]);

  const handleExpand = () => {
    playOnExpandRef.current = true;
    onToggle();
  };

  if (!video?.thumbnail && !src) return null;

  return (
    <div className="mt-3 max-w-md" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {isExpanded && src ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-700/60 bg-black">
          <VideoShareMenu video={video} />
          <video
            key={video.id ?? src}
            ref={videoRef}
            controls
            playsInline
            poster={video.thumbnail}
            className="w-full aspect-video"
            src={src}
          >
            <track kind="captions" />
          </video>
          {video.headline && (
            <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-800">{video.headline}</div>
          )}
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700/60">
          <VideoShareMenu video={video} />
          <button
            type="button"
            onClick={handleExpand}
            className="relative w-full h-full group"
            aria-label={video.headline ? `Play video: ${video.headline}` : 'Play highlight video'}
          >
            {video.thumbnail && (
              <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/50">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                <i className="fa-solid fa-play text-white text-lg ml-0.5" aria-hidden />
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function LinescoreInningCell({ val }) {
  if (val > 0) {
    return <span className="text-green-400 font-bold">{val}</span>;
  }
  if (val === 0) return <span>0</span>;
  return <span className="text-slate-600">-</span>;
}

function LinescoreBoard({ ls, away, home, awayRuns, homeRuns }) {
  const scrollRef = useRef(null);
  const inningNums = useMemo(() => getLinescoreInningNums(ls), [ls]);

  const inningByNum = useMemo(() => {
    const map = {};
    (ls?.innings ?? []).forEach((inn) => {
      map[inn.num] = inn;
    });
    return map;
  }, [ls?.innings]);

  const prevInningCountRef = useRef(0);
  const inningCount = inningNums.length;
  const hasExtras = inningCount > 9;

  const inningGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${inningCount}, minmax(0, 1fr))`,
      width: hasExtras ? `calc(100% * ${inningCount} / 9)` : '100%',
    }),
    [inningCount, hasExtras],
  );

  const cellBase = 'text-center tabular-nums font-mono';
  const headerCell = `h-8 flex items-center justify-center ${cellBase}`;
  const bodyCell = `h-9 flex items-center justify-center border-t border-slate-700/40 ${cellBase}`;
  const headerRow = 'h-8 flex items-center shrink-0';
  const bodyRow = 'h-9 flex items-center shrink-0 border-t border-slate-700/40';

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !hasExtras) {
      prevInningCountRef.current = inningCount;
      return;
    }
    if (inningCount > prevInningCountRef.current) {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
    prevInningCountRef.current = inningCount;
  }, [inningCount, hasExtras]);

  const sides = [
    { side: 'away', team: away, runs: awayRuns },
    { side: 'home', team: home, runs: homeRuns },
  ];

  return (
    <div className="bg-slate-800/40 border-t border-slate-700/50">
      <div className="flex text-sm px-2 sm:px-6 py-3">
        <div className="flex-shrink-0 w-14">
          <div className={headerRow} />
          {sides.map(({ side, team }) => (
            <div key={side} className={`${bodyRow} font-bold text-slate-200`}>
              {team.abbreviation}
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="overflow-x-auto flex-1 min-w-0">
          <div
            className={`grid min-w-full ${hasExtras ? 'sm:pr-6' : ''}`}
            style={inningGridStyle}
          >
            {inningNums.map((i) => (
              <div key={`hdr-${i}`} className={`${headerCell} text-slate-500 text-xs`}>
                {i}
              </div>
            ))}
            {sides.map(({ side }) =>
              inningNums.map((i) => {
                const val = inningByNum[i]?.[side]?.runs;
                return (
                  <div key={`${side}-${i}`} className={`${bodyCell} text-slate-300 text-sm`}>
                    <LinescoreInningCell val={val} />
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className="flex-shrink-0 border-l border-slate-600">
          <div className={`${headerRow} flex text-slate-500`}>
            <div className="w-8 px-3 text-center font-bold">R</div>
            <div className="w-8 px-2 text-center font-normal">H</div>
            <div className="w-8 px-2 text-center font-normal">E</div>
          </div>
          {sides.map(({ side, runs }) => (
            <div key={side} className={`${bodyRow} flex`}>
              <div className="w-8 px-3 text-center font-bold">
                {runs}
              </div>
              <div className="w-8 px-2 text-center text-slate-400">
                {ls?.teams?.[side]?.hits ?? 0}
              </div>
              <div className="w-8 px-2 text-center text-slate-500">
                {ls?.teams?.[side]?.errors ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dedupeDaySchedule(games) {
  const byPk = new Map();
  for (const g of games) {
    if (g.gamePk == null) continue;
    const prev = byPk.get(g.gamePk);
    const score = (game) => (
      (game.teams?.home?.score != null ? 2 : 0)
      + (game.teams?.away?.score != null ? 2 : 0)
      + (game.linescore ? 1 : 0)
    );
    if (!prev || score(g) > score(prev)) byPk.set(g.gamePk, g);
  }
  return [...byPk.values()].sort((a, b) => {
    const numA = a.gameNumber ?? 1;
    const numB = b.gameNumber ?? 1;
    if (numA !== numB) return numA - numB;
    return new Date(a.gameDate ?? 0) - new Date(b.gameDate ?? 0);
  });
}

function formatDayGameStatus(game) {
  const away = game.teams?.away;
  const home = game.teams?.home;
  const isFinal = game.status?.abstractGameState === 'Final';
  const isLive = game.status?.abstractGameState === 'Live';
  if (isFinal) {
    const awayScore = away?.score ?? game.linescore?.teams?.away?.runs ?? 0;
    const homeScore = home?.score ?? game.linescore?.teams?.home?.runs ?? 0;
    return `${awayScore}-${homeScore}`;
  }
  if (isLive) return 'LIVE';
  if (game.gameDate) {
    return new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return 'TBD';
}

function GamedayDayPicker({ games, currentGamePk, loading, onSelect }) {
  const count = games.length;
  return (
    <Menu as="div" className="relative justify-self-center">
      <MenuButton
        type="button"
        className="flex items-center gap-1.5 font-bold text-sm text-slate-100 active:text-white"
      >
        <span>Gameday</span>
        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" aria-hidden />
      </MenuButton>
      <MenuItems
        anchor="bottom"
        transition
        className="z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 py-1 shadow-xl focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {loading && (
          <div className="px-4 py-3 text-xs text-slate-500">Loading games…</div>
        )}
        {!loading && count === 0 && (
          <div className="px-4 py-3 text-xs text-slate-500">No other games today</div>
        )}
        {!loading && games.map((game) => {
          const away = game.teams?.away;
          const home = game.teams?.home;
          const isCurrent = String(game.gamePk) === String(currentGamePk);
          const dhLabel = game.gameNumber > 1 ? `G${game.gameNumber}` : null;
          return (
            <MenuItem key={game.gamePk} disabled={isCurrent}>
              {({ focus, close }) => (
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    close();
                    onSelect(game.gamePk);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                    isCurrent
                      ? 'bg-slate-800/80 text-slate-400 cursor-default'
                      : focus
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-200'
                  }`}
                >
                  <img
                    src={teamLogoUrl(away?.team?.id)}
                    alt=""
                    className="w-7 h-7 object-contain flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {dhLabel && <span className="text-slate-500 mr-1">{dhLabel}</span>}
                      {away?.team?.abbreviation} @ {home?.team?.abbreviation}
                    </div>
                    <div className="text-[11px] text-slate-500">{formatDayGameStatus(game)}</div>
                  </div>
                  <img
                    src={teamLogoUrl(home?.team?.id)}
                    alt=""
                    className="w-7 h-7 object-contain flex-shrink-0"
                  />
                  {isCurrent && (
                    <i className="fa-solid fa-check text-[10px] text-slate-500 flex-shrink-0" aria-hidden />
                  )}
                </button>
              )}
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

export default function GamePage() {
  const { gamePk } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('live');
  const [boxScoreSide, setBoxScoreSide] = useState('away');
  const [vsStats, setVsStats] = useState(null);
  // Track whether we pushed a history entry for the sheet
  const sheetHistoryRef = useRef(false);
  const vsStatsCacheRef = useRef({});
  const summaryScrollYRef = useRef(0);
  const feedTimecodeRef = useRef(null);
  const scoringPlaysCountRef = useRef(-1);
  const [gameContent, setGameContent] = useState(null);
  const [expandedVideoKey, setExpandedVideoKey] = useState(null);
  const [pinnedVideo, setPinnedVideo] = useState(null);
  const [daySchedule, setDaySchedule] = useState([]);
  const [dayScheduleLoading, setDayScheduleLoading] = useState(false);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (isValidLiveFeed(data)) {
        feedTimecodeRef.current = data.metaData?.timeStamp ?? null;
        setFeed(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gamePk]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  useEffect(() => {
    const officialDate = feed?.gameData?.datetime?.officialDate;
    if (!officialDate) {
      setDaySchedule([]);
      return;
    }
    let cancelled = false;
    setDayScheduleLoading(true);
    fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${officialDate}&hydrate=team,linescore`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const games = dedupeDaySchedule((json.dates ?? []).flatMap((d) => d.games ?? []));
        setDaySchedule(games);
      })
      .catch(() => {
        if (!cancelled) setDaySchedule([]);
      })
      .finally(() => {
        if (!cancelled) setDayScheduleLoading(false);
      });
    return () => { cancelled = true; };
  }, [feed?.gameData?.datetime?.officialDate]);

  useEffect(() => {
    summaryScrollYRef.current = 0;
    feedTimecodeRef.current = null;
    scoringPlaysCountRef.current = -1;
    setGameContent(null);
    setExpandedVideoKey(null);
    setPinnedVideo(null);
  }, [gamePk]);

  const { status: wsStatus, lastUpdate } = useMLBWebSocket(
    gamePk ? parseInt(gamePk) : null,
    feed?.gameData?.status?.abstractGameState,
    feed?.metaData?.timeStamp,
  );

  useEffect(() => {
    if (!gamePk) return;
    fetchGameContent(gamePk)
      .then(setGameContent)
      .catch(() => {});
  }, [gamePk]);

  useEffect(() => {
    if (!gamePk || !feed) return;
    const scoringCount = feed.liveData?.plays?.scoringPlays?.length ?? 0;
    if (scoringCount === scoringPlaysCountRef.current) return;
    scoringPlaysCountRef.current = scoringCount;
    fetchGameContent(gamePk)
      .then(setGameContent)
      .catch(() => {});
  }, [gamePk, feed?.liveData?.plays?.scoringPlays?.length]);

  const applyFeedPatch = useCallback((patch) => {
    if (!patch) return;
    setFeed((prev) => {
      const merged = mergeLiveFeed(prev, patch);
      const nextTc = merged?.metaData?.timeStamp;
      if (
        nextTc &&
        feedTimecodeRef.current &&
        compareTimecodes(nextTc, feedTimecodeRef.current) < 0
      ) {
        return prev;
      }
      if (!isValidLiveFeed(merged)) return prev;
      if (nextTc) feedTimecodeRef.current = nextTc;
      return merged;
    });
  }, []);

  useEffect(() => {
    if (!lastUpdate) return;
    if (lastUpdate.data) {
      applyFeedPatch(lastUpdate.data);
    } else {
      fetchGame();
    }
  }, [lastUpdate, fetchGame, applyFeedPatch]);

  useEffect(() => {
    if (!gamePk || feed?.gameData?.status?.abstractGameState !== 'Live') return;

    const pollDiff = async () => {
      const tc = feedTimecodeRef.current;
      if (!tc) return;
      try {
        const res = await fetch(
          `https://ws.statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${tc}`,
        );
        if (res.status === 204 || !res.ok) return;
        const data = await res.json();
        applyFeedPatch(data);
      } catch {
        /* backup poll — WS remains primary */
      }
    };

    const id = setInterval(pollDiff, 8000);
    return () => clearInterval(id);
  }, [gamePk, feed?.gameData?.status?.abstractGameState, applyFeedPatch]);

  useEffect(() => {
    const saveScroll = () => {
      if (activeTab === 'summary') summaryScrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => window.removeEventListener('scroll', saveScroll);
  }, [activeTab]);

  useLayoutEffect(() => {
    if (expandedVideoKey) return;
    if (activeTab === 'summary' && summaryScrollYRef.current > 0) {
      window.scrollTo(0, summaryScrollYRef.current);
    }
  }, [feed, activeTab, expandedVideoKey]);

  // Hide nav bar on mobile while game page is open
  useEffect(() => {
    document.body.classList.add('game-page-open');
    return () => document.body.classList.remove('game-page-open');
  }, []);

  const venueId = feed?.gameData?.venue?.id;
  const exteriorTimeOfDay = stadiumTimeOfDay(feed?.gameData?.gameDate);
  const [exteriorFailed, setExteriorFailed] = useState(false);

  useEffect(() => {
    if (!venueId) {
      setExteriorFailed(true);
      return;
    }
    setExteriorFailed(false);
    const img = new Image();
    img.onload = () => setExteriorFailed(false);
    img.onerror = () => setExteriorFailed(true);
    img.src = stadiumExteriorUrl(venueId, exteriorTimeOfDay);
  }, [venueId, exteriorTimeOfDay]);

  // History API: push state when sheet opens so back button closes it
  const openSheet = useCallback((play) => {
    setSelectedPlay(play);
    window.history.pushState({ mlbSheet: true }, '');
    sheetHistoryRef.current = true;
  }, []);

  const closeSheet = useCallback(() => {
    setSelectedPlay(null);
    if (sheetHistoryRef.current) {
      sheetHistoryRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const onPopState = (e) => {
      if (selectedPlay) {
        sheetHistoryRef.current = false;
        setSelectedPlay(null);
        // Prevent route navigation — do nothing else
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedPlay]);

  // ── batter vs pitcher head-to-head stats ───────────────────────────────────
  useEffect(() => {
    const batterId = feed?.liveData?.linescore?.offense?.batter?.id;
    const pitcherId = feed?.liveData?.linescore?.defense?.pitcher?.id;
    if (!batterId || !pitcherId) { setVsStats(null); return; }
    const key = `${batterId}-${pitcherId}`;
    if (vsStatsCacheRef.current[key] !== undefined) {
      setVsStats(vsStatsCacheRef.current[key]);
      return;
    }
    const season = new Date().getFullYear();
    fetch(
      `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=batting,type=vsPlayerTotal,opposingPlayerId=${pitcherId},season=${season})`,
    )
      .then((r) => r.json())
      .then((data) => {
        const stat =
          data.people?.[0]?.stats?.find(
            (s) =>
              s.type?.displayName === 'vsPlayerTotal' ||
              s.type?.displayName === 'vsPlayer',
          )?.splits?.[0]?.stat || null;
        vsStatsCacheRef.current[key] = stat;
        setVsStats(stat);
      })
      .catch(() => {
        vsStatsCacheRef.current[key] = null;
        setVsStats(null);
      });
  }, [
    feed?.liveData?.linescore?.offense?.batter?.id,
    feed?.liveData?.linescore?.defense?.pitcher?.id,
  ]);

  // ── derived data ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <BaseballSpinner size="xl" />
      </div>
    );
  }

  if (error || !feed || !isValidLiveFeed(feed)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⚾</div>
        <div className="text-red-400 font-semibold mb-2">
          Failed to load game
        </div>
        <div className="text-slate-500 text-sm mb-6">{error}</div>
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-sm transition-all"
        >
          ← Back to Game Day
        </button>
      </div>
    );
  }

  const gd = feed.gameData;
  const ld = feed.liveData;
  const status = gd.status;
  const away = gd.teams.away;
  const home = gd.teams.home;
  const ls = ld.linescore;
  const isLive = status.abstractGameState === 'Live';
  const isFinal = status.abstractGameState === 'Final';
  const isPreview = status.abstractGameState === 'Preview';
  const isPostponed = /postponed/i.test(status.detailedState ?? '');
  const gameStart = formatGameStartDisplay(gd.datetime, gd.venue);
  const venueLine = formatVenueLine(gd.venue);
  const previewSeason = gd.datetime?.officialDate?.slice(0, 4) || String(new Date().getFullYear());
  const decisions = ld.decisions;

  const allPitchEvents = ld.plays?.currentPlay?.playEvents || [];
  const pitchesSoFar = allPitchEvents.filter((e) => e.isPitch);
  const latestPitch = pitchesSoFar[pitchesSoFar.length - 1];
  const szTop = latestPitch?.pitchData?.strikeZoneTop || 3.5;
  const szBot = latestPitch?.pitchData?.strikeZoneBottom || 1.5;
  const currentPlay = ld.plays?.currentPlay;
  const batSide = currentPlay?.matchup?.batSide?.code || 'R';
  const batterIsAway = ls?.inningHalf === 'Top'; // top inning → away team bats

  const awayRuns = ls?.teams?.away?.runs ?? 0;
  const homeRuns = ls?.teams?.home?.runs ?? 0;
  const awayWins = isFinal && awayRuns > homeRuns;
  const homeWins = isFinal && homeRuns > awayRuns;

  const getPitcherStats = (playerId) => {
    const allPlayers = {
      ...(ld.boxscore?.teams?.away?.players || {}),
      ...(ld.boxscore?.teams?.home?.players || {}),
    };
    const player = allPlayers[`ID${playerId}`];
    return player?.seasonStats?.pitching || player?.stats?.pitching || null;
  };

  const allPlays = ld.plays?.allPlays || [];

  const summaryLeadIn = buildSummaryLeadIn(gd);
  const allSummaryItems = buildSummaryItems(allPlays, gd);
  const summaryItems = filterSummaryItems(allSummaryItems, summaryFilter);
  const summaryItemGroups = groupSummaryByInning(summaryItems, ORDINALS);
  const highlightVideos = parseGameHighlightVideos(gameContent);
  const { displayRows: liveRecentRows, firstPitch: liveFirstPitch } = buildLiveRecentPlaysFeed({
    allPlays,
    gameData: gd,
    boxscore: ld.boxscore,
    linescore: ls,
    currentPlay,
    isLive,
    ordinals: ORDINALS,
  });
  const liveRecentGroups = groupLiveRecentRows(liveRecentRows, {
    isLive,
    currentInning: ls?.currentInning,
    currentHalf: ls?.inningHalf === 'Top' ? 'top' : 'bottom',
  });
  const highlightByItemKey = buildHighlightMap(allSummaryItems, highlightVideos);

  const handleSummaryPlayerClick = (e, batterId) => {
    e.stopPropagation();
    if (batterId) navigate(`/player/${batterId}`);
  };

  const handleSummaryVideoToggle = (itemKey, video) => {
    if (expandedVideoKey === itemKey) {
      setExpandedVideoKey(null);
      setPinnedVideo(null);
    } else {
      setExpandedVideoKey(itemKey);
      setPinnedVideo(video);
    }
  };

  // ── Team Box Score ─────────────────────────────────────────────────────────

  const BOX_SCORE_TABLE = `${TABLE_BASE} ${TABLE_TEXT_CLASS} table-fixed w-full`;
  const BOX_SCORE_LABEL_COL = 'w-[24%]';
  const BOX_SCORE_STAT_COL = 'w-[9.5%]';
  const boxScoreStatHead = (className = '') => (
    statHead(`${BOX_SCORE_STAT_COL} font-normal ${className}`, { align: 'text-center' })
  );
  const boxScoreStatCell = (className = '') => (
    statCell(`${BOX_SCORE_STAT_COL} ${className}`, { align: 'text-center' })
  );
  const formatBoxRate = (v) => {
    if (v == null || v === '' || v === '-') return '-';
    return String(v).replace(/^0(?=\.)/, '');
  };

  const TeamBoxSection = ({ sideKey, team, hideHeader }) => {
    const teamBox = ld.boxscore?.teams?.[sideKey];
    if (!teamBox) return null;

    const batters = getAllBatters(teamBox);
    const pitcherIds = teamBox.pitchers || [];
    const pitchers = pitcherIds
      .map((id) => teamBox.players?.[`ID${id}`])
      .filter(Boolean);

    const subNotes = batters
      .filter((p) => p.note)
      .map((p) => {
        const letter = getSubLetter(p.battingOrder);
        return letter ? `${letter}-${p.note}` : p.note;
      });

    const battingTotals = batters.reduce(
      (acc, p) => {
        const b = p.stats?.batting || {};
        return {
          ab: acc.ab + (b.atBats || 0),
          r: acc.r + (b.runs || 0),
          h: acc.h + (b.hits || 0),
          rbi: acc.rbi + (b.rbi || 0),
          bb: acc.bb + (b.baseOnBalls || 0),
          so: acc.so + (b.strikeOuts || 0),
        };
      },
      { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
    );

    const pitchingTotals = pitchers.reduce(
      (acc, p) => {
        const pt = p.stats?.pitching || {};
        return {
          h: acc.h + (pt.hits || 0),
          r: acc.r + (pt.runs || 0),
          er: acc.er + (pt.earnedRuns || 0),
          bb: acc.bb + (pt.baseOnBalls || 0),
          k: acc.k + (pt.strikeOuts || 0),
          hr: acc.hr + (pt.homeRuns || 0),
        };
      },
      { h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 },
    );

    const pitchingTotalsIp =
      teamBox.teamStats?.pitching?.inningsPitched ??
      sumInningsPitched(
        pitchers.map((p) => p.stats?.pitching?.inningsPitched),
      );

    return (
      <div className="mb-8">
        {!hideHeader && (
          <div className="flex items-center gap-2 mb-3">
            <img
              src={teamLogoUrl(team.id)}
              className="w-5 h-5 object-contain"
              alt={team.abbreviation}
            />
            <span className="font-bold text-sm text-slate-100">
              {team.teamName || team.abbreviation}
            </span>
          </div>
        )}

        <div className={`${TABLE_SCROLL} mb-2`}>
          <table className={BOX_SCORE_TABLE}>
            <colgroup>
              <col className={BOX_SCORE_LABEL_COL} />
              {Array.from({ length: 8 }, (_, i) => (
                <col key={i} className={BOX_SCORE_STAT_COL} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/60">
                <th className={`${stickyHead('bg-slate-900')} ${BOX_SCORE_LABEL_COL} font-normal`}>BATTING</th>
                {['AB', 'R', 'H', 'RBI', 'BB', 'SO', 'AVG', 'OPS'].map((h) => (
                  <th key={h} className={boxScoreStatHead()}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batters.map((p) => {
                const b = p.stats?.batting || {};
                const sb = p.seasonStats?.batting || {};
                const subLetter = getSubLetter(p.battingOrder);
                const lastName =
                  p.person?.fullName?.split(' ').slice(-1)[0] || '';
                const pos = p.position?.abbreviation || '';
                return (
                  <tr
                    key={p.person?.id}
                    className="group border-b border-slate-800/40 hover:bg-slate-800/20"
                  >
                    <td className={`${stickyCell('bg-slate-900')} ${BOX_SCORE_LABEL_COL}`}>
                      <button
                        onClick={() => navigate(`/player/${p.person?.id}`)}
                        className={`text-left hover:text-${THEME_COLOR}-400 transition-colors whitespace-nowrap`}
                      >
                        {subLetter && (
                          <span className="text-slate-500 mr-0.5">
                            {subLetter}-
                          </span>
                        )}
                        <span className={subLetter ? 'text-slate-400' : 'text-slate-200'}>
                          <span className="sm:hidden">{lastName}</span>
                          <span className="hidden sm:inline">{p.person?.fullName}</span>
                        </span>
                      </button>
                      <span className="text-slate-600 ml-1 text-[10px]">
                        {pos}
                      </span>
                    </td>
                    <td className={boxScoreStatCell('text-slate-400')}>{b.atBats ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{b.runs ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{b.hits ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{b.rbi ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{b.baseOnBalls ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{b.strikeOuts ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{formatBoxRate(sb.avg)}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{formatBoxRate(sb.ops)}</td>
                  </tr>
                );
              })}
              <tr className="group border-t border-slate-700 font-bold text-slate-300">
                <td className={`${stickyCell('bg-slate-900', { footer: true })} ${BOX_SCORE_LABEL_COL}`}>Totals</td>
                {[
                  battingTotals.ab,
                  battingTotals.r,
                  battingTotals.h,
                  battingTotals.rbi,
                  battingTotals.bb,
                  battingTotals.so,
                ].map((v, i) => (
                  <td key={i} className={boxScoreStatCell()}>
                    {v}
                  </td>
                ))}
                <td className={boxScoreStatCell()} />
                <td className={boxScoreStatCell()} />
              </tr>
            </tbody>
          </table>
        </div>

        {subNotes.length > 0 && (
          <div className="mb-3 text-[11px] text-slate-500 space-y-0.5 italic">
            {subNotes.map((note, i) => (
              <div key={i}>{note}</div>
            ))}
          </div>
        )}

        {(teamBox.info || []).map((section) => (
          <div key={section.title} className="mb-2">
            <div className="text-[11px] font-bold text-slate-400 mb-0.5">
              {section.title}
            </div>
            <div className="text-[11px] text-slate-500 space-y-0.5">
              {(section.fieldList || []).map((field, i) => (
                <div key={i}>
                  <span className="font-semibold text-slate-400">
                    {field.label}{' '}
                  </span>
                  {field.value}
                </div>
              ))}
            </div>
          </div>
        ))}

        {pitchers.length > 0 && (
          <div className={`${TABLE_SCROLL} mt-4`}>
            <table className={BOX_SCORE_TABLE}>
              <colgroup>
                <col className={BOX_SCORE_LABEL_COL} />
                {Array.from({ length: 8 }, (_, i) => (
                  <col key={i} className={BOX_SCORE_STAT_COL} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/60">
                  <th className={`${stickyHead('bg-slate-900')} ${BOX_SCORE_LABEL_COL} font-normal`}>PITCHING</th>
                  {['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'ERA'].map((h) => (
                    <th key={h} className={boxScoreStatHead()}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitchers.map((p) => {
                  const pt = p.stats?.pitching || {};
                  const seasonEra = p.seasonStats?.pitching?.era;
                  const lastName =
                    p.person?.fullName?.split(' ').slice(-1)[0] || '';
                  const decMark =
                    decisions?.winner?.id === p.person?.id
                      ? 'W'
                      : decisions?.loser?.id === p.person?.id
                        ? 'L'
                        : decisions?.save?.id === p.person?.id
                          ? 'SV'
                          : null;
                  return (
                    <tr
                      key={p.person?.id}
                      className="group border-b border-slate-800/40 hover:bg-slate-800/20"
                    >
                      <td className={`${stickyCell('bg-slate-900')} ${BOX_SCORE_LABEL_COL}`}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/player/${p.person?.id}`)}
                          className={`hover:text-${THEME_COLOR}-400 transition-colors text-slate-200`}
                        >
                          <span className="sm:hidden">{lastName}</span>
                          <span className="hidden sm:inline">{p.person?.fullName}</span>
                        </button>
                        {decMark && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                            {decMark}
                          </span>
                        )}
                        </div>
                      </td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.inningsPitched ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.hits ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.runs ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.earnedRuns ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.baseOnBalls ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.strikeOuts ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>{pt.homeRuns ?? '-'}</td>
                      <td className={boxScoreStatCell('text-slate-400')}>
                        {seasonEra != null ? parseFloat(seasonEra).toFixed(2) : '-'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="group border-t border-slate-700 font-bold text-slate-300">
                  <td className={`${stickyCell('bg-slate-900', { footer: true })} ${BOX_SCORE_LABEL_COL}`}>Totals</td>
                  <td className={boxScoreStatCell()}>{pitchingTotalsIp}</td>
                  {[
                    pitchingTotals.h,
                    pitchingTotals.r,
                    pitchingTotals.er,
                    pitchingTotals.bb,
                    pitchingTotals.k,
                    pitchingTotals.hr,
                  ].map((v, i) => (
                    <td key={i} className={boxScoreStatCell()}>{v}</td>
                  ))}
                  <td className={boxScoreStatCell()} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Play Detail Bottom Sheet ───────────────────────────────────────────────

  const PlayDetailSheet = () => {
    if (!selectedPlay) return null;

    const play = selectedPlay;
    const pitches = (play.playEvents || []).filter((e) => e.isPitch);
    const hitData = play.hitData;
    const badge = getPlayBadge(play.result?.eventType);
    const szT = pitches[pitches.length - 1]?.pitchData?.strikeZoneTop || 3.5;
    const szB = pitches[pitches.length - 1]?.pitchData?.strikeZoneBottom || 1.5;
    const inningStr = `${play.about?.halfInning === 'top' ? 'TOP' : 'BOT'} ${play.about?.inning}`;
    const scoreStr = `${away.abbreviation} ${play.result?.awayScore ?? 0} – ${home.abbreviation} ${play.result?.homeScore ?? 0}`;
    const hasHitData =
      hitData &&
      (hitData.launchSpeed != null ||
        hitData.totalDistance != null ||
        hitData.launchAngle != null);

    const pitcherName = play.matchup?.pitcher?.fullName || '—';
    const batterName = play.matchup?.batter?.fullName || '—';
    const pitcherId = play.matchup?.pitcher?.id;
    const batterId = play.matchup?.batter?.id;

    const lastCount = pitches[pitches.length - 1]?.count;
    const finalBalls = play.count?.balls ?? lastCount?.balls ?? 0;
    const finalStrikes = play.count?.strikes ?? lastCount?.strikes ?? 0;
    const outs = play.count?.outs ?? 0;

    // extra hitData fields
    const trajectory = hitData?.trajectory?.replace(/_/g, ' ');
    const hardness = hitData?.hardness;
    const location = hitData?.location;

    return (
      <Modal
        open
        onClose={closeSheet}
        size="md"
        panelClassName="max-h-[88vh] sm:max-h-[92vh] overflow-y-auto bg-[#0d1520] border-slate-700/70 p-0"
      >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-[#0d1520] z-10">
            <div className="w-10 h-1 rounded-full bg-slate-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-700/40">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 font-mono">
                {inningStr}
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500 font-mono">
                {scoreStr}
              </span>
            </div>
            <button
              onClick={closeSheet}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-sm"
            >
              ×
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Result banner */}
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

            {/* Hit data cards */}
            {hasHitData && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">
                  Hit Data
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Exit Velo',
                      value:
                        hitData.launchSpeed != null
                          ? parseFloat(hitData.launchSpeed).toFixed(1)
                          : null,
                      unit: 'mph',
                      icon: '💨',
                    },
                    {
                      label: 'Distance',
                      value:
                        hitData.totalDistance != null
                          ? hitData.totalDistance
                          : null,
                      unit: 'ft',
                      icon: '📏',
                    },
                    {
                      label: 'Angle',
                      value:
                        hitData.launchAngle != null
                          ? hitData.launchAngle
                          : null,
                      unit: '°',
                      icon: '📐',
                    },
                  ].map(({ label, value, unit, icon }) => (
                    <div
                      key={label}
                      className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center"
                    >
                      <div className="text-base mb-1">{icon}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
                        {label}
                      </div>
                      <div className="font-bold text-white text-xl leading-none">
                        {value ?? '—'}
                      </div>
                      {value != null && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Extra hit metadata */}
                {(trajectory || hardness || location) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {trajectory && (
                      <span className="text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700/40 rounded-full text-slate-400 capitalize">
                        {trajectory}
                      </span>
                    )}
                    {hardness && (
                      <span
                        className={`text-[11px] px-2.5 py-1 border rounded-full ${
                          hardness === 'hard'
                            ? `bg-${THEME_COLOR}-500/10 border-${THEME_COLOR}-500/30 text-${THEME_COLOR}-400`
                            : hardness === 'soft'
                              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                              : 'bg-slate-800 border-slate-700/40 text-slate-400'
                        } capitalize`}
                      >
                        {hardness} contact
                      </span>
                    )}
                    {location && (
                      <span className="text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700/40 rounded-full text-slate-400">
                        Zone {location}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Matchup */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest px-4 pt-3 pb-1">
                At Bat Matchup
              </div>
              <div className="flex items-stretch">
                <button
                  className="flex-1 flex flex-col items-center gap-2 p-4 hover:bg-slate-700/30 transition-colors border-r border-slate-700/40"
                  onClick={() => {
                    setSelectedPlay(null);
                    navigate(`/player/${pitcherId}`);
                  }}
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

                <div className="flex flex-col items-center justify-center px-4 gap-3">
                  <div>
                    <div className="text-[9px] text-slate-600 text-center mb-1">
                      OUTS
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full border ${i < outs ? 'bg-red-400 border-red-400' : 'border-slate-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-600 mb-0.5">
                      COUNT
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-200 leading-none">
                      {finalBalls}-{finalStrikes}
                    </div>
                  </div>
                  <div className="text-slate-600 text-lg">⚔</div>
                </div>

                <button
                  className="flex-1 flex flex-col items-center gap-2 p-4 hover:bg-slate-700/30 transition-colors border-l border-slate-700/40"
                  onClick={() => {
                    setSelectedPlay(null);
                    navigate(`/player/${batterId}`);
                  }}
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

            {/* Pitch locations (canvas) */}
            {pitches.length > 0 && (
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                  Pitch Locations
                </div>
                <PitchCanvas
                  playEvents={play.playEvents || []}
                  szTop={szT}
                  szBot={szB}
                  width={260}
                  height={280}
                  gamePk={gamePk}
                  variant="gamedayDark"
                  className="mx-auto"
                />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500 justify-center">
                  {[
                    { color: 'bg-red-400', label: 'Called K' },
                    { color: 'bg-orange-400', label: 'Swing K' },
                    { color: 'bg-green-400', label: 'Ball' },
                    { color: 'bg-blue-500', label: 'In Play' },
                    { color: 'bg-slate-400', label: 'Foul' },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pitch sequence with enhanced data */}
            {pitches.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                  Pitch Sequence · {pitches.length} pitch
                  {pitches.length !== 1 ? 'es' : ''}
                </div>
                <div className="space-y-1.5">
                  {pitches.map((pitch, i) => {
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
                        key={i}
                        className={`flex items-start gap-3 text-xs rounded-xl px-2.5 py-2.5 border ${rowBg}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5 ${dotColor}`}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-200 leading-tight">
                            {desc || '—'}
                          </div>
                          {type && (
                            <div className="text-slate-600 text-[10px] mt-0.5">
                              {type}
                            </div>
                          )}
                          {(spinRate || breakIn) && (
                            <div className="flex gap-3 mt-1">
                              {spinRate && (
                                <span className="text-[10px] text-slate-500">
                                  <span className="text-slate-400">
                                    {Math.round(spinRate)}
                                  </span>{' '}
                                  rpm
                                </span>
                              )}
                              {breakIn && (
                                <span className="text-[10px] text-slate-500">
                                  <span className="text-slate-400">
                                    {parseFloat(breakIn).toFixed(1)}
                                  </span>
                                  ″ brk
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {mph && (
                            <div>
                              <span className="font-bold text-slate-300 font-mono">
                                {mph}
                              </span>
                              <span className="text-slate-600 text-[9px] ml-0.5">
                                mph
                              </span>
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
  };

  // ── Main render ────────────────────────────────────────────────────────────

  const tabList = [
    ...(isLive ? [{ key: 'live', label: 'Live Situation' }] : []),
    { key: 'boxscore', label: 'Box Score' },
    { key: 'summary', label: 'Summary' },
  ];

  const currentTab = !isLive && activeTab === 'live' ? 'boxscore' : activeTab;

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-6 py-0 sm:py-8">
      {/* Mobile compact sticky header — shows instead of nav */}
      <div className="sm:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800/60 grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="flex items-center gap-2 text-sm text-slate-300 active:text-white justify-self-start"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          <span>Scores</span>
        </button>
        <GamedayDayPicker
          games={daySchedule}
          currentGamePk={gamePk}
          loading={dayScheduleLoading}
          onSelect={(pk) => navigate(`/game/${pk}`, { state: { returnDate: location.state?.returnDate } })}
        />
        <div className="justify-self-end flex items-center justify-end min-w-[4.5rem]">
          {isLive ? (
            <div className="flex items-center gap-1 text-[10px] text-red-400">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" />
              <span>
                {ls?.inningHalf === 'Top' ? '▲' : '▼'}
                {ls?.currentInning}
              </span>
            </div>
          ) : (
            <img
              src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg"
              alt="MLB"
              className="w-6 h-6 object-contain"
            />
          )}
        </div>
      </div>

      {/* Desktop: back + ws status */}
      <div className="hidden sm:flex items-center justify-between mb-4 px-0">
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          <span>Scores</span>
        </button>
        {isLive && (
          <div
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              wsStatus === 'connected'
                ? `text-${THEME_COLOR}-400 border-${THEME_COLOR}-500/30 bg-${THEME_COLOR}-500/10`
                : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                  ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                  : 'text-slate-500 border-slate-700/40'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? `bg-${THEME_COLOR}-400 animate-pulse` : wsStatus === 'reconnecting' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`}
            />
            {wsStatus === 'connected'
              ? 'Live'
              : wsStatus === 'reconnecting'
                ? 'Reconnecting…'
                : 'Connecting…'}
          </div>
        )}
      </div>

      <div className="px-0 sm:px-3">
        {/* Scoreboard */}
        <div className={`bg-[#121827] border border-slate-700/60 rounded-2xl overflow-hidden ${isPreview ? 'mb-3' : 'mb-4'}`}>
          {/* Game date / venue */}
         

          <div className={`flex items-center justify-between px-4 sm:px-6 ${isPreview ? 'py-3' : 'py-4 sm:py-5'}`}>
            {/* Away */}
            <div className="flex items-center gap-2 sm:gap-3">
             
              <div>
                <div className="text-sm font-bold text-slate-200 leading-none mb-1">
                  {away.abbreviation}
                </div>
                <div className="text-[12px] text-slate-500   sm:block">
                  {away.record
                    ? `${away.record.wins} - ${away.record.losses}`
                    : ''}
                </div>
              </div>
               <img
                src={teamLogoUrl(away.id)}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                alt={away.abbreviation}
                onClick={() => navigate(`/team/${away.id}`)}
              />
            </div>

            {/* Scores or scheduled start time */}
            {isPreview ? (
              <div className="text-center min-w-[120px] sm:min-w-[160px] px-2">
                {isPostponed ? (
                  <span className="text-orange-400 font-bold text-sm tracking-wide">POSTPONED</span>
                ) : (
                  <>
                    <div className="text-slate-200 font-semibold text-sm sm:text-base leading-tight">
                      {gameStart.dateLine}
                    </div>
                    {gameStart.timeLine && (
                      <div className="text-slate-400 text-xs sm:text-sm mt-1 font-mono">
                        {gameStart.timeLine}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 sm:gap-6">
                <span
                  className={`font-display text-4xl sm:text-5xl tabular-nums leading-none ${awayWins ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
                >
                  {awayRuns}
                </span>
                <div className="text-center min-w-[56px] sm:min-w-[80px]">
                  {isLive ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-red-400 rounded-full live-pulse" />
                        <span className="text-red-400 font-bold text-xs sm:text-sm tracking-wide">
                          LIVE
                        </span>
                      </div>
                      <span className="text-slate-300 text-xs font-semibold">
                        {ls?.inningHalf === 'Top' ? '▲' : '▼'}{' '}
                        {ls?.currentInningOrdinal}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300 font-bold tracking-widest text-xs sm:text-sm">
                      {formatFinalStatus(ls)}
                    </span>
                  )}
                </div>
                <span
                  className={`font-display text-4xl sm:text-5xl tabular-nums leading-none ${homeWins ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
                >
                  {homeRuns}
                </span>
              </div>
            )}

            {/* Home */}
            <div className="flex items-center gap-2 sm:gap-3 justify-end">
               <img
                src={teamLogoUrl(home.id)}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                alt={home.abbreviation}
                onClick={() => navigate(`/team/${home.id}`)}
              />
              <div className="text-right">
                
                <div className="text-sm font-bold text-slate-200 leading-none mb-1">
                  {home.abbreviation}
                </div>
                <div className="text-[12px] text-slate-500   sm:block">
                  {home.record
                    ? `${home.record.wins} - ${home.record.losses}`
                    : ''}
                </div>
              </div>
             
            </div>
          </div>

          {isPreview && venueLine && (
            <div className="px-4 sm:px-6 py-2 border-t border-slate-700/50 text-center text-xs text-slate-400">
              {venueLine}
            </div>
          )}

          {!isPreview && !(isLive && currentTab === 'live') && (
            <LinescoreBoard
              key={gamePk}
              ls={ls}
              away={away}
              home={home}
              awayRuns={awayRuns}
              homeRuns={homeRuns}
            />
          )}

          {/* Pitcher decisions */}
          {!isPreview && decisions &&
            (decisions.winner || decisions.loser || decisions.save) && (
              <div className="px-4 sm:px-6 py-3 grid grid-cols-3 gap-2 sm:gap-4 border-t border-slate-700/50 text-sm">
                {[
                  { label: 'W', player: decisions.winner },
                  { label: 'L', player: decisions.loser },
                  { label: 'S', player: decisions.save },
                ].map(({ label, player }) => {
                  if (!player) return <div key={label} />;
                  const stats = getPitcherStats(player.id);
                  const lastName =
                    player.fullName?.split(' ').slice(-1)[0] ?? player.fullName;
                  return (
                    <div key={label}>
                      <span className="text-slate-500 font-semibold mr-1">
                        {label}:
                      </span>
                      <button
                        onClick={() => navigate(`/player/${player.id}`)}
                        className={`font-semibold text-slate-100 hover:text-${THEME_COLOR}-400 transition-colors`}
                      >
                        {lastName}
                      </button>
                      {stats && (
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {label === 'S'
                            ? stats.saves != null
                              ? `${stats.saves} SV${fmtEra(stats.era) ? `  ${fmtEra(stats.era)} ERA` : ''}`
                              : null
                            : `${stats.wins ?? 0}-${stats.losses ?? 0}${fmtEra(stats.era) ? `  ${fmtEra(stats.era)} ERA` : ''}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {isPreview ? (
          <GamePreviewView
            gamePk={gamePk}
            probablePitchers={gd.probablePitchers}
            away={away}
            home={home}
            season={previewSeason}
          />
        ) : (
          <>
        {/* Tab nav */}
        <TabBar
          variant="page"
          tabs={tabList}
          activeKey={currentTab}
          onChange={setActiveTab}
        />

        {/* Tab content */}
        {currentTab === 'live' && isLive && ls && (
          <div className="space-y-3">

            <LiveAtBatVisual
              venueId={venueId}
              exteriorFailed={exteriorFailed}
              gameDateTime={gd.datetime?.dateTime}
              playEvents={allPitchEvents}
              szTop={szTop}
              szBot={szBot}
              gamePk={gamePk}
              batSide={batSide}
              batterIsAway={batterIsAway}
              inningHalf={ls.inningHalf}
              currentInningOrdinal={ls.currentInningOrdinal}
              balls={ls.balls}
              strikes={ls.strikes}
              outs={ls.outs}
            />

            {/* ── MATCHUP ROW: Pitcher | Count+Outs+Diamond | Batter ── */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-slate-800">
                {/* Pitcher */}
                <button
                  className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-800/40 transition-colors"
                  onClick={() => navigate(`/player/${ls.defense?.pitcher?.id}`)}
                >
                  <div className="text-[8px] text-slate-500 uppercase tracking-widest">
                    Pitching
                  </div>
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 flex-shrink-0">
                    <img
                      src={pitcherActionShotUrl(ls.defense?.pitcher?.id)}
                      className="w-full h-full object-cover object-top"
                      alt=""
                      onError={(e) => {
                        e.target.src = playerHeadshotUrl(ls.defense?.pitcher?.id);
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200 text-center leading-tight max-w-[72px] truncate">
                    {ls.defense?.pitcher?.fullName?.split(' ').slice(-1)[0] || '—'}
                  </div>
                  {(() => {
                    const all = {
                      ...(ld.boxscore?.teams?.away?.players || {}),
                      ...(ld.boxscore?.teams?.home?.players || {}),
                    };
                    const player = all[`ID${ls.defense?.pitcher?.id}`];
                    const gs = player?.stats?.pitching;
                    const ss = player?.seasonStats?.pitching;
                    return (
                      <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
                        {gs?.pitchesThrown != null && (
                          <div className="text-slate-400">
                            {gs.pitchesThrown} pitches
                          </div>
                        )}
                        {gs?.strikeOuts != null && (
                          <div>
                            {gs.strikeOuts}K {gs.baseOnBalls ?? 0}BB
                          </div>
                        )}
                        {ss?.era != null && (
                          <div>ERA {parseFloat(ss.era).toFixed(2)}</div>
                        )}
                      </div>
                    );
                  })()}
                </button>

                {/* Center: bases, count, outs */}
                <div className="flex flex-col items-center justify-center gap-2.5 p-3">
                  <BaseDiamondIndicator
                    onFirst={Boolean(ls.offense?.first)}
                    onSecond={Boolean(ls.offense?.second)}
                    onThird={Boolean(ls.offense?.third)}
                    size="md"
                  />
                  <span className="text-sm font-bold font-mono text-slate-200 tabular-nums">
                    {ls.balls ?? 0}-{ls.strikes ?? 0}
                  </span>
                  <OutsIndicator outs={ls.outs ?? 0} size="md" />
                </div>

                {/* Batter */}
                <button
                  className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-800/40 transition-colors"
                  onClick={() => navigate(`/player/${ls.offense?.batter?.id}`)}
                >
                  <div className="text-[8px] text-slate-500 uppercase tracking-widest">
                    At Bat
                  </div>
                  <div className={`w-14 h-14 rounded-xl overflow-hidden border-2 border-${THEME_COLOR}-500/40 flex-shrink-0`}>
                    <img
                      src={playerActionShotUrl(ls.offense?.batter?.id)}
                      className="w-full h-full object-cover object-top"
                      alt=""
                      onError={(e) => {
                        e.target.src = playerHeadshotUrl(ls.offense?.batter?.id);
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200 text-center leading-tight max-w-[72px] truncate">
                    {ls.offense?.batter?.fullName?.split(' ').slice(-1)[0] || '—'}
                  </div>
                  {(() => {
                    const all = {
                      ...(ld.boxscore?.teams?.away?.players || {}),
                      ...(ld.boxscore?.teams?.home?.players || {}),
                    };
                    const player = all[`ID${ls.offense?.batter?.id}`];
                    const gs = player?.stats?.batting;
                    const ss = player?.seasonStats?.batting;
                    return (
                      <div className="text-[9px] text-slate-500 font-mono text-center space-y-0.5">
                        {gs != null && (
                          <div className={`text-${THEME_COLOR}-400/80 font-semibold`}>
                            {gs.hits ?? 0}-{gs.atBats ?? 0}
                          </div>
                        )}
                        {ss?.avg && <div>AVG {ss.avg}</div>}
                        {ss?.ops && <div>OPS {ss.ops}</div>}
                      </div>
                    );
                  })()}
                </button>
              </div>
            </div>

            {/* ── VS STATS: Batter career stats vs this pitcher ── */}
            {vsStats && vsStats.atBats > 0 && (
              <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-3">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2.5 text-center">
                  {ls.offense?.batter?.fullName?.split(' ').slice(-1)[0]} vs{' '}
                  {ls.defense?.pitcher?.fullName?.split(' ').slice(-1)[0]} — career
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {[
                    { label: 'AB', value: vsStats.atBats },
                    { label: 'AVG', value: vsStats.avg },
                    { label: 'H', value: vsStats.hits },
                    { label: 'HR', value: vsStats.homeRuns },
                    { label: 'K', value: vsStats.strikeOuts },
                    { label: 'BB', value: vsStats.baseOnBalls },
                    vsStats.ops ? { label: 'OPS', value: vsStats.ops } : null,
                  ]
                    .filter(Boolean)
                    .filter(
                      (s) =>
                        s.value != null &&
                        s.value !== '-' &&
                        s.value !== '-.---',
                    )
                    .map(({ label, value }) => (
                      <div key={label} className="text-center min-w-[32px]">
                        <div className="text-[8px] text-slate-500">{label}</div>
                        <div className="text-xs font-bold font-mono text-slate-200">
                          {value}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── RECENT PLAYS: live timeline ── */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                  Recent Plays
                </span>
                <span className="text-[9px] text-slate-600">
                  {liveRecentRows.length} events
                </span>
              </div>
              <div className="p-2 sm:p-5">
                <LiveRecentPlaysTimeline
                  groups={liveRecentGroups}
                  firstPitch={liveFirstPitch}
                  away={away}
                  home={home}
                  getPlayBadge={getPlayBadge}
                  highlightByItemKey={highlightByItemKey}
                  expandedVideoKey={expandedVideoKey}
                  pinnedVideo={pinnedVideo}
                  onPlayerClick={(e, batterId) => handleSummaryPlayerClick(e, batterId)}
                  onOpenPlay={openSheet}
                  onToggleVideo={handleSummaryVideoToggle}
                  ScoringPlayVideo={ScoringPlayVideo}
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === 'boxscore' && ld.boxscore && (
          <div className="bg-slate-900 border border-slate-700/60  p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <SegmentedControl
                value={boxScoreSide}
                onChange={setBoxScoreSide}
                variant="pill"
                size="md"
                options={[
                  {
                    value: 'away',
                    label: away.teamName || away.name || away.abbreviation,
                  },
                  {
                    value: 'home',
                    label: home.teamName || home.name || home.abbreviation,
                  },
                ]}
              />
              <span className="text-sm text-slate-400 tabular-nums">{gameStart.dateLine}</span>
            </div>
            <TeamBoxSection
              sideKey={boxScoreSide}
              team={boxScoreSide === 'away' ? away : home}
              hideHeader
            />

            {ld.boxscore.info?.length > 0 && (
              <div className="mt-2 pt-4 border-t border-slate-700/40 text-[11px] text-slate-500 space-y-1">
                {ld.boxscore.info.map((item, i) => (
                  <div key={i}>
                    <span className="font-semibold text-slate-400">
                      {item.label}:
                    </span>{' '}
                    {item.value}
                  </div>
                ))}
              </div>
            )}

            {ld.boxscore.weather && (
              <div className="text-[11px] text-slate-500 mt-1">
                <span className="font-semibold text-slate-400">Weather:</span>{' '}
                {[
                  ld.boxscore.weather.condition,
                  ld.boxscore.weather.temp && `${ld.boxscore.weather.temp}°F`,
                  ld.boxscore.weather.wind &&
                    `Wind: ${ld.boxscore.weather.wind}`,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
          </div>
        )}

        {currentTab === 'summary' && (
          <div className="bg-slate-900 border border-slate-700/60 p-2 sm:p-5">
            <SegmentedControl
              value={summaryFilter}
              onChange={setSummaryFilter}
              variant="pill"
              size="sm"
              className="mb-4"
              options={[
                { value: 'all', label: 'All Plays' },
                { value: 'scoring', label: 'Scoring Only' },
              ]}
            />

            <div className="space-y-5">
              {summaryFilter === 'all' && (
                <div className="pb-2 border-b border-slate-800/60">
                  <SummaryFirstPitchRow item={summaryLeadIn} />
                </div>
              )}
              {summaryItemGroups.map(({ key, items: groupItems }) => (
                <div key={key}>
                  <div className="text-2xl font-bold text-slate-300 mb-2">
                    {key}
                  </div>
                  <div className="space-y-1.5">
                    {groupItems.map((item) => (
                      <div key={item.key}>
                        <SummaryPlayItemRow
                          item={item}
                          awayAbbr={away.abbreviation}
                          homeAbbr={home.abbreviation}
                          highlightByItemKey={highlightByItemKey}
                          expandedVideoKey={expandedVideoKey}
                          pinnedVideo={pinnedVideo}
                          onPlayerClick={(e) => handleSummaryPlayerClick(e, item.batterId)}
                          onOpenPlay={openSheet}
                          onToggleVideo={handleSummaryVideoToggle}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {summaryItemGroups.length === 0 && (
                <div className="text-xs text-slate-600 italic text-center pt-4">
                  No plays yet
                </div>
              )}
            </div>
          </div>
        )}

        <PlayDetailSheet />
          </>
        )}
      </div>
      {/* end px-3 sm:px-0 */}
    </div>
  );
}
