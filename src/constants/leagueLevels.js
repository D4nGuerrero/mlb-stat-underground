export const LEAGUE_LEVEL_STORAGE_KEY = 'baseballLeagueLevel';

export const LEAGUE_LEVEL_OPTIONS = [
  { value: 'mlb', label: 'MLB', shortLabel: 'MLB', sportQuery: 'sportId=1', standingsQuery: 'leagueId=103,104', logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg' },
  { value: 'aaa', label: 'Triple-A', shortLabel: 'AAA', sportQuery: 'sportId=11', standingsQuery: 'leagueId=117,112', logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/milb-alt.svg' },
  { value: 'aa', label: 'Double-A', shortLabel: 'AA', sportQuery: 'sportId=12', standingsQuery: 'leagueId=113,111,109', logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/milb-alt.svg' },
  { value: 'high-a', label: 'High-A', shortLabel: 'A+', sportQuery: 'sportId=13', standingsQuery: 'leagueId=116,118,126', logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/milb-alt.svg' },
  { value: 'single-a', label: 'Single-A', shortLabel: 'A', sportQuery: 'sportId=14', standingsQuery: 'leagueId=122,123,110', logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/milb-alt.svg' },
  { value: 'rookie', label: 'Rookie', shortLabel: 'Rookie', sportQuery: 'sportId=16', standingsQuery: 'leagueId=121,124,130', logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/milb-alt.svg' },
  { value: 'lmb', label: 'Mexican League', shortLabel: 'LMB', sportQuery: 'sportId=23&leagueId=125', standingsQuery: 'leagueId=125', logo: 'https://www.mlbstatic.com/team-logos/732.svg' },
];

export const LEAGUE_LEVEL_BY_VALUE = Object.fromEntries(
  LEAGUE_LEVEL_OPTIONS.map((option) => [option.value, option]),
);

export const LEAGUE_LEVEL_VALUES = new Set(LEAGUE_LEVEL_OPTIONS.map((option) => option.value));
