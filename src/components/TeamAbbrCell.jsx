import { Link } from 'react-router-dom';
import TeamLogoImg from './TeamLogoImg';
import { getTeamAbbr } from '../utils/mlbHelpers';

const SIZES = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-7 h-7',
};

/**
 * Team column cell: logo + abbr (mobile) / full name (desktop).
 */
export default function TeamAbbrCell({
  team,
  teamId,
  teamName,
  link = false,
  className = '',
  size = 'md',
  abbrClassName = 'text-sm font-medium',
  nameClassName = 'text-sm font-medium',
}) {
  const id = teamId ?? team?.id;
  const abbr = getTeamAbbr(team ?? id);
  const name = teamName ?? team?.name ?? team?.teamName ?? abbr;

  if (!id && abbr === '—') {
    return <span className="text-slate-500">—</span>;
  }

  const inner = (
    <span className={`inline-flex items-center gap-1 sm:gap-1.5 min-w-0 ${className}`}>
      <TeamLogoImg teamId={id} className={`${SIZES[size] ?? SIZES.md} object-contain flex-shrink-0`} alt={abbr} />
      <span className={`${abbrClassName} sm:hidden leading-none`}>{abbr}</span>
      <span className={`hidden sm:inline whitespace-nowrap leading-tight ${nameClassName}`}>{name}</span>
    </span>
  );

  if (link && id) {
    return (
      <Link to={`/team/${id}`} className="inline-flex hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }

  return inner;
}