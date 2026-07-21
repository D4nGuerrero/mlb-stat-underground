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
  compactPlayerName,
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
  buildMiLBHighlightMap,
  buildYoutubeHighlightFallbackMap,
} from '../../../utils/gameContent';
import { TabBar, SegmentedControl, Modal } from '../../../components/ui';
import GamePreviewView from '../../../components/GamePreviewView';
import GameLineupsView from '../../../components/GameLineupsView';
import { formatGameStartDisplay, formatVenueLine } from '../../../utils/gamePreview';
import { lineupsAvailable } from '../../../utils/gameLineups';
import { mergeLiveFeed, isValidLiveFeed, compareTimecodes } from '../../../utils/liveFeedMerge';
import { assetUrl } from '../../../utils/baseUrl.js';
import LiveRecentPlaysTimeline from '../../../components/LiveRecentPlaysTimeline';
import LiveAtBatVisual from '../../../components/LiveAtBatVisual';
import PitchCanvas from '../../../components/PitchCanvas';
import ScoresListGameRow from '../../../components/ScoresListGameRow';
import {
  BaseDiamondIndicator,
  OutsIndicator,
  formatLiveInningLabel,
  getRunnersOnBase,
  getPlayDetailSituation,
} from '../../../components/LiveGameIndicators';
import LiveMatchupStrip from '../components/LiveMatchupStrip';
import PlayDetailSheet from '../components/PlayDetailSheet';
import SummarySection, { ScoringPlayVideo } from '../components/SummarySection';
import SavantStatcastSection from '../components/SavantStatcastSection';
import TeamBoxSection, { TeamReservesSection } from '../components/TeamBoxSection';
import { useDaySchedule } from '../hooks/useDaySchedule';
import { useGameContent } from '../hooks/useGameContent';
import { useLiveRecentPlays } from '../hooks/useLiveRecentPlays';
import { usePreviewLineups } from '../hooks/usePreviewLineups';
import { useVsStats } from '../hooks/useVsStats';
import { useLocalStorageState } from '../../../hooks/useStorageState';

// ─── helpers ────────────────────────────────────────────────────────────────

const LIVE_DIFF_POLL_MS = 2_500;
const LIVE_FULL_FEED_REFRESH_MS = 4_000;
const EVENT_TYPES_URL = 'https://statsapi.mlb.com/api/v1/eventTypes';
const SHOW_PLAY_DETAIL_PITCH_TRAILS = false;
const GAMEDAY_IN_PLAY_OUTS_PURPLE_KEY = 'gameday:inPlayOutsPurple';
const MLB_LEAGUE_LOGO = 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg';
const MILB_LEAGUE_LOGO = 'https://www.mlbstatic.com/team-logos/league-on-dark/milb-alt.svg';
const LMB_SPORT_ID = 23;
const MILB_SPORT_IDS = new Set([11, 12, 13, 14, 16]);
const LMB_FIELD_BACKGROUND_URL = 'https://lmb.com.mx/_next/image?url=%2Fimages%2Ffield.webp&w=1200&q=75';
const milbStadiumTopUrl = (timeOfDay = 'day') =>
  `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/stadiums/${timeOfDay}/default-milb@2x.jpg`;

async function fetchLiveGameFeed(gamePk, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isValidLiveFeed(data)) throw new Error('Invalid live feed');
      return data;
    } catch (err) {
      lastErr = err;
      const isTransient = err?.message === 'Failed to fetch' || err?.name === 'TypeError';
      if (!isTransient || attempt >= retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

let eventTypesCache = null;
async function fetchEventTypes() {
  if (eventTypesCache) return eventTypesCache;
  const res = await fetch(EVENT_TYPES_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const eventTypes = await res.json();
  eventTypesCache = Object.fromEntries(
    (Array.isArray(eventTypes) ? eventTypes : [])
      .filter((eventType) => eventType?.code)
      .map((eventType) => [eventType.code, eventType]),
  );
  return eventTypesCache;
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
    strikeout_double_play: {
    label: 'Striekout Double Play',
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
   fielders_choice_out: {
    label: 'Fielders Choice Out',
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
  runner_placed: {
    label: 'Runner Placed On Base',
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  caught_stealing_2b: {
    label: 'Caught Stealing 2B',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  caught_stealing_3b: {
    label: 'Caught Stealing 3B',
    cls: 'bg-slate-600/40 text-slate-400 border-slate-600/40',
  },
  caught_stealing_home: {
        label: 'Caught Stealing Home',
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
  offensive_substitution: {
    label: 'Offensive Sub',
    cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  defensive_substitution: {
    label: 'Defensive Sub',
    cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  defensive_switch: {
    label: 'Defensive Switch',
    cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  pitching_substitution: {
    label: 'Pitching Change',
    cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
 
};

function withEventTypeLabel(badge, eventType, eventTypesByCode) {
  const apiLabel = eventTypesByCode?.[eventType]?.description;
  return {
    ...badge,
    label: apiLabel || badge?.label || eventType || '—',
  };
}

function inferFieldOutBadge(context, eventTypesByCode = null) {
  const play = context?.play ?? context;
  let trajectory = '';
  const events = play?.playEvents ?? [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.hitData?.trajectory) {
      trajectory = events[i].hitData.trajectory;
      break;
    }
  }
  const text = [
    play?.result?.event,
    play?.result?.description,
    context?.description,
    trajectory,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/ground|grounds|grounder|bunt_grounder/.test(text)) return withEventTypeLabel(PLAY_BADGE.groundout, 'groundout', eventTypesByCode);
  if (/fly|flies|flied|fly_ball/.test(text)) return withEventTypeLabel(PLAY_BADGE.flyout, 'flyout', eventTypesByCode);
  if (/line|lines|lined|line_drive/.test(text)) return withEventTypeLabel(PLAY_BADGE.lineout, 'lineout', eventTypesByCode);
  if (/pop|pops|popped|popup/.test(text)) return withEventTypeLabel(PLAY_BADGE.pop_out, 'pop_out', eventTypesByCode);
  return withEventTypeLabel(PLAY_BADGE.field_out, 'field_out', eventTypesByCode);
}

const buildPlayBadge = (et, context = null, eventTypesByCode = null) => {
  if (et === 'field_out') return inferFieldOutBadge(context, eventTypesByCode);
  const fallback = PLAY_BADGE[et] || {
    label: et || '—',
    cls: 'bg-slate-700/40 text-slate-400 border-slate-700/40',
  };
  return withEventTypeLabel(fallback, et, eventTypesByCode);
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

function GamedayOptionsMenu({
  usePurpleInPlayOuts,
  onUsePurpleInPlayOutsChange,
  onOpenPitchCounts,
  onOpenSituationBreakdown,
  showLiveOptions = true,
}) {
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 8 });

  const toggleMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen((value) => !value);
  };

  const choose = (value) => {
    onUsePurpleInPlayOutsChange?.(value);
    setOpen(false);
  };

  return (
    <div className="relative flex flex-shrink-0 border-b border-slate-700/60">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="flex w-11 items-center justify-center text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors focus:outline-none"
        aria-label="Gameday display options"
        aria-expanded={open}
        title="Gameday display options"
      >
        <i className="fa-solid fa-ellipsis-h text-sm" aria-hidden />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] cursor-default"
            aria-label="Close Gameday display options"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[91] w-56 rounded-2xl border border-slate-700 bg-slate-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {showLiveOptions ? (
              <>
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Live View
                </div>
                <button
                  type="button"
                  onClick={() => choose(false)}
                  className={[
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors',
                    !usePurpleInPlayOuts ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white',
                  ].join(' ')}
                >
                  <span>In-play outs blue</span>
                  {!usePurpleInPlayOuts && <i className={`fa-solid fa-check text-${THEME_COLOR}-300`} aria-hidden />}
                </button>
                <button
                  type="button"
                  onClick={() => choose(true)}
                  className={[
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors',
                    usePurpleInPlayOuts ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white',
                  ].join(' ')}
                >
                  <span>In-play outs purple</span>
                  {usePurpleInPlayOuts && <i className="fa-solid fa-check text-purple-300" aria-hidden />}
                </button>
                <div className="my-1 border-t border-slate-800" />
              </>
            ) : (
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Game Tools
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenPitchCounts?.();
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white"
            >
              <span>Pitch breakdown</span>
              <i className={`fa-solid fa-chart-simple text-${THEME_COLOR}-300`} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenSituationBreakdown?.();
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white"
            >
              <span>Situation breakdown</span>
              <i className={`fa-solid fa-diamond text-${THEME_COLOR}-300`} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function buildPitchCountByInning(allPlays = [], away, home) {
  const innings = new Set();
  const sides = {
    away: { team: away, pitchers: new Map() },
    home: { team: home, pitchers: new Map() },
  };

  allPlays.forEach((play) => {
    const inning = Number(play?.about?.inning);
    const pitcher = play?.matchup?.pitcher;
    if (!inning || !pitcher?.id) return;

    const pitchCount = (play.playEvents ?? []).filter((event) => event?.isPitch).length;
    if (!pitchCount) return;

    // Top half: away team bats, so the home pitcher is throwing. Bottom half is the reverse.
    const pitchingSide = play.about?.halfInning === 'top' ? 'home' : 'away';
    const side = sides[pitchingSide];
    innings.add(inning);

    if (!side.pitchers.has(pitcher.id)) {
      side.pitchers.set(pitcher.id, {
        id: pitcher.id,
        name: pitcher.fullName || pitcher.name || 'Pitcher',
        byInning: {},
        pitchEvents: [],
        total: 0,
      });
    }

    const row = side.pitchers.get(pitcher.id);
    row.byInning[inning] = (row.byInning[inning] ?? 0) + pitchCount;
    row.total += pitchCount;
    const basePitchNumber = row.pitchEvents.length;
    let countBeforePitch = { balls: 0, strikes: 0 };
    const enrichedPitchEvents = [];
    for (const event of play.playEvents ?? []) {
      if (!event?.isPitch) continue;
      enrichedPitchEvents.push({
        ...event,
        __pitchNumberOverride: basePitchNumber + enrichedPitchEvents.length + 1,
        __prePitchCount: { ...countBeforePitch },
        __playContext: play,
        __playScored: Boolean(
          play?.about?.isScoringPlay ||
          play?.about?.hasScoreChange ||
          play?.result?.isScoringPlay,
        ),
      });
      countBeforePitch = {
        balls: Number(event?.count?.balls ?? countBeforePitch.balls ?? 0),
        strikes: Number(event?.count?.strikes ?? countBeforePitch.strikes ?? 0),
      };
    }
    row.pitchEvents.push(...enrichedPitchEvents);
  });

  return {
    innings: [...innings].sort((a, b) => a - b),
    away: { team: away, pitchers: [...sides.away.pitchers.values()] },
    home: { team: home, pitchers: [...sides.home.pitchers.values()] },
  };
}

function PitchCountTeamTable({ data, onPitcherSelect }) {
  const accentClass = data.team?.abbreviation === 'SEA'
    ? 'bg-teal-400'
    : data.team?.abbreviation === 'SF'
      ? 'bg-orange-500'
      : `bg-${THEME_COLOR}-400`;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center gap-3 sm:mb-6 sm:gap-4">
        <div className="flex w-12 flex-shrink-0 flex-col items-center gap-1.5 sm:w-16 sm:gap-2">
          <img src={teamLogoUrl(data.team?.id)} alt="" className="h-9 w-9 object-contain sm:h-14 sm:w-14" />
          <div className={`h-0.5 w-8 rounded-full sm:h-1 sm:w-12 ${accentClass}`} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-black text-white sm:text-2xl">{data.team?.abbreviation || data.team?.name}</div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400 sm:text-sm sm:tracking-[0.32em]">Pitchers</div>
        </div>
      </div>

      <div className="space-y-0">
        {data.pitchers.length ? (
          data.pitchers.map((pitcher, pitcherIndex) => {
            const pitchedInnings = Object.keys(pitcher.byInning)
              .map(Number)
              .filter(Boolean)
              .sort((a, b) => a - b);
            const role = pitcherIndex === 0 ? 'Starter' : 'Relief';
            const gridTemplateColumns = `repeat(${pitchedInnings.length + 1}, minmax(clamp(2.15rem, 9vw, 4.2rem), 1fr))`;

            return (
              <button
                key={pitcher.id}
                type="button"
                onClick={() => onPitcherSelect?.(pitcher, data.team)}
                className={`block w-full border-b border-slate-700/60 px-1 py-3 text-left transition-colors hover:bg-slate-900/35 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-${THEME_COLOR}-400/70 sm:py-6`}
              >
                {(() => {
                return (
                  <>
                    <div className="mb-3 flex items-start justify-between gap-2 sm:mb-6 sm:gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black leading-tight text-white sm:text-2xl">{pitcher.name}</div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5 pt-0.5 text-[10px] sm:gap-3 sm:pt-1 sm:text-base">
                        <span className={`inline-flex items-center gap-1 text-${THEME_COLOR}-300 sm:gap-1.5`}>
                          <i className="fa-solid fa-location-dot" aria-hidden />
                          {role}
                        </span>
                        <span className="h-4 w-px bg-slate-600 sm:h-5" aria-hidden />
                        <span className="text-white">{pitcher.total}</span>
                        <span className="text-slate-400">pitches</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto pb-1">
                      <div className="min-w-0">
                        <div
                          className="grid text-center"
                          style={{ gridTemplateColumns }}
                        >
                          {pitchedInnings.map((inning) => (
                            <div key={`inning-${inning}`} className="px-1 pb-1 text-xs font-black text-slate-400 sm:px-3 sm:pb-2 sm:text-base">
                              {inning}
                            </div>
                          ))}
                          <div className="px-1 pb-1 text-xs font-black uppercase text-slate-400 sm:px-3 sm:pb-2 sm:text-base">Tot</div>
                        </div>
                        <div
                          className="grid overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/45 text-center font-mono shadow-inner shadow-black/20"
                          style={{ gridTemplateColumns }}
                        >
                          {pitchedInnings.map((inning) => (
                            <div key={`count-${inning}`} className="border-r border-slate-700/80 px-1.5 py-2 text-base font-black text-white last:border-r-0 sm:px-5 sm:py-3 sm:text-xl">
                              {pitcher.byInning[inning]}
                            </div>
                          ))}
                          <div className={`px-1.5 py-2 text-base font-black text-${THEME_COLOR}-300 sm:px-5 sm:py-3 sm:text-xl`}>
                            {pitcher.total}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-500">
            No pitch data yet.
          </div>
        )}
      </div>
    </section>
  );
}

function pitchMapKind(event) {
  const details = event?.details ?? {};
  if (details.isInPlay || details.code === 'X' || details.code === 'Y') return 'inPlay';
  if (details.isBall) return 'balls';
  return 'strikes';
}

function strikeSubtype(event) {
  const details = event?.details ?? {};
  const code = details.code;
  const text = String(details.description || details.call?.description || '').toLowerCase();
  if (code === 'C' || text.includes('called strike')) return 'called';
  if (code === 'F' || code === 'T' || code === 'L' || text.includes('foul')) return 'foul';
  if (code === 'S' || code === 'W' || code === 'M' || text.includes('swinging')) return 'swinging';
  return 'other';
}

function pitchKindCounts(playEvents = []) {
  return playEvents.reduce((totals, event) => {
    const kind = pitchMapKind(event);
    totals[kind] += 1;
    if (kind === 'strikes') totals.strikeSubtypes[strikeSubtype(event)] += 1;
    return totals;
  }, {
    balls: 0,
    strikes: 0,
    inPlay: 0,
    strikeSubtypes: { called: 0, swinging: 0, foul: 0, other: 0 },
  });
}

function PitcherPitchMapSheet({ pitcher, team, onClose, gamePk, onOpenPlay }) {
  const [visiblePitchKinds, setVisiblePitchKinds] = useState({
    balls: true,
    strikes: true,
    inPlay: true,
  });
  const [visibleStrikeSubtypes, setVisibleStrikeSubtypes] = useState({
    called: true,
    swinging: true,
    foul: true,
    other: true,
  });
  const [twoStrikeOnly, setTwoStrikeOnly] = useState(false);
  const [previewPitchNumber, setPreviewPitchNumber] = useState(null);
  const open = Boolean(pitcher);
  const pitchEvents = pitcher?.pitchEvents ?? [];
  const counts = pitchKindCounts(pitchEvents);
  const visiblePitchEvents = pitchEvents.filter((event) => {
    const kind = pitchMapKind(event);
    if (!visiblePitchKinds[kind]) return false;
    if (kind === 'strikes' && !visibleStrikeSubtypes[strikeSubtype(event)]) return false;
    if (twoStrikeOnly && Number(event.__prePitchCount?.strikes ?? -1) !== 2) return false;
    return true;
  });
  const previewPitchEvent = previewPitchNumber == null
    ? null
    : pitchEvents.find((event) => Number(event.__pitchNumberOverride) === Number(previewPitchNumber));
  const canvasPitchEvents = previewPitchEvent && !visiblePitchEvents.includes(previewPitchEvent)
    ? [...visiblePitchEvents, previewPitchEvent]
    : visiblePitchEvents;
  const twoStrikeCount = pitchEvents.filter((event) => Number(event.__prePitchCount?.strikes ?? -1) === 2).length;
  const latestPitchData = [...pitchEvents].reverse().find((event) => event?.pitchData)?.pitchData;
  const szTop = latestPitchData?.strikeZoneTop ?? 3.55;
  const szBot = latestPitchData?.strikeZoneBottom ?? 1.47;
  const togglePitchKind = (kind) => {
    setVisiblePitchKinds((current) => ({
      ...current,
      [kind]: !current[kind],
    }));
  };
  const toggleStrikeSubtype = (subtype) => {
    setVisibleStrikeSubtypes((current) => ({
      ...current,
      [subtype]: !current[subtype],
    }));
  };
  const goToPitch = (value) => {
    const pitchNumber = Number(value);
    const event = pitchEvents.find((pitchEvent) => Number(pitchEvent.__pitchNumberOverride) === pitchNumber);
    if (event?.__playContext) {
      onOpenPlay?.(event.__playContext, {
        highlightedPitchKey: event.playId ?? event.index,
      });
    }
  };
  useEffect(() => {
    setPreviewPitchNumber(null);
  }, [pitcher?.id]);
  const filterCards = [
    {
      key: 'balls',
      label: 'Balls',
      count: counts.balls,
      border: 'border-emerald-500/20',
      activeBg: 'bg-emerald-500/10',
      text: 'text-emerald-300',
      subText: 'text-emerald-200/70',
    },
    {
      key: 'strikes',
      label: 'Strikes',
      count: counts.strikes,
      border: 'border-red-500/20',
      activeBg: 'bg-red-500/10',
      text: 'text-red-300',
      subText: 'text-red-200/70',
    },
    {
      key: 'inPlay',
      label: 'In Play',
      count: counts.inPlay,
      border: 'border-blue-500/20',
      activeBg: 'bg-blue-500/10',
      text: 'text-blue-300',
      subText: 'text-blue-200/70',
    },
  ];
  const strikeSubtypeFilters = [
    {
      key: 'called',
      label: 'Called',
      count: counts.strikeSubtypes.called,
      icon: 'fa-eye',
    },
    {
      key: 'swinging',
      label: 'Miss',
      count: counts.strikeSubtypes.swinging,
      icon: 'fa-wind',
    },
    {
      key: 'foul',
      label: 'Foul',
      count: counts.strikeSubtypes.foul,
      icon: 'fa-arrows-turn-to-dots',
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      backDismiss
      historyKey="pitcherPitchMap"
      align="center"
      size="full"
      className="px-0 sm:px-3"
      panelClassName="h-[94vh] bg-[#101827] border-slate-700/70 sm:mx-auto sm:max-w-[min(98vw,1280px)] flex flex-col"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-slate-600" />
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={teamLogoUrl(team?.id)} alt="" className="h-9 w-9 flex-shrink-0 object-contain" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{pitcher?.name}</div>
            <div className="text-xs text-slate-500">
              {team?.abbreviation || team?.name} · {pitchEvents.length} pitches
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          aria-label="Close pitcher pitch map"
        >
          <i className="fa-solid fa-xmark" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {filterCards.map((card) => {
            const active = visiblePitchKinds[card.key];
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => togglePitchKind(card.key)}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition-all focus:outline-none focus:ring-1',
                  card.border,
                  active ? `${card.activeBg} ${card.subText} focus:ring-white/30` : 'bg-slate-950/70 text-slate-600 opacity-70 grayscale focus:ring-slate-500',
                ].join(' ')}
                aria-pressed={active}
              >
                <span className={`font-mono text-sm ${active ? card.text : 'text-slate-500'}`}>{card.count}</span>
                <span>{card.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[10px] text-slate-400">
          <button
            type="button"
            onClick={() => setTwoStrikeOnly((value) => !value)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-colors',
              twoStrikeOnly
                ? `border-${THEME_COLOR}-400/50 bg-${THEME_COLOR}-500/15 text-${THEME_COLOR}-200`
                : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-200',
            ].join(' ')}
            aria-pressed={twoStrikeOnly}
          >
            <span className="font-mono text-xs">{twoStrikeCount}</span>
            2 Strikes
          </button>
          {visiblePitchKinds.strikes && (
            <>
              <span className="hidden h-4 w-px bg-slate-700 sm:inline-block" aria-hidden />
              {strikeSubtypeFilters.map((filter) => {
                const active = visibleStrikeSubtypes[filter.key];
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => toggleStrikeSubtype(filter.key)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-colors',
                      active
                        ? 'border-red-500/35 bg-red-500/10 text-red-200'
                        : 'border-slate-700 bg-slate-900 text-slate-600 opacity-70 grayscale hover:text-slate-300',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    <i className={`fa-solid ${filter.icon}`} aria-hidden />
                    <span className="font-mono text-xs">{filter.count}</span>
                    {filter.label}
                  </button>
                );
              })}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setVisiblePitchKinds({ balls: true, strikes: true, inPlay: true });
              setVisibleStrikeSubtypes({ called: true, swinging: true, foul: true, other: true });
              setTwoStrikeOnly(false);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-slate-200"
          >
            Reset
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-2 sm:p-3">
          <div className="relative max-h-full w-full max-w-[min(100%,calc((94vh-12rem)*1.633))]">
            <PitchCanvas
              playEvents={canvasPitchEvents}
              cropPlayEvents={pitchEvents}
              szTop={szTop}
              szBot={szBot}
              gamePk={gamePk ? `${gamePk}:${pitcher?.id}:pitch-map` : null}
              viewMode="strikeZone"
              width={980}
              height={600}
              responsive
              showPitchTrails={false}
              usePurpleInPlayOuts
              preserveCropAspect
              showCalledStrikeMarker={canvasPitchEvents.length > 0 && visiblePitchKinds.strikes && visibleStrikeSubtypes.called}
              focusPitchNumber={previewPitchNumber}
              className="mx-auto w-full"
            />
          </div>
          {!canvasPitchEvents.length && (
            <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-2xl border border-dashed border-slate-600/80 bg-slate-950/75 px-4 text-center shadow-inner shadow-black/60 backdrop-blur-sm">
              <div className="max-w-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-500/70 bg-slate-800/80 text-slate-200">
                  <i className="fa-solid fa-filter-circle-xmark text-lg" aria-hidden />
                </div>
                <div className="text-base font-black text-slate-100">
                  No visible pitch locations
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Try turning a pitch type back on or clearing the filters.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Ball</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-700" /> Strike</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> In Play</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Go to
            <Menu as="div" className="relative">
              <MenuButton className="inline-flex min-w-[8rem] items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs font-bold normal-case tracking-normal text-slate-200 outline-none transition-colors hover:border-slate-500">
                Pitch #
                <i className="fa-solid fa-chevron-up text-[9px] text-slate-500" aria-hidden />
              </MenuButton>
              <MenuItems
                anchor="top end"
                transition
                onMouseLeave={() => setPreviewPitchNumber(null)}
                className="z-50 mb-1 max-h-36 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-black/50 focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
              >
                {!visiblePitchEvents.length && (
                  <div className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
                    No visible pitches
                  </div>
                )}
                {visiblePitchEvents.map((event) => {
                  const pitchNumber = Number(event.__pitchNumberOverride);
                  const play = event.__playContext;
                  const batterName = play?.matchup?.batter?.fullName || 'At bat';
                  const result = play?.result?.event || event.details?.description || 'Pitch';
                  const kind = pitchMapKind(event);
                  const tone =
                    kind === 'balls'
                      ? 'text-emerald-300'
                      : kind === 'inPlay'
                        ? 'text-blue-300'
                        : 'text-red-300';
                  return (
                    <MenuItem key={`${event.playId ?? event.index}-${pitchNumber}`}>
                      {({ focus, close }) => (
                        <button
                          type="button"
                          onMouseEnter={() => setPreviewPitchNumber(pitchNumber)}
                          onFocus={() => setPreviewPitchNumber(pitchNumber)}
                          onClick={() => {
                            close?.();
                            setPreviewPitchNumber(null);
                            goToPitch(pitchNumber);
                          }}
                          className={[
                            'flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors',
                            focus ? 'bg-slate-800 text-white' : 'text-slate-300',
                          ].join(' ')}
                        >
                          <span className={`w-9 flex-shrink-0 font-mono text-sm font-black ${tone}`}>
                            #{pitchNumber}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{batterName}</span>
                            <span className="block truncate text-[10px] text-slate-500">{result}</span>
                          </span>
                        </button>
                      )}
                    </MenuItem>
                  );
                })}
              </MenuItems>
            </Menu>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PitchCountByInningSheet({
  open,
  onClose,
  allPlays,
  away,
  home,
  gamePk,
  onOpenPlay,
  restorePitcherId = null,
  restoreNonce = null,
}) {
  const [selectedPitcher, setSelectedPitcher] = useState(null);
  const data = useMemo(() => buildPitchCountByInning(allPlays, away, home), [allPlays, away, home]);
  const closePitcherMap = () => setSelectedPitcher(null);
  const openPlayFromPitchMap = (play, options = {}) => {
    onOpenPlay?.(play, options);
  };

  useEffect(() => {
    if (!open || !restorePitcherId) return;
    const restored =
      data.away.pitchers.find((pitcher) => Number(pitcher.id) === Number(restorePitcherId))
        ? { pitcher: data.away.pitchers.find((pitcher) => Number(pitcher.id) === Number(restorePitcherId)), team: data.away.team }
        : data.home.pitchers.find((pitcher) => Number(pitcher.id) === Number(restorePitcherId))
          ? { pitcher: data.home.pitchers.find((pitcher) => Number(pitcher.id) === Number(restorePitcherId)), team: data.home.team }
          : null;
    if (restored?.pitcher) setSelectedPitcher(restored);
  }, [open, restorePitcherId, restoreNonce, data]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      backDismiss
      historyKey="pitchCountByInning"
      align="bottom"
      size="lg"
      panelClassName="max-h-[88vh] bg-[radial-gradient(circle_at_top_left,rgba(30,64,175,0.18),transparent_38%),linear-gradient(135deg,#101827,#07101d)] border-slate-700/70"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-slate-600" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-5">
        <div>
          <div className="text-xl font-black text-white sm:text-2xl">Pitch Count By Inning</div>
          <div className="mt-0.5 text-xs text-slate-400 sm:mt-1 sm:text-base">Live pitch totals grouped by pitcher</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white sm:h-12 sm:w-12"
          aria-label="Close pitch count by inning"
        >
          <i className="fa-solid fa-xmark text-lg sm:text-xl" aria-hidden />
        </button>
      </div>
      <div className="gameday-scroll-rail max-h-[calc(88vh-5.75rem)] overflow-y-auto px-4 pb-4 sm:max-h-[calc(88vh-7rem)] sm:px-6 sm:pb-6">
        <div className="space-y-5 sm:space-y-10">
          <PitchCountTeamTable
            data={data.away}
            onPitcherSelect={(pitcher, team) => setSelectedPitcher({ pitcher, team })}
          />
          <PitchCountTeamTable
            data={data.home}
            onPitcherSelect={(pitcher, team) => setSelectedPitcher({ pitcher, team })}
          />
        </div>
      </div>
      <PitcherPitchMapSheet
        pitcher={selectedPitcher?.pitcher}
        team={selectedPitcher?.team}
        onClose={closePitcherMap}
        gamePk={gamePk}
        onOpenPlay={openPlayFromPitchMap}
      />
    </Modal>
  );
}

const BASE_FILTERS = [
  { key: 'onFirst', label: '1B', shortLabel: '1st', position: 'right-[7%] top-[48%]' },
  { key: 'onSecond', label: '2B', shortLabel: '2nd', position: 'left-1/2 top-[4%] -translate-x-1/2' },
  { key: 'onThird', label: '3B', shortLabel: '3rd', position: 'left-[7%] top-[48%]' },
];

function selectedBaseCount(bases) {
  return BASE_FILTERS.reduce((sum, base) => sum + (bases[base.key] ? 1 : 0), 0);
}

function baseStateMatches(actual, selected, mode) {
  const selectedCount = selectedBaseCount(selected);
  const actualCount = selectedBaseCount(actual);

  if (mode === 'contains') {
    if (!selectedCount) return actualCount === 0;
    return BASE_FILTERS.some((base) => selected[base.key] && actual[base.key]);
  }

  return BASE_FILTERS.every((base) => Boolean(actual[base.key]) === Boolean(selected[base.key]));
}

function baseSituationMatches(actual, selected, matchMode, baseMode) {
  return baseStateMatches(actual, selected, matchMode);
}

function formatBaseStateLabel(bases, mode = 'custom') {
  const selected = BASE_FILTERS.filter((base) => bases[base.key]);
  if (!selected.length) return 'Bases empty';
  if (selected.length === 3) return 'Bases loaded';
  return selected.map((base) => base.shortLabel).join(' + ');
}

function getBattingSide(play) {
  return play?.about?.halfInning === 'top' ? 'away' : 'home';
}

function getRunsOnPlay(play) {
  if (Number.isFinite(Number(play?.result?.rbi))) return Number(play.result.rbi);
  return (play?.runners ?? []).filter((runner) => runner?.movement?.end === 'score').length;
}

function isHitEvent(eventType = '') {
  return ['single', 'double', 'triple', 'home_run'].includes(eventType);
}

function isWalkOrHbp(eventType = '') {
  return ['walk', 'intent_walk', 'hit_by_pitch'].includes(eventType);
}

function isOfficialAtBat(play) {
  const eventType = play?.result?.eventType ?? '';
  if (!eventType) return false;
  if (isWalkOrHbp(eventType)) return false;
  if (['sac_fly', 'sac_bunt', 'catcher_interf', 'field_error'].includes(eventType)) return false;
  return Boolean(play?.matchup?.batter?.id && play?.result?.event);
}

function buildSituationRows(allPlays = [], away, home) {
  return allPlays
    .filter((play) => play?.matchup?.batter?.id && play?.result?.event)
    .map((play) => {
      const side = getBattingSide(play);
      const battingTeam = side === 'away' ? away : home;
      const fieldingTeam = side === 'away' ? home : away;
      const situation = getPlayDetailSituation(play, allPlays);
      const eventType = play.result?.eventType ?? '';
      const pitches = (play.playEvents ?? []).filter((event) => event?.isPitch).length;

      return {
        play,
        side,
        battingTeam,
        fieldingTeam,
        situation,
        eventType,
        pitches,
        runs: getRunsOnPlay(play),
        isHit: isHitEvent(eventType),
        isWalkOrHbp: isWalkOrHbp(eventType),
        isStrikeout: eventType === 'strikeout' || eventType === 'strikeout_double_play',
        isAtBat: isOfficialAtBat(play),
      };
    });
}

function BaseModeButton({ value, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(value)}
      className={[
        'rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-colors',
        active
          ? `border-${THEME_COLOR}-300 bg-${THEME_COLOR}-400 text-slate-950`
          : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-200',
      ].join(' ')}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function SituationBaseSelector({ value, mode, matchMode, onChange, onModeChange, onMatchModeChange }) {
  const isRispPreset = mode === 'custom' &&
    matchMode === 'contains' &&
    !value.onFirst &&
    value.onSecond &&
    value.onThird;

  const toggleBase = (baseKey) => {
    const next = {
      ...value,
      [baseKey]: !value[baseKey],
    };
    onChange?.(next);
    onModeChange?.('custom');
  };

  const chooseMode = (nextMode) => {
    if (nextMode === 'risp') {
      onChange?.({ onFirst: false, onSecond: true, onThird: true });
      onMatchModeChange?.('contains');
      onModeChange?.('custom');
      return;
    }
    if (isRispPreset) onMatchModeChange?.('exact');
    onModeChange?.(nextMode);
  };

  return (
    <div className="rounded-3xl border border-slate-700/70 bg-slate-950/55 p-4 md:p-3 xl:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Base State</div>
          <div className="mt-0.5 text-lg font-black text-white">{formatBaseStateLabel(value, mode)}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
          <BaseModeButton value="custom" active={!isRispPreset} onClick={chooseMode}>Custom</BaseModeButton>
          <BaseModeButton value="risp" active={isRispPreset} onClick={chooseMode}>RISP</BaseModeButton>
      </div>

      <div className="relative mx-auto h-44 w-full max-w-[18rem] md:h-48 xl:h-52 xl:max-w-[20rem]">
        <div className="absolute left-1/2 top-[22%] h-24 w-24 -translate-x-1/2 rotate-45 rounded-[1.75rem] border border-slate-800 bg-slate-900/45" />
        {BASE_FILTERS.map((base) => {
          const active = value[base.key];
          return (
            <button
              key={base.key}
              type="button"
              onClick={() => toggleBase(base.key)}
              className={[
                'absolute grid h-20 w-20 place-items-center rounded-2xl border rotate-45 transition-all focus:outline-none focus:ring-2 focus:ring-white/25 xl:h-24 xl:w-24 xl:rounded-[1.7rem]',
                base.position,
                active
                  ? `border-${THEME_COLOR}-300 bg-${THEME_COLOR}-400 text-slate-950 shadow-lg shadow-${THEME_COLOR}-950/30`
                  : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400 hover:bg-slate-800',
              ].join(' ')}
              aria-pressed={active}
              aria-label={`Toggle runner on ${base.shortLabel}`}
            >
              <span className="-rotate-45 text-lg font-black xl:text-xl">{base.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SituationStatCard({ label, value, subLabel = null }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2.5">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-display text-2xl leading-none text-white tabular-nums">{value}</div>
      {subLabel && <div className="mt-1 text-[10px] font-semibold text-slate-500">{subLabel}</div>}
    </div>
  );
}

function SituationMatchModeControl({ value, onChange }) {
  return (
    <div className="flex rounded-2xl border border-slate-800 bg-slate-950/55 p-1">
      {[
        { value: 'exact', label: 'Exact' },
        { value: 'contains', label: 'Contains' },
      ].map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            className={[
              'flex-1 rounded-xl px-3 py-3 text-sm font-black transition-all',
              active
                ? `bg-${THEME_COLOR}-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),0_10px_24px_rgba(15,23,42,0.35)]`
                : 'text-slate-500 hover:bg-slate-900/80 hover:text-slate-200',
            ].join(' ')}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function OutsFilterButton({ value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(value)}
      className={[
        'grid h-12 w-12 place-items-center rounded-[9999px] border text-xl font-black leading-none transition-all aspect-square sm:h-14 sm:w-14 sm:text-2xl',
        active
          ? 'border-red-300 bg-red-500 text-white shadow-lg shadow-red-950/35'
          : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-white',
      ].join(' ')}
      aria-pressed={active}
      aria-label={`${value} outs`}
    >
      {value}
    </button>
  );
}

function SituationOutsFilter({ value, onChange }) {
  const choose = (nextValue) => {
    onChange?.({
      ...value,
      [nextValue]: !value[nextValue],
    });
  };

  return (
    <div className="flex items-center justify-center gap-3">
      {['0', '1', '2'].map((option) => (
        <OutsFilterButton
          key={option}
          value={option}
          active={Boolean(value[option])}
          onClick={choose}
        />
      ))}
    </div>
  );
}

function OutsLabelDots({ value = {} }) {
  const selected = selectedOutValues(value);
  const dotCount = hasActiveOutsFilter(value)
    ? Math.max(...selected.map((out) => Number(out)))
    : null;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span>Outs</span>
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((idx) => (
          <span
            key={idx}
            className={[
              'h-2 w-2 rounded-[9999px] border aspect-square',
              dotCount != null && idx < dotCount
                ? 'border-red-300 bg-red-500'
                : 'border-slate-500 bg-slate-800',
            ].join(' ')}
          />
        ))}
      </span>
    </div>
  );
}

function selectedOutValues(outsFilter) {
  return ['0', '1', '2'].filter((out) => outsFilter[out]);
}

function hasActiveOutsFilter(outsFilter) {
  const selected = selectedOutValues(outsFilter);
  return selected.length > 0 && selected.length < 3;
}

function formatOutsFilterLabel(outsFilter) {
  const selected = selectedOutValues(outsFilter);
  if (!hasActiveOutsFilter(outsFilter)) return 'Any outs';
  if (selected.length === 2 && selected.includes('0') && selected.includes('1')) return '< 2 outs';
  return `${selected.join(' or ')} out${selected.length === 1 && selected[0] === '1' ? '' : 's'}`;
}

function SituationBreakdownSheet({
  open,
  onClose,
  allPlays,
  away,
  home,
  onOpenPlay,
  getPlayBadge,
  restoreScrollTop = null,
  restoreNonce = null,
}) {
  const [teamSide, setTeamSide] = useState('away');
  const [baseMode, setBaseMode] = useState('custom');
  const [baseFilter, setBaseFilter] = useState({ onFirst: false, onSecond: false, onThird: false });
  const [matchMode, setMatchMode] = useState('exact');
  const [outsFilter, setOutsFilter] = useState({ 0: false, 1: false, 2: false });
  const scrollRef = useRef(null);
  const rows = useMemo(() => buildSituationRows(allPlays, away, home), [allPlays, away, home]);
  const filteredRows = useMemo(() => (
    rows.filter((row) => {
      if (teamSide !== 'both' && row.side !== teamSide) return false;
      if (!baseSituationMatches(row.situation.bases, baseFilter, matchMode, baseMode)) return false;
      const selectedOuts = selectedOutValues(outsFilter);
      if (hasActiveOutsFilter(outsFilter) && !selectedOuts.includes(String(row.situation.outs))) return false;
      return true;
    })
  ), [rows, teamSide, baseFilter, matchMode, baseMode, outsFilter]);

  const totals = useMemo(() => {
    const pa = filteredRows.length;
    const atBats = filteredRows.filter((row) => row.isAtBat).length;
    const hits = filteredRows.filter((row) => row.isHit).length;
    const walksHbp = filteredRows.filter((row) => row.isWalkOrHbp).length;
    const strikeouts = filteredRows.filter((row) => row.isStrikeout).length;
    const runs = filteredRows.reduce((sum, row) => sum + row.runs, 0);
    const avg = atBats ? (hits / atBats).toFixed(3).replace(/^0/, '') : '-';

    return { pa, atBats, hits, walksHbp, strikeouts, runs, avg };
  }, [filteredRows]);

  const selectedTeam = teamSide === 'away' ? away : teamSide === 'home' ? home : null;
  const selectedTeamLabel = selectedTeam?.teamName || selectedTeam?.name || 'Both Teams';
  const outsFilterLabel = formatOutsFilterLabel(outsFilter);
  const isRispPreset = baseMode === 'custom' &&
    matchMode === 'contains' &&
    !baseFilter.onFirst &&
    baseFilter.onSecond &&
    baseFilter.onThird;
  const baseFilterLabel = isRispPreset
    ? 'RISP'
    : baseMode === 'custom'
      ? `${matchMode === 'contains' && selectedBaseCount(baseFilter) > 0 ? 'Containing' : 'Exact'} ${formatBaseStateLabel(baseFilter, baseMode)}`
      : formatBaseStateLabel(baseFilter, baseMode);

  useEffect(() => {
    if (!open || restoreScrollTop == null) return;
    window.setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = restoreScrollTop;
    }, 140);
  }, [open, restoreScrollTop, restoreNonce]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      backDismiss
      historyKey="situationBreakdown"
      align="bottom"
      size="xl"
      className="px-2 py-2 sm:px-4 sm:py-4"
      panelClassName="max-h-[90vh] md:h-[88vh] md:max-h-[88vh] bg-[#101827] border-slate-700/70 p-0 flex flex-col"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 z-20 bg-[#101827]">
        <div className="h-1 w-10 rounded-full bg-slate-600" />
      </div>

      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-[#101827]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="min-w-0">
          <div className="text-xl font-black text-white">Situation Breakdown</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Plate appearances by batting team and base state before the result.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-slate-900 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Close situation breakdown"
        >
          <i className="fa-solid fa-xmark" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 p-4 sm:p-5">
        <div className="grid h-full min-h-0 gap-4 md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-3xl border border-slate-700/70 bg-slate-950/45 p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Batting Team</div>
              <SegmentedControl
                value={teamSide}
                onChange={setTeamSide}
                options={[
                  { value: 'away', label: away.abbreviation || 'Away' },
                  { value: 'home', label: home.abbreviation || 'Home' },
                  { value: 'both', label: 'Both' },
                ]}
                variant="compact"
                size="sm"
                className="w-full"
                optionClassName="flex-1"
              />
            </div>

            <SituationBaseSelector
                value={baseFilter}
                mode={baseMode}
                matchMode={matchMode}
                onChange={setBaseFilter}
                onModeChange={setBaseMode}
                onMatchModeChange={setMatchMode}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Match</div>
                <SituationMatchModeControl value={matchMode} onChange={setMatchMode} />
              </div>
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <OutsLabelDots value={outsFilter} />
                </div>
                <SituationOutsFilter value={outsFilter} onChange={setOutsFilter} />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <div className="flex items-center gap-3 rounded-3xl border border-slate-700/70 bg-slate-950/45 p-3">
              {selectedTeam ? (
                <img src={teamLogoUrl(selectedTeam.id)} alt="" className="h-12 w-12 object-contain" />
              ) : (
                <div className="relative h-12 w-16 flex-shrink-0">
                  <img src={teamLogoUrl(away?.id)} alt="" className="absolute left-0 top-1 h-10 w-10 object-contain" />
                  <img src={teamLogoUrl(home?.id)} alt="" className="absolute right-0 top-1 h-10 w-10 object-contain" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-lg font-black text-white">{selectedTeamLabel}</div>
                <div className="text-xs font-semibold text-slate-500">
                  {baseFilterLabel}
                  {`, ${outsFilterLabel}`}
                </div>
              </div>
              <BaseDiamondIndicator {...baseFilter} size="lg" className="ml-auto text-white" />
            </div>
            <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
              <SituationStatCard label="PA" value={totals.pa} />
              <SituationStatCard label="Runs" value={totals.runs} />
              <SituationStatCard label="Hits" value={totals.hits} />
              <SituationStatCard label="BB/HBP" value={totals.walksHbp} />
              <SituationStatCard label="K" value={totals.strikeouts} />
              <SituationStatCard label="AVG" value={totals.avg} subLabel={`${totals.atBats} AB`} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-950/45">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Results</div>
                <div className="text-xs font-semibold text-slate-500">{filteredRows.length} PA</div>
              </div>

              {filteredRows.length ? (
                <div ref={scrollRef} className="gameday-scroll-rail min-h-[18rem] flex-1 divide-y divide-slate-800/80 overflow-y-auto md:min-h-0">
                  {filteredRows.map((row) => {
                    const play = row.play;
                    const badge = getPlayBadge?.(play.result?.eventType, play);
                    const inning = `${play.about?.halfInning === 'top' ? 'TOP' : 'BOT'} ${play.about?.inning ?? ''}`;
                    const score = `${away.abbreviation} ${play.result?.awayScore ?? 0} - ${home.abbreviation} ${play.result?.homeScore ?? 0}`;
                    return (
                      <button
                        key={play.about?.atBatIndex ?? `${play.about?.startTime}-${play.result?.event}`}
                        type="button"
                        onClick={() => {
                          onOpenPlay?.(play, { scrollTop: scrollRef.current?.scrollTop ?? 0 });
                        }}
                        className="block w-full px-3 py-3 text-left transition-colors hover:bg-slate-900/70"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex w-16 flex-shrink-0 flex-col items-center gap-1">
                            <span className="font-mono text-xs font-black text-slate-300">{inning}</span>
                            <BaseDiamondIndicator {...row.situation.bases} size="sm" />
                            <OutsIndicator outs={row.situation.outs} size="sm" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {badge && (
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                              <span className="font-mono text-[11px] font-semibold text-slate-500">{score}</span>
                              <span className="font-mono text-[11px] font-semibold text-slate-500">{row.pitches} pitches</span>
                            </div>
                            <div className="mt-1 truncate text-sm font-black text-white">
                              {play.matchup?.batter?.fullName || 'Batter'} vs {play.matchup?.pitcher?.fullName || 'Pitcher'}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs leading-snug text-slate-400">
                              {play.result?.description || play.result?.event}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-500">
                    <i className="fa-solid fa-diamond" aria-hidden />
                  </div>
                  <div className="text-sm font-black text-slate-200">No plate appearances found</div>
                  <div className="mt-1 text-xs text-slate-500">Try switching teams, changing outs, selecting a different base state, or using Contains mode.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

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
      {/* <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-700/30">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
          Statcast
        </div>
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wide">
          Batted Ball
        </span>
      </div> */}

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
        
          </div>
        ))}
      </div>

   
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
  label: 'Game Advisory',
  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

function LinescoreInningCell({ val }) {
  if (val > 0) {
    return <span className="text-green-400 font-bold">{val}</span>;
  }
  if (val === 0) return <span>0</span>;
  return <span className="text-slate-600">-</span>;
}

function LinescoreBoard({ ls, away, home, awayRuns, homeRuns, compact = false }) {
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

  const cellBase = `text-center tabular-nums font-mono ${compact ? 'text-[13px]' : 'text-sm'}`;
  const headerCell = `${compact ? 'h-7' : 'h-8'} flex items-center justify-center ${cellBase}`;
  const bodyCell = `${compact ? 'h-8' : 'h-9'} flex items-center justify-center border-t border-slate-700/40 ${cellBase}`;
  const headerRow = `${compact ? 'h-7' : 'h-8'} flex items-center shrink-0`;
  const bodyRow = `${compact ? 'h-8' : 'h-9'} flex items-center shrink-0 border-t border-slate-700/40`;
  const teamColWidth = compact ? 'w-11' : 'w-14';
  const rheCellWidth = compact ? 'w-6' : 'w-8';
  const outerPadding = compact ? 'px-1.5 py-2' : 'px-2 sm:px-6 py-3';

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
      <div className={`flex ${outerPadding}`}>
        <div className={`flex-shrink-0 ${teamColWidth}`}>
          <div className={headerRow} />
          {sides.map(({ side, team }) => (
            <div key={side} className={`${bodyRow} font-bold text-slate-200 ${compact ? 'text-[12px]' : ''}`}>
              {team.abbreviation}
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="overflow-x-auto flex-1 min-w-0">
          <div
            className={`grid min-w-full ${hasExtras ? compact ? 'pr-1' : 'sm:pr-6' : ''}`}
            style={inningGridStyle}
          >
            {inningNums.map((i) => (
              <div key={`hdr-${i}`} className={`${headerCell} text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {i}
              </div>
            ))}
            {sides.map(({ side }) =>
              inningNums.map((i) => {
                const val = inningByNum[i]?.[side]?.runs;
                return (
                  <div key={`${side}-${i}`} className={`${bodyCell} ${compact ? 'text-slate-100 font-bold' : 'text-slate-300'}`}>
                    <LinescoreInningCell val={val} />
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className="flex-shrink-0 border-l border-slate-600">
          <div className={`${headerRow} flex text-slate-500`}>
            <div className={`${rheCellWidth} ${compact ? 'px-1' : 'px-3'} text-center font-bold ${compact ? 'text-[10px]' : ''}`}>R</div>
            <div className={`${rheCellWidth} ${compact ? 'px-1' : 'px-2'} text-center font-normal ${compact ? 'text-[10px]' : ''}`}>H</div>
            <div className={`${rheCellWidth} ${compact ? 'px-1' : 'px-2'} text-center font-normal ${compact ? 'text-[10px]' : ''}`}>E</div>
          </div>
          {sides.map(({ side, runs }) => (
            <div key={side} className={`${bodyRow} flex`}>
              <div className={`${rheCellWidth} ${compact ? 'px-1' : 'px-3'} text-center font-bold ${compact ? 'text-[15px] text-white' : ''}`}>
                {runs}
              </div>
              <div className={`${rheCellWidth} ${compact ? 'px-1' : 'px-2'} text-center ${compact ? 'text-[12px] text-slate-300 font-semibold' : 'text-slate-400'}`}>
                {ls?.teams?.[side]?.hits ?? 0}
              </div>
              <div className={`${rheCellWidth} ${compact ? 'px-1' : 'px-2'} text-center ${compact ? 'text-[12px] text-slate-400 font-semibold' : 'text-slate-500'}`}>
                {ls?.teams?.[side]?.errors ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalHeaderDecisionLine({ label, player, stats, onPlayerSelect }) {
  if (!player) return null;
  const name = compactPlayerName(player, player.fullName);
  const statLine = label === 'S'
    ? stats?.saves != null
      ? `${stats.saves}${fmtEra(stats.era) ? ` | ${fmtEra(stats.era)} ERA` : ''}`
      : fmtEra(stats?.era)
        ? `${fmtEra(stats.era)} ERA`
        : ''
    : stats
      ? `${stats.wins ?? 0}-${stats.losses ?? 0}${fmtEra(stats.era) ? ` | ${fmtEra(stats.era)} ERA` : ''}`
      : '';

  return (
    <div className="text-[11px] 2xl:text-xs text-slate-300">
      <span className="font-extrabold text-white">{label}: </span>
      <button
        type="button"
        onClick={() => onPlayerSelect(player.id)}
        className={`font-bold hover:text-${THEME_COLOR}-400 transition-colors`}
      >
        {name}
      </button>
      {statLine && <span className="ml-1 text-slate-400">{statLine}</span>}
    </div>
  );
}

function FinalHeaderTeamBlock({ team, align = 'left', onTeamSelect }) {
  return (
    <button
      type="button"
      onClick={() => onTeamSelect(team.id)}
      className={`flex items-center gap-3 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : 'text-left'}`}
    >
      <img src={teamLogoUrl(team.id)} alt={team.abbreviation} className="h-12 w-12 2xl:h-14 2xl:w-14 object-contain" />
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-white">
          {team.teamName || team.abbreviation}
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          {team.record ? `${team.record.wins} - ${team.record.losses}` : ''}
        </div>
      </div>
    </button>
  );
}

function FinalGameHeader({
  away,
  home,
  awayRuns,
  homeRuns,
  ls,
  decisions,
  gamePk,
  getPitcherStats,
  leagueLabel,
  logoSrc,
  onTeamSelect,
  onPlayerSelect,
  onOpenPitchBreakdown,
  onOpenSituationBreakdown,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-[#121827]">
      {/*
        2×2 grid keeps:
        - score row + Watch the same height
        - linescore + W/L/S the same height
        - score/linescore only as wide as the left column
      */}
      <div className="grid grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_22rem] grid-rows-[auto_auto]">
        <div className="min-w-0 grid grid-cols-[minmax(0,1fr)_4rem_5rem_4rem_minmax(0,1fr)] items-center gap-4 px-5 py-4">
          <FinalHeaderTeamBlock team={away} onTeamSelect={onTeamSelect} />
          <div className={`justify-self-center font-display text-5xl leading-none tabular-nums ${awayRuns > homeRuns ? 'text-white' : 'text-slate-300'}`}>
            {awayRuns}
          </div>
          <div className="justify-self-center text-center text-base font-extrabold tracking-wide text-white">
            FINAL
          </div>
          <div className={`justify-self-center font-display text-5xl leading-none tabular-nums ${homeRuns > awayRuns ? 'text-white' : 'text-slate-300'}`}>
            {homeRuns}
          </div>
          <FinalHeaderTeamBlock team={home} align="right" onTeamSelect={onTeamSelect} />
        </div>

        <div className="min-h-0 border-l border-slate-700/60">
          <WatchInlineLink gamePk={gamePk} logoSrc={logoSrc} leagueLabel={leagueLabel} />
        </div>

        <div className="min-w-0">
          <LinescoreBoard
            key="final-header-line"
            ls={ls}
            away={away}
            home={home}
            awayRuns={awayRuns}
            homeRuns={homeRuns}
          />
        </div>

        <div className="flex min-h-0 flex-col justify-center gap-2.5 border-l border-t border-slate-700/60 px-4 py-3">
          <div className="space-y-1.5">
            <FinalHeaderDecisionLine label="W" player={decisions?.winner} stats={getPitcherStats(decisions?.winner?.id)} onPlayerSelect={onPlayerSelect} />
            <FinalHeaderDecisionLine label="L" player={decisions?.loser} stats={getPitcherStats(decisions?.loser?.id)} onPlayerSelect={onPlayerSelect} />
            <FinalHeaderDecisionLine label="S" player={decisions?.save} stats={getPitcherStats(decisions?.save?.id)} onPlayerSelect={onPlayerSelect} />
          </div>
          {onOpenPitchBreakdown && (
            <button
              type="button"
              onClick={onOpenPitchBreakdown}
              className={`mt-0.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-${THEME_COLOR}-500/40 hover:bg-${THEME_COLOR}-500/10 hover:text-${THEME_COLOR}-200`}
            >
              <i className="fa-solid fa-chart-simple text-[10px]" aria-hidden />
              Pitch breakdown
            </button>
          )}
          {onOpenSituationBreakdown && (
            <button
              type="button"
              onClick={onOpenSituationBreakdown}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-${THEME_COLOR}-500/40 hover:bg-${THEME_COLOR}-500/10 hover:text-${THEME_COLOR}-200`}
            >
              <i className="fa-solid fa-diamond text-[10px]" aria-hidden />
              Situation breakdown
            </button>
          )}
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

function formatDesktopStripDate(dateStr) {
  if (!dateStr) return 'Calendar';
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Calendar';
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return { month, day: String(date.getDate()) };
}

function toLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const date = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateStr, days) {
  const date = toLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return next;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildCalendarWeeks(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function leagueLogoForSportId(sportId) {
  return Number(sportId) === 1 ? MLB_LEAGUE_LOGO : MILB_LEAGUE_LOGO;
}

function buildMlbTvUrl(gamePk) {
  return `https://www.mlb.com/tv/g${gamePk}?callsign=rsn&affiliateId=GAMEDAY`;
}

function WatchMenu({ gamePk, logoSrc, leagueLabel = 'MLB' }) {
  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="grid h-8 w-8 place-items-center transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70"
        aria-label="Open watch options"
      >
        <img
          src={logoSrc}
          alt={leagueLabel}
          className="h-6 w-6 object-contain"
          draggable={false}
        />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-2 w-56 origin-top-right rounded-2xl border border-slate-700/70 bg-[#121827]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur focus:outline-none"
      >
        <div className="px-3 pb-2 pt-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Watch
          </div>
          <div className="mt-0.5 text-sm font-bold text-white">
            Game Broadcast
          </div>
        </div>
        <MenuItem>
          {({ focus }) => (
            <a
              href={buildMlbTvUrl(gamePk)}
              target="_blank"
              rel="noreferrer"
              className={[
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                focus ? `bg-${THEME_COLOR}-500/15 text-${THEME_COLOR}-200` : 'text-slate-200',
              ].join(' ')}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-lg bg-${THEME_COLOR}-500/15 text-${THEME_COLOR}-200`}>
                <i className="fa-solid fa-tv text-xs" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block">Watch on MLB.TV</span>
                <span className="block text-[11px] font-medium text-slate-500">
                  Opens official broadcast
                </span>
              </span>
              <i className="fa-solid fa-arrow-up-right-from-square ml-auto text-[10px] text-slate-500" aria-hidden />
            </a>
          )}
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

function WatchInlineLink({ gamePk, logoSrc, leagueLabel = 'MLB' }) {
  return (
    <a
      href={buildMlbTvUrl(gamePk)}
      target="_blank"
      rel="noreferrer"
      className={`flex h-full min-h-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-${THEME_COLOR}-500/10`}
      aria-label={`Watch this ${leagueLabel} game`}
    >
      <img src={logoSrc} alt="" className="h-8 w-8 object-contain" draggable={false} />
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Watch:
        </span>
        <span className={`mt-0.5 flex items-center gap-2 text-sm font-black text-${THEME_COLOR}-200`}>
          {Number.isFinite(Number(gamePk)) ? `${leagueLabel}.TV` : 'Broadcast'}
          <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-500" aria-hidden />
        </span>
      </span>
    </a>
  );
}

function GamedayGamePicker({ games, currentGamePk, loading, onSelect, onOpen, label = 'Gameday' }) {
  const count = games.length;
  return (
    <Menu as="div" className="relative justify-self-center">
      <MenuButton
        type="button"
        onClick={() => { onOpen?.(); }}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold text-sm text-slate-100 transition-colors hover:bg-slate-800/70 active:text-white"
      >
        <span>{label}</span>
        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" aria-hidden />
      </MenuButton>
      <MenuItems
        anchor="bottom"
        transition
        className="z-50 mt-2 w-[min(100vw-1rem,20rem)] max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-xl focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {loading && (
          <div className="px-4 py-3 text-xs text-slate-500">Loading games...</div>
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

function GamedayDayPicker({
  onDateSelect,
  dateValue,
  label = { month: 'GAME', day: 'DAY' },
  icon = null,
}) {
  const selectedDate = toLocalDate(dateValue);
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const calendarDays = buildCalendarWeeks(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Menu as="div" className="relative justify-self-center">
      <MenuButton
        type="button"
        className="flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1 text-center font-black text-slate-100 transition-colors hover:bg-slate-800/70 active:text-white"
      >
        {icon && <i className={`fa-solid ${icon} text-xs text-slate-400`} aria-hidden />}
        <span className="text-[10px] leading-none tracking-wide">
          {typeof label === 'string' ? label : label.month}
        </span>
        {typeof label === 'string' ? null : (
          <span className="mt-0.5 text-sm leading-none tabular-nums">{label.day}</span>
        )}
      </MenuButton>
      <MenuItems
        anchor="bottom"
        transition
        className="z-50 mt-2 w-[min(100vw-1rem,22rem)] rounded-2xl bg-[#0f1722] border border-slate-700/80 shadow-2xl shadow-black/40 focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewMonth((prev) => addMonths(prev, -1))}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700/70 bg-slate-900/80 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              aria-label="Previous month"
            >
              <i className="fa-solid fa-chevron-left text-xs" aria-hidden />
            </button>
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">
                Calendar
              </div>
              <div className="mt-0.5 font-display text-lg text-white">
                {monthLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700/70 bg-slate-900/80 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              aria-label="Next month"
            >
              <i className="fa-solid fa-chevron-right text-xs" aria-hidden />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-500">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={`${day}-${index}`}>{day}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isSelected = isSameDate(day, selectedDate);
              const isOutsideMonth = day.getMonth() !== viewMonth.getMonth();
              const isToday = isSameDate(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    const nextDate = toDateInputValue(day);
                    setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                    onDateSelect?.(nextDate);
                  }}
                  className={[
                    'relative h-8 rounded-lg text-xs font-bold transition-colors',
                    isSelected
                      ? `bg-${THEME_COLOR}-400 text-slate-950 shadow-lg shadow-${THEME_COLOR}-950/30`
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                    isOutsideMonth ? 'opacity-35' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {day.getDate()}
                  {isToday && !isSelected && (
                    <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-${THEME_COLOR}-300`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </MenuItems>
    </Menu>
  );
}

function DesktopMiniTeamRow({ team, score, record }) {
  return (
    <div className="grid h-5 grid-cols-[1rem_2.4rem_1fr_1.1rem] items-center gap-1 leading-none">
      <img src={teamLogoUrl(team.id)} alt={team.abbreviation} className="h-3.5 w-3.5 object-contain" />
      <span className="truncate text-[12px] font-extrabold text-white">
        {team.abbreviation}
      </span>
      <span className="truncate text-right text-[10px] font-mono text-slate-400">
        {record ? `${record.wins} - ${record.losses}` : ''}
      </span>
      <span className="text-right font-display text-[15px] leading-none text-white tabular-nums">
        {score}
      </span>
    </div>
  );
}

function DesktopMiniGameCard({ game, isSelected, onClick }) {
  const state = game.status?.abstractGameState ?? '';
  const detailed = game.status?.detailedState ?? '';
  const isLiveGame = state === 'Live';
  const isFinalGame = state === 'Final';
  const isPostponed = /postponed/i.test(detailed);
  const away = game.teams?.away;
  const home = game.teams?.home;
  const awayTeam = away?.team ?? {};
  const homeTeam = home?.team ?? {};
  const awayScore = away?.score ?? 0;
  const homeScore = home?.score ?? 0;
  const awayRecord = away?.leagueRecord;
  const homeRecord = home?.leagueRecord;
  const statusLabel = isLiveGame
    ? formatLiveInningLabel(game.linescore)
    : isPostponed
      ? 'POSTPONED'
      : isFinalGame
        ? formatFinalStatus(game.linescore)
        : game.gameDate
          ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : detailed || '—';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSelected}
      className={[
        'grid h-full w-full grid-rows-[0.9rem_1.25rem_1.25rem] rounded-lg border bg-[#111a24] px-2 py-1.5 text-left transition-colors',
        isSelected
          ? 'border-slate-300/80 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.45)]'
          : 'border-slate-700/70 hover:border-slate-500/80 hover:bg-slate-800/60',
        isPostponed ? 'opacity-55' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex min-h-0 items-start justify-between gap-1 leading-none">
        <div className="truncate text-[9px] font-extrabold uppercase leading-none tracking-wide text-slate-200">
          {statusLabel}
        </div>
      </div>

      <DesktopMiniTeamRow team={awayTeam} score={awayScore} record={awayRecord} />
      <DesktopMiniTeamRow team={homeTeam} score={homeScore} record={homeRecord} />
    </button>
  );
}

function DesktopGameStrip({
  games,
  currentGamePk,
  loading,
  onSelect,
  onDateSelect,
  onDateShift,
  dateValue,
  dateLabel,
}) {
  const gamesScrollerRef = useRef(null);

  useEffect(() => {
    const el = gamesScrollerRef.current;
    if (!el) return undefined;

    const handleGamesWheel = (event) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      if (!horizontalDelta) return;

      event.preventDefault();
      el.scrollLeft += horizontalDelta;
    };

    el.addEventListener('wheel', handleGamesWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleGamesWheel);
  }, [games.length, loading]);

  return (
    <div className="hidden xl:grid xl:grid-cols-[7.25rem_minmax(0,1fr)] xl:gap-2 xl:min-h-[5.25rem] xl:max-h-[5.25rem]">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-stretch rounded-xl border border-slate-700/60 bg-[#121827] overflow-hidden">
        <button
          type="button"
          onClick={() => onDateShift?.(-1)}
          className="grid h-full min-h-[4.75rem] place-items-center border-r border-slate-700/60 text-slate-200 transition-colors hover:bg-slate-800/70 hover:text-white"
          aria-label="Previous day"
        >
          <i className="fa-solid fa-chevron-left text-base" aria-hidden />
        </button>
        <div className="flex min-w-0 items-center justify-center px-1">
          <GamedayDayPicker
            label={dateLabel || { month: 'CAL', day: '' }}
            onDateSelect={onDateSelect}
            dateValue={dateValue}
          />
        </div>
        <button
          type="button"
          onClick={() => onDateShift?.(1)}
          className="grid h-full min-h-[4.75rem] place-items-center border-l border-slate-700/60 text-slate-200 transition-colors hover:bg-slate-800/70 hover:text-white"
          aria-label="Next day"
        >
          <i className="fa-solid fa-chevron-right text-base" aria-hidden />
        </button>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-[#121827] overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            Loading today's games...
          </div>
        ) : games.length ? (
          <div
            ref={gamesScrollerRef}
            className="h-full overflow-x-auto overflow-y-hidden overscroll-x-contain px-1.5 py-1 scrollbar-thin"
          >
            <div className="flex h-full min-w-max gap-2">
              {games.map((game) => {
                const isSelected = String(game.gamePk) === String(currentGamePk);
                return (
                  <div key={game.gamePk} className="w-[9.75rem] shrink-0">
                    <DesktopMiniGameCard
                      game={game}
                      isSelected={isSelected}
                      onClick={isSelected ? undefined : () => onSelect(game.gamePk)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No games today
          </div>
        )}
      </div>
    </div>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

function GamePageContent({ gamePk, navigate, location }) {

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsReconnectKey, setWsReconnectKey] = useState(0);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [selectedPlayTargetPitchKey, setSelectedPlayTargetPitchKey] = useState(null);
  const [pitchCountReturn, setPitchCountReturn] = useState(null);
  const [situationReturn, setSituationReturn] = useState(null);
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(() => location.state?.activeTab ?? 'live');
  const [leftRailView, setLeftRailView] = useState('live');
  const [finalRailView, setFinalRailView] = useState('summary');
  const [boxScoreSide, setBoxScoreSide] = useState('away');
  const [usePurpleInPlayOuts, setUsePurpleInPlayOuts] = useLocalStorageState(
    GAMEDAY_IN_PLAY_OUTS_PURPLE_KEY,
    false,
  );
  const [pitchCountSheetOpen, setPitchCountSheetOpen] = useState(false);
  const [situationBreakdownOpen, setSituationBreakdownOpen] = useState(false);
  // Track whether we pushed a history entry for the sheet
  const sheetHistoryRef = useRef(false);
  const suppressNextSheetPopRef = useRef(false);
  const summaryScrollYRef = useRef(0);
  const feedTimecodeRef = useRef(null);
  const [expandedVideoKey, setExpandedVideoKey] = useState(null);
  const [pinnedVideo, setPinnedVideo] = useState(null);
  const [milbHighlightByItemKey, setMilbHighlightByItemKey] = useState({});
  const [eventTypesByCode, setEventTypesByCode] = useState(() => eventTypesCache ?? {});
  const [previewTab, setPreviewTab] = useState('preview');
  const [stripDate, setStripDate] = useState(null);
  const officialDate = feed?.gameData?.datetime?.officialDate;
  const gameSportId = feed?.gameData?.teams?.home?.sport?.id
    ?? feed?.gameData?.teams?.away?.sport?.id
    ?? 1;
  const singleFieldImageUrl = Number(gameSportId) === LMB_SPORT_ID ? LMB_FIELD_BACKGROUND_URL : null;
  const leagueLogoSrc = leagueLogoForSportId(gameSportId);
  const scoringCount = feed?.liveData?.plays?.scoringPlays?.length ?? 0;
  const batterId = feed?.liveData?.linescore?.offense?.batter?.id;
  const pitcherId = feed?.liveData?.linescore?.defense?.pitcher?.id;
  const activeStripDate = stripDate ?? officialDate;
  const { daySchedule, dayScheduleLoading, refreshDaySchedule } = useDaySchedule(activeStripDate, dedupeDaySchedule, gameSportId);
  const { gameContent } = useGameContent(gamePk, scoringCount);
  const { previewLineups, previewLineupsLoading } = usePreviewLineups(
    gamePk,
    feed?.gameData?.status?.abstractGameState,
  );
  const { visibleVsStats } = useVsStats(batterId, pitcherId);
  const getPlayBadge = useCallback(
    (eventType, context = null) => buildPlayBadge(eventType, context, eventTypesByCode),
    [eventTypesByCode],
  );
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
    if (!officialDate) return;
    setStripDate((current) => current ?? officialDate);
  }, [officialDate]);

  useEffect(() => {
    let cancelled = false;
    fetchEventTypes()
      .then((eventTypes) => {
        if (!cancelled) setEventTypesByCode(eventTypes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setGameStripDate = useCallback((dateStr) => {
    setStripDate(dateStr);
  }, []);

  const shiftGameStripDate = useCallback((days) => {
    setStripDate((current) => addDaysToDateString(current ?? officialDate, days));
  }, [officialDate]);

  const refreshLiveFeed = useCallback(async ({ allowSetError = false } = {}) => {
    if (!gamePk) return false;
    try {
      const data = await fetchLiveGameFeed(gamePk);
      setFeed((prev) => {
        const nextTc = data.metaData?.timeStamp;
        if (
          prev &&
          nextTc &&
          feedTimecodeRef.current &&
          compareTimecodes(nextTc, feedTimecodeRef.current) < 0
        ) {
          return prev;
        }

        const merged = prev ? mergeLiveFeed(prev, data, { replaceLinescore: true }) : data;
        if (!isValidLiveFeed(merged)) return prev;
        if (nextTc) feedTimecodeRef.current = nextTc;
        return merged;
      });
      setError(null);
      return true;
    } catch (err) {
      if (allowSetError) setError(err.message);
      return false;
    }
  }, [gamePk]);

  useEffect(() => {
    if (!gamePk) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLiveGameFeed(gamePk);
        if (cancelled) return;
        feedTimecodeRef.current = data.metaData?.timeStamp ?? null;
        setFeed(data);
        setError(null);
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
    wsReconnectKey,
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
      void refreshLiveFeed();
    }
  }, [lastUpdate, applyFeedPatch, refreshLiveFeed]);

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

    void refreshLiveFeed();
    const id = setInterval(() => { void refreshLiveFeed(); }, LIVE_FULL_FEED_REFRESH_MS);
    return () => clearInterval(id);
  }, [gamePk, feed?.gameData?.status?.abstractGameState, refreshLiveFeed]);

  useEffect(() => {
    if (!gamePk) return undefined;

    const reconnectAndRefresh = () => {
      setWsReconnectKey((key) => key + 1);
      void refreshLiveFeed();
      // Mobile browsers can fire resume events before network/websocket state is
      // fully thawed. A short follow-up refresh catches pitches that landed
      // while the tab/app was suspended without requiring a manual page reload.
      window.setTimeout(() => { void refreshLiveFeed(); }, 900);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconnectAndRefresh();
    };

    const onPageShow = (event) => {
      if (event.persisted) reconnectAndRefresh();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', reconnectAndRefresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', reconnectAndRefresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', reconnectAndRefresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', reconnectAndRefresh);
    };
  }, [gamePk, refreshLiveFeed]);

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

  useEffect(() => {
    const liveClass = 'game-page-live-fullscreen';
    const finalClass = 'game-page-final-fullscreen';
    const gameState = feed?.gameData?.status?.abstractGameState;
    document.body.classList.toggle(liveClass, gameState === 'Live' && activeTab === 'live');
    document.body.classList.toggle(finalClass, gameState === 'Final');
    return () => {
      document.body.classList.remove(liveClass);
      document.body.classList.remove(finalClass);
    };
  }, [feed?.gameData?.status?.abstractGameState, activeTab]);

  const isLiveForBackdrop = feed?.gameData?.status?.abstractGameState === 'Live';
  const [backdropClock, setBackdropClock] = useState(() => Date.now());

  useEffect(() => {
    if (!isLiveForBackdrop) return undefined;
    const id = setInterval(() => setBackdropClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isLiveForBackdrop]);

  const venueId = feed?.gameData?.venue?.id;
  const exteriorTimeOfDay = stadiumTimeOfDay(isLiveForBackdrop ? backdropClock : feed?.gameData?.gameDate);
  const strikeZoneTopImageUrl = MILB_SPORT_IDS.has(Number(gameSportId))
    ? milbStadiumTopUrl(exteriorTimeOfDay)
    : null;
  const exteriorSrc = venueId ? stadiumExteriorUrl(venueId, exteriorTimeOfDay) : null;
  const [exteriorFailed, setExteriorFailed] = useState(() => !exteriorSrc);

  useEffect(() => {
    const isMiLB = MILB_SPORT_IDS.has(Number(gameSportId));
    if (!isMiLB || !feed?.liveData?.plays?.allPlays?.length || !feed?.gameData) {
      setMilbHighlightByItemKey({});
      return undefined;
    }

    const controller = new AbortController();
    const summaryRows = buildSummaryItems(feed.liveData.plays.allPlays, feed.gameData);
    buildMiLBHighlightMap(summaryRows, { signal: controller.signal })
      .then((map) => setMilbHighlightByItemKey(map))
      .catch((err) => {
        if (err?.name !== 'AbortError') setMilbHighlightByItemKey({});
      });

    return () => controller.abort();
  }, [gamePk, scoringCount, gameSportId]);

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
  const restorePitchCountView = useCallback((returnState = pitchCountReturn) => {
    if (!returnState) return;
    window.setTimeout(() => {
      setPitchCountSheetOpen(true);
    }, 120);
  }, [pitchCountReturn]);

  const restoreSituationBreakdownView = useCallback((returnState = situationReturn) => {
    if (!returnState) return;
    window.setTimeout(() => {
      setSituationBreakdownOpen(true);
    }, 120);
  }, [situationReturn]);

  const openSheet = useCallback((play, options = {}) => {
    setSelectedPlay(play);
    setSelectedPlayTargetPitchKey(options.highlightedPitchKey ?? null);
    setPitchCountReturn(options.returnToPitchCount
      ? { ...options.returnToPitchCount, nonce: Date.now() }
      : null);
    setSituationReturn(options.returnToSituation
      ? { ...options.returnToSituation, nonce: Date.now() }
      : null);
    window.history.pushState({ mlbSheet: true }, '');
    sheetHistoryRef.current = true;
  }, []);

  const openSituationPlay = useCallback((play, options = {}) => {
    setSituationBreakdownOpen(false);
    window.setTimeout(() => {
      openSheet(play, {
        returnToSituation: {
          scrollTop: options.scrollTop ?? 0,
        },
      });
    }, 80);
  }, [openSheet]);

  const closeSheet = useCallback(() => {
    const pitchReturnState = pitchCountReturn;
    const situationReturnState = situationReturn;
    setSelectedPlay(null);
    setSelectedPlayTargetPitchKey(null);
    restorePitchCountView(pitchReturnState);
    restoreSituationBreakdownView(situationReturnState);
    if (sheetHistoryRef.current) {
      sheetHistoryRef.current = false;
      suppressNextSheetPopRef.current = true;
      window.history.back();
    }
  }, [pitchCountReturn, situationReturn, restorePitchCountView, restoreSituationBreakdownView]);

  useEffect(() => {
    const onPopState = (event) => {
      if (suppressNextSheetPopRef.current) {
        suppressNextSheetPopRef.current = false;
        return;
      }
      if (selectedPlay) {
        if (event.state?.mlbSheet) return;
        sheetHistoryRef.current = false;
        setSelectedPlay(null);
        setSelectedPlayTargetPitchKey(null);
        const situationReturnState = situationReturn;
        restorePitchCountView();
        restoreSituationBreakdownView(situationReturnState);
        // Prevent route navigation — do nothing else
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedPlay, situationReturn, restorePitchCountView, restoreSituationBreakdownView]);

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

  if (!feed || !isValidLiveFeed(feed)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⚾</div>
        <div className="text-red-400 font-semibold mb-2">
          Failed to load game
        </div>
        <div className="text-slate-500 text-sm mb-6">{error ?? 'Unable to load game data.'}</div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              void refreshLiveFeed({ allowSetError: true }).finally(() => setLoading(false));
            }}
            className="px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-2xl text-sm text-emerald-300 transition-all"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() =>
              navigate('/', { state: { returnDate: location.state?.returnDate } })
            }
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-sm transition-all"
          >
            ← Back to Game Day
          </button>
        </div>
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
  const bottomHalf = currentPlay?.about?.halfInning === 'bottom' || ls?.inningHalf === 'Bottom';
  const lastOutCanEndGame =
    !isFinal &&
    bottomHalf &&
    currentPlay?.about?.isComplete &&
    Number(currentPlay?.count?.outs ?? ls?.outs ?? 0) >= 3 &&
    Number(ls?.currentInning ?? currentPlay?.about?.inning ?? 0) >= 9 &&
    homeRuns !== awayRuns;
  const gameOverMessage = lastOutCanEndGame
    ? homeRuns > awayRuns
      ? `Game Over! ${home.abbreviation} wins, ${homeRuns}-${awayRuns}`
      : `Game Over! ${away.abbreviation} wins, ${awayRuns}-${homeRuns}`
    : null;
  const finalMessage = isFinal
    ? awayRuns === homeRuns
      ? `${away.abbreviation} tied ${home.abbreviation}`
      : awayRuns > homeRuns
        ? `${away.abbreviation} defeated ${home.abbreviation}, ${awayRuns}-${homeRuns}`
        : `${home.abbreviation} defeated ${away.abbreviation}, ${homeRuns}-${awayRuns}`
    : gameOverMessage;
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
    compactPlayerName(player, '');

  const formatCurrentBattingLine = (player) => {
    if (!player?.id) return null;
    const stat = getBatterGameStat(player.id);
    return `${getLastName(player)}: ${stat?.hits ?? 0}-${stat?.atBats ?? 0}`;
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
  const hasPitchBreakdownData = allPlays.some((play) =>
    (play.playEvents || []).some((event) => event?.isPitch && event?.pitchData?.coordinates)
  );

  const summaryLeadIn = buildSummaryLeadIn(gd);
  const allSummaryItems = buildSummaryItems(allPlays, gd);
  const summaryItems = filterSummaryItems(allSummaryItems, summaryFilter);
  const summaryItemGroups = groupSummaryByInning(summaryItems, ORDINALS);
  const highlightVideos = parseGameHighlightVideos(gameContent);
  const youtubeHighlightFallbackByItemKey = buildYoutubeHighlightFallbackMap(allSummaryItems, gd);
  const highlightByItemKey = {
    ...youtubeHighlightFallbackByItemKey,
    ...buildHighlightMap(allSummaryItems, highlightVideos),
    ...milbHighlightByItemKey,
  };

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
    ...(isLive ? [{ key: 'live', label: 'Live At Bat' }] : []),
    { key: 'boxscore', label: 'Box Score' },
    { key: 'summary', label: 'Summary' },
    { key: 'savant', label: '⚾ Savant' },
  ];

  const currentTab = !isLive && activeTab === 'live' ? 'boxscore' : activeTab;

  const gameTabBar = (
    <div className="flex items-stretch">
      <TabBar
        variant="page"
        tabs={tabList}
        activeKey={currentTab}
        onChange={setActiveTab}
        className="min-w-0 flex-1"
        listClassName="border-b-0"
      />
      {hasPitchBreakdownData && (
        <GamedayOptionsMenu
          usePurpleInPlayOuts={usePurpleInPlayOuts}
          onUsePurpleInPlayOutsChange={setUsePurpleInPlayOuts}
          onOpenPitchCounts={() => setPitchCountSheetOpen(true)}
          onOpenSituationBreakdown={() => {
            setSituationReturn(null);
            setSituationBreakdownOpen(true);
          }}
          showLiveOptions={isLive}
        />
      )}
    </div>
  );

  const halfScreenPitchBreakdownButton = (
    <button
      type="button"
      onClick={() => setPitchCountSheetOpen(true)}
      className={`hidden sm:inline-flex xl:hidden items-center gap-2 border-l border-slate-800 px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-400 transition-colors hover:bg-slate-800/45 hover:text-${THEME_COLOR}-300`}
    >
      <i className="fa-solid fa-location-dot" aria-hidden />
      Pitch Breakdown
    </button>
  );

  const halfScreenGameTabBar = (
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1">
        {gameTabBar}
      </div>
      {halfScreenPitchBreakdownButton}
    </div>
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
          {halfScreenGameTabBar}
        </div>
      </div>

      <div className="xl:flex-1 xl:min-h-0 xl:overflow-hidden xl:flex xl:items-center xl:justify-center">
        <LiveAtBatVisual
          venueId={venueId}
          exteriorFailed={exteriorFailed}
          gameDateTime={isLiveForBackdrop ? backdropClock : gd.datetime?.dateTime}
          currentPlay={currentPlay}
          playEvents={allPitchEvents}
          szTop={szTop}
          szBot={szBot}
          gamePk={gamePk}
          batSide={batSide}
          batterIsAway={batterIsAway}
          batterTeamId={batterIsAway ? away.id : home.id}
          season={previewSeason}
          onRecentRowReady={revealLiveRecentRow}
          baseballModelUrl={assetUrl('baseball-centered.glb')}
          singleFieldImageUrl={singleFieldImageUrl}
          strikeZoneTopImageUrl={strikeZoneTopImageUrl}
          showHotZones
          usePurpleInPlayOuts={usePurpleInPlayOuts}
          immersiveField
          className="xl:h-full xl:min-h-0 xl:w-[calc(100%+10rem)] xl:max-w-none 2xl:w-[calc(100%+14rem)]"
        />
      </div>

      <LiveMatchupStrip
        currentPlay={currentPlay}
        dueUpBatters={dueUpBatters}
        dueUpHalfLabel={dueUpHalfLabel}
        dueUpInningOrdinal={dueUpInningOrdinal}
        finalMessage={finalMessage}
        getBatterGameStat={getBatterGameStat}
        getGamePlayer={getGamePlayer}
        getPitcherGameStat={getPitcherGameStat}
        linescore={ls}
        onPlayerSelect={handlePlayDetailPlayerSelect}
        showDueUpMatchup={showDueUpMatchup}
      />

      {(vsMatchupLine || dueUpTickerLine) && (
        <div className="relative z-20 bg-slate-900 border border-slate-800 sm:rounded-2xl px-3 py-2">
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

  const summaryPanel = (
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
      statusChangeBadge={STATUS_CHANGE_BADGE}
      summaryFilter={summaryFilter}
      summaryItemGroups={summaryItemGroups}
      summaryLeadIn={summaryLeadIn}
      onSummaryFilterChange={setSummaryFilter}
    />
  );

  const savantPanel = (
    <SavantStatcastSection
      gamePk={gamePk}
      allPlays={allPlays}
      onOpenPlay={openSheet}
    />
  );

  const recentPlaysPanel = (
    <div className="relative z-0 bg-slate-900 border border-slate-700/60 sm:rounded-2xl overflow-visible">
      <div className="pointer-events-none absolute -top-4 left-0 right-0 z-30 h-5 bg-slate-900 sm:rounded-t-2xl" aria-hidden />
      <div className="relative z-20 hidden items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2 xl:flex sm:rounded-t-2xl">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Recent Plays
          </div>
          <div className="text-[10px] font-semibold text-slate-600">
            {leftRailView === 'summary' ? `${summaryItems.length} plays` : `${liveRecentRows.length} events`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSituationReturn(null);
            setSituationBreakdownOpen(true);
          }}
          className={`inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-${THEME_COLOR}-500/40 hover:bg-${THEME_COLOR}-500/10 hover:text-${THEME_COLOR}-200`}
        >
          <i className="fa-solid fa-diamond text-[9px]" aria-hidden />
          Situation
        </button>
      </div>
      {/* <div className="relative z-20 bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between sm:rounded-t-2xl">
        <span className="xl:hidden text-[10px] text-slate-500 uppercase tracking-widest">
          Recent Plays
        </span>
        <div className="hidden xl:flex items-center gap-4">
          <button
            type="button"
            onClick={() => setLeftRailView('live')}
            className={`text-sm font-black transition-colors ${leftRailView === 'live' ? 'text-white' : 'text-slate-500 hover:text-slate-200'}`}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => setLeftRailView('summary')}
            className={`text-sm font-black transition-colors ${leftRailView === 'summary' ? 'text-white' : 'text-slate-500 hover:text-slate-200'}`}
          >
            Summary
          </button>
        </div>
        <span className="text-[9px] text-slate-600">
          {leftRailView === 'summary' ? `${summaryItems.length} plays` : `${liveRecentRows.length} events`}
        </span>
      </div> */}
      <div className="relative z-0 overflow-hidden p-2 sm:p-4 xl:p-3 2xl:p-4">
        {leftRailView === 'summary' ? (
          <div className="-m-2 sm:-m-4 xl:-m-3 2xl:-m-4">
            {summaryPanel}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );

  const boxScorePanel = ld.boxscore ? (
    <div className="bg-slate-900  border-slate-700/60 p-4 sm:p-5 xl:p-4 sm:rounded-2xl">
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

      {!isFinal && (
        <div className="mt-4 pt-4 border-t border-slate-700/40">
          <TeamReservesSection
            teamBox={ld.boxscore?.teams?.[boxScoreSide]}
            onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
          />
        </div>
      )}
    </div>
  ) : null;

  const desktopLiveBoxScorePanel = ld.boxscore ? (
    <div className="gameday-scroll-rail bg-slate-900 border border-slate-700/60 p-2.5 2xl:p-3 rounded-2xl h-full min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
          Box Score
        </span>
        <span className="text-[11px] text-slate-500 tabular-nums">
          {gameStart.dateLine}
        </span>
      </div>
      <div className="grid grid-cols-2 items-start gap-2 2xl:gap-3">
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
      {!isFinal && (
        <div className="mt-3 grid grid-cols-2 items-start gap-2 2xl:gap-3 border-t border-slate-800/70 pt-3">
          <TeamReservesSection
            teamBox={ld.boxscore?.teams?.away}
            compact
            onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
          />
          <TeamReservesSection
            teamBox={ld.boxscore?.teams?.home}
            compact
            onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
          />
        </div>
      )}
    </div>
  ) : null;

  const desktopBoxScoreRail = (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-hidden">
      {!isPreview && (
        <div className="shrink-0 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900">
          <LinescoreBoard
            key={`desktop-linescore-${gamePk}`}
            ls={ls}
            away={away}
            home={home}
            awayRuns={awayRuns}
            homeRuns={homeRuns}
            compact
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {desktopLiveBoxScorePanel}
      </div>
    </div>
  );

  const finalDesktopLayout = isFinal ? (
    <div className="hidden xl:grid xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_480px] 2xl:grid-cols-[minmax(0,1fr)_560px] xl:gap-8 xl:overflow-hidden">
      <section className="min-w-0 min-h-0 flex flex-col gap-6 overflow-hidden">
        <FinalGameHeader
          away={away}
          home={home}
          awayRuns={awayRuns}
          homeRuns={homeRuns}
          ls={ls}
          decisions={decisions}
          gamePk={gamePk}
          getPitcherStats={getPitcherStats}
          leagueLabel={Number(gameSportId) === 1 ? 'MLB' : 'MiLB'}
          logoSrc={leagueLogoSrc}
          onTeamSelect={(teamId) => navigate(`/team/${teamId}`)}
          onPlayerSelect={(playerId) => navigate(`/player/${playerId}`)}
          onOpenPitchBreakdown={() => setPitchCountSheetOpen(true)}
          onOpenSituationBreakdown={() => {
            setSituationReturn(null);
            setSituationBreakdownOpen(true);
          }}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          {desktopLiveBoxScorePanel}
        </div>
      </section>

      <aside className="min-w-0 min-h-0 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Game Feed
            </div>
            <div className="text-sm font-black text-white">
              {finalRailView === 'savant' ? 'Statcast Metrics' : 'Summary'}
            </div>
          </div>
          <SegmentedControl
            value={finalRailView}
            onChange={setFinalRailView}
            variant="pill"
            size="sm"
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'savant', label: '⚾ Savant' },
            ]}
          />
        </div>
        <div className="gameday-scroll-rail h-[calc(100%-4.5rem)] min-h-0 overflow-y-auto">
          {finalRailView === 'savant' ? savantPanel : summaryPanel}
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <div
      className={`max-w-5xl mx-auto px-0 sm:px-6 py-0 sm:py-8 ${
        isLive && currentTab === 'live'
          ? 'xl:h-[calc(100vh-4rem)] xl:max-h-[calc(100vh-4rem)] xl:max-w-none xl:overflow-hidden xl:px-3 xl:py-3 2xl:px-5'
          : isFinal
            ? 'xl:h-[calc(100vh-4rem)] xl:max-h-[calc(100vh-4rem)] xl:max-w-none xl:overflow-hidden xl:px-3 xl:py-3 2xl:px-5'
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
        <GamedayGamePicker
          games={daySchedule}
          currentGamePk={gamePk}
          loading={dayScheduleLoading}
          onOpen={() => refreshDaySchedule()}
          onSelect={(pk) => navigate(`/game/${pk}`, { state: { returnDate: location.state?.returnDate } })}
        />
        <div className="justify-self-end flex items-center justify-end gap-2 min-w-[4.5rem]">
         
          <WatchMenu
            gamePk={gamePk}
            logoSrc={leagueLogoSrc}
            leagueLabel={Number(gameSportId) === 1 ? 'MLB' : 'MiLB'}
          />
        </div>
      </div>

      {/* Desktop: back + ws status */}
      <div className={`hidden sm:flex items-center justify-between mb-4 px-0 ${(isLive && currentTab === 'live') || isFinal ? 'xl:hidden' : ''}`}>
        <button
          onClick={() =>
            navigate('/', { state: { returnDate: location.state?.returnDate } })
          }
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          <span>Scores</span>
        </button>
        <div className="flex items-center gap-2">
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
          <WatchMenu
            gamePk={gamePk}
            logoSrc={leagueLogoSrc}
            leagueLabel={Number(gameSportId) === 1 ? 'MLB' : 'MiLB'}
          />
        </div>
      </div>

      <div className={`px-0 sm:px-3 ${(isLive && currentTab === 'live') ? 'xl:h-full xl:min-h-0 xl:overflow-hidden' : ''} ${isFinal ? 'xl:h-full xl:min-h-0 xl:overflow-hidden xl:flex xl:flex-col' : ''}`}>
        {!isPreview && !(isLive && currentTab === 'live') && (
          <div className="sm:mb-5">
            <DesktopGameStrip
              games={daySchedule}
              currentGamePk={gamePk}
              loading={dayScheduleLoading}
              dateValue={activeStripDate}
              dateLabel={formatDesktopStripDate(activeStripDate)}
              onDateSelect={setGameStripDate}
              onDateShift={shiftGameStripDate}
              onSelect={(pk) => navigate(`/game/${pk}`, { state: { returnDate: location.state?.returnDate } })}
            />
          </div>
        )}

        {/* Scoreboard */}
        <div className={`bg-[#121827] border-y border-slate-700/60  overflow-hidden ${isPreview ? 'mb-3' : ''} ${isLive && currentTab === 'live' ? 'xl:hidden' : ''} ${isFinal ? 'xl:hidden' : ''}`}>
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
              {halfScreenGameTabBar}
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
                  const lastName = compactPlayerName(player, player.fullName);
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
        {!isLive && (
          <div className={isFinal ? 'xl:hidden' : ''}>
            {halfScreenGameTabBar}
          </div>
        )}

        {finalDesktopLayout}

        {/* Tab content */}
        {isLive && ls && (
          <div
            className={
              currentTab === 'live'
                ? 'relative overflow-x-hidden xl:h-full xl:min-h-0 xl:flex xl:flex-col xl:gap-5 xl:overflow-hidden'
                : 'hidden'
            }
            aria-hidden={currentTab !== 'live'}
          >
            <DesktopGameStrip
              games={daySchedule}
              currentGamePk={gamePk}
              loading={dayScheduleLoading}
              dateValue={activeStripDate}
              dateLabel={formatDesktopStripDate(activeStripDate)}
              onDateSelect={setGameStripDate}
              onDateShift={shiftGameStripDate}
              onSelect={(pk) => navigate(`/game/${pk}`, { state: { returnDate: location.state?.returnDate } })}
            />

            <div className="xl:min-h-0 xl:flex-1 xl:grid xl:grid-cols-[280px_minmax(500px,1fr)_minmax(560px,1.15fr)] 2xl:grid-cols-[320px_minmax(620px,1fr)_minmax(760px,1.35fr)] xl:items-stretch xl:gap-4 xl:overflow-hidden">
              <div className="xl:order-2 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-3 xl:overflow-hidden">
                {liveVisualPanel}
              </div>

              <div className="gameday-scroll-rail xl:order-1 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:rounded-2xl">
                {recentPlaysPanel}
              </div>

              <div className="hidden xl:order-3 xl:block xl:h-full xl:min-h-0 xl:overflow-hidden">
                {desktopBoxScoreRail}
              </div>
            </div>
          </div>
        )}

        {currentTab === 'boxscore' && (
          <div className={isFinal ? 'xl:hidden' : ''}>
            {boxScorePanel}
          </div>
        )}

        {currentTab === 'summary' && (
          <div className={isFinal ? 'xl:hidden' : ''}>
            {summaryPanel}
          </div>
        )}

        {currentTab === 'savant' && (
          <div className={isFinal ? 'xl:hidden' : ''}>
            {savantPanel}
          </div>
        )}

        <PitchCountByInningSheet
          open={pitchCountSheetOpen}
          onClose={() => {
            setPitchCountSheetOpen(false);
            setPitchCountReturn(null);
          }}
          allPlays={allPlays}
          away={away}
          home={home}
          gamePk={gamePk}
          onOpenPlay={openSheet}
          restorePitcherId={pitchCountReturn?.pitcherId}
          restoreNonce={pitchCountReturn?.nonce}
        />
        <SituationBreakdownSheet
          open={situationBreakdownOpen}
          onClose={() => {
            setSituationBreakdownOpen(false);
            setSituationReturn(null);
          }}
          allPlays={allPlays}
          away={away}
          home={home}
          onOpenPlay={openSituationPlay}
          getPlayBadge={getPlayBadge}
          restoreScrollTop={situationReturn?.scrollTop}
          restoreNonce={situationReturn?.nonce}
        />
        <PlayDetailSheet
          selectedPlay={selectedPlay}
          closeSheet={closeSheet}
          highlightedPitchKey={selectedPlayTargetPitchKey}
          away={away}
          home={home}
          allPlays={allPlays}
          gamePk={gamePk}
          venueId={venueId}
          exteriorFailed={exteriorFailed}
          gameDateTime={gd.datetime?.dateTime}
          season={previewSeason}
          baseballModelUrl={assetUrl('baseball-centered.glb')}
          singleFieldImageUrl={singleFieldImageUrl}
          strikeZoneTopImageUrl={strikeZoneTopImageUrl}
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

