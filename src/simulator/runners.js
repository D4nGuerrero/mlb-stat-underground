import { runnerSpeed } from './defense';

const BASE_LABEL = { 1: 'first', 2: 'second', 3: 'third' };

function recordMove(updates, runner, from, to) {
  if (!runner) return;
  if (from === to) updates.push({ name: runner.name, from, to, held: true });
  else updates.push({ name: runner.name, from, to });
}

function score(runnersScored, runnerUpdates, runner, fromBase, runs) {
  runnersScored.push(runner);
  runnerUpdates.push({ name: runner.name, from: fromBase, to: 'home' });
  return runs + 1;
}

function scoreProbFrom2nd(bip, speed, outs) {
  let p = 0.42;
  if (bip?.ev >= 98) p += 0.22;
  else if (bip?.ev >= 92) p += 0.12;
  if (bip?.dist >= 280) p += 0.12;
  if (bip?.battedBallType === 'LD') p += 0.08;
  if (outs >= 2) p += 0.06;
  p += speed * 0.06;
  return Math.min(0.9, p);
}

function scoreProbFrom1stOnDouble(bip, speed) {
  let p = 0.58;
  if (bip?.ev >= 100) p += 0.18;
  if (bip?.dist >= 300) p += 0.1;
  p += speed * 0.08;
  return Math.min(0.92, p);
}

/** Context-aware runner advancement using EV, LA, distance, speed, outs. */
export function advanceRunnersContext(bases, hitType, outs, batter, bip = null) {
  const r1 = bases[0];
  const r2 = bases[1];
  const r3 = bases[2];
  const runnersScored = [];
  const runnerUpdates = [];
  let newBases = [null, null, null];
  let runs = 0;
  const speed = runnerSpeed(batter);

  if (hitType === 'HR') {
    if (r1) runs = score(runnersScored, runnerUpdates, r1, 1, runs);
    if (r2) runs = score(runnersScored, runnerUpdates, r2, 2, runs);
    if (r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    runs = score(runnersScored, runnerUpdates, batter, 'batter', runs);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === 'E') {
    if (r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    if (r2) {
      newBases[2] = r2;
      recordMove(runnerUpdates, r2, 2, 3);
    }
    if (r1) {
      newBases[1] = r1;
      recordMove(runnerUpdates, r1, 1, 2);
    }
    newBases[0] = batter;
    recordMove(runnerUpdates, batter, 'batter', 1);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === '3B') {
    if (r1) runs = score(runnersScored, runnerUpdates, r1, 1, runs);
    if (r2) runs = score(runnersScored, runnerUpdates, r2, 2, runs);
    if (r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    newBases[2] = batter;
    recordMove(runnerUpdates, batter, 'batter', 3);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === '2B') {
    if (r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    if (r2) runs = score(runnersScored, runnerUpdates, r2, 2, runs);
    if (r1) {
      if (Math.random() < scoreProbFrom1stOnDouble(bip, speed)) runs = score(runnersScored, runnerUpdates, r1, 1, runs);
      else {
        newBases[2] = r1;
        recordMove(runnerUpdates, r1, 1, 3);
      }
    }
    newBases[1] = batter;
    recordMove(runnerUpdates, batter, 'batter', 2);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === '1B') {
    if (r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    if (r2) {
      if (Math.random() < scoreProbFrom2nd(bip, speed, outs)) runs = score(runnersScored, runnerUpdates, r2, 2, runs);
      else if (Math.random() < 0.82) {
        newBases[2] = r2;
        recordMove(runnerUpdates, r2, 2, 3);
      } else {
        newBases[1] = r2;
        recordMove(runnerUpdates, r2, 2, 2);
      }
    }
    if (r1) {
      newBases[1] = r1;
      recordMove(runnerUpdates, r1, 1, 2);
    }
    newBases[0] = batter;
    recordMove(runnerUpdates, batter, 'batter', 1);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === 'BB' || hitType === 'HBP' || hitType === 'IBB') {
    if (r1 && r2 && r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    if (r1 && r2) {
      newBases[0] = batter;
      newBases[1] = r1;
      newBases[2] = r2;
      recordMove(runnerUpdates, r1, 1, 2);
      recordMove(runnerUpdates, r2, 2, 3);
    } else if (r1) {
      newBases[0] = batter;
      newBases[1] = r1;
      recordMove(runnerUpdates, r1, 1, 2);
    } else {
      newBases[0] = batter;
    }
    recordMove(runnerUpdates, batter, 'batter', 1);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === 'SF') {
    if (r3) runs = score(runnersScored, runnerUpdates, r3, 3, runs);
    newBases = [r1, r2, null];
    if (r1) recordMove(runnerUpdates, r1, 1, 1);
    if (r2) recordMove(runnerUpdates, r2, 2, 2);
    return { newBases, runsScored: runs, runnersScored, runnerUpdates };
  }

  if (hitType === 'OUT') {
    newBases = [r1, r2, r3];
    if (r1) recordMove(runnerUpdates, r1, 1, 1);
    if (r2) recordMove(runnerUpdates, r2, 2, 2);
    if (r3) recordMove(runnerUpdates, r3, 3, 3);
    return { newBases, runsScored: 0, runnersScored, runnerUpdates };
  }

  return { newBases: [r1, r2, r3], runsScored: 0, runnersScored, runnerUpdates };
}

export function resolveDoublePlay(bases, batter) {
  const r1 = bases[0];
  const r2 = bases[1];
  const r3 = bases[2];
  const runnersScored = [];
  const runnerUpdates = [];
  let newBases = [null, null, null];
  let runs = 0;

  if (r2 && r1) {
    runnerUpdates.push({ name: r1.name, from: 1, to: 'out' });
    runnerUpdates.push({ name: r2.name, from: 2, to: 'out' });
    newBases[2] = r3;
    if (r3) recordMove(runnerUpdates, r3, 3, 3);
  } else if (r1) {
    runnerUpdates.push({ name: r1.name, from: 1, to: 'out' });
    newBases[1] = r2;
    newBases[2] = r3;
    if (r2) recordMove(runnerUpdates, r2, 2, 2);
    if (r3) recordMove(runnerUpdates, r3, 3, 3);
  }

  return {
    outcome: 'DP',
    outsRecorded: 2,
    newBases,
    runsScored: runs,
    runnersScored,
    runnerUpdates,
    desc: `${batter.name} grounds into a double play.`,
  };
}

export { BASE_LABEL };