import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  mlbTeams,
  teamLogoUrl,
  playerHeadshotUrl,
  FALLBACK_HEADSHOT,
  retiredPlayerTeamOverride,
} from '../utils/mlbHelpers';
import { TabBar, Select, SegmentedControl, BaseballSpinner, LoadingSpinner, stickyTeamAbbrHeadAfterRank, stickyTeamAbbrCellAfterRank, stickyRankHead, stickyRankCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT } from '../components/ui';
import { TABLE_TEXT_CLASS } from '../theme/tableTheme';
import TeamAbbrCell from '../components/TeamAbbrCell';
import { restoreListScroll, saveListScroll } from '../utils/listScrollRestore';
import {
  enrichMoversWithDeltaScores,
  formatDeltaScore,
} from '../utils/playerDeltaScore';
import { useTheme } from '../context/ThemeContext.jsx';

const STATS_APP_RETURN_KEY = 'stats-center:return';
const STATS_APP_SCROLL_KEY = 'stats-center';

const TEAM_OPTIONS = mlbTeams.map((t) => ({
  value: t.id,
  label: `${t.name} (${t.abbr})`,
}));
const MLB_TEAM_ID_SET = new Set(mlbTeams.map((t) => t.id));
const AL_TEAM_IDS = new Set([108, 110, 111, 114, 116, 117, 118, 133, 136, 139, 140, 141, 142, 145, 147]);
const MLB_SCOPE_LOGO = 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg';
const AL_SCOPE_LOGO = 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/159.svg';
const NL_SCOPE_LOGO = 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/160.svg';

const HOT_COLD_SCOPE_OPTIONS = [
  { value: 'all', label: 'All Teams', icon: MLB_SCOPE_LOGO },
  { value: 'AL', label: 'American League', icon: AL_SCOPE_LOGO },
  { value: 'NL', label: 'National League', icon: NL_SCOPE_LOGO },
  ...mlbTeams.map((t) => ({
    value: String(t.id),
    label: `${t.name} (${t.abbr})`,
    icon: teamLogoUrl(t.id),
  })),
];

const HOT_COLD_DAY_OPTIONS = [
  { value: 10, label: 'Last 10 Days' },
  { value: 15, label: 'Last 15 Days' },
  { value: 30, label: 'Last 30 Days' },
];

function filterHotColdPlayers(players, scope) {
  if (scope === 'all') return players;

  return players.filter((split) => {
    const teamId = Number(split.team?.id);
    if (!teamId) return false;
    if (scope === 'AL') return AL_TEAM_IDS.has(teamId);
    if (scope === 'NL') return MLB_TEAM_ID_SET.has(teamId) && !AL_TEAM_IDS.has(teamId);
    return teamId === Number(scope);
  });
}

function isHotColdTeamScope(scope) {
  return !['all', 'AL', 'NL'].includes(scope);
}

function sortHotColdByOps(players) {
  return [...players].sort((a, b) => (Number(b.stat?.ops) || 0) - (Number(a.stat?.ops) || 0));
}

function buildHotColdLists(rawPlayers, scope) {
  const minPlateAppearances = isHotColdTeamScope(scope) ? 1 : 15;
  const eligible = rawPlayers.filter((s) => (Number(s.stat?.plateAppearances) || 0) >= minPlateAppearances);
  const scoped = sortHotColdByOps(filterHotColdPlayers(eligible, scope));

  return {
    scoped,
    hot: scoped.slice(0, 10),
    cold: [...scoped].reverse().slice(0, 10),
  };
}

function opsToneClass(ops) {
  const value = Number(ops) || 0;
  if (value >= 1) return 'text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.35)]';
  if (value >= 0.9) return 'text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.28)]';
  if (value >= 0.8) return 'text-amber-300';
  if (value >= 0.73) return 'text-lime-200';
  if (value >= 0.68) return 'text-slate-200';
  if (value >= 0.6) return 'text-cyan-200';
  return 'text-sky-200 drop-shadow-[0_0_14px_rgba(186,230,253,0.35)]';
}

function opsRowToneClass(ops) {
  const value = Number(ops) || 0;
  if (value >= 1) return 'from-red-500/16 via-orange-500/6';
  if (value >= 0.9) return 'from-orange-500/14 via-amber-500/5';
  if (value >= 0.8) return 'from-amber-500/10 via-slate-800/0';
  if (value >= 0.73) return 'from-lime-500/7 via-slate-800/0';
  if (value >= 0.68) return 'from-slate-700/20 via-slate-800/0';
  if (value >= 0.6) return 'from-cyan-500/8 via-slate-800/0';
  return 'from-sky-300/12 via-cyan-300/5';
}

function loadStatsReturnState() {
  try {
    return JSON.parse(sessionStorage.getItem(STATS_APP_RETURN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function saveStatsReturnState(state) {
  try {
    sessionStorage.setItem(STATS_APP_RETURN_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

function sortMoversByChange(players) {
  return [...players].sort((a, b) => {
    const changeDiff = (b.deltaScore ?? 0) - (a.deltaScore ?? 0);
    if (changeDiff !== 0) return changeDiff;
    return (b.currentValue ?? 0) - (a.currentValue ?? 0);
  });
}

function restoredArray(value) {
  return Array.isArray(value) ? value : [];
}

function restoredNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// sportId    Level     Common Leagues1
// 1        Triple-A    AAA
// 12       Double-A    AA
// 13       High-A      A+
// 14       Single-A    A (Low-A)
// 16       Rookie      DSL, AZL, GCL, FCL, etc.

// ─── Pure helpers ─────────────────────────────────────────────────────────
const CURRENT_SEASON = new Date().getFullYear();

const getGamesPlayed = (person) => {
  let maxSeason = 0;
  let maxCareer = 0;
  for (const block of person.stats ?? []) {
    const gp = Number(block.splits?.[0]?.stat?.gamesPlayed) || 0;
    if (block.type?.displayName === 'season') maxSeason = Math.max(maxSeason, gp);
    else if (block.type?.displayName === 'career') maxCareer = Math.max(maxCareer, gp);
  }
  return maxSeason > 0 ? maxSeason : maxCareer;
};

const getLastSeasonPlayed = (person) => {
  if (person.lastPlayedDate) {
    const year = Number(String(person.lastPlayedDate).slice(0, 4));
    if (Number.isFinite(year) && year > 0) return year;
  }
  return 0;
};

const hasMlbTeamInStats = (person) =>
  (person.stats ?? []).some((block) =>
    (block.splits ?? []).some((split) => MLB_TEAM_ID_SET.has(Number(split.team?.id))),
  );

const isMlbPerson = (person) =>
  MLB_TEAM_ID_SET.has(Number(person.currentTeam?.id)) ||
  Boolean(person.mlbDebutDate) ||
  hasMlbTeamInStats(person);

const isCurrentMlbPerson = (person) =>
  MLB_TEAM_ID_SET.has(Number(person.currentTeam?.id));

const sortSearchResults = (people) =>
  [...people].sort((a, b) => {
    const currentMlbDiff = Number(isCurrentMlbPerson(b)) - Number(isCurrentMlbPerson(a));
    if (currentMlbDiff !== 0) return currentMlbDiff;
    const mlbDiff = Number(isMlbPerson(b)) - Number(isMlbPerson(a));
    if (mlbDiff !== 0) return mlbDiff;
    if (a.active !== b.active) return a.active ? -1 : 1;
    const seasonDiff = getLastSeasonPlayed(b) - getLastSeasonPlayed(a);
    if (seasonDiff !== 0) return seasonDiff;
    const gpDiff = getGamesPlayed(b) - getGamesPlayed(a);
    if (gpDiff !== 0) return gpDiff;
    return (a.fullName ?? '').localeCompare(b.fullName ?? '');
  });

const sortMappedSearchResults = (players) =>
  [...players].sort((a, b) => {
    const currentMlbDiff = Number(b.isCurrentMlb) - Number(a.isCurrentMlb);
    if (currentMlbDiff !== 0) return currentMlbDiff;
    const mlbDiff = Number(b.isMlb) - Number(a.isMlb);
    if (mlbDiff !== 0) return mlbDiff;
    if (a.active !== b.active) return a.active ? -1 : 1;
    const seasonDiff = (b.lastSeasonPlayed ?? 0) - (a.lastSeasonPlayed ?? 0);
    if (seasonDiff !== 0) return seasonDiff;
    const gpDiff = (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0);
    if (gpDiff !== 0) return gpDiff;
    return (a.fullName ?? '').localeCompare(b.fullName ?? '');
  });

const findStatBlock = (person, group, type) =>
  person.stats?.find(
    (s) => s.group?.displayName?.toLowerCase() === group && s.type?.displayName === type,
  )?.splits?.[0]?.stat;

const isPitcherPerson = (person) => person?.primaryPosition?.abbreviation === 'P';

const extractStatPreview = (person) => {
  const kind = isPitcherPerson(person) ? 'pitching' : 'hitting';
  const statType = person.active ? 'season' : 'career';
  const label = person.active ? String(CURRENT_SEASON) : 'Career';
  let stat = findStatBlock(person, kind, statType);
  if (!stat && person.active) stat = findStatBlock(person, kind, 'career');
  if (!stat && kind === 'pitching') stat = findStatBlock(person, 'hitting', statType);
  if (!stat) {
    return kind === 'pitching'
      ? { label, kind, era: '—', record: '—', strikeOuts: '—', whip: '—' }
      : { label, kind, avg: '—', homeRuns: '—', rbi: '—', ops: '—' };
  }
  if (kind === 'pitching') {
    return {
      label,
      kind,
      era: stat.era ?? '—',
      record: stat.wins != null || stat.losses != null ? `${stat.wins ?? 0}-${stat.losses ?? 0}` : '—',
      strikeOuts: stat.strikeOuts ?? '—',
      whip: stat.whip ?? '—',
    };
  }
  return {
    label,
    kind,
    avg: stat.avg ?? '—',
    homeRuns: stat.homeRuns ?? '—',
    rbi: stat.rbi ?? '—',
    ops: stat.ops ?? '—',
  };
};

const getPrimaryMlbTeamFromPersonStats = (person) => {
  const teams = new Map();

  for (const block of person.stats ?? []) {
    const splits = block.splits ?? [];
    for (const split of splits) {
      const team = split.team;
      if (!team?.id || !MLB_TEAM_ID_SET.has(Number(team.id))) continue;
      const games = Number(split.stat?.gamesPlayed ?? split.stat?.games ?? 0);
      const prev = teams.get(team.id) ?? { team, games: 0, seasons: new Set() };
      prev.games += Number.isFinite(games) ? games : 0;
      if (split.season) prev.seasons.add(split.season);
      teams.set(team.id, prev);
    }
  }

  return [...teams.values()]
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.seasons.size - a.seasons.size;
    })[0]?.team ?? null;
};

const hasRetiredStatusCode = (person) =>
  (person?.rosterEntries ?? []).some((entry) => entry?.status?.code === 'RET');

const shouldUseMostPlayedTeam = (person) =>
  person?.active === false && !hasRetiredStatusCode(person);

const mapSearchPerson = (person) => ({
  ...(() => {
    const retiredTeamOverride = retiredPlayerTeamOverride(person?.id);
    const primaryMlbTeam = retiredTeamOverride ?? (shouldUseMostPlayedTeam(person) ? getPrimaryMlbTeamFromPersonStats(person) : null);
    const displayTeam = primaryMlbTeam ?? person.currentTeam;
    return {
      id: person.id,
      fullName: person.fullName,
      team: displayTeam?.name ?? '—',
      teamId: displayTeam?.id,
      position: person.primaryPosition?.abbreviation ?? '',
      headshot: playerHeadshotUrl(person.id),
      active: person.active,
      isCurrentMlb: isCurrentMlbPerson(person),
      isMlb: isMlbPerson(person) || MLB_TEAM_ID_SET.has(Number(displayTeam?.id)),
      lastSeasonPlayed: getLastSeasonPlayed(person),
      gamesPlayed: getGamesPlayed(person),
      statsPreview: extractStatPreview(person),
    };
  })(),
});

const STAT_PREVIEW_COLS_BY_KIND = {
  hitting: [
    { key: 'avg', label: 'AVG' },
    { key: 'homeRuns', label: 'HR' },
    { key: 'rbi', label: 'RBI' },
    { key: 'ops', label: 'OPS' },
  ],
  pitching: [
    { key: 'era', label: 'ERA' },
    { key: 'record', label: 'W-L' },
    { key: 'strikeOuts', label: 'K' },
    { key: 'whip', label: 'WHIP' },
  ],
};

const processPlayerSeason = (person, season) => {
  const group = person.primaryPosition?.abbreviation === 'P' ? 'pitching' : 'hitting';
  const statsBlock = person.stats?.find((s) => s.group?.displayName?.toLowerCase() === group);
  if (!statsBlock?.splits?.length) return null;

  const splits = statsBlock.splits.filter((sp) => sp.season === season);
  if (!splits.length) return null;

  const teams = [];
  let stat = null;

  for (const split of splits) {
    if (split.team?.id) {
      teams.push({
        id: split.team.id,
        name: split.team.name,
        logo: `https://www.mlbstatic.com/team-logos/team-cap-on-light/${split.team.id}.svg`,
        logoDark: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${split.team.id}.svg`,
      });
    } else {
      stat = split.stat;
    }
  }

  if (!stat && splits.length > 0) {
    stat = splits[0].stat;
  }

  return { stat: stat ?? {}, teams, group };
};

const getTeamNames = (teams) => teams.map((t) => t.name).join(' / ') || 'N/A';

const EXODUS_HERO_STATS = {
  hitting: ['avg', 'obp', 'slg', 'ops'],
  pitching: ['era', 'whip', 'strikeoutsPer9Inn', 'winPercentage'],
};

const HERO_LABELS = {
  avg: 'AVG', obp: 'OBP', slg: 'SLG', ops: 'OPS',
  era: 'ERA', whip: 'WHIP', strikeoutsPer9Inn: 'K/9', winPercentage: 'W%',
};

const LOWER_IS_BETTER = new Set(['era', 'whip']);

const SCORE_TONE_STYLES = {
  positive: {
    card: 'border-emerald-500/35 bg-gradient-to-b from-emerald-500/[0.12] via-slate-950 to-black hover:border-emerald-500/50',
    glow: 'bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_50%)]',
    badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    photo: 'bg-emerald-500/20',
  },
  negative: {
    card: 'border-red-500/35 bg-gradient-to-b from-red-500/[0.10] via-slate-950 to-black hover:border-red-500/50',
    glow: 'bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_50%)]',
    badge: 'bg-red-500/15 border-red-500/30 text-red-300',
    photo: 'bg-red-500/20',
  },
  neutral: {
    card: 'border-slate-600/60 bg-gradient-to-b from-slate-900 via-slate-950 to-black hover:border-slate-500/50',
    glow: 'bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.10),transparent_50%)]',
    badge: 'bg-slate-700/50 border-slate-600/60 text-slate-300',
    photo: 'bg-slate-500/20',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────
function StatPreviewStrip({ preview }) {
  if (!preview) return null;
  const columns = STAT_PREVIEW_COLS_BY_KIND[preview.kind] ?? STAT_PREVIEW_COLS_BY_KIND.hitting;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 ">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {preview.label}
      </span>
      {columns.map(({ key, label }) => (
        <span key={key} className="text-[11px] sm:text-xs tabular-nums">
          <span className="text-slate-500 mr-1">{label}</span>
          <span className="text-slate-200 font-medium">{preview[key] ?? '—'}</span>
        </span>
      ))}
    </div>
  );
}

/** Shared watermark behind player photos — identical layout in light & dark. */
const WATCHLIST_WATERMARK_CLASS =
  'absolute top-14 left-1/2 w-[200px] h-[200px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none';

function PlayerSearchRow({ player, isWatched, isWatchAnimating, onToggleWatch }) {
  const { isDark } = useTheme();
  // Cap logos share the same SVG canvas (size matches). Light = cap-on-light (full color);
  // dark = cap-on-dark. Small inline logo can use full-color mark in light mode.
  const watermarkSrc = player.teamId
    ? teamLogoUrl(player.teamId, { preferDark: isDark })
    : '';
  const inlineLogoSrc = player.teamId
    ? teamLogoUrl(player.teamId, isDark ? { preferDark: true } : { forceRegular: true })
    : '';

  return (
    <div className="relative flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/25 transition-colors">
      <Link to={`/player/${player.id}`} className="flex items-end gap-3 flex-1 min-w-0">
        <div className="relative w-24 h-22 flex-shrink-0 overflow-hidden">
          {player.teamId && (
            <img
              src={watermarkSrc}
              alt=""
              className={`${WATCHLIST_WATERMARK_CLASS} ${isDark ? 'opacity-30' : 'opacity-100'}`}
              onError={(e) => {
                // Same size fallback: full-color mark if themed cap is missing
                const img = e.currentTarget;
                if (!img.dataset.fallback && player.teamId) {
                  img.dataset.fallback = '1';
                  img.src = teamLogoUrl(player.teamId, { forceRegular: true });
                  return;
                }
                img.style.display = 'none';
              }}
            />
          )}
          <img
            src={playerHeadshotUrl(player.id)}
            alt=""
            className="relative z-10 w-21 h-21 top-2 object-contain"
            onError={(e) => { e.currentTarget.src = FALLBACK_HEADSHOT; }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate hover:text-accent-400 transition-colors">
            {player.fullName}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
            {player.teamId && (
              <img
                src={inlineLogoSrc}
                alt=""
                className="w-4 h-4 object-contain flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <span className="truncate">{player.team}</span>
            {player.position && (
              <span className="text-slate-600">· {player.position}</span>
            )}
          </div>

          <StatPreviewStrip preview={player.statsPreview} />
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onToggleWatch(player)}
        className={[
          'absolute right-3 text-xs px-3 py-1.5 font-semibold rounded-xl flex items-center gap-1 border transition-all active:scale-[0.98] flex-shrink-0 mt-0.5',
          isWatchAnimating ? 'watch-pop' : '',
          isWatched
            ? isDark
              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
              : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'
            : isDark
              ? 'bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border-yellow-400/30'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300',
        ].join(' ')}
      >
        {isWatched ? '✕ Unwatch' : '★ Watch'}
      </button>
    </div>
  );
}

function HotColdPlayerRow({ player, team, ops, rank, accentClass, days = 10, onPlayerClick }) {
  const { isDark } = useTheme();
  const playerId = player?.id;
  const watermarkSrc = team?.id
    ? teamLogoUrl(team.id, { preferDark: isDark })
    : '';
  const inlineLogoSrc = team?.id
    ? teamLogoUrl(team.id, isDark ? { preferDark: true } : { forceRegular: true })
    : '';
  const className = 'flex items-center gap-3 px-4 pt-4 border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors cursor-pointer block w-full';
  const content = (
    <>
      <span className="w-10 text-center flex-shrink-0 font-black text-3xl italic text-slate-200 leading-none select-none">
        {rank}
      </span>
      <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden">
        {team?.id && (
          <img
            src={watermarkSrc}
            alt=""
            className={`absolute top-12 left-8 w-[150px] h-[150px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none ${isDark ? 'opacity-50' : 'opacity-100'}`}
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback && team?.id) {
                img.dataset.fallback = '1';
                img.src = teamLogoUrl(team.id, { forceRegular: true });
                return;
              }
              img.style.display = 'none';
            }}
          />
        )}
        <img
          src={playerHeadshotUrl(playerId)}
          alt=""
          className="relative z-10 w-20 h-20 object-cover"
          onError={(e) => { e.currentTarget.src = FALLBACK_HEADSHOT; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate hover:text-accent-400 transition-colors">
          {player?.fullName ?? '—'}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          {team?.id && (
            <img
              src={inlineLogoSrc}
              alt=""
              className="w-3.5 h-3.5 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <span className="truncate">{team?.name}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-display text-xl tabular-nums ${accentClass}`}>{ops ?? '—'}</div>
        <div className="text-[10px] text-slate-500">OPS ({days}d)</div>
      </div>
    </>
  );

  if (!playerId) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link to={`/player/${playerId}`} className={className} onClick={onPlayerClick}>
      {content}
    </Link>
  );
}

function TeamHotColdAvatar({ teamId, playerId }) {
  const { isDark } = useTheme();
  const watermarkSrc = teamId
    ? teamLogoUrl(teamId, { preferDark: isDark })
    : '';
  return (
    <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden">
      {teamId && (
        <img
          src={watermarkSrc}
          alt=""
          className={`absolute top-8 left-6 w-24 h-24 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none ${isDark ? 'opacity-35' : 'opacity-100'}`}
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallback && teamId) {
              img.dataset.fallback = '1';
              img.src = teamLogoUrl(teamId, { forceRegular: true });
              return;
            }
            img.style.display = 'none';
          }}
        />
      )}
      <img
        src={playerHeadshotUrl(playerId)}
        alt=""
        className="relative z-10 w-14 h-14 object-cover"
        onError={(e) => { e.currentTarget.src = FALLBACK_HEADSHOT; }}
      />
    </div>
  );
}

function TeamHotColdPlayerRow({ split, rank, days = 10, onPlayerClick }) {
  const player = split?.player;
  const team = split?.team;
  const stat = split?.stat ?? {};
  const playerId = player?.id;
  const ops = stat.ops ?? split?.value;
  const rowTone = opsRowToneClass(ops);
  const statTone = opsToneClass(ops);
  const className = `group flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 bg-gradient-to-r to-transparent hover:bg-slate-800/25 transition-colors cursor-pointer w-full ${rowTone}`;
  const content = (
    <>
      <span className="w-9 text-center flex-shrink-0 font-black text-2xl italic text-slate-200 leading-none select-none">
        {rank}
      </span>
      <TeamHotColdAvatar teamId={team?.id} playerId={playerId} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate group-hover:text-accent-400 transition-colors">
          {player?.fullName ?? '—'}
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span>{team?.name ?? '—'}</span>
          <span>{Number(stat.plateAppearances) || 0} PA</span>
          <span>{stat.homeRuns ?? 0} HR</span>
          <span>{stat.rbi ?? 0} RBI</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-display text-2xl tabular-nums ${statTone}`}>{ops ?? '—'}</div>
        <div className="text-[10px] text-slate-500">OPS ({days}d)</div>
      </div>
    </>
  );

  if (!playerId) return <div className={className}>{content}</div>;
  return (
    <Link to={`/player/${playerId}`} className={className} onClick={onPlayerClick}>
      {content}
    </Link>
  );
}

function WatchlistSection({ watchlist, watchAnimId, onToggleWatch, onClear }) {
  const { isDark } = useTheme();
  if (!watchlist.length) return null;
  return (
    <div className={[
      'rounded-3xl overflow-hidden border',
      isDark ? 'bg-slate-900 border-yellow-500/20' : 'bg-white border-amber-300/60 shadow-sm',
    ].join(' ')}>
      <div className={[
        'px-4 py-3 border-b flex items-center justify-between gap-2',
        isDark ? 'border-slate-800' : 'border-amber-200/80',
      ].join(' ')}>
        <div className={[
          'text-xs font-semibold uppercase tracking-wider',
          isDark ? 'text-yellow-300/90' : 'text-amber-800',
        ].join(' ')}>
          ★ Watchlist · {watchlist.length} player{watchlist.length !== 1 ? 's' : ''}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>
      {watchlist.map((player) => (
        <PlayerSearchRow
          key={player.id}
          player={player}
          isWatched
          isWatchAnimating={watchAnimId === player.id}
          onToggleWatch={onToggleWatch}
        />
      ))}
    </div>
  );
}

function MoverPlayerCard({ player, onPlayerClick }) {
  const heroStats = EXODUS_HERO_STATS[player.group] || EXODUS_HERO_STATS.hitting;
  const tone = SCORE_TONE_STYLES[player.scoreTone] || SCORE_TONE_STYLES.neutral;

  return (
    <div className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border shadow-xl shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 ${tone.card}`}>
      <div className={`absolute inset-0 pointer-events-none ${tone.glow}`} />

      <div className="relative p-4 sm:p-5 border-b border-white/5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="relative flex-shrink-0">
            <div className={`absolute inset-0 rounded-xl sm:rounded-2xl blur-xl ${tone.photo}`} />
            <img
              src={player.photo}
              alt={player.fullName}
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover border border-white/10 shadow-lg"
              onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/player/${player.playerId}`}
                  onClick={onPlayerClick}
                  className="text-base sm:text-lg font-bold text-white truncate block hover:text-emerald-400 transition-colors"
                >
                  {player.fullName}
                </Link>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                  Role-adjusted 2025 → 2026
                </div>
              </div>
              <div className={`flex-shrink-0 px-2.5 py-1 rounded-xl border text-center ${tone.badge}`}>
                <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Change</div>
                <div className="text-sm sm:text-base font-black tabular-nums leading-tight">
                  {formatDeltaScore(player.deltaScore ?? 0)}
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] sm:text-[11px]">
              <div className="rounded-xl border border-white/5 bg-black/20 px-2 py-1.5">
                <div className="text-slate-500 uppercase tracking-wider">2025 Value</div>
                <div className="text-slate-200 font-bold tabular-nums">{player.prevValue ?? '—'}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/20 px-2 py-1.5">
                <div className="text-slate-500 uppercase tracking-wider">2026 Adj</div>
                <div className="text-slate-200 font-bold tabular-nums">{player.currentValue ?? '—'}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/20 px-2 py-1.5">
                <div className="text-slate-500 uppercase tracking-wider">Role</div>
                <div className="text-slate-200 font-bold tabular-nums">
                  {player.roleWeight != null ? `${Math.round(player.roleWeight * 100)}%` : '—'}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {player.teams2025.map((t, i) => (
                  <img
                    key={i}
                    src={t.logoDark}
                    alt={t.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ))}
                <span className="truncate text-slate-300 font-medium">{getTeamNames(player.teams2025)}</span>
              </div>

              <div className="hidden sm:flex w-7 h-7 rounded-full bg-slate-800 border border-white/5 items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="sm:hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500">→</div>

              <div className="flex items-center gap-2 min-w-0">
                {player.teams2026.map((t, i) => (
                  <img
                    key={i}
                    src={t.logoDark}
                    alt={t.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ))}
                <span className="truncate font-medium text-slate-200">{getTeamNames(player.teams2026)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {heroStats.map((k) => {
            const prev = Number(player.statsPrev?.[k] ?? 0);
            const curr = Number(player.statsCurrent?.[k] ?? 0);

            const isLowerBetter = LOWER_IS_BETTER.has(k);
            const improved = isLowerBetter ? curr < prev : curr > prev;
            const declined = isLowerBetter ? curr > prev : curr < prev;

            return (
              <div
                key={k}
                className={`relative overflow-hidden rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                  improved
                    ? 'border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.10] via-slate-900 to-slate-950'
                    : declined
                    ? 'border-red-500/20 bg-gradient-to-b from-red-500/[0.08] via-slate-900 to-slate-950'
                    : 'border-white/5 bg-gradient-to-b from-slate-900 to-slate-950'
                }`}
              >
                <div className="relative p-2.5 sm:p-3">
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {HERO_LABELS[k] || k.toUpperCase()}
                    </div>
                    <div
                      className={`flex items-center justify-center rounded-full border w-4 h-4 sm:w-5 sm:h-5 ${
                        improved
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : declined
                          ? 'border-red-500/20 bg-red-500/10 text-red-400'
                          : 'border-slate-700 bg-slate-800 text-slate-500'
                      }`}
                    >
                      {improved ? (
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 3l5 6h-3v8H8V9H5l5-6z" clipRule="evenodd" />
                        </svg>
                      ) : declined ? (
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 17l-5-6h3V3h4v8h3l-5 6z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-slate-500" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-3">
                    <div className="text-lg sm:text-2xl font-black tracking-tight text-white leading-none">
                      {player.statsCurrent?.[k] ?? '—'}
                    </div>
                    <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-1">
                      <div className="text-[10px] sm:text-[11px] text-slate-500 truncate">Prev: {player.statsPrev?.[k] ?? '—'}</div>
                      <div
                        className={`text-[10px] sm:text-[11px] font-semibold tabular-nums flex-shrink-0 ${
                          improved ? 'text-emerald-400' : declined ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
                        {improved
                          ? `+${(curr - prev).toFixed(isLowerBetter ? 2 : 3)}`
                          : declined
                          ? `${(curr - prev).toFixed(isLowerBetter ? 2 : 3)}`
                          : '±0.000'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function StatsApp() {
  const [initialReturnState] = useState(() => loadStatsReturnState());
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchEnriching, setIsSearchEnriching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [error, setError] = useState(null);
  const searchSeqRef = useRef(0);
  const [activeTab, setActiveTab] = useState(initialReturnState?.activeTab ?? 'search');
  const [rosterImpactView, setRosterImpactView] = useState(initialReturnState?.rosterImpactView ?? 'exodus');

  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlbWatchlist') ?? '[]');
    } catch {
      return [];
    }
  });
  const [watchAnimId, setWatchAnimId] = useState(null);

  const [formerTeamId, setFormerTeamId] = useState(() => restoredNumber(initialReturnState?.formerTeamId, 140));
  const [exodusResults, setExodusResults] = useState(() => restoredArray(initialReturnState?.exodusResults));
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [acquisitionTeamId, setAcquisitionTeamId] = useState(() => restoredNumber(initialReturnState?.acquisitionTeamId, 140));
  const [acquisitionResults, setAcquisitionResults] = useState(() => restoredArray(initialReturnState?.acquisitionResults));

  const [hotPlayers, setHotPlayers] = useState([]);
  const [coldPlayers, setColdPlayers] = useState([]);
  const [hotColdSourcePlayers, setHotColdSourcePlayers] = useState([]);
  const [hotColdTeamPlayers, setHotColdTeamPlayers] = useState([]);
  const [hotColdScope, setHotColdScope] = useState(initialReturnState?.hotColdScope ?? 'all');
  const [hotColdDays, setHotColdDays] = useState(initialReturnState?.hotColdDays ?? 10);
  const [isHotColdLoading, setIsHotColdLoading] = useState(false);
  const [shouldRestoreStatsScroll, setShouldRestoreStatsScroll] = useState(Boolean(initialReturnState?.restoreScroll));

  const [impactRankings, setImpactRankings] = useState(() => restoredArray(initialReturnState?.impactRankings));
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [impactProgress, setImpactProgress] = useState({
    current: 0,
    total: 0,
    teamName: '',
  });

  useEffect(() => {
    localStorage.setItem('mlbWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const refreshSavedWatchlist = async () => {
      try {
        const saved = JSON.parse(localStorage.getItem('mlbWatchlist') ?? '[]');
        if (!saved.length) return;
        const hydrate = encodeURIComponent(
          `currentTeam,rosterEntries,stats(group=[hitting,pitching],type=[season,career,yearByYear],season=${CURRENT_SEASON})`,
        );
        const updated = await Promise.all(
          saved.map(async (p) => {
            try {
              const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${p.id}?hydrate=${hydrate}`);
              const person = (await res.json()).people?.[0];
              return person ? mapSearchPerson(person) : p;
            } catch {
              return p;
            }
          }),
        );
        setWatchlist(updated);
      } catch {
        /* ignore */
      }
    };
    refreshSavedWatchlist();
  }, []);

  const searchPlayers = async (nameOverride) => {
    const name = (nameOverride ?? playerName).trim();
    if (!name) return;
    const seq = searchSeqRef.current + 1;
    searchSeqRef.current = seq;
    setIsLoading(true);
    setIsSearchEnriching(false);
    setSearchMessage('Searching players...');
    setError(null);
    setSearchResults([]);
    try {
      const hydrate = encodeURIComponent(
        `currentTeam,rosterEntries,stats(group=[hitting,pitching],type=[season,career,yearByYear],season=${CURRENT_SEASON})`,
      );

      const ALL_SPORTS = '1,11,12,13,14,16,23';


      const searchRes = await fetch(
        `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportIds=${ALL_SPORTS}&hydrate=currentTeam`,
      );
      if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
      const searchData = await searchRes.json();
      if (!searchData.people?.length) throw new Error(`No players found matching "${name}"`);

      const sortedPeople = sortSearchResults(searchData.people);
      if (seq !== searchSeqRef.current) return;
      setSearchResults(sortMappedSearchResults(sortedPeople.map(mapSearchPerson)));
      setIsLoading(false);
      setIsSearchEnriching(true);
      setSearchMessage(`Found ${sortedPeople.length} player${sortedPeople.length !== 1 ? 's' : ''}. Loading stat previews...`);

      let completed = 0;
      await Promise.allSettled(
        sortedPeople.map(async (p) => {
          try {
            const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${p.id}?hydrate=${hydrate}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const person = (await res.json()).people?.[0];
            if (!person || seq !== searchSeqRef.current) return;
            const mapped = mapSearchPerson(person);
            setSearchResults((current) =>
              sortMappedSearchResults(current.map((row) => (row.id === mapped.id ? { ...row, ...mapped } : row))),
            );
            setWatchlist((current) =>
              current.map((row) => (row.id === mapped.id ? { ...row, ...mapped } : row)),
            );
          } finally {
            completed += 1;
            if (seq === searchSeqRef.current) {
              setSearchMessage(
                completed < sortedPeople.length
                  ? `Loading stat previews ${completed}/${sortedPeople.length}...`
                  : '',
              );
            }
          }
        }),
      );
    } catch (err) {
      if (seq === searchSeqRef.current) {
        setError(err.message);
        setSearchMessage('');
      }
    } finally {
      if (seq === searchSeqRef.current) {
        setIsLoading(false);
        setIsSearchEnriching(false);
      }
    }
  };

  const addToWatchlist = (player) => {
    if (watchlist.some((p) => p.id === player.id)) return;
    setWatchlist([player, ...watchlist]);
  };

  const removeFromWatchlist = (id) => setWatchlist(watchlist.filter((p) => p.id !== id));

  const toggleWatchlist = (player) => {
    if (!player?.id) return;
    const exists = watchlist.some((p) => p.id === player.id);
    if (exists) {
      removeFromWatchlist(player.id);
      return;
    }
    addToWatchlist(player);
    setWatchAnimId(player.id);
    window.setTimeout(() => setWatchAnimId(null), 250);
  };

  const analyzeTeamExodus = async () => {
    if (!formerTeamId) return;
    setIsAnalyzing(true);
    setExodusResults([]);

    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/teams/${formerTeamId}/roster?season=2025&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
      );
      const data = await res.json();
      const roster = data.roster ?? [];

      const movers = roster
        .map((entry) => {
          const person = entry.person;
          const prev = processPlayerSeason(person, '2025');
          const current = processPlayerSeason(person, '2026');

          if (!prev || !current) return null;

          const wasOnFormerTeam = prev.teams.some((t) => t.id === formerTeamId);
          const stillOnFormerTeam = current.teams.some((t) => t.id === formerTeamId);

          if (!wasOnFormerTeam || stillOnFormerTeam) return null;

          return {
            fullName: person.fullName,
            playerId: person.id,
            photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${person.id}/headshot/67/current`,
            teams2025: prev.teams,
            teams2026: current.teams,
            statsPrev: prev.stat,
            statsCurrent: current.stat,
            group: prev.group,
          };
        })
        .filter(Boolean);

      const scored = await enrichMoversWithDeltaScores(movers);
      setExodusResults(sortMoversByChange(scored));
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeTeamAcquisitions = async () => {
    if (!acquisitionTeamId) return;
    setIsAnalyzing(true);
    setAcquisitionResults([]);
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/teams/${acquisitionTeamId}/roster?season=2026&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
      );
      const data = await res.json();
      const roster = data.roster ?? [];

      const acquired = roster
        .map((entry) => {
          const person = entry.person;
          const prev = processPlayerSeason(person, '2025');
          const current = processPlayerSeason(person, '2026');
          if (!prev || !current) return null;

          const wasOnTeam = prev.teams.some((t) => t.id === acquisitionTeamId);
          const isOnTeamNow = current.teams.some((t) => t.id === acquisitionTeamId);
          if (wasOnTeam || !isOnTeamNow) return null;

          return {
            fullName: person.fullName,
            playerId: person.id,
            photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${person.id}/headshot/67/current`,
            teams2025: prev.teams,
            teams2026: current.teams,
            statsPrev: prev.stat,
            statsCurrent: current.stat,
            group: current.group,
          };
        })
        .filter(Boolean);

      const scored = await enrichMoversWithDeltaScores(acquired);
      setAcquisitionResults(sortMoversByChange(scored));
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchHotCold = async (days = hotColdDays) => {
    setIsHotColdLoading(true);
    setHotPlayers([]);
    setColdPlayers([]);
    setHotColdSourcePlayers([]);
    setHotColdTeamPlayers([]);
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - days);
      const fmt = (d) => d.toISOString().split('T')[0];
      const dateRange = `startDate=${fmt(startDate)}&endDate=${fmt(today)}`;

      // Use byDateRange stats for a true "cold" list (not just bottom of a top-50 leaders list).
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/stats?stats=byDateRange&group=hitting&sportIds=1&playerPool=all&limit=5000&hydrate=person,team&${dateRange}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const splits = data.stats?.[0]?.splits ?? [];

      const { scoped, hot, cold } = buildHotColdLists(splits, hotColdScope);

      setHotColdSourcePlayers(splits);
      setHotColdTeamPlayers(isHotColdTeamScope(hotColdScope) ? scoped : []);
      setHotPlayers(hot);
      setColdPlayers(cold);
    } catch (err) {
      console.error(err);
    } finally {
      setIsHotColdLoading(false);
    }
  };

  const moverWeightedValue = (player) =>
    Number((((player.currentValue ?? 0) * (player.roleWeight ?? 1))).toFixed(1));

  const topMoverName = (players) => {
    const top = [...players].sort((a, b) => moverWeightedValue(b) - moverWeightedValue(a))[0];
    return top?.fullName ?? '—';
  };

  const impactTrend = (netImpact) => {
    if (netImpact >= 50) return { label: 'Big Upgrade', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' };
    if (netImpact >= 15) return { label: 'Slight Gain', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' };
    if (netImpact <= -50) return { label: 'Big Loss', className: 'text-red-300 bg-red-500/10 border-red-500/25' };
    if (netImpact <= -15) return { label: 'Slight Loss', className: 'text-red-300 bg-red-500/10 border-red-500/25' };
    return { label: 'Neutral', className: 'text-slate-300 bg-slate-700/40 border-slate-600/50' };
  };

  const mapRosterMover = (person, prev, current) => ({
    fullName: person.fullName,
    playerId: person.id,
    photo: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${person.id}/headshot/67/current`,
    teams2025: prev.teams,
    teams2026: current.teams,
    statsPrev: prev.stat,
    statsCurrent: current.stat,
    group: current.group ?? prev.group,
  });

  const getTeamRosterMovers = (roster, teamId, direction) =>
    roster
      .map((entry) => {
        const person = entry.person;
        const prev = processPlayerSeason(person, '2025');
        const current = processPlayerSeason(person, '2026');
        if (!prev || !current) return null;

        const wasOnTeam = prev.teams.some((t) => t.id === teamId);
        const isOnTeamNow = current.teams.some((t) => t.id === teamId);

        if (direction === 'added' && (!isOnTeamNow || wasOnTeam)) return null;
        if (direction === 'lost' && (!wasOnTeam || isOnTeamNow)) return null;

        return mapRosterMover(person, prev, current);
      })
      .filter(Boolean);

  const analyzeImpactRankings = async () => {
    setIsRankingLoading(true);
    setImpactRankings([]);
    setImpactProgress({ current: 0, total: mlbTeams.length, teamName: 'Starting analysis…' });

    const rankings = [];

    for (let i = 0; i < mlbTeams.length; i += 1) {
      const team = mlbTeams[i];
      setImpactProgress({ current: i, total: mlbTeams.length, teamName: team.name });

      try {
        const [prevRosterRes, currentRosterRes] = await Promise.all([
          fetch(
            `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?season=2025&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
          ),
          fetch(
            `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?season=2026&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
          ),
        ]);

        const [prevRosterData, currentRosterData] = await Promise.all([
          prevRosterRes.json(),
          currentRosterRes.json(),
        ]);

        const lostMovers = getTeamRosterMovers(prevRosterData.roster ?? [], team.id, 'lost');
        const addedMovers = getTeamRosterMovers(currentRosterData.roster ?? [], team.id, 'added');
        const [lostPlayers, addedPlayers] = await Promise.all([
          enrichMoversWithDeltaScores(lostMovers),
          enrichMoversWithDeltaScores(addedMovers),
        ]);

        const addedValue = addedPlayers.reduce((sum, player) => sum + moverWeightedValue(player), 0);
        const lostValue = lostPlayers.reduce((sum, player) => sum + moverWeightedValue(player), 0);
        const netImpact = addedValue - lostValue;
        const trend = impactTrend(netImpact);

        rankings.push({
          teamId: team.id,
          teamName: team.name,
          abbr: team.abbr,
          logo: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`,
          addedCount: addedPlayers.length,
          lostCount: lostPlayers.length,
          addedValue: Number(addedValue.toFixed(1)),
          lostValue: Number(lostValue.toFixed(1)),
          netImpact: Number(netImpact.toFixed(1)),
          bestAdd: topMoverName(addedPlayers),
          biggestLoss: topMoverName(lostPlayers),
          trendLabel: trend.label,
          trendClassName: trend.className,
        });
      } catch (err) {
        console.error(`Failed to analyze team ${team.id}`, err);
      } finally {
        setImpactProgress({ current: i + 1, total: mlbTeams.length, teamName: team.name });
      }
    }

    rankings.sort((a, b) => b.netImpact - a.netImpact);
    setImpactRankings(rankings);
    setImpactProgress({ current: mlbTeams.length, total: mlbTeams.length, teamName: 'Complete' });
    setIsRankingLoading(false);
  };

  const handleHotColdDaysChange = (days) => {
    setHotColdDays(days);
    fetchHotCold(days);
  };

  const handleHotColdScopeChange = (scope) => {
    setHotColdScope(scope);
    const { scoped, hot, cold } = buildHotColdLists(hotColdSourcePlayers, scope);
    setHotColdTeamPlayers(isHotColdTeamScope(scope) ? scoped : []);
    setHotPlayers(hot);
    setColdPlayers(cold);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'hotcold' && hotColdSourcePlayers.length === 0 && !isHotColdLoading) {
      fetchHotCold(hotColdDays);
    }
  };

  const handleStatsPlayerNavigate = () => {
    saveListScroll(STATS_APP_SCROLL_KEY);
    saveStatsReturnState({
      activeTab,
      hotColdScope,
      hotColdDays,
      rosterImpactView,
      formerTeamId,
      acquisitionTeamId,
      exodusResults,
      acquisitionResults,
      impactRankings,
      restoreScroll: true,
    });
  };

  useEffect(() => {
    if (activeTab !== 'hotcold') return;
    if (hotColdSourcePlayers.length > 0 || isHotColdLoading) return;
    fetchHotCold(hotColdDays);
    // Intentionally runs on mount/return only; filter changes recalc from loaded source rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldRestoreStatsScroll || isHotColdLoading) return;
    if (activeTab === 'hotcold' && hotColdSourcePlayers.length === 0) return;
    restoreListScroll(STATS_APP_SCROLL_KEY);
    setShouldRestoreStatsScroll(false);
    try {
      sessionStorage.removeItem(STATS_APP_RETURN_KEY);
    } catch {
      /* ignore */
    }
  }, [activeTab, hotColdSourcePlayers.length, isHotColdLoading, shouldRestoreStatsScroll]);

  const impactProgressPercent = impactProgress.total
    ? Math.round((impactProgress.current / impactProgress.total) * 100)
    : 0;
  const impactBaseballPercent = Math.min(98, Math.max(2, impactProgressPercent));
  const isHotColdTeamView = isHotColdTeamScope(hotColdScope);
  const hotColdSelectedScope = HOT_COLD_SCOPE_OPTIONS.find((option) => option.value === hotColdScope);

  return (
    <div className="max-w-5xl mx-auto sm:px-6 py-0 sm:py-8">
      <div className="mb-0 px-4 sm:px-0">
        <div className={`text-accent-400 text-xs font-mono tracking-[3px] m-4 uppercase`}>Player Stats</div>
        <h1 className="font-display py-3 text-4xl sm:text-5xl tracking-tighter">Stats Center</h1>
      </div>

      <TabBar
        className="mb-4"
        variant="page"
        tabClassName="font-semibold"
        tabs={[
          { key: 'search', label: 'Player Search' },
          { key: 'hotcold', label: 'Hot & Cold' },
          { key: 'roster-impact', label: 'Roster Impact' },
        ]}
        activeKey={activeTab}
        onChange={handleTabChange}
      />

      <div className="px-4 sm:px-0 pb-6 sm:pb-0">
      {/* PLAYER SEARCH TAB */}
      {activeTab === 'search' && (
        <div className="space-y-6">

          {/* SEARCH BAR */}
          <div className="">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (playerName.trim()) searchPlayers();
                e.currentTarget.querySelector('input')?.blur();
              }}
            >
              <input
                type="search"
                enterKeyHint="search"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={`flex-1 bg-slate-800 border border-slate-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-accent-500 transition-colors`}
                placeholder="Search players…"
              />
              <button
                type="submit"
                disabled={isLoading || !playerName.trim()}
                aria-label="Search players"
                className={`w-11 h-11 flex items-center justify-center bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all active:scale-95 flex-shrink-0`}
              >
                {isLoading ? (
                  <BaseballSpinner size="xs" inline />
                ) : (
                  <i className="fa-solid fa-magnifying-glass text-sm" />
                )}
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6 text-center text-red-400">
              {error}
            </div>
          )}

          {(isLoading || isSearchEnriching || searchMessage) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400 flex items-center gap-3">
              {(isLoading || isSearchEnriching) && <BaseballSpinner size="xs" inline />}
              <span>{searchMessage || 'Loading...'}</span>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-500">
                {searchResults.length} player{searchResults.length !== 1 ? 's' : ''} found · active players first
                {isSearchEnriching ? ' · stat previews updating' : ''}
              </div>
              {searchResults.map((player) => (
                <PlayerSearchRow
                  key={player.id}
                  player={player}
                  isWatched={watchlist.some((p) => p.id === player.id)}
                  isWatchAnimating={watchAnimId === player.id}
                  onToggleWatch={toggleWatchlist}
                />
              ))}
            </div>
          )}

          <WatchlistSection
            watchlist={watchlist}
            watchAnimId={watchAnimId}
            onToggleWatch={toggleWatchlist}
            onClear={() => setWatchlist([])}
          />
        </div>
      )}

      {/* HOT & COLD TAB */}
      {activeTab === 'hotcold' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-lg">Who's Hot & Who's Cold</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Based on OPS over the last {hotColdDays} days
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select
                value={hotColdScope}
                onChange={handleHotColdScopeChange}
                options={HOT_COLD_SCOPE_OPTIONS}
                size="sm"
                className="w-full sm:w-56 flex-shrink-0"
                buttonClassName="border-slate-600 py-2"
              />
              <Select
                value={hotColdDays}
                onChange={handleHotColdDaysChange}
                options={HOT_COLD_DAY_OPTIONS}
                size="sm"
                className="w-full sm:w-32 flex-shrink-0 "
                buttonClassName="border-slate-600 py-2"
              />
            </div>
          </div>

          {isHotColdLoading && <LoadingSpinner size="lg" py="py-16" />}

          {!isHotColdLoading && isHotColdTeamView && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden pb-2">
              <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-red-500/10 via-slate-900 to-sky-300/10">
                <div className="font-semibold text-lg flex items-center gap-2">
                  <span className="text-red-300">Hottest</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-sky-200">Coldest</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {hotColdSelectedScope?.label ?? 'Selected team'} hitters · sorted by OPS · Last {hotColdDays} days
                </div>
              </div>

              {hotColdTeamPlayers.map((split, i) => (
                <TeamHotColdPlayerRow
                  key={split.player?.id ?? i}
                  split={split}
                  rank={i + 1}
                  days={hotColdDays}
                  onPlayerClick={handleStatsPlayerNavigate}
                />
              ))}

              {hotColdTeamPlayers.length === 0 && (
                <div className="px-5 py-10 text-sm text-slate-500 text-center">
                  No team hitters recorded a plate appearance for this date range.
                </div>
              )}
            </div>
          )}

          {!isHotColdLoading && !isHotColdTeamView && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 ">
              <div className="bg-slate-900 border border-orange-500/30 rounded-3xl overflow-hidden pb-4">
                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent ">
                  <div className="font-semibold text-lg flex items-center gap-2 ">
                    🔥 <span className="text-orange-400">Who's Hot</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Highest OPS · Last {hotColdDays} days</div>
                </div>
                {hotPlayers.map((p, i) => (
                  <HotColdPlayerRow
                    key={p.player?.id ?? i}
                    player={p.player}
                    team={p.team}
                    ops={p.value ?? p.stat?.ops}
                    rank={i + 1}
                    accentClass="text-orange-400"
                    days={hotColdDays}
                    onPlayerClick={handleStatsPlayerNavigate}
                  />
                ))}
                {hotPlayers.length === 0 && (
                  <div className="px-5 py-8 text-sm text-slate-500 text-center">
                    No qualified hot hitters for this filter.
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-blue-500/30 rounded-3xl overflow-hidden pb-4">
                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-blue-500/10 to-transparent ">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    ❄️ <span className="text-blue-400">Who's Cold</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Lowest OPS · Last {hotColdDays} days</div>
                </div>
                {coldPlayers.map((p, i) => (
                  <HotColdPlayerRow
                    key={p.player?.id ?? i}
                    player={p.player}
                    team={p.team}
                    ops={p.value ?? p.stat?.ops}
                    rank={i + 1}
                    accentClass="text-blue-400"
                    days={hotColdDays}
                    onPlayerClick={handleStatsPlayerNavigate}
                  />
                ))}
                {coldPlayers.length === 0 && (
                  <div className="px-5 py-8 text-sm text-slate-500 text-center">
                    No qualified cold hitters for this filter.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ROSTER IMPACT TAB */}
      {activeTab === 'roster-impact' && (
        <div>
          <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 w-full sm:w-fit mb-6">
            <SegmentedControl
              value={rosterImpactView}
              onChange={setRosterImpactView}
              variant="pill"
              size="sm"
              className="w-full sm:w-auto"
              options={[
                { value: 'exodus', label: 'Team Exodus' },
                { value: 'acquisitions', label: 'Team Acquisitions' },
                { value: 'rankings', label: 'Impact Rankings' },
              ]}
            />
          </div>

      {rosterImpactView === 'exodus' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">Team Exodus Analyzer</h3>
            <p className="text-sm text-slate-400 mb-4">
              Players who left after 2025 — sorted by adjusted 2026 value. Change blends production, WAR, Statcast quality, role size, and small-sample regression.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium tracking-wide">
                  TEAM THEY LEFT (2025 ROSTER)
                </label>
                <Select
                  value={formerTeamId}
                  onChange={setFormerTeamId}
                  options={TEAM_OPTIONS}
                  buttonClassName="border-slate-600 py-3"
                />
              </div>
              <button
                onClick={analyzeTeamExodus}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all flex-shrink-0 w-full sm:w-auto"
              >
                {isAnalyzing ? 'Analyzing Exodus…' : 'Analyze Exodus'}
              </button>
            </div>
          </div>

          {exodusResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {exodusResults.map((player) => (
                <MoverPlayerCard key={player.playerId} player={player} onPlayerClick={handleStatsPlayerNavigate} />
              ))}
            </div>
          )}

          {!isAnalyzing && exodusResults.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No players left this roster after 2025. Try a different team.
            </div>
          )}
        </div>
      )}

      {rosterImpactView === 'acquisitions' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">Team Acquisitions Analyzer</h3>
            <p className="text-sm text-slate-400 mb-4">
              Players added for 2026 — sorted by adjusted 2026 value. Change compares each player to their own 2025 baseline, weighted by role and sample reliability.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium tracking-wide">
                  TEAM (2026 ROSTER)
                </label>
                <Select
                  value={acquisitionTeamId}
                  onChange={setAcquisitionTeamId}
                  options={TEAM_OPTIONS}
                  buttonClassName="border-slate-600 py-3"
                />
              </div>
              <button
                onClick={analyzeTeamAcquisitions}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all flex-shrink-0 w-full sm:w-auto"
              >
                {isAnalyzing ? 'Analyzing Acquisitions…' : 'Analyze Acquisitions'}
              </button>
            </div>
          </div>

          {acquisitionResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {acquisitionResults.map((player) => (
                <MoverPlayerCard key={player.playerId} player={player} onPlayerClick={handleStatsPlayerNavigate} />
              ))}
            </div>
          )}

          {!isAnalyzing && acquisitionResults.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No acquisitions detected (or not enough stats yet). Try a different team.
            </div>
          )}
        </div>
      )}

      {rosterImpactView === 'rankings' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">League Impact Rankings</h3>
            <p className="text-sm text-slate-400 mb-4">
              Which teams gained the most roster value? Net impact compares adjusted 2026 value added against adjusted 2026 value lost.
            </p>
            <button
              onClick={analyzeImpactRankings}
              disabled={isRankingLoading}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all"
            >
              {isRankingLoading ? 'Analyzing all 30 teams…' : 'Calculate League-Wide Impact Rankings'}
            </button>

            {isRankingLoading && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400 mb-2">
                  <span className="truncate">
                    {impactProgress.current >= impactProgress.total
                      ? 'Finishing rankings…'
                      : `Analyzing ${impactProgress.teamName}`}
                  </span>
                  <span className="font-mono text-emerald-300 tabular-nums flex-shrink-0">
                    {impactProgress.current}/{impactProgress.total} · {impactProgressPercent}%
                  </span>
                </div>
                <div className="impact-fire-track">
                  <div
                    className="impact-fire-fill"
                    style={{ width: `${impactProgressPercent}%` }}
                  />
                  <div
                    className="impact-baseball-runner"
                    style={{ left: `${impactBaseballPercent}%` }}
                    aria-hidden
                  >
                    <BaseballSpinner size="lg" inline className="impact-baseball-spinner" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {impactRankings.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
              <div className={TABLE_SCROLL}>
                <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className={`${stickyRankHead('bg-slate-900')} font-medium text-slate-400`}>#</th>
                      <th className={`${stickyTeamAbbrHeadAfterRank('bg-slate-900')} font-medium text-slate-400`}>Team</th>
                      <th className={`${statHead('text-right font-medium text-slate-400')}`}>Net Impact</th>
                      <th className={`${statHead('text-right font-medium text-slate-400')}`}>Added Value</th>
                      <th className={`${statHead('text-right font-medium text-slate-400')}`}>Lost Value</th>
                      <th className={`${statHead('text-center font-medium text-slate-400')}`}>Added</th>
                      <th className={`${statHead('text-center font-medium text-slate-400')}`}>Lost</th>
                      <th className={`${statHead('text-left font-medium text-slate-400')}`}>Best Add</th>
                      <th className={`${statHead('text-left font-medium text-slate-400')}`}>Biggest Loss</th>
                      <th className={`${statHead('text-center font-medium text-slate-400')}`}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactRankings.map((team, i) => (
                      <tr key={team.teamId} className="group border-b border-slate-700 last:border-none hover:bg-slate-800/50">
                        <td className={`${stickyRankCell('bg-slate-900')} font-mono font-bold text-emerald-400`}>{i + 1}</td>
                        <td className={stickyTeamAbbrCellAfterRank('bg-slate-900')}>
                          <TeamAbbrCell teamId={team.teamId} teamName={team.teamName} abbrOnly size="sm" abbrClassName="text-xs font-semibold" />
                        </td>
                        <td className={statCell(`text-right font-black ${team.netImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`)}>
                          {formatDeltaScore(team.netImpact)}
                        </td>
                        <td className={statCell('text-right font-semibold text-emerald-300')}>{team.addedValue.toFixed(1)}</td>
                        <td className={statCell('text-right font-semibold text-red-300')}>{team.lostValue.toFixed(1)}</td>
                        <td className={statCell('text-center')}>{team.addedCount}</td>
                        <td className={statCell('text-center')}>{team.lostCount}</td>
                        <td className={statCell('text-left text-slate-300 max-w-[180px] truncate')}>{team.bestAdd}</td>
                        <td className={statCell('text-left text-slate-300 max-w-[180px] truncate')}>{team.biggestLoss}</td>
                        <td className={statCell('text-center')}>
                          <span className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${team.trendClassName}`}>
                            {team.trendLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      )}
      </div>
    </div>
  );
}
