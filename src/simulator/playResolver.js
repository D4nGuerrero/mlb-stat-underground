import {
  doublePlayChance,
  errorChance,
  fieldingHitConversion,
  sacFlyEligible,
} from './defense';
import { advanceRunnersContext, resolveDoublePlay } from './runners';

export function resolveBattedBallPlay({
  rawOutcome,
  bases,
  outs,
  batter,
  bip,
  defenseRating,
  inningErrorFlag,
}) {
  let outcome = rawOutcome;
  let outsRecorded = ['K', 'OUT', 'SF', 'SAC', 'DP'].includes(outcome) ? 1 : 0;
  let isDoublePlay = false;
  let isError = false;
  let isSacFly = false;
  let errorTeam = null;
  let unearnedRun = inningErrorFlag;

  if (bip && ['1B', '2B', '3B', 'HR'].includes(outcome)) {
    const convertP = fieldingHitConversion(bip, batter, defenseRating);
    if (Math.random() < convertP) outcome = 'OUT';
  }

  if (outcome === 'OUT' && bip && errorChance(bip, defenseRating) > Math.random()) {
    outcome = 'E';
    isError = true;
    errorTeam = 'defense';
    unearnedRun = true;
    outsRecorded = 0;
  }

  if (outcome === 'OUT' && sacFlyEligible(bip, bases, outs)) {
    outcome = 'SF';
    isSacFly = true;
    outsRecorded = 1;
  }

  if (
    outcome === 'OUT'
    && bip?.battedBallType === 'GB'
    && bases[0]
    && outs < 2
    && Math.random() < doublePlayChance(bip, batter, defenseRating, bases, outs)
  ) {
    const dp = resolveDoublePlay(bases, batter);
    return {
      ...dp,
      isDoublePlay: true,
      isError: false,
      isSacFly: false,
      unearnedRun,
      earnedRuns: dp.runsScored && unearnedRun ? 0 : dp.runsScored,
    };
  }

  const advanceResult = advanceRunnersContext(bases, outcome, outs, batter, bip);
  if (outcome === 'K') outsRecorded = 1;

  const earnedRuns = unearnedRun ? 0 : advanceResult.runsScored;

  return {
    outcome,
    outsRecorded,
    ...advanceResult,
    isDoublePlay,
    isError,
    isSacFly,
    errorTeam,
    unearnedRun: unearnedRun || isError,
    earnedRuns,
  };
}