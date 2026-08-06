import BroadcastLogoImg from './BroadcastLogoImg';
import { getNationalTvBroadcasts, formatNationalBroadcastLine } from '../utils/broadcasts';

/**
 * Renders national TV network logo icons for a schedule game (no "Watch:" text).
 */
export default function NationalBroadcastIcons({
  game,
  compact = false,
  ultraCompact = false,
  className = '',
}) {
  if (ultraCompact) return null;

  const networks = getNationalTvBroadcasts(game).filter((n) => n.id != null);
  if (!networks.length) return null;

  const title = formatNationalBroadcastLine(game) || networks.map((n) => n.label).join(', ');
  const imgClass = compact
    ? 'h-6 w-auto max-w-[5.5rem] object-contain'
    : 'h-7 w-auto max-w-[6.5rem] object-contain';

  return (
    <span
      className={[
        'inline-flex items-center gap-1',
        className,
      ].filter(Boolean).join(' ')}
      title={title}
      aria-label={title}
    >
      {networks.map((network) => (
        <BroadcastLogoImg
          key={network.id}
          networkId={network.id}
          label={network.label}
          className={imgClass}
        />
      ))}
    </span>
  );
}
