import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gamepad2,
  Search,
  Star,
  StickyNote,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  mlbTeams,
  playerHeadshotUrl,
  teamLogoUrl,
  FALLBACK_HEADSHOT,
} from '../utils/mlbHelpers';
import { Select, BaseballSpinner, Modal } from '../components/ui';

const DEFAULT_ORG_ID = 140;
const PROSPECT_WATCHLIST_KEY = 'mlbProspectWatchlist';
const PROSPECT_NOTES_KEY = 'mlbProspectNotes';
const CURRENT_SEASON = 2026;
const MINOR_SPORT_IDS = new Set([11, 12, 13, 14, 16]);
const FORM_MODES = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7' },
  { value: 'last14', label: 'Last 14' },
  { value: 'season', label: 'Season' },
];
const LEVEL_ORDER = {
  11: 1,
  12: 2,
  13: 3,
  14: 4,
  16: 5,
};
const LEVEL_SHORT = {
  11: 'AAA',
  12: 'AA',
  13: 'A+',
  14: 'A',
  16: 'Rookie',
};
const LEVEL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: '11', label: 'AAA' },
  { value: '12', label: 'AA' },
  { value: '13', label: 'A+' },
  { value: '14', label: 'A' },
  { value: '16', label: 'Rookie' },
];
const TEAM_OPTIONS = mlbTeams.map((team) => ({
  value: team.id,
  label: `${team.name} (${team.abbr})`,
}));

const miniStatCell = 'px-1.5 py-1 text-right tabular-nums';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function prettyDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

function initialOrgId() {
  try {
    const favoriteTeams = JSON.parse(localStorage.getItem('mlbFavoriteTeams') ?? '[]');
    return Number(favoriteTeams?.[0]) || DEFAULT_ORG_ID;
  } catch {
    return DEFAULT_ORG_ID;
  }
}

function loadProspectWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(PROSPECT_WATCHLIST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function loadProspectNotes() {
  try {
    return JSON.parse(localStorage.getItem(PROSPECT_NOTES_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function watchedEntryFromPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    boxscoreName: player.boxscoreName ?? player.name,
    affiliate: {
      id: player.affiliate?.id,
      name: player.affiliate?.name,
      sportId: player.affiliate?.sport?.id ?? player.affiliate?.sportId,
      parentOrgId: player.affiliate?.parentOrgId,
    },
    kind: player.kind,
    summary: player.summary,
    season: player.season,
    updatedAt: new Date().toISOString(),
    tags: player.tags ?? [],
  };
}

function prospectHeadshotUrl(playerId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/c_fill,g_auto/w_180/v1/people/${playerId}/headshot/milb/current`;
}

function attachHeadshotFallback(event, playerId) {
  const img = event.currentTarget;
  if (!img.dataset.fallbackStage) {
    img.dataset.fallbackStage = 'mlb';
    img.src = playerHeadshotUrl(playerId);
    return;
  }
  img.src = FALLBACK_HEADSHOT;
}

function affiliateLogoUrl(team) {
  if (!team?.id) return '';
  if (team.parentOrgId === 140 && team.id === 2413) return 'https://www.mlbstatic.com/team-logos/625.svg';
  if (team.parentOrgId === 140 && team.id === 625) return 'https://www.mlbstatic.com/team-logos/411.svg';
  return `https://www.mlbstatic.com/team-logos/${team.id}.svg`;
}

function rookieFallbackLogo(team) {
  return teamLogoUrl(team.parentOrgId ?? DEFAULT_ORG_ID);
}

function sortAffiliates(teams) {
  return [...teams]
    .filter((team) => team.active && MINOR_SPORT_IDS.has(team.sport?.id))
    .sort((a, b) => {
      const levelDiff = (LEVEL_ORDER[a.sport?.id] ?? 99) - (LEVEL_ORDER[b.sport?.id] ?? 99);
      if (levelDiff) return levelDiff;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
}

function cleanNumber(value, fallback = '—') {
  if (value == null || value === '' || value === '.---' || value === '-.--' || value === '-') return fallback;
  return value;
}

function parseInnings(value) {
  if (!value) return 0;
  const [whole, frac = '0'] = String(value).split('.');
  return Number(whole) + (Number(frac) || 0) / 3;
}

function hitterScore(stat = {}) {
  return (
    (Number(stat.hits) || 0) * 2 +
    (Number(stat.doubles) || 0) * 2 +
    (Number(stat.triples) || 0) * 3 +
    (Number(stat.homeRuns) || 0) * 5 +
    (Number(stat.rbi) || 0) * 1.5 +
    (Number(stat.runs) || 0) +
    (Number(stat.baseOnBalls) || 0) +
    (Number(stat.stolenBases) || 0) * 1.5 -
    (Number(stat.strikeOuts) || 0) * 0.25
  );
}

function pitcherScore(stat = {}) {
  const ip = parseInnings(stat.inningsPitched);
  return (
    ip * 2.2 +
    (Number(stat.strikeOuts) || 0) * 1.4 -
    (Number(stat.earnedRuns) || 0) * 3 -
    (Number(stat.hits) || 0) * 0.65 -
    (Number(stat.baseOnBalls) || 0) * 0.8 +
    (Number(stat.wins) || 0) * 1.5 +
    (Number(stat.saves) || 0) * 1.5
  );
}

function statSummary(stat, kind, mode) {
  if (kind === 'batting') {
    const pieces = [
      `${cleanNumber(stat.avg)} AVG`,
      `OPS ${cleanNumber(stat.ops)}`,
      `${cleanNumber(stat.homeRuns, 0)} HR`,
    ];
    if (mode !== 'season') pieces.push(`${cleanNumber(stat.rbi, 0)} RBI`);
    return pieces.join(' · ');
  }

  const pieces = [
    `ERA ${cleanNumber(stat.era)}`,
    `WHIP ${cleanNumber(stat.whip)}`,
    `K/9 ${cleanNumber(stat.strikeoutsPer9Inn)}`,
  ];
  if (mode !== 'season') pieces.push(`${cleanNumber(stat.strikeOuts, 0)} K`);
  return pieces.join(' · ');
}

function buildDiscoveryTags(player) {
  const stat = player.stat ?? player.season ?? {};
  const sportId = player.affiliate?.sport?.id ?? player.affiliate?.sportId;
  const tags = [];

  if (player.kind === 'batting') {
    const ops = Number(stat.ops) || 0;
    const avg = Number(stat.avg) || 0;
    const hr = Number(stat.homeRuns) || 0;
    const sb = Number(stat.stolenBases) || 0;
    if (ops >= 0.9) tags.push('OPS .900+');
    if (avg >= 0.32) tags.push('Hot Bat');
    if (hr >= 2 || (player.mode === 'season' && hr >= 10)) tags.push('Power Spike');
    if (sb >= 3 || (player.mode === 'season' && sb >= 15)) tags.push('Speed Threat');
    if ((sportId === 13 || sportId === 14 || sportId === 16) && ops >= 0.82) tags.push('Sleeper Bat');
  } else {
    const era = Number(stat.era) || 99;
    const whip = Number(stat.whip) || 99;
    const k9 = Number(stat.strikeoutsPer9Inn) || 0;
    const bb9 = Number(stat.walksPer9Inn) || 0;
    if (era <= 2.75) tags.push('Shut-Down Arm');
    if (k9 >= 10.5) tags.push('K Machine');
    if (whip <= 1.1) tags.push('Command Zone');
    if (bb9 >= 4.5) tags.push('Control Issue');
    if ((sportId === 13 || sportId === 14 || sportId === 16) && era <= 3.5) tags.push('Sleeper Arm');
  }

  return tags.slice(0, 3);
}

function mapBoxPlayer(player, kind, affiliate) {
  const stat = player.stats?.[kind] ?? {};
  const season = player.seasonStats?.[kind] ?? {};
  const mapped = {
    id: player.person?.id,
    name: player.person?.fullName,
    boxscoreName: player.person?.boxscoreName ?? player.person?.fullName,
    affiliate,
    stat,
    season,
    summary: stat.summary ?? '',
    score: kind === 'batting' ? hitterScore(stat) : pitcherScore(stat),
    kind,
    mode: 'today',
  };
  return { ...mapped, tags: buildDiscoveryTags(mapped) };
}

function mapStatSplitPlayer(split, kind, affiliate, mode) {
  const stat = split?.stat ?? {};
  const mapped = {
    id: split?.player?.id,
    name: split?.player?.fullName,
    boxscoreName: split?.player?.boxscoreName ?? split?.player?.fullName,
    affiliate,
    stat,
    season: stat,
    summary: statSummary(stat, kind, mode),
    score: kind === 'batting' ? hitterScore(stat) : pitcherScore(stat),
    kind,
    mode,
  };
  return { ...mapped, tags: buildDiscoveryTags(mapped) };
}

function extractTeamPlayers(boxscore, side, affiliate) {
  const teamBox = boxscore?.teams?.[side];
  if (!teamBox?.players) return { hitters: [], pitchers: [] };

  const hitters = (teamBox.batters ?? [])
    .map((id) => teamBox.players[`ID${id}`])
    .filter((player) => player?.stats?.batting?.plateAppearances)
    .map((player) => mapBoxPlayer(player, 'batting', affiliate));

  const pitchers = (teamBox.pitchers ?? [])
    .map((id) => teamBox.players[`ID${id}`])
    .filter((player) => player?.stats?.pitching?.outs || player?.stats?.pitching?.inningsPitched)
    .map((player) => mapBoxPlayer(player, 'pitching', affiliate));

  return { hitters, pitchers };
}

function gameStatusLabel(game) {
  const state = game?.status?.abstractGameState;
  if (state === 'Final') return 'Final';
  if (state === 'Live') {
    return game.linescore?.currentInningOrdinal
      ? `${game.linescore.inningState ?? ''} ${game.linescore.currentInningOrdinal}`.trim()
      : 'Live';
  }
  return game?.status?.detailedState ?? 'Scheduled';
}

function scoreForSide(game, side) {
  return game?.teams?.[side]?.score ?? game?.linescore?.teams?.[side]?.runs ?? 0;
}

function rangeStartDate(endDate, days) {
  return shiftDate(endDate, -(days - 1));
}

async function fetchStatGroup(team, group, mode, endDate) {
  const params = new URLSearchParams({
    group,
    teamId: String(team.id),
    sportIds: String(team.sport.id),
    playerPool: 'all',
    limit: '200',
  });

  if (mode === 'season') {
    params.set('stats', 'season');
    params.set('season', String(CURRENT_SEASON));
  } else {
    const days = mode === 'last7' ? 7 : 14;
    params.set('stats', 'byDateRange');
    params.set('startDate', rangeStartDate(endDate, days));
    params.set('endDate', endDate);
  }

  const response = await fetch(`https://statsapi.mlb.com/api/v1/stats?${params.toString()}`);
  const data = await response.json();
  return data.stats?.[0]?.splits ?? [];
}

async function fetchAffiliateActiveRosterIds(team) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=active&season=${CURRENT_SEASON}&hydrate=person(currentTeam)`,
  );
  const data = await response.json();
  const entries = data.roster ?? [];

  return new Set(
    entries
      .filter((entry) => entry.status?.code === 'A' && entry.person?.currentTeam?.id === team.id)
      .map((entry) => Number(entry.person?.id))
      .filter(Boolean),
  );
}

function AffiliateLogo({ team, className = 'w-16 h-16' }) {
  const [src, setSrc] = useState(affiliateLogoUrl(team));
  return (
    <img
      src={src}
      alt=""
      className={`${className} object-contain drop-shadow-xl`}
      onError={() => {
        if (team.sport?.id === 16 && src !== rookieFallbackLogo(team)) {
          setSrc(rookieFallbackLogo(team));
          return;
        }
        setSrc(rookieFallbackLogo(team));
      }}
    />
  );
}

function TagPill({ tag }) {
  return (
    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
      {tag}
    </span>
  );
}

function PlayerChip({ player, onSelect, isWatched, onToggleWatch }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(player)}
      className="group relative w-full text-left flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/60 p-2 pr-9 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
    >
      <img
        src={prospectHeadshotUrl(player.id)}
        alt=""
        className="w-10 h-10 rounded-xl object-cover bg-slate-800"
        onError={(e) => attachHeadshotFallback(e, player.id)}
      />
      <div className="min-w-0">
        <div className="text-sm font-bold text-white truncate group-hover:text-emerald-300">
          {player.name}
        </div>
        <div className="text-[11px] text-slate-400 truncate">{player.summary || 'Box score line'}</div>
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatch?.(player);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onToggleWatch?.(player);
          }
        }}
        className={[
          'absolute right-2 top-1/2 -translate-y-1/2 rounded-full border p-1 transition-colors',
          isWatched
            ? 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300'
            : 'border-slate-700 bg-slate-900 text-slate-500 group-hover:text-yellow-300',
        ].join(' ')}
        aria-label={isWatched ? 'Remove from prospect watchlist' : 'Add to prospect watchlist'}
      >
        <Star size={13} fill={isWatched ? 'currentColor' : 'none'} />
      </span>
    </button>
  );
}

function PerformerCard({ title, player, tone = 'emerald', onSelectPlayer, isWatched, onToggleWatch }) {
  if (!player) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{title}</div>
        <div className="mt-2 text-sm text-slate-500">No box score yet</div>
      </div>
    );
  }

  const accent = tone === 'orange'
    ? 'text-orange-300 border-orange-500/25'
    : 'text-emerald-300 border-emerald-500/25';

  return (
    <div className={`rounded-2xl border bg-slate-950/45 p-3 ${accent}`}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{title}</div>
      <PlayerChip
        player={player}
        onSelect={onSelectPlayer}
        isWatched={isWatched?.(player.id)}
        onToggleWatch={onToggleWatch}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {player.tags?.map((tag) => <TagPill key={`${player.id}-${tag}`} tag={tag} />)}
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        Season {player.kind === 'batting'
          ? `OPS ${cleanNumber(player.season.ops)}`
          : `ERA ${cleanNumber(player.season.era)} · WHIP ${cleanNumber(player.season.whip)}`}
      </div>
    </div>
  );
}

function BoxScoreTable({ rows, kind, onSelectPlayer, isWatched, onToggleWatch }) {
  if (!rows.length) return null;
  const cols = kind === 'batting'
    ? ['AB', 'R', 'H', 'HR', 'RBI', 'BB', 'K', 'OPS']
    : ['IP', 'H', 'ER', 'BB', 'K', 'ERA', 'WHIP'];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            <th className="text-left px-2 py-1.5 font-medium">{kind === 'batting' ? 'Batters' : 'Pitchers'}</th>
            {cols.map((col) => (
              <th key={col} className={`${miniStatCell} font-medium`}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => (
            <tr key={`${kind}-${player.id}`} className="border-b border-slate-900 last:border-none hover:bg-slate-900/70">
              <td className="px-2 py-1 min-w-28 max-w-32">
                <button
                  type="button"
                  onClick={() => onSelectPlayer?.(player)}
                  className="font-semibold text-slate-200 hover:text-emerald-300 truncate max-w-28 text-left"
                >
                  {player.boxscoreName}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleWatch?.(player)}
                  className={`ml-1 align-middle ${isWatched?.(player.id) ? 'text-yellow-300' : 'text-slate-600 hover:text-yellow-300'}`}
                  aria-label={isWatched?.(player.id) ? 'Remove from prospect watchlist' : 'Add to prospect watchlist'}
                >
                  <Star size={10} fill={isWatched?.(player.id) ? 'currentColor' : 'none'} />
                </button>
              </td>
              {kind === 'batting' ? (
                <>
                  <td className={miniStatCell}>{cleanNumber(player.stat.atBats, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.runs, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.hits, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.homeRuns, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.rbi, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.baseOnBalls, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.strikeOuts, 0)}</td>
                  <td className={`${miniStatCell} text-emerald-300`}>{cleanNumber(player.season.ops)}</td>
                </>
              ) : (
                <>
                  <td className={miniStatCell}>{cleanNumber(player.stat.inningsPitched, '0.0')}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.hits, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.earnedRuns, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.baseOnBalls, 0)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.stat.strikeOuts, 0)}</td>
                  <td className={`${miniStatCell} text-orange-300`}>{cleanNumber(player.season.era)}</td>
                  <td className={miniStatCell}>{cleanNumber(player.season.whip)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardTile({ label, player, value, accent = 'text-emerald-300' }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-white truncate">{player?.name ?? '—'}</div>
      <div className={`text-sm font-black ${accent}`}>{value ?? '—'}</div>
    </div>
  );
}

function FormPlayerBoard({ title, players, onSelectPlayer, isWatched, onToggleWatch }) {
  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{title}</div>
      <div className="mt-3 grid gap-2">
        {players.length ? (
          players.map((player) => (
            <div key={`${player.mode}-${player.kind}-${player.id}`} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-2.5">
              <PlayerChip
                player={player}
                onSelect={onSelectPlayer}
                isWatched={isWatched(player.id)}
                onToggleWatch={onToggleWatch}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {player.tags?.map((tag) => <TagPill key={`${player.id}-${tag}`} tag={tag} />)}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {player.summary}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">No players surfaced for this split yet.</div>
        )}
      </div>
    </div>
  );
}

function AffiliateCard({ affiliate, onSelectPlayer, isWatched, onToggleWatch }) {
  const game = affiliate.game;
  const side = affiliate.side;
  const opponentSide = side === 'home' ? 'away' : 'home';
  const topHitter = affiliate.hitters[0];
  const topPitcher = affiliate.pitchers[0];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/25">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.10),transparent_35%)] pointer-events-none" />
      {!game && (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5  px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="relative inline-flex">
            <Gamepad2 size={18} />
            <Ban size={32} className="absolute text-red-400" style={{ top: '-7px', left: '-7px' }} />
          </span>
        </div>
      )}
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <AffiliateLogo team={affiliate} className="w-16 h-16 sm:w-20 sm:h-20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                {LEVEL_SHORT[affiliate.sport?.id] ?? affiliate.sport?.name}
              </span>
              <span className="text-[11px] text-slate-500">{affiliate.league?.name}</span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-display tracking-tight text-white">
              {affiliate.name}
            </h2>
            <p className="text-sm text-slate-400">{affiliate.venue?.name ?? affiliate.locationName}</p>
          </div>
        </div>

        {game ? (
          <>
            <div className="mt-5 rounded-3xl border border-slate-800 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">{gameStatusLabel(game)}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                    <span className="font-semibold text-white">{affiliate.name}</span>
                    <span className="text-emerald-300 font-black tabular-nums">{scoreForSide(game, side)}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="truncate">{game.teams?.[opponentSide]?.team?.name}</span>
                    <span className="text-slate-300 font-black tabular-nums">{scoreForSide(game, opponentSide)}</span>
                  </div>
                </div>
                <Link
                  to={`/game/${game.gamePk}`}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                >
                  Gameday
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PerformerCard
                title="Top Hitter"
                player={topHitter}
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
              <PerformerCard
                title="Top Pitcher"
                player={topPitcher}
                tone="orange"
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <BoxScoreTable
                rows={affiliate.hitters}
                kind="batting"
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
              <BoxScoreTable
                rows={affiliate.pitchers}
                kind="pitching"
                onSelectPlayer={onSelectPlayer}
                isWatched={isWatched}
                onToggleWatch={onToggleWatch}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function statLabel(player) {
  if (!player) return '';
  if (player.kind === 'batting') {
    return `Season ${cleanNumber(player.season.avg)} / ${cleanNumber(player.season.obp)} / ${cleanNumber(player.season.slg)} · OPS ${cleanNumber(player.season.ops)}`;
  }
  return `Season ERA ${cleanNumber(player.season.era)} · WHIP ${cleanNumber(player.season.whip)} · K/9 ${cleanNumber(player.season.strikeoutsPer9Inn)}`;
}

function recentLabel(player) {
  if (!player) return '';
  return player.summary || statLabel(player);
}

function ProspectPreviewModal({ player, open, onClose, isWatched, onToggleWatch, note, onNoteChange }) {
  if (!player) return null;
  const watched = isWatched(player.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      align="bottom"
      panelClassName="bg-[#0d1520] border-slate-700/70 max-h-[88vh] overflow-y-auto"
    >
      <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-[#0d1520] z-10">
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>

      <div className="relative overflow-hidden p-5 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.12),transparent_36%)] pointer-events-none" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-slate-700 bg-slate-900/80 p-2 text-slate-400 hover:text-white"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="relative flex items-start gap-4 pr-10">
          <img
            src={prospectHeadshotUrl(player.id)}
            alt=""
            className="w-20 h-20 rounded-3xl object-cover bg-slate-800 border border-white/10 shadow-xl"
            onError={(e) => attachHeadshotFallback(e, player.id)}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                {LEVEL_SHORT[player.affiliate?.sport?.id ?? player.affiliate?.sportId] ?? 'MiLB'}
              </span>
              <span className="text-xs text-slate-500">{player.affiliate?.name}</span>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-display tracking-tight text-white">{player.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{recentLabel(player)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {player.tags?.map((tag) => <TagPill key={`${player.id}-${tag}`} tag={tag} />)}
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Latest Line</div>
            <div className="mt-1 text-sm font-bold text-white">{player.summary || '—'}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3 sm:col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Season</div>
            <div className="mt-1 text-sm font-bold text-slate-200">{statLabel(player)}</div>
          </div>
        </div>

        <div className="relative mt-5 rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
            <StickyNote size={12} />
            Notes
          </div>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add your own note about this prospect..."
            className="mt-2 w-full min-h-28 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40 resize-y"
          />
        </div>

        <div className="relative mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => onToggleWatch(player)}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors',
              watched
                ? 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/20'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-yellow-400/40 hover:text-yellow-300',
            ].join(' ')}
          >
            <Star size={16} fill={watched ? 'currentColor' : 'none'} />
            {watched ? 'Watching' : 'Add to Watchlist'}
          </button>
          <Link
            to={`/player/${player.id}`}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-500/15"
          >
            View Full Player Page
          </Link>
        </div>
      </div>
    </Modal>
  );
}

function FavoritesModal({ open, onClose, players, onSelectPlayer, onToggleWatch }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      align="bottom"
      panelClassName="bg-[#0d1520] border-slate-700/70 max-h-[88vh] overflow-y-auto"
      title="My Prospects"
    >
      <div className="p-5 sm:p-6">
        {players.length ? (
          <div className="grid gap-2">
            {players.map((player) => (
              <PlayerChip
                key={`favorite-${player.id}`}
                player={player}
                onSelect={(selected) => {
                  onClose();
                  onSelectPlayer(selected);
                }}
                isWatched
                onToggleWatch={onToggleWatch}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Star players from box scores or leaderboards to build your list.</div>
        )}
      </div>
    </Modal>
  );
}

export default function ProspectWatch() {
  const [orgId, setOrgId] = useState(initialOrgId);
  const [date, setDate] = useState(todayIso);
  const [levelFilter, setLevelFilter] = useState('all');
  const [formMode, setFormMode] = useState('today');
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [watchlist, setWatchlist] = useState(loadProspectWatchlist);
  const [notes, setNotes] = useState(loadProspectNotes);
  const selectedOrg =
    mlbTeams.find((team) => team.id === Number(orgId)) ??
    mlbTeams.find((team) => team.id === DEFAULT_ORG_ID);

  useEffect(() => {
    localStorage.setItem(PROSPECT_WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem(PROSPECT_NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    let cancelled = false;

    async function loadProspects() {
      setIsLoading(true);
      setCards([]);

      try {
        const affiliateRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${orgId}/affiliates`);
        const affiliateData = await affiliateRes.json();
        const activeAffiliates = sortAffiliates(affiliateData.teams ?? []);

        const loadedCards = await Promise.all(
          activeAffiliates.map(async (affiliate) => {
            const emptyForm = { season: { hitters: [], pitchers: [] }, last7: { hitters: [], pitchers: [] }, last14: { hitters: [], pitchers: [] } };
            try {
              const [
                scheduleRes,
                activeRosterIds,
                seasonHitters,
                seasonPitchers,
                last7Hitters,
                last7Pitchers,
                last14Hitters,
                last14Pitchers,
              ] = await Promise.all([
                fetch(
                  `https://statsapi.mlb.com/api/v1/schedule?teamId=${affiliate.id}&sportId=${affiliate.sport.id}&date=${date}&hydrate=team,linescore`,
                ),
                fetchAffiliateActiveRosterIds(affiliate),
                fetchStatGroup(affiliate, 'hitting', 'season', date),
                fetchStatGroup(affiliate, 'pitching', 'season', date),
                fetchStatGroup(affiliate, 'hitting', 'last7', date),
                fetchStatGroup(affiliate, 'pitching', 'last7', date),
                fetchStatGroup(affiliate, 'hitting', 'last14', date),
                fetchStatGroup(affiliate, 'pitching', 'last14', date),
              ]);

              const scheduleData = await scheduleRes.json();
              const game = scheduleData.dates?.[0]?.games?.[0] ?? null;
              let side = null;
              let hitters = [];
              let pitchers = [];

              if (game) {
                side = game.teams?.home?.team?.id === affiliate.id ? 'home' : 'away';
                const boxscoreRes = await fetch(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);
                const boxscore = await boxscoreRes.json();
                const todayPlayers = extractTeamPlayers(boxscore, side, affiliate);
                hitters = todayPlayers.hitters
                  .filter((player) => activeRosterIds.has(Number(player.id)))
                  .sort((a, b) => b.score - a.score);
                pitchers = todayPlayers.pitchers
                  .filter((player) => activeRosterIds.has(Number(player.id)))
                  .sort((a, b) => b.score - a.score);
              }

              return {
                ...affiliate,
                game,
                side,
                hitters,
                pitchers,
                forms: {
                  season: {
                    hitters: seasonHitters
                      .filter((split) => activeRosterIds.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'batting', affiliate, 'season')),
                    pitchers: seasonPitchers
                      .filter((split) => activeRosterIds.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'pitching', affiliate, 'season')),
                  },
                  last7: {
                    hitters: last7Hitters
                      .filter((split) => activeRosterIds.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'batting', affiliate, 'last7')),
                    pitchers: last7Pitchers
                      .filter((split) => activeRosterIds.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'pitching', affiliate, 'last7')),
                  },
                  last14: {
                    hitters: last14Hitters
                      .filter((split) => activeRosterIds.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'batting', affiliate, 'last14')),
                    pitchers: last14Pitchers
                      .filter((split) => activeRosterIds.has(Number(split?.player?.id)))
                      .map((split) => mapStatSplitPlayer(split, 'pitching', affiliate, 'last14')),
                  },
                },
              };
            } catch {
              return {
                ...affiliate,
                game: null,
                side: null,
                hitters: [],
                pitchers: [],
                forms: emptyForm,
              };
            }
          }),
        );

        if (!cancelled) setCards(loadedCards);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProspects();
    return () => {
      cancelled = true;
    };
  }, [orgId, date]);

  const visibleCards = useMemo(
    () => cards.filter((card) => levelFilter === 'all' || String(card.sport?.id) === levelFilter),
    [cards, levelFilter],
  );

  const insightPlayers = useMemo(() => {
    const hitters = [];
    const pitchers = [];

    visibleCards.forEach((card) => {
      if (formMode === 'today') {
        hitters.push(...card.hitters);
        pitchers.push(...card.pitchers);
        return;
      }
      hitters.push(...(card.forms?.[formMode]?.hitters ?? []));
      pitchers.push(...(card.forms?.[formMode]?.pitchers ?? []));
    });

    return {
      hitters: hitters.sort((a, b) => b.score - a.score),
      pitchers: pitchers.sort((a, b) => b.score - a.score),
    };
  }, [visibleCards, formMode]);

  const playerDirectory = useMemo(() => {
    const map = new Map();
    const register = (player) => {
      if (!player?.id) return;
      map.set(Number(player.id), player);
    };

    cards.forEach((card) => {
      card.hitters.forEach(register);
      card.pitchers.forEach(register);
      Object.values(card.forms ?? {}).forEach((bucket) => {
        bucket.hitters.forEach(register);
        bucket.pitchers.forEach(register);
      });
    });

    return map;
  }, [cards]);

  const radar = useMemo(
    () => [...insightPlayers.hitters, ...insightPlayers.pitchers].sort((a, b) => b.score - a.score).slice(0, 6),
    [insightPlayers],
  );

  const watchlistPlayers = useMemo(
    () =>
      watchlist
        .map((player) => playerDirectory.get(Number(player.id)) ?? player)
        .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0)),
    [playerDirectory, watchlist],
  );

  const watchedIds = useMemo(() => new Set(watchlist.map((player) => Number(player.id))), [watchlist]);
  const isWatched = (playerId) => watchedIds.has(Number(playerId));

  const toggleWatch = (player) => {
    setWatchlist((current) => {
      const id = Number(player.id);
      if (current.some((entry) => Number(entry.id) === id)) {
        return current.filter((entry) => Number(entry.id) !== id);
      }
      return [watchedEntryFromPlayer(player), ...current].slice(0, 80);
    });
  };

  const leaderboards = useMemo(() => {
    const hitters = insightPlayers.hitters;
    const pitchers = insightPlayers.pitchers;
    const bestBy = (items, selector, direction = 'desc') => {
      const filtered = items.filter((item) => Number(selector(item)) || selector(item) === 0);
      if (!filtered.length) return null;
      return [...filtered].sort((a, b) => {
        const av = Number(selector(a)) || 0;
        const bv = Number(selector(b)) || 0;
        return direction === 'asc' ? av - bv : bv - av;
      })[0];
    };

    return {
      ops: bestBy(hitters, (player) => player.stat.ops),
      hr: bestBy(hitters, (player) => player.stat.homeRuns),
      sb: bestBy(hitters, (player) => player.stat.stolenBases),
      era: bestBy(pitchers, (player) => player.stat.era, 'asc'),
      k9: bestBy(pitchers, (player) => player.stat.strikeoutsPer9Inn),
      whip: bestBy(pitchers, (player) => player.stat.whip, 'asc'),
    };
  }, [insightPlayers]);

  const gamesCount = visibleCards.filter((card) => card.game).length;

  const selectedNote = selectedPlayer ? notes[selectedPlayer.id] ?? '' : '';

  const favoritesLabel = watchlistPlayers.length
    ? `Favorites ${watchlistPlayers.length}`
    : 'Favorites';

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 p-5 sm:p-8 shadow-2xl shadow-black/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.12),transparent_30%)] pointer-events-none" />
          <img
            src={teamLogoUrl(selectedOrg?.id)}
            alt=""
            className="absolute -right-8 -top-12 w-56 h-56 sm:w-72 sm:h-72 object-contain opacity-10 pointer-events-none"
          />

          <div className="relative flex flex-col lg:flex-row lg:items-end gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-[0.28em]">
                <Search size={14} />
                Prospect Watch
              </div>
              <h1 className="mt-2 font-display text-4xl sm:text-6xl tracking-tighter text-white">
                {selectedOrg?.name} Pipeline
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-400">
                Affiliate games, discovery tags, recent-form standouts, leaderboards, and your own prospect notes in one place.
              </p>
            </div>
            <div className="lg:w-[360px]">
              <Select
                value={orgId}
                onChange={setOrgId}
                options={TEAM_OPTIONS}
                buttonClassName="border-slate-700 bg-slate-950/70 py-3"
              />
            </div>
          </div>
        </section>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {LEVEL_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setLevelFilter(filter.value)}
                className={[
                  'rounded-2xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
                  levelFilter === filter.value
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                ].join(' ')}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FORM_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setFormMode(mode.value)}
                className={[
                  'rounded-2xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
                  formMode === mode.value
                    ? 'border-orange-400/40 bg-orange-500/12 text-orange-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                ].join(' ')}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate((value) => shiftDate(value, -1))}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white hover:border-slate-600"
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setDate(todayIso())}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-200 hover:border-emerald-500/35 hover:text-emerald-300"
            >
              {prettyDate(date)}
            </button>
            <button
              type="button"
              onClick={() => setDate((value) => shiftDate(value, 1))}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white hover:border-slate-600"
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => setShowFavorites(true)}
              className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300 hover:bg-yellow-400/15"
            >
              {favoritesLabel}
            </button>
          </div>
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr_1fr]">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <img src={teamLogoUrl(selectedOrg?.id)} alt="" className="w-12 h-12 object-contain" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Org Snapshot</div>
                <div className="text-lg font-display text-white">
                  {gamesCount}/{visibleCards.length || 0} affiliates with games
                </div>
                <div className="text-sm text-slate-500">
                  {FORM_MODES.find((mode) => mode.value === formMode)?.label} lens active
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-orange-300 font-black uppercase tracking-widest text-[10px]">
              <Flame size={14} />
              Prospect Radar
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {radar.length ? radar.map((player) => (
                <PlayerChip
                  key={`${player.mode}-${player.kind}-${player.id}`}
                  player={player}
                  onSelect={setSelectedPlayer}
                  isWatched={isWatched(player.id)}
                  onToggleWatch={toggleWatch}
                />
              )) : (
                <div className="text-sm text-slate-500">Top performers appear once affiliate stats load.</div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-emerald-300 font-black uppercase tracking-widest text-[10px]">
              <TrendingUp size={14} />
              Org Leaders
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <LeaderboardTile
                label="OPS"
                player={leaderboards.ops}
                value={cleanNumber(leaderboards.ops?.stat?.ops)}
              />
              <LeaderboardTile
                label="HR"
                player={leaderboards.hr}
                value={cleanNumber(leaderboards.hr?.stat?.homeRuns, 0)}
              />
              <LeaderboardTile
                label="SB"
                player={leaderboards.sb}
                value={cleanNumber(leaderboards.sb?.stat?.stolenBases, 0)}
              />
              <LeaderboardTile
                label="ERA"
                player={leaderboards.era}
                value={cleanNumber(leaderboards.era?.stat?.era)}
                accent="text-orange-300"
              />
              <LeaderboardTile
                label="K/9"
                player={leaderboards.k9}
                value={cleanNumber(leaderboards.k9?.stat?.strikeoutsPer9Inn)}
                accent="text-orange-300"
              />
              <LeaderboardTile
                label="WHIP"
                player={leaderboards.whip}
                value={cleanNumber(leaderboards.whip?.stat?.whip)}
                accent="text-orange-300"
              />
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <BaseballSpinner size="xl" label="Loading affiliate games and prospect signals…" />
          </div>
        ) : formMode !== 'today' ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <FormPlayerBoard
              title={`${FORM_MODES.find((mode) => mode.value === formMode)?.label} Hitters`}
              players={insightPlayers.hitters.slice(0, 18)}
              onSelectPlayer={setSelectedPlayer}
              isWatched={isWatched}
              onToggleWatch={toggleWatch}
            />
            <FormPlayerBoard
              title={`${FORM_MODES.find((mode) => mode.value === formMode)?.label} Pitchers`}
              players={insightPlayers.pitchers.slice(0, 18)}
              onSelectPlayer={setSelectedPlayer}
              isWatched={isWatched}
              onToggleWatch={toggleWatch}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {visibleCards.map((affiliate) => (
              <AffiliateCard
                key={affiliate.id}
                affiliate={affiliate}
                onSelectPlayer={setSelectedPlayer}
                isWatched={isWatched}
                onToggleWatch={toggleWatch}
              />
            ))}
            {!visibleCards.length && (
              <div className="rounded-[2rem] border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center text-slate-500">
                No affiliates match this filter.
              </div>
            )}
          </div>
        )}
      </div>

      <FavoritesModal
        open={showFavorites}
        onClose={() => setShowFavorites(false)}
        players={watchlistPlayers}
        onSelectPlayer={setSelectedPlayer}
        onToggleWatch={toggleWatch}
      />

      <ProspectPreviewModal
        player={selectedPlayer}
        open={Boolean(selectedPlayer)}
        onClose={() => setSelectedPlayer(null)}
        isWatched={isWatched}
        onToggleWatch={toggleWatch}
        note={selectedNote}
        onNoteChange={(value) => {
          if (!selectedPlayer) return;
          setNotes((current) => ({
            ...current,
            [selectedPlayer.id]: value,
          }));
        }}
      />
    </div>
  );
}
