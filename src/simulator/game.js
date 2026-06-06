import { simulateAtBat } from './atBat';
import { teamDefenseRating } from './defense';
import { resolveBattedBallPlay } from './playResolver';
import { describePlay } from './probability';
import { advanceRunnersContext } from './runners';
import {
  pickPinchHitter,
  platoonPitcherChange,
  resolveSacBunt,
  shouldIntentionalWalk,
  shouldSacBunt,
  stealAttempt,
} from './strategy';

const REGULATION_INNINGS = 9;

function createDefenseState(starter, bullpen) {
  return {
    starter,
    bullpen: bullpen || [],
    current: starter,
    bullpenIdx: 0,
    pitchCount: 0,
  };
}

function defendingSide(battingSide) {
  return battingSide === 'away' ? 'home' : 'away';
}

function maybeSwapPitcher(defense) {
  const tired = defense.pitchCount > 105 || (defense.pitchCount > 85 && Math.random() < 0.25);
  if (tired && defense.bullpenIdx < defense.bullpen.length) {
    defense.current = defense.bullpen[defense.bullpenIdx++];
    defense.pitchCount = 0;
  }
}

function countHit(outcome) {
  return ['HR', '3B', '2B', '1B'].includes(outcome);
}

function buildBatLine(player, battingSide, plays) {
  const playerPlays = plays.filter((play) => play.battingSide === battingSide && play.batterId === player.id);
  const ab = playerPlays.filter((play) => !['BB', 'HBP', 'IBB', 'SAC', 'SF'].includes(play.outcome)).length;
  const h = playerPlays.filter((play) => countHit(play.outcome)).length;
  const d = playerPlays.filter((play) => play.outcome === '2B').length;
  const t = playerPlays.filter((play) => play.outcome === '3B').length;
  const hr = playerPlays.filter((play) => play.outcome === 'HR').length;
  const bb = playerPlays.filter((play) => ['BB', 'IBB'].includes(play.outcome)).length;
  const hbp = playerPlays.filter((play) => play.outcome === 'HBP').length;
  const k = playerPlays.filter((play) => play.outcome === 'K').length;
  const rbi = playerPlays.reduce((sum, play) => sum + play.runs, 0);
  const sb = plays.filter((play) => play.outcome === 'SB' && play.runnerId === player.id).length;
  const cs = plays.filter((play) => play.outcome === 'CS' && play.runnerId === player.id).length;
  const tb = h + d + t * 2 + hr * 3;
  const avg = ab > 0 ? (h / ab).toFixed(3).replace('0.', '.') : '.000';
  const obp = (ab + bb + hbp) > 0 ? ((h + bb + hbp) / (ab + bb + hbp)).toFixed(3).replace('0.', '.') : '.000';
  const slg = ab > 0 ? (tb / ab).toFixed(3).replace('0.', '.') : '.000';
  const ops = ab > 0 ? (parseFloat(obp) + parseFloat(slg)).toFixed(3).replace('0.', '.') : '.000';
  const exitVelocities = playerPlays.filter((play) => play.exitVelocity).map((play) => play.exitVelocity);
  const avgEV = exitVelocities.length
    ? Math.round(exitVelocities.reduce((sum, value) => sum + value, 0) / exitVelocities.length * 10) / 10
    : null;
  const maxEV = exitVelocities.length ? Math.max(...exitVelocities) : null;

  return {
    ...player,
    ab, h, d, t, hr, bb, hbp, k, rbi, tb, avg, obp, slg, ops, sb, cs,
    avgEV,
    maxEV,
    hh: playerPlays.filter((play) => play.hardHit).length,
    brl: playerPlays.filter((play) => play.barrel).length,
    pc: playerPlays.reduce((sum, play) => sum + (play.atBatPitches || 0), 0),
  };
}

function buildPitcherLines(defendingTeamSide, plays) {
  const teamPlays = plays.filter((play) => play.defendingSide === defendingTeamSide && play.pitcherId);
  const map = {};
  const order = [];

  for (const play of teamPlays) {
    const key = play.pitcherId || play.pitcher;
    if (!map[key]) {
      map[key] = {
        name: play.pitcher,
        id: play.pitcherId,
        outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, pc: 0,
      };
      order.push(key);
    }
    const line = map[key];
    line.pc += play.atBatPitches || 0;
    if (countHit(play.outcome)) line.h++;
    line.r += play.runs;
    line.er += play.earnedRuns ?? play.runs;
    if (['BB', 'IBB'].includes(play.outcome)) line.bb++;
    if (play.outcome === 'K') line.k++;
    if (play.outcome === 'HR') line.hr++;
    if (play.outcome === 'HBP') line.hbp++;
    if (['K', 'OUT', 'SF', 'SAC', 'DP'].includes(play.outcome)) line.outs += play.outsRecorded || 1;
  }

  return order.map((key) => {
    const line = map[key];
    return { ...line, ip: `${Math.floor(line.outs / 3)}.${line.outs % 3}` };
  });
}

function advanceOnWildPitch(bases) {
  const [r1, r2, r3] = bases;
  const runnersScored = [];
  const runnerUpdates = [];
  let runs = 0;
  if (r3) {
    runnersScored.push(r3);
    runnerUpdates.push({ name: r3.name, from: 3, to: 'home' });
    runs++;
  }
  return {
    newBases: [r2, r1, null],
    runsScored: runs,
    runnersScored,
    runnerUpdates,
  };
}

export function simulateGame({
  awayTeam,
  homeTeam,
  awayLineup,
  homeLineup,
  awayStarter,
  homeStarter,
  awayBullpen = [],
  homeBullpen = [],
  awayBench = [],
  homeBench = [],
}) {
  const innings = [];
  const plays = [];
  let awayBatIdx = 0;
  let homeBatIdx = 0;
  const teamErrors = { away: 0, home: 0 };

  const defense = {
    away: createDefenseState(awayStarter, awayBullpen),
    home: createDefenseState(homeStarter, homeBullpen),
  };

  const lineups = { away: [...awayLineup], home: [...homeLineup] };
  const benches = { away: [...awayBench], home: [...homeBench] };
  const lastOutBatter = { away: null, home: null };

  function recordPlay(play) {
    plays.push(play);
    return play;
  }

  function simulateHalf(inningNum, battingSide, startBases = [null, null, null], scoreState = null) {
    const batIdx = battingSide === 'away' ? awayBatIdx : homeBatIdx;
    const half = battingSide === 'away' ? '▲' : '▼';
    const defendSide = defendingSide(battingSide);
    const pitcherDefense = defense[defendSide];
    const defenseLineup = lineups[defendSide];
    const defenseRating = teamDefenseRating(defenseLineup);
    const bench = benches[battingSide];
    const scoreDiff = scoreState
      ? (battingSide === 'away'
        ? scoreState.awayBeforeHalf - scoreState.homeBeforeHalf
        : scoreState.homeBeforeHalf - scoreState.awayBeforeHalf)
      : 0;

    let outs = 0;
    let runs = 0;
    let earnedRuns = 0;
    let bases = [...startBases];
    let lineupIndex = batIdx;
    let walkOff = false;
    let inningErrorFlag = false;

    while (outs < 3 && !walkOff) {
      if (platoonPitcherChange(pitcherDefense, lineups[battingSide][lineupIndex % lineups[battingSide].length], inningNum, scoreDiff)) {
        pitcherDefense.current = pitcherDefense.bullpen[pitcherDefense.bullpenIdx++];
        pitcherDefense.pitchCount = 0;
      }
      maybeSwapPitcher(pitcherDefense);

      const runnerOnFirst = bases[0];
      if (runnerOnFirst) {
        const steal = stealAttempt({ bases, runner: runnerOnFirst, pitcher: pitcherDefense.current, outs });
        if (steal) {
          if (steal.success) {
            bases = [null, steal.runner, bases[2]];
            recordPlay({
              inning: `${half}${inningNum + 1}`,
              battingSide,
              defendingSide: defendSide,
              batter: steal.runner.name,
              batterId: steal.runner.id,
              runnerId: steal.runner.id,
              pitcher: pitcherDefense.current?.name || '—',
              pitcherId: pitcherDefense.current?.id,
              outcome: 'SB',
              runs: 0,
              earnedRuns: 0,
              outsRecorded: 0,
              desc: describePlay('SB', steal.runner, {}, null, { runnerName: steal.runner.name }),
              bases: `${bases[0] ? '●' : '○'}${bases[1] ? '●' : '○'}${bases[2] ? '●' : '○'}`,
            });
          } else {
            bases = [null, bases[1], bases[2]];
            outs++;
            recordPlay({
              inning: `${half}${inningNum + 1}`,
              battingSide,
              defendingSide: defendSide,
              batter: steal.runner.name,
              batterId: steal.runner.id,
              runnerId: steal.runner.id,
              pitcher: pitcherDefense.current?.name || '—',
              pitcherId: pitcherDefense.current?.id,
              outcome: 'CS',
              runs: 0,
              earnedRuns: 0,
              outsRecorded: 1,
              desc: describePlay('CS', steal.runner, {}, null, { runnerName: steal.runner.name }),
              bases: `${bases[0] ? '●' : '○'}${bases[1] ? '●' : '○'}${bases[2] ? '●' : '○'}`,
            });
            if (outs >= 3) break;
          }
        }
      }

      if ((bases[0] || bases[1] || bases[2]) && Math.random() < 0.0035) {
        const wp = advanceOnWildPitch(bases);
        bases = wp.newBases;
        runs += wp.runsScored;
        earnedRuns += wp.runsScored;
        recordPlay({
          inning: `${half}${inningNum + 1}`,
          battingSide,
          defendingSide: defendSide,
          batter: '—',
          batterId: 'wp',
          pitcher: pitcherDefense.current?.name || '—',
          pitcherId: pitcherDefense.current?.id,
          outcome: 'WP',
          runs: wp.runsScored,
          earnedRuns: wp.runsScored,
          outsRecorded: 0,
          desc: 'Wild pitch — runners advance.',
          bases: `${bases[0] ? '●' : '○'}${bases[1] ? '●' : '○'}${bases[2] ? '●' : '○'}`,
        });
      }

      let batter = lineups[battingSide][lineupIndex % lineups[battingSide].length];
      const pitcher = pitcherDefense.current;
      const pitcherHand = pitcher?.throwsHand || 'R';

      const pinch = pickPinchHitter(bench, batter, pitcherHand, inningNum, scoreDiff, battingSide);
      if (pinch) {
        batter = pinch;
        const idx = bench.indexOf(pinch);
        if (idx >= 0) bench.splice(idx, 1);
      }

      let resolved;
      let atBat = null;

      if (shouldSacBunt({ bases, outs, batter, inning: inningNum, scoreDiff, battingSide })) {
        resolved = resolveSacBunt(bases, batter);
        resolved.earnedRuns = inningErrorFlag ? 0 : resolved.runsScored;
        bases = resolved.newBases;
        runs += resolved.runsScored;
        earnedRuns += resolved.earnedRuns;
      } else {
        const intentional = shouldIntentionalWalk({
          bases, outs, batter, pitcher, inning: inningNum, scoreDiff, battingSide,
        });
        atBat = simulateAtBat(batter, pitcher, homeTeam.id, { forceWalk: intentional });
        pitcherDefense.pitchCount += atBat.pitchCount || 1;

        let outcome = atBat.outcome;
        if (outcome === 'IBB') outcome = 'IBB';

        if (['BB', 'HBP', 'IBB'].includes(outcome)) {
          const adv = advanceRunnersContext(bases, outcome === 'IBB' ? 'IBB' : outcome, outs, batter);
          resolved = {
            outcome,
            outsRecorded: 0,
            ...adv,
            isDoublePlay: false,
            isError: false,
            isSacFly: false,
            earnedRuns: inningErrorFlag ? 0 : adv.runsScored,
          };
        } else if (outcome === 'K') {
          resolved = {
            outcome: 'K',
            outsRecorded: 1,
            newBases: bases,
            runsScored: 0,
            runnersScored: [],
            runnerUpdates: [],
            earnedRuns: 0,
          };
        } else if (atBat.bipMeta) {
          resolved = resolveBattedBallPlay({
            rawOutcome: outcome,
            bases,
            outs,
            batter,
            bip: atBat.bipMeta,
            defenseRating,
            inningErrorFlag,
          });
          if (resolved.isError) {
            teamErrors[defendSide]++;
            inningErrorFlag = true;
          }
        } else {
          resolved = {
            outcome: outcome || 'OUT',
            outsRecorded: 1,
            newBases: bases,
            runsScored: 0,
            runnersScored: [],
            runnerUpdates: [],
            earnedRuns: 0,
          };
        }

        bases = resolved.newBases ?? bases;
        runs += resolved.runsScored || 0;
        earnedRuns += resolved.earnedRuns ?? resolved.runsScored ?? 0;
      }

      const play = recordPlay({
        inning: `${half}${inningNum + 1}`,
        battingSide,
        defendingSide: defendSide,
        batter: batter.name,
        batterId: batter.id,
        pitcher: pitcher?.name || '—',
        pitcherId: pitcher?.id || '—',
        pitcherTeamId: defendSide === 'away' ? awayTeam.id : homeTeam.id,
        outcome: resolved.outcome,
        runs: resolved.runsScored || 0,
        earnedRuns: resolved.earnedRuns ?? resolved.runsScored ?? 0,
        outsRecorded: resolved.outsRecorded ?? 1,
        isDoublePlay: resolved.isDoublePlay,
        isError: resolved.isError,
        isSacFly: resolved.isSacFly,
        desc: describePlay(
          resolved.outcome,
          batter,
          resolved,
          atBat?.bipMeta,
          { customDesc: resolved.desc },
        ),
        outsAfter: outs + (resolved.outsRecorded || 0),
        bases: `${bases[0] ? '●' : '○'}${bases[1] ? '●' : '○'}${bases[2] ? '●' : '○'}`,
        pitchCount: Math.round(pitcherDefense.pitchCount),
        pitches: atBat?.pitches,
        atBatPitches: atBat?.pitchCount || 0,
        exitVelocity: atBat?.exitVelocity,
        launchAngle: atBat?.launchAngle,
        hitDistance: atBat?.hitDistance,
        sprayAngle: atBat?.sprayAngle,
        hitField: atBat?.hitField,
        hardHit: atBat?.hardHit,
        barrel: atBat?.barrel,
        battedBallType: atBat?.battedBallType,
      });

      outs += resolved.outsRecorded || 0;
      if (['K', 'OUT', 'SF', 'SAC', 'DP'].includes(resolved.outcome)) {
        lastOutBatter[battingSide] = batter;
      }
      lineupIndex++;

      if (
        scoreState
        && battingSide === 'home'
        && inningNum >= REGULATION_INNINGS - 1
        && scoreState.homeBeforeHalf <= scoreState.awayBeforeHalf
        && scoreState.homeBeforeHalf + runs > scoreState.awayBeforeHalf
      ) {
        play.walkOff = true;
        walkOff = true;
      }
    }

    if (battingSide === 'away') awayBatIdx = lineupIndex % lineups[battingSide].length;
    else homeBatIdx = lineupIndex % lineups[battingSide].length;

    return { runs, earnedRuns, walkOff };
  }

  for (let inning = 0; inning < REGULATION_INNINGS; inning++) {
    const awayScore = innings.reduce((sum, row) => sum + (row.away || 0), 0);
    const homeScore = innings.reduce((sum, row) => sum + (row.home || 0), 0);
    const awayHalf = simulateHalf(inning, 'away');
    const awayTotal = awayScore + awayHalf.runs;

    const skipBottom = inning >= REGULATION_INNINGS - 1 && homeScore > awayTotal;
    let homeHalf = { runs: 0, walkOff: false };
    if (!skipBottom) {
      homeHalf = simulateHalf(inning, 'home', [null, null, null], {
        awayBeforeHalf: awayTotal,
        homeBeforeHalf: homeScore,
      });
    }

    innings.push({
      away: awayHalf.runs,
      home: skipBottom ? null : homeHalf.runs,
      homeSkipped: skipBottom,
    });

    if (homeHalf.walkOff) break;
  }

  const totals = () => ({
    away: innings.reduce((sum, row) => sum + (row.away || 0), 0),
    home: innings.reduce((sum, row) => sum + (row.home || 0), 0),
  });

  let extraInning = innings.length;
  while (totals().away === totals().home && extraInning < 15) {
    const awayScore = totals().away;
    const homeScore = totals().home;
    const ghostAway = lastOutBatter.away || { id: 'ghost', name: 'Pinch runner' };
    const ghostHome = lastOutBatter.home || { id: 'ghost', name: 'Pinch runner' };
    const awayHalf = simulateHalf(extraInning, 'away', [null, ghostAway, null]);
    const awayTotal = awayScore + awayHalf.runs;
    const homeHalf = simulateHalf(extraInning, 'home', [null, ghostHome, null], {
      awayBeforeHalf: awayTotal,
      homeBeforeHalf: homeScore,
    });
    innings.push({ away: awayHalf.runs, home: homeHalf.runs });
    extraInning++;
    if (homeHalf.walkOff) break;
  }

  const final = totals();
  const teamHits = (battingSide) => plays.filter(
    (play) => play.battingSide === battingSide && countHit(play.outcome),
  ).length;

  return {
    awayTeam,
    homeTeam,
    awayLineup: lineups.away,
    homeLineup: lineups.home,
    awayStarter,
    homeStarter,
    innings,
    awayScore: final.away,
    homeScore: final.home,
    lineHits: { away: teamHits('away'), home: teamHits('home') },
    lineErrors: { away: teamErrors.away, home: teamErrors.home },
    winner: final.away > final.home ? awayTeam : homeTeam,
    plays: [...plays].reverse(),
    boxAway: lineups.away.map((player) => buildBatLine(player, 'away', plays)),
    boxHome: lineups.home.map((player) => buildBatLine(player, 'home', plays)),
    pitcherLinesAway: buildPitcherLines('away', plays),
    pitcherLinesHome: buildPitcherLines('home', plays),
  };
}