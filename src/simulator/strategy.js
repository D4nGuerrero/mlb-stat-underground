import { statOPS } from './roster';
import { runnerSpeed } from './defense';

function batterOpsVsHand(player, hand) {
  const sit = player.sitSplits || {};
  const key = hand === 'L' ? 'vl' : 'vr';
  const split = sit[key];
  if (split?.obp && split?.slg) return parseFloat(split.obp) + parseFloat(split.slg);
  return statOPS(player.stats);
}

export function shouldIntentionalWalk({ bases, outs, batter, pitcher, inning, scoreDiff, battingSide }) {
  if (bases[0] || outs >= 2) return false;
  if (inning < 7) return false;
  const slug = parseFloat(batter.stats?.slg) || 0.4;
  const hr = batter.stats?.homeRuns || 0;
  const pa = batter.stats?.plateAppearances || 400;
  const elite = slug >= 0.520 || hr / pa > 0.06;
  if (!elite) return false;
  const close = Math.abs(scoreDiff) <= 2;
  const late = inning >= 8;
  const runnerInScoring = bases[1] || bases[2];
  return close && late && runnerInScoring && Math.random() < 0.55;
}

export function shouldSacBunt({ bases, outs, batter, inning, scoreDiff, battingSide }) {
  if (outs >= 2) return false;
  if (!bases[0] && !bases[1]) return false;
  const pa = batter.stats?.plateAppearances || 400;
  const slg = parseFloat(batter.stats?.slg) || 0.38;
  const weak = slg < 0.360 || (batter.stats?.homeRuns || 0) / pa < 0.015;
  if (!weak) return false;
  const lateClose = inning >= 7 && Math.abs(scoreDiff) <= 3;
  const trailing = battingSide === 'away' ? scoreDiff < 0 : scoreDiff > 0;
  if (lateClose && trailing && bases[1] && !bases[2]) return Math.random() < 0.35;
  if (bases[0] && !bases[1] && inning >= 8) return Math.random() < 0.12;
  return false;
}

export function resolveSacBunt(bases, batter) {
  const r1 = bases[0];
  const r2 = bases[1];
  const r3 = bases[2];
  const runnersScored = [];
  const runnerUpdates = [];
  let newBases = [null, null, null];
  let runs = 0;

  if (r3 && r2) {
    runnersScored.push(r3);
    runnerUpdates.push({ name: r3.name, from: 3, to: 'home' });
    runs++;
  }
  if (r2) {
    newBases[2] = r2;
    runnerUpdates.push({ name: r2.name, from: 2, to: 3 });
  }
  if (r1) {
    newBases[1] = r1;
    runnerUpdates.push({ name: r1.name, from: 1, to: 2 });
  }

  return {
    outcome: 'SAC',
    outsRecorded: 1,
    newBases,
    runsScored: runs,
    runnersScored,
    runnerUpdates,
    desc: `${batter.name} bunts for a sacrifice.`,
  };
}

export function stealAttempt({ bases, runner, pitcher, outs }) {
  if (!bases[0] || bases[1] || outs >= 2) return null;
  const speed = runnerSpeed(runner);
  const pitcherHold = Math.min(0.85, 0.55 + (pitcher?.pitchingStats?.strikeOuts || 100) / 900);
  let successP = 0.72 + speed * 0.18 - pitcherHold * 0.12;
  const sb = runner.stats?.stolenBases || 0;
  const cs = runner.stats?.caughtStealing || 0;
  if (sb + cs > 5) successP = sb / (sb + cs) * 0.95 + speed * 0.08;

  if (Math.random() > 0.08) return null;

  const success = Math.random() < successP;
  return { runner, success };
}

export function pickPinchHitter(bench, batter, pitcherHand, inning, scoreDiff, battingSide) {
  if (!bench?.length || inning < 7) return null;
  const currentOps = batterOpsVsHand(batter, pitcherHand);
  const trailing = battingSide === 'away' ? scoreDiff < -1 : scoreDiff > 1;
  if (!trailing && inning < 9) return null;

  const candidates = bench
    .map((p) => ({ player: p, ops: batterOpsVsHand(p, pitcherHand) }))
    .filter((c) => c.ops > currentOps + 0.06)
    .sort((a, b) => b.ops - a.ops);

  if (!candidates.length) return null;
  if (Math.random() > 0.65) return null;
  return candidates[0].player;
}

export function platoonPitcherChange(defense, batter, inning, scoreDiff) {
  const pitcher = defense.current;
  if (!pitcher || defense.bullpenIdx >= defense.bullpen.length) return false;
  const pHand = pitcher.throwsHand || 'R';
  const bHand = batter.batsHand || 'R';
  const platoonAdv = (pHand === 'L' && bHand === 'R') || (pHand === 'R' && bHand === 'L');
  if (platoonAdv) return false;
  const sameHand = pHand === bHand || bHand === 'S';
  if (!sameHand) return false;
  const late = inning >= 6;
  const close = Math.abs(scoreDiff) <= 3;
  return late && close && Math.random() < 0.4;
}