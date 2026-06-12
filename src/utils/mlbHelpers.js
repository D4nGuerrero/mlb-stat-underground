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
  { id: 108, name: 'Los Angeles Angels', abbr: 'LAA' },
  { id: 119, name: 'Los Angeles Dodgers', abbr: 'LAD' },
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

const TEAM_ABBR_BY_ID = Object.fromEntries(mlbTeams.map((t) => [t.id, t.abbr]));

/** Resolve a 3-letter team abbreviation from a team object or team id. */
export function getTeamAbbr(teamOrId) {
  if (teamOrId == null) return '—';
  if (typeof teamOrId === 'number') return TEAM_ABBR_BY_ID[teamOrId] ?? '—';
  if (typeof teamOrId === 'string' && /^\d+$/.test(teamOrId)) {
    return TEAM_ABBR_BY_ID[Number(teamOrId)] ?? '—';
  }
  const team = teamOrId;
  if (!team?.id) return team?.abbreviation ?? '—';
  return team.abbreviation ?? TEAM_ABBR_BY_ID[team.id] ?? team.name?.split(' ').pop() ?? '—';
}

// export const teamLogoUrl = (teamId) =>
//   `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`;




const BASE_URL = 'https://www.mlbstatic.com/team-logos';

/**
 * Get MLB team logo URL
 * @param {number|string} teamId 
 * @param {object} options
 * @param {boolean} options.preferDark - true = try cap-on-dark first (default)
 * @param {boolean} options.forceRegular - force regular logo (overrides preferDark)
 */
export const teamLogoUrl = (teamId, options = {}) => {
  const { preferDark = true, forceRegular = false } = options;
  const id = String(teamId).trim();

  if (!id) return '';

  // Teams that look better with the regular (non-cap) logo
  const regularPreferredTeams = new Set([
    110, // Baltimore Orioles
    121, // New York Mets
    134, // Pittsburgh Pirates
    138, // St. Louis Cardinals
    141, // Toronto Blue Jays
    // Add more teams here as you find them
  ]);

  const shouldUseRegular = forceRegular || regularPreferredTeams.has(Number(id));

  if (shouldUseRegular) {
    return `${BASE_URL}/${id}.svg`;
  }

  // Default: cap-on-dark
  return `${BASE_URL}/team-cap-on-dark/${id}.svg`;
};
  

// export const playerHeadshotUrl = (playerId) =>
// `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`



// use this instead: https://midfield.mlbstatic.com/v1/people/673962/silo/240
export const playerHeadshotUrl = (playerId, type = 1) => {

  if(type == 1) {
    return `https://midfield.mlbstatic.com/v1/people/${playerId}/silo/240`
  }

  // https://midfield.mlbstatic.com/v1/people/624413/spots/120

  if(type == 2) {
    return `https://midfield.mlbstatic.com/v1/people/${playerId}/spots/120`
  }

}

// Hero shot – batter (horizontal pose)
export const playerHeroShotUrl = (playerId) =>
`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/q_auto:good,w_2208/v1/people/${playerId}/action/hero/current`

// Action shot – batter (vertical pose)
export const playerActionShotUrl = (playerId) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_240,c_fill,g_face/v1/people/${playerId}/action/vertical/current`;


// Action shot – pitcher (pitching pose)
export const pitcherActionShotUrl = (playerId) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_240,c_fill,g_face/v1/people/${playerId}/action/pitching/current`;


// Stadium exterior background (prod-gameday.mlbstatic.com) venue id parameter, day/night needs parameter
export const stadiumExteriorUrl = (venueId, timeOfDay = 'day') =>
    `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/stadiums/${timeOfDay}/${venueId}@2x.jpg`

/** Pick day vs night exterior asset from official game date (local browser time). */
export const stadiumTimeOfDay = (gameDateStr) => {
  if (!gameDateStr) return 'day';
  const d = new Date(gameDateStr);
  if (Number.isNaN(d.getTime())) return 'day';
  const h = d.getHours();
  return h >= 18 || h < 7 ? 'night' : 'day';
};


// Stadium infield background (prod-gameday.mlbstatic.com)
// Uses infield-full with "default" id — per the official gameday asset registry
export const stadiumInfieldUrl = () =>
  `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/stadiums/infield-full/default@2x.jpg`;

// Batter silhouette art: {cut}/{team:GENERIC}-{homeOrAway}-{stand}@2x.png
export const batterSilhouetteUrl = (stand = 'R', homeOrAway = 'home') =>
  `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/immortal/GENERIC-${homeOrAway}-${stand}@2x.png`;

/** Plate stance art (cut = in-box); falls back to immortal via onError in UI. */
export const batterPlateUrl = (stand = 'R', homeOrAway = 'home') =>
  `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/cut/GENERIC-${homeOrAway}-${stand}@2x.png`;

export const batterPlateFallbackUrl = (stand = 'R', homeOrAway = 'home') =>
  batterSilhouetteUrl(stand, homeOrAway);

// Stadium exterior background (prod-gameday.mlbstatic.com)
const getStadiumUrl = (venueId, timeOfDay = 'day') => {
  return `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/stadiums/${timeOfDay}/${venueId}@2x.jpg`;
};

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
// UPDATED renderStrikeZone — MLB At Bat aesthetic
// Drop-in replacement for the version in mlbHelpers.js
// Used for static play-detail sheets (not the live canvas).
// ============================================

// opts.bgColor    — outer rect fill (default transparent)
// opts.compact    — tighter padding
export const renderStrikeZone = (playEvents = [], szTop = 3.5, szBot = 1.5, opts = {}) => {
  const W = 220, H = 240;
  const PAD_L = 36, PAD_R = 20, PAD_T = 18, PAD_B = 36;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const bgColor = opts.bgColor ?? 'transparent';

  const X_RANGE = 2.0;
  const Z_MIN = 0.5, Z_MAX = 5.5;

  const toX = (x) => PAD_L + ((x + X_RANGE) / (2 * X_RANGE)) * plotW;
  const toZ = (z) => PAD_T + plotH - ((z - Z_MIN) / (Z_MAX - Z_MIN)) * plotH;

  const hw = (17 / 12) / 2; // half plate width in feet
  const szX1 = toX(-hw), szX2 = toX(hw);
  const szY1 = toZ(szTop), szY2 = toZ(szBot);
  const zw = szX2 - szX1, zh = szY2 - szY1;

  // Grid
  const gridLines = [1, 2].flatMap((i) => [
    `<line x1="${(szX1 + zw * i / 3).toFixed(1)}" y1="${szY1.toFixed(1)}" x2="${(szX1 + zw * i / 3).toFixed(1)}" y2="${szY2.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="0.75"/>`,
    `<line x1="${szX1.toFixed(1)}" y1="${(szY1 + zh * i / 3).toFixed(1)}" x2="${szX2.toFixed(1)}" y2="${(szY1 + zh * i / 3).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="0.75"/>`,
  ]).join('');

  // Pitch color by result
  const pitchColor = (desc = '', typeCode = '') => {
    const d = desc.toLowerCase();
    const TYPE_COLORS = {
      FF: '#FF3B2F', FT: '#FF5A1F', FC: '#FF8C00', FS: '#FF4500', SI: '#FF5A1F',
      SL: '#007AFF', CU: '#5856D6', KC: '#6E5DB8', SV: '#00C3E0',
      CH: '#34C759', EP: '#30D158', KN: '#FFD60A',
    };
    const base = TYPE_COLORS[typeCode] || null;
    if (d.includes('called strike')) return { f: '#FF3B30', s: '#FF6B61', g: 'rgba(255,59,48,0.35)' };
    if (d.includes('swinging strike')) return { f: '#FF9500', s: '#FFB84D', g: 'rgba(255,149,0,0.35)' };
    if (d.includes('in play')) return { f: '#FFD60A', s: '#FFE566', g: 'rgba(255,214,10,0.35)' };
    if (d.includes('foul')) return { f: '#636366', s: '#8E8E93', g: 'rgba(99,99,102,0.25)' };
    if (d.includes('ball')) return { f: '#30D158', s: '#6DDC87', g: 'rgba(48,209,88,0.3)' };
    if (d.includes('hit by')) return { f: '#BF5AF2', s: '#D28CF7', g: 'rgba(191,90,242,0.35)' };
    if (base) return { f: base, s: base, g: `${base}55` };
    return { f: '#636366', s: '#8E8E93', g: 'rgba(99,99,102,0.25)' };
  };

  const pitches = playEvents.filter(
    (e) => e.isPitch && e.pitchData?.coordinates?.pX != null
  );

  const dots = pitches.map((p, i) => {
    const { f, s, g } = pitchColor(
      p.details?.description || '',
      p.details?.type?.code || ''
    );
    const cx = toX(p.pitchData.coordinates.pX).toFixed(1);
    const cy = toZ(p.pitchData.coordinates.pZ).toFixed(1);
    const isLast = i === pitches.length - 1;
    const opacity = isLast ? 1 : Math.max(0.35, 0.35 + (i / Math.max(pitches.length - 1, 1)) * 0.55);
    const r = isLast ? 9 : 7.5;
    const n = i + 1;
    const mph = p.pitchData?.startSpeed ? Math.round(p.pitchData.startSpeed) : '';
    const typeCode = p.details?.type?.code || '?';
    return `
    <g opacity="${opacity.toFixed(2)}">
      <title>#${n} ${typeCode}${mph ? ' ' + mph + 'mph' : ''} — ${p.details?.description || ''}</title>
      <circle cx="${cx}" cy="${cy}" r="${(r + 5).toFixed(1)}" fill="${g}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="${s}" stroke-width="${isLast ? 1.5 : 1}"/>
      ${isLast ? `<circle cx="${(parseFloat(cx) - r * 0.28).toFixed(1)}" cy="${(parseFloat(cy) - r * 0.28).toFixed(1)}" r="${(r * 0.3).toFixed(1)}" fill="rgba(255,255,255,0.4)"/>` : ''}
      <text x="${cx}" y="${(parseFloat(cy) + 3.5).toFixed(1)}" text-anchor="middle" font-size="6.5" font-family="-apple-system,sans-serif" font-weight="700" fill="white">${n}</text>
    </g>`;
  }).join('');

  // Home plate
  const pm = W / 2;
  const py = H - PAD_B + 12;

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect width="${W}" height="${H}" fill="${bgColor}" rx="10"/>

    <!-- Strike zone background -->
    <rect x="${szX1.toFixed(1)}" y="${szY1.toFixed(1)}" width="${zw.toFixed(1)}" height="${zh.toFixed(1)}"
          fill="rgba(255,255,255,0.03)" rx="1"/>

    <!-- Grid -->
    ${gridLines}

    <!-- Strike zone border -->
    <rect x="${szX1.toFixed(1)}" y="${szY1.toFixed(1)}" width="${zw.toFixed(1)}" height="${zh.toFixed(1)}"
          fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" rx="1"
          filter="url(#szglow)"/>

    <!-- Height labels -->
    <text x="${(szX1 - 5).toFixed(1)}" y="${(szY1 + 4).toFixed(1)}" text-anchor="end"
          font-size="8" fill="rgba(255,255,255,0.3)" font-family="-apple-system,sans-serif"
          font-weight="600">${szTop.toFixed(1)}'</text>
    <text x="${(szX1 - 5).toFixed(1)}" y="${(szY2 + 4).toFixed(1)}" text-anchor="end"
          font-size="8" fill="rgba(255,255,255,0.3)" font-family="-apple-system,sans-serif"
          font-weight="600">${szBot.toFixed(1)}'</text>

    <!-- Home plate -->
    <polygon points="${pm},${py + 9} ${pm - 8},${py + 4} ${pm - 8},${py - 3} ${pm + 8},${py - 3} ${pm + 8},${py + 4}"
             fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>

    <!-- Pitches -->
    ${dots}

    ${pitches.length === 0
      ? `<text x="${W / 2}" y="${szY1 + zh / 2 + 4}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.15)" font-family="-apple-system,sans-serif">No pitches yet</text>`
      : ''}

    <!-- Label -->
    <text x="${W / 2}" y="${H - 3}" text-anchor="middle" font-size="7.5"
          fill="rgba(255,255,255,0.14)" font-family="-apple-system,sans-serif"
          font-weight="500" letter-spacing="0.08em">CATCHER'S VIEW</text>
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

/** Inning columns for linescore (minimum 9, includes extra innings). */
export const getLinescoreInningNums = (linescore) => {
  const fromApi = linescore?.innings?.map((i) => i.num) ?? [];
  const max = Math.max(9, linescore?.currentInning ?? 0, ...fromApi, 0);
  return Array.from({ length: max }, (_, i) => i + 1);
};

/** Convert baseball IP (e.g. "6.1" = 6⅓) to outs. */
export const ipToOuts = (ip) => {
  if (ip == null || ip === '') return 0;
  const [whole, frac = '0'] = String(ip).split('.');
  return parseInt(whole, 10) * 3 + parseInt(frac, 10);
};

/** Convert outs back to baseball IP notation. */
export const outsToIp = (outs, alwaysShowTenths = false) => {
  const whole = Math.floor(outs / 3);
  const frac = outs % 3;
  if (frac === 0 && !alwaysShowTenths) return String(whole);
  return `${whole}.${frac}`;
};

/** Sum innings pitched using baseball arithmetic (6.1 + 3.2 = 10.0, not 9.3). */
export const sumInningsPitched = (values, { alwaysShowTenths = true } = {}) => {
  const totalOuts = (values ?? []).reduce((sum, ip) => sum + ipToOuts(ip), 0);
  return outsToIp(totalOuts, alwaysShowTenths);
};

/** "FINAL" or "FINAL/12" when a game ended after the 9th. */
export const formatFinalStatus = (linescore) => {
  if (!linescore) return 'FINAL';
  const nums = linescore.innings?.map((i) => i.num) ?? [];
  const count = Math.max(
    linescore.currentInning ?? 0,
    nums.length ? Math.max(...nums) : 0,
  );
  return count > 9 ? `FINAL/${count}` : 'FINAL';
};
