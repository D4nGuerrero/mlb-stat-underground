import { Link } from 'react-router-dom';
import {
  Camera,
  Cpu,
  ExternalLink,
  Flame,
  Gamepad2,
  Grid3x3,
  Link2,
  Search,
  Sparkles,
  UserRoundSearch,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { BASEBALL_GAMES } from '../config/baseballGames.js';

const ICONS = {
  cpu: Cpu,
  search: Search,
  grid: Grid3x3,
  user: UserRoundSearch,
  flame: Flame,
  camera: Camera,
  link: Link2,
  sparkles: Sparkles,
};

function GameCard({ game, isDark }) {
  const Icon = ICONS[game.icon] ?? Gamepad2;
  const className = [
    'group flex h-full flex-col rounded-2xl border p-4 transition-all',
    isDark
      ? 'border-slate-800 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900'
      : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md',
  ].join(' ');

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1 text-accent-300',
            isDark ? 'bg-slate-950 ring-slate-700' : 'bg-slate-50 ring-slate-200',
          ].join(' ')}
        >
          <Icon size={18} />
        </span>
        {game.href && (
          <ExternalLink
            size={14}
            className="mt-0.5 text-slate-500 opacity-70 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        )}
      </div>
      <div className="mt-3 min-w-0">
        <div className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {game.label}
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-500">{game.description}</p>
      </div>
    </>
  );

  if (game.href) {
    return (
      <a
        href={game.href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link to={game.to} className={className}>
      {body}
    </Link>
  );
}

export default function Games() {
  const { isDark } = useTheme();

  return (
    <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 sm:mb-8">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-accent-300 ring-1 ring-accent-500/25">
          <Gamepad2 size={12} aria-hidden />
          Games
        </div>
        <h1 className={`font-display text-2xl font-black tracking-tight sm:text-3xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Play baseball
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          Daily puzzles and the in-app simulator. External games open in a new tab.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BASEBALL_GAMES.map((game) => (
          <GameCard key={game.id} game={game} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}
