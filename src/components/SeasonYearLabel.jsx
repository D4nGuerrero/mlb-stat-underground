import { useState } from 'react';

function HonorBadge({ badge }) {
  const [useFallback, setUseFallback] = useState(!badge.image);

  if (!useFallback && badge.image) {
    return (
      <img
        src={badge.image}
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
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>
        {season}
        {minorsLevel ? ` (${minorsLevel})` : ''}
      </span>
      {badges.length > 0 && (
        <span className="inline-flex items-center gap-0.5">
          {badges.map((badge) => (
            <HonorBadge key={badge.key} badge={badge} />
          ))}
        </span>
      )}
    </span>
  );
}