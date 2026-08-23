import { useState } from 'react';
import { Link } from 'react-router-dom';
import TeamLogoImg from '../components/TeamLogoImg';
import { postseasonHref, seriesInvolvesTeam } from '../utils/postseason';

const LMB_LOGO = 'https://www.mlbstatic.com/team-logos/732.svg';
const LINE = 'rgb(148 163 184)';
const CARD_REM = 4.75;
const CONN_REM = 1.75;
const COLS_REM = CARD_REM * 3 + CONN_REM * 2;

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function LmbLogo({ team, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const px = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  if (!team || team.placeholder || !team.id || failed) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-md bg-black/50 text-[9px] font-black tracking-wide text-slate-300',
          px,
        )}
      >
        {team?.abbr || 'TBD'}
      </span>
    );
  }
  return (
    <TeamLogoImg
      teamId={team.id}
      className={`${px} object-contain`}
      alt={team.abbr || team.name}
      onError={() => setFailed(true)}
    />
  );
}

function seriesScoreLabel(series) {
  if (!series?.teams?.length) return '(0-0)';
  if (series.hasPlaceholders && !series.playedCount) return '(0-0)';
  const [a, b] = series.teams;
  return `(${a.wins}-${b.wins})`;
}

function LmbMatchup({ series, year, teamId, favoriteTeamIds, focusTeamId }) {
  if (!series) {
    return (
      <div
        className="relative z-10 h-[5.75rem] w-[4.75rem] rounded-xl bg-black/85 ring-1 ring-white/10"
        aria-hidden
      />
    );
  }

  const [top, bottom] = series.teams;
  const isFav = favoriteTeamIds?.some((id) => seriesInvolvesTeam(series, id));
  const isFocus = focusTeamId && seriesInvolvesTeam(series, focusTeamId);

  return (
    <Link
      to={postseasonHref(year, series.id, teamId)}
      className={cn(
        'relative z-10 flex h-[5.75rem] w-[4.75rem] flex-col items-center justify-center rounded-xl bg-[#1a1d24] px-1.5 py-1 ring-1 ring-white/10 transition-colors hover:ring-white/25',
        isFav || isFocus ? 'ring-accent-400/50' : '',
        series.live ? 'ring-red-400/40' : '',
      )}
      title={series.shortLabel}
    >
      <LmbLogo team={top} />
      <span className="py-0.5 text-[10px] font-black tabular-nums text-slate-300">
        {seriesScoreLabel(series)}
      </span>
      <LmbLogo team={bottom} />
      {series.live && (
        <span className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-red-300">Live</span>
      )}
    </Link>
  );
}

function Slot({ series, year, teamId, favoriteTeamIds, focusTeamId }) {
  return (
    <div className="relative z-10 flex h-full items-center justify-center">
      <LmbMatchup
        series={series}
        year={year}
        teamId={teamId}
        favoriteTeamIds={favoriteTeamIds}
        focusTeamId={focusTeamId}
      />
    </div>
  );
}

/**
 * Overlay covering the whole 3→2→1 grid so stems start inside the cards
 * and meet the next round at the card centers.
 */
function ZoneLines({ flip }) {
  const pct = (rems) => (rems / COLS_REM) * 100;
  const inset = 2.2;
  const r1Right = pct(CARD_REM) - inset;
  const v1 = pct(CARD_REM) + pct(CONN_REM) / 2;
  const zonaLeft = pct(CARD_REM + CONN_REM) + inset;
  const zonaRight = pct(CARD_REM * 2 + CONN_REM) - inset;
  const v2 = pct(CARD_REM * 2 + CONN_REM) + pct(CONN_REM) / 2;
  const champLeft = pct(CARD_REM * 2 + CONN_REM * 2) + inset;

  const x = (n) => (flip ? (100 - n).toFixed(2) : n.toFixed(2));
  const d = [
    `M${x(r1Right)} 16.67 H${x(v1)} V25 H${x(zonaLeft)}`,
    `M${x(r1Right)} 50 H${x(v1)}`,
    `M${x(r1Right)} 83.33 H${x(v1)} V75 H${x(zonaLeft)}`,
    `M${x(v1)} 16.67 V83.33`,
    `M${x(zonaRight)} 25 H${x(v2)} V50 H${x(champLeft)}`,
    `M${x(zonaRight)} 75 H${x(v2)}`,
    `M${x(v2)} 25 V75`,
    `M${x(100 - inset)} 50 H${x(100)}`,
  ].join(' ');

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={LINE}
        strokeWidth="2"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ZoneTag({ zone, align }) {
  const norte = zone === 'Norte';
  return (
    <div
      className={cn(
        'mb-2 flex h-7 items-center gap-2 px-1',
        align === 'right' ? 'justify-end' : 'justify-start',
      )}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow-sm">
        <span className="font-display text-sm font-black leading-none text-slate-900">
          {norte ? 'N' : 'S'}
        </span>
      </div>
      <span className="font-display text-sm font-black tracking-tight text-white sm:text-base">
        {norte ? 'Norte' : 'Sur'}
      </span>
    </div>
  );
}

function LmbZoneHalf({
  zone,
  first,
  zona,
  champ,
  year,
  teamId,
  favoriteTeamIds,
  focusTeamId,
}) {
  const norte = zone === 'Norte';
  const slot = (series, key) => (
    <Slot
      key={key}
      series={series}
      year={year}
      teamId={teamId}
      favoriteTeamIds={favoriteTeamIds}
      focusTeamId={focusTeamId}
    />
  );

  const r1 = [
    slot(first[0], `${zone}-f-0`),
    slot(first[1], `${zone}-f-1`),
    slot(first[2], `${zone}-f-2`),
  ];
  const r2 = [
    slot(zona[0], `${zone}-z-0`),
    slot(zona[1], `${zone}-z-1`),
  ];
  const r3 = slot(champ, `${zone}-c`);
  const columns = `${CARD_REM}rem ${CONN_REM}rem ${CARD_REM}rem ${CONN_REM}rem ${CARD_REM}rem`;

  return (
    <div className="flex min-w-0 flex-col">
      <ZoneTag zone={zone} align={norte ? 'left' : 'right'} />
      <div
        className="relative min-h-[21rem] flex-1"
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gridTemplateRows: 'repeat(6, minmax(3.4rem, 1fr))',
        }}
      >
        <ZoneLines flip={!norte} />
        {norte ? (
          <>
            <div style={{ gridColumn: 1, gridRow: '1 / 3' }}>{r1[0]}</div>
            <div style={{ gridColumn: 1, gridRow: '3 / 5' }}>{r1[1]}</div>
            <div style={{ gridColumn: 1, gridRow: '5 / 7' }}>{r1[2]}</div>
            <div style={{ gridColumn: 3, gridRow: '1 / 4' }}>{r2[0]}</div>
            <div style={{ gridColumn: 3, gridRow: '4 / 7' }}>{r2[1]}</div>
            <div style={{ gridColumn: 5, gridRow: '1 / 7' }}>{r3}</div>
          </>
        ) : (
          <>
            <div style={{ gridColumn: 1, gridRow: '1 / 7' }}>{r3}</div>
            <div style={{ gridColumn: 3, gridRow: '1 / 4' }}>{r2[0]}</div>
            <div style={{ gridColumn: 3, gridRow: '4 / 7' }}>{r2[1]}</div>
            <div style={{ gridColumn: 5, gridRow: '1 / 3' }}>{r1[0]}</div>
            <div style={{ gridColumn: 5, gridRow: '3 / 5' }}>{r1[1]}</div>
            <div style={{ gridColumn: 5, gridRow: '5 / 7' }}>{r1[2]}</div>
          </>
        )}
      </div>
    </div>
  );
}

function LmbFinalCenter({ series, year, teamId }) {
  const [left, right] = series?.teams ?? [];
  const inner = (
    <div className="flex w-40 flex-col items-center px-2 py-2.5 sm:w-44">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
        Playoffs {year}
      </div>
      <div className="mt-1.5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-black/40 ring-1 ring-amber-400/35">
        <img src={LMB_LOGO} alt="" className="h-12 w-12 object-contain" />
      </div>
      <div className="mt-1.5 text-center font-display text-sm font-black uppercase leading-tight tracking-wide text-amber-200">
        Serie del Rey
      </div>
      <div className="mt-2 flex items-center gap-2">
        <LmbLogo team={left} />
        <span className="text-[10px] font-black text-slate-500">vs</span>
        <LmbLogo team={right} />
      </div>
      {series?.live && (
        <span className="mt-1 text-[8px] font-black uppercase tracking-wider text-red-300">Live</span>
      )}
    </div>
  );

  if (!series) {
    return <div className="flex items-center">{inner}</div>;
  }
  return (
    <Link
      to={postseasonHref(year, series.id, teamId)}
      className="flex items-center rounded-2xl transition-colors hover:bg-white/5"
    >
      {inner}
    </Link>
  );
}

export default function LmbBracketView({
  diagram,
  year,
  teamId,
  favoriteTeamIds = [],
  focusTeamId,
}) {
  const halfProps = { year, teamId, favoriteTeamIds, focusTeamId };
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#111218]">
      <div className="overflow-x-auto">
        <div className="relative mx-auto flex min-w-max items-stretch justify-center px-3 py-5 sm:px-5 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(212,175,55,0.08),transparent_42%)]" />
          <LmbZoneHalf
            zone="Norte"
            first={diagram.norte.first}
            zona={diagram.norte.zona}
            champ={diagram.norte.champ}
            {...halfProps}
          />
          <div className="flex flex-shrink-0 flex-col">
            <div className="mb-2 h-7" aria-hidden />
            <div className="flex flex-1 items-center">
              <div className="h-px w-5 bg-slate-400" />
              <LmbFinalCenter series={diagram.final} year={year} teamId={teamId} />
              <div className="h-px w-5 bg-slate-400" />
            </div>
          </div>
          <LmbZoneHalf
            zone="Sur"
            first={diagram.sur.first}
            zona={diagram.sur.zona}
            champ={diagram.sur.champ}
            {...halfProps}
          />
        </div>
      </div>
      <p className="px-3 pb-3 text-center text-[11px] text-slate-500 lg:hidden">
        Swipe sideways for the full bracket.
      </p>
    </div>
  );
}
