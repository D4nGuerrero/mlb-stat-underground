import { useTheme } from '../context/ThemeContext';
import {
  broadcastLogoUrl,
  broadcastLogoClassName,
  NATIONAL_BROADCAST_NETWORKS,
} from '../utils/broadcasts';

/**
 * Theme-aware national broadcaster logo from MLB static CDN.
 * Dark mode → broadcasters-on-dark; light mode → broadcasters-on-light.
 * Default sizing keeps wide logos compact; narrow marks (MLB Network) get more height.
 */
export default function BroadcastLogoImg({
  networkId,
  label,
  className,
  size = 'md',
  alt,
  title,
  onError,
}) {
  const { isDark } = useTheme();
  const id = Number(networkId);
  if (!Number.isFinite(id)) return null;

  const resolvedLabel =
    label
    || NATIONAL_BROADCAST_NETWORKS[id]?.label
    || `Network ${id}`;
  const src = broadcastLogoUrl(id, { preferDark: isDark });
  if (!src) return null;

  const resolvedClass =
    className
    || broadcastLogoClassName(id, { size });

  return (
    <img
      src={src}
      className={resolvedClass}
      alt={alt ?? resolvedLabel}
      title={title ?? resolvedLabel}
      draggable={false}
      onError={onError ?? ((e) => { e.currentTarget.style.display = 'none'; })}
    />
  );
}
