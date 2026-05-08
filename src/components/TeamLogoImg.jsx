import { useTheme } from '../context/ThemeContext';

/**
 * Theme-aware team logo image.
 * Dark mode  → /team-logos/{id}.svg                      (full-color primary)
 * Light mode → /team-logos/team-cap-on-light/{id}.svg    (dark cap for light bg)
 */
export default function TeamLogoImg({ teamId, className, alt, onError, style }) {
  const { isDark } = useTheme();

  if (!teamId) return null;

  const src = isDark
    ? `https://www.mlbstatic.com/team-logos/${teamId}.svg`
    : `https://www.mlbstatic.com/team-logos/team-cap-on-light/${teamId}.svg`;

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
