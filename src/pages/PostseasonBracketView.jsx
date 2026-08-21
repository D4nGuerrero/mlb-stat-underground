import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Star, Trophy } from 'lucide-react';
import TeamLogoImg from '../components/TeamLogoImg';
import { assetUrl } from '../utils/baseUrl.js';
import { getTeamColorPalette } from '../utils/teamColors';
import {
  LEAGUE_META,
  buildBracketDiagram,
  leagueLogoSrc,
  postseasonHref,
  seriesInvolvesTeam,
} from '../utils/postseason';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function surfaceClass(isDark) {
  return isDark
    ? 'border-slate-800 bg-slate-900/80'
    : 'border-slate-200 bg-white shadow-sm';
}

function TeamMark({ team, size = 'sm', isDark }) {
  const px = size === 'lg' ? 'h-10 w-10' : 'h-6 w-6';
  if (team?.placeholder || !team?.id) {
    return (
      <span
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-full text-[8px] font-black tracking-wide',
          px,
          isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500',
        )}
      >
        {teamLabel(team).replace(/\s+/g, '').slice(0, 4) || 'TBD'}
      </span>
    );
  }
  return <TeamLogoImg teamId={team.id} className={`${px} flex-shrink-0 object-contain`} alt={team.name} />;
}

function teamLabel(team) {
  if (!team) return 'TBD';
  if (!team.placeholder) return team.abbr || team.name;
  const name = String(team.name ?? '');
  const seed = name.match(/#\s*(\d+)\s*Seed/i);
  if (seed) return `#${seed[1]}`;
  const wildCard = name.match(/Wild Card\s*#\s*(\d+)/i);
  if (wildCard) return `WC ${wildCard[1]}`;
  const winner = name.match(/(\d+\s*\/\s*\d+)\s*Winner/i);
  if (winner) return winner[1].replace(/\s+/g, '');
  if (/league champion/i.test(name)) return 'TBD';
  if (/lower seed/i.test(name)) return 'Lower';
  if (/higher seed/i.test(name)) return 'Higher';
  if (team.abbr && team.abbr !== 'TBD' && team.abbr.length <= 5) return team.abbr;
  return name;
}

const CARD_COL = '10rem';
const CONN_COL = '1.5rem';

function subtreeDepth(node) {
  if (!node?.children?.length) return 1;
  return 1 + Math.max(...node.children.map(subtreeDepth));
}

function DepthPad({ rounds }) {
  if (rounds <= 0) return null;
  return (
    <div
      className="flex-shrink-0"
      style={{ width: `calc(${rounds} * (${CARD_COL} + ${CONN_COL}))` }}
      aria-hidden
    />
  );
}

function BracketConnector({ side, count, isDark }) {
  const border = isDark ? 'border-slate-500' : 'border-slate-300';
  const fill = isDark ? 'bg-slate-500' : 'bg-slate-300';

  if (count < 2) {
    return (
      <div className="flex w-6 flex-shrink-0 items-center self-stretch">
        <div className={cn('h-px w-full', fill)} />
      </div>
    );
  }

  const fork = (
    <div className="relative h-full min-w-0 flex-1">
      <div
        className={cn(
          'absolute inset-y-[25%] w-full border-y',
          side === 'al' ? 'border-r' : 'border-l',
          border,
        )}
      />
    </div>
  );
  const stem = <div className={cn('h-px w-[0.7rem] flex-shrink-0', fill)} />;

  return (
    <div className="flex w-6 flex-shrink-0 items-center self-stretch">
      {side === 'al' ? (
        <>
          {fork}
          {stem}
        </>
      ) : (
        <>
          {stem}
          {fork}
        </>
      )}
    </div>
  );
}

function ByeCard({ team, isDark, focusTeamId }) {
  const isFocus = focusTeamId && team?.id && Number(team.id) === Number(focusTeamId);
  return (
    <div
      className={cn(
        'flex h-[4.75rem] w-40 flex-col justify-center rounded-xl border border-dashed px-2.5 py-1.5',
        isDark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-300 bg-slate-50',
        focusTeamId && !isFocus ? 'opacity-40' : '',
      )}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Bye</div>
      <div className="mt-1 flex items-center gap-1.5">
        <TeamMark team={team} isDark={isDark} />
        <span
          className={cn(
            'min-w-0 truncate text-xs font-bold',
            isDark ? 'text-slate-300' : 'text-slate-700',
          )}
          title={team?.name}
        >
          {teamLabel(team)}
        </span>
      </div>
    </div>
  );
}

function MatchCard({ series, year, isDark, favoriteTeamIds, focusTeamId, teamId }) {
  const teams = series.teams ?? [];
  const winnerId = series.winner?.id;
  const isFav = favoriteTeamIds.some((id) => seriesInvolvesTeam(series, id));
  const isFocus = focusTeamId && seriesInvolvesTeam(series, focusTeamId);
  const isWs = series.gameType === 'W';
  const width = 'w-40';

  return (
    <Link
      to={postseasonHref(year, series.id, teamId)}
      className={cn(
        'group block min-h-[4.75rem] rounded-xl border px-2.5 py-2 transition-all',
        width,
        surfaceClass(isDark),
        focusTeamId && !isFocus ? 'opacity-40 hover:opacity-100' : '',
        isWs
          ? isDark
            ? 'border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-slate-900'
            : 'border-amber-300/80 bg-gradient-to-b from-amber-50 to-white'
          : '',
        isFav || isFocus ? 'ring-1 ring-accent-400/40' : '',
        isDark ? 'hover:border-slate-600 hover:bg-slate-900' : 'hover:border-slate-300 hover:shadow-md',
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span
          className={cn(
            'truncate text-[9px] font-black uppercase tracking-[0.14em]',
            isWs ? 'text-amber-300' : isDark ? 'text-slate-400' : 'text-slate-500',
          )}
        >
          {series.shortLabel}
        </span>
        <div className="flex items-center gap-1">
          {series.live && (
            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-red-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>
          )}
          {isFav && <Star size={10} className="fill-accent-400 text-accent-400" />}
        </div>
      </div>
      <div className="space-y-1">
        {teams.map((team) => {
          const isWinner = winnerId && team.id && Number(team.id) === Number(winnerId);
          const dim = series.complete && !isWinner;
          return (
            <div key={`${series.id}-${team.id ?? team.name}`} className="flex items-center gap-1.5">
              <TeamMark team={team} isDark={isDark} />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-xs font-bold',
                  isWinner
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : dim
                      ? 'text-slate-500'
                      : isDark ? 'text-slate-200' : 'text-slate-800',
                )}
                title={team.name}
              >
                {teamLabel(team)}
              </span>
              <span
                className={cn(
                  'w-4 text-right font-display text-sm font-black tabular-nums',
                  isWinner
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : 'text-slate-500',
                )}
              >
                {series.hasPlaceholders && !series.playedCount ? '–' : team.wins}
              </span>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

function WorldSeriesCard({ series, teams, year, isDark, favoriteTeamIds, focusTeamId, teamId }) {
  const ordered = teams?.length ? teams : series.teams;
  const winner = series.winner;
  const palette = getTeamColorPalette(winner?.id ?? ordered?.[0]?.id);
  const isFav = favoriteTeamIds.some((id) => seriesInvolvesTeam(series, id));
  const isFocus = focusTeamId && seriesInvolvesTeam(series, focusTeamId);
  const loser = winner ? ordered.find((team) => Number(team.id) !== Number(winner.id)) : null;

  return (
    <Link
      to={postseasonHref(year, series.id, teamId)}
      className={cn(
        'theme-on-dark group relative flex w-[11.5rem] flex-col items-center overflow-hidden rounded-2xl border px-3 py-3.5 transition-all sm:w-52',
        isDark ? 'border-amber-400/35' : 'border-amber-300/80',
        isFav || isFocus ? 'ring-1 ring-accent-400/40' : '',
        focusTeamId && !isFocus ? 'opacity-40 hover:opacity-100' : '',
        isDark ? 'hover:border-amber-300/50' : 'hover:shadow-md',
      )}
      style={{
        background: winner && !winner.placeholder
          ? `linear-gradient(180deg, ${palette.primary}55 0%, #070b14 78%)`
          : 'linear-gradient(180deg, rgba(251,191,36,0.16) 0%, #0f172a 70%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.18),transparent_60%)]" />
      <div className="relative flex flex-col items-center">
        <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">
          <Trophy size={11} />
          World Series
        </div>
        {winner && !winner.placeholder ? (
          <img
            src={assetUrl('icons/world-series-trophy.png')}
            alt=""
            className="mt-1.5 h-12 w-12 object-contain drop-shadow sm:h-14 sm:w-14"
          />
        ) : (
          <Trophy size={22} className="mt-1.5 text-amber-300/80" />
        )}
        {series.live && (
          <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Live
          </span>
        )}
        <div className="mt-2 w-full space-y-1">
          {ordered.map((team) => {
            const isWinner = winner?.id && team.id && Number(team.id) === Number(winner.id);
            return (
              <div key={`${series.id}-${team.id ?? team.name}`} className="flex items-center gap-1.5">
                <TeamMark team={team} isDark />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-xs font-bold',
                    isWinner || !winner ? 'text-white' : 'text-slate-400',
                  )}
                  title={team.name}
                >
                  {teamLabel(team)}
                </span>
                <span
                  className={cn(
                    'w-4 text-right font-display text-base font-black tabular-nums',
                    isWinner || !winner ? 'text-white' : 'text-slate-400',
                  )}
                >
                  {series.hasPlaceholders && !series.playedCount ? '–' : team.wins}
                </span>
              </div>
            );
          })}
        </div>
        {winner && !winner.placeholder && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-200">
            <Crown size={10} />
            <span className="truncate">{winner.teamName || winner.name}</span>
            {loser ? ` ${winner.wins}–${loser.wins}` : ''}
          </div>
        )}
      </div>
    </Link>
  );
}

function LeagueTag({ league, isDark, align }) {
  const meta = LEAGUE_META[league];
  if (!meta) return null;
  return (
    <div
      className={cn(
        'mb-2 flex items-center gap-2 px-1',
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start',
      )}
    >
      <img src={leagueLogoSrc(meta, isDark)} alt="" className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
      <span
        className={cn(
          'font-display text-sm font-black tracking-tight sm:text-base',
          isDark ? 'text-white' : 'text-slate-900',
        )}
      >
        {meta.short}
      </span>
    </div>
  );
}

function BracketNode({ node, side, alignDepth, year, isDark, favoriteTeamIds, focusTeamId, teamId }) {
  const kids = node.children ?? [];
  const ownDepth = subtreeDepth(node);
  const pad = Math.max(0, (alignDepth ?? ownDepth) - ownDepth);
  const kidsMax = kids.length ? Math.max(...kids.map(subtreeDepth)) : 0;
  const card = node.kind === 'bye'
    ? <ByeCard team={node.team} isDark={isDark} focusTeamId={focusTeamId} />
    : (
      <MatchCard
        series={node.series}
        year={year}
        isDark={isDark}
        favoriteTeamIds={favoriteTeamIds}
        focusTeamId={focusTeamId}
        teamId={teamId}
      />
    );

  const childCol = kids.length > 0 && (
    <div
      className="grid"
      style={{ gridTemplateRows: `repeat(${kids.length}, minmax(0, 1fr))` }}
    >
      {kids.map((child) => (
        <div key={child.id} className="flex items-center">
          <BracketNode
            node={child}
            side={side}
            alignDepth={kidsMax}
            year={year}
            isDark={isDark}
            favoriteTeamIds={favoriteTeamIds}
            focusTeamId={focusTeamId}
            teamId={teamId}
          />
        </div>
      ))}
    </div>
  );

  const connector = kids.length > 0 && (
    <BracketConnector side={side} count={kids.length} isDark={isDark} />
  );

  return (
    <div className="flex h-full items-stretch">
      {side === 'al' && <DepthPad rounds={pad} />}
      {side === 'al' && childCol}
      {side === 'al' && connector}
      <div className="flex items-center py-2">{card}</div>
      {side === 'nl' && connector}
      {side === 'nl' && childCol}
      {side === 'nl' && <DepthPad rounds={pad} />}
    </div>
  );
}

function LeagueHalf({ roots, side, year, isDark, favoriteTeamIds, focusTeamId, teamId }) {
  if (!roots.length) return null;
  const rootDepth = Math.max(...roots.map(subtreeDepth));
  return (
    <div className="flex min-w-0 flex-col">
      <LeagueTag league={side === 'al' ? 'AL' : 'NL'} isDark={isDark} align={side === 'nl' ? 'right' : 'left'} />
      <div
        className={cn('flex-1', roots.length > 1 ? 'grid' : 'flex items-center')}
        style={roots.length > 1 ? { gridTemplateRows: `repeat(${roots.length}, minmax(0, 1fr))` } : undefined}
      >
        {roots.map((node) => (
          <BracketNode
            key={node.id}
            node={node}
            side={side}
            alignDepth={rootDepth}
            year={year}
            isDark={isDark}
            favoriteTeamIds={favoriteTeamIds}
            focusTeamId={focusTeamId}
            teamId={teamId}
          />
        ))}
      </div>
    </div>
  );
}

export default function PostseasonBracketView({
  bracket,
  year,
  isDark,
  favoriteTeamIds,
  focusTeamId,
  teamId,
}) {
  const diagram = useMemo(() => buildBracketDiagram(bracket), [bracket]);
  const hasTree = diagram.al.length > 0 || diagram.nl.length > 0;

  if (!diagram.worldSeries && !hasTree) return null;

  return (
    <div className={cn('overflow-hidden rounded-3xl border', surfaceClass(isDark))}>
      <div className="overflow-x-auto">
        <div
          className={cn(
            'relative flex min-w-max items-stretch justify-center gap-0 px-3 py-5 sm:px-5 sm:py-7',
            isDark
              ? 'bg-[radial-gradient(ellipse_at_50%_50%,rgba(251,191,36,0.07),transparent_42%)]'
              : 'bg-[radial-gradient(ellipse_at_50%_50%,rgba(251,191,36,0.12),transparent_48%)]',
          )}
        >
          <LeagueHalf
            roots={diagram.al}
            side="al"
            year={year}
            isDark={isDark}
            favoriteTeamIds={favoriteTeamIds}
            focusTeamId={focusTeamId}
            teamId={teamId}
          />

          {diagram.worldSeries && (
            <div className="flex flex-col items-center justify-center px-0.5">
              <div className="mb-2 h-7" aria-hidden />
              <div className="flex items-center">
                {diagram.al.length > 0 && (
                  <div className={cn('h-px w-3 sm:w-4', isDark ? 'bg-slate-600' : 'bg-slate-300')} />
                )}
                <WorldSeriesCard
                  series={diagram.worldSeries}
                  teams={diagram.worldSeriesTeams}
                  year={year}
                  isDark={isDark}
                  favoriteTeamIds={favoriteTeamIds}
                  focusTeamId={focusTeamId}
                  teamId={teamId}
                />
                {diagram.nl.length > 0 && (
                  <div className={cn('h-px w-3 sm:w-4', isDark ? 'bg-slate-600' : 'bg-slate-300')} />
                )}
              </div>
            </div>
          )}

          <LeagueHalf
            roots={diagram.nl}
            side="nl"
            year={year}
            isDark={isDark}
            favoriteTeamIds={favoriteTeamIds}
            focusTeamId={focusTeamId}
            teamId={teamId}
          />
        </div>
      </div>
      <p className="px-3 pb-3 text-center text-[11px] text-slate-500 lg:hidden">
        Swipe sideways for the full bracket.
      </p>
    </div>
  );
}
