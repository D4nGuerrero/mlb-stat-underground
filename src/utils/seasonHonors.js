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

/** Merge yearDecoration from all active badges (e.g. All-Star glow + MVP crown). */
export function resolveSeasonYearDecoration(activeBadges) {
  const decorated = (activeBadges ?? []).filter((badge) => badge.yearDecoration);
  if (!decorated.length) return null;

  const wrapperClassName = [
    ...new Set(decorated.map((b) => b.yearDecoration.wrapperClassName).filter(Boolean)),
  ].join(' ');

  const yearClassName = [
    ...new Set(
      decorated.flatMap((b) => (b.yearDecoration.yearClassName ?? '').split(/\s+/).filter(Boolean)),
    ),
  ].join(' ');

  const overlays = decorated
    .filter((b) => b.yearDecoration.overlay)
    .sort(
      (a, b) =>
        (b.yearDecoration.decorationPriority ?? 0) - (a.yearDecoration.decorationPriority ?? 0),
    )
    .map((b) => ({
      type: b.yearDecoration.overlay,
      className: b.yearDecoration.overlayClassName,
    }));

  const suppressInlineKeys = decorated
    .filter((b) => b.yearDecoration.suppressInline)
    .map((b) => b.key);

  return { wrapperClassName, yearClassName, overlays, suppressInlineKeys };
}

export function getInlineHonorBadges(activeBadges, mergedDecoration) {
  const suppressKeys = new Set(mergedDecoration?.suppressInlineKeys ?? []);
  return (activeBadges ?? []).filter((badge) => !suppressKeys.has(badge.key));
}