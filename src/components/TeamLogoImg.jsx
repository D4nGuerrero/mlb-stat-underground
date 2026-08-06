import { useTheme } from '../context/ThemeContext.jsx';
import { teamLogoUrl } from '../utils/mlbHelpers';

/**
 * Theme-aware team logo.
 * Dark → cap-on-dark; Light → cap-on-light; MiLB / exceptions → full color.
 */
export default function TeamLogoImg({
  teamId,
  className,
  alt,
  onError,
  style,
  forceRegular = false,
}) {
  const { isDark } = useTheme();

  if (!teamId) return null;

  const src = teamLogoUrl(teamId, {
    preferDark: isDark,
    forceRegular,
  });

  return (
    <img
      key={`${teamId}-${isDark ? 'dark' : 'light'}-${forceRegular ? 'reg' : 'cap'}`}
      src={src}
      className={className}
      alt={alt ?? ''}
      style={style}
      onError={
        onError
        ?? ((e) => {
          const img = e.currentTarget;
          // Fall back to full-color mark if themed cap asset is missing.
          if (!img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = teamLogoUrl(teamId, { forceRegular: true });
            return;
          }
          img.style.display = 'none';
        })
      }
    />
  );
}
