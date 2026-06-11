/**
 * Season honor badges shown in the Career tab year column.
 *
 * To use custom images: drop files in public/badges/ and set `image` to the path
 * (e.g. '/badges/mvp.png'). Paths are resolved via resolveAssetUrl() for GitHub Pages.
 * If `image` is null or the file fails to load, the text `label` is shown instead.
 *
 * yearDecoration — optional styling on the season year itself (see seasonHonorOverlays.jsx).
 *   wrapperClassName  outer wrapper, e.g. 'sparkle'
 *   yearClassName     inner span around the year, e.g. 'name gradient' (needs position: relative for overlays)
 *   overlay           overlay key: 'crown', etc.
 *   overlayClassName  extra class on the overlay element
 *   suppressInline    hide the inline badge image for this honor
 *   decorationPriority  overlay stacking order when multiple overlays apply (default 0)
 */
export const SEASON_HONOR_BADGES = [
  {
    key: 'mvp',
    awardIds: ['ALMVP', 'NLMVP'],
    label: 'M',
    image: null,
    alt: 'MVP',
    yearDecoration: {
      yearClassName: 'name gradient',
      overlay: 'crown',
      suppressInline: true,
      decorationPriority: 10,
    },
  },
  {
    key: 'cy',
    awardIds: ['ALCY', 'NLCY'],
    label: 'C',
    image: '/badges/cy-young.svg',
    alt: 'Cy Young',
  },
  {
    key: 'goldGlove',
    awardIds: ['ALGG', 'NLGG'],
    label: 'GG',
    image: '/badges/gold-glove.png',
    alt: 'Gold Glove',
  },
  {
    key: 'silverSlugger',
    awardIds: ['ALSS', 'NLSS'],
    label: 'SS',
    image: '/badges/ss.png',
    alt: 'Silver Slugger',
  },
  {
    key: 'allStar',
    awardIds: ['ALAS', 'NLAS'],
    label: '⭐',
    image: null,
    alt: 'All-Star',
    yearDecoration: {
      wrapperClassName: 'sparkle',
      yearClassName: 'name gradient',
      suppressInline: true,
    },
  },
];