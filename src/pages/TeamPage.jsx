import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { THEME_COLOR } from '../theme/theme.js';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { compactPlayerName, mlbTeams, teamLogoUrl, playerHeadshotUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';
import { TabBar, Select, SegmentedControl, LoadingSpinner, Modal, SwipeableCarousel, stickyPlayerHead, stickyPlayerCell, scrollStickyHead, scrollStickyCell, scrollStatHead, scrollStatCell, TABLE_SCROLL, TABLE_BASE } from '../components/ui';
import { loadTeamPageState, saveTeamPageState, persistTeamPageLeave, restoreTeamPageScroll } from '../utils/teamPageState';
import { TABLE_TEXT_CLASS, TABLE_MIN_W } from '../theme/tableTheme';
import { useFavoriteTeams } from '../hooks/useFavoriteTeams';
import { fetchStatsApiJson } from '../lib/mlb/client';
import { countryFlagUrl } from '../utils/countryFlags';
import { getHistoricalTradeBundle, getHistoricalTradesForTeam, isHistoricalTrade } from '../utils/historicalTrades';

const CURRENT_YEAR = new Date().getFullYear();
const SEASON_OPTIONS = Array.from({ length: CURRENT_YEAR - 2002 + 1 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: String(y), label: String(y) };
});
const SCHEDULE_SEASON_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2003 + 1 },
  (_, i) => CURRENT_YEAR - i,
).map((year) => ({
  value: String(year),
  label: `${year} Season`,
}));

const HERO_TEXT_SHADOW = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)' };
const MLB_SPORT_ID = 1;

const localDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtDateWithYear = (d) => {
  if (!d) return '—';
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const isTradeTransaction = (txn) =>
  txn?.typeCode === 'TR' || /^trade$/i.test(txn?.typeDesc?.trim() ?? '');

const isCashTradeItem = (txn) => /cash/i.test(`${txn?.description ?? ''} ${txn?.typeDesc ?? ''}`);

const tradeItemLabel = (txn) => {
  if (txn?.person?.fullName) return txn.person.fullName;
  if (isCashTradeItem(txn)) return '💵 Cash Considerations';
  return '—';
};

const isInjuredStatus = (status) => {
  const code = status?.code ?? '';
  const description = status?.description ?? '';
  return /^D(7|10|15|60)$/.test(code) || /injur/i.test(description);
};

const injuryTransactionMatches = (txn) =>
  txn?.person?.id &&
  txn.typeCode === 'SC' &&
  /(placed|transferred).+injured list/i.test(txn.description ?? '');

const parseInjuryInfo = (txn) => {
  if (!txn) return null;
  const description = txn.description ?? '';
  const retroMatch = description.match(/retroactive to ([^.]+)\./i);
  const sentences = description.split('.').map((part) => part.trim()).filter(Boolean);
  const reason = sentences.find((sentence) =>
    !/(placed|transferred|injured list|retroactive)/i.test(sentence)
  );

  return {
    since: retroMatch?.[1] ?? fmtDateWithYear(txn.date),
    transactionDate: fmtDateWithYear(txn.date),
    reason: reason || 'Injury details unavailable',
  };
};

const injuryHeadingMeta = (label = '') => {
  const text = `${label}`.toLowerCase();
  if (text.includes('60')) {
    return {
      icon: 'fa-bed-pulse',
      tone: 'border-red-400/30 bg-red-500/10 text-red-200',
    };
  }
  if (text.includes('15')) {
    return {
      icon: 'fa-briefcase-medical',
      tone: 'border-orange-400/30 bg-orange-500/10 text-orange-200',
    };
  }
  if (text.includes('10')) {
    return {
      icon: 'fa-bandage',
      tone: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
    };
  }
  if (text.includes('7')) {
    return {
      icon: 'fa-notes-medical',
      tone: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    };
  }
  return {
    icon: 'fa-user-injured',
    tone: 'border-slate-600 bg-slate-800 text-slate-200',
  };
};

const txnApiDateParam = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
};

async function fetchTeamTradeBundle(txn) {
  if (isHistoricalTrade(txn)) {
    return getHistoricalTradeBundle(txn);
  }

  const teamId = txn.fromTeam?.id ?? txn.toTeam?.id;
  const dateParam = txnApiDateParam(txn.date);
  if (!teamId || !dateParam || txn.id == null) return [txn];

  try {
    const json = await fetchStatsApiJson('/api/v1/transactions', {
      query: { teamId, date: dateParam, sportId: 1 },
      ttl: 60_000,
      retries: 1,
    });
    const related = (json.transactions ?? []).filter((t) => t.id === txn.id);
    return related.length ? related : [txn];
  } catch {
    return [txn];
  }
}

function groupTradePlayersByReceivingTeam(transactions) {
  const byTeam = new Map();
  for (const t of transactions) {
    if (!t.toTeam?.id) continue;
    if (!byTeam.has(t.toTeam.id)) byTeam.set(t.toTeam.id, { team: t.toTeam, players: [] });
    const bucket = byTeam.get(t.toTeam.id);
    if (t.person?.id) {
      if (!bucket.players.some((p) => p.id === t.person.id)) bucket.players.push(t.person);
    } else if (isCashTradeItem(t) && !bucket.players.some((p) => p.cash)) {
      bucket.players.push({ id: `cash-${t.toTeam.id}`, fullName: '💵 Cash Considerations', cash: true });
    }
  }
  return [...byTeam.values()].sort((a, b) => a.team.name.localeCompare(b.team.name));
}

function tradeSummaryLabel(rows) {
  const playerNames = rows
    .map((row) => row.person?.fullName)
    .filter(Boolean)
    .filter((name, index, all) => all.indexOf(name) === index);
  const hasCash = rows.some(isCashTradeItem);
  const labels = [...playerNames.slice(0, 2)];
  if (hasCash) labels.push('💵 Cash');
  if (playerNames.length > 2) labels.push(`+${playerNames.length - 2} more`);
  return labels.length ? labels.join(', ') : 'Trade';
}

function tradeRowAliases(row) {
  const date = row.date ?? 'no-date';
  const description = row.description ? row.description.trim().toLowerCase() : '';
  return [
    row.id != null ? `id:${date}:${row.id}` : null,
    description ? `desc:${date}:${description}` : null,
    row.person?.id && row.toTeam?.id ? `to:${date}:${row.person.id}:${row.toTeam.id}` : null,
    row.person?.id && row.fromTeam?.id && row.toTeam?.id
      ? `flow:${date}:${row.person.id}:${row.fromTeam.id}:${row.toTeam.id}`
      : null,
  ].filter(Boolean);
}

function mergeTradeGroups(groups, aliases, targetKey, sourceKey) {
  if (targetKey === sourceKey || !groups.has(sourceKey)) return targetKey;
  const target = groups.get(targetKey) ?? [];
  const source = groups.get(sourceKey) ?? [];
  groups.set(targetKey, [...target, ...source]);
  groups.delete(sourceKey);
  for (const [alias, key] of aliases.entries()) {
    if (key === sourceKey) aliases.set(alias, targetKey);
  }
  return targetKey;
}

function collapseTradeTransactions(rows) {
  const groups = new Map();
  const aliases = new Map();
  for (const row of rows) {
    if (!isTradeTransaction(row)) {
      groups.set(`row:${row.id ?? row.date}:${row.person?.id ?? groups.size}`, [row]);
      continue;
    }

    const rowAliases = tradeRowAliases(row);
    const matchingKeys = [...new Set(rowAliases.map((alias) => aliases.get(alias)).filter(Boolean))];
    let key = matchingKeys[0] ?? `trade:${row.id ?? 'no-id'}:${row.date ?? 'no-date'}:${groups.size}`;
    if (!groups.has(key)) groups.set(key, []);
    for (const existingKey of matchingKeys.slice(1)) {
      key = mergeTradeGroups(groups, aliases, key, existingKey);
    }

    const rowKey = `${row.id ?? 'no-id'}:${row.person?.id ?? 'cash'}:${row.fromTeam?.id ?? 'from'}:${row.toTeam?.id ?? 'to'}:${row.description ?? ''}`;
    if (!groups.get(key).some((existing) =>
      `${existing.id ?? 'no-id'}:${existing.person?.id ?? 'cash'}:${existing.fromTeam?.id ?? 'from'}:${existing.toTeam?.id ?? 'to'}:${existing.description ?? ''}` === rowKey
    )) {
      groups.get(key).push(row);
    }

    for (const alias of rowAliases) aliases.set(alias, key);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1 && !isTradeTransaction(group[0])) return group[0];
    const primary = group.find((row) => row.person?.id) ?? group[0];
    return {
      ...primary,
      person: primary.person?.id ? primary.person : { fullName: tradeSummaryLabel(group) },
      tradeRows: group,
      tradeSummary: tradeSummaryLabel(group),
    };
  });
}

function uniqueTradeRows(rows, teamIdForKey) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.person?.id ?? 'cash'}:${teamIdForKey(row) ?? 'team'}:${row.date ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const parseNumber = (value) => {
  const n = Number.parseFloat(String(value ?? '').replace(/^\./, '0.'));
  return Number.isFinite(n) ? n : 0;
};

const inningsToOuts = (ip) => {
  const [whole = '0', frac = '0'] = String(ip ?? '0').split('.');
  return Number.parseInt(whole, 10) * 3 + Number.parseInt(frac, 10);
};

const statYear = (split) => Number(split?.season) || Number(split?.team?.season) || 0;

function scoreTradeSeason(split) {
  const stat = split.stat ?? {};
  if (stat.inningsPitched != null || stat.gamesPitched != null) {
    const ip = inningsToOuts(stat.inningsPitched) / 3;
    return (
      ip * 0.08 +
      parseNumber(stat.strikeOuts) * 0.035 +
      parseNumber(stat.wins) * 0.22 +
      parseNumber(stat.saves) * 0.12 +
      parseNumber(stat.holds) * 0.08 +
      parseNumber(stat.gamesPlayed) * 0.015 -
      parseNumber(stat.earnedRuns) * 0.035 -
      parseNumber(stat.losses) * 0.06
    );
  }

  return (
    parseNumber(stat.gamesPlayed) * 0.025 +
    parseNumber(stat.hits) * 0.11 +
    parseNumber(stat.doubles) * 0.08 +
    parseNumber(stat.triples) * 0.15 +
    parseNumber(stat.homeRuns) * 0.45 +
    parseNumber(stat.rbi) * 0.13 +
    parseNumber(stat.runs) * 0.12 +
    parseNumber(stat.baseOnBalls) * 0.07 +
    parseNumber(stat.stolenBases) * 0.07 -
    parseNumber(stat.strikeOuts) * 0.015
  );
}

async function fetchPlayerYearByYearStats(playerId, cache) {
  if (!playerId) return [];
  if (cache.has(playerId)) return cache.get(playerId);

  const promise = fetchStatsApiJson(`/api/v1/people/${playerId}/stats`, {
    query: { stats: 'yearByYear', group: 'hitting,pitching', hydrate: 'team' },
    ttl: 5 * 60_000,
    retries: 1,
  })
    .then((json) => (json.stats ?? []).flatMap((section) => section.splits ?? []))
    .catch(() => []);

  cache.set(playerId, promise);
  return promise;
}

async function scorePlayerForTeamAfterTrade(person, receivingTeamId, tradeYear, statCache) {
  const splits = await fetchPlayerYearByYearStats(person?.id, statCache);
  const seenSplits = new Set();
  const teamSplits = splits.filter((split) => {
    const key = `${split.group?.displayName ?? ''}:${split.season}:${split.team?.id}:${split.gameType}`;
    if (
      Number(split.team?.id) !== Number(receivingTeamId) ||
      statYear(split) < tradeYear ||
      split.gameType !== 'R' ||
      seenSplits.has(key)
    ) {
      return false;
    }
    seenSplits.add(key);
    return true;
  });
  const score = teamSplits.reduce((total, split) => total + scoreTradeSeason(split), 0);
  const seasons = new Set(teamSplits.map((split) => split.season).filter(Boolean)).size;
  const games = teamSplits.reduce((total, split) => total + parseNumber(split.stat?.gamesPlayed), 0);
  return {
    person,
    teamId: receivingTeamId,
    score: Math.max(0, score + seasons * 0.75),
    seasons,
    games,
  };
}

const fmtGameTime = (gameDate) => {
  if (!gameDate) return 'TBD';
  return new Date(gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getScheduleOpponent = (g, teamId) => {
  const home = g.teams?.home;
  const away = g.teams?.away;
  const isHome = home?.team?.id?.toString() === teamId?.toString();
  const opp = isHome ? away : home;
  return { isHome, opp };
};

const scheduleGameScore = (side, g) => {
  const teamScore = g.teams?.[side]?.score;
  if (teamScore != null) return teamScore;
  return g.linescore?.teams?.[side]?.runs ?? null;
};

const formatCalendarGameLabel = (g, teamId) => {
  const { isHome } = getScheduleOpponent(g, teamId);
  const isFinal = g.status?.abstractGameState === 'Final';
  const isLive = g.status?.abstractGameState === 'Live';
  const homeScore = scheduleGameScore('home', g);
  const awayScore = scheduleGameScore('away', g);

  if (isFinal && homeScore != null && awayScore != null) {
    const homeWin = homeScore > awayScore;
    const awayWin = awayScore > homeScore;
    const won = isHome ? homeWin : awayWin;
    const wl = won ? 'W' : 'L';
    const score = isHome ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`;
    return { text: `${wl} ${score}`, type: won ? 'win' : 'loss' };
  }
  if (isLive) return { text: 'LIVE', type: 'live' };
  return { text: fmtGameTime(g.gameDate), type: 'upcoming' };
};

const calendarLabelClass = (type) => {
  if (type === 'win') return 'text-emerald-400';
  if (type === 'loss') return 'text-red-400';
  if (type === 'live') return 'text-yellow-300';
  return 'text-slate-400';
};

const calendarGameSurfaceClass = (isHome) => (
  isHome
    ? `bg-${THEME_COLOR}-500/40 hover:bg-${THEME_COLOR}-500/20 border border-${THEME_COLOR}-500/25`
    : 'bg-slate-600/25 hover:bg-slate-600/40 border border-slate-500/35'
);

const scheduleGameDateKey = (g) => g.officialDate ?? (g.gameDate ? g.gameDate.split('T')[0] : '');

const isDoubleHeaderGame = (g) => g?.doubleHeader === 'Y' || g?.doubleHeader === 'S';

const scheduleGameEntryQuality = (g) => {
  let score = 0;
  if (isDoubleHeaderGame(g)) score += 4;
  if (scheduleGameScore('home', g) != null) score += 2;
  if (scheduleGameScore('away', g) != null) score += 2;
  if (g.linescore) score += 1;
  return score;
};

const dedupeScheduleGames = (games) => {
  const byPk = new Map();
  for (const g of games) {
    if (g.gamePk == null) continue;
    const prev = byPk.get(g.gamePk);
    if (!prev || scheduleGameEntryQuality(g) > scheduleGameEntryQuality(prev)) {
      byPk.set(g.gamePk, g);
    }
  }
  return [...byPk.values()].sort(sortScheduleGames);
};

const isDoubleHeaderDay = (dayGames) => {
  const unique = dedupeScheduleGames(dayGames);
  return unique.length >= 2 && unique.some(isDoubleHeaderGame);
};

const getDoubleHeaderLabel = (g) => {
  if (!isDoubleHeaderGame(g) || !g?.gameNumber) return null;
  return `G${g.gameNumber}`;
};

const sortScheduleGames = (a, b) => {
  const dateA = scheduleGameDateKey(a);
  const dateB = scheduleGameDateKey(b);
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  const numA = a.gameNumber ?? 1;
  const numB = b.gameNumber ?? 1;
  if (numA !== numB) return numA - numB;
  return new Date(a.gameDate ?? 0) - new Date(b.gameDate ?? 0);
};
const fmt = (v, dec = 3) => {
  if (v == null || v === '') return '–';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (dec === 0) return Math.round(n).toString();
  return n.toFixed(dec).replace(/^0\./, '.');
};

const BATTING_RATE_KEYS = new Set(['avg', 'obp', 'slg', 'ops']);
const PITCHING_RATE_KEYS = new Set(['era', 'whip']);

function ipToDecimal(ip) {
  if (ip == null || ip === '') return 0;
  const [whole, frac = '0'] = String(ip).split('.');
  return parseInt(whole, 10) + parseInt(frac, 10) / 3;
}

function getTeamGamesPlayed(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r?.stat?.gamesPlayed) || 0), 0);
}

function qualifiesBattingRate(row, teamGames) {
  const pa = Number(row?.stat?.plateAppearances ?? 0);
  const ab = Number(row?.stat?.atBats ?? 0);
  const minPA = Math.max(20, Math.floor(teamGames * 3.1));
  if (pa > 0) return pa >= minPA;
  return ab >= minPA;
}

function qualifiesPitchingRate(row, teamGames) {
  const minIP = Math.max(8, teamGames);
  return ipToDecimal(row?.stat?.inningsPitched) >= minIP;
}

function qualifiesHistoricalBattingRate(row) {
  return Number(row?.stat?.plateAppearances ?? row?.stat?.atBats ?? 0) >= 500;
}

function qualifiesHistoricalPitchingRate(row) {
  return ipToDecimal(row?.stat?.inningsPitched) >= 100;
}

function historicalSortQualifier(group, key) {
  if (group === 'batting' && BATTING_RATE_KEYS.has(key)) return qualifiesHistoricalBattingRate;
  if (group === 'pitching' && PITCHING_RATE_KEYS.has(key)) return qualifiesHistoricalPitchingRate;
  return null;
}

function historicalSortNote(group, key, cols) {
  const label = cols.find((col) => col.key === key)?.label ?? key;
  if (group === 'batting' && BATTING_RATE_KEYS.has(key)) {
    return `Sorting by ${label}: qualified hitters first, minimum 500 PA.`;
  }
  if (group === 'pitching' && PITCHING_RATE_KEYS.has(key)) {
    return `Sorting by ${label}: qualified pitchers first, minimum 100 IP.`;
  }
  return `Sorting by ${label}: all players included.`;
}

function getTopLeaders(rows, statKey, { asc = false, qualify } = {}) {
  const eligible = rows.filter((row) => {
    const val = row?.stat?.[statKey];
    if (val == null || val === '') return false;
    if (Number.isNaN(parseFloat(val))) return false;
    if (qualify && !qualify(row)) return false;
    return true;
  });

  eligible.sort((a, b) => {
    const av = parseFloat(a.stat[statKey]);
    const bv = parseFloat(b.stat[statKey]);
    return asc ? av - bv : bv - av;
  });

  return eligible.slice(0, 4);
}

function formatLeaderSubline(person, row) {
  const pos = row?.position?.abbreviation
    ?? person?.primaryPosition?.abbreviation
    ?? person?.primaryPosition?.name;
  const number = person?.primaryNumber ?? person?.jerseyNumber;
  return [pos, number != null ? `#${number}` : null].filter(Boolean).join(' • ') || '—';
}

function TeamLeaderCard({ label, statKey, dec, leaders, onNavigateAway }) {
  if (!leaders?.length) return null;

  const [top, ...rest] = leaders;
  const topPerson = top.player ?? top.person;
  const topVal = top.stat?.[statKey];
  const leave = onNavigateAway ?? (() => {});

  return (
    <div className="leader-card w-full min-w-[300px] max-w-[320px] bg-[#1b2a51] rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-xl">
      <div className="p-0 flex items-start gap-3 border-b border-slate-700 min-h-[148px]">
        <div className="flex-1 p-3 min-w-0">
          <div className={`uppercase text-${THEME_COLOR}-400 text-xs font-semibold tracking-widest mb-1`}>
            {label}
          </div>
          <div className="font-bold text-white text-4xl leading-none tabular-nums">
            {dec === -1 ? (topVal ?? '–') : fmt(topVal, dec)}
          </div>
          <div className="mt-3">
            <Link
              to={`/player/${topPerson?.id}`}
              onClick={leave}
              className="font-semibold text-lg text-white hover:text-slate-200 transition-colors truncate block"
              title={topPerson?.fullName}
            >
              {topPerson?.fullName ?? '—'}
            </Link>
            <div className="text-xs text-slate-400">{formatLeaderSubline(topPerson, top)}</div>
          </div>
        </div>
        <div className="flex-shrink-0 mt-5 pr-1">
          <Link to={`/player/${topPerson?.id}`} onClick={leave}>
            <img
              src={playerHeadshotUrl(topPerson?.id, 1)}
              alt=""
              className="w-32 h-32 object-cover"
              onError={(e) => { e.target.src = FALLBACK_HEADSHOT; }}
            />
          </Link>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="bg-white text-slate-900 p-3 space-y-3 rounded-b-3xl">
          {rest.map((row, i) => {
            const person = row.player ?? row.person;
            const val = row.stat?.[statKey];
            return (
              <Fragment key={person?.id ?? i}>
                {i > 0 && <div className="h-px bg-slate-200 mx-1" />}
                <Link
                  to={`/player/${person?.id}`}
                  onClick={leave}
                  className="flex items-center gap-3 group"
                >
                  <img
                    src={playerHeadshotUrl(person?.id, 2)}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 flex-shrink-0"
                    onError={(e) => { e.target.src = FALLBACK_HEADSHOT; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate group-hover:text-slate-600 transition-colors">
                      {person?.fullName ?? '—'}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums flex-shrink-0">
                    {dec === -1 ? (val ?? '–') : fmt(val, dec)}
                  </div>
                </Link>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamLeadersCarousel({ leaderStats, rows, battingRateQualify, pitchingRateQualify, onNavigateAway }) {
  const carouselKey = leaderStats.map((s) => s.key).join(',');

  const cards = leaderStats.map(({ label, key, dec }) => {
    const isPitchRate = PITCHING_RATE_KEYS.has(key);
    const isBatRate = BATTING_RATE_KEYS.has(key);
    const leaders = getTopLeaders(rows, key, {
      asc: isPitchRate,
      qualify: isBatRate
        ? battingRateQualify
        : isPitchRate
          ? pitchingRateQualify
          : undefined,
    });
    if (!leaders.length) return null;
    return (
      <TeamLeaderCard
        key={key}
        label={label}
        statKey={key}
        dec={dec}
        leaders={leaders}
        onNavigateAway={onNavigateAway}
      />
    );
  }).filter(Boolean);

  if (!cards.length) return null;

  return <TeamLeadersCarouselViewport key={carouselKey} cards={cards} carouselKey={carouselKey} />;
}

function TeamLeadersCarouselViewport({ cards, carouselKey }) {
  const [slideIndex, setSlideIndex] = useState(0);

  return (
    <SwipeableCarousel
      slideGap={12}
      showDots={cards.length > 1}
      selectedIndex={slideIndex}
      onSelectedIndexChange={setSlideIndex}
      slideClassName="flex-[0_0_88%] sm:flex-[0_0_72%] md:flex-[0_0_58%] lg:flex-[0_0_50%]"
      className="mx-2 mb-5"
      reinitDeps={`${carouselKey}-${cards.length}`}
    >
      {cards}
    </SwipeableCarousel>
  );
}

// ─── Stat column defs ─────────────────────────────────────────────────────────
const BAT_COLS = [
  { key: 'gamesPlayed', label: 'G', dec: 0 },
  { key: 'atBats', label: 'AB', dec: 0 },
  { key: 'runs', label: 'R', dec: 0 },
  { key: 'hits', label: 'H', dec: 0 },
  { key: 'doubles', label: '2B', dec: 0 },
  { key: 'triples', label: '3B', dec: 0 },
  { key: 'homeRuns', label: 'HR', dec: 0 },
  { key: 'rbi', label: 'RBI', dec: 0 },
  { key: 'stolenBases', label: 'SB', dec: 0 },
  { key: 'baseOnBalls', label: 'BB', dec: 0 },
  { key: 'strikeOuts', label: 'SO', dec: 0 },
  { key: 'avg', label: 'AVG', dec: 3 },
  { key: 'obp', label: 'OBP', dec: 3 },
  { key: 'slg', label: 'SLG', dec: 3 },
  { key: 'ops', label: 'OPS', dec: 3 },
];

const PITCH_COLS = [
  { key: 'wins', label: 'W', dec: 0 },
  { key: 'losses', label: 'L', dec: 0 },
  { key: 'gamesPlayed', label: 'G', dec: 0 },
  { key: 'gamesStarted', label: 'GS', dec: 0 },
  { key: 'inningsPitched', label: 'IP', dec: -1 },
  { key: 'strikeOuts', label: 'SO', dec: 0 },
  { key: 'baseOnBalls', label: 'BB', dec: 0 },
  { key: 'hits', label: 'H', dec: 0 },
  { key: 'earnedRuns', label: 'ER', dec: 0 },
  { key: 'homeRuns', label: 'HR', dec: 0 },
  { key: 'saves', label: 'SV', dec: 0 },
  { key: 'era', label: 'ERA', dec: 2 },
  { key: 'whip', label: 'WHIP', dec: 2 },
];

const FIELD_COLS = [
  { key: 'gamesPlayed', label: 'G', dec: 0 },
  { key: 'gamesStarted', label: 'GS', dec: 0 },
  { key: 'putOuts', label: 'PO', dec: 0 },
  { key: 'assists', label: 'A', dec: 0 },
  { key: 'errors', label: 'E', dec: 0 },
  { key: 'fielding', label: 'FLD%', dec: 3 },
  { key: 'doublePlays', label: 'DP', dec: 0 },
  { key: 'chances', label: 'TC', dec: 0 },
];

const TEAM_STATS_GROUP_MAP = { batting: 'hitting', pitching: 'pitching', fielding: 'fielding' };
const TEAM_STATS_COLS_MAP = { batting: BAT_COLS, pitching: PITCH_COLS, fielding: FIELD_COLS };
const HISTORICAL_STATS_COLS_MAP = {
  batting: [{ key: 'yrs', label: 'YRS', dec: 0 }, ...BAT_COLS],
  pitching: [{ key: 'yrs', label: 'YRS', dec: 0 }, ...PITCH_COLS],
  fielding: [{ key: 'yrs', label: 'YRS', dec: 0 }, ...FIELD_COLS],
};

const rangeYears = (startYear, endYear = CURRENT_YEAR) => {
  const start = Math.max(1876, Number(startYear) || 1901);
  const end = Number(endYear) || CURRENT_YEAR;
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => String(start + i));
};

const statsSeasonOptions = (firstYearOfPlay) => [
  { value: 'all', label: 'All' },
  ...rangeYears(firstYearOfPlay, CURRENT_YEAR)
    .reverse()
    .map((year) => ({ value: year, label: year })),
];

async function mapLimit(items, limit, mapper) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(mapper));
    results.push(...batchResults);
  }
  return results;
}

function countHistoricalPlayerSeasons(seasonSplits) {
  const seasonsByPlayer = new Map();
  for (const split of seasonSplits) {
    const playerId = split.player?.id;
    if (!playerId || !split.season) continue;
    if ((Number(split.stat?.gamesPlayed) || 0) <= 0) continue;
    const seasons = seasonsByPlayer.get(playerId) ?? new Set();
    seasons.add(String(split.season));
    seasonsByPlayer.set(playerId, seasons);
  }
  return seasonsByPlayer;
}

function teamStatsPlayerName(person, fallback = '—') {
  const fullName = String(person?.fullName ?? person?.name ?? '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName || fallback;

  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
  const suffix = suffixes.has(parts.at(-1).toLowerCase()) ? parts.pop() : null;
  const lastName = parts.pop();
  const firstInitial = parts[0]?.charAt(0);
  if (!firstInitial || !lastName) return fullName || fallback;

  return `${firstInitial}. ${lastName}${suffix ? ` ${suffix}` : ''}`;
}

// ─── Sortable table ───────────────────────────────────────────────────────────
function SortableTable({
  cols,
  rows,
  nameKey = 'fullName',
  idKey = 'id',
  onNavigateAway,
  defaultSortKey = cols[0]?.key ?? '',
  defaultSortDir = 'desc',
  playerColClass = null,
  visibleLimit = null,
  sortQualifier = null,
  onSortChange = null,
}) {
  const [sortCol, setSortCol] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  const handleSort = (key) => {
    if (key === sortCol) {
      setSortDir((d) => {
        const next = d === 'asc' ? 'desc' : 'asc';
        onSortChange?.({ key, dir: next });
        return next;
      });
    } else {
      setSortCol(key);
      setSortDir('desc');
      onSortChange?.({ key, dir: 'desc' });
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const qualifier = sortQualifier?.(sortCol);
    if (qualifier) {
      const aq = qualifier(a);
      const bq = qualifier(b);
      if (aq !== bq) return aq ? -1 : 1;
    }
    const av = sortCol === 'inningsPitched'
      ? ipToDecimal(a.stat?.[sortCol] ?? a[sortCol])
      : parseFloat(a.stat?.[sortCol] ?? a[sortCol] ?? 0);
    const bv = sortCol === 'inningsPitched'
      ? ipToDecimal(b.stat?.[sortCol] ?? b[sortCol])
      : parseFloat(b.stat?.[sortCol] ?? b[sortCol] ?? 0);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const renderedRows = visibleLimit == null ? sorted : sorted.slice(0, visibleLimit);

  return (
    <div className={`${TABLE_SCROLL} -mx-1 px-1 scrollbar-thin`}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.md}`}>
        <thead>
          <tr className="border-b border-slate-700/60">
            <th className={`${playerColClass ? stickyPlayerHead('bg-[#121827]', { widthClass: playerColClass }) : stickyPlayerHead('bg-[#121827]')} text-slate-400 font-medium`}>Player</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`${scrollStatHead(`font-medium cursor-pointer select-none ${sortCol === c.key ? `text-${THEME_COLOR}-400` : 'text-slate-400 hover:text-slate-200'}`)}`}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {sortCol === c.key && <span className="ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderedRows.map((row, i) => {
            const person = row.player ?? row.person ?? row;
            const playerId = person?.[idKey] ?? person?.id;
            const pos = row.position?.abbreviation ?? row.position?.name ?? person?.primaryPosition?.abbreviation;
            return (
              <tr key={playerId ?? i} className="group border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                <td className={playerColClass ? stickyPlayerCell('bg-[#121827]', { widthClass: playerColClass }) : stickyPlayerCell('bg-[#121827]')}>
                  <div className="min-w-0">
                    <Link
                      to={`/player/${playerId}`}
                      onClick={onNavigateAway}
                      className={`font-medium hover:text-${THEME_COLOR}-400 transition-colors text-xs sm:text-sm leading-tight block truncate`}
                    >
                      {teamStatsPlayerName(person, person?.[nameKey] ?? person?.fullName ?? '—')}
                    </Link>
                    {pos && <span className="text-[10px] text-slate-500">{pos}</span>}
                  </div>
                </td>
                {cols.map((c) => {
                  const raw = row.stat?.[c.key] ?? row[c.key];
                  return (
                    <td key={c.key} className={scrollStatCell(sortCol === c.key ? `text-${THEME_COLOR}-300` : '')}>
                      {c.dec === -1 ? (raw ?? '–') : fmt(raw, c.dec)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({
  teamId,
  sub,
  setSub,
  statsSeason,
  setStatsSeason,
  teamName,
  firstYearOfPlay,
  onNavigateAway,
}) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isHistorical = statsSeason === 'all';
  const dataKey = `${statsSeason}:${sub}`;

  useEffect(() => {
    if (isHistorical) return;
    if (data[dataKey] != null) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchStatsApiJson('/api/v1/stats', {
          query: {
            stats: 'season',
            group: TEAM_STATS_GROUP_MAP[sub],
            season: statsSeason,
            teamId,
            playerPool: 'all',
            sportId: 1,
            limit: 200,
            hydrate: 'player,team',
          },
          signal: controller.signal,
          ttl: 60_000,
          retries: 1,
        });
        if (!cancelled) {
          const splits = json.stats?.[0]?.splits ?? [];
          setData((prev) => ({ ...prev, [dataKey]: splits }));
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          setError(e.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStats();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data, dataKey, isHistorical, statsSeason, sub, teamId]);

  // top leader in each key category
  const leaderStats = sub === 'batting'
    ? [
        { label: 'AVG', key: 'avg', dec: 3 },
        { label: 'HR', key: 'homeRuns', dec: 0 },
        { label: 'RBI', key: 'rbi', dec: 0 },
        { label: 'OPS', key: 'ops', dec: 3 },
        { label: 'SB', key: 'stolenBases', dec: 0 },
        { label: 'H', key: 'hits', dec: 0 },
      ]
    : sub === 'pitching'
    ? [
        { label: 'ERA', key: 'era', dec: 2 },
        { label: 'W', key: 'wins', dec: 0 },
        { label: 'SO', key: 'strikeOuts', dec: 0 },
        { label: 'SV', key: 'saves', dec: 0 },
        { label: 'WHIP', key: 'whip', dec: 2 },
        { label: 'IP', key: 'inningsPitched', dec: -1 },
      ]
    : [];

  const rows = data[dataKey] ?? [];
  const teamGames = getTeamGamesPlayed(rows);

  const battingRateQualify = (row) => qualifiesBattingRate(row, teamGames);
  const pitchingRateQualify = (row) => qualifiesPitchingRate(row, teamGames);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 my-4 px-2">
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1">
          <SegmentedControl
            value={sub}
            onChange={setSub}
            size="sm"
            options={[
              { value: 'batting', label: 'Batting' },
              { value: 'pitching', label: 'Pitching' },
              { value: 'fielding', label: 'Fielding' },
            ]}
          />
        </div>
        <Select
          value={statsSeason}
          onChange={setStatsSeason}
          options={statsSeasonOptions(firstYearOfPlay)}
          size="sm"
          className="w-28 sm:w-32"
          buttonClassName="border-slate-600 py-2"
        />
      </div>

      {isHistorical && (
        <HistoricalStatsPanel
          teamId={teamId}
          teamName={teamName}
          firstYearOfPlay={firstYearOfPlay}
          group={sub}
          onNavigateAway={onNavigateAway}
        />
      )}

      {!isHistorical && (
        <>
      {leaderStats.length > 0 && rows.length > 0 && (
        <TeamLeadersCarousel
          leaderStats={leaderStats}
          rows={rows}
          battingRateQualify={battingRateQualify}
          pitchingRateQualify={pitchingRateQualify}
          onNavigateAway={onNavigateAway}
        />
      )}
      {loading && <LoadingSpinner size="lg" py="py-16" />}
      {error && <div className="py-8 text-center text-red-400 text-sm">{error}</div>}
      {!loading && !error && rows.length > 0 && (
        <div className="border border-slate-700/60 rounded-2xl overflow-hidden">
          <SortableTable
            cols={TEAM_STATS_COLS_MAP[sub]}
            rows={rows}
            onNavigateAway={onNavigateAway}
            playerColClass="w-24 min-w-[6rem] sm:w-28 sm:min-w-[7rem]"
          />
        </div>
      )}
      {!loading && !error && rows.length === 0 && data[dataKey] != null && (
        <div className="py-12 text-center text-slate-500 text-sm">No stats available for {statsSeason}.</div>
      )}
        </>
      )}
    </div>
  );
}

// ─── Historical Stats Panel ───────────────────────────────────────────────────
function HistoricalStatsPanel({ teamId, teamName, firstYearOfPlay, group, onNavigateAway }) {
  const [query, setQuery] = useState('');
  const [visibleCounts, setVisibleCounts] = useState({});
  const [sortByGroup, setSortByGroup] = useState({});
  const [data, setData] = useState({ batting: null, pitching: null, fielding: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (data[group] != null) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadHistorical = async () => {
      setLoading(true);
      setError(null);
      try {
        const careerJson = await fetchStatsApiJson('/api/v1/stats', {
          query: {
            stats: 'career',
            group: TEAM_STATS_GROUP_MAP[group],
            teamId,
            playerPool: 'all',
            sportId: 1,
            limit: 5000,
            hydrate: 'player,team',
          },
          signal: controller.signal,
          ttl: 24 * 60 * 60_000,
          retries: 1,
        });
        const careerSplits = careerJson.stats?.[0]?.splits ?? [];
        const years = rangeYears(firstYearOfPlay);
        const seasonSplitGroups = await mapLimit(years, 8, async (year) => {
          try {
            const seasonJson = await fetchStatsApiJson('/api/v1/stats', {
              query: {
                stats: 'season',
                group: TEAM_STATS_GROUP_MAP[group],
                teamId,
                playerPool: 'all',
                sportId: 1,
                season: year,
                limit: 500,
                hydrate: 'player,team',
              },
              signal: controller.signal,
              ttl: 24 * 60 * 60_000,
              retries: 1,
            });
            return seasonJson.stats?.[0]?.splits ?? [];
          } catch (e) {
            if (e?.name === 'AbortError') throw e;
            return [];
          }
        });
        const seasonsByPlayer = countHistoricalPlayerSeasons(seasonSplitGroups.flat());

        const splits = careerSplits.map((split) => ({
          ...split,
          yrs: seasonsByPlayer.get(split.player?.id)?.size ?? null,
        }));
        if (!cancelled) setData((prev) => ({ ...prev, [group]: splits }));
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHistorical();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data, firstYearOfPlay, group, teamId]);

  const rows = data[group] ?? [];
  const cols = HISTORICAL_STATS_COLS_MAP[group] ?? HISTORICAL_STATS_COLS_MAP.batting;
  const defaultSortKey =
    group === 'pitching' ? 'strikeOuts' : group === 'fielding' ? 'gamesPlayed' : 'homeRuns';
  const activeSort = sortByGroup[group] ?? { key: defaultSortKey, dir: 'desc' };
  const sortNote = historicalSortNote(group, activeSort.key, cols);
  const filteredRows = rows.filter((row) => {
    const name = row.player?.fullName ?? row.person?.fullName ?? '';
    return name.toLowerCase().includes(query.trim().toLowerCase());
  });
  const visibleKey = `${group}:${query.trim().toLowerCase()}`;
  const visibleCount = visibleCounts[visibleKey] ?? 100;
  const renderedCount = Math.min(visibleCount, filteredRows.length);
  const hasMoreRows = renderedCount < filteredRows.length;

  const leaderStats = group === 'pitching'
    ? [
        { label: 'SO', key: 'strikeOuts', dec: 0 },
        { label: 'W', key: 'wins', dec: 0 },
        { label: 'SV', key: 'saves', dec: 0 },
        { label: 'IP', key: 'inningsPitched', dec: -1 },
        { label: 'ERA', key: 'era', dec: 2 },
        { label: 'WHIP', key: 'whip', dec: 2 },
      ]
    : group === 'batting' ? [
        { label: 'HR', key: 'homeRuns', dec: 0 },
        { label: 'RBI', key: 'rbi', dec: 0 },
        { label: 'H', key: 'hits', dec: 0 },
        { label: 'R', key: 'runs', dec: 0 },
        { label: 'SB', key: 'stolenBases', dec: 0 },
        { label: 'OPS', key: 'ops', dec: 3 },
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4 px-2">
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter player..."
          className="min-w-0 flex-1 sm:flex-none sm:w-64 bg-slate-900 border border-slate-700 rounded-2xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
      </div>

      <div className="px-2 pb-4 text-xs text-slate-500 leading-relaxed">
        Team-only career totals for every MLB player with {teamName ?? 'this team'} in the StatsAPI era. YRS counts seasons with this team.
      </div>

      {leaderStats.length > 0 && rows.length > 0 && !query.trim() && (
        <TeamLeadersCarousel
          leaderStats={leaderStats}
          rows={rows}
          battingRateQualify={(row) => Number(row?.stat?.plateAppearances ?? row?.stat?.atBats ?? 0) >= 500}
          pitchingRateQualify={(row) => ipToDecimal(row?.stat?.inningsPitched) >= 100}
          onNavigateAway={onNavigateAway}
        />
      )}

      {loading && <LoadingSpinner size="lg" py="py-16" />}
      {error && <div className="py-8 text-center text-red-400 text-sm">{error}</div>}
      {!loading && !error && data[group] != null && (
        <>
          <div className="px-2 pb-2 text-[11px] text-slate-500">
            Showing {renderedCount.toLocaleString()} of {filteredRows.length.toLocaleString()} players
            {filteredRows.length !== rows.length ? ` (${rows.length.toLocaleString()} total)` : ''}
            <span className="block sm:inline sm:ml-2 text-slate-400">{sortNote}</span>
          </div>
          {filteredRows.length > 0 ? (
            <>
              <div className="border border-slate-700/60 rounded-2xl overflow-hidden">
                <SortableTable
                  key={group}
                  cols={cols}
                  rows={filteredRows}
                  onNavigateAway={onNavigateAway}
                  defaultSortKey={defaultSortKey}
                  defaultSortDir="desc"
                  playerColClass="w-24 min-w-[6rem] sm:w-28 sm:min-w-[7rem]"
                  visibleLimit={visibleCount}
                  sortQualifier={(key) => historicalSortQualifier(group, key)}
                  onSortChange={(sort) => {
                    setSortByGroup((prev) => ({ ...prev, [group]: sort }));
                  }}
                />
              </div>
              {hasMoreRows && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleCounts((counts) => ({
                        ...counts,
                        [visibleKey]: (counts[visibleKey] ?? 100) + 100,
                      }));
                    }}
                    className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-slate-200 transition-colors active:scale-[0.98]"
                  >
                    Show more
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">No historical players match that filter.</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab({
  teamId,
  season,
  sportId = MLB_SPORT_ID,
  setSeason,
  view,
  setView,
  selectedMonth,
  setSelectedMonth,
  onNavigateAway,
}) {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gamePicker, setGamePicker] = useState(null);
  const [calendarSlideDirection, setCalendarSlideDirection] = useState('next');
  const [calendarDragOffset, setCalendarDragOffset] = useState(0);
  const gameRefs = useRef({});
  const calendarSwipeRef = useRef(null);
  const calendarSuppressClickRef = useRef(false);

  const goToGame = (gamePk) => {
    onNavigateAway?.({ scheduleMonth: selectedMonth });
    navigate(`/game/${gamePk}`);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const json = await fetchStatsApiJson('/api/v1/schedule', {
          query: {
            teamId,
            season,
            sportId,
            gameType: 'R',
            hydrate: 'team,linescore',
          },
          signal: controller.signal,
          ttl: 60_000,
          retries: 1,
        });
        const allGames = dedupeScheduleGames(
          (json.dates ?? []).flatMap((d) => d.games ?? []),
        );
        if (!cancelled) {
          setGames(allGames);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [teamId, season, sportId]);

  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthName = (mm) => new Date(Number(season), Number(mm) - 1, 1).toLocaleDateString('en-US', { month: 'long' });

  const gamesByMonth = useMemo(() => {
    const map = {};
    for (const g of games) {
      const dateStr = g.officialDate ?? (g.gameDate ? g.gameDate.split('T')[0] : '');
      if (!dateStr) continue;
      const d = new Date(`${dateStr}T12:00:00`);
      const k = monthKey(d);
      (map[k] = map[k] ?? []).push(g);
    }
    Object.values(map).forEach((arr) => {
      arr.sort(sortScheduleGames);
    });
    return map;
  }, [games]);

  const months = useMemo(() => Object.keys(gamesByMonth).sort(), [gamesByMonth]);

  const monthsForYear = useMemo(
    () => months.filter((m) => m.startsWith(`${season}-`)),
    [months, season],
  );

  const filteredGames = useMemo(() => {
    if (!selectedMonth) return games;
    const monthPrefix = `${season}-${selectedMonth}`;
    return games.filter((g) => scheduleGameDateKey(g).startsWith(monthPrefix));
  }, [games, season, selectedMonth]);

  useEffect(() => {
    if (!monthsForYear.length) return;
    setSelectedMonth((prev) => {
      if (prev && monthsForYear.includes(`${season}-${prev}`)) return prev;
      const now = new Date();
      const currentKey = monthKey(now);
      if (season === String(now.getFullYear()) && monthsForYear.includes(currentKey)) {
        return currentKey.split('-')[1];
      }
      return monthsForYear[0].split('-')[1];
    });
  }, [monthsForYear, season, setSelectedMonth]);

  useEffect(() => {
    if (view !== 'list' || !filteredGames.length) return;
    const todayKey = localDateKey(new Date());
    const idx = filteredGames.findIndex((g) => scheduleGameDateKey(g) >= todayKey);
    const target = idx >= 0 ? filteredGames[idx] : filteredGames[filteredGames.length - 1];
    const el = target?.gamePk ? gameRefs.current[target.gamePk] : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [filteredGames, view, selectedMonth, season]);

  const buildMonthGrid = (monthStr) => {
    const [yy, mm] = monthStr.split('-').map((x) => Number(x));
    const first = new Date(yy, mm - 1, 1);
    const last = new Date(yy, mm, 0);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const days = [];
    const cursor = new Date(start);
    while (cursor <= last) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    const gamesForMonth = gamesByMonth[monthStr] ?? [];
    const byDate = {};
    for (const g of gamesForMonth) {
      const k = g.officialDate ?? (g.gameDate ? g.gameDate.split('T')[0] : '');
      if (k) (byDate[k] = byDate[k] ?? []).push(g);
    }
    return { days, byDate, monthDate: first };
  };

  const todayStr = localDateKey(new Date());

  const openGamePicker = (dateKey, dayGames) => {
    setGamePicker({ dateKey, games: dayGames });
  };

  const goToAdjacentMonth = (direction) => {
    if (!selectedMonth || !monthsForYear.length) return;
    const currentKey = `${season}-${selectedMonth}`;
    const currentIdx = monthsForYear.indexOf(currentKey);
    if (currentIdx < 0) return;
    const next = monthsForYear[currentIdx + direction];
    if (!next) return;
    setCalendarSlideDirection(direction > 0 ? 'next' : 'prev');
    setSelectedMonth(next.split('-')[1]);
  };

  const handleMonthSelect = (nextMonth) => {
    if (selectedMonth && nextMonth !== selectedMonth) {
      setCalendarSlideDirection(Number(nextMonth) > Number(selectedMonth) ? 'next' : 'prev');
    }
    setSelectedMonth(nextMonth);
  };

  const handleCalendarPointerDown = (e) => {
    // Desktop mouse clicks should behave like normal button clicks. We only
    // capture touch/pen gestures here so the month grid can swipe on mobile.
    if (e.pointerType === 'mouse') return;
    calendarSwipeRef.current = {
      pointerId: e.pointerId,
      target: e.currentTarget,
      x: e.clientX,
      y: e.clientY,
      dragging: false,
    };
    setCalendarDragOffset(0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleCalendarPointerMove = (e) => {
    const start = calendarSwipeRef.current;
    if (!start || start.pointerId !== e.pointerId) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.dragging && Math.abs(dx) < 8) return;
    if (!start.dragging && Math.abs(dy) > Math.abs(dx)) return;

    start.dragging = true;
    // Resistance keeps the calendar feeling attached to your finger without flying off-screen.
    const resistedOffset = Math.max(-96, Math.min(96, dx * 0.55));
    setCalendarDragOffset(resistedOffset);
  };

  const handleCalendarPointerUp = (e) => {
    const start = calendarSwipeRef.current;
    calendarSwipeRef.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    start.target?.releasePointerCapture?.(e.pointerId);

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const horizontalEnough = Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.35;
    if (!horizontalEnough) {
      setCalendarDragOffset(0);
      return;
    }

    calendarSuppressClickRef.current = true;
    window.setTimeout(() => {
      calendarSuppressClickRef.current = false;
    }, 0);
    setCalendarDragOffset(0);
    goToAdjacentMonth(dx < 0 ? 1 : -1);
  };

  const handleCalendarPointerCancel = () => {
    const start = calendarSwipeRef.current;
    if (start?.target && start?.pointerId != null) {
      start.target.releasePointerCapture?.(start.pointerId);
    }
    calendarSwipeRef.current = null;
    setCalendarDragOffset(0);
  };

  const handleCalendarClickCapture = (e) => {
    if (!calendarSuppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const renderMonthCalendar = (monthStr) => {
    const { days, byDate, monthDate } = buildMonthGrid(monthStr);
    const monthIdx = monthDate.getMonth();

    return (
      <div
        key={monthStr}
        className={`team-schedule-calendar team-schedule-calendar--${calendarSlideDirection} ${calendarDragOffset ? 'team-schedule-calendar--dragging' : ''} border-t border-t-slate-700/60 sm:border sm:border-slate-700/60 sm:rounded-2xl overflow-hidden`}
        onPointerDown={handleCalendarPointerDown}
        onPointerMove={handleCalendarPointerMove}
        onPointerUp={handleCalendarPointerUp}
        onPointerCancel={handleCalendarPointerCancel}
        onClickCapture={handleCalendarClickCapture}
        style={{
          touchAction: 'pan-y',
          '--calendar-drag-x': `${calendarDragOffset}px`,
          '--calendar-drag-opacity': calendarDragOffset ? 0.92 : 1,
        }}
      >
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-slate-800/60">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-1 sm:px-2 py-2 text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-500 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.getMonth() === monthIdx;
              const key = localDateKey(d);
              const dayGames = dedupeScheduleGames(byDate[key] ?? []);
              const isToday = key === todayStr;
              const doubleHeader = isDoubleHeaderDay(dayGames);
              const primaryGame = dayGames[0];
              const { isHome, opp } = primaryGame
                ? getScheduleOpponent(primaryGame, teamId)
                : { isHome: true, opp: null };
              return (
                <div
                  key={`${monthStr}-${key}`}
                  className={`aspect-square sm:aspect-auto sm:min-h-[128px] border-b border-r border-slate-800/50 p-0.5 sm:p-1.5 flex flex-col overflow-hidden ${inMonth ? '' : 'opacity-35'} ${isToday ? 'bg-slate-800' : ''}`}
                >
                  <div className={`text-[9px] sm:text-[11px] font-mono leading-none mb-0.5 sm:mb-1 flex-shrink-0 ${isToday ? `text-${THEME_COLOR}-300 font text-[14px]` : 'text-slate-400'}`}>
                    {inMonth ? d.getDate() : ''}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 min-h-0 ">
                    {primaryGame && (
                      doubleHeader ? (
                        <button
                          type="button"
                          onClick={() => openGamePicker(key, dayGames)}
                          className={`w-full flex-1 flex flex-col items-center justify-between gap-0.5 min-h-0 sm:min-h-[52px] rounded sm:rounded-lg px-0.5 py-0.5 sm:px-1 sm:py-1 transition-colors ${calendarGameSurfaceClass(isHome)}`}
                          title={`${isHome ? 'vs' : '@'} ${opp?.team?.name ?? 'Opponent'} · Doubleheader`}
                        >
                          <img
                            src={teamLogoUrl(opp?.team?.id)}
                            alt={opp?.team?.name ?? 'Opponent'}
                            className="w-6 h-6 sm:w-9 sm:h-9 object-contain flex-shrink-0 drop-shadow-sm"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <div className="flex flex-col items-center gap-0.5 w-full min-w-0">
                            {dayGames.map((g) => {
                              const label = formatCalendarGameLabel(g, teamId);
                              return (
                                <span
                                  key={g.gamePk}
                                  className={`text-[8px] sm:text-[9px] font-semibold tabular-nums leading-none ${calendarLabelClass(label.type)}`}
                                >
                                  {label.text}
                                </span>
                              );
                            })}
                          </div>
                        </button>
                      ) : (
                        (() => {
                          const gameLabel = formatCalendarGameLabel(primaryGame, teamId);
                          return (
                            <button
                              type="button"
                              onClick={() => goToGame(primaryGame.gamePk)}
                              className={`w-full flex-1 flex flex-col items-center justify-between gap-0 min-h-0 sm:min-h-[52px] rounded sm:rounded-lg px-0.5 py-0.5 sm:px-1 sm:py-1 transition-colors ${calendarGameSurfaceClass(isHome)} ${isToday && 'border-yellow-500 border-2'}`}
                              title={`${isHome ? 'vs' : '@'} ${opp?.team?.name ?? 'Opponent'} · ${gameLabel.text}`}
                            >
                              <img
                                src={teamLogoUrl(opp?.team?.id)}
                                alt={opp?.team?.name ?? 'Opponent'}
                                className="w-7 h-7 sm:w-11 sm:h-11 object-contain flex-shrink-0 drop-shadow-sm"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className={`text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none flex-shrink-0 ${calendarLabelClass(gameLabel.type)}`}>
                                {gameLabel.text}
                              </span>
                            </button>
                          );
                        })()
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const pickGame = (gamePk) => {
    setGamePicker(null);
    goToGame(gamePk);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 my-4">
        <div className="flex bg-slate-800 border border-slate-700 rounded-2xl p-1 ">
          <SegmentedControl
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'month', label: 'Monthly' },
              { value: 'list', label: 'List' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={season}
            onChange={setSeason}
            options={SCHEDULE_SEASON_OPTIONS}
            buttonClassName="bg-slate-900 min-w-[140px]"
          />
          {monthsForYear.length > 0 && (
            <Select
              value={selectedMonth}
              onChange={handleMonthSelect}
              options={monthsForYear.map((m) => {
                const mm = m.split('-')[1];
                return { value: mm, label: monthName(mm) };
              })}
              buttonClassName="bg-slate-900 min-w-[120px]"
            />
          )}
        </div>
      </div>

      {games.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">No schedule found for {season}.</div>
      )}

      {view === 'list' && filteredGames.length > 0 && (
        <div className="space-y-1">
          {filteredGames.map((g) => {
            const { isHome, opp } = getScheduleOpponent(g, teamId);
            const gameLabel = formatCalendarGameLabel(g, teamId);
            const dateStr = scheduleGameDateKey(g);
            const isToday = dateStr === todayStr;
            const dhLabel = getDoubleHeaderLabel(g);
            return (
              <div
                key={g.gamePk}
                ref={(el) => { if (el) gameRefs.current[g.gamePk] = el; }}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors cursor-pointer rounded-xl ${isToday ? `bg-${THEME_COLOR}-500/[0.06] border-${THEME_COLOR}-500/20` : ''}`}
                onClick={() => goToGame(g.gamePk)}
              >
                <div className="w-14 sm:w-16 text-xs text-slate-500 flex-shrink-0">
                  <div>{fmtDate(dateStr)}</div>
                  {dhLabel && <div className="text-[10px] text-slate-400 mt-0.5">{dhLabel}</div>}
                </div>
                <div className="w-5 sm:w-6 text-xs text-slate-500 flex-shrink-0">{isHome ? 'vs' : '@'}</div>
                <img src={teamLogoUrl(opp?.team?.id)} alt="" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" onError={(e) => (e.target.style.display = 'none')} />
                <div className="flex-1 min-w-0 text-sm font-medium truncate">{opp?.team?.name ?? opp?.team?.abbreviation ?? 'Opponent'}</div>
                <div className="text-right flex-shrink-0 text-sm">
                  <span className={`font-semibold tabular-nums ${calendarLabelClass(gameLabel.type)}`}>
                    {gameLabel.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && games.length > 0 && filteredGames.length === 0 && selectedMonth && (
        <div className="py-12 text-center text-slate-500 text-sm">No games in {monthName(selectedMonth)} {season}.</div>
      )}

      {view === 'month' && monthsForYear.length > 0 && selectedMonth && (
        renderMonthCalendar(`${season}-${selectedMonth}`)
      )}


      <Modal
        open={Boolean(gamePicker)}
        onClose={() => setGamePicker(null)}
        backDismiss
        historyKey="teamGamePicker"
        title={gamePicker ? `${fmtDate(gamePicker.dateKey)} · Doubleheader` : 'Doubleheader'}
        size="sm"
      >
        <div className="grid grid-cols-2 gap-3 p-4">
          {dedupeScheduleGames(gamePicker?.games ?? []).map((g) => {
            const { isHome, opp } = getScheduleOpponent(g, teamId);
            const label = formatCalendarGameLabel(g, teamId);
            const dhLabel = getDoubleHeaderLabel(g) ?? `G${g.gameNumber ?? '?'}`;
            return (
              <button
                key={g.gamePk}
                type="button"
                onClick={() => pickGame(g.gamePk)}
                className={`aspect-square flex flex-col items-center justify-between gap-1 rounded-xl px-2 py-3 transition-colors active:scale-[0.98] ${calendarGameSurfaceClass(isHome)}`}
              >
                <span className="text-[10px] font-semibold text-slate-400 leading-none">{dhLabel}</span>
                <img
                  src={teamLogoUrl(opp?.team?.id)}
                  alt={opp?.team?.name ?? 'Opponent'}
                  className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0 drop-shadow-sm"
                  onError={(e) => (e.target.style.display = 'none')}
                />
                <span className={`text-xs sm:text-sm font-semibold tabular-nums leading-none ${calendarLabelClass(label.type)}`}>
                  {label.text}
                </span>
                <span className="text-[10px] text-slate-500 leading-none truncate max-w-full">
                  {isHome ? 'vs' : '@'} {opp?.team?.abbreviation ?? opp?.team?.name ?? 'Opp'}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

// ─── Roster Tab ──────────────────────────────────────────────────────────────
function rosterBirthplace(person) {
  return [person?.birthCity, person?.birthStateProvince, person?.birthCountry].filter(Boolean).join(', ');
}

function buildRosterCountryGroups(roster) {
  const groups = new Map();
  for (const entry of roster ?? []) {
    const country = entry.person?.birthCountry || 'Unknown';
    const existing = groups.get(country) ?? { country, players: [] };
    existing.players.push(entry);
    groups.set(country, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      players: group.players.sort((a, b) => (a.person?.fullName ?? '').localeCompare(b.person?.fullName ?? '')),
    }))
    .sort((a, b) => b.players.length - a.players.length || a.country.localeCompare(b.country));
}

function CountryFlag({ country, className = 'h-4 w-6' }) {
  const flagUrl = countryFlagUrl(country);
  if (!flagUrl) {
    return (
      <span className={`${className} rounded-[3px] bg-slate-700/80 border border-slate-600 flex-shrink-0`} aria-hidden />
    );
  }

  return (
    <img
      src={flagUrl}
      alt={`${country} flag`}
      title={country}
      className={`${className} rounded-[3px] object-cover shadow-sm ring-1 ring-white/10 flex-shrink-0`}
      onError={(e) => (e.target.style.display = 'none')}
    />
  );
}

function RosterTab({
  teamId,
  season,
  selectedCountry,
  selectedCountryScroll = 0,
  onSelectedCountryChange,
  onSelectedCountryScrollChange,
  onNavigateAway,
}) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const countryListRef = useRef(null);
  const countrySheetHistoryRef = useRef(false);

  const clearCountrySheetState = useCallback(() => {
    saveTeamPageState(teamId, { activeTab: 'roster', rosterCountry: null, rosterCountryScroll: 0 });
    onSelectedCountryScrollChange?.(0);
    onSelectedCountryChange(null);
  }, [onSelectedCountryChange, onSelectedCountryScrollChange, teamId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(currentTeam,position)&season=${season}`
        );
        const json = await res.json();
        setRoster(json.roster ?? []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  const grouped = {};
  (roster ?? []).forEach((p) => {
    const type = p.person?.primaryPosition?.type ?? 'Other';
    (grouped[type] = grouped[type] ?? []).push(p);
  });
  const countryGroups = buildRosterCountryGroups(roster);
  const selectedCountryGroup = countryGroups.find((group) => group.country === selectedCountry);

  const closeCountrySheet = useCallback(() => {
    if (countrySheetHistoryRef.current) {
      countrySheetHistoryRef.current = false;
      clearCountrySheetState();
      window.history.back();
      return;
    }

    clearCountrySheetState();
  }, [clearCountrySheetState]);

  useEffect(() => {
    const el = countryListRef.current;
    if (!selectedCountryGroup || !el) return;
    requestAnimationFrame(() => {
      el.scrollTop = selectedCountryScroll || 0;
    });
  }, [selectedCountryGroup, selectedCountryScroll]);

  useEffect(() => {
    if (!selectedCountryGroup || countrySheetHistoryRef.current) return;

    if (window.history.state?.rosterCountrySheet) {
      countrySheetHistoryRef.current = true;
      return;
    }

    window.history.pushState({ ...(window.history.state ?? {}), rosterCountrySheet: true }, '');
    countrySheetHistoryRef.current = true;
  }, [selectedCountryGroup]);

  useEffect(() => {
    const onPopState = () => {
      if (!selectedCountryGroup) return;
      countrySheetHistoryRef.current = false;
      clearCountrySheetState();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [clearCountrySheetState, selectedCountryGroup]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-5">
      {countryGroups.length > 0 && (
        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Diversity</div>
              <div className="text-xs text-slate-400">Birth countries on the active roster</div>
            </div>
            <div className="text-xs font-semibold text-slate-500">{roster?.length ?? 0} players</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {countryGroups.map((group) => (
              <button
                key={group.country}
                type="button"
                onClick={() => {
                  onNavigateAway?.({ activeTab: 'roster', rosterCountry: group.country, rosterCountryScroll: 0 });
                  onSelectedCountryScrollChange?.(0);
                  onSelectedCountryChange(group.country);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-800/50 px-3 py-2 text-left text-sm font-semibold text-slate-200 hover:border-emerald-500/40 hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                <CountryFlag country={group.country} />
                <span>{group.country}</span>
                <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-xs tabular-nums text-slate-400">
                  {group.players.length}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {Object.entries(grouped).map(([posType, players]) => (
        <div key={posType}>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{posType}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {players.map((p) => (
              <Link
                key={p.person.id}
                to={`/player/${p.person.id}`}
                onClick={onNavigateAway}
                className="flex items-center gap-3 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 rounded-2xl px-3 py-2.5 transition-colors"
              >
                <img
                  src={playerHeadshotUrl(p.person.id)}
                  alt=""
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-slate-700 flex-shrink-0 bg-slate-800"
                  onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.person.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {p.position?.abbreviation ?? p.person?.primaryPosition?.abbreviation ?? '—'} · #{p.jerseyNumber ?? '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <Modal
        open={Boolean(selectedCountryGroup)}
        onClose={closeCountrySheet}
        title={selectedCountryGroup ? `${selectedCountryGroup.country} Players` : 'Players'}
        size="md"
        panelClassName="max-h-[85vh] overflow-hidden"
      >
        <div ref={countryListRef} className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
          {selectedCountryGroup?.players.map((p) => (
            <Link
              key={p.person.id}
              to={`/player/${p.person.id}`}
              onClick={() => {
                const scrollTop = countryListRef.current?.scrollTop ?? 0;
                onSelectedCountryScrollChange?.(scrollTop);
                onNavigateAway?.({
                  activeTab: 'roster',
                  rosterCountry: selectedCountryGroup.country,
                  rosterCountryScroll: scrollTop,
                });
              }}
              className="flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 px-3 py-2.5 hover:bg-slate-800/75 transition-colors"
            >
              <img
                src={playerHeadshotUrl(p.person.id)}
                alt=""
                className="w-11 h-11 rounded-xl object-cover border border-slate-700 flex-shrink-0 bg-slate-800"
                onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-slate-100 truncate">{p.person.fullName}</div>
                <div className="text-xs text-slate-500 truncate">
                  {p.position?.abbreviation ?? p.person?.primaryPosition?.abbreviation ?? '—'}
                  {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ''}
                  {rosterBirthplace(p.person) ? ` · ${rosterBirthplace(p.person)}` : ''}
                </div>
              </div>
              <CountryFlag country={selectedCountryGroup.country} className="h-3.5 w-5" />
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── Depth Chart Tab ──────────────────────────────────────────────────────────
function DepthChartTab({ teamId, season, onNavigateAway }) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(currentTeam,position)&season=${season}`);
        const json = await res.json();
        setRoster(json.roster ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;

  const POS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'RP', 'CL'];
  const grouped = {};
  (roster ?? []).forEach((p) => {
    const pos = p.person?.primaryPosition?.abbreviation ?? 'UTIL';
    (grouped[pos] = grouped[pos] ?? []).push(p);
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {POS_ORDER.filter((pos) => grouped[pos]).map((pos) => (
        <div key={pos} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3">
          <div className={`text-xs font-bold text-${THEME_COLOR}-400 mb-2`}>{pos}</div>
          {grouped[pos].map((p) => (
            <Link
              key={p.person.id}
              to={`/player/${p.person.id}`}
              onClick={onNavigateAway}
              className="flex items-center gap-2 py-1 hover:opacity-80 transition-opacity"
            >
              <img src={playerHeadshotUrl(p.person.id)} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0" onError={(e) => (e.target.src = FALLBACK_HEADSHOT)} />
              <span className="text-xs font-medium truncate">{compactPlayerName(p.person)}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Splits Tab ───────────────────────────────────────────────────────────────
function SplitsTab({ teamId, season }) {
  const [splits, setSplits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/stats?stats=statSplits&group=hitting&season=${season}&teamId=${teamId}&sitCodes=vl,vr,h,a&hydrate=team`
        );
        const json = await res.json();
        setSplits(json.stats?.[0]?.splits ?? []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const SPLIT_LABELS = { vl: 'vs LHP', vr: 'vs RHP', h: 'Home', a: 'Away' };

  return (
    <div className={`${TABLE_SCROLL} -mx-1 px-1`}>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_MIN_W.sm}`}>
        <thead>
          <tr className="border-b border-slate-700/60">
            <th className={`${scrollStickyHead('bg-[#121827]')} text-slate-400 font-medium`}>Split</th>
            {['G', 'AB', 'H', 'HR', 'RBI', 'AVG', 'OBP', 'SLG', 'OPS'].map((c) => (
              <th key={c} className={scrollStatHead('font-medium text-slate-400')}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(splits ?? []).map((s, i) => (
            <tr key={i} className="group border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
              <td className={`${scrollStickyCell('bg-[#121827]')} text-xs font-medium text-slate-300`}>{SPLIT_LABELS[s.split?.code] ?? s.split?.description ?? s.split?.code}</td>
              {[
                ['gamesPlayed', 0], ['atBats', 0], ['hits', 0], ['homeRuns', 0], ['rbi', 0],
                ['avg', 3], ['obp', 3], ['slg', 3], ['ops', 3],
              ].map(([key, dec]) => (
                <td key={key} className={scrollStatCell()}>{fmt(s.stat?.[key], dec)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(splits ?? []).length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No splits data available.</div>}
    </div>
  );
}

// ─── Injuries Tab ────────────────────────────────────────────────────────────
function InjuriesTab({ teamId, season, onNavigateAway }) {
  const [roster, setRoster] = useState(null);
  const [injuryInfoByPlayer, setInjuryInfoByPlayer] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const seasonStart = new Date(Number(season), 0, 1);
        const [res, txnsJson] = await Promise.all([
          fetch(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man&hydrate=person(position)&season=${season}`
          ),
          fetchStatsApiJson('/api/v1/transactions', {
            query: {
              teamId,
              startDate: localDateKey(seasonStart),
              endDate: localDateKey(today),
              sportId: 1,
            },
            ttl: 60_000,
            retries: 1,
          }),
        ]);
        const json = await res.json();
        setRoster((json.roster ?? []).filter((entry) => isInjuredStatus(entry.status)));
        const info = {};
        [...(txnsJson.transactions ?? [])]
          .filter(injuryTransactionMatches)
          .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
          .forEach((txn) => {
            if (!info[txn.person.id]) info[txn.person.id] = parseInjuryInfo(txn);
          });
        setInjuryInfoByPlayer(info);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [teamId, season]);

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  const injured = roster ?? [];
  const grouped = injured.reduce((acc, p) => {
    const key = p.status?.description ?? p.status?.code ?? 'Injured';
    (acc[key] = acc[key] ?? []).push(p);
    return acc;
  }, {});
  const pitchers = injured.filter((p) => p.position?.abbreviation === 'P').length;
  const positionPlayers = injured.length - pitchers;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-red-300">Injury Report</div>
            <div className="mt-1 text-sm text-slate-400">
              40-man roster injured-list statuses from MLB Stats API.
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-semibold text-slate-300">
              {injured.length} total
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-semibold text-slate-300">
              {pitchers} P
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-semibold text-slate-300">
              {positionPlayers} POS
            </span>
          </div>
        </div>
      </div>

      {injured.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No 40-man injuries reported.</div>}

      {Object.entries(grouped).map(([statusLabel, players]) => {
        const headingMeta = injuryHeadingMeta(statusLabel);
        return (
        <section key={statusLabel} className="overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900/70">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl border ${headingMeta.tone}`}>
                <i className={`fa-solid ${headingMeta.icon}`} aria-hidden />
              </span>
              <div className="truncate font-semibold text-slate-100">{statusLabel}</div>
            </div>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400">
              {players.length}
            </span>
          </div>
          <div className="divide-y divide-slate-800/70">
            {players.map((p) => {
              const injuryInfo = injuryInfoByPlayer[p.person.id];
              return (
                <Link
                  key={p.person.id}
                  to={`/player/${p.person.id}`}
                  onClick={onNavigateAway}
                  className="grid grid-cols-[auto_1fr] items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-800/35"
                >
                  <img
                    src={playerHeadshotUrl(p.person.id)}
                    alt=""
                    className="h-12 w-12 rounded-2xl border border-slate-700 bg-slate-800 object-cover"
                    onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="truncate text-sm font-bold text-slate-100">{p.person.fullName}</div>
                      <span className="text-xs font-semibold text-slate-500">
                        {p.position?.abbreviation ?? p.person?.primaryPosition?.abbreviation ?? '—'}
                        {p.jerseyNumber || p.person?.primaryNumber ? ` · #${p.jerseyNumber ?? p.person.primaryNumber}` : ''}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-300">
                      {injuryInfo?.reason ?? 'Injury details unavailable'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        Since <span className="font-semibold text-slate-400">{injuryInfo?.since ?? '—'}</span>
                      </span>
                      {injuryInfo?.transactionDate && injuryInfo.transactionDate !== injuryInfo.since && (
                        <span>
                          Reported <span className="font-semibold text-slate-400">{injuryInfo.transactionDate}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}

function TeamTradeDetailModal({ txn, tradeBundle, tradeLoading, onClose, onNavigateAway }) {
  if (!txn) return null;
  const tradeGroups = groupTradePlayersByReceivingTeam(tradeBundle);

  return (
    <Modal
      open={Boolean(txn)}
      onClose={onClose}
      backDismiss
      historyKey="teamTradeDetail"
      size="lg"
      panelClassName="max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-[#0d1520] border-slate-700/70"
    >
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`text-lg sm:text-xl font-bold text-${THEME_COLOR}-300`}>Trade</div>
            <p className="text-sm text-slate-500 mt-1">{fmtDateWithYear(txn.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-lg flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {tradeLoading ? (
          <LoadingSpinner size="md" py="py-8" />
        ) : tradeGroups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tradeGroups.map(({ team, players }) => (
              <div key={team.id} className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <img src={teamLogoUrl(team.id)} alt="" className="h-12 w-12 object-contain" />
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Receives</div>
                    <div className="truncate font-bold text-slate-100">{team.name}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {players.map((person) => (
                    person.cash ? (
                      <div
                        key={person.id}
                        className="flex items-center gap-2 rounded-2xl bg-slate-800/50 px-3 py-2"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-lg" aria-hidden>
                          💵
                        </span>
                        <span className="text-sm font-semibold text-slate-200">Cash Considerations</span>
                      </div>
                    ) : (
                      <Link
                        key={person.id}
                        to={`/player/${person.id}`}
                        onClick={onNavigateAway}
                        className="flex items-center gap-2 rounded-2xl bg-slate-800/50 px-3 py-2 transition-colors hover:bg-slate-800"
                      >
                        <img
                          src={playerHeadshotUrl(person.id)}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover bg-slate-700"
                          onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
                        />
                        <span className="text-sm font-semibold text-slate-200">{person.fullName}</span>
                      </Link>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            Trade details are unavailable for this row.
          </div>
        )}

        {txn.description && (
          <p className="border-t border-slate-800/60 pt-4 text-sm leading-relaxed text-slate-400">
            {txn.description}
          </p>
        )}
      </div>
    </Modal>
  );
}

function TradeAnalysisModal({ open, onClose, loading, error, analysis, progress, teamId, teamName }) {
  const displayTeamName = teamName ?? mlbTeams.find((team) => Number(team.id) === Number(teamId))?.name ?? 'Team';

  const playerValueRow = (player, tone) => (
    <Link
      key={`${player.person?.id ?? player.person?.fullName}-${player.teamId}`}
      to={player.person?.id ? `/player/${player.person.id}` : '#'}
      className="group flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/35 px-2.5 py-2 transition-colors hover:bg-slate-800/50"
    >
      <img
        src={playerHeadshotUrl(player.person?.id)}
        alt=""
        className="h-9 w-9 rounded-full bg-slate-800 object-cover"
        onError={(e) => (e.target.src = FALLBACK_HEADSHOT)}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-slate-200 group-hover:text-white">
          {player.person?.fullName ?? 'Unknown player'}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
          {player.teamId && <img src={teamLogoUrl(player.teamId)} alt="" className="h-4 w-4 object-contain" />}
          <span>{player.seasons || 0} yr</span>
          <span>·</span>
          <span>{player.games || 0} G</span>
        </div>
      </div>
      <div className={`font-mono text-sm font-black tabular-nums ${tone === 'in' ? 'text-emerald-300' : 'text-red-200'}`}>
        {player.score.toFixed(1)}
      </div>
    </Link>
  );

  const teamLogoStack = (teams, tone) => (
    <div className="flex -space-x-2">
      {teams.slice(0, 4).map((team) => (
        <span
          key={`${tone}-${team.id ?? team.name}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-slate-800 bg-slate-950 shadow-lg"
          title={team.name}
        >
          {team.id ? (
            <img src={teamLogoUrl(team.id)} alt="" className="h-7 w-7 object-contain" />
          ) : (
            <span className="text-[10px] font-black text-slate-500">{team.abbreviation ?? '?'}</span>
          )}
        </span>
      ))}
      {teams.length > 4 && (
        <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-800 bg-slate-950 text-[10px] font-black text-slate-400">
          +{teams.length - 4}
        </span>
      )}
    </div>
  );

  const renderTrade = (trade, tone) => {
    const positive = trade.net >= 0;
    const cardTone = tone === 'best'
      ? 'border-emerald-400/25 from-emerald-500/15 via-slate-900/80 to-slate-950/80'
      : 'border-red-400/25 from-red-500/15 via-slate-900/80 to-slate-950/80';
    return (
      <div
        key={`${trade.date}-${trade.id}`}
        className={`overflow-hidden rounded-[2rem] border bg-gradient-to-br p-4 shadow-2xl shadow-black/20 ${cardTone}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src={teamLogoUrl(teamId)} alt="" className="h-10 w-10 object-contain" />
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-100">{fmtDateWithYear(trade.date)}</div>
                <div className="truncate text-[11px] font-semibold text-slate-500">
                  {displayTeamName} trade impact
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`font-display text-4xl leading-none tabular-nums ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
              {positive ? '+' : ''}{trade.net.toFixed(1)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">Net Value</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/30 px-3 py-3">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Acquired</div>
            <div className="flex items-center gap-2">
              <img src={teamLogoUrl(teamId)} alt="" className="h-8 w-8 object-contain" />
              <div className="truncate text-xs font-bold text-slate-200">{trade.acquiredPlayers.length} players</div>
            </div>
          </div>
          <i className="fa-solid fa-right-left text-slate-600" aria-hidden />
          <div className="min-w-0 text-right">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Trade Partners</div>
            <div className="flex justify-end">{teamLogoStack(trade.partnerTeams, tone)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Value In</div>
              <div className="font-mono text-xs font-bold text-emerald-200">{trade.acquiredValue.toFixed(1)}</div>
            </div>
            <div className="space-y-2">
              {trade.acquiredPlayers.length
                ? trade.acquiredPlayers.map((p) => playerValueRow(p, 'in'))
                : <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 px-3 py-3 text-xs text-slate-600">No tracked MLB value</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Value Out</div>
              <div className="font-mono text-xs font-bold text-red-200">{trade.lostValue.toFixed(1)}</div>
            </div>
            <div className="space-y-2">
              {trade.lostPlayers.length
                ? trade.lostPlayers.map((p) => playerValueRow(p, 'out'))
                : <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 px-3 py-3 text-xs text-slate-600">No tracked MLB value</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      backDismiss
      historyKey="teamTradeAnalysis"
      size="full"
      title="Trade Analysis"
      className="px-3 sm:px-6"
      panelClassName="mx-auto max-w-6xl max-h-[90vh] overflow-y-auto bg-[#0d1520] border-slate-700/70"
    >
      <div className="p-4 sm:p-5 space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-relaxed text-slate-400">
          Estimate based on post-trade MLB production with the receiving team. It does not include salaries,
          extensions, prospects who never reached MLB, cash, draft picks, or WAR.
        </div>

        {loading && (
          <div className="py-10">
            <LoadingSpinner size="lg" py="py-4" />
            <div className="mx-auto mt-4 max-w-md">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Analyzing trades</span>
                <span>{progress.done} / {progress.total || '...'}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-slate-700 bg-slate-950">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-${THEME_COLOR}-500 via-amber-300 to-red-400 transition-all duration-300`}
                  style={{ width: progress.total ? `${Math.min(100, (progress.done / progress.total) * 100)}%` : '12%' }}
                />
              </div>
            </div>
          </div>
        )}
        {!loading && error && <div className="py-8 text-center text-sm text-red-400">{error}</div>}

        {!loading && !error && analysis && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="space-y-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">Top 10 Best</div>
              {analysis.best.map((trade) => renderTrade(trade, 'best'))}
            </section>
            <section className="space-y-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-red-300">Top 10 Worst</div>
              {analysis.worst.map((trade) => renderTrade(trade, 'worst'))}
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}

async function analyzeTeamTrades(teamId, trades, onProgress) {
  const statCache = new Map();
  const tradeRows = collapseTradeTransactions(trades.filter(isTradeTransaction)).map((trade) => ({
    key: `${trade.id ?? 'no-id'}:${trade.date}:${trade.tradeSummary ?? tradeItemLabel(trade)}`,
    rows: trade.tradeRows ?? [trade],
  }));
  onProgress?.({ done: 0, total: tradeRows.length });
  let done = 0;
  const analyzed = await mapLimit(tradeRows, 5, async ({ key, rows }) => {
    const tradeYear = Number(rows[0]?.date?.slice(0, 4)) || 1900;
    const acquiredRows = uniqueTradeRows(
      rows.filter((row) => Number(row.toTeam?.id) === Number(teamId) && row.person?.id),
      () => teamId,
    );
    const lostRows = uniqueTradeRows(
      rows.filter((row) => Number(row.fromTeam?.id) === Number(teamId) && row.person?.id && row.toTeam?.id),
      (row) => row.toTeam?.id,
    );

    if (!acquiredRows.length && !lostRows.length) {
      done += 1;
      onProgress?.({ done, total: tradeRows.length });
      return null;
    }

    const acquiredPlayers = await Promise.all(acquiredRows.map((row) =>
      scorePlayerForTeamAfterTrade(row.person, teamId, tradeYear, statCache)
    ));
    const lostPlayers = await Promise.all(lostRows.map((row) =>
      scorePlayerForTeamAfterTrade(row.person, row.toTeam.id, tradeYear, statCache)
    ));
    const acquiredValue = acquiredPlayers.reduce((sum, player) => sum + player.score, 0);
    const lostValue = lostPlayers.reduce((sum, player) => sum + player.score, 0);
    const partnerTeams = [...rows
      .flatMap((row) => [row.fromTeam, row.toTeam])
      .filter((team) => team && Number(team.id) !== Number(teamId))
      .reduce((map, team) => {
        const key = team.id ?? team.name;
        if (!map.has(key)) map.set(key, team);
        return map;
      }, new Map())
      .values()];

    const result = {
      id: rows[0]?.id ?? key,
      date: rows[0]?.date,
      partnerTeams,
      acquiredPlayers: acquiredPlayers.sort((a, b) => b.score - a.score),
      lostPlayers: lostPlayers.sort((a, b) => b.score - a.score),
      acquiredValue,
      lostValue,
      net: acquiredValue - lostValue,
    };
    done += 1;
    onProgress?.({ done, total: tradeRows.length });
    return result;
  });

  const valid = analyzed.filter(Boolean);
  return {
    best: [...valid].sort((a, b) => b.net - a.net).slice(0, 10),
    worst: [...valid].sort((a, b) => a.net - b.net).slice(0, 10),
  };
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ teamId, onNavigateAway }) {
  const [txns, setTxns] = useState([]);
  const [txnMode, setTxnMode] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [tradeBundle, setTradeBundle] = useState([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const today = new Date();
        const start = new Date(today);
        if (txnMode === 'trades') {
          start.setFullYear(1900, 0, 1);
        } else {
          start.setDate(today.getDate() - 120);
        }
        const fmt2 = (d) => localDateKey(d);
        const [statsResult, historicalResult] = await Promise.allSettled([
          fetchStatsApiJson('/api/v1/transactions', {
            query: {
              teamId,
              startDate: fmt2(start),
              endDate: fmt2(today),
              sportId: 1,
            },
            signal: controller.signal,
            ttl: 60_000,
            retries: 1,
          }),
          txnMode === 'trades' ? getHistoricalTradesForTeam(teamId) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        if (statsResult.status === 'rejected' && txnMode !== 'trades') throw statsResult.reason;
        if (statsResult.status === 'rejected' && historicalResult.status === 'rejected') throw statsResult.reason;
        const json = statsResult.status === 'fulfilled' ? statsResult.value : { transactions: [] };
        const historicalTrades = historicalResult.status === 'fulfilled' ? historicalResult.value : [];
        const sorted = [...(json.transactions ?? []), ...historicalTrades].sort(
          (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0),
        );
        const display = txnMode === 'trades'
          ? collapseTradeTransactions(sorted.filter(isTradeTransaction))
          : collapseTradeTransactions(sorted);
        if (!cancelled) {
          setTxns(display);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [teamId, txnMode]);

  const openTrade = async (txn) => {
    setSelectedTrade(txn);
    setTradeBundle(txn.tradeRows ?? [txn]);
    setTradeLoading(true);
    const bundle = txn.tradeRows ?? await fetchTeamTradeBundle(txn);
    setTradeBundle(bundle);
    setTradeLoading(false);
  };

  const runTradeAnalysis = async () => {
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisProgress({ done: 0, total: 0 });
    try {
      const sourceRows = txns.flatMap((txn) => txn.tradeRows ?? [txn]);
      const result = await analyzeTeamTrades(teamId, sourceRows, setAnalysisProgress);
      setAnalysis(result);
    } catch (e) {
      setAnalysisError(e.message || 'Unable to analyze trades.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" py="py-16" />;
  if (error) return <div className="py-8 text-center text-red-400 text-sm">{error}</div>;

  return (
    <>
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2">
        <div className="text-xs text-slate-500">
          {txnMode === 'trades' ? `${txns.length} all-time trades` : `${txns.length} recent moves`}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {txnMode === 'trades' && txns.length > 0 && (
            <button
              type="button"
              onClick={runTradeAnalysis}
              className={`rounded-2xl border border-${THEME_COLOR}-500/35 bg-${THEME_COLOR}-500/10 px-3 py-2 text-xs font-bold text-${THEME_COLOR}-200 transition-colors hover:bg-${THEME_COLOR}-500/20`}
            >
              Analyze Trades
            </button>
          )}
          <div className="flex rounded-2xl border border-slate-700 bg-slate-800 p-1">
            <SegmentedControl
              value={txnMode}
              onChange={setTxnMode}
              size="sm"
              options={[
                { value: 'recent', label: 'Recent' },
                { value: 'trades', label: 'Trades All Time' },
              ]}
            />
          </div>
        </div>
      </div>

      {txns.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">
          {txnMode === 'trades' ? 'No trades found.' : 'No recent transactions.'}
        </div>
      )}
      {txns.map((t, i) => {
        const trade = isTradeTransaction(t);
        const rowLabel = t.tradeSummary ?? tradeItemLabel(t);
        const content = (
          <>
            <div className="w-20 sm:w-28 text-xs text-slate-500 flex-shrink-0 pt-0.5 tabular-nums">
              {txnMode === 'trades' ? fmtDateWithYear(t.date) : (t.date ? fmtDate(t.date) : '—')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                {t.person?.id && !trade ? (
                  <Link
                    to={`/player/${t.person.id}`}
                    onClick={onNavigateAway}
                    className={`hover:text-${THEME_COLOR}-400 transition-colors`}
                  >
                    {t.person?.fullName ?? '—'}
                  </Link>
                ) : rowLabel}
              </div>
              <div className={`mt-0.5 text-xs ${trade ? `text-${THEME_COLOR}-300` : 'text-slate-400'}`}>
                {t.typeDesc ?? t.description ?? '—'}
              </div>
              {txnMode === 'trades' && t.fromTeam?.name && t.toTeam?.name && (
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {t.fromTeam.name} → {t.toTeam.name}
                </div>
              )}
              {t.description && t.typeDesc && t.description !== t.typeDesc && (
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
              )}
            </div>
            {trade && (
              <i className="fa-solid fa-chevron-right mt-1 flex-shrink-0 text-[10px] text-slate-600" aria-hidden />
            )}
          </>
        );

        if (trade) {
          return (
            <button
              key={t.id ?? `${t.date}-${t.person?.id}-${i}`}
              type="button"
              onClick={() => openTrade(t)}
              className="flex w-full items-start gap-3 rounded-xl border-b border-slate-800/30 px-3 py-3 text-left transition-colors hover:bg-slate-800/25"
            >
              {content}
            </button>
          );
        }

        return (
          <div key={t.id ?? `${t.date}-${t.person?.id}-${i}`} className="flex items-start gap-3 px-3 sm:px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors rounded-xl">
            {content}
          </div>
        );
      })}
    </div>
    <TeamTradeDetailModal
      txn={selectedTrade}
      tradeBundle={tradeBundle}
      tradeLoading={tradeLoading}
      onClose={() => setSelectedTrade(null)}
      onNavigateAway={onNavigateAway}
    />
    <TradeAnalysisModal
      open={analysisOpen}
      onClose={() => setAnalysisOpen(false)}
      loading={analysisLoading}
      error={analysisError}
      analysis={analysis}
      progress={analysisProgress}
      teamId={teamId}
    />
    </>
  );
}

function normalizeScheduleMonth(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes('-')) return str.split('-').pop() ?? '';
  return str;
}

function readTeamPageDefaults(teamId) {
  const saved = loadTeamPageState(teamId);
  return {
    activeTab: saved?.activeTab ?? 'stats',
    season: saved?.season ?? String(CURRENT_YEAR),
    statsSub: saved?.statsSub ?? 'batting',
    statsSeason: saved?.statsSeason ?? (saved?.statsMode === 'historical' ? 'all' : String(CURRENT_YEAR)),
    scheduleView: saved?.scheduleView ?? 'month',
    scheduleMonth: normalizeScheduleMonth(saved?.scheduleMonth),
    rosterCountry: saved?.rosterCountry ?? null,
    rosterCountryScroll: Number(saved?.rosterCountryScroll) || 0,
  };
}

// ─── Main TeamPage ────────────────────────────────────────────────────────────
function TeamPageContent({ teamId }) {
  const [teamInfo, setTeamInfo] = useState(null);
  const [teamRecord, setTeamRecord] = useState(null);
  const defaults = useMemo(() => readTeamPageDefaults(teamId), [teamId]);
  const [season, setSeason] = useState(defaults.season);
  const [activeTab, setActiveTab] = useState(defaults.activeTab);
  const [statsSub, setStatsSub] = useState(defaults.statsSub);
  const [statsSeason, setStatsSeason] = useState(defaults.statsSeason);
  const [scheduleView, setScheduleView] = useState(defaults.scheduleView);
  const [scheduleMonth, setScheduleMonth] = useState(defaults.scheduleMonth);
  const [rosterCountry, setRosterCountry] = useState(defaults.rosterCountry);
  const [rosterCountryScroll, setRosterCountryScroll] = useState(defaults.rosterCountryScroll);
  const { toggleFavoriteTeam, isFavoriteTeam } = useFavoriteTeams();
  const isFavorite = isFavoriteTeam(teamId);
  const teamSportId = Number(teamInfo?.sport?.id) || MLB_SPORT_ID;

  useEffect(() => {
    restoreTeamPageScroll(teamId);
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadTeamInfo = async () => {
      try {
        const json = await fetchStatsApiJson(`/api/v1/teams/${teamId}`, {
          query: { hydrate: 'division,league,venue,sport' },
          signal: controller.signal,
          ttl: 5 * 60_000,
          retries: 1,
        });
        if (!cancelled) setTeamInfo(json.teams?.[0] ?? null);
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') setTeamInfo(null);
      }
    };

    loadTeamInfo();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadStandings = async () => {
      try {
        const json = await fetchStatsApiJson('/api/v1/standings', {
          query: {
            leagueId: '103,104',
            season,
            standingsTypes: 'regularSeason',
          },
          signal: controller.signal,
          ttl: 60_000,
          retries: 1,
        });
        if (cancelled) return;

        const records = (json.records ?? []).flatMap((record) => record.teamRecords ?? []);
        const rec = records.find((record) => record.team?.id === Number(teamId));
        setTeamRecord(rec?.leagueRecord ?? rec?.records?.splitRecords?.[0] ?? null);
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setTeamRecord(null);
        }
      }
    };

    loadStandings();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [teamId, season]);

  useEffect(() => {
    saveTeamPageState(teamId, {
      activeTab,
      season,
      statsSub,
      statsSeason,
      scheduleView,
      scheduleMonth,
      rosterCountry,
      rosterCountryScroll,
    });
  }, [teamId, activeTab, season, statsSub, statsSeason, scheduleView, scheduleMonth, rosterCountry, rosterCountryScroll]);

  const teamPageSnapshot = useMemo(() => ({
    activeTab,
    season,
    statsSub,
    statsSeason,
    scheduleView,
    scheduleMonth,
    rosterCountry,
    rosterCountryScroll,
  }), [activeTab, season, statsSub, statsSeason, scheduleView, scheduleMonth, rosterCountry, rosterCountryScroll]);

  const onNavigateAway = useCallback((overrides = {}) => {
    persistTeamPageLeave(teamId, { ...teamPageSnapshot, ...overrides });
  }, [teamId, teamPageSnapshot]);

  const toggleFavorite = () => {
    const idNum = Number(teamId);
    if (!idNum) return;
    toggleFavoriteTeam(idNum);
  };

  const TABS = [
    { key: 'stats', label: 'Stats' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'roster', label: 'Roster' },
    { key: 'depth', label: 'Depth' },
    { key: 'splits', label: 'Splits' },
    { key: 'injuries', label: 'Injuries' },
    { key: 'transactions', label: 'Moves' },
  ];

  const recordText = teamRecord
    ? `${teamRecord.wins ?? 0}–${teamRecord.losses ?? 0}`
    : null;
  const heroBackgroundTeamId = teamInfo?.parentOrgId ?? teamId;

  return (
    <div className="max-w-4xl mx-auto sm:px-6 sm:py-8">
      

      <div className="bg-[#121827] border border-slate-700/60 sm:rounded-2xl overflow-hidden">
        <div className="relative h-[180px] sm:h-[240px] overflow-hidden px-5 sm:px-8 py-5 sm:py-6 flex flex-col">
          {/* TEAM BANNER */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-[#121827]" />
          <img
            src={teamLogoUrl(heroBackgroundTeamId)}
            alt=""
            className="absolute -right-4 sm:right-6 top-1/2 -translate-y-1/2 w-36 sm:w-52 h-36 sm:h-52 object-contain opacity-[.75] pointer-events-none"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

          <div className="relative flex items-center justify-between gap-3 mb-auto">
           
            <div className="flex items-center gap-2 flex-shrink-0">
              <Select
                value={season}
                onChange={setSeason}
                options={SEASON_OPTIONS}
                buttonClassName="bg-slate-900/80 border-slate-600/80 text-xs sm:text-sm min-w-[88px]"
              />
              <button
                type="button"
                onClick={toggleFavorite}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all active:scale-[0.985] ${
                  isFavorite
                    ? 'bg-yellow-400/15 hover:bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-600/80'
                }`}
                title={isFavorite ? 'Unfavorite team' : 'Favorite team'}
              >
                {isFavorite ? '★' : '☆'}
                <span className="hidden sm:inline ml-1">{isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-end gap-4 sm:gap-5 mt-4">
            <img
              src={teamLogoUrl(teamId)}
              alt={teamInfo?.name}
              className="w-16 h-16 sm:w-24 sm:h-24 object-contain flex-shrink-0 drop-shadow-lg"
              onError={(e) => (e.target.style.display = 'none')}
            />
            <div className="pb-1 min-w-0">
              <h1
                className="text-2xl sm:text-4xl font-bold text-white leading-none mb-1.5 truncate"
                style={HERO_TEXT_SHADOW}
              >
                {teamInfo?.name ?? `Team #${teamId}`}
              </h1>
              {recordText && (
                <div className={`text-${THEME_COLOR}-300 font-semibold text-sm sm:text-base`} style={HERO_TEXT_SHADOW}>
                  {recordText}
                  <span className="text-slate-400 font-normal text-xs sm:text-sm ml-2">{season} Regular Season</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-8 py-4 border-b border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'League', value: teamInfo?.league?.name ?? '—' },
            { label: 'Division', value: teamInfo?.division?.name ?? '—' },
            { label: 'Ballpark', value: (typeof teamInfo?.venue === 'string' ? teamInfo.venue : teamInfo?.venue?.name) ?? '—' },
            { label: 'Est.', value: teamInfo?.firstYearOfPlay ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
              <div className="text-sm font-semibold text-slate-200 truncate">{value}</div>
            </div>
          ))}
        </div>

        <div className=" sm:px-8 py-5 sm:py-6">
          <TabBar
            variant="page"
            tabs={TABS}
            activeKey={activeTab}
            onChange={(tab) => {
              setActiveTab(tab);
              if (tab !== 'roster') {
                setRosterCountry(null);
                setRosterCountryScroll(0);
              }
            }}
          >
            {(key) => {
              if (key === 'stats') {
                return (
                  <StatsTab
                    key={`${teamId}:${season}`}
                    teamId={teamId}
                    sub={statsSub}
                    setSub={setStatsSub}
                    statsSeason={statsSeason}
                    setStatsSeason={setStatsSeason}
                    teamName={teamInfo?.name}
                    firstYearOfPlay={teamInfo?.firstYearOfPlay}
                    onNavigateAway={onNavigateAway}
                  />
                );
              }
              if (key === 'schedule') {
                return (
                  <ScheduleTab
                    key={`${teamId}:${season}:${teamSportId}`}
                    teamId={teamId}
                    season={season}
                    sportId={teamSportId}
                    setSeason={setSeason}
                    view={scheduleView}
                    setView={setScheduleView}
                    selectedMonth={scheduleMonth}
                    setSelectedMonth={setScheduleMonth}
                    onNavigateAway={onNavigateAway}
                  />
                );
              }
              if (key === 'roster') {
                return (
                  <RosterTab
                    key={`${teamId}:${season}`}
                    teamId={teamId}
                    season={season}
                    selectedCountry={rosterCountry}
                    selectedCountryScroll={rosterCountryScroll}
                    onSelectedCountryChange={setRosterCountry}
                    onSelectedCountryScrollChange={setRosterCountryScroll}
                    onNavigateAway={onNavigateAway}
                  />
                );
              }
              if (key === 'depth') return <DepthChartTab key={`${teamId}:${season}`} teamId={teamId} season={season} onNavigateAway={onNavigateAway} />;
              if (key === 'splits') return <SplitsTab key={`${teamId}:${season}`} teamId={teamId} season={season} />;
              if (key === 'injuries') return <InjuriesTab key={`${teamId}:${season}`} teamId={teamId} season={season} onNavigateAway={onNavigateAway} />;
              if (key === 'transactions') return <TransactionsTab key={teamId} teamId={teamId} onNavigateAway={onNavigateAway} />;
              return null;
            }}
          </TabBar>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { teamId } = useParams();

  return <TeamPageContent key={teamId} teamId={teamId} />;
}
