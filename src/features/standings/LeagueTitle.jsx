import { useTheme } from '../../context/ThemeContext.jsx';
import { leagueKeyFromName } from '../../utils/standings';

const LEAGUE_LOGOS = {
  AL: {
    dark: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/159.svg',
    light: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/159.svg',
  },
  NL: {
    dark: 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/160.svg',
    light: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/160.svg',
  },
};

export default function LeagueTitle({ title, className = '', variant = 'inline' }) {
  const { isDark } = useTheme();
  const leagueKey = leagueKeyFromName(title);
  const logos = leagueKey ? LEAGUE_LOGOS[leagueKey] : null;
  const logoSrc = logos ? (isDark ? logos.dark : logos.light) : null;

  if (variant === 'banner') {
    return (
      <div className={`flex items-center justify-between gap-3 ${className}`}>
        <h2 className="font-display text-[1.65rem] leading-none tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        {logoSrc && (
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-10 flex-shrink-0 object-contain sm:h-12 sm:w-12"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {logoSrc && (
        <img
          src={logoSrc}
          alt=""
          className="h-5 w-5 flex-shrink-0 object-contain"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <span>{title}</span>
    </span>
  );
}
