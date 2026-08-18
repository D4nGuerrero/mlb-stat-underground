/**
 * Daily / official baseball games we surface from More → Games.
 * External entries open in a new tab. Internal routes stay in-app.
 */
export const BASEBALL_GAMES = [
  {
    id: 'simulator',
    to: '/simulator',
    label: 'Simulator',
    description: 'Play out games, series, and seasons',
    icon: 'cpu',
  },
  {
    id: 'pickle',
    href: 'https://www.mlb.com/play/games/pickle',
    label: 'MLB Pickle',
    description: 'Guess today’s mystery player in 9 tries',
    icon: 'search',
  },
  {
    id: 'immaculate-grid',
    href: 'https://www.immaculategrid.com/',
    label: 'Immaculate Grid',
    description: 'Fill a 3×3 with matching players',
    icon: 'grid',
  },
  {
    id: 'whos-that-guy',
    href: 'https://whosthatguy.app/',
    label: "Who's That Guy",
    description: 'Name the player from three career stats',
    icon: 'user',
  },
  {
    id: 'beat-the-streak',
    href: 'https://www.mlb.com/play',
    label: 'Beat the Streak',
    description: 'Official MLB pick-a-hitter streak game',
    icon: 'flame',
  },
  {
    id: 'savant-guess',
    href: 'https://baseballsavant.mlb.com/games/player-guess',
    label: "Who's That Player",
    description: 'Guess the player from a Savant photo',
    icon: 'camera',
  },
  {
    id: 'connections',
    href: 'https://www.baseball-connections.com/',
    label: 'Baseball Connections',
    description: 'Daily quizzes, pictures, and reverse grids',
    icon: 'link',
  },
  {
    id: 'diamond-trivia',
    href: 'https://www.diamondtrivia.app/',
    label: 'Diamond Trivia',
    description: 'Strikeout, higher/lower, and more daily modes',
    icon: 'sparkles',
  },
];
