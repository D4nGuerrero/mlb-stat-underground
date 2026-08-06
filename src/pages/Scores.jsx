import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { compactPlayerName, teamLogoUrl, formatFinalStatus } from '../utils/mlbHelpers';
import {
  BaseDiamondIndicator,
  getRunnersOnBase,
  formatLiveInningLabel,
  OutsIndicator,
} from '../components/LiveGameIndicators';
import ScoresListGameRow from '../components/ScoresListGameRow';
import ScoreboardFireworks from '../components/ScoreboardFireworks';
import NationalBroadcastIcons from '../components/NationalBroadcastIcons';
import { SegmentedControl, SwipeableCarousel, LoadingSpinner } from '../components/ui';
import { LeagueLevelPicker } from '../components/LeagueLevelPicker';
import { LEAGUE_LEVEL_BY_VALUE, LEAGUE_LEVEL_STORAGE_KEY, LEAGUE_LEVEL_VALUES } from '../constants/leagueLevels.js';

const MIN_DATE = new Date('2024-03-01');
const WINDOW_PAST = 60;
const FUTURE_DAYS = 180;
const LIVE_SCORES_POLL_MS = 10_000;
const TODAY_SCORES_POLL_MS = 30_000;
const SCOREBOARD_RESUME_REFRESH_DEBOUNCE_MS = 1_500;
// Dev note: this is intentionally split between a code flag and a user toggle.
// Keep the code flag as a quick kill-switch while the baseball easter egg controls the UX.
const ENABLE_SCOREBOARD_ROOTING_INTERESTS = true;
const ROOTING_DIVISION_GAMES_BACK_WINDOW = 6;
const ROOTING_WILD_CARD_GAMES_BACK_WINDOW = 6;
const SCOREBOARD_ROOTING_INTERESTS_KEY = 'mlbScoreboardRootingInterestsEnabled';
const ROOTING_DIVISION_HURT_FACE_URL = `${import.meta.env.BASE_URL}icons/rooting-division-hurt.png`;
const ROOTING_BOO_URL = `${import.meta.env.BASE_URL}icons/rooting-boo.png`;
const MLB_LEAGUE_ID_BY_TEAM_ID = {
  108: 103, 110: 103, 111: 103, 114: 103, 116: 103, 117: 103, 118: 103, 133: 103, 136: 103, 139: 103, 140: 103, 141: 103, 142: 103, 145: 103, 147: 103,
  109: 104, 112: 104, 113: 104, 115: 104, 119: 104, 120: 104, 121: 104, 134: 104, 135: 104, 137: 104, 138: 104, 143: 104, 144: 104, 146: 104, 158: 104,
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, offset) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + offset);
  return d;
};

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const buildDateRange = (min, max) => {
  const dates = [];
  let cursor = startOfDay(min);
  const end = startOfDay(max);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
};

const getMaxDate = () => addDays(new Date(), FUTURE_DAYS);

const VIEW_MODE_KEY = 'mlbScoresViewMode';
const SCORES_DATE_KEY = 'mlbScoresSelectedDate';
const VIEW_MODES = new Set(['card', 'list', 'grid']);

const resolveScoresCenterDate = (returnDate) => {
  if (returnDate) return startOfDay(new Date(returnDate));
  try {
    const saved = sessionStorage.getItem(SCORES_DATE_KEY);
    if (saved) return startOfDay(new Date(saved));
  } catch {
    /* ignore */
  }
  return startOfDay(new Date());
};

const loadViewMode = () => {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return VIEW_MODES.has(saved) ? saved : 'card';
  } catch {
    return 'card';
  }
};

const loadScoreboardLeague = () => {
  try {
    const saved = localStorage.getItem(LEAGUE_LEVEL_STORAGE_KEY);
    return LEAGUE_LEVEL_VALUES.has(saved) ? saved : 'mlb';
  } catch {
    return 'mlb';
  }
};

const loadRootingInterestsEnabled = () => {
  try {
    return localStorage.getItem(SCOREBOARD_ROOTING_INTERESTS_KEY) === 'true';
  } catch {
    return false;
  }
};

const computeDateWindow = (center, maxDate) => {
  const start = addDays(center, -WINDOW_PAST);
  const clampedStart = start < MIN_DATE ? MIN_DATE : start;
  const end = addDays(center, FUTURE_DAYS);
  const clampedEnd = end > maxDate ? maxDate : end;
  return buildDateRange(clampedStart, clampedEnd);
};

const parseGamesBack = (value) => {
  if (value == null || value === '-' || value === 'E') return 0;
  const parsed = Number(String(value).replace('+', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseStandingRank = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 99;
};

const isRootingDecisionFinal = (game) => {
  const status = game?.status ?? {};
  const detailed = String(status.detailedState ?? '').toLowerCase();
  const coded = String(status.codedGameState ?? '').toUpperCase();
  if (status.abstractGameState !== 'Final') return false;
  if (coded === 'PO' || detailed.includes('postponed') || detailed.includes('suspended') || detailed.includes('cancel')) {
    return false;
  }
  const awayScore = Number(game?.teams?.away?.score);
  const homeScore = Number(game?.teams?.home?.score);
  return Number.isFinite(awayScore) && Number.isFinite(homeScore) && awayScore !== homeScore;
};

const isRootingVisualPending = (game) => {
  const status = game?.status ?? {};
  const detailed = String(status.detailedState ?? '').toLowerCase();
  const coded = String(status.codedGameState ?? '').toUpperCase();
  return status.abstractGameState !== 'Final' &&
    coded !== 'PO' &&
    !detailed.includes('postponed') &&
    !detailed.includes('suspended') &&
    !detailed.includes('cancel');
};

const winPct = (record) => {
  const wins = Number(record?.wins ?? record?.leagueRecord?.wins ?? 0);
  const losses = Number(record?.losses ?? record?.leagueRecord?.losses ?? 0);
  const total = wins + losses;
  return total > 0 ? wins / total : 0;
};

function flattenStandingsRecords(data) {
  return (data?.records ?? []).flatMap((group) => (
    (group.teamRecords ?? []).map((record) => ({
      teamId: Number(record.team?.id),
      team: record.team,
      leagueId: Number(group.league?.id ?? record.league?.id ?? MLB_LEAGUE_ID_BY_TEAM_ID[Number(record.team?.id)]),
      divisionId: Number(group.division?.id ?? record.division?.id),
      divisionGamesBack: parseGamesBack(record.gamesBack),
      wildCardGamesBack: parseGamesBack(record.wildCardGamesBack),
      divisionRank: parseStandingRank(record.divisionRank),
      wildCardRank: parseStandingRank(record.wildCardRank),
      leagueRank: parseStandingRank(record.leagueRank),
      isDivisionLeader: parseStandingRank(record.divisionRank) === 1,
      leagueRecord: record.leagueRecord,
      pct: winPct(record),
    }))
  ));
}

function buildRootingInterestMap(standingsRecords, favoriteTeamId) {
  if (!favoriteTeamId) return {};
  const favorite = standingsRecords.find((record) => record.teamId === Number(favoriteTeamId));
  if (!favorite?.leagueId) return {};

  const sameLeague = standingsRecords.filter((record) => (
    record.teamId &&
    record.teamId !== favorite.teamId &&
    record.leagueId === favorite.leagueId
  ));
  const favoriteDivisionGb = favorite.divisionGamesBack;
  const favoritePct = favorite.pct;
  const watchMap = {};

  sameLeague.forEach((record) => {
    const reasons = [];
    let raceType = null;
    let raceGap = null;
    if (record.divisionId && record.divisionId === favorite.divisionId) {
      const diffFromFavorite = record.divisionGamesBack - favoriteDivisionGb;
      if (Math.abs(diffFromFavorite) <= ROOTING_DIVISION_GAMES_BACK_WINDOW) {
        reasons.push(diffFromFavorite <= 0
          ? 'Division race'
          : `Division +${diffFromFavorite.toFixed(diffFromFavorite % 1 ? 1 : 0)} GB`);
        raceType = 'division';
        raceGap = diffFromFavorite;
      }
    }

    // Wild Card pressure should not include unrelated division leaders. They can
    // matter for seeding, but this watch mode is about teams blocking your path.
    const pctGapGames = Math.abs(record.pct - favoritePct) * 162;
    const standingsGap = record.wildCardRank <= favorite.wildCardRank
      ? record.wildCardGamesBack
      : Math.abs(record.wildCardGamesBack - favorite.wildCardGamesBack);
    const nearFavorite = Math.min(pctGapGames, standingsGap) <= ROOTING_WILD_CARD_GAMES_BACK_WINDOW;
    const isWildCardCandidate = !record.isDivisionLeader && nearFavorite;
    if (isWildCardCandidate) {
      reasons.push('Wild Card picture');
      if (!raceType) {
        raceType = 'wildcard';
        raceGap = record.wildCardGamesBack;
      }
    }

    if (reasons.length) {
      // Priority combines race relevance with record strength. Division rivals
      // receive a head start, but a much stronger Wild Card blocker can still be
      // the preferred team to lose when two watched clubs play one another.
      const proximity = Math.max(0, 8 - Math.abs(Number(raceGap) || 0));
      const recordStrength = record.pct * 100;
      const aheadBonus = Number(raceGap) <= 0 ? 18 : 0;
      const playoffPositionBonus = raceType === 'wildcard' && record.wildCardRank <= 3 ? 18 : 0;
      const priorityScore = Math.round(
        (raceType === 'division' ? 105 : 70) +
        (proximity * 7) +
        recordStrength +
        aheadBonus +
        playoffPositionBonus
      );
      watchMap[record.teamId] = {
        teamId: record.teamId,
        label: raceType === 'division' ? 'Division threat' : 'Wild Card threat',
        raceType,
        priorityScore,
        recordPct: record.pct,
        reason: [...new Set(reasons)].join(' · '),
      };
    }
  });

  return watchMap;
}

function gameRootingInterest(game, rootingInterestByTeamId) {
  const awayId = Number(game?.teams?.away?.team?.id);
  const homeId = Number(game?.teams?.home?.team?.id);
  const awayInterest = rootingInterestByTeamId?.[awayId] ?? null;
  const homeInterest = rootingInterestByTeamId?.[homeId] ?? null;
  const hasAny = Boolean(awayInterest || homeInterest);
  const isDual = Boolean(awayInterest && homeInterest);
  let prioritySide = awayInterest ? 'away' : homeInterest ? 'home' : null;
  if (awayInterest && homeInterest) {
    prioritySide = homeInterest.priorityScore > awayInterest.priorityScore ? 'home' : 'away';
  }
  const cheerSide = hasAny && !isDual
    ? prioritySide === 'away' ? 'home' : 'away'
    : null;

  return {
    away: awayInterest ? { ...awayInterest, isPrimary: prioritySide === 'away' } : null,
    home: homeInterest ? { ...homeInterest, isPrimary: prioritySide === 'home' } : null,
    hasAny,
    isDual,
    prioritySide,
    cheerSide,
  };
}

function rootingInterestOutcome(game, side) {
  if (!isRootingDecisionFinal(game)) return null;
  const awayScore = Number(game?.teams?.away?.score ?? 0);
  const homeScore = Number(game?.teams?.home?.score ?? 0);
  const watchedTeamWon = side === 'away'
    ? awayScore > homeScore
    : homeScore > awayScore;
  return watchedTeamWon ? 'bad' : 'good';
}

function RootingInterestBadge({ interest, outcome = null, compact = false }) {
  if (!interest) return null;
  const toneClass = outcome === 'good'
    ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/50 shadow-[0_0_12px_rgba(52,211,153,0.22)]'
    : outcome === 'bad'
      ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/50 shadow-[0_0_12px_rgba(248,113,113,0.24)]'
      : interest.raceType === 'division'
        ? 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-400/50'
        : 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/45';
  const iconClass = outcome === 'good'
    ? 'fa-circle-check'
    : outcome === 'bad'
      ? 'fa-circle-xmark'
      : interest.raceType === 'division' ? 'fa-burst' : 'fa-crosshairs';
  const label = outcome === 'good'
    ? `${interest.raceType === 'division' ? 'DIV' : 'WC'} loss · helped`
    : outcome === 'bad'
      ? `${interest.raceType === 'division' ? 'DIV' : 'WC'} win · hurt`
      : interest.isPrimary
        ? `Top target · ${interest.raceType === 'division' ? 'DIV' : 'WC'}`
        : interest.label;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-[0.12em] ${toneClass} ${interest.isPrimary && !outcome ? 'scoreboard-watch-priority-chip' : ''} ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]'}`}
      title={interest.reason}
    >
      <i className={`fa-solid ${iconClass}`} aria-hidden />
      {label}
    </span>
  );
}

function rootingGameOutcome(game, rootingInterest) {
  if (!rootingInterest?.prioritySide) return null;
  return rootingInterestOutcome(game, rootingInterest.prioritySide);
}

function isRootingDivisionHurt(game, rootingInterest) {
  const outcome = rootingGameOutcome(game, rootingInterest);
  const priority = rootingInterest?.[rootingInterest?.prioritySide];
  return outcome === 'bad' && priority?.raceType === 'division';
}

function RootingGameCallout({ game, rootingInterest, compact = false }) {
  if (!rootingInterest?.hasAny) return null;
  const prioritySide = rootingInterest.prioritySide;
  const priorityInterest = rootingInterest[prioritySide];
  const team = game?.teams?.[prioritySide]?.team;
  if (!priorityInterest || !team) return null;

  const outcome = rootingGameOutcome(game, rootingInterest);
  const tone = outcome === 'good'
    ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100'
    : outcome === 'bad'
      ? 'border-red-400/50 bg-red-500/15 text-red-100'
      : priorityInterest.raceType === 'division'
        ? 'border-orange-400/50 bg-orange-500/15 text-orange-100'
        : 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100';
  const icon = outcome === 'good'
    ? 'fa-thumbs-up'
    : outcome === 'bad'
      ? 'fa-thumbs-down'
      : 'fa-crosshairs';
  const title = outcome === 'good'
    ? `${team.abbreviation} LOST · ${priorityInterest.raceType === 'division' ? 'DIV' : 'WC'} HELP`
    : outcome === 'bad'
      ? `${team.abbreviation} WON · ${priorityInterest.raceType === 'division' ? 'DIV' : 'WC'} HURT`
      : `BEST RESULT: ${team.abbreviation} LOSS`;
  const showDivisionHurtFace = outcome === 'bad' && priorityInterest.raceType === 'division';

  return (
    <div
      className={`scoreboard-watch-callout inline-flex max-w-full items-center gap-1.5 rounded-lg border font-black uppercase tracking-[0.1em] ${tone} ${compact ? 'px-2 py-1 text-[8px]' : 'px-2.5 py-1.5 text-[9px]'}`}
      title={`${priorityInterest.reason}. Priority is based on standings position and record strength.`}
    >
      {showDivisionHurtFace && (
        <img
          src={ROOTING_DIVISION_HURT_FACE_URL}
          className={compact ? 'h-5 w-5 rounded-full object-cover' : 'h-6 w-6 rounded-full object-cover'}
          alt=""
          aria-hidden
        />
      )}
      <i className={`fa-solid ${icon}`} aria-hidden />
      <span className="truncate">{title}</span>
      {rootingInterest.isDual && outcome == null && (
        <span className="rounded bg-black/20 px-1 py-0.5 text-[7px] text-white/65">Both matter</span>
      )}
    </div>
  );
}

function RootingBooMarker({ interest, show = false, flip = false, className = '' }) {
  if (!show || !interest?.isPrimary) return null;
  return (
    <img
      src={ROOTING_BOO_URL}
      className={`scoreboard-watch-boo ${flip ? 'is-flipped' : ''} ${className}`}
      alt=""
      aria-hidden
    />
  );
}

function RootingTeamLogo({
  team,
  interest,
  outcome,
  cheer = false,
  fireworks = false,
  cheerRace = null,
  showBoo = false,
  className,
  alt,
  booFlip = false,
}) {
  if (!interest && !cheer && !fireworks) {
    return (
      <img
        src={teamLogoUrl(team.id)}
        className={`object-contain ${className}`}
        alt={alt ?? team.name ?? ''}
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {booFlip && <RootingBooMarker interest={interest} show={showBoo} flip className="h-8 w-8" />}
      <span
        className={`scoreboard-watch-logo-wrap ${interest ? 'is-watched' : ''} ${cheer ? 'is-cheer-target' : ''} ${fireworks ? 'is-fireworks-target' : ''}`}
        data-race={cheer ? cheerRace || undefined : interest?.raceType || undefined}
        data-outcome={outcome || undefined}
      >
        {fireworks && <ScoreboardFireworks teamId={team.id} />}
        <span className="scoreboard-watch-logo-aura" aria-hidden />
        <img
          src={teamLogoUrl(team.id)}
          className={`relative z-[1] object-contain ${className}`}
          alt={alt ?? team.name ?? ''}
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      </span>
      {!booFlip && <RootingBooMarker interest={interest} show={showBoo} className="h-8 w-8" />}
    </span>
  );
}

export default function Scores() {
  const navigate = useNavigate();
  const location = useLocation();
  const [favoriteTeams, setFavoriteTeams] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]');
    } catch {
      return [];
    }
  });
  const [gamesMap, setGamesMap] = useState({});
  const [gamesErrorMap, setGamesErrorMap] = useState({});
  const gamesCacheRef = useRef({});
  const fetchInflightRef = useRef(new Map());
  const lastResumeRefreshRef = useRef(0);
  const [, setLoadingDates] = useState(() => new Set());
  const [liveCount, setLiveCount] = useState(0);
  const maxDate = useMemo(() => getMaxDate(), []);
  const initialCenter = useMemo(
    () => resolveScoresCenterDate(location.state?.returnDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [dates, setDates] = useState(() => computeDateWindow(initialCenter, getMaxDate()));
  const initialIndex = useMemo(() => {
    const windowDates = computeDateWindow(initialCenter, getMaxDate());
    const idx = windowDates.findIndex((d) => isSameDay(d, initialCenter));
    return idx >= 0 ? idx : 0;
  }, [initialCenter]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [renderIndex, setRenderIndex] = useState(initialIndex);
  const selectedIndexRef = useRef(initialIndex);
  const lastIndexRef = useRef(initialIndex);
  const scrollPrefetchIndexRef = useRef(initialIndex);
  const [isInitialReady, setIsInitialReady] = useState(false);
  const [viewMode, setViewMode] = useState(loadViewMode);
  const [scoreboardLeague, setScoreboardLeague] = useState(loadScoreboardLeague);
  const [expandedCardGamePk, setExpandedCardGamePk] = useState(null);
  const [standingsRecords, setStandingsRecords] = useState([]);
  const [showRootingInterests, setShowRootingInterests] = useState(loadRootingInterestsEnabled);
  const carouselRef = useRef(null);
  const [carouselStartIndex, setCarouselStartIndex] = useState(selectedIndex);
  const returnDateAppliedRef = useRef(false);

  const selectedDate = dates[selectedIndex] ?? startOfDay(new Date());
  const selectedLeague = LEAGUE_LEVEL_BY_VALUE[scoreboardLeague] ?? LEAGUE_LEVEL_BY_VALUE.mlb;
  const favoriteMlbTeamId = useMemo(() => (
    favoriteTeams.map(Number).find((id) => MLB_LEAGUE_ID_BY_TEAM_ID[id])
  ), [favoriteTeams]);
  const rootingInterestByTeamId = useMemo(() => (
    showRootingInterests && scoreboardLeague === 'mlb'
      ? buildRootingInterestMap(standingsRecords, favoriteMlbTeamId)
      : {}
  ), [showRootingInterests, scoreboardLeague, standingsRecords, favoriteMlbTeamId]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const getDateStr = (date) => {
    const d = new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}/${day}/${d.getFullYear()}`;
  };

  const formatDisplayDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getLeagueDateKey = useCallback((date) => (
    `${scoreboardLeague}:${getDateStr(date)}`
  ), [scoreboardLeague]);

  const isToday = (date) => isSameDay(date, new Date());
  const isAtMinDate = isSameDay(selectedDate, MIN_DATE);
  const isAtMaxDate = isSameDay(selectedDate, maxDate);

  const buildGameState = (date, extra = {}) => ({
    returnDate: date.toISOString(),
    ...extra,
  });

  const buildWatchUrl = (gamePk) => (
    `https://www.mlb.com/tv/g${gamePk}?callsign=rsn&affiliateId=GAMEDAY`
  );

  const fetchGamesForDate = useCallback(async (date, { force = false } = {}) => {
    if (!date) return;
    const dateStr = getDateStr(date);
    const cacheKey = getLeagueDateKey(date);

    if (!force && Object.prototype.hasOwnProperty.call(gamesCacheRef.current, cacheKey)) {
      return gamesCacheRef.current[cacheKey];
    }

    const inflight = fetchInflightRef.current.get(cacheKey);
    if (!force && inflight) return inflight;

    setLoadingDates((prev) => new Set(prev).add(cacheKey));
    const request = (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/schedule?${selectedLeague.sportQuery}&date=${dateStr}&hydrate=team(record),linescore,probablePitcher,boxscore,broadcasts(all)`,
        );
        if (!res.ok) throw new Error(`Schedule ${res.status}`);
        const data = await res.json();
        const dayGames = data.dates?.[0]?.games || [];
        gamesCacheRef.current[cacheKey] = dayGames;
        setGamesMap((prev) => ({ ...prev, [cacheKey]: dayGames }));
        setGamesErrorMap((prev) => {
          if (!prev[cacheKey]) return prev;
          const next = { ...prev };
          delete next[cacheKey];
          return next;
        });
        const currentDate = dates[selectedIndexRef.current];
        if (currentDate && isSameDay(date, currentDate)) {
          setLiveCount(dayGames.filter((g) => g.status.abstractGameState === 'Live').length);
        }
        return dayGames;
      } catch (err) {
        console.error(err);
        setGamesErrorMap((prev) => ({ ...prev, [cacheKey]: true }));
        // Do not cache a failed request as "no games"; PWA resumes can briefly
        // fail while the network reconnects, and that should not erase real games.
        return gamesCacheRef.current[cacheKey] ?? [];
      } finally {
        fetchInflightRef.current.delete(cacheKey);
        setLoadingDates((prev) => {
          const next = new Set(prev);
          next.delete(cacheKey);
          return next;
        });
      }
    })();

    fetchInflightRef.current.set(cacheKey, request);
    return request;
  }, [dates, getLeagueDateKey, selectedLeague.sportQuery]);

  const prefetchAroundIndex = useCallback((index, { ahead = 0, behind = 0 } = {}) => {
    const span = 4;
    for (let offset = -span; offset <= span; offset += 1) {
      const i = index + offset;
      if (i >= 0 && i < dates.length) fetchGamesForDate(dates[i]);
    }
    for (let extra = 1; extra <= ahead; extra += 1) {
      const i = index + span + extra;
      if (i < dates.length) fetchGamesForDate(dates[i]);
    }
    for (let extra = 1; extra <= behind; extra += 1) {
      const i = index - span - extra;
      if (i >= 0) fetchGamesForDate(dates[i]);
    }
  }, [dates, fetchGamesForDate]);

  const shouldRenderSlide = useCallback((i) => (
    Math.abs(i - selectedIndex) <= 2 || Math.abs(i - renderIndex) <= 2
  ), [selectedIndex, renderIndex]);

  const applyIndexChange = useCallback((index) => {
    const prev = lastIndexRef.current;
    const direction = index > prev ? 1 : index < prev ? -1 : 0;
    lastIndexRef.current = index;

    setSelectedIndex(index);
    setRenderIndex(index);

    const date = dates[index];
    if (date) {
      const cacheKey = getLeagueDateKey(date);
      const cached = gamesCacheRef.current[cacheKey];
      if (cached) {
        setLiveCount(cached.filter((g) => g.status.abstractGameState === 'Live').length);
      } else {
        fetchGamesForDate(date);
      }
    }

    prefetchAroundIndex(index, {
      ahead: direction >= 0 ? 3 : 0,
      behind: direction <= 0 ? 3 : 0,
    });
  }, [dates, prefetchAroundIndex, fetchGamesForDate, getLeagueDateKey]);

  const handleCarouselSelect = useCallback((index) => {
    applyIndexChange(index);
  }, [applyIndexChange]);

  const handleCarouselSettle = useCallback((index) => {
    setRenderIndex(index);
    lastIndexRef.current = index;
    const date = dates[index];
    if (date) fetchGamesForDate(date);
    prefetchAroundIndex(index, { ahead: 3, behind: 3 });
  }, [dates, fetchGamesForDate, prefetchAroundIndex]);

  const handleCarouselScroll = useCallback((index) => {
    if (scrollPrefetchIndexRef.current === index) return;
    scrollPrefetchIndexRef.current = index;
    prefetchAroundIndex(index, { ahead: 2, behind: 2 });
  }, [prefetchAroundIndex]);

  const goToPrevDay = () => {
    if (selectedIndex > 0) {
      carouselRef.current?.scrollPrev();
      return;
    }
    if (isAtMinDate) return;
    const newStart = addDays(dates[0], -30);
    const clampedStart = newStart < MIN_DATE ? MIN_DATE : newStart;
    if (isSameDay(clampedStart, dates[0])) return;
    const newDates = buildDateRange(clampedStart, dates[dates.length - 1]);
    const shift = newDates.length - dates.length;
    setDates(newDates);
    setSelectedIndex(shift);
    setRenderIndex(shift);
    requestAnimationFrame(() => carouselRef.current?.scrollTo(shift, true));
    prefetchAroundIndex(shift);
  };

  const goToNextDay = () => {
    if (selectedIndex < dates.length - 1) {
      carouselRef.current?.scrollNext();
      return;
    }
    if (isAtMaxDate) return;
    const newEnd = addDays(dates[dates.length - 1], 30);
    const clampedEnd = newEnd > maxDate ? maxDate : newEnd;
    if (isSameDay(clampedEnd, dates[dates.length - 1])) return;
    const newDates = buildDateRange(dates[0], clampedEnd);
    setDates(newDates);
    setRenderIndex(selectedIndex);
    requestAnimationFrame(() => carouselRef.current?.scrollTo(selectedIndex, false));
    prefetchAroundIndex(selectedIndex);
  };

  const handleDatePick = (date) => {
    const picked = startOfDay(date);
    if (picked < MIN_DATE || picked > maxDate) return;

    let nextDates = dates;
    if (picked < dates[0] || picked > dates[dates.length - 1]) {
      nextDates = computeDateWindow(picked, maxDate);
      setDates(nextDates);
    }

    const idx = nextDates.findIndex((d) => isSameDay(d, picked));
    if (idx < 0) return;
    setSelectedIndex(idx);
    setRenderIndex(idx);
    requestAnimationFrame(() => carouselRef.current?.scrollTo(idx, true));
    prefetchAroundIndex(idx);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchGamesForDate(dates[selectedIndex]);
      if (cancelled) return;
      prefetchAroundIndex(selectedIndex);
      setIsInitialReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isToday(selectedDate)) return undefined;
    const interval = setInterval(
      () => fetchGamesForDate(selectedDate, { force: true }),
      liveCount > 0 ? LIVE_SCORES_POLL_MS : TODAY_SCORES_POLL_MS,
    );
    return () => clearInterval(interval);
  }, [selectedDate, fetchGamesForDate, liveCount]);

  useEffect(() => {
    if (!isInitialReady) return undefined;

    const refreshVisibleDate = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastResumeRefreshRef.current < SCOREBOARD_RESUME_REFRESH_DEBOUNCE_MS) return;
      lastResumeRefreshRef.current = now;
      void fetchGamesForDate(selectedDate, { force: true });
      prefetchAroundIndex(selectedIndex, { ahead: 2, behind: 2 });
    };

    document.addEventListener('visibilitychange', refreshVisibleDate);
    window.addEventListener('focus', refreshVisibleDate);
    window.addEventListener('pageshow', refreshVisibleDate);
    return () => {
      document.removeEventListener('visibilitychange', refreshVisibleDate);
      window.removeEventListener('focus', refreshVisibleDate);
      window.removeEventListener('pageshow', refreshVisibleDate);
    };
  }, [fetchGamesForDate, isInitialReady, prefetchAroundIndex, selectedDate, selectedIndex]);

  useEffect(() => {
    if (!ENABLE_SCOREBOARD_ROOTING_INTERESTS || !showRootingInterests || scoreboardLeague !== 'mlb' || !favoriteMlbTeamId) {
      setStandingsRecords([]);
      return undefined;
    }

    const controller = new AbortController();
    const season = selectedDate.getFullYear();
    const dateStr = getDateStr(selectedDate);
    fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&date=${dateStr}&standingsTypes=regularSeason`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Standings ${res.status}`);
        return res.json();
      })
      .then((data) => setStandingsRecords(flattenStandingsRecords(data)))
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('Rooting interest standings failed', err);
        setStandingsRecords([]);
      });

    return () => controller.abort();
  }, [showRootingInterests, scoreboardLeague, favoriteMlbTeamId, selectedDate]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(LEAGUE_LEVEL_STORAGE_KEY, scoreboardLeague);
  }, [scoreboardLeague]);

  useEffect(() => {
    localStorage.setItem(SCOREBOARD_ROOTING_INTERESTS_KEY, String(showRootingInterests));
  }, [showRootingInterests]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== LEAGUE_LEVEL_STORAGE_KEY) return;
      if (LEAGUE_LEVEL_VALUES.has(event.newValue)) setScoreboardLeague(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!isInitialReady) return;
    void fetchGamesForDate(selectedDate, { force: false });
    prefetchAroundIndex(selectedIndex, { ahead: 4, behind: 4 });
    requestAnimationFrame(() => carouselRef.current?.scrollTo(selectedIndex, false));
  }, [scoreboardLeague, isInitialReady, selectedDate, selectedIndex, fetchGamesForDate, prefetchAroundIndex]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SCORES_DATE_KEY, selectedDate.toISOString());
    } catch {
      /* ignore */
    }
  }, [selectedDate]);

  const activeDateKey = getLeagueDateKey(selectedDate);
  const activeGamesSignature = Object.prototype.hasOwnProperty.call(gamesMap, activeDateKey)
    ? String(gamesMap[activeDateKey]?.length ?? 0)
    : 'loading';

  useEffect(() => {
    if (!isInitialReady || activeGamesSignature === 'loading') return undefined;
    const timer = setTimeout(() => {
      const api = carouselRef.current?.emblaApi;
      if (!api) return;
      try {
        if (!api.internalEngine().scrollBody.settled()) return;
      } catch {
        /* ignore */
      }
      api.reInit();
    }, 150);
    return () => clearTimeout(timer);
  }, [activeGamesSignature, viewMode, isInitialReady]);

  useEffect(() => {
    if (!isInitialReady) return undefined;
    const timer = setTimeout(() => {
      prefetchAroundIndex(selectedIndex, { ahead: 4, behind: 4 });
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedIndex, isInitialReady, prefetchAroundIndex]);

  useEffect(() => {
    if (returnDateAppliedRef.current) return;
    const rd = location.state?.returnDate;
    if (!rd) return;
    returnDateAppliedRef.current = true;

    const target = startOfDay(new Date(rd));
    setDates((prev) => {
      const next = (target < prev[0] || target > prev[prev.length - 1])
        ? computeDateWindow(target, maxDate)
        : prev;
      const idx = next.findIndex((d) => isSameDay(d, target));
      if (idx >= 0) {
        queueMicrotask(() => {
          setSelectedIndex(idx);
          setRenderIndex(idx);
          setCarouselStartIndex(idx);
          requestAnimationFrame(() => carouselRef.current?.scrollTo(idx, true));
          prefetchAroundIndex(idx);
        });
      }
      return next;
    });
  }, [location.state?.returnDate, maxDate, prefetchAroundIndex]);

  useEffect(() => {
    // When coming back from TeamPage, favorites may have changed.
    const refreshFav = () => {
      try {
        setFavoriteTeams(JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]'));
      } catch {
        setFavoriteTeams([]);
      }
    };
    refreshFav();
    window.addEventListener('focus', refreshFav);
    return () => window.removeEventListener('focus', refreshFav);
  }, []);

  const sortGames = (games) => [...(games ?? [])].sort((a, b) => {
    const isFav = (g) => {
      const away = g.teams?.away?.team;
      const home = g.teams?.home?.team;
      const awayIds = [Number(away?.id), Number(away?.parentOrgId)].filter(Number.isFinite);
      const homeIds = [Number(home?.id), Number(home?.parentOrgId)].filter(Number.isFinite);
      return [...awayIds, ...homeIds].some((id) => favoriteTeams.includes(id));
    };
    const fa = isFav(a);
    const fb = isFav(b);
    if (fa !== fb) return fa ? -1 : 1;

    const rootingA = gameRootingInterest(a, rootingInterestByTeamId);
    const rootingB = gameRootingInterest(b, rootingInterestByTeamId);
    const ra = rootingA.hasAny;
    const rb = rootingB.hasAny;
    if (ra !== rb) return ra ? -1 : 1;
    if (ra && rb) {
      const threatA = rootingA[rootingA.prioritySide]?.priorityScore ?? 0;
      const threatB = rootingB[rootingB.prioritySide]?.priorityScore ?? 0;
      if (threatA !== threatB) return threatB - threatA;
    }

    const priority = (g) => {
      const state = g.status.abstractGameState;
      if (state === 'Live') return 0;
      if (state === 'Final') return 2;
      return 1; // Preview / Scheduled / Delayed
    };
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;

    if (pa === 1) return new Date(a.gameDate) - new Date(b.gameDate);
    return 0;
  });

  const renderExpandedLinescore = (game, { isFinal }) => {
    const ls = game.linescore;
    if (!ls?.innings?.length) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-3 text-xs text-slate-500">
          Line score will appear when game data is available.
        </div>
      );
    }

    const inningCount = Math.max(9, ...ls.innings.map((inning) => Number(inning.num) || 0));
    const inningNums = Array.from({ length: inningCount }, (_, index) => index + 1);
    const inningByNum = new Map(ls.innings.map((inning) => [Number(inning.num), inning]));
    const away = game.teams.away;
    const home = game.teams.home;
    const awayScore = Number(away.score ?? 0);
    const homeScore = Number(home.score ?? 0);
    const homeWalkoffOrNoBottom = isFinal && homeScore > awayScore;

    const inningRun = (side, inningNum) => {
      const inning = inningByNum.get(inningNum);
      const runs = inning?.[side]?.runs;
      if (side === 'home' && inningNum === 9 && runs == null && homeWalkoffOrNoBottom) return 'X';
      return runs ?? '';
    };

    const total = (side, key, fallback) => ls.teams?.[side]?.[key] ?? fallback ?? 0;
    const lineGridStyle = {
      gridTemplateColumns: `1.9rem repeat(${inningNums.length}, minmax(0, 1fr)) 0.35rem 1.35rem 1.35rem 1.35rem`,
    };
    const rowClass = 'grid items-center gap-1';

    return (
      <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/25 px-2 py-3 sm:px-3">
        <div className="w-full space-y-2 font-mono text-[11px] tabular-nums sm:text-xs">
          <div className={`${rowClass} text-center text-[10px] font-bold text-slate-500 sm:text-xs`} style={lineGridStyle}>
            <span />
            {inningNums.map((num) => <span key={num}>{num}</span>)}
            <span />
            <span className="text-slate-300">R</span>
            <span className="text-slate-300">H</span>
            <span className="text-slate-300">E</span>
          </div>
          {[
            { side: 'away', team: away.team, score: awayScore },
            { side: 'home', team: home.team, score: homeScore },
          ].map(({ side, team, score }) => (
            <div key={side} className={`${rowClass} text-center text-slate-200`} style={lineGridStyle}>
              <span className="text-left font-black text-white">{team.abbreviation}</span>
              {inningNums.map((num) => <span key={num}>{inningRun(side, num)}</span>)}
              <span className="h-7 border-l border-slate-700/80" />
              <span className="font-black text-white">{score}</span>
              <span>{total(side, 'hits')}</span>
              <span>{total(side, 'errors')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderExpandedCardActions = (game, date) => {
    const linkBase = 'flex-1 rounded-xl px-3 py-2 text-center text-sm font-black text-blue-400 transition-colors hover:bg-slate-800/70 hover:text-blue-300';
    const gameState = buildGameState(date);

    return (
      <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/game/${game.gamePk}`, { state: gameState });
          }}
          className={linkBase}
        >
          Gameday
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/game/${game.gamePk}`, { state: buildGameState(date, { activeTab: 'boxscore' }) });
          }}
          className={linkBase}
        >
          Box
        </button>
        <a
          href={buildWatchUrl(game.gamePk)}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className={linkBase}
        >
          Watch
        </a>
      </div>
    );
  };

  const renderGamesForDate = (date, { isActive = false, isAdjacent = false } = {}) => {
    const dateKey = getLeagueDateKey(date);
    const hasLoaded = Object.prototype.hasOwnProperty.call(gamesMap, dateKey);
    const hasLoadError = Boolean(gamesErrorMap[dateKey]);
    const games = gamesMap[dateKey];
    const sortedGames = sortGames(games ?? []);

    if (!hasLoaded) {
      if (!isActive && !isAdjacent) {
        return <div className="min-h-[1px]" aria-hidden />;
      }
      if (hasLoadError) {
        return (
          <div className="border border-dashed border-red-500/40 rounded-3xl p-8 text-center">
            <div className="text-sm font-bold text-red-200">Could not refresh games.</div>
            <div className="mt-1 text-xs text-slate-500">Your connection may still be waking up. Try again in a second.</div>
            <button
              type="button"
              onClick={() => fetchGamesForDate(date, { force: true })}
              className="mt-4 rounded-full border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:border-slate-500"
            >
              Retry
            </button>
          </div>
        );
      }
      return <LoadingSpinner size="lg" py="py-12" />;
    }

    if (!games?.length) {
      return (
        <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
          No games scheduled for this date.
        </div>
      );
    }

    if (viewMode === 'list') {
      return (
        <div className="divide-y divide-slate-800/60">
          {sortedGames.map((game) => {
            const rootingInterest = gameRootingInterest(game, rootingInterestByTeamId);
            return (
              <ScoresListGameRow
                key={game.gamePk}
                game={game}
                noHitAlerts={getNoHitAlert(game)}
                rootingInterest={rootingInterest}
                onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: date.toISOString() } })}
                onAwayTeamClick={() => navigate(`/team/${game.teams.away.team.id}`)}
                onHomeTeamClick={() => navigate(`/team/${game.teams.home.team.id}`)}
              />
            );
          })}
        </div>
      );
    }

    if (viewMode === 'grid') {
      const formatGridStartTime = (gameDate) => (
        gameDate
          ? new Date(gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '—'
      );

      const renderGridStatusCorner = (game, { isLive, isFinal, isDelayed, isPostponed }) => {
        if (isLive) {
          if (game.linescore) {
            return (
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-white font-mono tracking-wide leading-none pt-0.5">
                  {formatLiveInningLabel(game.linescore)}
                </span>
                <div className="flex flex-col items-center gap-0.5">
                  <BaseDiamondIndicator
                    {...getRunnersOnBase(game.linescore)}
                    size="xs"
                  />
                  <OutsIndicator outs={game.linescore.outs ?? 0} size="xs" />
                </div>
              </div>
            );
          }
          return (
            <span className="text-[11px] font-bold text-red-400 tracking-wide">LIVE</span>
          );
        }

        if (isPostponed) {
          return <span className="text-[11px] font-bold text-orange-400">PPD</span>;
        }

        if (isDelayed) {
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[11px] font-bold text-yellow-400">DELAYED</span>
              {game.gameDate && (
                <span className="text-[10px] text-slate-500 font-mono">{formatGridStartTime(game.gameDate)}</span>
              )}
            </div>
          );
        }

        if (isFinal) {
          return (
            <span className="text-[11px] font-bold text-slate-500 font-mono tracking-wide">
              {formatFinalStatus(game.linescore)}
            </span>
          );
        }

        return (
          <span className="text-[11px] text-slate-400 font-mono font-semibold">
            {formatGridStartTime(game.gameDate)}
          </span>
        );
      };

      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sortedGames.map((game) => {
            const { isLive, isFinal, isDelayed, isPostponed } = getStatusInfo(game);
            const awayScore = game.teams.away.score ?? 0;
            const homeScore = game.teams.home.score ?? 0;
            const awayWin = isFinal && parseInt(awayScore) > parseInt(homeScore);
            const homeWin = isFinal && parseInt(homeScore) > parseInt(awayScore);
            const awayRec = game.teams.away.leagueRecord;
            const homeRec = game.teams.home.leagueRecord;
            const noHitAlerts = getNoHitAlert(game);
            const rootingInterest = gameRootingInterest(game, rootingInterestByTeamId);
            const priorityInterest = rootingInterest[rootingInterest.prioritySide];
            const watchOutcome = rootingGameOutcome(game, rootingInterest);
            const divisionHurt = isRootingDivisionHurt(game, rootingInterest);
            const finalWildcardHurt = watchOutcome === 'bad' && priorityInterest?.raceType !== 'division';
            const rootingVisualPending = isRootingVisualPending(game);
            const divisionHurtStyle = divisionHurt
              ? { '--rooting-division-hurt-face': `url(${ROOTING_DIVISION_HURT_FACE_URL})` }
              : undefined;

            return (
              <div
                key={game.gamePk}
                onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: date.toISOString() } })}
                data-watch-race={priorityInterest?.raceType || undefined}
                data-watch-outcome={watchOutcome || undefined}
                data-watch-dual={rootingInterest.isDual || undefined}
                data-watch-division-hurt={divisionHurt || undefined}
                style={divisionHurtStyle}
                className={[
                  'relative overflow-hidden bg-slate-900 border rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.97]',
                  rootingInterest.hasAny ? 'scoreboard-watch-game' : '',
                  rootingInterest.hasAny
                    ? 'border-transparent hover:-translate-y-0.5'
                    : 'border-slate-800 hover:border-slate-600',
                ].join(' ')}
              >
                {rootingInterest.hasAny && <span className="scoreboard-watch-atmosphere" aria-hidden />}
                <div className="relative z-[1] flex justify-between items-start gap-2 mb-3 min-h-[2rem]">
                  <div className="min-w-0">
                    {renderGridStatusCorner(game, { isLive, isFinal, isDelayed, isPostponed })}
                    {rootingInterest.hasAny && (
                      <div className="mt-1.5">
                        <RootingGameCallout game={game} rootingInterest={rootingInterest} compact />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row items-end gap-1 flex-shrink-0">
                    <NationalBroadcastIcons game={game} compact />
                    {noHitAlerts?.map((a) => (
                      <span key={a.side} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        {a.label}
                      </span>
                    ))}
                    {isLive && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-red-400 font-bold">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" /> LIVE
                      </span>
                    )}
                    
                  </div>
                </div>

                <div className="relative z-[1] flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RootingTeamLogo
                      team={game.teams.away.team}
                      interest={rootingInterest.away}
                      outcome={rootingInterest.away ? rootingInterestOutcome(game, 'away') : null}
                      cheer={rootingVisualPending && rootingInterest.cheerSide === 'away'}
                      fireworks={watchOutcome === 'good' && rootingInterest.cheerSide === 'away'}
                      cheerRace={priorityInterest?.raceType}
                      showBoo={(rootingVisualPending || finalWildcardHurt) && rootingInterest.away?.isPrimary}
                      className="w-9 h-9 flex-shrink-0"
                      alt=""
                    />
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>
                        {game.teams.away.team.abbreviation}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {awayRec ? `${awayRec.wins}-${awayRec.losses}` : '\u00A0'}
                      </div>
                      <RootingInterestBadge
                        interest={rootingInterest.away}
                        outcome={rootingInterestOutcome(game, 'away')}
                        compact
                      />
                    </div>
                  </div>
                  <span className={`font-display text-3xl leading-none tabular-nums flex-shrink-0 ${awayWin ? 'text-white' : 'text-slate-400'}`}>
                    {(isLive || isFinal) ? (game.teams.away.score ?? 0) : '—'}
                  </span>
                </div>

                <div className="relative z-[1] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RootingTeamLogo
                      team={game.teams.home.team}
                      interest={rootingInterest.home}
                      outcome={rootingInterest.home ? rootingInterestOutcome(game, 'home') : null}
                      cheer={rootingVisualPending && rootingInterest.cheerSide === 'home'}
                      fireworks={watchOutcome === 'good' && rootingInterest.cheerSide === 'home'}
                      cheerRace={priorityInterest?.raceType}
                      showBoo={(rootingVisualPending || finalWildcardHurt) && rootingInterest.home?.isPrimary}
                      className="w-9 h-9 flex-shrink-0"
                      alt=""
                    />
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>
                        {game.teams.home.team.abbreviation}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {homeRec ? `${homeRec.wins}-${homeRec.losses}` : '\u00A0'}
                      </div>
                      <RootingInterestBadge
                        interest={rootingInterest.home}
                        outcome={rootingInterestOutcome(game, 'home')}
                        compact
                      />
                    </div>
                  </div>
                  <span className={`font-display text-3xl leading-none tabular-nums flex-shrink-0 ${homeWin ? 'text-white' : 'text-slate-400'}`}>
                    {(isLive || isFinal) ? (game.teams.home.score ?? 0) : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGames.map((game) => {
          const { isLive, isFinal, isDelayed, isPostponed } = getStatusInfo(game);
          const awayScore = game.teams.away.score ?? 0;
          const homeScore = game.teams.home.score ?? 0;
          const awayWin = isFinal && parseInt(awayScore) > parseInt(homeScore);
          const homeWin = isFinal && parseInt(homeScore) > parseInt(awayScore);
          const noHitAlerts = getNoHitAlert(game);
          const rootingInterest = gameRootingInterest(game, rootingInterestByTeamId);
          const priorityInterest = rootingInterest[rootingInterest.prioritySide];
          const watchOutcome = rootingGameOutcome(game, rootingInterest);
          const divisionHurt = isRootingDivisionHurt(game, rootingInterest);
          const finalWildcardHurt = watchOutcome === 'bad' && priorityInterest?.raceType !== 'division';
          const rootingVisualPending = isRootingVisualPending(game);
          const divisionHurtStyle = divisionHurt
            ? { '--rooting-division-hurt-face': `url(${ROOTING_DIVISION_HURT_FACE_URL})` }
            : undefined;
          const expandedKey = `${dateKey}:${game.gamePk}`;
          const isExpanded = expandedCardGamePk === expandedKey;
          const liveCountLabel = game.linescore
            ? `${game.linescore.balls ?? 0}-${game.linescore.strikes ?? 0}`
            : null;
          const liveOuts = Number(game.linescore?.outs ?? 0);
          const statusBadge = isPostponed ? (
            <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded-lg font-bold">PPD</span>
          ) : isDelayed && !isLive ? (
            <div className="flex flex-col items-start">
              <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-lg font-bold">DELAYED</span>
              {game.gameDate && <span className="text-[9px] text-slate-600 font-mono mt-0.5">{new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
            </div>
          ) : isDelayed ? (
            <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-lg font-bold">DELAYED</span>
          ) : isFinal ? (
            <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-lg">{formatFinalStatus(game.linescore)}</span>
          ) : !isLive ? (
            <span className="text-xs text-slate-500">
              {game.gameDate
                ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : '—'}
            </span>
          ) : null;
          return (
            <div
              key={game.gamePk}
              onClick={() => setExpandedCardGamePk((current) => (current === expandedKey ? null : expandedKey))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setExpandedCardGamePk((current) => (current === expandedKey ? null : expandedKey));
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              data-watch-race={priorityInterest?.raceType || undefined}
              data-watch-outcome={watchOutcome || undefined}
              data-watch-dual={rootingInterest.isDual || undefined}
              data-watch-division-hurt={divisionHurt || undefined}
              style={divisionHurtStyle}
              className={[
                'relative overflow-hidden bg-slate-900 border rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.985]',
                rootingInterest.hasAny ? 'scoreboard-watch-game' : '',
                isExpanded
                  ? `border-${THEME_COLOR}-500/50 shadow-lg shadow-black/20`
                  : rootingInterest.hasAny
                    ? 'border-transparent hover:-translate-y-0.5'
                    : 'border-slate-800 hover:border-slate-600 hover:-translate-y-0.5',
              ].join(' ')}
            >
              {rootingInterest.hasAny && <span className="scoreboard-watch-atmosphere" aria-hidden />}
              <div className="relative z-[1] flex items-center justify-between mb-2">
                <div className="min-w-0">
                  {isLive ? (
                    <span className="inline-flex items-center gap-x-1 text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded-lg font-bold">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" /> LIVE
                    </span>
                  ) : (
                    statusBadge
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <NationalBroadcastIcons game={game} compact />
                  {noHitAlerts?.map((a) => (
                    <span key={a.side} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      {a.label}
                    </span>
                  ))}
                  {isLive ? (
                    game.linescore ? (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-300">
                        <span className="text-red-300">{formatLiveInningLabel(game.linescore)}</span>
                        <BaseDiamondIndicator
                          {...getRunnersOnBase(game.linescore)}
                          size="xs"
                          className="text-white"
                        />
                        {liveCountLabel && <span>{liveCountLabel}</span>}
                        <span className="text-slate-400">
                          {liveOuts} OUT{liveOuts === 1 ? '' : 'S'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-red-400 font-bold">LIVE</span>
                    )
                  ) : null}
                  <i
                    className={`fa-solid fa-chevron-down text-[10px] text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </div>
              </div>
              {rootingInterest.hasAny && (
                <div className="relative z-[1] mb-3">
                  <RootingGameCallout game={game} rootingInterest={rootingInterest} />
                </div>
              )}
              <div className="relative z-[1] flex items-center justify-between mb-2">
                <div className="flex items-center gap-x-2.5">
                  <RootingTeamLogo
                    team={game.teams.away.team}
                    interest={rootingInterest.away}
                    outcome={rootingInterest.away ? rootingInterestOutcome(game, 'away') : null}
                    cheer={rootingVisualPending && rootingInterest.cheerSide === 'away'}
                    fireworks={watchOutcome === 'good' && rootingInterest.cheerSide === 'away'}
                    cheerRace={priorityInterest?.raceType}
                    showBoo={(rootingVisualPending || finalWildcardHurt) && rootingInterest.away?.isPrimary}
                    className="w-8 h-8"
                  />
                  <div>
                    <div className={`font-semibold text-sm ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>{game.teams.away.team.name}</div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      {game.teams.away.team.record ? `${game.teams.away.team.record.wins}-${game.teams.away.team.record.losses}` : ''}
                    </div>
                    <RootingInterestBadge
                      interest={rootingInterest.away}
                      outcome={rootingInterestOutcome(game, 'away')}
                    />
                  </div>
                </div>
                <div className={`font-display text-2xl tabular-nums ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-400'}`}>{game.teams.away.score ?? ''}</div>
              </div>
              <div className="relative z-[1] flex items-center justify-between">
                <div className="flex items-center gap-x-2.5">
                  <RootingTeamLogo
                    team={game.teams.home.team}
                    interest={rootingInterest.home}
                    outcome={rootingInterest.home ? rootingInterestOutcome(game, 'home') : null}
                    cheer={rootingVisualPending && rootingInterest.cheerSide === 'home'}
                    fireworks={watchOutcome === 'good' && rootingInterest.cheerSide === 'home'}
                    cheerRace={priorityInterest?.raceType}
                    showBoo={(rootingVisualPending || finalWildcardHurt) && rootingInterest.home?.isPrimary}
                    className="w-8 h-8"
                  />
                  <div>
                    <div className={`font-semibold text-sm ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>{game.teams.home.team.name}</div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      {game.teams.home.team.record ? `${game.teams.home.team.record.wins}-${game.teams.home.team.record.losses}` : ''}
                    </div>
                    <RootingInterestBadge
                      interest={rootingInterest.home}
                      outcome={rootingInterestOutcome(game, 'home')}
                    />
                  </div>
                </div>
                <div className={`font-display text-2xl tabular-nums ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-400'}`}>{game.teams.home.score ?? ''}</div>
              </div>
              {!isLive && !isFinal && (
                <div className="relative z-[1] mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-600">
                  <span>{compactPlayerName(game.teams.away.probablePitcher)}</span>
                  <span className="text-slate-700">vs</span>
                  <span>{compactPlayerName(game.teams.home.probablePitcher)}</span>
                </div>
              )}
              {isExpanded && (
                <div className="relative z-[1] mt-4 space-y-3" onClick={(event) => event.stopPropagation()}>
                  {renderExpandedLinescore(game, { isFinal })}
                  {renderExpandedCardActions(game, date)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Helpers
  const getStatusInfo = (game) => {
    const state = game.status.abstractGameState;
    const detail = game.status.detailedState || '';
    const coded = game.status.codedGameState || '';
    const isLive = state === 'Live';
    const isFinal = state === 'Final';
    const isDelayed = detail.toLowerCase().includes('delay') || coded === 'D';
    const isPostponed = detail.toLowerCase().includes('postponed') || coded === 'PO';
    return { isLive, isFinal, isDelayed, isPostponed, detail };
  };

  /**
   * Batters reaching via BB + HBP (offense drawn vs opposing pitchers). From boxscore team batting.
   */
  const battingReachViaWalk = (game, offensiveSide) => {
    const b = game.boxscore?.teams?.[offensiveSide]?.teamStats?.batting;
    if (!b) return null;
    const bb = Number(b.baseOnBalls ?? 0);
    const hbp = Number(b.hitByPitch ?? 0);
    return bb + hbp;
  };

  /**
   * Perfect game watch: opposing lineup has 0 hits, 0 walks/HBP, and the fielding team has 0 errors.
   * No-hitter watch: 0 hits but a walk/HBP or a defensive error already occurred.
   *
   * Home pitching vs away bats — use away hits/walks and **home** defensive errors (home fields vs away).
   * Away pitching vs home bats — use home hits/walks and **away** defensive errors.
   */
  const getNoHitAlert = (game) => {
    const ls = game.linescore;
    if (!ls || game.status.abstractGameState !== 'Live') return null;
    const inning = ls.currentInning || 0;
    if (inning < 4) return null;

    const awayHits = ls.teams?.away?.hits ?? 0;
    const homeHits = ls.teams?.home?.hits ?? 0;
    const awayDefErrors = ls.teams?.away?.errors ?? 0;
    const homeDefErrors = ls.teams?.home?.errors ?? 0;

    const awayReach = battingReachViaWalk(game, 'away');
    const homeReach = battingReachViaWalk(game, 'home');

    const alerts = [];

    // Home club pitching — away offense hitless (walks/HBP = runners via “walk”; errors = home defense)
    if (awayHits === 0) {
      const pgEligible =
        awayReach != null &&
        awayReach === 0 &&
        homeDefErrors === 0;
      alerts.push({
        side: 'home',
        type: pgEligible ? 'PG' : 'NH',
        label: pgEligible ? '✨ Perfect game watch' : 'No-hitter',
      });
    }

    // Away club pitching — home offense hitless (errors = away defense)
    if (homeHits === 0) {
      const pgEligible =
        homeReach != null &&
        homeReach === 0 &&
        awayDefErrors === 0;
      alerts.push({
        side: 'away',
        type: pgEligible ? 'PG' : 'NH',
        label: pgEligible ? '✨ Perfect game watch' : 'No-hitter',
      });
    }

    return alerts.length > 0 ? alerts : null;
  };

  return (
    <div className="max-w-7xl mx-auto  sm:px-6  sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between  px-4 sm:px-0 sm:mb-8 gap-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tighter">Scoreboard</h1>
          <p className="text-slate-400 text-sm sm:text-base ">
            {/* Stay up to date with live scores, recaps, and stats for every MLB game. */}
            </p>

          
        </div>
        <LeagueLevelPicker
          value={scoreboardLeague}
          onChange={setScoreboardLeague}
        />
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between mb-5 sm:mb-6  px-4 sm:px-0">
        <div className="flex items-center gap-x-2 sm:gap-x-3">
          <button
            onClick={goToPrevDay}
            disabled={isAtMinDate}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border rounded-2xl transition-all active:scale-95 ${
              isAtMinDate
                ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-chevron-left" />
          </button>

          <div className="relative">
            <DatePicker
              selected={selectedDate}
              onChange={handleDatePick}
              minDate={MIN_DATE}
              maxDate={maxDate}
              todayButton="Today"
              customInput={
                <div className="flex items-center gap-x-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-2xl px-3 sm:px-4 py-2 cursor-pointer transition-all">
                  <i className={`fa-solid fa-calendar text-${THEME_COLOR}-400 text-sm`} />
                  <span className="text-white font-medium text-sm">
                    {formatDisplayDate(selectedDate)}
                  </span>
                  <i className="fa-solid fa-chevron-down text-xs text-slate-500" />
                </div>
              }
              calendarClassName="react-datepicker-custom"
              popperClassName="react-datepicker-popper-custom"
            />
          </div>

          <button
            onClick={goToNextDay}
            disabled={isAtMaxDate}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border rounded-2xl transition-all active:scale-95 ${
              isAtMaxDate
                ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>

      {/* Games Grid */}
      <div>
        {/* Row: label + view mode toggle */}
        <div className="flex items-center justify-between mb-4 px-1  px-4 sm:px-0">
          <div className="font-semibold flex items-center gap-x-2">
            <button
              type="button"
              onClick={() => setShowRootingInterests((enabled) => !enabled)}
              disabled={!ENABLE_SCOREBOARD_ROOTING_INTERESTS || scoreboardLeague !== 'mlb'}
              aria-pressed={showRootingInterests}
              title={showRootingInterests ? 'Hide scoreboard watch hints' : 'Show scoreboard watch hints'}
              className={[
                'inline-flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-90',
                showRootingInterests
                  ? 'bg-amber-400/12 text-amber-300 ring-1 ring-amber-400/35 shadow-lg shadow-amber-950/20'
                  : `text-${THEME_COLOR}-400 hover:bg-slate-800/70 hover:text-${THEME_COLOR}-300`,
                scoreboardLeague !== 'mlb' ? 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-500' : '',
              ].join(' ')}
            >
              <i className="fa-solid fa-baseball-ball" aria-hidden />
              <span className="sr-only">Toggle scoreboard watch hints</span>
            </button>
            {isToday(selectedDate)
              ? `Today's ${selectedLeague.label} Games`
              : `${selectedLeague.label} games on ${formatDisplayDate(selectedDate)}`}
          </div>
          <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 gap-0.5 ">
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              size="xs"
              rounded="xl"
              optionClassName="w-8 h-8"
              options={[
                { value: 'card', icon: 'fa-th-large', title: 'Cards' },
                { value: 'list', icon: 'fa-list', title: 'List' },
                { value: 'grid', icon: 'fa-th', title: 'Grid' },
              ]}
            />
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-3 px-1 hidden sm:block">
          Swipe left or right to change days
        </p>

        {!isInitialReady ? (
          <LoadingSpinner size="lg" py="py-12" />
        ) : (
          <SwipeableCarousel
            ref={carouselRef}
            startIndex={carouselStartIndex}
            selectedIndex={selectedIndex}
            onSelectedIndexChange={handleCarouselSelect}
            onSettledIndexChange={handleCarouselSettle}
            onScrollIndexChange={handleCarouselScroll}
            hideUntilReady
            autoHeight
            reinitDeps={`${viewMode}-${scoreboardLeague}`}
            scrollDuration={32}
            slideGap={20}
            showArrows={false}
            showDots={false}
          >
            {dates.map((date, i) => {
              const offsetFromSelected = Math.abs(i - selectedIndex);
              const offsetFromRender = Math.abs(i - renderIndex);
              const nearest = Math.min(offsetFromSelected, offsetFromRender);
              const isActive = nearest === 0;
              const isAdjacent = nearest === 1 || nearest === 2;
              return (
                <div key={getDateStr(date)} className="w-full">
                  {shouldRenderSlide(i)
                    ? renderGamesForDate(date, { isActive, isAdjacent })
                    : <div className="min-h-[1px]" aria-hidden />}
                </div>
              );
            })}
          </SwipeableCarousel>
        )}
      </div>
    </div>
  );
}
