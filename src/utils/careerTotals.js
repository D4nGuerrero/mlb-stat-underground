const HITTING_SUM_KEYS = [
  'atBats', 'runs', 'hits', 'doubles', 'triples', 'homeRuns', 'rbi',
  'baseOnBalls', 'hitByPitch', 'strikeOuts', 'stolenBases', 'caughtStealing',
  'sacFlies',
];

const PITCHING_SUM_KEYS = [
  'gamesPlayed', 'gamesStarted', 'wins', 'losses', 'hits', 'runs', 'earnedRuns',
  'baseOnBalls', 'strikeOuts', 'homeRuns', 'saves',
];

const FIELDING_SUM_KEYS = [
  'gamesPlayed', 'gamesStarted', 'putOuts', 'assists', 'errors', 'chances',
];

function getStat(row) {
  return row.stat ?? row;
}

function sumField(rows, key) {
  return rows.reduce((acc, row) => acc + (Number(getStat(row)[key]) || 0), 0);
}

function ipToOuts(ip) {
  if (ip == null || ip === '') return 0;
  const [whole, frac = '0'] = String(ip).split('.');
  return parseInt(whole, 10) * 3 + parseInt(frac, 10);
}

function outsToIp(outs) {
  const whole = Math.floor(outs / 3);
  const frac = outs % 3;
  return frac === 0 ? String(whole) : `${whole}.${frac}`;
}

export function computeCareerTotalsRow(rows, group) {
  if (!rows?.length) return null;

  if (group === 'hitting') {
    const totals = Object.fromEntries(HITTING_SUM_KEYS.map((k) => [k, sumField(rows, k)]));
    const ab = totals.atBats;
    const h = totals.hits;
    const bb = totals.baseOnBalls;
    const hbp = totals.hitByPitch;
    const sf = totals.sacFlies;
    const singles = h - totals.doubles - totals.triples - totals.homeRuns;
    const obpDenom = ab + bb + hbp + sf;
    const slgDenom = ab;

    const avg = ab > 0 ? (h / ab).toFixed(3).replace(/^0/, '') : '.000';
    const obp = obpDenom > 0 ? ((h + bb + hbp) / obpDenom).toFixed(3).replace(/^0/, '') : '.000';
    const slg = slgDenom > 0
      ? ((singles + 2 * totals.doubles + 3 * totals.triples + 4 * totals.homeRuns) / slgDenom)
          .toFixed(3)
          .replace(/^0/, '')
      : '.000';
    const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3).replace(/^0/, '');

    return {
      id: 'career-totals',
      label: 'Career',
      isTotals: true,
      stat: { ...totals, avg, obp, slg, ops },
      ...totals,
      avg,
      obp,
      slg,
      ops,
    };
  }

  if (group === 'pitching') {
    const totals = Object.fromEntries(PITCHING_SUM_KEYS.map((k) => [k, sumField(rows, k)]));
    const totalOuts = rows.reduce((acc, row) => acc + ipToOuts(getStat(row).inningsPitched), 0);
    const ip = outsToIp(totalOuts);
    const er = totals.earnedRuns;
    const ipFloat = totalOuts / 3;
    return {
      id: 'career-totals',
      label: 'Career',
      isTotals: true,
      stat: {
        ...totals,
        inningsPitched: ip,
        era: ipFloat > 0 ? ((er * 9) / ipFloat).toFixed(2) : '0.00',
        whip: ipFloat > 0 ? ((totals.hits + totals.baseOnBalls) / ipFloat).toFixed(2) : '0.00',
      },
      ...totals,
      inningsPitched: ip,
      era: ipFloat > 0 ? ((er * 9) / ipFloat).toFixed(2) : '0.00',
      whip: ipFloat > 0 ? ((totals.hits + totals.baseOnBalls) / ipFloat).toFixed(2) : '0.00',
    };
  }

  if (group === 'fielding') {
    const totals = Object.fromEntries(FIELDING_SUM_KEYS.map((k) => [k, sumField(rows, k)]));
    const tc = totals.chances || totals.putOuts + totals.assists + totals.errors;
    return {
      id: 'career-totals',
      label: 'Career',
      isTotals: true,
      stat: {
        ...totals,
        fielding: tc > 0 ? ((tc - totals.errors) / tc).toFixed(3) : '.000',
      },
      ...totals,
      fielding: tc > 0 ? ((tc - totals.errors) / tc).toFixed(3) : '.000',
    };
  }

  return null;
}