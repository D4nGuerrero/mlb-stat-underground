import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { THEME_COLOR } from '../../theme/theme.js';
import { SegmentedControl, stickyHead, stickyCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE, TABLE_LAYOUT } from '../../components/ui';
import { TABLE_TEXT_CLASS } from '../../theme/tableTheme';
import TeamAbbrCell from '../../components/TeamAbbrCell';
import { DEFAULT_PARK, PARK_FACTORS, PITCH_DEFS, PITCH_RESULT_BG, PITCH_RESULT_LABELS } from '../constants';

export const teamLogoUrl = (id) => `https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg`;

export function LineupBuilder({
  lineup, onMove, starters, selectedStarterId, onPickStarter, title, loading, mode, onModeChange,
}) {
  const ordSuffix = (n) => ['st', 'nd', 'rd'][n - 1] || 'th';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-300">{title} Lineup</span>
        <div className="flex items-center gap-2">
          {loading && <span className={`text-[10px] text-${THEME_COLOR}-400 font-mono animate-pulse`}>Loading…</span>}
          {onModeChange && (
            <SegmentedControl
              value={mode}
              onChange={onModeChange}
              variant="speed"
              size="xs"
              rounded="lg"
              options={[
                { value: 'realistic', label: 'Realistic' },
                { value: 'optimized', label: 'Optimized' },
              ]}
            />
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-800/50">
        {lineup.map((player, idx) => (
          <div key={player.id} className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-slate-600 font-mono text-xs w-4 shrink-0">{idx + 1}</span>
            <span className="text-[10px] text-slate-500 w-7 shrink-0 font-mono">{player.gamePos || player.pos}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-200 truncate block">{player.name}</span>
              {player.slotABs >= 5 ? (
                <span className={`text-[10px] text-${THEME_COLOR}-500/80 font-mono`}>
                  {player.slotABs} ABs batting {idx + 1}{ordSuffix(idx + 1)}
                </span>
              ) : player.selectionReason ? (
                <span className="text-[10px] text-slate-600 font-mono">{player.selectionReason}</span>
              ) : null}
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => onMove(idx, -1)} disabled={idx === 0}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-white disabled:opacity-20 text-xs">▲</button>
              <button type="button" onClick={() => onMove(idx, 1)} disabled={idx === lineup.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-white disabled:opacity-20 text-xs">▼</button>
            </div>
          </div>
        ))}
      </div>
      {starters?.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Starting Pitcher</div>
          <div className="flex gap-2 flex-wrap">
            {starters.slice(0, 5).map((pitcher) => (
              <button
                key={pitcher.id}
                type="button"
                onClick={() => onPickStarter(pitcher)}
                className={[
                  'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                  selectedStarterId === pitcher.id
                    ? `bg-${THEME_COLOR}-600 border-${THEME_COLOR}-500 text-white`
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500',
                ].join(' ')}
              >
                {pitcher.name.split(' ').pop()}
                {pitcher.pitchingStats && (
                  <span className="ml-1 text-slate-500 font-mono">{pitcher.pitchingStats.era}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function InningBox({ innings, awayTeam, homeTeam, lineHits, lineErrors }) {
  const statCols = ['R', 'H', 'E'];
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table
        className="w-full text-xs font-mono text-center"
        style={{ minWidth: Math.max(320, innings.length * 28 + 140) }}
      >
        <thead>
          <tr className="text-slate-600">
            <th className="px-2 py-1 text-left w-12 sticky left-0 bg-slate-900 z-10">Team</th>
            {innings.map((_, index) => <th key={index} className="px-1 py-1 w-7">{index + 1}</th>)}
            {statCols.map((col) => (
              <th key={col} className="px-2 py-1 text-slate-400 font-bold w-8">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[{ team: awayTeam, key: 'away' }, { team: homeTeam, key: 'home' }].map(({ team, key }) => {
            const runs = innings.reduce((sum, inning) => sum + (inning[key] ?? 0), 0);
            const hits = lineHits?.[key] ?? 0;
            const errors = lineErrors?.[key] ?? 0;
            return (
              <tr key={key} className="border-t border-slate-800">
                <td className="px-2 py-2 text-left sticky left-0 bg-slate-900 z-10">
                  <TeamAbbrCell team={team} abbrOnly size="sm" abbrClassName="text-xs font-semibold text-slate-300" />
                </td>
                {innings.map((inning, index) => {
                  const val = inning[key];
                  const skipped = key === 'home' && inning.homeSkipped;
                  return (
                    <td
                      key={index}
                      className={`px-1 py-2 ${val > 0 ? 'text-white font-semibold' : 'text-slate-700'}`}
                    >
                      {skipped ? 'X' : (val ?? 0)}
                    </td>
                  );
                })}
                <td className="px-2 py-2 font-bold text-white text-sm">{runs}</td>
                <td className="px-2 py-2 font-semibold text-slate-300">{hits}</td>
                <td className="px-2 py-2 text-slate-500">{errors}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AtBatCard({ play, index }) {
  const outcomeColor = {
    HR: 'text-yellow-400', '3B': 'text-orange-400', '2B': 'text-blue-400',
    '1B': 'text-green-400', BB: 'text-cyan-400', IBB: 'text-cyan-300', HBP: 'text-purple-400',
    K: 'text-red-400', OUT: 'text-slate-500', DP: 'text-orange-300', E: 'text-amber-400',
    SAC: 'text-slate-400', SF: 'text-slate-400', SB: `text-${THEME_COLOR}-400`, CS: 'text-red-300', WP: 'text-slate-500',
  }[play.outcome] || 'text-slate-400';
  const hasPitches = play.pitches?.length > 0;

  const header = (open = false) => (
    <>
      <span className="text-slate-600 font-mono text-[10px] w-4 mt-0.5 shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-xs ${outcomeColor}`}>{play.outcome}</span>
          <span className="text-slate-300 text-xs truncate">{play.batter}</span>
          {play.runs > 0 && <span className="text-green-400 font-bold text-[10px] bg-green-400/10 px-1 rounded">+{play.runs}R</span>}
          {play.walkOff && <span className="text-yellow-400 text-[10px] font-bold bg-yellow-400/10 px-1 rounded">WALK-OFF</span>}
          {play.isDoublePlay && <span className="text-orange-300 text-[10px] font-bold bg-orange-400/10 px-1 rounded">DP</span>}
          {play.isError && <span className="text-amber-400 text-[10px] font-bold bg-amber-400/10 px-1 rounded">E</span>}
          {play.barrel && <span className="text-orange-400 text-[10px] bg-orange-400/10 px-1 rounded">BARREL</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-slate-600 text-[10px]">vs {play.pitcher}</span>
          {hasPitches && <span className="text-slate-600 text-[10px]">{play.pitches.length}p</span>}
          {play.exitVelocity != null && <span className="text-slate-500 text-[10px] font-mono">{play.exitVelocity} mph EV</span>}
          {play.launchAngle != null && <span className="text-slate-500 text-[10px] font-mono">{play.launchAngle}° LA</span>}
          {play.hitDistance != null && <span className="text-slate-500 text-[10px] font-mono">{play.hitDistance} ft</span>}
          {play.battedBallType && (
            <span className="text-slate-500 text-[10px] font-mono bg-slate-800/60 px-1 rounded">{play.battedBallType}</span>
          )}
          {play.hitField && (
            <span className="text-slate-600 text-[10px] font-mono">{play.hitField}</span>
          )}
        </div>
        <p className="text-slate-500 text-[11px] mt-0.5 leading-tight">{play.desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-slate-600 font-mono text-[10px]">{play.inning}</span>
        {hasPitches && <span className={`text-slate-600 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>}
      </div>
    </>
  );

  if (!hasPitches) {
    return <div className="border-b border-slate-800/50 px-3 py-2.5 flex items-start gap-2">{header()}</div>;
  }

  return (
    <Disclosure as="div" className="border-b border-slate-800/50">
      <DisclosureButton className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-slate-800/30 transition-colors focus:outline-none">
        {({ open }) => header(open)}
      </DisclosureButton>
      <DisclosurePanel className="bg-slate-950/60 px-3 pb-3 focus:outline-none">
        <div className="flex flex-col gap-1">
          {play.pitches.map((pitch, pitchIndex) => {
            const def = PITCH_DEFS[pitch.type] || PITCH_DEFS.FF;
            const resultBg = PITCH_RESULT_BG[pitch.result] || 'bg-slate-800/40 border-slate-700/40';
            return (
              <div key={pitchIndex} className={`flex items-center gap-2 py-1 px-2 rounded text-[11px] border flex-wrap ${resultBg}`}>
                <span className="text-slate-600 font-mono w-4 shrink-0">{pitch.num}</span>
                <span className={`${def.color} font-bold w-6 shrink-0`}>{pitch.type}</span>
                <span className="text-slate-300 font-mono w-12 shrink-0">{pitch.velocity} mph</span>
                <span className="text-slate-400 font-mono shrink-0">{PITCH_RESULT_LABELS[pitch.result] || pitch.result}</span>
                {pitch.result === 'X' && pitch.la != null && (
                  <span className="text-blue-300/90 font-mono shrink-0">{pitch.la}° · {pitch.dist} ft</span>
                )}
                <span className="text-slate-600 text-[10px] font-mono shrink-0 ml-auto">{pitch.count}</span>
              </div>
            );
          })}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

function PitcherBox({ lines, title }) {
  if (!lines?.length) return null;
  return (
    <div className={`${TABLE_SCROLL} mt-4`}>
      <div className="text-slate-500 text-[10px] font-mono uppercase tracking-wider px-2 pb-1">{title} Pitching</div>
      <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
        <thead>
          <tr className="text-slate-600 border-b border-slate-800">
            {['Pitcher', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC'].map((label, i) => (
              <th key={label} className={i === 0 ? `${stickyHead('bg-slate-900')} font-mono` : statHead('text-center font-mono')}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="group border-t border-slate-800/50 hover:bg-slate-800/20">
              <td className={`${stickyCell('bg-slate-900')} text-slate-300 font-medium`}>
                <span className="sm:hidden">{line.name?.split(' ').pop() || '—'}</span>
                <span className="hidden sm:inline whitespace-nowrap">{line.name || '—'}</span>
              </td>
              <td className={statCell('text-slate-300 font-semibold')}>{line.ip}</td>
              <td className={statCell('text-slate-400')}>{line.h}</td>
              <td className={statCell('text-slate-400')}>{line.r}</td>
              <td className={statCell('text-slate-400')}>{line.er}</td>
              <td className={statCell('text-slate-400')}>{line.bb}</td>
              <td className={statCell('text-green-400 font-semibold')}>{line.k}</td>
              <td className={statCell('text-slate-400')}>{line.hr || '—'}</td>
              <td className={statCell('text-slate-400')}>{line.pc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoxScore({ players, teamName, pitcherLines }) {
  const totals = players.reduce((acc, player) => ({
    ab: acc.ab + player.ab,
    h: acc.h + player.h,
    d: acc.d + (player.d || 0),
    t: acc.t + (player.t || 0),
    hr: acc.hr + player.hr,
    bb: acc.bb + player.bb,
    k: acc.k + player.k,
    rbi: acc.rbi + player.rbi,
  }), { ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0, rbi: 0 });

  return (
    <div>
      <div className={TABLE_SCROLL}>
        <table className={`${TABLE_BASE} ${TABLE_TEXT_CLASS} ${TABLE_LAYOUT}`}>
          <thead>
            <tr className="text-slate-600 border-b border-slate-800">
              <th className={`${stickyHead('bg-slate-900')} font-mono`}>{teamName}</th>
              {['AB', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'K', 'AVG', 'OBP', 'SLG', 'EV'].map((label) => (
                <th key={label} className={statHead('text-center font-mono')}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="group border-t border-slate-800/50 hover:bg-slate-800/20">
                <td className={stickyCell('bg-slate-900')}>
                  <span className="text-slate-500 font-mono text-[10px] w-4 inline-block text-center mr-1">{player.lineupSlot || ''}</span>
                  <span className="text-slate-300 font-medium whitespace-nowrap">
                    <span className="sm:hidden">{player.name.split(' ').pop()}</span>
                    <span className="hidden sm:inline">{player.name}</span>
                  </span>
                  <span className={`text-${THEME_COLOR}-600/80 text-[10px] ml-1 font-mono`}>{player.gamePos || player.pos}</span>
                </td>
                <td className={statCell('text-slate-400')}>{player.ab}</td>
                <td className={statCell('text-slate-300 font-semibold')}>{player.h}</td>
                <td className={statCell('text-slate-400')}>{player.d || '—'}</td>
                <td className={statCell('text-slate-400')}>{player.t || '—'}</td>
                <td className={statCell(`font-semibold ${player.hr > 0 ? 'text-yellow-400' : 'text-slate-600'}`)}>{player.hr || '—'}</td>
                <td className={statCell('text-slate-400')}>{player.rbi}</td>
                <td className={statCell('text-slate-400')}>{player.bb || '—'}</td>
                <td className={statCell('text-slate-400')}>{player.k || '—'}</td>
                <td className={statCell('text-slate-400')}>{player.avg || '.000'}</td>
                <td className={statCell('text-slate-400')}>{player.obp || '.000'}</td>
                <td className={statCell('text-slate-400')}>{player.slg || '.000'}</td>
                <td className={statCell('text-slate-500')}>{player.avgEV ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PitcherBox lines={pitcherLines} title={teamName} />
    </div>
  );
}

export function ParkInfo({ homeTeam }) {
  if (!homeTeam) return null;
  const park = PARK_FACTORS[homeTeam.id] || DEFAULT_PARK;
  return (
    <div className="text-center mb-3">
      <span className="text-[10px] text-slate-600 font-mono">
        {park.name} · HR factor {park.hr.toFixed(2)}x
      </span>
    </div>
  );
}

export function ComingSoonPanel({ title, description }) {
  return (
    <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
      <div className="text-slate-400 font-semibold mb-2">{title}</div>
      <p className="text-sm text-slate-600 max-w-sm mx-auto px-4">{description}</p>
    </div>
  );
}