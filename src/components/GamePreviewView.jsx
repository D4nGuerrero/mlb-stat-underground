import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { THEME_COLOR } from '../theme/theme.js';
import { BaseballSpinner } from './ui';
import {
  playerHeadshotUrl,
  pitcherActionShotUrl,
  FALLBACK_HEADSHOT,
} from '../utils/mlbHelpers';
import {
  loadGamePreviewData,
  formatPitcherHand,
  formatPitcherSeasonLine,
  formatMatchupStat,
} from '../utils/gamePreview';

const MATCHUP_COLS = [
  ['HR', 'hr'],
  ['RBI', 'rbi'],
  ['AB', 'ab'],
  ['AVG', 'avg'],
  ['OPS', 'ops'],
];

function PreviewSectionHeading({ children }) {
  return (
    <h2 className="text-sm font-semibold text-slate-100 mt-4 mb-2">
      {children}
    </h2>
  );
}

function PreviewCard({ children, className = '' }) {
  return (
    <div
      className={`bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function BroadcastColumn({ label, items }) {
  return (
    <div className="flex-1 min-w-0 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.map((name) => (
            <li key={name} className="text-xs text-slate-200 leading-snug">
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Not available</p>
      )}
    </div>
  );
}

function PitcherAvatar({ pitcher }) {
  const src = pitcher?.id && !pitcher.tbd
    ? pitcherActionShotUrl(pitcher.id) || playerHeadshotUrl(pitcher.id)
    : FALLBACK_HEADSHOT;

  return (
    <img
      src={src}
      alt={pitcher?.lastName ?? 'TBD'}
      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover bg-slate-800 border border-slate-700/60 flex-shrink-0"
      onError={(e) => {
        e.target.src = FALLBACK_HEADSHOT;
      }}
    />
  );
}

function ProbablePitcherCard({ pitcher, align = 'left', onPlayerClick }) {
  const isTbd = pitcher?.tbd;
  const seasonLine = formatPitcherSeasonLine(pitcher?.seasonStat);

  return (
    <div
      className={`flex items-center gap-2 flex-1 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <PitcherAvatar pitcher={pitcher} />
      <div className={`min-w-0 ${align === 'right' ? 'items-end' : ''}`}>
        {isTbd ? (
          <>
            <div className="font-semibold text-slate-300 text-sm">TBD</div>
            <div className="text-[10px] text-slate-500">Probable pitcher not announced</div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => pitcher?.id && onPlayerClick(pitcher.id)}
              className={`font-semibold text-slate-100 hover:text-${THEME_COLOR}-400 transition-colors text-sm leading-tight`}
            >
              {pitcher.lastName}
            </button>
            <div className="text-[10px] text-slate-400 font-mono leading-tight mt-0.5">
              {formatPitcherHand(pitcher.pitchHand)}
              {pitcher.number != null && pitcher.number !== '' ? ` | #${pitcher.number}` : ''}
              {seasonLine ? ` · ${seasonLine}` : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MatchupTable({ rows, onPlayerClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800/80">
            <th className="text-left font-semibold py-1.5 pr-2 pl-0">Batter</th>
            {MATCHUP_COLS.map(([label]) => (
              <th key={label} className="text-center font-semibold py-1.5 px-1 w-10">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const stats = formatMatchupStat(row.stat);
            return (
              <tr key={row.key} className="border-b border-slate-800/50 last:border-b-0">
                <td className="py-1.5 pr-2 text-slate-200 max-w-[9rem] truncate">
                  {row.isTeam ? (
                    <span className="font-semibold text-slate-400">{row.label}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPlayerClick(row.batterId)}
                      className={`font-medium hover:text-${THEME_COLOR}-400 transition-colors truncate block max-w-full text-left`}
                    >
                      {row.label}
                    </button>
                  )}
                </td>
                {stats ? (
                  MATCHUP_COLS.map(([label, key]) => (
                    <td key={label} className="text-center py-1.5 px-1 font-mono tabular-nums text-slate-100">
                      {stats[key]}
                    </td>
                  ))
                ) : (
                  <td colSpan={5} className="text-center py-1.5 text-slate-500">—</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PitcherMatchupSection({ teamAbbr, pitcher, onPlayerClick }) {
  if (!pitcher?.id || pitcher.tbd) {
    return (
      <div className="px-3 py-2.5 border-b border-slate-800/60 last:border-b-0">
        <p className="text-xs text-slate-500 italic">Pending opposing pitcher information</p>
      </div>
    );
  }

  const teamStats = formatMatchupStat(pitcher.vsTeamStat);
  const batters = pitcher.batterMatchups ?? [];
  const rows = [];

  if (teamStats) {
    rows.push({ key: 'team', label: 'Team', isTeam: true, stat: pitcher.vsTeamStat });
  }
  for (const batter of batters) {
    rows.push({
      key: batter.batterId,
      batterId: batter.batterId,
      label: batter.fullName ?? batter.lastName,
      stat: batter.stat,
    });
  }

  if (!rows.length) {
    return (
      <div className="px-3 py-2.5 border-b border-slate-800/60 last:border-b-0">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          {teamAbbr} vs. {pitcher.lastName}
        </div>
        <p className="text-xs text-slate-500">No previous matchup data</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-slate-800/60 last:border-b-0">
      <div className="text-xs font-semibold text-slate-200 mb-1.5">
        {teamAbbr} vs. {pitcher.lastName}
      </div>
      <MatchupTable rows={rows} onPlayerClick={onPlayerClick} />
    </div>
  );
}

export default function GamePreviewView({
  gamePk,
  probablePitchers,
  away,
  home,
  season,
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadGamePreviewData({
      gamePk,
      probablePitchers,
      awayTeamId: away?.id,
      homeTeamId: home?.id,
      season,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            broadcasts: { watch: [], listen: [] },
            awayPitcher: { tbd: true },
            homePitcher: { tbd: true },
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gamePk, probablePitchers?.away?.id, probablePitchers?.home?.id, away?.id, home?.id, season]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <BaseballSpinner size="lg" />
      </div>
    );
  }

  const { broadcasts, awayPitcher, homePitcher } = data ?? {};

  return (
    <div className="pb-4">
      <PreviewSectionHeading>Follow the Game</PreviewSectionHeading>
      <PreviewCard>
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60">
          <BroadcastColumn label="Watch" items={broadcasts?.watch ?? []} />
          <BroadcastColumn label="Listen" items={broadcasts?.listen ?? []} />
        </div>
      </PreviewCard>

      <PreviewSectionHeading>Probable Pitchers</PreviewSectionHeading>
      <PreviewCard className="px-3 py-3">
        <div className="flex items-center gap-2">
          <ProbablePitcherCard
            pitcher={awayPitcher}
            onPlayerClick={(id) => navigate(`/player/${id}`)}
          />
          <div className="text-slate-500 font-semibold text-xs flex-shrink-0 px-0.5">vs</div>
          <ProbablePitcherCard
            pitcher={homePitcher}
            align="right"
            onPlayerClick={(id) => navigate(`/player/${id}`)}
          />
        </div>
      </PreviewCard>

      <PreviewSectionHeading>Matchups</PreviewSectionHeading>
      <PreviewCard>
        <PitcherMatchupSection
          teamAbbr={home.abbreviation}
          pitcher={awayPitcher}
          onPlayerClick={(id) => navigate(`/player/${id}`)}
        />
        <PitcherMatchupSection
          teamAbbr={away.abbreviation}
          pitcher={homePitcher}
          onPlayerClick={(id) => navigate(`/player/${id}`)}
        />
      </PreviewCard>
    </div>
  );
}