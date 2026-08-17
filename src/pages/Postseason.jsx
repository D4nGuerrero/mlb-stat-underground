import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  MapPin,
  Star,
  Trophy,
} from 'lucide-react';
import { Select, LoadingSpinner, SegmentedControl } from '../components/ui';
import TeamLogoImg from '../components/TeamLogoImg';
import { useTheme } from '../context/ThemeContext.jsx';
import { useFavoriteTeams } from '../hooks/useFavoriteTeams';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePostseasonBracket } from '../hooks/usePostseasonBracket';
import { getTeamColorPalette } from '../utils/teamColors';
import { compactPlayerName, formatFinalStatus } from '../utils/mlbHelpers';
import { assetUrl } from '../utils/baseUrl.js';
import {
  CURRENT_CALENDAR_YEAR,
  LEAGUE_META,
  MIN_POSTSEASON_YEAR,
  clampPostseasonYear,
  defaultPostseasonYear,
  formatGameClock,
  formatOfficialDate,
  formatSeriesScore,
  isCompletedGame,
  isIfNecessaryUnplayed,
  isLiveGame,
  postseasonYearOptions,
  seriesInvolvesTeam,
} from '../utils/postseason';

const YEAR_OPTIONS = postseasonYearOptions();

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function surfaceClass(isDark) {
  return isDark
    ? 'border-slate-800 bg-slate-900/80'
    : 'border-slate-200 bg-white shadow-sm';
}

function gamedayState(year, series) {
  return {
    returnTo: `/postseason/${year}/${series.id}`,
    returnLabel: series.shortLabel || 'Series',
  };
}

function YearPicker({ year, onChange, isDark }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-2xl border p-1',
        isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white',
      )}
    >
      <button
        type="button"
        onClick={() => onChange(year - 1)}
        disabled={year <= MIN_POSTSEASON_YEAR}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-30',
          isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100',
        )}
        aria-label="Previous postseason year"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-[7.25rem]">
        <Select
          value={year}
          onChange={onChange}
          options={YEAR_OPTIONS}
          size="sm"
          buttonClassName={cn(
            '!rounded-xl !border-0 !bg-transparent justify-center font-black',
            isDark ? '' : '!text-slate-900',
          )}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(year + 1)}
        disabled={year >= CURRENT_CALENDAR_YEAR}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-30',
          isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100',
        )}
        aria-label="Next postseason year"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function TeamMark({ team, size = 'md', isDark }) {
  const px = size === 'lg' ? 'h-14 w-14 sm:h-16 sm:w-16' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  if (team.placeholder || !team.id) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-full text-[10px] font-black tracking-wide',
          px,
          isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500',
        )}
      >
        {team.abbr?.slice(0, 4) || 'TBD'}
      </span>
    );
  }
  return <TeamLogoImg teamId={team.id} className={`${px} object-contain`} alt={team.name} />;
}

function ChampionBanner({ series, year, isDark }) {
  const winner = series?.winner;
  if (!winner || winner.placeholder) return null;
  const loser = series.teams.find((team) => team.id !== winner.id) ?? series.teams[1];
  const palette = getTeamColorPalette(winner.id);

  return (
    <Link
      to={`/postseason/${year}/${encodeURIComponent(series.id)}`}
      className={cn(
        'group relative block overflow-hidden rounded-3xl border',
        isDark ? 'border-amber-400/30' : 'border-amber-300/80',
      )}
      style={{
        background: `linear-gradient(115deg, #070b14 0%, ${palette.primary}55 42%, ${palette.secondary}33 72%, #070b14 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(251,191,36,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-8 top-0 h-full w-2/5 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12),transparent_70%)]" />

      <div className="relative flex flex-col items-center gap-5 px-4 py-6 sm:flex-row sm:items-center sm:gap-8 sm:px-7 sm:py-7">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-4 rounded-full bg-amber-300/15 blur-2xl" aria-hidden />
          <img
            src={assetUrl('icons/world-series-trophy.png')}
            alt="Commissioner's Trophy"
            className="relative h-36 w-36 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)] sm:h-44 sm:w-44"
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200 ring-1 ring-amber-300/35">
            <Crown size={12} />
            World Champions
          </div>
          <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-100/70">
            {year} World Series
          </div>
          {winner.id && !winner.placeholder && (
            <TeamLogoImg
              teamId={winner.id}
              alt=""
              className="mx-auto mt-3 h-16 w-16 object-contain drop-shadow sm:mx-0 sm:h-20 sm:w-20"
            />
          )}
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-white drop-shadow sm:text-4xl">
            {winner.name}
          </h2>
          {loser && !loser.placeholder && (
            <p className="mt-1.5 text-sm text-white/75">
              defeated the {loser.name}
            </p>
          )}

          <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-white/10">
            <TeamMark team={winner} size="sm" isDark={isDark} />
            <span className="font-display text-2xl font-black tabular-nums text-white">
              {winner.wins}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">–</span>
            <span className="font-display text-2xl font-black tabular-nums text-slate-300">
              {loser?.wins ?? 0}
            </span>
            {loser && <TeamMark team={loser} size="sm" isDark={isDark} />}
          </div>
        </div>
      </div>
    </Link>
  );
}

function LeagueHeading({ league, isDark }) {
  const meta = LEAGUE_META[league];
  if (!meta) return null;
  return (
    <div className="flex items-center gap-2.5 px-0.5 pb-0.5">
      <img
        src={meta.logo}
        alt=""
        className="h-8 w-8 object-contain sm:h-9 sm:w-9"
      />
      <span
        className={cn(
          'font-display text-base font-black tracking-tight sm:text-lg',
          isDark ? 'text-white' : 'text-slate-900',
        )}
      >
        {meta.label}
      </span>
    </div>
  );
}

function SeriesCard({ series, year, isDark, favoriteTeamIds }) {
  const [away, home] = series.teams;
  const isFav = favoriteTeamIds.some((id) => seriesInvolvesTeam(series, id));
  const winnerId = series.winner?.id;
  const score = formatSeriesScore(series);
  const dateLabel = series.startDate
    ? series.endDate && series.endDate !== series.startDate
      ? `${formatOfficialDate(series.startDate)} – ${formatOfficialDate(series.endDate)}`
      : formatOfficialDate(series.startDate)
    : series.hasPlaceholders
      ? 'Matchup TBD'
      : '';

  return (
    <Link
      to={`/postseason/${year}/${encodeURIComponent(series.id)}`}
      className={cn(
        'group block rounded-2xl border p-3.5 transition-all',
        surfaceClass(isDark),
        isFav ? 'ring-1 ring-accent-400/40' : '',
        series.gameType === 'W'
          ? isDark
            ? 'border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-slate-900'
            : 'border-amber-300/80 bg-gradient-to-br from-amber-50 to-white'
          : '',
        isDark ? 'hover:border-slate-600 hover:bg-slate-900' : 'hover:border-slate-300 hover:shadow-md',
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {series.league !== 'WS' && LEAGUE_META[series.league]?.logo && (
            <img
              src={LEAGUE_META[series.league].logo}
              alt=""
              className="h-4 w-4 object-contain opacity-80"
            />
          )}
          {series.gameType === 'W' && <Trophy size={13} className="text-amber-300" />}
          <span className={cn(
            'truncate text-[11px] font-black uppercase tracking-[0.14em]',
            series.gameType === 'W' ? 'text-amber-200' : isDark ? 'text-slate-400' : 'text-slate-500',
          )}
          >
            {series.shortLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {series.live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300 ring-1 ring-red-400/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>
          )}
          {isFav && <Star size={12} className="fill-accent-400 text-accent-400" />}
          {series.complete && !series.hasPlaceholders && (
            <span className={cn(
              'font-display text-sm font-black tabular-nums',
              isDark ? 'text-white' : 'text-slate-900',
            )}
            >
              {score}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {[away, home].map((team) => {
          const isWinner = winnerId && team.id && Number(team.id) === Number(winnerId);
          return (
            <div key={`${series.id}-${team.id ?? team.name}`} className="flex items-center gap-2.5">
              <TeamMark team={team} size="sm" isDark={isDark} />
              <div className="min-w-0 flex-1">
                <div className={cn(
                  'truncate text-sm font-bold',
                  isWinner
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : series.complete
                      ? 'text-slate-500'
                      : isDark ? 'text-slate-200' : 'text-slate-800',
                )}
                >
                  {team.placeholder ? team.name : team.abbr}
                  {isWinner && <span className="ml-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">Won</span>}
                </div>
                {!team.placeholder && team.name !== team.abbr && (
                  <div className="truncate text-[11px] text-slate-500">{team.name}</div>
                )}
              </div>
              <div className={cn(
                'w-5 text-right font-display text-lg font-black tabular-nums',
                isWinner
                  ? isDark ? 'text-white' : 'text-slate-900'
                  : 'text-slate-500',
              )}
              >
                {series.hasPlaceholders && !series.playedCount ? '–' : team.wins}
              </div>
            </div>
          );
        })}
      </div>

      {dateLabel && (
        <div className="mt-2.5 text-[11px] text-slate-500">{dateLabel}</div>
      )}
    </Link>
  );
}

function RoundColumn({ round, year, isDark, favoriteTeamIds, leagueFilter }) {
  const visible = round.series.filter((series) => {
    if (leagueFilter === 'all') return true;
    if (series.league === 'WS') return true;
    return series.league === leagueFilter;
  });
  if (!visible.length) return null;

  const al = visible.filter((series) => series.league === 'AL');
  const nl = visible.filter((series) => series.league === 'NL');
  const other = visible.filter((series) => series.league !== 'AL' && series.league !== 'NL');

  const renderGroup = (leagueKey, items) => {
    if (!items.length) return null;
    return (
      <div className="space-y-2.5">
        {leagueKey && <LeagueHeading league={leagueKey} isDark={isDark} />}
        {items.map((series) => (
          <SeriesCard
            key={series.id}
            series={series}
            year={year}
            isDark={isDark}
            favoriteTeamIds={favoriteTeamIds}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={cn(
          'font-display text-lg font-black tracking-tight',
          isDark ? 'text-white' : 'text-slate-900',
        )}
        >
          {round.label}
        </h3>
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {round.short}
        </span>
      </div>
      <div className="space-y-5">
        {renderGroup('AL', al)}
        {renderGroup('NL', nl)}
        {renderGroup(null, other)}
      </div>
    </section>
  );
}

function SeriesGameRow({ game, isDark, onOpen }) {
  const away = game.teams?.away;
  const home = game.teams?.home;
  const awayTeam = away?.team ?? {};
  const homeTeam = home?.team ?? {};
  const final = isCompletedGame(game);
  const live = isLiveGame(game);
  const ifNec = isIfNecessaryUnplayed(game);
  const postponed = String(game.status?.detailedState ?? '').toLowerCase().includes('postponed');
  const awayScore = Number(away?.score);
  const homeScore = Number(home?.score);
  const awayWin = final && away?.isWinner;
  const homeWin = final && home?.isWinner;
  const clickable = Boolean(game.gamePk) && !ifNec;
  const gameNum = game.seriesGameNumber ?? game.gameNumber;
  const venue = game.venue?.name;
  const decisions = game.decisions;
  const statusLabel = postponed
    ? 'Postponed'
    : ifNec
      ? 'If necessary'
      : live
        ? (game.linescore ? formatFinalStatus(game.linescore).replace('FINAL', 'LIVE') : 'LIVE')
        : final
          ? formatFinalStatus(game.linescore)
          : formatGameClock(game.gameDate) || game.status?.detailedState || 'Scheduled';

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onOpen(game)}
      className={cn(
        'w-full rounded-2xl border px-3 py-3 text-left transition-colors sm:px-4',
        surfaceClass(isDark),
        clickable
          ? isDark
            ? 'hover:border-slate-600 hover:bg-slate-900'
            : 'hover:border-slate-300 hover:shadow-md'
          : 'cursor-default opacity-70',
        live ? 'ring-1 ring-red-400/30' : '',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className={cn(
          'font-black uppercase tracking-[0.14em]',
          isDark ? 'text-slate-400' : 'text-slate-500',
        )}
        >
          Game {gameNum}
          {ifNec ? ' · If necessary' : ''}
        </span>
        <span className={cn(
          'font-bold',
          live ? 'text-red-300' : final ? 'text-slate-500' : 'text-slate-400',
        )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {[{ team: awayTeam, score: awayScore, win: awayWin, rec: away?.leagueRecord }, { team: homeTeam, score: homeScore, win: homeWin, rec: home?.leagueRecord }].map(({ team, score, win, rec }) => (
            <div key={`${game.gamePk}-${team.id ?? team.name}`} className="flex items-center gap-2">
              <TeamMark
                team={{
                  id: team.id,
                  name: team.name,
                  abbr: team.abbreviation,
                  placeholder: team.placeholder,
                }}
                size="sm"
                isDark={isDark}
              />
              <span className={cn(
                'min-w-0 flex-1 truncate text-sm font-bold',
                win
                  ? isDark ? 'text-white' : 'text-slate-900'
                  : final
                    ? 'text-slate-500'
                    : isDark ? 'text-slate-200' : 'text-slate-800',
              )}
              >
                {team.abbreviation || team.name}
              </span>
              {rec && !team.placeholder && (
                <span className="hidden text-[10px] tabular-nums text-slate-500 sm:inline">
                  {rec.wins}-{rec.losses}
                </span>
              )}
              <span className={cn(
                'w-7 text-right font-display text-xl font-black tabular-nums',
                (final || live) && Number.isFinite(score)
                  ? win || live
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : 'text-slate-500'
                  : 'text-slate-600',
              )}
              >
                {(final || live) && Number.isFinite(score) ? score : '–'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {game.officialDate && <span>{formatOfficialDate(game.officialDate)}</span>}
        {venue && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} />
            {venue}
          </span>
        )}
        {final && decisions?.winner && (
          <span>
            WP {compactPlayerName(decisions.winner)}
            {decisions.loser ? ` · LP ${compactPlayerName(decisions.loser)}` : ''}
            {decisions.save ? ` · SV ${compactPlayerName(decisions.save)}` : ''}
          </span>
        )}
      </div>
    </button>
  );
}

function SeriesDetail({ series, year, isDark, favoriteTeamIds, onOpenGame }) {
  const [away, home] = series.teams;
  const winner = series.winner;
  const loser = winner ? series.teams.find((team) => team.id !== winner.id) : null;
  const palette = getTeamColorPalette(winner?.id ?? away?.id);
  const isFav = favoriteTeamIds.some((id) => seriesInvolvesTeam(series, id));

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border px-4 py-5 sm:px-6',
          surfaceClass(isDark),
          series.gameType === 'W' ? (isDark ? 'border-amber-400/25' : 'border-amber-300/70') : '',
        )}
        style={
          winner && !winner.placeholder
            ? { background: `linear-gradient(120deg, ${palette.primary}33, transparent 70%)` }
            : undefined
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {series.league !== 'WS' && LEAGUE_META[series.league]?.logo && (
              <img src={LEAGUE_META[series.league].logo} alt="" className="h-5 w-5 object-contain" />
            )}
            {series.gameType === 'W' && <Trophy size={16} className="text-amber-300" />}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {year} · {series.description}
              </div>
              <h2 className={cn(
                'font-display text-xl font-black tracking-tight sm:text-2xl',
                isDark ? 'text-white' : 'text-slate-900',
              )}
              >
                {series.shortLabel}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {series.live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-300 ring-1 ring-red-400/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                Live
              </span>
            )}
            {isFav && <Star size={14} className="fill-accent-400 text-accent-400" />}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <SeriesHeroTeam team={away} align="right" isDark={isDark} winner={winner} />
          <div className="text-center">
            <div className={cn(
              'font-display text-3xl font-black tabular-nums sm:text-4xl',
              isDark ? 'text-white' : 'text-slate-900',
            )}
            >
              {series.hasPlaceholders && !series.playedCount ? 'vs' : `${away.wins}–${home.wins}`}
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {series.bestOf > 1 ? `Best of ${series.bestOf}` : 'Single game'}
            </div>
          </div>
          <SeriesHeroTeam team={home} align="left" isDark={isDark} winner={winner} />
        </div>

        {winner && !winner.placeholder && (
          <p className="mt-4 text-center text-sm text-slate-400">
            <span className={isDark ? 'font-bold text-white' : 'font-bold text-slate-900'}>{winner.name}</span>
            {' '}won the series {winner.wins}–{loser?.wins ?? 0}
          </p>
        )}
        {series.hasPlaceholders && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Seeds lock in after the regular season.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {series.games.map((game) => (
          <SeriesGameRow
            key={game.gamePk}
            game={game}
            isDark={isDark}
            onOpen={onOpenGame}
          />
        ))}
      </div>
    </div>
  );
}

function SeriesHeroTeam({ team, align, isDark, winner }) {
  const isWinner = winner?.id && team.id && Number(team.id) === Number(winner.id);
  const content = (
    <>
      <TeamMark team={team} size="lg" isDark={isDark} />
      <div className={cn('min-w-0', align === 'right' ? 'text-right' : 'text-left')}>
        <div className={cn(
          'truncate font-display text-xl font-black sm:text-2xl',
          isWinner || !winner
            ? isDark ? 'text-white' : 'text-slate-900'
            : 'text-slate-500',
        )}
        >
          {team.abbr}
        </div>
        <div className="truncate text-xs text-slate-500">{team.name}</div>
      </div>
    </>
  );

  if (team.id && !team.placeholder) {
    return (
      <Link
        to={`/team/${team.id}`}
        className={cn('flex min-w-0 items-center gap-2.5', align === 'right' ? 'flex-row-reverse' : '')}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', align === 'right' ? 'flex-row-reverse' : '')}>
      {content}
    </div>
  );
}

export default function Postseason() {
  const { year: yearParam, seriesId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { favoriteTeams } = useFavoriteTeams();
  const year = clampPostseasonYear(yearParam ?? defaultPostseasonYear());
  const { bracket, loading, error, cancelled, reload } = usePostseasonBracket(year);

  useEffect(() => {
    if (yearParam && Number(yearParam) === year) return;
    const suffix = seriesId ? `/${encodeURIComponent(seriesId)}` : '';
    navigate(`/postseason/${year}${suffix}`, { replace: true });
  }, [year, yearParam, seriesId, navigate]);

  const selectedSeries = useMemo(() => {
    if (!seriesId) return null;
    return bracket.series.find((item) => item.id === decodeURIComponent(seriesId)) ?? null;
  }, [bracket.series, seriesId]);

  const title = selectedSeries
    ? `${selectedSeries.shortLabel} ${year}`
    : `${year} Postseason`;
  useDocumentTitle(title);

  const goToYear = (nextYear) => {
    navigate(`/postseason/${clampPostseasonYear(nextYear)}`);
  };

  const openGame = (game) => {
    if (!game?.gamePk || !selectedSeries) return;
    navigate(`/game/${game.gamePk}`, { state: gamedayState(year, selectedSeries) });
  };

  const hasBothLeagues = bracket.series.some((s) => s.league === 'AL')
    && bracket.series.some((s) => s.league === 'NL');

  const leagueFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'AL', label: 'AL' },
    { value: 'NL', label: 'NL' },
  ];

  return (
    <PostseasonFrame
      year={year}
      onYearChange={goToYear}
      isDark={isDark}
      selectedSeries={selectedSeries}
      onBack={() => navigate(`/postseason/${year}`)}
    >
      {loading && (
        <LoadingSpinner size="lg" py="py-24" label="Loading October…" />
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-500/30 bg-red-900/20 p-8 text-center text-red-300">
          <div className="font-bold">Could not load the {year} postseason.</div>
          <div className="mt-1 text-sm text-red-200/70">{error}</div>
          <button
            type="button"
            onClick={reload}
            className="mt-4 rounded-full border border-red-400/40 px-4 py-2 text-xs font-bold text-red-100 hover:bg-red-500/10"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && cancelled && (
        <div className={cn('rounded-3xl border px-5 py-12 text-center', surfaceClass(isDark))}>
          <Trophy className="mx-auto mb-3 text-slate-500" size={28} />
          <h2 className={cn('font-display text-2xl font-black', isDark ? 'text-white' : 'text-slate-900')}>
            No {year} postseason
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            The 1994 postseason was cancelled by the players&apos; strike. There was no World Series for the first time in 90 years.
          </p>
        </div>
      )}

      {!loading && !error && !cancelled && selectedSeries && (
        <SeriesDetail
          series={selectedSeries}
          year={year}
          isDark={isDark}
          favoriteTeamIds={favoriteTeams}
          onOpenGame={openGame}
        />
      )}

      {!loading && !error && !cancelled && !selectedSeries && seriesId && (
        <div className={cn('rounded-3xl border px-5 py-10 text-center', surfaceClass(isDark))}>
          <p className="text-sm text-slate-400">That series isn&apos;t in the {year} bracket.</p>
          <button
            type="button"
            onClick={() => navigate(`/postseason/${year}`)}
            className="mt-3 text-sm font-bold text-accent-300 hover:underline"
          >
            Back to bracket
          </button>
        </div>
      )}

      {!loading && !error && !cancelled && !selectedSeries && !seriesId && (
        <BracketBody
          bracket={bracket}
          year={year}
          isDark={isDark}
          favoriteTeamIds={favoriteTeams}
          hasBothLeagues={hasBothLeagues}
          leagueFilterOptions={leagueFilterOptions}
        />
      )}
    </PostseasonFrame>
  );
}

function PostseasonFrame({ year, onYearChange, isDark, selectedSeries, onBack, children }) {
  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 sm:mb-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {selectedSeries ? (
              <button
                type="button"
                onClick={onBack}
                className={cn(
                  'mb-2 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors',
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                <ChevronLeft size={16} />
                {year} bracket
              </button>
            ) : (
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-accent-300 ring-1 ring-accent-500/25">
                <Trophy size={12} aria-hidden />
                Postseason
              </div>
            )}
            <h1 className={cn(
              'font-display text-2xl font-black tracking-tight sm:text-3xl',
              isDark ? 'text-white' : 'text-slate-900',
            )}
            >
              {selectedSeries ? selectedSeries.shortLabel : `${year} MLB Postseason`}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              {selectedSeries
                ? 'Pick a game to open Gameday — box, pitches, and the full feed.'
                : 'Every October bracket since 1903. Select a matchup to browse the series.'}
            </p>
          </div>
          <YearPicker year={year} onChange={onYearChange} isDark={isDark} />
        </div>
      </header>
      {children}
    </div>
  );
}

function BracketBody({
  bracket,
  year,
  isDark,
  favoriteTeamIds,
  hasBothLeagues,
  leagueFilterOptions,
}) {
  const [leagueFilter, setLeagueFilter] = useState('all');

  if (!bracket.series.length) {
    return (
      <div className={cn('rounded-3xl border px-5 py-12 text-center', surfaceClass(isDark))}>
        <Trophy className="mx-auto mb-3 text-slate-500" size={28} />
        <h2 className={cn('font-display text-2xl font-black', isDark ? 'text-white' : 'text-slate-900')}>
          No series yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          MLB hasn&apos;t published a {year} postseason schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {bracket.worldSeries && <ChampionBanner series={bracket.worldSeries} year={year} isDark={isDark} />}

      {bracket.isPreview && (
        <div className={cn(
          'rounded-2xl border px-4 py-3 text-sm text-slate-400',
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white',
        )}
        >
          {year} seeds are still placeholders. The bracket shape is locked; clubs fill in after the regular season.
        </div>
      )}

      {hasBothLeagues && (
        <div className="sm:hidden">
          <SegmentedControl
            value={leagueFilter}
            onChange={setLeagueFilter}
            size="sm"
            variant="pill"
            options={leagueFilterOptions}
          />
        </div>
      )}

      <div className={cn(
        'grid gap-6',
        bracket.rounds.length >= 4
          ? 'lg:grid-cols-4'
          : bracket.rounds.length === 3
            ? 'md:grid-cols-3'
            : bracket.rounds.length === 2
              ? 'md:grid-cols-2'
              : 'grid-cols-1',
      )}
      >
        {bracket.rounds.map((round) => (
          <RoundColumn
            key={round.key}
            round={round}
            year={year}
            isDark={isDark}
            favoriteTeamIds={favoriteTeamIds}
            leagueFilter={leagueFilter}
          />
        ))}
      </div>
    </div>
  );
}
