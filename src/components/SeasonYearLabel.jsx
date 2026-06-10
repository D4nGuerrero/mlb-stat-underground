import { useState } from 'react';
import { resolveAssetUrl } from '../utils/baseUrl.js';

function HonorBadge({ badge }) {
  const imageSrc = resolveAssetUrl(badge.image);
  const [useFallback, setUseFallback] = useState(!imageSrc);

  if (!useFallback && imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={badge.alt}
        title={badge.alt}
        className="inline-block h-4 w-4 md:h-[18px] md:w-[18px] object-contain shrink-0"
        onError={() => setUseFallback(true)}
      />
    );
  }

  return (
    <span className="text-[10px] md:text-xs text-slate-400 font-normal" title={badge.alt}>
      ({badge.label})
    </span>
  );
}

export default function SeasonYearLabel({ season, minorsLevel, badges = [] }) {
  const hasAllStar = badges.some(b => b.key === 'allStar');

  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Special sparkle treatment for All-Star years */}
      {hasAllStar ? (
        <span className="sparkle">
          <span className="name gradient">
            {season}
            {minorsLevel ? ` (${minorsLevel})` : ''}
          </span>
        </span>
      ) : (
        <span>
          {season}
          {minorsLevel ? ` (${minorsLevel})` : ''}
        </span>
      )}

      {/* Render all badges (including All-Star) */}
      {badges.length > 0 && (
        <span className="inline-flex items-center gap-0.5">
          {badges.map((badge) => {
            if (badge.key === 'allStar') return null;
            return <HonorBadge key={badge.key} badge={badge} />;
          }
          )}
        </span>
      )}  
    </span>
  );
}
