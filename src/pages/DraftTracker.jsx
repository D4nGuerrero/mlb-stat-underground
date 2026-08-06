import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  GraduationCap,
  Hash,
  MapPin,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { fetchStatsApiJson } from '../lib/mlb/client';
import {
  FALLBACK_HEADSHOT,
  mlbTeams,
  playerHeadshotUrl,
  teamLogoUrl,
} from '../utils/mlbHelpers';
import TeamLogoImg from '../components/TeamLogoImg';
import { Select, LoadingSpinner } from '../components/ui';

const MIN_DRAFT_YEAR = 1965;
const MAX_DRAFT_YEAR = Math.max(2026, new Date().getFullYear());
const MLB_LEAGUE_LOGO = 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg';

const SPECIAL_ROUND_LABELS = {
  PPI: 'Prospect Promotion Incentive',
  '1C': '1st Round Compensation',
  '2C': '2nd Round Compensation',
  '3C': '3rd Round Compensation',
  '4C': '4th Round Compensation',
  'CB-A': 'Competitive Balance A',
  'CB-B': 'Competitive Balance B',
  CBB: 'Competitive Balance B',
  CBA: 'Competitive Balance A',
};

const YEAR_OPTIONS = Array.from(
  { length: MAX_DRAFT_YEAR - MIN_DRAFT_YEAR + 1 },
  (_, i) => {
    const year = MAX_DRAFT_YEAR - i;
    return { value: year, label: String(year) };
  },
);

const TEAM_FILTER_OPTIONS = [
  { value: 'all', label: 'All teams' },
  ...mlbTeams.map((team) => ({
    value: team.id,
    label: `${team.name} (${team.abbr})`,
    icon: teamLogoUrl(team.id, { preferDark: true }),
  })),
];

function clampYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year)) return MAX_DRAFT_YEAR;
  return Math.min(MAX_DRAFT_YEAR, Math.max(MIN_DRAFT_YEAR, Math.round(year)));
}

function formatBonus(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSchool(school) {
  if (!school?.name) return null;
  const classLabel = school.schoolClass ? ` · ${school.schoolClass}` : '';
  return `${school.name}${classLabel}`;
}

function formatHome(home) {
  if (!home) return null;
  return [home.city, home.state, home.country].filter(Boolean).join(', ') || null;
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Human-readable round titles (avoids "Round PPI" / awkward labels). */
function formatRoundLabel(round) {
  const r = String(round ?? '').trim();
  if (!r || r === '—') return 'Unknown round';
  if (SPECIAL_ROUND_LABELS[r]) return SPECIAL_ROUND_LABELS[r];
  if (/^\d+$/.test(r)) return `${ordinal(Number(r))} Round`;
  // Already descriptive (or unknown code) — show as-is without a double "Round"
  if (/^round\b/i.test(r)) return r;
  return r;
}

function formatDebutDate(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

/**
 * Ordered headshot candidates.
 * MLB debuts → profile photos first; everyone else → draft photo first.
 */
function buildHeadshotCandidates(pick, { hasMlbDebut = false } = {}) {
  const id = pick?.person?.id ?? pick?.personId ?? null;
  const urls = [];
  const push = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  const draftFromApi = pick?.headshotLink || null;
  const draftRebuilt = id
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/w_180,q_auto:best/v1/people/${id}/headshot/draft/current`
    : null;
  const mlbProfile = id
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_180,c_fill,g_face,q_auto:best/v1/people/${id}/headshot/67/current`
    : null;
  const mlbProfileSafe = id
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_180,c_fill,g_face,d_people:generic:headshot:67:current.png/q_auto:best/v1/people/${id}/headshot/67/current`
    : null;
  const milb = id
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/c_fill,g_auto/w_180/v1/people/${id}/headshot/milb/current`
    : null;
  const midfield = id ? playerHeadshotUrl(id) : null;

  if (hasMlbDebut) {
    // Prefer current MLB profile art for players who reached the show.
    push(mlbProfile);
    push(midfield);
    push(mlbProfileSafe);
    push(milb);
    push(draftFromApi);
    push(draftRebuilt);
  } else {
    push(draftFromApi);
    push(draftRebuilt);
    push(milb);
    push(mlbProfileSafe);
    push(midfield);
  }

  push(FALLBACK_HEADSHOT);
  return urls;
}

function flattenDraftPicks(data) {
  const year = data?.drafts?.draftYear ?? null;
  const rounds = data?.drafts?.rounds ?? [];
  const picks = [];

  // Keep API round order for section headers (1 → PPI → 1C → CB-A → 2 …).
  const roundOrder = [];
  const seenRounds = new Set();

  for (const round of rounds) {
    const roundKey = String(round?.round ?? '').trim() || '—';
    if (!seenRounds.has(roundKey)) {
      seenRounds.add(roundKey);
      roundOrder.push(roundKey);
    }
    for (const pick of round?.picks ?? []) {
      if (pick?.isPass) continue;
      const personId = pick.person?.id ?? null;
      const mlbDebutDate = pick.person?.mlbDebutDate || null;
      const hasMlbDebut = Boolean(mlbDebutDate);
      // Prefer the round bucket from the API section, not a stray pickRound mismatch.
      const pickRound = String(pick.pickRound ?? roundKey).trim() || roundKey;
      picks.push({
        key: `${year}-${pick.pickNumber ?? pick.displayPickNumber}-${personId ?? pick.bisPlayerId ?? Math.random()}`,
        year,
        round: roundKey,
        pickRound,
        overall: pick.displayPickNumber ?? pick.pickNumber ?? null,
        roundPick: pick.roundPickNumber ?? null,
        personId,
        name: pick.person?.fullName ?? pick.person?.nameFirstLast ?? 'Unknown',
        position: pick.person?.primaryPosition?.abbreviation
          ?? pick.person?.primaryPosition?.name
          ?? null,
        bats: pick.person?.batSide?.code ?? null,
        throws: pick.person?.pitchHand?.code ?? null,
        teamId: pick.team?.id ?? null,
        teamName: pick.team?.name ?? null,
        school: formatSchool(pick.school),
        home: formatHome(pick.home),
        bonus: formatBonus(pick.signingBonus),
        pickValue: formatBonus(pick.pickValue),
        mlbDebutDate,
        hasMlbDebut,
        headshotCandidates: buildHeadshotCandidates(pick, { hasMlbDebut }),
        isDrafted: pick.isDrafted !== false,
      });
    }
  }

  picks.sort((a, b) => {
    const ao = Number(a.overall) || 9999;
    const bo = Number(b.overall) || 9999;
    return ao - bo;
  });

  return { year, rounds: roundOrder, picks };
}

function useDraftYearData(year) {
  const [fetchedYear, setFetchedYear] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchStatsApiJson(`/api/v1/draft/${year}`, {
      query: { hydrate: 'team,person' },
      signal: controller.signal,
      ttl: 6 * 60 * 60_000,
      retries: 1,
    })
      .then((json) => {
        if (cancelled) return;
        setData(flattenDraftPicks(json));
        setError(null);
        setFetchedYear(year);
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || cancelled) return;
        setData(null);
        setError(err?.message || 'Failed to load draft');
        setFetchedYear(year);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [year]);

  const loading = fetchedYear !== year;
  return {
    loading,
    error: loading ? null : error,
    data: loading ? null : data,
  };
}

function StatChip({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 min-w-0">
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-300`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className="truncate text-sm font-black text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function RoundBadge({ round }) {
  const label = formatRoundLabel(round);
  const isFirst = String(round) === '1';
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
        isFirst
          ? `bg-accent-500/15 text-accent-200 ring-1 ring-accent-500/35`
          : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700',
      ].join(' ')}
    >
      {label}
    </span>
  );
}

/** Sticky top offset under main nav (matches .sticky-under-nav in index.css). */
function getStickyNavOffsetPx() {
  if (typeof document === 'undefined') return 56;
  if (document.documentElement.dataset.hideTopBar === 'true') return 0;
  return window.matchMedia('(min-width: 640px)').matches ? 64 : 56;
}

/**
 * Round header: rounded when in-flow, squared when stuck under the nav.
 * (overflow:hidden on a sticky ancestor would break viewport sticky pinning.)
 */
function StickyRoundHeader({ round, pickCount }) {
  const sentinelRef = useRef(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    let observer;
    const observe = () => {
      observer?.disconnect();
      const offset = getStickyNavOffsetPx();
      observer = new IntersectionObserver(
        ([entry]) => {
          // When the 1px sentinel scrolls above the sticky line, the header is stuck.
          setIsStuck(!entry.isIntersecting);
        },
        {
          // Negative top rootMargin = "stick threshold" matches sticky top offset
          rootMargin: `-${offset + 1}px 0px 0px 0px`,
          threshold: 0,
        },
      );
      observer.observe(sentinel);
    };

    observe();
    window.addEventListener('resize', observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', observe);
    };
  }, []);

  return (
    <>
      {/* Sits just above the sticky header; used only for stuck detection */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      <div
        className={[
          'sticky-under-nav sticky z-20 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2.5 sm:px-4',
          // Rounded only while resting at the top of the card; square when pinned
          isStuck ? 'rounded-none shadow-md shadow-black/20' : 'rounded-t-2xl',
        ].join(' ')}
      >
        <RoundBadge round={round} />
        <span className="text-[11px] font-semibold tabular-nums text-slate-500">
          {pickCount} pick{pickCount === 1 ? '' : 's'}
        </span>
      </div>
    </>
  );
}

function PositionPill({ position }) {
  if (!position) return null;
  return (
    <span className="inline-flex rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-300 ring-1 ring-slate-700">
      {position}
    </span>
  );
}

function DraftPlayerPhoto({ name, candidates, hasMlbDebut = false, debutLabel = null }) {
  const sources = candidates?.length ? candidates : [FALLBACK_HEADSHOT];
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[Math.min(sourceIndex, sources.length - 1)] || FALLBACK_HEADSHOT;

  return (
    <div className="relative flex-shrink-0">
      <img
        src={src}
        alt={name ? `${name} headshot` : ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={[
          'h-11 w-11 rounded-full bg-slate-800 object-cover object-top ring-1 sm:h-12 sm:w-12',
          hasMlbDebut ? 'ring-amber-400/50' : 'ring-slate-700',
        ].join(' ')}
        onError={() => {
          setSourceIndex((i) => (i + 1 < sources.length ? i + 1 : i));
        }}
      />
      {hasMlbDebut && (
        <img
          src={MLB_LEAGUE_LOGO}
          alt="MLB"
          title={debutLabel ? `MLB debut ${debutLabel}` : 'Reached MLB'}
          className="absolute -bottom-0.5 -right-0.5 h-4 w-4 object-contain drop-shadow"
          draggable={false}
        />
      )}
    </div>
  );
}

function DraftPickRow({ pick, highlighted, rowRef }) {
  const className = [
    'group flex items-center gap-2.5 border-b border-slate-800/80 px-3 py-2.5 transition-colors sm:gap-3 sm:px-4',
    highlighted
      ? `bg-accent-500/10 ring-1 ring-inset ring-accent-500/40`
      : 'hover:bg-slate-800/50',
    pick.personId ? 'cursor-pointer' : '',
  ].join(' ');

  const content = (
    <>
      <div className="flex w-10 flex-shrink-0 flex-col items-center justify-center sm:w-12">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pk</span>
        <span className={`text-base font-black tabular-nums sm:text-lg ${highlighted ? `text-accent-300` : 'text-slate-100'}`}>
          {pick.overall ?? '—'}
        </span>
      </div>

      <DraftPlayerPhoto
        key={pick.key}
        name={pick.name}
        candidates={pick.headshotCandidates}
        hasMlbDebut={pick.hasMlbDebut}
        debutLabel={formatDebutDate(pick.mlbDebutDate)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`truncate text-sm font-bold sm:text-[15px] ${pick.personId ? `group-hover:text-accent-200` : ''} text-slate-100`}>
            {pick.name}
          </span>
          <PositionPill position={pick.position} />
          {pick.hasMlbDebut && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200 ring-1 ring-amber-400/30"
              title={formatDebutDate(pick.mlbDebutDate) ? `MLB debut ${formatDebutDate(pick.mlbDebutDate)}` : 'Reached MLB'}
            >
              <img src={MLB_LEAGUE_LOGO} alt="" className="h-3 w-3 object-contain" draggable={false} />
              MLB
            </span>
          )}
          {(pick.bats || pick.throws) && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {[pick.bats && `B ${pick.bats}`, pick.throws && `T ${pick.throws}`].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 sm:text-xs">
          {pick.school && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <GraduationCap size={12} className="flex-shrink-0 text-slate-500" aria-hidden />
              <span className="truncate">{pick.school}</span>
            </span>
          )}
          {pick.home && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={12} className="flex-shrink-0 text-slate-500" aria-hidden />
              <span className="truncate">{pick.home}</span>
            </span>
          )}
        </div>
      </div>

      <div className="hidden flex-shrink-0 items-center gap-2 sm:flex sm:min-w-[7.5rem] sm:justify-end">
        {pick.teamId ? (
          <>
            <TeamLogoImg teamId={pick.teamId} className="h-7 w-7 object-contain" alt="" />
            <span className="max-w-[6rem] truncate text-xs font-semibold text-slate-300">
              {mlbTeams.find((t) => t.id === pick.teamId)?.abbr ?? pick.teamName}
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1 sm:min-w-[4.5rem]">
        <div className="sm:hidden">
          {pick.teamId && (
            <TeamLogoImg teamId={pick.teamId} className="h-6 w-6 object-contain" alt={pick.teamName ?? ''} />
          )}
        </div>
        {pick.bonus ? (
          <span className="text-[11px] font-black tabular-nums text-emerald-300/90 sm:text-xs" title="Signing bonus">
            {pick.bonus}
          </span>
        ) : (
          <span className="text-[11px] text-slate-600 sm:text-xs">—</span>
        )}
      </div>
    </>
  );

  // Use Link as the flex row itself — display:contents breaks img layout in some browsers.
  if (pick.personId) {
    return (
      <div ref={rowRef} id={highlighted ? `draft-pick-${pick.personId}` : undefined}>
        <Link to={`/player/${pick.personId}`} className={className}>
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className={className}
    >
      {content}
    </div>
  );
}

export default function DraftTracker() {
  const navigate = useNavigate();
  const { year: yearParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const year = clampYear(yearParam ?? searchParams.get('year') ?? MAX_DRAFT_YEAR);

  const teamFilter = searchParams.get('team') || 'all';
  const roundFilter = searchParams.get('round') || 'all';
  const highlightPlayerId = searchParams.get('player') ? Number(searchParams.get('player')) : null;
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const { loading, error, data } = useDraftYearData(year);
  const highlightRef = useRef(null);
  const didScrollHighlight = useRef(null);

  // Normalize bare /draft (or invalid year) to /draft/:year while keeping query filters
  useEffect(() => {
    if (yearParam && Number(yearParam) === year) return;
    const next = new URLSearchParams(window.location.search);
    next.delete('year');
    const qs = next.toString();
    navigate(`/draft/${year}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [year, yearParam, navigate]);

  const setFilterParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value == null || value === '' || value === 'all') next.delete(key);
      else next.set(key, String(value));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const goToYear = useCallback((nextYear) => {
    const y = clampYear(nextYear);
    const next = new URLSearchParams(searchParams);
    // Changing year clears round (rounds differ) but keeps team filter
    next.delete('round');
    next.delete('player');
    const qs = next.toString();
    navigate(`/draft/${y}${qs ? `?${qs}` : ''}`);
  }, [navigate, searchParams]);

  const roundOptions = useMemo(() => {
    const rounds = data?.rounds ?? [];
    const unique = [...new Set(rounds.filter(Boolean))];
    return [
      { value: 'all', label: 'All rounds' },
      ...unique.map((round) => ({ value: round, label: formatRoundLabel(round) })),
    ];
  }, [data]);

  const filteredPicks = useMemo(() => {
    let picks = data?.picks ?? [];
    if (teamFilter !== 'all') {
      const teamId = Number(teamFilter);
      picks = picks.filter((p) => Number(p.teamId) === teamId);
    }
    if (roundFilter !== 'all') {
      picks = picks.filter((p) => String(p.round) === String(roundFilter));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      picks = picks.filter((p) =>
        p.name.toLowerCase().includes(q)
        || (p.school && p.school.toLowerCase().includes(q))
        || (p.teamName && p.teamName.toLowerCase().includes(q))
        || (p.position && p.position.toLowerCase().includes(q)),
      );
    }
    return picks;
  }, [data, teamFilter, roundFilter, query]);

  const picksByRound = useMemo(() => {
    const groups = new Map();
    for (const pick of filteredPicks) {
      const key = pick.round || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(pick);
    }
    // Preserve official draft order of rounds when possible.
    const order = data?.rounds ?? [];
    const ordered = [];
    for (const round of order) {
      if (groups.has(round)) ordered.push([round, groups.get(round)]);
    }
    for (const [round, picks] of groups) {
      if (!order.includes(round)) ordered.push([round, picks]);
    }
    return ordered;
  }, [filteredPicks, data]);

  const firstOverall = data?.picks?.[0] ?? null;
  const teamCount = useMemo(() => {
    const ids = new Set((data?.picks ?? []).map((p) => p.teamId).filter(Boolean));
    return ids.size;
  }, [data]);

  useEffect(() => {
    if (!highlightPlayerId || loading || !filteredPicks.length) return;
    if (didScrollHighlight.current === `${year}-${highlightPlayerId}`) return;
    const timer = window.setTimeout(() => {
      const el = highlightRef.current || document.getElementById(`draft-pick-${highlightPlayerId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        didScrollHighlight.current = `${year}-${highlightPlayerId}`;
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlightPlayerId, loading, filteredPicks, year]);

  const activeTeam = teamFilter !== 'all'
    ? mlbTeams.find((t) => t.id === Number(teamFilter))
    : null;

  return (
    <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-5 sm:mb-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-accent-300 ring-1 ring-accent-500/25`}>
              <ClipboardList size={12} aria-hidden />
              Draft Tracker
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
              {year} MLB Draft
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Browse every pick from the Rule 4 draft — filter by club or round, and jump into player pages.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => goToYear(year - 1)}
              disabled={year <= MIN_DRAFT_YEAR}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous draft year"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-[6.5rem]">
              <Select
                value={year}
                onChange={goToYear}
                options={YEAR_OPTIONS}
                size="sm"
                buttonClassName="!rounded-xl !border-0 !bg-transparent justify-center font-black"
              />
            </div>
            <button
              type="button"
              onClick={() => goToYear(year + 1)}
              disabled={year >= MAX_DRAFT_YEAR}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next draft year"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Summary chips */}
      {!loading && data && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip
            icon={<Users size={15} />}
            label="Picks"
            value={data.picks.length.toLocaleString()}
          />
          <StatChip
            icon={<Hash size={15} />}
            label="Rounds"
            value={data.rounds.length}
          />
          <StatChip
            icon={<Trophy size={15} />}
            label="1st overall"
            value={firstOverall?.name ?? '—'}
          />
          <StatChip
            icon={<Filter size={15} />}
            label="Clubs"
            value={teamCount}
          />
        </div>
      )}

      {/* Filters */}
      <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
        <div className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          <Filter size={12} aria-hidden />
          Filters
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            value={teamFilter === 'all' ? 'all' : Number(teamFilter)}
            onChange={(value) => setFilterParam('team', value)}
            options={TEAM_FILTER_OPTIONS}
            size="sm"
            placeholder="Team"
          />
          <Select
            value={roundFilter}
            onChange={(value) => setFilterParam('round', value)}
            options={roundOptions}
            size="sm"
            placeholder="Round"
          />
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player, school…"
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-200"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </label>
        </div>

        {(teamFilter !== 'all' || roundFilter !== 'all' || query.trim() || highlightPlayerId) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {activeTeam && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-slate-700">
                <TeamLogoImg teamId={activeTeam.id} className="h-4 w-4 object-contain" alt="" />
                {activeTeam.abbr}
                <button
                  type="button"
                  onClick={() => setFilterParam('team', 'all')}
                  className="ml-0.5 text-slate-500 hover:text-white"
                  aria-label="Clear team filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {roundFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-slate-700">
                {formatRoundLabel(roundFilter)}
                <button
                  type="button"
                  onClick={() => setFilterParam('round', 'all')}
                  className="ml-0.5 text-slate-500 hover:text-white"
                  aria-label="Clear round filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {query.trim() && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-slate-700">
                “{query.trim()}”
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="ml-0.5 text-slate-500 hover:text-white"
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {highlightPlayerId && (
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-accent-500/15 px-2.5 py-1 text-[11px] font-semibold text-accent-200 ring-1 ring-accent-500/30`}>
                Highlighted player
                <button
                  type="button"
                  onClick={() => setFilterParam('player', null)}
                  className="ml-0.5 opacity-70 hover:opacity-100"
                  aria-label="Clear player highlight"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchParams({}, { replace: true });
              }}
              className="text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-200">
          Couldn’t load the {year} draft. {error}
        </div>
      )}

      {!loading && !error && data && filteredPicks.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-12 text-center">
          <ClipboardList className="mx-auto mb-3 text-slate-600" size={28} />
          <div className="text-sm font-semibold text-slate-300">No picks match these filters</div>
          <p className="mt-1 text-xs text-slate-500">Try another team, round, or clear the search.</p>
        </div>
      )}

      {!loading && !error && picksByRound.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>
              Showing <span className="font-bold text-slate-300">{filteredPicks.length}</span>
              {filteredPicks.length !== data.picks.length && (
                <> of {data.picks.length}</>
              )}
              {' '}picks
            </span>
          </div>

          {picksByRound.map(([round, picks]) => (
            <section
              key={round}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10"
            >
              {/*
                Sticky header is NOT inside overflow:hidden — that would break
                viewport sticky under the nav. Rounding when stuck is toggled via
                IntersectionObserver on a 1px sentinel instead.
              */}
              <StickyRoundHeader round={round} pickCount={picks.length} />
              <div className="overflow-hidden rounded-b-2xl">
                {picks.map((pick) => {
                  const highlighted = highlightPlayerId != null && Number(pick.personId) === highlightPlayerId;
                  return (
                    <DraftPickRow
                      key={pick.key}
                      pick={pick}
                      highlighted={highlighted}
                      rowRef={highlighted ? highlightRef : undefined}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
