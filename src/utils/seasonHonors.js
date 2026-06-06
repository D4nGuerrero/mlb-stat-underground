import { SEASON_HONOR_BADGES } from '../config/seasonHonorBadges';

const AWARD_ID_TO_HONOR_KEY = Object.fromEntries(
  SEASON_HONOR_BADGES.flatMap((badge) => badge.awardIds.map((id) => [id, badge.key])),
);

export function buildSeasonHonors(awards) {
  const bySeason = {};

  for (const award of awards ?? []) {
    const honorKey = AWARD_ID_TO_HONOR_KEY[award.id];
    const season = award.season;
    if (!honorKey || !season) continue;

    if (!bySeason[season]) {
      bySeason[season] = Object.fromEntries(SEASON_HONOR_BADGES.map((b) => [b.key, false]));
    }
    bySeason[season][honorKey] = true;
  }

  return bySeason;
}

export function getActiveHonorBadges(honorFlags) {
  if (!honorFlags) return [];
  return SEASON_HONOR_BADGES.filter((badge) => honorFlags[badge.key]);
}