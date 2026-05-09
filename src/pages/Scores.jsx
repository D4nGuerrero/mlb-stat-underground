import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { teamLogoUrl } from '../utils/mlbHelpers';

export default function GameDay() {
  const navigate = useNavigate();
  const location = useLocation();
  const [favoriteTeams, setFavoriteTeams] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]');
    } catch {
      return [];
    }
  });
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => {
    const rd = location.state?.returnDate;
    return rd ? new Date(rd) : new Date();
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'list' | 'grid'

  // Touch swipe tracking
  const touchStartX = useRef(null);

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

  const changeDay = (offset, base = selectedDate) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return;
    setSelectedDate(d);
    loadGames(false, d);
  };

  const isToday = (date) => {
    const d = new Date(date);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const loadGames = async (manual = false, dateToUse = null) => {
    if (manual) {
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 600);
    }

    try {
      const dateToFetch = dateToUse || selectedDate;
      const dateStr = getDateStr(dateToFetch);
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}&hydrate=team(record),linescore,probablePitcher,boxscore`,
      );
      const data = await res.json();
      const dayGames = data.dates?.[0]?.games || [];
      setGames(dayGames);
      setLiveCount(dayGames.filter((g) => g.status.abstractGameState === 'Live').length);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    const interval = setInterval(() => loadGames(), 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Sort: Live → Upcoming → Final
  const sortedGames = [...games].sort((a, b) => {
    const priority = (g) => {
      const state = g.status.abstractGameState;
      if (state === 'Live') return 0;
      if (state === 'Final') return 2;
      return 1; // Preview / Scheduled / Delayed
    };
    const pa = priority(a), pb = priority(b);
    if (pa !== pb) return pa - pb;

    // Favorite teams first (within same bucket)
    const isFav = (g) => {
      const awayId = g.teams?.away?.team?.id;
      const homeId = g.teams?.home?.team?.id;
      return favoriteTeams.includes(awayId) || favoriteTeams.includes(homeId);
    };
    const fa = isFav(a), fb = isFav(b);
    if (fa !== fb) return fa ? -1 : 1;

    // Within upcoming, sort by time
    if (pa === 1) return new Date(a.gameDate) - new Date(b.gameDate);
    return 0;
  });

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
    if (inning < 2) return null;

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
        label: pgEligible ? '✨ Perfect game watch' : '🚫 No-hitter watch',
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
        label: pgEligible ? '✨ Perfect game watch' : '🚫 No-hitter watch',
      });
    }

    return alerts.length > 0 ? alerts : null;
  };

  // Swipe handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) {
      // swipe left → next day
      if (!isToday(selectedDate)) changeDay(1);
    } else {
      // swipe right → previous day
      changeDay(-1);
    }
  };

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tighter">Scores</h1>
          <p className="text-slate-400 text-sm sm:text-base">Real-time MLB scores — click a game to dive in</p>
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-2 text-sm px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 live-pulse" />
            {liveCount} Live
          </div>
        )}
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <div className="flex items-center gap-x-2 sm:gap-x-3">
          <button
            onClick={() => changeDay(-1)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>

          <div className="relative">
            <DatePicker
              selected={selectedDate}
              onChange={(date) => {
                setSelectedDate(date);
                loadGames(false, date);
              }}
              minDate={new Date('2024-03-01')}
              maxDate={new Date()}
              todayButton="Today"
              customInput={
                <div className="flex items-center gap-x-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-2xl px-3 sm:px-4 py-2 cursor-pointer transition-all">
                  <i className="fa-solid fa-calendar text-emerald-400 text-sm" />
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
            onClick={() => changeDay(1)}
            disabled={isToday(selectedDate)}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border rounded-2xl transition-all active:scale-95 ${
              isToday(selectedDate)
                ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>

        <button
          onClick={() => loadGames(true)}
          className="flex items-center gap-x-1.5 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-2xl text-slate-400 hover:text-slate-200 transition-all active:scale-[0.985]"
        >
          <i className={`fa-solid fa-rotate text-xs ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">Refresh</span>
        </button>
      </div>

      {/* Games Grid */}
      <div>
        {/* Row: label + view mode toggle */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="font-semibold flex items-center gap-x-2">
            <i className="fa-solid fa-baseball-ball text-emerald-400" />
            {isToday(selectedDate)
              ? "Today's Games"
              : `Games on ${formatDisplayDate(selectedDate)}`}
          </div>
          <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 gap-0.5">
            {[
              { key: 'card', icon: 'fa-th-large', title: 'Cards' },
              { key: 'list', icon: 'fa-list',     title: 'List'  },
              { key: 'grid', icon: 'fa-th',        title: 'Grid'  },
            ].map(({ key, icon, title }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                title={title}
                className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs transition-all ${viewMode === key ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                <i className={`fa-solid ${icon}`} />
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : games.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-500">
            No games scheduled for this date.
          </div>
        ) : viewMode === 'list' ? (
          /* ── LIST VIEW — MLB-style: logo | score | status | score | logo ── */
          <div className="divide-y divide-slate-800/60">
            {sortedGames.map((game) => {
              const { isLive, isFinal, isDelayed, isPostponed } = getStatusInfo(game);
              const isPreview = !isFinal && !isLive;
              const awayScore = parseInt(game.teams.away.score ?? 0);
              const homeScore = parseInt(game.teams.home.score ?? 0);
              const awayWin = isFinal && awayScore > homeScore;
              const homeWin = isFinal && homeScore > awayScore;
              const awayRec = game.teams.away.leagueRecord;
              const homeRec = game.teams.home.leagueRecord;
              const noHitAlerts = getNoHitAlert(game);
              return (
                <div
                  key={game.gamePk}
                  onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: selectedDate.toISOString() } })}
                  className="flex items-center px-4 py-4 cursor-pointer hover:bg-slate-800/30 active:bg-slate-800/40 transition-colors gap-2"
                >
                  {/* Away team */}
                  <div className="flex flex-col items-center gap-1 w-[64px] flex-shrink-0">
                    <img
                      src={teamLogoUrl(game.teams.away.team.id)}
                      className="w-14 h-14 object-contain"
                      alt={game.teams.away.team.abbreviation}
                      onClick={(e) => { e.stopPropagation(); navigate(`/team/${game.teams.away.team.id}`); }}
                    />
                    {awayRec && (
                      <span className="text-[10px] text-slate-500 font-mono">{awayRec.wins}-{awayRec.losses}</span>
                    )}
                  </div>

                  {/* Away score */}
                  {!isPreview && (
                    <span className={`font-display text-5xl tabular-nums leading-none mx-1 flex-shrink-0 ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}>
                      {awayScore}
                    </span>
                  )}

                  {/* Center status */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 px-1 gap-1">
                    {isPostponed ? (
                      <span className="text-[10px] font-bold text-orange-400 tracking-widest">PPD</span>
                    ) : isDelayed && isLive ? (
                      <>
                        <span className="text-[10px] font-bold text-yellow-400 tracking-wide">DELAYED</span>
                        {game.linescore && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            {game.linescore.inningHalf === 'Top' ? '▲' : '▼'}{game.linescore.currentInning}
                          </span>
                        )}
                      </>
                    ) : isDelayed ? (
                      <>
                        <span className="text-[10px] font-bold text-yellow-400 tracking-wide">DELAYED</span>
                        {game.gameDate && (
                          <span className="text-[9px] text-slate-600 font-mono">
                            {new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </>
                    ) : isLive ? (
                      <>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-400">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" />LIVE
                        </span>
                        {game.linescore && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {game.linescore.inningHalf === 'Top' ? '▲' : '▼'}{game.linescore.currentInning}
                          </span>
                        )}
                      </>
                    ) : isFinal ? (
                      <span className="text-xs font-bold text-slate-400 tracking-widest">FINAL</span>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold">
                        {game.gameDate
                          ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : '—'}
                      </span>
                    )}
                    {isPreview && !isPostponed && (
                      <div className="text-[10px] text-slate-600">
                        {game.teams.away.team.abbreviation} @ {game.teams.home.team.abbreviation}
                      </div>
                    )}
                    {noHitAlerts?.map((a) => (
                      <span key={a.side} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        {a.label}
                      </span>
                    ))}
                  </div>

                  {/* Home score */}
                  {!isPreview && (
                    <span className={`font-display text-5xl tabular-nums leading-none mx-1 flex-shrink-0 ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-white'}`}>
                      {homeScore}
                    </span>
                  )}

                  {/* Home team */}
                  <div className="flex flex-col items-center gap-1 w-[64px] flex-shrink-0">
                    <img
                      src={teamLogoUrl(game.teams.home.team.id)}
                      className="w-14 h-14 object-contain"
                      alt={game.teams.home.team.abbreviation}
                      onClick={(e) => { e.stopPropagation(); navigate(`/team/${game.teams.home.team.id}`); }}
                    />
                    {homeRec && (
                      <span className="text-[10px] text-slate-500 font-mono">{homeRec.wins}-{homeRec.losses}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW — 2-col mobile, 3-col lg ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sortedGames.map((game) => {
              const { isLive, isFinal, isDelayed, isPostponed } = getStatusInfo(game);
              const awayScore = game.teams.away.score ?? 0;
              const homeScore = game.teams.home.score ?? 0;
              const awayWin = isFinal && parseInt(awayScore) > parseInt(homeScore);
              const homeWin = isFinal && parseInt(homeScore) > parseInt(awayScore);
              const noHitAlerts = getNoHitAlert(game);
              return (
                <div
                  key={game.gamePk}
                  onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: selectedDate.toISOString() } })}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.97]"
                >
                  {/* Status badge */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-1 flex-wrap">
                      {noHitAlerts?.map((a) => (
                        <span key={a.side} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          {a.label}
                        </span>
                      ))}
                    </div>
                    {isPostponed ? (
                      <span className="text-[10px] font-bold text-orange-400">PPD</span>
                    ) : isDelayed && !isLive ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-yellow-400">DELAYED</span>
                        {game.gameDate && <span className="text-[9px] text-slate-600 font-mono">{new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                      </div>
                    ) : isDelayed ? (
                      <span className="text-[10px] font-bold text-yellow-400">DELAYED</span>
                    ) : isLive ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-red-400">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" /> LIVE
                      </span>
                    ) : isFinal ? (
                      <span className="text-[10px] text-slate-500">FINAL</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {game.gameDate ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                      </span>
                    )}
                  </div>
                  {/* Away */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <img src={teamLogoUrl(game.teams.away.team.id)} className="w-6 h-6 object-contain" alt="" onError={(e) => (e.target.style.display = 'none')} />
                      <span className={`text-xs font-medium truncate max-w-[70px] ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-300'}`}>
                        {game.teams.away.team.name?.split(' ').pop()}
                      </span>
                    </div>
                    <span className={`font-mono text-sm tabular-nums font-bold ${awayWin ? 'text-white' : 'text-slate-400'}`}>
                      {(isLive || isFinal) ? (game.teams.away.score ?? 0) : '—'}
                    </span>
                  </div>
                  {/* Home */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <img src={teamLogoUrl(game.teams.home.team.id)} className="w-6 h-6 object-contain" alt="" onError={(e) => (e.target.style.display = 'none')} />
                      <span className={`text-xs font-medium truncate max-w-[70px] ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-300'}`}>
                        {game.teams.home.team.name?.split(' ').pop()}
                      </span>
                    </div>
                    <span className={`font-mono text-sm tabular-nums font-bold ${homeWin ? 'text-white' : 'text-slate-400'}`}>
                      {(isLive || isFinal) ? (game.teams.home.score ?? 0) : '—'}
                    </span>
                  </div>
                  {/* Live situation */}
                  {isLive && game.linescore && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono text-center">
                      {game.linescore.inningHalf === 'Top' ? '▲' : '▼'}{game.linescore.currentInningOrdinal} · {game.linescore.outs ?? 0}out
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── CARD VIEW (default) ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedGames.map((game) => {
              const { isLive, isFinal, isDelayed, isPostponed } = getStatusInfo(game);
              const awayScore = game.teams.away.score ?? 0;
              const homeScore = game.teams.home.score ?? 0;
              const awayWin = isFinal && parseInt(awayScore) > parseInt(homeScore);
              const homeWin = isFinal && parseInt(homeScore) > parseInt(awayScore);
              const noHitAlerts = getNoHitAlert(game);

              return (
                <div
                  key={game.gamePk}
                  onClick={() => navigate(`/game/${game.gamePk}`, { state: { returnDate: selectedDate.toISOString() } })}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-[0.985]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-slate-600 truncate">
                      {game.venue?.name}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {noHitAlerts?.map((a) => (
                        <span key={a.side} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          {a.label}
                        </span>
                      ))}
                      {isPostponed ? (
                        <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded-lg font-bold">PPD</span>
                      ) : isDelayed && !isLive ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-lg font-bold">DELAYED</span>
                          {game.gameDate && <span className="text-[9px] text-slate-600 font-mono mt-0.5">{new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                        </div>
                      ) : isDelayed ? (
                        <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-lg font-bold">DELAYED</span>
                      ) : isLive ? (
                        <span className="inline-flex items-center gap-x-1 text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-pulse" /> LIVE
                        </span>
                      ) : isFinal ? (
                        <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-lg">FINAL</span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {game.gameDate
                            ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                            : '—'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Away */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-x-2.5">
                      <img
                        src={teamLogoUrl(game.teams.away.team.id)}
                        className="w-8 h-8 object-contain"
                        alt={game.teams.away.team.name}
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                      <div>
                        <div className={`font-semibold text-sm ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>
                          {game.teams.away.team.name}
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono">
                          {game.teams.away.team.record
                            ? `${game.teams.away.team.record.wins}-${game.teams.away.team.record.losses}`
                            : ''}
                        </div>
                      </div>
                    </div>
                    <div className={`font-display text-2xl tabular-nums ${awayWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-400'}`}>
                      {game.teams.away.score ?? ''}
                    </div>
                  </div>

                  {/* Home */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2.5">
                      <img
                        src={teamLogoUrl(game.teams.home.team.id)}
                        className="w-8 h-8 object-contain"
                        alt={game.teams.home.team.name}
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                      <div>
                        <div className={`font-semibold text-sm ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-200'}`}>
                          {game.teams.home.team.name}
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono">
                          {game.teams.home.team.record
                            ? `${game.teams.home.team.record.wins}-${game.teams.home.team.record.losses}`
                            : ''}
                        </div>
                      </div>
                    </div>
                    <div className={`font-display text-2xl tabular-nums ${homeWin ? 'text-white' : isFinal ? 'text-slate-400' : 'text-slate-400'}`}>
                      {game.teams.home.score ?? ''}
                    </div>
                  </div>

                  {/* Linescore mini */}
                  {isLive && game.linescore && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {game.linescore.inningHalf === 'Top' ? '▲' : '▼'}{' '}
                        {game.linescore.currentInningOrdinal}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {game.linescore.balls ?? 0}-{game.linescore.strikes ?? 0} · {game.linescore.outs ?? 0} out
                      </span>
                    </div>
                  )}

                  {/* Probable pitchers (scheduled games) */}
                  {!isLive && !isFinal && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-600">
                      <span>{game.teams.away.probablePitcher?.fullName?.split(' ').pop() ?? '—'}</span>
                      <span className="text-slate-700">vs</span>
                      <span>{game.teams.home.probablePitcher?.fullName?.split(' ').pop() ?? '—'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
