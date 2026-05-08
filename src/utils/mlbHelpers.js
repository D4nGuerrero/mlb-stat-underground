// src/utils/mlbHelpers.js

export const mlbTeams = [
  { id: 109, name: 'Arizona Diamondbacks', abbr: 'ARI' },
  { id: 144, name: 'Atlanta Braves', abbr: 'ATL' },
  { id: 110, name: 'Baltimore Orioles', abbr: 'BAL' },
  { id: 111, name: 'Boston Red Sox', abbr: 'BOS' },
  { id: 112, name: 'Chicago Cubs', abbr: 'CHC' },
  { id: 145, name: 'Chicago White Sox', abbr: 'CWS' },
  { id: 113, name: 'Cincinnati Reds', abbr: 'CIN' },
  { id: 114, name: 'Cleveland Guardians', abbr: 'CLE' },
  { id: 115, name: 'Colorado Rockies', abbr: 'COL' },
  { id: 116, name: 'Detroit Tigers', abbr: 'DET' },
  { id: 117, name: 'Houston Astros', abbr: 'HOU' },
  { id: 118, name: 'Kansas City Royals', abbr: 'KC' },
  { id: 119, name: 'Los Angeles Angels', abbr: 'LAA' },
  { id: 108, name: 'Los Angeles Dodgers', abbr: 'LAD' },
  { id: 146, name: 'Miami Marlins', abbr: 'MIA' },
  { id: 158, name: 'Milwaukee Brewers', abbr: 'MIL' },
  { id: 142, name: 'Minnesota Twins', abbr: 'MIN' },
  { id: 121, name: 'New York Mets', abbr: 'NYM' },
  { id: 147, name: 'New York Yankees', abbr: 'NYY' },
  { id: 133, name: 'Sacramento Athletics', abbr: 'SAC' },
  { id: 143, name: 'Philadelphia Phillies', abbr: 'PHI' },
  { id: 134, name: 'Pittsburgh Pirates', abbr: 'PIT' },
  { id: 135, name: 'San Diego Padres', abbr: 'SD' },
  { id: 137, name: 'San Francisco Giants', abbr: 'SF' },
  { id: 136, name: 'Seattle Mariners', abbr: 'SEA' },
  { id: 138, name: 'St. Louis Cardinals', abbr: 'STL' },
  { id: 139, name: 'Tampa Bay Rays', abbr: 'TB' },
  { id: 140, name: 'Texas Rangers', abbr: 'TEX' },
  { id: 141, name: 'Toronto Blue Jays', abbr: 'TOR' },
  { id: 120, name: 'Washington Nationals', abbr: 'WSH' },
];

export const teamLogoUrl = (teamId) =>
  `https://www.mlbstatic.com/team-logos/${teamId}.svg`;

export const playerHeadshotUrl = (playerId) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,h_120,c_fill,d_people:generic:action:hero:650/d_people:generic:action:hero:650/v1/people/${playerId}/headshot/67/current`;

// Action shot – batter (vertical pose)
export const playerActionShotUrl = (playerId) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_240,c_fill,g_face/v1/people/${playerId}/action/vertical/current`;

// Action shot – pitcher (pitching pose)
export const pitcherActionShotUrl = (playerId) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_240,c_fill,g_face/v1/people/${playerId}/action/pitching/current`;

// Stadium infield background (prod-gameday.mlbstatic.com)
// Uses infield-full with "default" id — per the official gameday asset registry
export const stadiumInfieldUrl = () =>
  `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/stadiums/infield-full/default@2x.jpg`;

// Batter silhouette art: {cut}/{team:GENERIC}-{homeOrAway}-{stand}@2x.png
export const batterSilhouetteUrl = (stand = 'R', homeOrAway = 'home') =>
  `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/immortal/GENERIC-${homeOrAway}-${stand}@2x.png`;

export const FALLBACK_HEADSHOT = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23334155' rx='8'/%3E%3Ccircle cx='28' cy='20' r='9' fill='%2364748b'/%3E%3Cellipse cx='28' cy='44' rx='14' ry='10' fill='%2364748b'/%3E%3C/svg%3E`;

// ============================================
// BASE DIAMOND RENDERER (SVG)
// ============================================
export const renderBaseDiamond = (on1, on2, on3) => {
  const filled = '#f59e0b';
  const empty = '#1e293b';
  const stroke = '#475569';
  const glow = 'filter: drop-shadow(0 0 5px rgba(245,158,11,0.7))';

  return `
    <svg width="96" height="88" viewBox="0 0 96 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Baselines -->
      <line x1="14" y1="44" x2="48" y2="10" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="48" y1="10" x2="82" y2="44" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="82" y1="44" x2="48" y2="72" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="3,3" opacity="0.5"/>
      <line x1="48" y1="72" x2="14" y2="44" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="3,3" opacity="0.5"/>
      
      <!-- 2B (top) -->
      <rect x="39" y="1" width="18" height="18" rx="2" transform="rotate(45 48 10)" 
            fill="${on2 ? filled : empty}" stroke="${on2 ? filled : stroke}" stroke-width="1.5" 
            style="${on2 ? glow : ''}"/>
      
      <!-- 3B (left) -->
      <rect x="5" y="35" width="18" height="18" rx="2" transform="rotate(45 14 44)" 
            fill="${on3 ? filled : empty}" stroke="${on3 ? filled : stroke}" stroke-width="1.5" 
            style="${on3 ? glow : ''}"/>
      
      <!-- 1B (right) -->
      <rect x="73" y="35" width="18" height="18" rx="2" transform="rotate(45 82 44)" 
            fill="${on1 ? filled : empty}" stroke="${on1 ? filled : stroke}" stroke-width="1.5" 
            style="${on1 ? glow : ''}"/>
      
      <!-- Home plate -->
      <polygon points="48,80 40,72 43,63 53,63 56,72" fill="#334155" stroke="#475569" stroke-width="1.5"/>
      
      <!-- Labels -->
      <text x="48" y="6" text-anchor="middle" font-size="6.5" fill="#6b7280" font-family="monospace">2B</text>
      <text x="3" y="48" text-anchor="middle" font-size="6.5" fill="#6b7280" font-family="monospace">3B</text>
      <text x="93" y="48" text-anchor="middle" font-size="6.5" fill="#6b7280" font-family="monospace">1B</text>
    </svg>
  `;
};

// ============================================
// FULL ORIGINAL STRIKE ZONE (from mlb_gameday.html)
// ============================================
// opts.bgColor — override the outer rect fill (default '#070d17')
// opts.compact  — slightly smaller render
export const renderStrikeZone = (playEvents = [], szTop = 3.5, szBot = 1.5, opts = {}) => {
  const bgColor = opts.bgColor ?? '#070d17';
  const W = 220,
    H = 236;
  const padL = 26,
    padR = 8,
    padT = 12,
    padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xMin = -1.75,
    xMax = 1.75;
  const zMin = 0.4,
    zMax = 5.0;

  const toX = (px) => padL + ((px - xMin) / (xMax - xMin)) * plotW;
  const toY = (pz) => padT + plotH - ((pz - zMin) / (zMax - zMin)) * plotH;

  const hwPlate = 17 / 24;
  const zx1 = toX(-hwPlate),
    zx2 = toX(hwPlate);
  const zy1 = toY(szTop),
    zy2 = toY(szBot);
  const zw = zx2 - zx1,
    zh = zy2 - zy1;

  const gridLines = [1, 2]
    .flatMap((i) => [
      `<line x1="${(zx1 + (zw * i) / 3).toFixed(1)}" y1="${zy1.toFixed(1)}" x2="${(zx1 + (zw * i) / 3).toFixed(1)}" y2="${zy2.toFixed(1)}" stroke="#1e3a4c" stroke-width="0.75"/>`,
      `<line x1="${zx1.toFixed(1)}" y1="${(zy1 + (zh * i) / 3).toFixed(1)}" x2="${zx2.toFixed(1)}" y2="${(zy1 + (zh * i) / 3).toFixed(1)}" stroke="#1e3a4c" stroke-width="0.75"/>`,
    ])
    .join('\n');

  const pm = W / 2,
    py = H - 6;

  const pitchColor = (desc = '') => {
    const d = desc.toLowerCase();
    if (d.includes('called strike'))
      return { f: '#ef4444', s: '#fca5a5', g: '#ef444480' };
    if (d.includes('swinging strike'))
      return { f: '#f97316', s: '#fdba74', g: '#f9731680' };
    if (d.includes('in play'))
      return { f: '#eab308', s: '#fde047', g: '#eab30880' };
    if (d.includes('foul tip'))
      return { f: '#a78bfa', s: '#c4b5fd', g: '#a78bfa80' };
    if (d.includes('foul'))
      return { f: '#94a3b8', s: '#cbd5e1', g: '#94a3b840' };
    if (d.includes('ball'))
      return { f: '#4ade80', s: '#86efac', g: '#4ade8080' };
    if (d.includes('hit by'))
      return { f: '#c084fc', s: '#e9d5ff', g: '#c084fc80' };
    return { f: '#64748b', s: '#94a3b8', g: '#64748b40' };
  };

  const pitches = playEvents.filter(
    (e) => e.isPitch && e.pitchData?.coordinates?.pX != null,
  );

  const dots = pitches
    .map((p, i) => {
      const { f, s, g } = pitchColor(p.details?.description || '');
      const cx = toX(p.pitchData.coordinates.pX).toFixed(1);
      const cy = toY(p.pitchData.coordinates.pZ).toFixed(1);
      const isLast = i === pitches.length - 1;
      const op = isLast
        ? 1
        : Math.max(0.3, 0.3 + (i / Math.max(pitches.length - 1, 1)) * 0.7);
      const r = isLast ? 9 : 8;
      const code = p.details?.type?.code || '?';
      const mph = p.pitchData?.startSpeed
        ? Math.round(p.pitchData.startSpeed)
        : '';
      const desc = p.details?.description || '';
      const n = i + 1;
      return `<g opacity="${op.toFixed(2)}">
      <title>#${n} ${code}${mph ? ' ' + mph + 'mph' : ''} — ${desc}</title>
      <circle cx="${cx}" cy="${cy}" r="${r + (isLast ? 1.5 : 0)}" fill="${g}" stroke="none"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="${s}" stroke-width="${isLast ? 1.5 : 0.75}"/>
      <text x="${cx}" y="${(parseFloat(cy) + 3.5).toFixed(1)}" text-anchor="middle" font-size="6.5" font-family="monospace" font-weight="bold" fill="white">${n}</text>
    </g>`;
    })
    .join('\n');

  const noData =
    pitches.length === 0
      ? `<text x="${W / 2}" y="${zy1 + zh / 2 + 4}" text-anchor="middle" font-size="10" fill="#334155" font-family="sans-serif" font-style="italic">No pitches yet</text>`
      : '';

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect width="${W}" height="${H}" fill="${bgColor}" rx="8"/>
    <rect x="${(zx1 - 12).toFixed(1)}" y="${(zy1 - 10).toFixed(1)}" width="${(zw + 24).toFixed(1)}" height="${(zh + 20).toFixed(1)}" fill="none" stroke="#162032" stroke-width="1" rx="3" stroke-dasharray="4,3"/>
    <rect x="${zx1.toFixed(1)}" y="${zy1.toFixed(1)}" width="${zw.toFixed(1)}" height="${zh.toFixed(1)}" fill="#0c1c2e" rx="1"/>
    ${gridLines}
    <rect x="${zx1.toFixed(1)}" y="${zy1.toFixed(1)}" width="${zw.toFixed(1)}" height="${zh.toFixed(1)}" fill="none" stroke="#334155" stroke-width="1.5" rx="1"/>
    <line x1="${(W / 2).toFixed(1)}" y1="${(zy1 - 14).toFixed(1)}" x2="${(W / 2).toFixed(1)}" y2="${(py - 4).toFixed(1)}" stroke="#0f1f30" stroke-width="1" stroke-dasharray="3,4"/>
    <text x="${(padL - 3).toFixed(1)}" y="${(zy1 + 4).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#3f5068" font-family="monospace">${szTop.toFixed(1)}'</text>
    <text x="${(padL - 3).toFixed(1)}" y="${(zy2 + 4).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#3f5068" font-family="monospace">${szBot.toFixed(1)}'</text>
    <polygon points="${pm},${py + 13} ${pm - 9},${py + 6} ${pm - 9},${py} ${pm + 9},${py} ${pm + 9},${py + 6}" fill="#1e2d3d" stroke="#3b5268" stroke-width="1.5"/>
    ${dots}
    ${noData}
    <text x="${W / 2}" y="${H - 1}" text-anchor="middle" font-size="7" fill="#1e3148" font-family="sans-serif">catcher's view</text>
  </svg>`;
};

// ============================================
// EXTRA HELPERS (Optional but useful)
// ============================================
export const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const getTodayStr = () => {
  const t = new Date();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${m}/${d}/${t.getFullYear()}`;
};
