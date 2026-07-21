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
import { SegmentedControl, SwipeableCarousel, LoadingSpinner } from '../components/ui';
import { LeagueLevelPicker } from '../components/LeagueLevelPicker';
import { LEAGUE_LEVEL_BY_VALUE, LEAGUE_LEVEL_STORAGE_KEY, LEAGUE_LEVEL_VALUES } from '../constants/leagueLevels.js';

const MIN_DATE = new Date('2024-03-01');
const WINDOW_PAST = 60;
const FUTURE_DAYS = 180;
const LIVE_SCORES_POLL_MS = 10_000;
const TODAY_SCORES_POLL_MS = 30_000;

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

const computeDateWindow = (center, maxDate) => {
  const start = addDays(center, -WINDOW_PAST);
  const clampedStart = start < MIN_DATE ? MIN_DATE : start;
  const end = addDays(center, FUTURE_DAYS);
  const clampedEnd = end > maxDate ? maxDate : end;
  return buildDateRange(clampedStart, clampedEnd);
};

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
  const gamesCacheRef = useRef({});
  const fetchInflightRef = useRef(new Map());
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
  const carouselRef = useRef(null);
  const [carouselStartIndex, setCarouselStartIndex] = useState(selectedIndex);
  const returnDateAppliedRef = useRef(false);

  const selectedDate = dates[selectedIndex] ?? startOfDay(new Date());
  const selectedLeague = LEAGUE_LEVEL_BY_VALUE[scoreboardLeague] ?? LEAGUE_LEVEL_BY_VALUE.mlb;

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
          `https://statsapi.mlb.com/api/v1/schedule?${selectedLeague.sportQuery}&date=${dateStr}&hydrate=team(record),linescore,probablePitcher,boxscore`,
        );
        const data = await res.json();
        const dayGames = data.dates?.[0]?.games || [];
        gamesCacheRef.current[cacheKey] = dayGames;
        setGamesMap((prev) => ({ ...prev, [cacheKey]: dayGames }));
        const currentDate = dates[selectedIndexRef.current];
        if (currentDate && isSameDay(date, currentDate)) {
          setLiveCount(dayGames.filter((g) => g.status.abstractGameState === 'Live').length);
        }
        return dayGames;
      } catch (err) {
        console.error(err);
        gamesCacheRef.current[cacheKey] = [];
        setGamesMap((prev) => ({ ...prev, [cacheKey]: [] }));
        return [];
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
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(LEAGUE_LEVEL_STORAGE_KEY, scoreboardLeague);
  }, [scoreboardLeague]);

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
    const games = gamesMap[dateKey];
    const sortedGames = sortGames(games ?? []);

    if (!hasLoaded) {
      if (!isActive && !isAdjacent) {
        return <div className="min-h-[1px]" aria-hidden />;
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
          {sortedGames.map((game) => (
            <ScoresListGameRow
              key={game.gamePk}
              game={game}
              noHitAlerts={getNoHitAlert(game)}
              onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: date.toISOString() } })}
              onAwayTeamClick={() => navigate(`/team/${game.teams.away.team.id}`)}
              onHomeTeamClick={() => navigate(`/team/${game.teams.home.team.id}`)}
            />
          ))}
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

            return (
              <div
                key={game.gamePk}
                onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: date.toISOString() } })}
                className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-3.5 cursor-pointer transition-all active:scale-[0.97]"
              >
                <div className="flex justify-between items-start gap-2 mb-3 min-h-[2rem] j">
                  <div className="min-w-0">
                    {renderGridStatusCorner(game, { isLive, isFinal, isDelayed, isPostponed })}
                  </div>
                  <div className="flex flex-row items-end gap-1 flex-shrink-0">
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

                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={teamLogoUrl(game.teams.away.team.id)}
                      className="w-9 h-9 object-contain flex-shrink-0"
                      alt=""
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>
                        {game.teams.away.team.abbreviation}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {awayRec ? `${awayRec.wins}-${awayRec.losses}` : '\u00A0'}
                      </div>
                    </div>
                  </div>
                  <span className={`font-display text-3xl leading-none tabular-nums flex-shrink-0 ${awayWin ? 'text-white' : 'text-slate-400'}`}>
                    {(isLive || isFinal) ? (game.teams.away.score ?? 0) : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={teamLogoUrl(game.teams.home.team.id)}
                      className="w-9 h-9 object-contain flex-shrink-0"
                      alt=""
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>
                        {game.teams.home.team.abbreviation}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {homeRec ? `${homeRec.wins}-${homeRec.losses}` : '\u00A0'}
                      </div>
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
              className={[
                'bg-slate-900 border rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.985]',
                isExpanded
                  ? `border-${THEME_COLOR}-500/50 shadow-lg shadow-black/20`
                  : 'border-slate-800 hover:border-slate-600 hover:-translate-y-0.5',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-3">
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-x-2.5">
                  <img src={teamLogoUrl(game.teams.away.team.id)} className="w-8 h-8 object-contain" alt={game.teams.away.team.name} onError={(e) => (e.target.style.display = 'none')} />
                  <div>
                    <div className={`font-semibold text-sm ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>{game.teams.away.team.name}</div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      {game.teams.away.team.record ? `${game.teams.away.team.record.wins}-${game.teams.away.team.record.losses}` : ''}
                    </div>
                  </div>
                </div>
                <div className={`font-display text-2xl tabular-nums ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-400'}`}>{game.teams.away.score ?? ''}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2.5">
                  <img src={teamLogoUrl(game.teams.home.team.id)} className="w-8 h-8 object-contain" alt={game.teams.home.team.name} onError={(e) => (e.target.style.display = 'none')} />
                  <div>
                    <div className={`font-semibold text-sm ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>{game.teams.home.team.name}</div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      {game.teams.home.team.record ? `${game.teams.home.team.record.wins}-${game.teams.home.team.record.losses}` : ''}
                    </div>
                  </div>
                </div>
                <div className={`font-display text-2xl tabular-nums ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-400'}`}>{game.teams.home.score ?? ''}</div>
              </div>
              {!isLive && !isFinal && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-600">
                  <span>{compactPlayerName(game.teams.away.probablePitcher)}</span>
                  <span className="text-slate-700">vs</span>
                  <span>{compactPlayerName(game.teams.home.probablePitcher)}</span>
                </div>
              )}
              {isExpanded && (
                <div className="mt-4 space-y-3" onClick={(event) => event.stopPropagation()}>
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
            <i className={`fa-solid fa-baseball-ball text-${THEME_COLOR}-400`} />
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
