import { useState } from 'react';
import { resolveAssetUrl } from '../utils/baseUrl.js';
import { SeasonHonorOverlay } from '../config/seasonHonorOverlays.jsx';
import {
  getInlineHonorBadges,
  resolveSeasonYearDecoration,
} from '../utils/seasonHonors';

function HonorBadge({ badge }) {
  const imageSrc = resolveAssetUrl(badge.image);
  const [useFallback, setUseFallback] = useState(!imageSrc);

  if (!useFallback && imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={badge.alt}
        title={badge.alt}
        className="inline-block h-6 w-6 md:h-[18px] md:w-[18px] object-contain shrink-0"
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
  const decoration = resolveSeasonYearDecoration(badges);
  const inlineBadges = getInlineHonorBadges(badges, decoration);

  const yearContent = (
    <>
      {season}
      {decoration?.overlays?.map((overlay) => (
        <SeasonHonorOverlay
          key={overlay.type}
          type={overlay.type}
          className={overlay.className}
        />
      ))}
      {minorsLevel ? ` (${minorsLevel})` : ''}
    </>
  );

  const yearInner = decoration?.yearClassName ? (
    <span className={decoration.yearClassName}>{yearContent}</span>
  ) : (
    <span>{yearContent}</span>
  );

  const yearBlock = decoration?.wrapperClassName ? (
    <span className={decoration.wrapperClassName}>{yearInner}</span>
  ) : (
    yearInner
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      {yearBlock}

      {inlineBadges.length > 0 && (
        <span className="inline-flex items-center gap-0.5">
          {inlineBadges.map((badge) => (
            <HonorBadge key={badge.key} badge={badge} />
          ))}
        </span>
      )}
    </span>
  );
}