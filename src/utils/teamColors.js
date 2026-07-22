export const MLB_TEAM_COLORS = {
  108: { primary: '#BA0021', secondary: '#003263', accents: ['#862633', '#C4CED4', '#FFFFFF'] },
  109: { primary: '#A71930', secondary: '#E3D4AD', accents: ['#30CED8', '#000000', '#FFFFFF'] },
  110: { primary: '#DF4601', secondary: '#000000', accents: ['#FFFFFF'] },
  111: { primary: '#BD3039', secondary: '#0C2340', accents: ['#FFFFFF'] },
  112: { primary: '#0E3386', secondary: '#CC3433', accents: ['#FFFFFF'] },
  113: { primary: '#C6011F', secondary: '#000000', accents: ['#FFFFFF'] },
  114: { primary: '#00385D', secondary: '#E50022', accents: ['#FFFFFF'] },
  115: { primary: '#33006F', secondary: '#C4CED4', accents: ['#000000', '#FFFFFF'] },
  116: { primary: '#0C2340', secondary: '#FA4616', accents: ['#FFFFFF'] },
  117: { primary: '#002D62', secondary: '#EB6E1F', accents: ['#F4911E', '#FFFFFF'] },
  118: { primary: '#004687', secondary: '#BD9B60', accents: ['#FFFFFF'] },
  119: { primary: '#005A9C', secondary: '#EF3E42', accents: ['#FFFFFF'] },
  120: { primary: '#AB0003', secondary: '#14225A', accents: ['#FFFFFF'] },
  121: { primary: '#002D72', secondary: '#FF5910', accents: ['#FFFFFF'] },
  133: { primary: '#003831', secondary: '#EFB21E', accents: ['#A2AAAD', '#FFFFFF'] },
  134: { primary: '#27251F', secondary: '#FDB827', accents: ['#FFFFFF'] },
  135: { primary: '#2F241D', secondary: '#FFC425', accents: ['#FFFFFF'] },
  136: { primary: '#0C2C56', secondary: '#005C5C', accents: ['#C4CED4', '#D50032', '#FFFFFF'] },
  137: { primary: '#FD5A1E', secondary: '#27251F', accents: ['#EFD19F', '#AE8F6F', '#FFFFFF'] },
  138: { primary: '#C41E3A', secondary: '#0C2340', accents: ['#FEDB00', '#FFFFFF'] },
  139: { primary: '#092C5C', secondary: '#8FBCE6', accents: ['#F5D130', '#FFFFFF'] },
  140: { primary: '#003278', secondary: '#C0111F', accents: ['#FFFFFF'] },
  141: { primary: '#134A8E', secondary: '#1D2D5C', accents: ['#E8291C', '#FFFFFF'] },
  142: { primary: '#002B5C', secondary: '#D31145', accents: ['#B9975B', '#FFFFFF'] },
  143: { primary: '#E81828', secondary: '#002D72', accents: ['#FFFFFF'] },
  144: { primary: '#CE1141', secondary: '#13274F', accents: ['#EAAA00', '#FFFFFF'] },
  145: { primary: '#27251F', secondary: '#C4CED4', accents: ['#FFFFFF'] },
  146: { primary: '#00A3E0', secondary: '#EF3340', accents: ['#41748D', '#000000', '#FFFFFF'] },
  147: { primary: '#0C2340', secondary: '#C4CED3', accents: ['#E4002C', '#FFFFFF'] },
  158: { primary: '#12284B', secondary: '#FFC52F', accents: ['#FFFFFF'] },
};

export const NEUTRAL_TEAM_COLOR = '#94A3B8';

export function getTeamColorPalette(teamId) {
  const colors = MLB_TEAM_COLORS[Number(teamId)];
  if (!colors) {
    return {
      primary: NEUTRAL_TEAM_COLOR,
      secondary: '#CBD5E1',
      accents: ['#38BDF8', '#FBBF24'],
    };
  }

  return colors;
}

export function getTeamColorList(teamId, { includeNeutral = false } = {}) {
  const palette = getTeamColorPalette(teamId);
  const colors = [palette.primary, palette.secondary, ...(palette.accents ?? [])];
  return includeNeutral ? colors : colors.filter((color) => !isNeutralColor(color));
}

export function getTeamFireworkColorList(teamId) {
  const chromaticColors = getTeamColorList(teamId);
  if (chromaticColors.length) return chromaticColors;

  // fireworks-js cannot render true black/white/gray because it only accepts
  // hue ranges, so neutral-heavy teams get a cool-white sparkle approximation.
  return ['#E0F2FE'];
}

export function isNeutralColor(hex) {
  const normalized = String(hex).replace('#', '').trim().toUpperCase();
  return normalized === 'FFFFFF' ||
    normalized === '000000' ||
    normalized === '27251F' ||
    normalized === '2F241D' ||
    normalized === 'C4CED4' ||
    normalized === 'C4CED3' ||
    normalized === 'A2AAAD' ||
    normalized === 'CBD5E1' ||
    normalized === '94A3B8';
}
