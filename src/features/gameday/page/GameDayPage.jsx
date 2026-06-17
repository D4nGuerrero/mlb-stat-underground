import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { THEME_COLOR } from '../../../theme/theme.js';
import { BaseballSpinner } from '../../../components/ui';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMLBWebSocket } from '../../../hooks/useMLBWebSocket';
import {
  teamLogoUrl,
  stadiumExteriorUrl,
  stadiumTimeOfDay,
  getLinescoreInningNums,
  formatFinalStatus,
} from '../../../utils/mlbHelpers';
import {
  buildSummaryItems,
  buildSummaryLeadIn,
  filterSummaryItems,
  groupSummaryByInning,
} from '../../../utils/gamePlaySummary';
import {
  parseGameHighlightVideos,
  buildHighlightMap,
} from '../../../utils/gameContent';
import { TabBar, SegmentedControl } from '../../../components/ui';
import GamePreviewView from '../../../components/GamePreviewView';
import GameLineupsView from '../../../components/GameLineupsView';
import { formatGameStartDisplay, formatVenueLine } from '../../../utils/gamePreview';
import { lineupsAvailable } from '../../../utils/gameLineups';
import { mergeLiveFeed, isValidLiveFeed, compareTimecodes } from '../../../utils/liveFeedMerge';
import { assetUrl } from '../../../utils/baseUrl.js';
import LiveRecentPlaysTimeline from '../../../components/LiveRecentPlaysTimeline';
import LiveAtBatVisual from '../../../components/LiveAtBatVisual';
import ScoresListGameRow from '../../../components/ScoresListGameRow';
import LiveMatchupStrip from '../components/LiveMatchupStrip';
import PlayDetailSheet from '../components/PlayDetailSheet';
import SummarySection, { ScoringPlayVideo } from '../components/SummarySection';
import TeamBoxSection from '../components/TeamBoxSection';
import { useDaySchedule } from '../hooks/useDaySchedule';
import { useGameContent } from '../hooks/useGameContent';
import { useLiveRecentPlays } from '../hooks/useLiveRecentPlays';
import { usePreviewLineups } from '../hooks/usePreviewLineups';
import { useVsStats } from '../hooks/useVsStats';

// ─── helpers ────────────────────────────────────────────────────────────────

const LIVE_DIFF_POLL_MS = 2_500;
const LIVE_FULL_FEED_REFRESH_MS = 4_000;
const SHOW_PLAY_DETAIL_PITCH_TRAILS = false;

async function fetchLiveGameFeed(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!isValidLiveFeed(data)) throw new Error('Invalid live feed');
  return data;
}

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

const getPlayHitData = (play) => {
  if (play?.hitData) return play.hitData;
  const events = play?.playEvents ?? [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.isPitch && event.hitData) return event.hitData;
  }
  return null;
};

const hasPlayHitData = (hitData) =>
  hitData != null &&
  (hitData.launchSpeed != null ||
    hitData.totalDistance != null ||
    hitData.launchAngle != null);

const HIT_TRAJECTORY_LABELS = {
  ground_ball: 'Ground Ball',
  line_drive: 'Line Drive',
  fly_ball: 'Fly Ball',
  popup: 'Popup',
  bunt_grounder: 'Bunt',
  bunt_line_drive: 'Bunt LD',
  bunt_popup: 'Bunt Popup',
};

const exitVeloTone = (mph) => {
  if (mph == null || Number.isNaN(mph)) return 'text-slate-400';
  if (mph >= 100) return 'text-yellow-300';
  if (mph >= 95) return `text-${THEME_COLOR}-300`;
  return 'text-white';
};

const exitVeloBarColor = (mph) => {
  if (mph == null || Number.isNaN(mph)) return 'bg-slate-600';
  if (mph >= 100) return 'bg-yellow-400';
  if (mph >= 95) return `bg-${THEME_COLOR}-400`;
  return 'bg-slate-400';
};

const distanceTone = (ft) => {
  if (ft == null || Number.isNaN(ft)) return 'text-slate-400';
  if (ft >= 400) return 'text-yellow-300';
  if (ft >= 350) return `text-${THEME_COLOR}-300`;
  return 'text-white';
};

function HitDataPanel({ hitData }) {
  if (!hasPlayHitData(hitData)) return null;

  const exitVelo =
    hitData.launchSpeed != null ? parseFloat(hitData.launchSpeed) : null;
  const distance =
    hitData.totalDistance != null ? Number(hitData.totalDistance) : null;
  const launchAngle =
    hitData.launchAngle != null ? Number(hitData.launchAngle) : null;

  const trajectoryLabel =
    HIT_TRAJECTORY_LABELS[hitData.trajectory] ||
    hitData.trajectory?.replace(/_/g, ' ');
  const hardness = hitData.hardness;
  const location = hitData.location;

  const evBarWidth =
    exitVelo != null
      ? Math.min(100, Math.max(6, ((exitVelo - 55) / 65) * 100))
      : 0;
  const distBarWidth =
    distance != null
      ? Math.min(100, Math.max(6, (distance / 500) * 100))
      : 0;
  const laBarWidth =
    launchAngle != null
      ? Math.min(100, Math.max(4, ((launchAngle + 20) / 70) * 100))
      : 0;

  const stats = [
    {
      key: 'exit',
      label: 'Exit Velocity',
      short: 'EV',
      value: exitVelo != null ? exitVelo.toFixed(1) : '—',
      unit: 'mph',
      tone: exitVeloTone(exitVelo),
      bar: evBarWidth,
      barColor: exitVeloBarColor(exitVelo),
    },
    {
      key: 'distance',
      label: 'Distance',
      short: 'Dist',
      value: distance != null ? Math.round(distance) : '—',
      unit: 'ft',
      tone: distanceTone(distance),
      bar: distBarWidth,
      barColor:
        distance != null && distance >= 400
          ? 'bg-yellow-400'
          : distance != null && distance >= 350
            ? `bg-${THEME_COLOR}-400`
            : 'bg-slate-400',
    },
    {
      key: 'angle',
      label: 'Launch Angle',
      short: 'LA',
      value: launchAngle != null ? launchAngle : '—',
      unit: '°',
      tone: 'text-white',
      bar: laBarWidth,
      barColor:
        launchAngle != null && launchAngle >= 25 && launchAngle <= 35
          ? 'bg-yellow-400/80'
          : 'bg-slate-400',
    },
  ];

  return (
    <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-700/30">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
          Statcast
        </div>
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wide">
          Batted Ball
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-700/30">
        {stats.map(({ key, label, short, value, unit, tone, bar, barColor }) => (
          <div key={key} className="px-3 py-4 text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </div>
            <div className={`font-display text-2xl sm:text-3xl tabular-nums leading-none ${tone}`}>
              {value}
              {value !== '—' && (
                <span className="text-sm sm:text-base font-mono text-slate-500 ml-0.5">
                  {unit}
                </span>
              )}
            </div>
            {value !== '—' && (
              <div className="mt-3 h-1 rounded-full bg-slate-700/80 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${bar}%` }}
                />
              </div>
            )}
            {key === 'angle' && launchAngle != null && (
              <div className="mx-auto mt-2.5 w-14 h-7 relative">
                <div className="absolute bottom-0 left-1 right-1 h-px bg-slate-600" />
                <div
                  className="absolute bottom-0 left-1/2 w-6 h-px bg-slate-400 origin-left"
                  style={{ transform: `rotate(${-launchAngle}deg)` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {(trajectoryLabel || hardness || location) && (
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-700/30 bg-slate-900/20">
          {trajectoryLabel && (
            <span className="text-[11px] px-2.5 py-1 bg-slate-800 border border-slate-700/40 rounded-full text-slate-400 capitalize">
              {trajectoryLabel}
            </span>
          )}
          {hardness && (
            <span
              className={`text-[11px] px-2.5 py-1 border rounded-full capitalize ${
                hardness === 'hard'
                  ? `bg-${THEME_COLOR}-500/10 border-${THEME_COLOR}-500/30 text-${THEME_COLOR}-400`
                  : hardness === 'soft'
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    : 'bg-slate-800 border-slate-700/40 text-slate-400'
              }`}
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
  );
}

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
  const pickerOrder = (game) => {
    const state = game.status?.abstractGameState;
    if (state === 'Live') return 0;
    if (state === 'Final') return 2;
    return 1;
  };

  return [...byPk.values()].sort((a, b) => {
    const stateDiff = pickerOrder(a) - pickerOrder(b);
    if (stateDiff !== 0) return stateDiff;
    const numA = a.gameNumber ?? 1;
    const numB = b.gameNumber ?? 1;
    if (numA !== numB) return numA - numB;
    return new Date(a.gameDate ?? 0) - new Date(b.gameDate ?? 0);
  });
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
        className="z-50 mt-2 w-[min(100vw-1rem,20rem)] max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-xl focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {loading && (
          <div className="px-4 py-3 text-xs text-slate-500">Loading games…</div>
        )}
        {!loading && count === 0 && (
          <div className="px-4 py-3 text-xs text-slate-500">No other games today</div>
        )}
        {!loading && count > 0 && (
          <div className="divide-y divide-slate-800/60">
            {games.map((game) => {
              const isCurrent = String(game.gamePk) === String(currentGamePk);
              return (
                <MenuItem key={game.gamePk} disabled={isCurrent} as="div">
                  {({ focus, close }) => (
                    <ScoresListGameRow
                      game={game}
                      compact
                      isSelected={isCurrent}
                      className={focus && !isCurrent ? 'bg-slate-800/60' : ''}
                      onClick={isCurrent ? undefined : () => {
                        close();
                        onSelect(game.gamePk);
                      }}
                    />
                  )}
                </MenuItem>
              );
            })}
          </div>
        )}
      </MenuItems>
    </Menu>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

function GamePageContent({ gamePk, navigate, location }) {

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('live');
  const [boxScoreSide, setBoxScoreSide] = useState('away');
  // Track whether we pushed a history entry for the sheet
  const sheetHistoryRef = useRef(false);
  const summaryScrollYRef = useRef(0);
  const feedTimecodeRef = useRef(null);
  const [expandedVideoKey, setExpandedVideoKey] = useState(null);
  const [pinnedVideo, setPinnedVideo] = useState(null);
  const [previewTab, setPreviewTab] = useState('preview');
  const officialDate = feed?.gameData?.datetime?.officialDate;
  const scoringCount = feed?.liveData?.plays?.scoringPlays?.length ?? 0;
  const batterId = feed?.liveData?.linescore?.offense?.batter?.id;
  const pitcherId = feed?.liveData?.linescore?.defense?.pitcher?.id;
  const { daySchedule, dayScheduleLoading } = useDaySchedule(officialDate, dedupeDaySchedule);
  const { gameContent } = useGameContent(gamePk, scoringCount);
  const { previewLineups, previewLineupsLoading } = usePreviewLineups(
    gamePk,
    feed?.gameData?.status?.abstractGameState,
  );
  const { visibleVsStats } = useVsStats(batterId, pitcherId);
  const {
    dueUpBatters,
    dueUpHalfLabel,
    dueUpInningOrdinal,
    liveFirstPitch,
    liveRecentGroups,
    liveRecentRows,
    revealLiveRecentRow,
    showDueUpMatchup,
  } = useLiveRecentPlays({
    feed,
    ordinals: ORDINALS,
    isLive: feed?.gameData?.status?.abstractGameState === 'Live',
    linescore: feed?.liveData?.linescore,
  });

  useEffect(() => {
    if (!gamePk) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLiveGameFeed(gamePk);
        if (cancelled) return;
        feedTimecodeRef.current = data.metaData?.timeStamp ?? null;
        setFeed(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gamePk]);

  const { status: wsStatus, lastUpdate } = useMLBWebSocket(
    gamePk ? parseInt(gamePk) : null,
    feed?.gameData?.status?.abstractGameState,
    feed?.metaData?.timeStamp,
  );

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
      (async () => {
        try {
          const data = await fetchLiveGameFeed(gamePk);
          feedTimecodeRef.current = data.metaData?.timeStamp ?? null;
          setFeed(data);
        } catch (err) {
          setError(err.message);
        }
      })();
    }
  }, [lastUpdate, applyFeedPatch, gamePk]);

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

    const id = setInterval(pollDiff, LIVE_DIFF_POLL_MS);
    return () => clearInterval(id);
  }, [gamePk, feed?.gameData?.status?.abstractGameState, applyFeedPatch]);

  useEffect(() => {
    if (!gamePk || feed?.gameData?.status?.abstractGameState !== 'Live') return undefined;
    const pollFullFeed = async () => {
      try {
        const data = await fetchLiveGameFeed(gamePk);
        feedTimecodeRef.current = data.metaData?.timeStamp ?? null;
        setFeed(data);
      } catch (err) {
        setError(err.message);
      }
    };

    void pollFullFeed();
    const id = setInterval(pollFullFeed, LIVE_FULL_FEED_REFRESH_MS);
    return () => clearInterval(id);
  }, [gamePk, feed?.gameData?.status?.abstractGameState]);

  useEffect(() => {
    const saveScroll = () => {
      if (activeTab === 'summary') summaryScrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => window.removeEventListener('scroll', saveScroll);
  }, [activeTab]);

  useLayoutEffect(() => {
    if (expandedVideoKey) return;
    if (selectedPlay) return;
    if (activeTab === 'summary' && summaryScrollYRef.current > 0) {
      window.scrollTo(0, summaryScrollYRef.current);
    }
  }, [feed, activeTab, expandedVideoKey, selectedPlay]);

  // Hide nav bar on mobile while game page is open
  useEffect(() => {
    document.body.classList.add('game-page-open');
    return () => document.body.classList.remove('game-page-open');
  }, []);

  const venueId = feed?.gameData?.venue?.id;
  const exteriorTimeOfDay = stadiumTimeOfDay(feed?.gameData?.gameDate);
  const exteriorSrc = venueId ? stadiumExteriorUrl(venueId, exteriorTimeOfDay) : null;
  const [exteriorFailed, setExteriorFailed] = useState(() => !exteriorSrc);

  useEffect(() => {
    if (!exteriorSrc) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setExteriorFailed(false);
    };
    img.onerror = () => {
      if (!cancelled) setExteriorFailed(true);
    };
    img.src = exteriorSrc;
    return () => {
      cancelled = true;
    };
  }, [exteriorSrc]);

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
    const onPopState = () => {
      if (selectedPlay) {
        sheetHistoryRef.current = false;
        setSelectedPlay(null);
        // Prevent route navigation — do nothing else
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedPlay]);

  const handlePlayDetailPlayerSelect = useCallback(
    (playerId) => {
      setSelectedPlay(null);
      if (playerId) navigate(`/player/${playerId}`);
    },
    [navigate],
  );

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
  const szTop = latestPitch?.pitchData?.strikeZoneTop || 3.55;
  const szBot = latestPitch?.pitchData?.strikeZoneBottom || 1.47;
  const currentPlay = ld.plays?.currentPlay;
  const batSide = currentPlay?.matchup?.batSide?.code || 'R';
  const batterIsAway = ls?.inningHalf === 'Top'; // top inning → away team bats

  const awayRuns = ls?.teams?.away?.runs ?? 0;
  const homeRuns = ls?.teams?.home?.runs ?? 0;
  const awayWins = isFinal && awayRuns > homeRuns;
  const homeWins = isFinal && homeRuns > awayRuns;
  const gamePlayers = {
    ...(ld.boxscore?.teams?.away?.players || {}),
    ...(ld.boxscore?.teams?.home?.players || {}),
  };

  const getGamePlayer = (playerId) => gamePlayers[`ID${playerId}`];

  const getPitcherGameStat = (playerId) => getGamePlayer(playerId)?.stats?.pitching || null;
  const getBatterGameStat = (playerId) => getGamePlayer(playerId)?.stats?.batting || null;

  const getPitcherStats = (playerId) => {
    const player = getGamePlayer(playerId);
    return player?.seasonStats?.pitching || player?.stats?.pitching || null;
  };

  const getLastName = (player) =>
    player?.fullName?.split(' ').slice(-1)[0] ||
    player?.name?.split(' ').slice(-1)[0] ||
    '';

  const formatCurrentBattingLine = (player) => {
    if (!player?.id) return null;
    const stat = getBatterGameStat(player.id);
    return `${getLastName(player)}: ${stat?.hits ?? 0} - ${stat?.atBats ?? 0}`;
  };

  const vsMatchupLine =
    visibleVsStats && visibleVsStats.atBats > 0
      ? `vs. ${getLastName(ls?.defense?.pitcher)}: ${visibleVsStats.hits ?? 0} - ${visibleVsStats.atBats ?? 0} (${visibleVsStats.avg ?? '.000'}) ${visibleVsStats.homeRuns ?? 0} HR, ${visibleVsStats.rbi ?? 0} RBI, ${visibleVsStats.strikeOuts ?? 0}K`
      : null;

  const onDeckLine = formatCurrentBattingLine(
    ls?.offense?.onDeck || dueUpBatters?.[1],
  );
  const inHoleLine = formatCurrentBattingLine(
    ls?.offense?.inHole || ls?.offense?.inTheHole || dueUpBatters?.[2],
  );
  const dueUpTickerLine = [onDeckLine && `On Deck: ${onDeckLine}`, inHoleLine && `In the hole: ${inHoleLine}`]
    .filter(Boolean)
    .join('  |  ');

  const allPlays = ld.plays?.allPlays || [];

  const summaryLeadIn = buildSummaryLeadIn(gd);
  const allSummaryItems = buildSummaryItems(allPlays, gd);
  const summaryItems = filterSummaryItems(allSummaryItems, summaryFilter);
  const summaryItemGroups = groupSummaryByInning(summaryItems, ORDINALS);
  const highlightVideos = parseGameHighlightVideos(gameContent);
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

  // ── Main render ────────────────────────────────────────────────────────────

  const tabList = [
    ...(isLive ? [{ key: 'live', label: 'Live Situation' }] : []),
    { key: 'boxscore', label: 'Box Score' },
    { key: 'summary', label: 'Summary' },
  ];

  const currentTab = !isLive && activeTab === 'live' ? 'boxscore' : activeTab;

  const gameTabBar = (
    <TabBar
      variant="page"
      tabs={tabList}
      activeKey={currentTab}
      onChange={setActiveTab}
    />
  );

  const liveVisualPanel = isLive && ls ? (
    <>
      <div className="hidden xl:block bg-[#121827] border border-slate-700/60 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-bold text-slate-200 leading-none mb-1">
                {away.abbreviation}
              </div>
              <div className="text-[12px] text-slate-500">
                {away.record
                  ? `${away.record.wins} - ${away.record.losses}`
                  : ''}
              </div>
            </div>
            <img
              src={teamLogoUrl(away.id)}
              className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              alt={away.abbreviation}
              onClick={() => navigate(`/team/${away.id}`)}
            />
          </div>

          <div className="flex items-center gap-6">
            <span
              className={`font-display text-5xl tabular-nums leading-none ${awayWins ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
            >
              {awayRuns}
            </span>
            <div className="text-center min-w-[80px]">
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-400 rounded-full live-pulse" />
                  <span className="text-red-400 font-bold text-sm tracking-wide">
                    LIVE
                  </span>
                </div>
                <span className="text-slate-300 text-xs font-semibold">
                  {ls?.inningHalf === 'Top' ? '▲' : '▼'}{' '}
                  {ls?.currentInningOrdinal}
                </span>
              </div>
            </div>
            <span
              className={`font-display text-5xl tabular-nums leading-none ${homeWins ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}
            >
              {homeRuns}
            </span>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <img
              src={teamLogoUrl(home.id)}
              className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              alt={home.abbreviation}
              onClick={() => navigate(`/team/${home.id}`)}
            />
            <div className="text-right">
              <div className="text-sm font-bold text-slate-200 leading-none mb-1">
                {home.abbreviation}
              </div>
              <div className="text-[12px] text-slate-500">
                {home.record
                  ? `${home.record.wins} - ${home.record.losses}`
                  : ''}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-700/50 xl:hidden">
          {gameTabBar}
        </div>
      </div>

      <div className="xl:flex-1 xl:min-h-0">
        <LiveAtBatVisual
          venueId={venueId}
          exteriorFailed={exteriorFailed}
          gameDateTime={gd.datetime?.dateTime}
          currentPlay={currentPlay}
          playEvents={allPitchEvents}
          szTop={szTop}
          szBot={szBot}
          gamePk={gamePk}
          batSide={batSide}
          batterIsAway={batterIsAway}
          onRecentRowReady={revealLiveRecentRow}
          baseballModelUrl={assetUrl('baseball-centered.glb')}
          className="xl:h-full xl:min-h-0"
        />
      </div>

      <LiveMatchupStrip
        currentPlay={currentPlay}
        dueUpBatters={dueUpBatters}
        dueUpHalfLabel={dueUpHalfLabel}
        dueUpInningOrdinal={dueUpInningOrdinal}
        getBatterGameStat={getBatterGameStat}
        getPitcherGameStat={getPitcherGameStat}
        linescore={ls}
        onPlayerSelect={handlePlayDetailPlayerSelect}
        showDueUpMatchup={showDueUpMatchup}
      />

      {(vsMatchupLine || dueUpTickerLine) && (
        <div className="bg-slate-900 border border-slate-700/60 sm:rounded-2xl px-3 py-2">
          {vsMatchupLine && dueUpTickerLine ? (
            <div className="live-info-swap text-center text-[11px] sm:text-xs font-semibold text-slate-300">
              <div className="live-info-swap__line live-info-swap__line--primary">
                {vsMatchupLine}
              </div>
              <div className={`live-info-swap__line live-info-swap__line--secondary text-${THEME_COLOR}-300`}>
                {dueUpTickerLine}
              </div>
            </div>
          ) : (
            <div className={`flex h-5 items-center justify-center truncate text-center text-[11px] sm:text-xs font-semibold leading-none ${vsMatchupLine ? 'text-slate-300' : `text-${THEME_COLOR}-300`}`}>
              {vsMatchupLine || dueUpTickerLine}
            </div>
          )}
        </div>
      )}
    </>
  ) : null;

  const recentPlaysPanel = (
    <div className="bg-slate-900 border border-slate-700/60 sm:rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
          Recent Plays
        </span>
        <span className="text-[9px] text-slate-600">
          {liveRecentRows.length} events
        </span>
      </div>
      <div className="p-2 sm:p-4 xl:p-3 2xl:p-4">
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
  );

  const boxScorePanel = ld.boxscore ? (
    <div className="bg-slate-900 border border-slate-700/60 p-4 sm:p-5 xl:p-4 rounded-2xl">
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
        teamBox={ld.boxscore?.teams?.[boxScoreSide]}
        decisions={decisions}
        hideHeader
        onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
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
  ) : null;

  const desktopLiveBoxScorePanel = ld.boxscore ? (
    <div className="bg-slate-900 border border-slate-700/60 p-3 2xl:p-4 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
          Box Score
        </span>
        <span className="text-[11px] text-slate-500 tabular-nums">
          {gameStart.dateLine}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 2xl:gap-4">
        <TeamBoxSection
          sideKey="away"
          team={away}
          teamBox={ld.boxscore?.teams?.away}
          decisions={decisions}
          compact
          onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
        />
        <TeamBoxSection
          sideKey="home"
          team={home}
          teamBox={ld.boxscore?.teams?.home}
          decisions={decisions}
          compact
          onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
        />
      </div>
    </div>
  ) : null;

  return (
    <div
      className={`max-w-5xl mx-auto px-0 sm:px-6 py-0 sm:py-8 ${
        isLive && currentTab === 'live'
          ? 'xl:max-w-none xl:px-3 2xl:px-5 xl:py-3'
          : 'xl:max-w-[1500px]'
      }`}
    >
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
      <div className={`hidden sm:flex items-center justify-between mb-4 px-0 ${isLive && currentTab === 'live' ? 'xl:hidden' : ''}`}>
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
        <div className={`bg-[#121827] border-y border-slate-700/60  overflow-hidden ${isPreview ? 'mb-3' : ''} ${isLive && currentTab === 'live' ? 'xl:hidden' : ''}`}>
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

          {isLive && !isPreview && (
            <div className="border-t border-slate-700/50">
              {gameTabBar}
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
          <>
            {lineupsAvailable(previewLineups) && (
              <TabBar
                variant="page"
                tabs={[
                  { key: 'preview', label: 'Preview' },
                  { key: 'lineups', label: 'Lineups' },
                ]}
                activeKey={previewTab}
                onChange={setPreviewTab}
              />
            )}
            {previewTab === 'lineups' && lineupsAvailable(previewLineups) ? (
              previewLineupsLoading ? (
                <div className="flex justify-center py-10">
                  <BaseballSpinner size="lg" />
                </div>
              ) : (
                <GameLineupsView lineups={previewLineups} away={away} home={home} />
              )
            ) : (
              <GamePreviewView
                gamePk={gamePk}
                probablePitchers={gd.probablePitchers}
                away={away}
                home={home}
                season={previewSeason}
              />
            )}
          </>
        ) : (
          <>
        {!isLive && gameTabBar}

        {/* Tab content */}
        {isLive && ls && (
          <div
            className={
              currentTab === 'live'
                ? 'relative  overflow-x-hidden xl:h-[calc(100vh-88px)] xl:min-h-0 xl:grid xl:grid-cols-[280px_minmax(460px,0.95fr)_minmax(560px,1.2fr)] 2xl:grid-cols-[320px_minmax(560px,0.9fr)_minmax(780px,1.4fr)] xl:items-start xl:gap-4 xl:space-y-0 xl:overflow-hidden'
                : 'hidden'
            }
            aria-hidden={currentTab !== 'live'}
          >
            <div className="xl:order-2 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-3 xl:overflow-hidden xl:pr-1">
              {liveVisualPanel}
            </div>

            <div className="xl:order-1 xl:h-full xl:min-h-0 xl:overflow-y-auto">
              {recentPlaysPanel}
            </div>

            <div className="hidden xl:order-3 xl:block xl:h-full xl:min-h-0 xl:overflow-y-auto">
              {desktopLiveBoxScorePanel}
            </div>
          </div>
        )}

        {currentTab === 'boxscore' && boxScorePanel}

        {currentTab === 'summary' && (
          <SummarySection
            awayAbbr={away.abbreviation}
            expandedVideoKey={expandedVideoKey}
            getPlayBadge={getPlayBadge}
            highlightByItemKey={highlightByItemKey}
            homeAbbr={home.abbreviation}
            onOpenPlay={openSheet}
            onPlayerClick={handleSummaryPlayerClick}
            onToggleVideo={handleSummaryVideoToggle}
            pinnedVideo={pinnedVideo}
            pitchingChangeBadge={PITCHING_CHANGE_BADGE}
            statusChangeBadge={STATUS_CHANGE_BADGE}
            summaryFilter={summaryFilter}
            summaryItemGroups={summaryItemGroups}
            summaryLeadIn={summaryLeadIn}
            onSummaryFilterChange={setSummaryFilter}
          />
        )}

        <PlayDetailSheet
          selectedPlay={selectedPlay}
          closeSheet={closeSheet}
          away={away}
          home={home}
          allPlays={allPlays}
          gamePk={gamePk}
          onPlayerSelect={handlePlayDetailPlayerSelect}
          getPlayBadge={getPlayBadge}
          getPlayHitData={getPlayHitData}
          renderHitDataPanel={(hitData) => <HitDataPanel hitData={hitData} />}
          showPitchTrails={SHOW_PLAY_DETAIL_PITCH_TRAILS}
        />
          </>
        )}
      </div>
      {/* end px-3 sm:px-0 */}
    </div>
  );
}

export default function GameDayPage() {
  const { gamePk } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return <GamePageContent key={gamePk} gamePk={gamePk} navigate={navigate} location={location} />;
}

