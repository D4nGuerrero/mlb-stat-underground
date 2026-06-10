import { useState, useEffect } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { Link } from 'react-router-dom';
import {
  mlbTeams,
  teamLogoUrl,
  playerHeadshotUrl,
  FALLBACK_HEADSHOT,
} from '../utils/mlbHelpers';
import { TabBar, Select, stickyTeamAbbrHeadAfterRank, stickyTeamAbbrCellAfterRank, stickyRankHead, stickyRankCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT } from '../components/ui';
import { TABLE_TEXT_CLASS } from '../theme/tableTheme';
import TeamAbbrCell from '../components/TeamAbbrCell';
import {
  enrichMoversWithDeltaScores,
  formatDeltaScore,
} from '../utils/playerDeltaScore';

const TEAM_OPTIONS = mlbTeams.map((t) => ({
  value: t.id,
  label: `${t.name} (${t.abbr})`,
}));

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

const sortSearchResults = (people) =>
  [...people].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const seasonDiff = getLastSeasonPlayed(b) - getLastSeasonPlayed(a);
    if (seasonDiff !== 0) return seasonDiff;
    const gpDiff = getGamesPlayed(b) - getGamesPlayed(a);
    if (gpDiff !== 0) return gpDiff;
    return (a.fullName ?? '').localeCompare(b.fullName ?? '');
  });

const findStatBlock = (person, group, type) =>
  person.stats?.find(
    (s) => s.group?.displayName?.toLowerCase() === group && s.type?.displayName === type,
  )?.splits?.[0]?.stat;

const extractStatPreview = (person) => {
  const statType = person.active ? 'season' : 'career';
  const label = person.active ? String(CURRENT_SEASON) : 'Career';
  let stat = findStatBlock(person, 'hitting', statType);
  if (!stat && person.active) stat = findStatBlock(person, 'hitting', 'career');
  if (!stat) return { label, kind: 'hitting', avg: '—', homeRuns: '—', rbi: '—', ops: '—' };
  return {
    label,
    kind: 'hitting',
    avg: stat.avg ?? '—',
    homeRuns: stat.homeRuns ?? '—',
    rbi: stat.rbi ?? '—',
    ops: stat.ops ?? '—',
  };
};

const mapSearchPerson = (person) => ({
  id: person.id,
  fullName: person.fullName,
  team: person.currentTeam?.name ?? '—',
  teamId: person.currentTeam?.id,
  position: person.primaryPosition?.abbreviation ?? '',
  headshot: playerHeadshotUrl(person.id),
  active: person.active,
  statsPreview: extractStatPreview(person),
});

const STAT_PREVIEW_COLS = [
  { key: 'avg', label: 'AVG' },
  { key: 'homeRuns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'ops', label: 'OPS' },
];

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
    card: `border-${THEME_COLOR}-500/35 bg-gradient-to-b from-${THEME_COLOR}-500/[0.12] via-slate-950 to-black hover:border-${THEME_COLOR}-500/50`,
    glow: 'bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_50%)]',
    badge: `bg-${THEME_COLOR}-500/15 border-${THEME_COLOR}-500/30 text-${THEME_COLOR}-300`,
    photo: `bg-${THEME_COLOR}-500/20`,
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
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 ">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {preview.label}
      </span>
      {STAT_PREVIEW_COLS.map(({ key, label }) => (
        <span key={key} className="text-[11px] sm:text-xs tabular-nums">
          <span className="text-slate-500 mr-1">{label}</span>
          <span className="text-slate-200 font-medium">{preview[key] ?? '—'}</span>
        </span>
      ))}
    </div>
  );
}

function PlayerSearchRow({ player, isWatched, isWatchAnimating, onToggleWatch }) {
  return (
   <div className="relative flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/25 transition-colors">
  <Link to={`/player/${player.id}`} className="flex items-end gap-3 flex-1 min-w-0">

    {/* IMAGE AREA */}
    <div className="relative w-24 h-22 flex-shrink-0 overflow-hidden">
      {/* BACKGROUND LOGO */}
      <img
        src={teamLogoUrl(player.teamId)}
        alt=""
        className="
          absolute
          top-14
          left-1/2
          w-[200px]
          max-w-none
          -translate-x-1/2
          -translate-y-1/2
          opacity-30
          object-contain
          pointer-events-none
        "
      />

      {/* PLAYER */}
      <img
        src={playerHeadshotUrl(player.id)}
        alt=""
        className="relative z-10 w-21 h-21 top-2 object-contain"
        onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
      />
    </div>

    <div className="flex-1 min-w-0">
      <div className={`font-semibold text-sm truncate hover:text-${THEME_COLOR}-400 transition-colors`}>
        {player.fullName}
      </div>

      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
        {player.teamId && (
          <img
            src={teamLogoUrl(player.teamId)}
            alt=""
            className="w-4 h-4 object-contain flex-shrink-0"
            onError={(e) => (e.target.style.display = 'none')}
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
        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
        : 'bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    ].join(' ')}
  >
    {isWatched ? '✕ Unwatch' : '★ Watch'}
  </button>
</div>
  );
}

function HotColdPlayerRow({ player, team, ops, rank, accentClass }) {
  const playerId = player?.id;
  const className = 'flex items-center gap-3 px-4 pt-4 border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors cursor-pointer block w-full';
  const content = (
    <>
     <span
  className="
    w-10
    text-center
    flex-shrink-0
    font-black
    text-3xl
    italic
    text-white-700
    leading-none
    select-none
  "
>
  {rank}
</span>
    <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden">

      {/* BACKGROUND LOGO */}

  <img
    src={teamLogoUrl(team?.id)}
    alt=""
    className="
      absolute
      top-12
      left-8
      w-[150px]
      h-[150px]
      max-w-none
      -translate-x-1/2
      -translate-y-1/2
      opacity-50
      object-contain
      pointer-events-none
    "
  />

  <img
    src={playerHeadshotUrl(playerId)}
    alt=""
    className="relative z-10 w-20 h-20 object-cover"
    onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
  />
</div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate hover:text-${THEME_COLOR}-400 transition-colors`}>
          {player?.fullName ?? '—'}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          {team?.id && (
            <img
              src={teamLogoUrl(team.id)}
              alt=""
              className="w-3.5 h-3.5 object-contain"
              onError={(e) => (e.target.style.display = 'none')}
            />
          )}
          <span className="truncate">{team?.name}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-display text-xl tabular-nums ${accentClass}`}>{ops ?? '—'}</div>
        <div className="text-[10px] text-slate-500">OPS (10d)</div>
      </div>
    </>
  );

  if (!playerId) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link to={`/player/${playerId}`} className={className}>
      {content}
    </Link>
  );
}

function WatchlistSection({ watchlist, watchAnimId, onToggleWatch, onClear }) {
  if (!watchlist.length) return null;
  return (
    <div className="bg-slate-900 border border-yellow-500/20 rounded-3xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-yellow-300/90 uppercase tracking-wider">
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

function MoverPlayerCard({ player }) {
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
                  className={`text-base sm:text-lg font-bold text-white truncate block hover:text-${THEME_COLOR}-400 transition-colors`}
                >
                  {player.fullName}
                </Link>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                  2025 → 2026 YoY
                </div>
              </div>
              <div className={`flex-shrink-0 px-2.5 py-1 rounded-xl border text-center ${tone.badge}`}>
                <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Score</div>
                <div className="text-sm sm:text-base font-black tabular-nums leading-tight">
                  {formatDeltaScore(player.deltaScore ?? 0)}
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
                    ? `border-${THEME_COLOR}-500/20 bg-gradient-to-b from-${THEME_COLOR}-500/[0.10] via-slate-900 to-slate-950`
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
                          ? `border-${THEME_COLOR}-500/20 bg-${THEME_COLOR}-500/10 text-${THEME_COLOR}-400`
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
                          improved ? `text-${THEME_COLOR}-400` : declined ? 'text-red-400' : 'text-slate-500'
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
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('search');

  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlbWatchlist') ?? '[]');
    } catch {
      return [];
    }
  });
  const [watchAnimId, setWatchAnimId] = useState(null);

  const [formerTeamId, setFormerTeamId] = useState(140);
  const [exodusResults, setExodusResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [acquisitionTeamId, setAcquisitionTeamId] = useState(140);
  const [acquisitionResults, setAcquisitionResults] = useState([]);

  const [hotPlayers, setHotPlayers] = useState([]);
  const [coldPlayers, setColdPlayers] = useState([]);
  const [isHotColdLoading, setIsHotColdLoading] = useState(false);

  // New state for league-wide rankings
  const [exodusRankings, setExodusRankings] = useState([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('mlbWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const refreshSavedWatchlist = async () => {
      try {
        const saved = JSON.parse(localStorage.getItem('mlbWatchlist') ?? '[]');
        if (!saved.length || saved.every((p) => p.statsPreview)) return;
        const hydrate = encodeURIComponent(
          `currentTeam,stats(group=[hitting,pitching],type=[season,career],season=${CURRENT_SEASON})`,
        );
        const updated = await Promise.all(
          saved.map(async (p) => {
            if (p.statsPreview) return p;
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
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    try {
      const hydrate = encodeURIComponent(
        `currentTeam,stats(group=[hitting,pitching],type=[season,career],season=${CURRENT_SEASON})`,
      );

      const ALL_SPORTS = '1,11,12,13,14,16';


      const searchRes = await fetch(
        `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportIds=${ALL_SPORTS}&hydrate=${hydrate}`,
      );
      if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
      const searchData = await searchRes.json();
      if (!searchData.people?.length) throw new Error(`No players found matching "${name}"`);
      setSearchResults(sortSearchResults(searchData.people).map(mapSearchPerson));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
      scored.sort((a, b) => (a.deltaScore ?? 0) - (b.deltaScore ?? 0));
      setExodusResults(scored);
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
      scored.sort((a, b) => (b.deltaScore ?? 0) - (a.deltaScore ?? 0));
      setAcquisitionResults(scored);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchHotCold = async () => {
    setIsHotColdLoading(true);
    setHotPlayers([]);
    setColdPlayers([]);
    try {
      const today = new Date();
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(today.getDate() - 10);
      const fmt = (d) => d.toISOString().split('T')[0];
      const dateRange = `startDate=${fmt(tenDaysAgo)}&endDate=${fmt(today)}`;

      // Use byDateRange stats for a true "cold" list (not just bottom of a top-50 leaders list).
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/stats?stats=byDateRange&group=hitting&sportIds=1&playerPool=all&limit=5000&hydrate=person,team&${dateRange}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const splits = data.stats?.[0]?.splits ?? [];

      // Filter out tiny samples so the lists feel sane.
      const eligible = splits.filter((s) => (Number(s.stat?.plateAppearances) || 0) >= 15);
      eligible.sort((a, b) => (Number(b.stat?.ops) || 0) - (Number(a.stat?.ops) || 0));


     
      
      setHotPlayers(eligible.slice(0, 10));
      setColdPlayers([...eligible].reverse().slice(0, 10));
    } catch (err) {
      console.error(err);
    } finally {
      setIsHotColdLoading(false);
    }
  };

  // ── NEW: League-wide Exodus Rankings ─────────────────────────────────────────────
  const analyzeAllExodus = async () => {
    setIsRankingLoading(true);
    setExodusRankings([]);

    const rankings = [];

    for (const team of mlbTeams) {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?season=2025&rosterType=fullRoster&hydrate=person(stats(type=yearByYear))`
        );
        const data = await res.json();
        const roster = data.roster ?? [];

        const movers = roster
          .map((entry) => {
            const person = entry.person;
            const prev = processPlayerSeason(person, '2025');
            const current = processPlayerSeason(person, '2026');

            if (!prev || !current) return null;

            const wasOnTeam = prev.teams.some((t) => t.id === team.id);
            const stillOnTeam = current.teams.some((t) => t.id === team.id);

            if (!wasOnTeam || stillOnTeam) return null;

            return {
              fullName: person.fullName,
              group: prev.group,
              statsCurrent: current.stat,
            };
          })
          .filter(Boolean);

        const lostHitters = movers.filter((m) => m.group === 'hitting');
        const lostPitchers = movers.filter((m) => m.group === 'pitching');

        const avgOPS = lostHitters.length
          ? lostHitters.reduce((sum, p) => sum + (Number(p.statsCurrent.ops) || 0), 0) / lostHitters.length
          : 0;

        const avgERA = lostPitchers.length
          ? lostPitchers.reduce((sum, p) => sum + (Number(p.statsCurrent.era) || 0), 0) / lostPitchers.length
          : 0;

        const hitterScore = avgOPS * lostHitters.length;
        const pitcherScore = (5.0 - avgERA) * lostPitchers.length;
        const exodusScore = hitterScore + pitcherScore;

        rankings.push({
          teamId: team.id,
          teamName: team.name,
          abbr: team.abbr,
          logo: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`,
          lostPlayers: movers.length,
          lostHitters: lostHitters.length,
          lostPitchers: lostPitchers.length,
          avgOPS: avgOPS.toFixed(3),
          avgERA: avgERA.toFixed(2),
          exodusScore: Number(exodusScore.toFixed(2)),
        });
      } catch (err) {
        console.error(`Failed to analyze team ${team.id}`, err);
      }
    }

    rankings.sort((a, b) => b.exodusScore - a.exodusScore);
    setExodusRankings(rankings);
    setIsRankingLoading(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'hotcold' && hotPlayers.length === 0 && !isHotColdLoading) {
      fetchHotCold();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <div className={`text-${THEME_COLOR}-400 text-xs font-mono tracking-[3px] mb-1 uppercase`}>Player Stats</div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tighter">Stats Center</h1>
        <p className="text-slate-400 mt-1 text-sm">Search any player · Watch favorites · Track Team Exodus</p>
      </div>

      <TabBar
        className="mb-6"
        tabs={[
          { key: 'search', label: 'Player Search' },
          { key: 'hotcold', label: '🔥 Hot & Cold ❄️' },
          { key: 'exodus', label: 'Team Exodus' },
          { key: 'acquisitions', label: 'Team Acquisitions' },
          { key: 'rankings', label: 'Exodus Rankings' },
        ]}
        activeKey={activeTab}
        onChange={handleTabChange}
      />

      {/* PLAYER SEARCH TAB */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5">
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
                className={`flex-1 bg-slate-800 border border-slate-600 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-${THEME_COLOR}-500 transition-colors`}
                placeholder="Search players…"
              />
              <button
                type="submit"
                disabled={isLoading || !playerName.trim()}
                aria-label="Search players"
                className={`w-11 h-11 flex items-center justify-center bg-${THEME_COLOR}-500 hover:bg-${THEME_COLOR}-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all active:scale-95 flex-shrink-0`}
              >
                <i className={`fa-solid fa-magnifying-glass text-sm ${isLoading ? 'animate-pulse' : ''}`} />
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6 text-center text-red-400">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className={`w-8 h-8 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
            </div>
          )}

          {!isLoading && searchResults.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-500">
                {searchResults.length} player{searchResults.length !== 1 ? 's' : ''} found · active players first
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Who's Hot & Who's Cold</h3>
              <p className="text-sm text-slate-400 mt-0.5">Based on OPS over the last 10 days</p>
            </div>
            <button
              onClick={fetchHotCold}
              disabled={isHotColdLoading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isHotColdLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {isHotColdLoading && (
            <div className="flex justify-center py-16">
              <div className={`w-8 h-8 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
            </div>
          )}

          {!isHotColdLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 ">
              <div className="bg-slate-900 border border-orange-500/30 rounded-3xl overflow-hidden pb-4">
                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent ">
                  <div className="font-semibold text-lg flex items-center gap-2 ">
                    🔥 <span className="text-orange-400">Who's Hot</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Highest OPS · Last 10 days</div>
                </div>
                {hotPlayers.map((p, i) => (
                  <HotColdPlayerRow
                    key={p.player?.id ?? i}
                    player={p.player}
                    team={p.team}
                    ops={p.value ?? p.stat?.ops}
                    rank={i + 1}
                    accentClass="text-orange-400"
                  />
                ))}
              </div>

              <div className="bg-slate-900 border border-blue-500/30 rounded-3xl overflow-hidden pb-4">
                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-blue-500/10 to-transparent ">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    ❄️ <span className="text-blue-400">Who's Cold</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Lowest OPS · Last 10 days</div>
                </div>
                {coldPlayers.map((p, i) => (
                  <HotColdPlayerRow
                    key={p.player?.id ?? i}
                    player={p.player}
                    team={p.team}
                    ops={p.value ?? p.stat?.ops}
                    rank={i + 1}
                    accentClass="text-blue-400"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEAM EXODUS TAB */}
      {activeTab === 'exodus' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">Team Exodus Analyzer</h3>
            <p className="text-sm text-slate-400 mb-4">
              Players who left after 2025 — sorted by biggest decline first. Score blends wRC+, WAR, Statcast skills, and defense (0 = same, + = better, − = worse).
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
                className={`px-6 py-3 bg-${THEME_COLOR}-500 hover:bg-${THEME_COLOR}-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all flex-shrink-0 w-full sm:w-auto`}
              >
                {isAnalyzing ? 'Analyzing Exodus…' : 'Analyze Exodus'}
              </button>
            </div>
          </div>

          {exodusResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {exodusResults.map((player) => (
                <MoverPlayerCard key={player.playerId} player={player} />
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

      {/* TEAM ACQUISITIONS TAB */}
      {activeTab === 'acquisitions' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">Team Acquisitions Analyzer</h3>
            <p className="text-sm text-slate-400 mb-4">
              Players added for 2026 — sorted by biggest improvement first. Same YoY score as Exodus (green = up, gray = flat, red = down).
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
                className={`px-6 py-3 bg-${THEME_COLOR}-500 hover:bg-${THEME_COLOR}-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all flex-shrink-0 w-full sm:w-auto`}
              >
                {isAnalyzing ? 'Analyzing Acquisitions…' : 'Analyze Acquisitions'}
              </button>
            </div>
          </div>

          {acquisitionResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {acquisitionResults.map((player) => (
                <MoverPlayerCard key={player.playerId} player={player} />
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

      {/* NEW: EXODUS RANKINGS TAB */}
      {activeTab === 'rankings' && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 mb-6">
            <h3 className="font-semibold text-lg mb-1">League Exodus Rankings</h3>
            <p className="text-sm text-slate-400 mb-4">
              Which teams got played the hardest? Ranking by total talent lost in the 2025–2026 exodus.
            </p>
            <button
              onClick={analyzeAllExodus}
              disabled={isRankingLoading}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm active:scale-[0.985] transition-all"
            >
              {isRankingLoading ? 'Analyzing all 30 teams…' : 'Calculate League-Wide Exodus Rankings'}
            </button>
          </div>

          {isRankingLoading && (
            <div className="flex justify-center py-16">
              <div className={`w-8 h-8 border-2 border-${THEME_COLOR}-500 border-t-transparent rounded-full animate-spin`} />
            </div>
          )}

          {exodusRankings.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
              <div className={TABLE_SCROLL}>
                <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className={`${stickyRankHead('bg-slate-900')} font-medium text-slate-400`}>#</th>
                      <th className={`${stickyTeamAbbrHeadAfterRank('bg-slate-900')} font-medium text-slate-400`}>Team</th>
                      <th className={`${statHead('text-center font-medium text-slate-400')}`}>Lost</th>
                      <th className={`${statHead('text-center font-medium text-slate-400')}`}>OPS</th>
                      <th className={`${statHead('text-center font-medium text-slate-400')}`}>ERA</th>
                      <th className={`${statHead('text-right font-medium text-slate-400')}`}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exodusRankings.map((team, i) => (
                      <tr key={team.teamId} className="group border-b border-slate-700 last:border-none hover:bg-slate-800/50">
                        <td className={`${stickyRankCell('bg-slate-900')} font-mono font-bold text-${THEME_COLOR}-400`}>{i + 1}</td>
                        <td className={stickyTeamAbbrCellAfterRank('bg-slate-900')}>
                          <TeamAbbrCell teamId={team.teamId} teamName={team.teamName} abbrOnly size="sm" abbrClassName="text-xs font-semibold" />
                        </td>
                        <td className={statCell('text-center')}>{team.lostPlayers}</td>
                        <td className={statCell(`text-center text-${THEME_COLOR}-300`)}>{team.avgOPS}</td>
                        <td className={statCell('text-center text-rose-300')}>{team.avgERA}</td>
                        <td className={statCell('text-right font-bold text-rose-400')}>{team.exodusScore}</td>
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
  );
}