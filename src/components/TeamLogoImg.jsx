import { useTheme } from '../context/ThemeContext';
import { teamLogoUrl } from '../utils/mlbHelpers';

/**
 * Theme-aware team logo image with smart exceptions.
 * 
 * Dark mode  → cap-on-dark (default for most teams)
 * Light mode → cap-on-light
 * Some teams use regular logo because it looks better.
 */
export default function TeamLogoImg({ 
  teamId, 
  className, 
  alt, 
  onError,
  style,
  forceRegular = false   // optional override
}) {
  const { isDark } = useTheme();

  if (!teamId) return null;

  const src = teamLogoUrl(teamId, { 
    preferDark: isDark,
    forceRegular 
  });

  return (
    <img
      src={src}
      className={className}
      alt={alt ?? ''}
      style={style}
      onError={onError ?? ((e) => (e.target.style.display = 'none'))}
    />
  );
}