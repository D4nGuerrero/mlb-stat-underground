import { THEME_COLOR } from '../../../theme/theme.js';
import { compactPlayerName, teamLogoUrl, sumInningsPitched } from '../../../utils/mlbHelpers';
import { stickyHead, stickyCell, statHead, statCell, TABLE_SCROLL, TABLE_BASE } from '../../../components/ui';
import { TABLE_TEXT_CLASS } from '../../../theme/tableTheme';

const BOX_SCORE_TABLE = `${TABLE_BASE} ${TABLE_TEXT_CLASS} table-fixed w-full`;
const BOX_SCORE_TABLE_COMPACT = `${TABLE_BASE} text-[10px] 2xl:text-[11px] table-fixed w-full`;
const BOX_SCORE_TABLE_FULLSCREEN = `${TABLE_BASE} table-fixed w-full text-[9px] 2xl:text-[10px] [&_th]:!px-0.5 [&_td]:!px-0.5 [&_th]:!py-0.5 [&_td]:!py-0.5 [&_th]:!text-[9px] [&_td]:!text-[9px] 2xl:[&_th]:!text-[10px] 2xl:[&_td]:!text-[10px]`;
const BOX_SCORE_LABEL_COL = 'w-[24%]';
const BOX_SCORE_STAT_COL = 'w-[9.5%]';

const boxScoreStatHead = (className = '') => (
  statHead(`${BOX_SCORE_STAT_COL} font-normal ${className}`, { align: 'text-center' })
);

const boxScoreStatCell = (className = '') => (
  statCell(`${BOX_SCORE_STAT_COL} ${className}`, { align: 'text-center' })
);

const getAllBatters = (teamBox) =>
  Object.values(teamBox?.players || {})
    .filter((p) => p.battingOrder)
    .sort((a, b) => parseInt(a.battingOrder, 10) - parseInt(b.battingOrder, 10));

const getSubLetter = (order) => {
  const suffix = parseInt(order, 10) % 100;
  return suffix === 0 ? null : String.fromCharCode(96 + suffix);
};

const formatBoxRate = (value) => {
  if (value == null || value === '' || value === '-') return '-';
  return String(value).replace(/^0(?=\.)/, '');
};

export default function TeamBoxSection({
  team,
  teamBox,
  decisions,
  hideHeader = false,
  compact = false,
  fullscreenFit = false,
  onPlayerSelect,
}) {
  if (!teamBox) return null;

  const batters = getAllBatters(teamBox);
  const pitcherIds = teamBox.pitchers || [];
  const pitchers = pitcherIds
    .map((id) => teamBox.players?.[`ID${id}`])
    .filter(Boolean);

  const subNotes = batters
    .filter((player) => player.note)
    .map((player) => {
      const letter = getSubLetter(player.battingOrder);
      return letter ? `${letter}-${player.note}` : player.note;
    });

  const battingTotals = batters.reduce(
    (acc, player) => {
      const batting = player.stats?.batting || {};
      return {
        ab: acc.ab + (batting.atBats || 0),
        r: acc.r + (batting.runs || 0),
        h: acc.h + (batting.hits || 0),
        rbi: acc.rbi + (batting.rbi || 0),
        bb: acc.bb + (batting.baseOnBalls || 0),
        so: acc.so + (batting.strikeOuts || 0),
      };
    },
    { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
  );

  const pitchingTotals = pitchers.reduce(
    (acc, player) => {
      const pitching = player.stats?.pitching || {};
      return {
        h: acc.h + (pitching.hits || 0),
        r: acc.r + (pitching.runs || 0),
        er: acc.er + (pitching.earnedRuns || 0),
        bb: acc.bb + (pitching.baseOnBalls || 0),
        k: acc.k + (pitching.strikeOuts || 0),
        hr: acc.hr + (pitching.homeRuns || 0),
      };
    },
    { h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 },
  );

  const pitchingTotalsIp =
    teamBox.teamStats?.pitching?.inningsPitched ??
    sumInningsPitched(pitchers.map((player) => player.stats?.pitching?.inningsPitched));
  const tableClassName = fullscreenFit
    ? BOX_SCORE_TABLE_FULLSCREEN
    : compact
      ? BOX_SCORE_TABLE_COMPACT
      : BOX_SCORE_TABLE;

  return (
    <div
      className={
        fullscreenFit
          ? 'h-full min-h-0 overflow-hidden text-[9px] 2xl:text-[10px] flex flex-col'
          : compact
            ? 'mb-4 text-[10px] 2xl:text-[11px]'
            : 'mb-8'
      }
    >
      {!hideHeader && (
        <div className={`flex items-center gap-2 shrink-0 ${fullscreenFit ? 'mb-1' : 'mb-3'}`}>
          <img
            src={teamLogoUrl(team.id)}
            className={`${fullscreenFit ? 'w-4 h-4' : 'w-5 h-5'} object-contain`}
            alt={team.abbreviation}
          />
          <span className={`${fullscreenFit ? 'text-[10px]' : 'text-sm'} font-bold text-slate-100 truncate`}>
            {team.teamName || team.abbreviation}
          </span>
        </div>
      )}

      <div className={`${TABLE_SCROLL} ${fullscreenFit ? 'mb-1 shrink-0' : 'mb-2'}`}>
        <table className={tableClassName}>
          <colgroup>
            <col className={BOX_SCORE_LABEL_COL} />
            {Array.from({ length: 8 }, (_, i) => (
              <col key={i} className={BOX_SCORE_STAT_COL} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/60">
              <th className={`${stickyHead('bg-slate-900')} ${BOX_SCORE_LABEL_COL} font-normal`}>BATTING</th>
              {['AB', 'R', 'H', 'RBI', 'BB', 'SO', 'AVG', 'OPS'].map((header) => (
                <th key={header} className={boxScoreStatHead()}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batters.map((player) => {
              const batting = player.stats?.batting || {};
              const seasonBatting = player.seasonStats?.batting || {};
              const subLetter = getSubLetter(player.battingOrder);
              const lastName = compactPlayerName(player.person, '');
              const pos = player.position?.abbreviation || '';

              return (
                <tr
                  key={player.person?.id}
                  className="group border-b border-slate-800/40 hover:bg-slate-800/20"
                >
                  <td className={`${stickyCell('bg-slate-900')} ${BOX_SCORE_LABEL_COL}`}>
                    <button
                      onClick={() => onPlayerSelect(player.person?.id)}
                      className={`text-left hover:text-${THEME_COLOR}-400 transition-colors whitespace-nowrap`}
                    >
                      {subLetter && <span className="text-slate-500 mr-0.5">{subLetter}-</span>}
                      <span className={subLetter ? 'text-slate-400' : 'text-slate-200'}>
                        <span className={compact ? '' : 'sm:hidden'}>{lastName}</span>
                        {!compact && (
                          <span className="hidden sm:inline">{player.person?.fullName}</span>
                        )}
                      </span>
                    </button>
                    <span className="text-slate-600 ml-1 text-[10px]">{pos}</span>
                  </td>
                  <td className={boxScoreStatCell('text-slate-400')}>{batting.atBats ?? '-'}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{batting.runs ?? '-'}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{batting.hits ?? '-'}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{batting.rbi ?? '-'}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{batting.baseOnBalls ?? '-'}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{batting.strikeOuts ?? '-'}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{formatBoxRate(seasonBatting.avg)}</td>
                  <td className={boxScoreStatCell('text-slate-400')}>{formatBoxRate(seasonBatting.ops)}</td>
                </tr>
              );
            })}
            <tr className="group border-t border-slate-700 font-bold text-slate-300">
              <td className={`${stickyCell('bg-slate-900', { footer: true })} ${BOX_SCORE_LABEL_COL}`}>Totals</td>
              {[
                battingTotals.ab,
                battingTotals.r,
                battingTotals.h,
                battingTotals.rbi,
                battingTotals.bb,
                battingTotals.so,
              ].map((value, i) => (
                <td key={i} className={boxScoreStatCell()}>
                  {value}
                </td>
              ))}
              <td className={boxScoreStatCell()} />
              <td className={boxScoreStatCell()} />
            </tr>
          </tbody>
        </table>
      </div>

      {!fullscreenFit && subNotes.length > 0 && (
        <div className="mb-3 text-[11px] text-slate-500 space-y-0.5 italic">
          {subNotes.map((note, i) => (
            <div key={i}>{note}</div>
          ))}
        </div>
      )}

      {!fullscreenFit && (teamBox.info || []).map((section) => (
        <div key={section.title} className="mb-2">
          <div className="text-[11px] font-bold text-slate-400 mb-0.5">
            {section.title}
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            {(section.fieldList || []).map((field, i) => (
              <div key={i}>
                <span className="font-semibold text-slate-400">{field.label} </span>
                {field.value}
              </div>
            ))}
          </div>
        </div>
      ))}

      {pitchers.length > 0 && (
        <div className={`${TABLE_SCROLL} ${fullscreenFit ? 'mt-1 shrink-0' : 'mt-4'}`}>
          <table className={tableClassName}>
            <colgroup>
              <col className={BOX_SCORE_LABEL_COL} />
              {Array.from({ length: 8 }, (_, i) => (
                <col key={i} className={BOX_SCORE_STAT_COL} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/60">
                <th className={`${stickyHead('bg-slate-900')} ${BOX_SCORE_LABEL_COL} font-normal`}>PITCHING</th>
                {['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'ERA'].map((header) => (
                  <th key={header} className={boxScoreStatHead()}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitchers.map((player) => {
                const pitching = player.stats?.pitching || {};
                const seasonEra = player.seasonStats?.pitching?.era;
                const lastName = compactPlayerName(player.person, '');
                const decMark =
                  decisions?.winner?.id === player.person?.id
                    ? 'W'
                    : decisions?.loser?.id === player.person?.id
                      ? 'L'
                      : decisions?.save?.id === player.person?.id
                        ? 'SV'
                        : null;

                return (
                  <tr
                    key={player.person?.id}
                    className="group border-b border-slate-800/40 hover:bg-slate-800/20"
                  >
                    <td className={`${stickyCell('bg-slate-900')} ${BOX_SCORE_LABEL_COL}`}>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onPlayerSelect(player.person?.id)}
                          className={`hover:text-${THEME_COLOR}-400 transition-colors text-slate-200`}
                        >
                          <span className={compact ? '' : 'sm:hidden'}>{lastName}</span>
                          {!compact && (
                            <span className="hidden sm:inline">{player.person?.fullName}</span>
                          )}
                        </button>
                        {decMark && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                            {decMark}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.inningsPitched ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.hits ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.runs ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.earnedRuns ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.baseOnBalls ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.strikeOuts ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>{pitching.homeRuns ?? '-'}</td>
                    <td className={boxScoreStatCell('text-slate-400')}>
                      {seasonEra != null ? parseFloat(seasonEra).toFixed(2) : '-'}
                    </td>
                  </tr>
                );
              })}
              <tr className="group border-t border-slate-700 font-bold text-slate-300">
                <td className={`${stickyCell('bg-slate-900', { footer: true })} ${BOX_SCORE_LABEL_COL}`}>Totals</td>
                <td className={boxScoreStatCell()}>{pitchingTotalsIp}</td>
                {[
                  pitchingTotals.h,
                  pitchingTotals.r,
                  pitchingTotals.er,
                  pitchingTotals.bb,
                  pitchingTotals.k,
                  pitchingTotals.hr,
                ].map((value, i) => (
                  <td key={i} className={boxScoreStatCell()}>{value}</td>
                ))}
                <td className={boxScoreStatCell()} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
