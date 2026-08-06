import { useTheme } from '../context/ThemeContext';
import { broadcastLogoUrl, NATIONAL_BROADCAST_NETWORKS } from '../utils/broadcasts';

/**
 * Theme-aware national broadcaster logo from MLB static CDN.
 * Dark mode → broadcasters-on-dark; light mode → broadcasters-on-light.
 */
export default function BroadcastLogoImg({
  networkId,
  label,
  className = 'h-7 w-auto max-w-[6.5rem] object-contain',
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

  return (
    <img
      src={src}
      className={className}
      alt={alt ?? resolvedLabel}
      title={title ?? resolvedLabel}
      draggable={false}
      onError={onError ?? ((e) => { e.currentTarget.style.display = 'none'; })}
    />
  );
}
