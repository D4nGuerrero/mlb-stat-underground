import { Suspense, lazy } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { THEME_COLOR } from './theme/theme.js';
import { assetUrl } from './utils/baseUrl.js';
import { LoadingSpinner } from './components/ui';
import PwaUpdateToast from './components/PwaUpdateToast.jsx';
import { Home, BarChart3, Binoculars, TrendingUp, Cpu } from 'lucide-react';

const Scores = lazy(() => import('./pages/Scores.jsx'));
const GameDay = lazy(() => import('./pages/GameDay.jsx'));
const StatsApp = lazy(() => import('./pages/StatsApp.jsx'));
const APIDocs = lazy(() => import('./pages/APIDocs.jsx'));
const PlayerPage = lazy(() => import('./pages/PlayerPage.jsx'));
const StatLeaders = lazy(() => import('./pages/StatLeaders.jsx'));
const Standings = lazy(() => import('./pages/Standings.jsx'));
const BaseballSimulator = lazy(() => import('./pages/BaseballSimulator.jsx'));
const TeamPage = lazy(() => import('./pages/TeamPage.jsx'));
const Debug = lazy(() => import('./pages/Debug.jsx'));
const ProspectWatch = lazy(() => import('./pages/ProspectWatch.jsx'));
const DraftTracker = lazy(() => import('./pages/DraftTracker.jsx'));

function StandingsFlagIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M31.78 8.538a.833.833 0 0 0-.945-.247c-4.968 1.944-8.769.528-12.795-.969-3.682-1.371-7.479-2.775-12.182-1.542.157-.357.238-.743.238-1.133 0-1.573-1.28-2.853-2.853-2.853S.39 3.074.39 4.647 1.671 7.5 3.243 7.5c.116 0 .227-.02.339-.034l1.489 4.05 3.059 8.403a.93.93 0 0 0 .095.179l3.515 9.564a.83.83 0 0 0 1.064.495l.003-.001a.83.83 0 0 0 .493-1.065v-.001l-3.442-9.365c2.909-4.264 6.45-4.406 10.196-4.543 3.919-.143 8.361-.305 11.784-5.668a.831.831 0 0 0-.058-.976zM2.053 4.647a1.191 1.191 0 1 1 2.38-.097 1.191 1.191 0 0 1-2.38.097z"
      />
      <circle fill="currentColor" cx="3.243" cy="4.647" r="1.191" />
    </svg>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav id="main-nav" className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-x-2 sm:gap-x-3 flex-shrink-0">
              <img src={assetUrl('logo.png')} alt="MLB Live Logo" className="w-10 h-10" />
            <div className="hidden xs:block">
              <div className="font-display text-xl sm:text-2xl tracking-tighter leading-none">
                MLB Live
              </div>
              <div className={`nav-tagline-marquee text-${THEME_COLOR}-400`} aria-label="LET'S GOOOOO">
                <div className="nav-tagline-track">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i}>LET&apos;S GOOOOO</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-x-1 sm:gap-x-2 overflow-x-auto scrollbar-none">
            {[
              { to: '/', icon: <Home size={15} />, label: 'Scores' },
              { to: '/stats', icon: <BarChart3 size={15} />, label: 'Stats' },
              { to: '/leaders', icon: <TrendingUp size={15} />, label: 'Leaders' },
              { to: '/standings', icon: <StandingsFlagIcon />, label: 'Standings' },
              { to: '/simulator', icon: <Cpu size={15} />, label: 'Simulator' },
              { to: '/prospects', icon: <Binoculars size={15} />, label: 'Prospects' },
            ].map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-2.5 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-sm font-medium flex items-center gap-x-1.5 transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`
                }
              >
                {icon}
                
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </div>

          <div className={`hidden lg:flex px-3 py-1.5 bg-${THEME_COLOR}-500/10 text-${THEME_COLOR}-400 rounded-2xl border border-${THEME_COLOR}-500/30 text-xs items-center gap-x-1.5 flex-shrink-0`}>
            <div className={`w-1.5 h-1.5 bg-${THEME_COLOR}-400 rounded-full animate-pulse`} />
            LIVE DATA
          </div>
        </div>
      </nav>

      <Suspense fallback={<LoadingSpinner size="lg" py="py-16" />}>
        <Routes>
          <Route path="/" element={<Scores />} />
          <Route path="/game/:gamePk" element={<GameDay />} />
          <Route path="/stats" element={<StatsApp />} />
          <Route path="/leaders" element={<StatLeaders />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/simulator" element={<BaseballSimulator />} />
          <Route path="/prospects" element={<ProspectWatch />} />
          <Route path="/draft" element={<DraftTracker />} />
          <Route path="/draft/:year" element={<DraftTracker />} />
          <Route path="/docs" element={<APIDocs />} />
          <Route path="/debug" element={<Debug />} />
          <Route path="/player/:playerId" element={<PlayerPage />} />
          <Route path="/team/:teamId" element={<TeamPage />} />
        </Routes>
      </Suspense>
      <PwaUpdateToast />
    </div>
  );
}

export default App;
