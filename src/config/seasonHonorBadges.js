/**
 * Season honor badges shown in the Career tab year column.
 *
 * To use custom images: drop files in public/badges/ and set `image` to the path
 * (e.g. '/badges/mvp.png'). Supported formats: png, svg, webp.
 * If `image` is null or the file fails to load, the text `label` is shown instead.
 */
export const SEASON_HONOR_BADGES = [
  {
    key: 'mvp',
    awardIds: ['ALMVP', 'NLMVP'],
    label: 'M',
    image: 'https://oldschool.runescape.wiki/images/Jagex_moderator_emblem.png',
    alt: 'MVP',
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
    image: '/badges/gold-glove.svg',
    alt: 'Gold Glove',
  },
  {
    key: 'silverSlugger',
    awardIds: ['ALSS', 'NLSS'],
    label: 'SS',
    image: '/badges/silver-slugger.svg',
    alt: 'Silver Slugger',
  },
  {
    key: 'allStar',
    awardIds: ['ALAS', 'NLAS'],
    label: '⭐',
    image: '/badges/all-star.svg',
    alt: 'All-Star',
  },
];