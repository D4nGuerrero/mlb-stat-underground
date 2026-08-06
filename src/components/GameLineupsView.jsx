import { useNavigate } from 'react-router-dom';
import { teamLogoUrl, playerHeadshotUrl, FALLBACK_HEADSHOT } from '../utils/mlbHelpers';

function TeamLineupTable({ team, players, onPlayerClick }) {
  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60">
        <img
          src={teamLogoUrl(team.id)}
          className="w-6 h-6 object-contain"
          alt={team.abbreviation}
        />
        <span className="font-bold text-sm text-slate-100">{team.abbreviation}</span>
        <span className="text-[10px] text-slate-500 ml-auto uppercase tracking-wider">
          Starting lineup
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800/80">
              <th className="text-center font-semibold py-2 px-2 w-8">#</th>
              <th className="text-left font-semibold py-2 px-2">Player</th>
              <th className="text-center font-semibold py-2 px-2 w-10">Pos</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-b border-slate-800/50 last:border-b-0">
                <td className="text-center py-2 px-2 font-mono text-slate-500 tabular-nums">
                  {player.battingOrder}
                </td>
                <td className="py-2 px-2">
                  <button
                    type="button"
                    onClick={() => onPlayerClick(player.id)}
                    className={`flex items-center gap-2 min-w-0 text-left hover:text-accent-400 transition-colors`}
                  >
                    <img
                      src={playerHeadshotUrl(player.id)}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover bg-slate-800 border border-slate-700/60 flex-shrink-0"
                      onError={(e) => { e.target.src = FALLBACK_HEADSHOT; }}
                    />
                    <span className="font-medium text-slate-200 truncate">
                      {player.useName || player.lastName}
                    </span>
                  </button>
                </td>
                <td className="text-center py-2 px-2 font-mono text-slate-400">
                  {player.position}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GameLineupsView({ lineups, away, home }) {
  const navigate = useNavigate();
  const onPlayerClick = (id) => {
    if (id) navigate(`/player/${id}`);
  };

  return (
    <div className="pb-4 space-y-4">
      <TeamLineupTable
        team={away}
        players={lineups.away}
        onPlayerClick={onPlayerClick}
      />
      <TeamLineupTable
        team={home}
        players={lineups.home}
        onPlayerClick={onPlayerClick}
      />
    </div>
  );
}