import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  MapPin,
  Star,
  Trophy,
} from 'lucide-react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Select, LoadingSpinner, SegmentedControl } from '../components/ui';
import TeamLogoImg from '../components/TeamLogoImg';
import { useTheme } from '../context/ThemeContext.jsx';
import { useFavoriteTeams } from '../hooks/useFavoriteTeams';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePostseasonBracket } from '../hooks/usePostseasonBracket';
import { usePostseasonEventLogo } from '../hooks/usePostseasonEventLogo';
import { usePostseasonFacts } from '../hooks/usePostseasonFacts';
import { useTeamPostseasonYears } from '../hooks/useTeamPostseasonYears';
import { useLocalStorageState } from '../hooks/useStorageState';
import PostseasonBracketView from './PostseasonBracketView';
import PostseasonFactsView from './PostseasonFactsView';
import { getTeamColorPalette } from '../utils/teamColors';
import { compactPlayerName, formatFinalStatus, mlbTeams, teamLogoUrl } from '../utils/mlbHelpers';
import { assetUrl } from '../utils/baseUrl.js';
import {
  CURRENT_CALENDAR_YEAR,
  LEAGUE_META,
  adjacentFilteredYear,
  leagueLogoSrc,
  MIN_POSTSEASON_YEAR,
  clampPostseasonYear,
  defaultPostseasonYear,
  formatGameClock,
  formatOfficialDate,
  formatSeriesScore,
  isCompletedGame,
  isIfNecessaryUnplayed,
  isLiveGame,
  postseasonHref,
  postseasonYearOptions,
  seriesDisplayTeams,
  seriesInvolvesTeam,
  teamPostseasonYearOptions,
} from '../utils/postseason';

const YEAR_OPTIONS = postseasonYearOptions();
const TEAM_FILTER_ALL = 'all';
const MLB_TEAM_BY_ID = Object.fromEntries(mlbTeams.map((team) => [team.id, team]));

const VIEW_OPTIONS = [
  { value: 'rounds', label: 'Rounds' },
  { value: 'bracket', label: 'Bracket' },
  { value: 'facts', label: 'Facts' },
];

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

function mlbLogoSrc(isDark) {
  return isDark ? LEAGUE_META.WS.logo : LEAGUE_META.WS.logoLight;
}

function teamFilterOptions(isDark) {
  return [
    { value: TEAM_FILTER_ALL, label: 'All teams', icon: mlbLogoSrc(isDark) },
    ...[...mlbTeams]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => ({
        value: team.id,
        label: team.name,
        icon: teamLogoUrl(team.id, { preferDark: isDark }),
      })),
  ];
}

function TeamCircleSelect({ value, onChange, options, isDark, selectedTeam }) {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative shrink-0">
        <ListboxButton
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border transition-colors sm:h-9 sm:w-9',
            isDark
              ? 'border-slate-700 bg-slate-900 hover:border-slate-500'
              : 'border-slate-200 bg-white hover:border-slate-300',
          )}
          aria-label={selectedTeam ? `Team filter: ${selectedTeam.name}` : 'Filter by team'}
        >
          {selectedTeam ? (
            <TeamLogoImg teamId={selectedTeam.id} className="h-5 w-5 object-contain sm:h-6 sm:w-6" alt="" />
          ) : (
            <img src={mlbLogoSrc(isDark)} alt="" className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
          )}
        </ListboxButton>
        <ListboxOptions
          anchor="bottom end"
          transition
          className={cn(
            'z-50 mt-1 w-56 max-h-60 overflow-auto rounded-2xl border py-1 shadow-xl',
            'focus:outline-none',
            'transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
            isDark
              ? 'bg-slate-900 border-slate-700'
              : 'bg-white border-slate-200 shadow-slate-300/40',
          )}
        >
          {options.map((opt) => (
            <ListboxOption
              key={opt.value}
              value={opt.value}
              className={({ focus, selected: isSelected }) =>
                cn(
                  'relative cursor-pointer select-none px-3 py-2 text-sm',
                  focus
                    ? isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                    : isDark ? 'text-slate-300' : 'text-slate-700',
                  isSelected ? 'text-accent-400' : '',
                )
              }
            >
              {({ selected: isSelected }) => (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {opt.icon && (
                      <img src={opt.icon} alt="" className="h-5 w-5 object-contain" />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} className="flex-shrink-0 text-accent-400" />}
                </div>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

function YearPicker({ year, onChange, isDark, years, appearances, loading = false, variant = 'default' }) {
  const filtered = Array.isArray(years);
  const options = filtered
    ? teamPostseasonYearOptions(appearances, years, year)
    : YEAR_OPTIONS;
  const older = filtered
    ? adjacentFilteredYear(years, year, 'older')
    : year > MIN_POSTSEASON_YEAR ? year - 1 : null;
  const newer = filtered
    ? adjacentFilteredYear(years, year, 'newer')
    : year < CURRENT_CALENDAR_YEAR ? year + 1 : null;

  const hero = variant === 'hero';
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-0.5 rounded-xl border p-0.5',
        hero
          ? 'rounded-full border-white/25 bg-black/35 px-1 py-0.5'
          : isDark
            ? 'border-slate-800 bg-slate-900'
            : 'border-slate-200 bg-white',
      )}
    >
      <button
        type="button"
        onClick={() => older != null && onChange(older)}
        disabled={loading || older == null}
        className={cn(
          'flex h-8 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30',
          hero
            ? 'text-white/80 hover:bg-white/10'
            : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100',
        )}
        aria-label="Previous postseason year"
      >
        <ChevronLeft size={16} />
      </button>
      <div className={filtered ? 'min-w-[6.75rem]' : 'min-w-[3.75rem]'}>
        <Select
          value={year}
          onChange={onChange}
          options={options}
          size="sm"
          showChevron={false}
          optionsClassName="!w-44"
          buttonClassName={cn(
            '!rounded-lg !border-0 !bg-transparent !px-1 !py-1 justify-center font-black',
            hero ? '!text-white' : isDark ? '' : '!text-slate-900',
          )}
        />
      </div>
      <button
        type="button"
        onClick={() => newer != null && onChange(newer)}
        disabled={loading || newer == null}
        className={cn(
          'flex h-8 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30',
          hero
            ? 'text-white/80 hover:bg-white/10'
            : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100',
        )}
        aria-label="Next postseason year"
      >
        <ChevronRight size={16} />
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

function ChampionBanner({ series, year, isDark, teamId }) {
  const winner = series?.winner;
  if (!winner || winner.placeholder) return null;
  const loser = series.teams.find((team) => team.id !== winner.id) ?? series.teams[1];
  const palette = getTeamColorPalette(winner.id);

  return (
    <Link
      to={postseasonHref(year, series.id, teamId)}
      className={cn(
        'theme-on-dark group relative block overflow-hidden rounded-3xl border',
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
        src={leagueLogoSrc(meta, isDark)}
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

function SeriesCard({ series, year, isDark, favoriteTeamIds, focusTeamId, teamId }) {
  const [away, home] = series.teams;
  const isFav = favoriteTeamIds.some((id) => seriesInvolvesTeam(series, id));
  const isFocus = focusTeamId && seriesInvolvesTeam(series, focusTeamId);
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
      to={postseasonHref(year, series.id, teamId)}
      className={cn(
        'group block rounded-2xl border p-3.5 transition-all',
        surfaceClass(isDark),
        isFav || isFocus ? 'ring-1 ring-accent-400/40' : '',
        focusTeamId && !isFocus ? 'opacity-45 hover:opacity-100' : '',
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
              src={leagueLogoSrc(LEAGUE_META[series.league], isDark)}
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

function RoundColumn({ round, year, isDark, favoriteTeamIds, leagueFilter, focusTeamId, teamId }) {
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
            focusTeamId={focusTeamId}
            teamId={teamId}
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

function seriesHeroTitle(series) {
  if (series.gameType === 'W') return 'World Series';
  return series.shortLabel || series.description || 'Postseason';
}

function SeriesEventHero({
  series,
  year,
  onBack,
  yearPicker,
  teamPicker,
}) {
  const logoSrc = usePostseasonEventLogo(series, year);
  const title = seriesHeroTitle(series);

  return (
    <section
      className="theme-on-dark relative overflow-hidden rounded-3xl px-3 pb-7 pt-3 sm:px-6 sm:pb-9"
      aria-label={`${year} ${title}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#070b14]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(212,175,55,0.26),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />

      <h1 className="sr-only">{year} {title}</h1>

      <div className="relative flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-white/70 transition-colors hover:text-white"
        >
          <ChevronLeft size={16} />
          {year} bracket
        </button>
        <div className="flex items-center gap-2">
          {yearPicker}
          {teamPicker}
        </div>
      </div>

      <div className="relative mt-3 flex min-h-[12.5rem] items-center justify-center sm:min-h-[17rem]">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-52 w-auto max-w-[min(100%,34rem)] rounded-2xl object-contain drop-shadow-2xl sm:max-h-64"
          />
        ) : (
          <img
            src={assetUrl('icons/world-series-trophy.png')}
            alt=""
            className="h-36 w-36 object-contain drop-shadow-2xl sm:h-48 sm:w-48"
          />
        )}
      </div>
    </section>
  );
}

function SeriesDetail({
  series,
  year,
  isDark,
  favoriteTeamIds,
  onOpenGame,
  onBack,
  yearPicker,
  teamPicker,
}) {
  const { left, right } = seriesDisplayTeams(series, year);
  const winner = series.winner;
  const loser = winner ? series.teams.find((team) => team.id !== winner.id) : null;
  const isFav = favoriteTeamIds.some((id) => seriesInvolvesTeam(series, id));
  const isWorldSeries = series.gameType === 'W';

  return (
    <div className="space-y-4">
      <SeriesEventHero
        series={series}
        year={year}
        onBack={onBack}
        yearPicker={yearPicker}
        teamPicker={teamPicker}
      />

      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border px-4 py-5 sm:px-6',
          surfaceClass(isDark),
          isWorldSeries ? (isDark ? 'border-amber-400/25' : 'border-amber-300/70') : '',
        )}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isWorldSeries ? (
              <img
                src={assetUrl('icons/world-series-trophy.png')}
                alt=""
                className="h-6 w-6 object-contain drop-shadow sm:h-7 sm:w-7"
              />
            ) : series.league !== 'WS' && LEAGUE_META[series.league]?.logo ? (
              <img src={leagueLogoSrc(LEAGUE_META[series.league], isDark)} alt="" className="h-5 w-5 object-contain" />
            ) : null}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/90">
                {year} {series.description || series.shortLabel}
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
          <SeriesHeroTeam team={left} align="right" isDark={isDark} winner={winner} />
          <div className="text-center">
            {isWorldSeries && (
              <img
                src={assetUrl('icons/world-series-trophy.png')}
                alt=""
                className="mx-auto mb-1 h-10 w-10 object-contain drop-shadow sm:h-12 sm:w-12"
              />
            )}
            <div className={cn(
              'font-display text-3xl font-black tabular-nums sm:text-4xl',
              isDark ? 'text-white' : 'text-slate-900',
            )}
            >
              {series.hasPlaceholders && !series.playedCount ? 'vs' : `${left.wins}–${right.wins}`}
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {series.bestOf > 1 ? `Best of ${series.bestOf}` : 'Single game'}
            </div>
          </div>
          <SeriesHeroTeam team={right} align="left" isDark={isDark} winner={winner} />
        </div>

        {winner && !winner.placeholder && (
          <p className="mt-4 text-center text-sm">
            <span className="font-bold text-amber-300">{winner.name}</span>
            <span className="text-slate-400"> won the series {winner.wins}–{loser?.wins ?? 0}</span>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useTheme();
  const { favoriteTeams } = useFavoriteTeams();
  const year = clampPostseasonYear(yearParam ?? defaultPostseasonYear());
  const { bracket, loading, error, cancelled, reload } = usePostseasonBracket(year);
  const [storedView, setStoredView] = useLocalStorageState('mlb.postseason.overview', 'bracket');
  const view = storedView === 'rounds' || storedView === 'facts' ? storedView : 'bracket';
  const [factsRange, setFactsRange] = useLocalStorageState('mlb.postseason.facts.range', 'all');
  const [factsSort, setFactsSort] = useLocalStorageState('mlb.postseason.facts.sort', 'last');
  const [factsDir, setFactsDir] = useLocalStorageState('mlb.postseason.facts.dir', 'desc');
  const facts = usePostseasonFacts(view === 'facts');

  const teamParam = Number(searchParams.get('team'));
  const teamId = MLB_TEAM_BY_ID[teamParam] ? teamParam : null;
  const selectedTeam = teamId ? MLB_TEAM_BY_ID[teamId] : null;
  const { years: teamYears, appearances: teamAppearances, loading: teamYearsLoading } = useTeamPostseasonYears(teamId);
  const teamOptions = useMemo(() => teamFilterOptions(isDark), [isDark]);

  const goTo = useCallback((nextYear, { series = seriesId, replace = false } = {}) => {
    const y = clampPostseasonYear(nextYear);
    const seriesPart = series ? `/${encodeURIComponent(series)}` : '';
    const search = teamId ? `?team=${teamId}` : '';
    navigate(`/postseason/${y}${seriesPart}${search}`, { replace });
  }, [navigate, seriesId, teamId]);

  useEffect(() => {
    if (yearParam && Number(yearParam) === year) return;
    goTo(year, { replace: true });
  }, [year, yearParam, goTo]);

  useEffect(() => {
    if (view === 'facts') return;
    if (!teamId || teamYearsLoading || !teamYears.length) return;
    if (teamYears.includes(year)) return;
    goTo(teamYears[0], { series: null, replace: true });
  }, [view, teamId, teamYears, teamYearsLoading, year, goTo]);

  const selectedSeries = useMemo(() => {
    if (!seriesId) return null;
    return bracket.series.find((item) => item.id === decodeURIComponent(seriesId)) ?? null;
  }, [bracket.series, seriesId]);

  const title = selectedSeries
    ? `${selectedSeries.shortLabel} ${year}`
    : view === 'facts'
      ? 'October facts'
      : selectedTeam
        ? `${selectedTeam.abbr} ${year} Postseason`
        : `${year} Postseason`;
  useDocumentTitle(title);

  const setTeamFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== TEAM_FILTER_ALL) next.set('team', String(value));
    else next.delete('team');
    setSearchParams(next, { replace: true });
  };

  const goToYear = (nextYear) => {
    goTo(nextYear, { series: null });
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
      view={view}
      onViewChange={setStoredView}
      showViewToggle={!selectedSeries && !seriesId}
      hideYearPicker={view === 'facts'}
      teamId={teamId}
      teamOptions={teamOptions}
      onTeamChange={setTeamFilter}
      selectedTeam={selectedTeam}
      teamYears={teamYears}
      teamAppearances={teamAppearances}
      teamYearsLoading={teamYearsLoading}
    >
      {!selectedSeries && !seriesId && view === 'facts' && (
        <PostseasonFactsView
          sources={facts.sources}
          loading={facts.loading}
          error={facts.error}
          range={factsRange}
          onRangeChange={setFactsRange}
          sort={factsSort}
          dir={factsDir === 'asc' ? 'asc' : 'desc'}
          onSortChange={setFactsSort}
          onDirChange={setFactsDir}
          isDark={isDark}
          focusTeamId={teamId}
          onOpenYear={(nextYear, nextTeamId) => {
            setStoredView('bracket');
            const y = clampPostseasonYear(nextYear);
            const search = nextTeamId ? `?team=${nextTeamId}` : '';
            navigate(`/postseason/${y}${search}`);
          }}
        />
      )}

      {view !== 'facts' && loading && (
        <LoadingSpinner size="lg" py="py-24" label="Loading October…" />
      )}

      {view !== 'facts' && !loading && error && (
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

      {view !== 'facts' && !loading && !error && cancelled && (
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
          onBack={() => goTo(year, { series: null })}
          yearPicker={(
            <YearPicker
              year={year}
              onChange={goToYear}
              isDark={isDark}
              years={teamId && teamYears.length ? teamYears : null}
              appearances={teamAppearances}
              loading={Boolean(teamId && teamYearsLoading)}
              variant="hero"
            />
          )}
          teamPicker={(
            <TeamCircleSelect
              value={teamId ?? TEAM_FILTER_ALL}
              onChange={setTeamFilter}
              options={teamOptions}
              isDark={isDark}
              selectedTeam={selectedTeam}
            />
          )}
        />
      )}

      {view !== 'facts' && !loading && !error && !cancelled && !selectedSeries && seriesId && (
        <div className={cn('rounded-3xl border px-5 py-10 text-center', surfaceClass(isDark))}>
          <p className="text-sm text-slate-400">That series isn&apos;t in the {year} bracket.</p>
          <button
            type="button"
            onClick={() => goTo(year, { series: null })}
            className="mt-3 text-sm font-bold text-accent-300 hover:underline"
          >
            Back to bracket
          </button>
        </div>
      )}

      {view !== 'facts' && !loading && !error && !cancelled && !selectedSeries && !seriesId && (
        <BracketBody
          bracket={bracket}
          year={year}
          isDark={isDark}
          favoriteTeamIds={favoriteTeams}
          hasBothLeagues={hasBothLeagues}
          leagueFilterOptions={leagueFilterOptions}
          view={view}
          focusTeamId={teamId}
          teamId={teamId}
        />
      )}
    </PostseasonFrame>
  );
}

function PostseasonFrame({
  year,
  onYearChange,
  isDark,
  selectedSeries,
  view,
  onViewChange,
  showViewToggle,
  hideYearPicker = false,
  teamId,
  teamOptions,
  onTeamChange,
  selectedTeam,
  teamYears,
  teamAppearances,
  teamYearsLoading,
  children,
}) {
  const wide = showViewToggle && view === 'bracket';
  const teamYearCount = selectedTeam && !teamYearsLoading ? teamYears.length : 0;
  const factsView = view === 'facts';
  return (
    <div className={cn('mx-auto px-3 py-5 sm:px-6 sm:py-8', wide ? 'max-w-[90rem]' : 'max-w-6xl')}>
      <header className={cn(selectedSeries ? 'hidden' : 'mb-5 sm:mb-7')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-accent-300 ring-1 ring-accent-500/25">
              <Trophy size={12} aria-hidden />
              Postseason
            </div>
            <h1 className={cn(
              'font-display text-2xl font-black tracking-tight sm:text-3xl',
              isDark ? 'text-white' : 'text-slate-900',
            )}
            >
              {selectedSeries
                ? selectedSeries.shortLabel
                : factsView
                  ? 'October facts'
                  : selectedTeam
                    ? `${year} ${selectedTeam.name}`
                    : `${year} MLB Postseason`}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              {selectedSeries
                ? 'Pick a game to open Gameday — box, pitches, and the full feed.'
                : factsView
                  ? 'Who has the most rings, who keeps getting back, and who has been waiting the longest.'
                  : selectedTeam && teamYearCount
                    ? `${teamYearCount} October${teamYearCount === 1 ? '' : 's'} in the books. The year list only includes seasons they made the dance.`
                    : showViewToggle && view === 'bracket'
                      ? 'American League on the left, National League on the right, World Series in the middle.'
                      : 'Every October bracket since 1903. Select a matchup to browse the series.'}
            </p>
          </div>
          <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto sm:gap-1.5">
            {showViewToggle && (
              <SegmentedControl
                value={view}
                onChange={onViewChange}
                size="xs"
                variant="compact"
                rounded="full"
                optionClassName="!px-2 sm:!px-2.5"
                options={VIEW_OPTIONS}
              />
            )}
            {!hideYearPicker && (
            <YearPicker
              year={year}
              onChange={onYearChange}
              isDark={isDark}
              years={teamId && teamYears.length ? teamYears : null}
              appearances={teamAppearances}
              loading={Boolean(teamId && teamYearsLoading)}
            />
            )}
            <TeamCircleSelect
              value={teamId ?? TEAM_FILTER_ALL}
              onChange={onTeamChange}
              options={teamOptions}
              isDark={isDark}
              selectedTeam={selectedTeam}
            />
          </div>
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
  view,
  focusTeamId,
  teamId,
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
      {view !== 'bracket' && bracket.worldSeries && (
        <ChampionBanner series={bracket.worldSeries} year={year} isDark={isDark} teamId={teamId} />
      )}

      {bracket.isPreview && (
        <div className={cn(
          'rounded-2xl border px-4 py-3 text-sm text-slate-400',
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white',
        )}
        >
          {year} seeds are still placeholders. The bracket shape is locked; clubs fill in after the regular season.
        </div>
      )}

      {view === 'bracket' ? (
        <PostseasonBracketView
          bracket={bracket}
          year={year}
          isDark={isDark}
          favoriteTeamIds={favoriteTeamIds}
          focusTeamId={focusTeamId}
          teamId={teamId}
        />
      ) : (
        <>
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
                focusTeamId={focusTeamId}
                teamId={teamId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
