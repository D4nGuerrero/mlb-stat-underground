/**
 * Overlay elements rendered on top of the season year (position: absolute).
 * Reference by `overlay` key in seasonHonorBadges.js → yearDecoration.overlay
 */
export const SEASON_HONOR_OVERLAYS = {
  crown: {
    className: 'crown',
    render: () => (
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <polygon points="4,50 60,50 60,58 4,58" fill="#facc15" />
        <polygon
          points="4,50 14,20 24,38 32,14 40,38 50,20 60,50"
          fill="#fbbf24"
          stroke="#f59e0b"
          strokeWidth="1.5"
        />
        <circle cx="14" cy="20" r="4" fill="#ef4444" />
        <circle cx="32" cy="14" r="4" fill="#3b82f6" />
        <circle cx="50" cy="20" r="4" fill="#10b981" />
      </svg>
    ),
  },
};

export function SeasonHonorOverlay({ type, className = '' }) {
  const def = SEASON_HONOR_OVERLAYS[type];
  if (!def) return null;

  return (
    <div className={[def.className, className].filter(Boolean).join(' ')}>
      {def.render()}
    </div>
  );
}