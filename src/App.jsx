import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  Home,
  BarChart3,
  Binoculars,
  TrendingUp,
  Cpu,
  ClipboardList,
  FileText,
  Settings as SettingsIcon,
  MoreHorizontal,
} from 'lucide-react';
import { assetUrl } from './utils/baseUrl.js';
import { LoadingSpinner } from './components/ui';
import PwaUpdateToast from './components/PwaUpdateToast.jsx';
import { useTheme } from './context/ThemeContext.jsx';

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
const Settings = lazy(() => import('./pages/Settings.jsx'));

function StandingsFlagIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="currentColor"
        d="M31.78 8.538a.833.833 0 0 0-.945-.247c-4.968 1.944-8.769.528-12.795-.969-3.682-1.371-7.479-2.775-12.182-1.542.157-.357.238-.743.238-1.133 0-1.573-1.28-2.853-2.853-2.853S.39 3.074.39 4.647 1.671 7.5 3.243 7.5c.116 0 .227-.02.339-.034l1.489 4.05 3.059 8.403a.93.93 0 0 0 .095.179l3.515 9.564a.83.83 0 0 0 1.064.495l.003-.001a.83.83 0 0 0 .493-1.065v-.001l-3.442-9.365c2.909-4.264 6.45-4.406 10.196-4.543 3.919-.143 8.361-.305 11.784-5.668a.831.831 0 0 0-.058-.976zM2.053 4.647a1.191 1.191 0 1 1 2.38-.097 1.191 1.191 0 0 1-2.38.097z"
      />
      <circle fill="currentColor" cx="3.243" cy="4.647" r="1.191" />
    </svg>
  );
}

const PRIMARY_NAV = [
  { to: '/', icon: Home, label: 'Scores', end: true },
  { to: '/stats', icon: BarChart3, label: 'Stats' },
  { to: '/leaders', icon: TrendingUp, label: 'Leaders' },
  { to: '/standings', icon: StandingsFlagIcon, label: 'Standings', customIcon: true },
  { to: '/prospects', icon: Binoculars, label: 'Prospects' },
];

const MORE_NAV = [
  { to: '/simulator', icon: Cpu, label: 'Simulator', description: 'Play out games & seasons' },
  { to: '/draft', icon: ClipboardList, label: 'Draft Tracker', description: 'Browse draft classes' },
  { to: '/docs', icon: FileText, label: 'API Docs', description: 'Stats API reference' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', description: 'Theme & mobile nav' },
];

const MORE_PATHS = new Set(MORE_NAV.map((item) => item.to));

function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

function navLinkClass({ isActive }, { bottom = false, isDark = true } = {}) {
  if (bottom) {
    return [
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-bold tracking-wide transition-colors',
      isActive ? 'text-accent-300' : 'text-slate-500 active:text-slate-300',
    ].join(' ');
  }
  return [
    'px-2.5 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-sm font-medium flex items-center gap-x-1.5 transition-all',
    isActive
      ? isDark
        ? 'bg-white text-slate-900 shadow-sm'
        : 'bg-accent-500 text-white shadow-sm'
      : isDark
        ? 'hover:bg-slate-800 text-slate-300'
        : 'hover:bg-slate-200 text-slate-700',
  ].join(' ');
}

function BrandMark({ isDark }) {
  return (
    <div className="flex items-center gap-x-2 sm:gap-x-3 flex-shrink-0">
      <img src={assetUrl('logo.png')} alt="MLB Live Logo" className="w-9 h-9 sm:w-10 sm:h-10" />
      <div className="hidden xs:block min-w-0">
        <div className={`font-display text-xl sm:text-2xl tracking-tighter leading-none ${isDark ? '' : 'text-slate-900'}`}>
          MLB Live
        </div>
        <div className="nav-tagline-marquee text-accent-400" aria-label="LET'S GOOOOO">
          <div className="nav-tagline-track">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i}>LET&apos;S GOOOOO</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreMenu({ placement = 'top', moreActive = false, isDark = true }) {
  const location = useLocation();
  const isBottom = placement === 'bottom';

  return (
    <Menu as="div" className={isBottom ? 'relative flex min-w-0 flex-1' : 'relative flex-shrink-0'}>
      <MenuButton
        type="button"
        className={
          isBottom
            ? [
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-bold tracking-wide transition-colors',
                moreActive ? 'text-accent-300' : 'text-slate-500 active:text-slate-300',
              ].join(' ')
            : navLinkClass({ isActive: moreActive }, { isDark })
        }
        aria-label="More pages"
      >
        <MoreHorizontal size={isBottom ? 20 : 15} strokeWidth={isBottom ? 2.25 : 2} />
        <span className={isBottom ? '' : 'hidden sm:inline'}>More</span>
      </MenuButton>

      <MenuItems
        anchor={isBottom ? { to: 'top end', gap: 10 } : { to: 'bottom end', gap: 8 }}
        transition
        className={[
          'z-[60] w-64 rounded-2xl border p-1.5 shadow-2xl backdrop-blur focus:outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
          isDark
            ? 'border-slate-700 bg-slate-900/95 shadow-black/50'
            : 'border-slate-200 bg-white shadow-slate-300/40',
        ].join(' ')}
      >
        <div className="px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          More pages
        </div>
        {MORE_NAV.map(({ to, icon: Icon, label, description }) => {
          const active =
            location.pathname === to
            || (to !== '/' && location.pathname.startsWith(`${to}/`));
          return (
            <MenuItem key={to}>
              {({ focus, close }) => (
                <NavLink
                  to={to}
                  onClick={close}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
                    focus || active
                      ? isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                      : isDark ? 'text-slate-300' : 'text-slate-700',
                    active ? 'ring-1 ring-accent-500/30' : '',
                  ].join(' ')}
                >
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 text-accent-300 ${isDark ? 'bg-slate-950 ring-slate-700' : 'bg-slate-50 ring-slate-200'}`}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-bold leading-tight">{label}</span>
                    <span className="block text-[11px] text-slate-500 leading-snug">{description}</span>
                  </span>
                </NavLink>
              )}
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}

function TopNavBar({ showPrimaryLinks, moreActive, isDark }) {
  return (
    <nav
      id="main-nav"
      className={[
        'border-b backdrop-blur sticky top-0 z-50',
        isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white/95',
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 overflow-hidden">
        <BrandMark isDark={isDark} />

        {showPrimaryLinks ? (
          <div className="flex min-w-0 items-center gap-x-1 sm:gap-x-2 overflow-x-auto scrollbar-none">
            {PRIMARY_NAV.map(({ to, icon: Icon, label, end, customIcon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={(state) => navLinkClass(state, { isDark })}
              >
                {customIcon ? <Icon className="w-4 h-4" /> : <Icon size={15} />}
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
            <MoreMenu placement="top" moreActive={moreActive} isDark={isDark} />
          </div>
        ) : (
          <div className="hidden sm:flex px-3 py-1.5 bg-accent-500/10 text-accent-400 rounded-2xl border border-accent-500/30 text-xs items-center gap-x-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-pulse" />
            LIVE DATA
          </div>
        )}

        {showPrimaryLinks && (
          <div className="hidden lg:flex px-3 py-1.5 bg-accent-500/10 text-accent-400 rounded-2xl border border-accent-500/30 text-xs items-center gap-x-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-pulse" />
            LIVE DATA
          </div>
        )}
      </div>
    </nav>
  );
}

function BottomNavBar({ moreActive, isDark }) {
  return (
    <nav
      id="bottom-nav"
      className={[
        'fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden',
        isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white/95',
      ].join(' ')}
    >
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch px-1">
        {PRIMARY_NAV.map(({ to, icon: Icon, label, end, customIcon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={(state) => navLinkClass(state, { bottom: true, isDark })}
          >
            {customIcon ? <Icon className="h-5 w-5" /> : <Icon size={20} strokeWidth={2.25} />}
            <span className="truncate max-w-full">{label}</span>
          </NavLink>
        ))}
        <MoreMenu placement="bottom" moreActive={moreActive} isDark={isDark} />
      </div>
    </nav>
  );
}

function App() {
  const { isDark, isBottomNav, hideTopBar } = useTheme();
  const isMobile = useIsMobileLayout();
  const location = useLocation();
  const useBottomChrome = isBottomNav && isMobile;
  // Only hide the top bar when bottom tabs are actually showing (mobile + bottom setting).
  const showTopBar = !(useBottomChrome && hideTopBar);

  const moreActive = useMemo(() => {
    const path = location.pathname;
    if (MORE_PATHS.has(path)) return true;
    return [...MORE_PATHS].some((base) => base !== '/' && path.startsWith(`${base}/`));
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.dataset.navChrome = useBottomChrome ? 'bottom' : 'top';
    document.documentElement.dataset.hideTopBar = showTopBar ? 'false' : 'true';
  }, [useBottomChrome, showTopBar]);

  return (
    <div
      className={[
        'min-h-screen transition-colors',
        isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-900',
        useBottomChrome
          ? 'has-bottom-nav pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]'
          : '',
      ].join(' ')}
    >
      {showTopBar && (
        <TopNavBar
          showPrimaryLinks={!useBottomChrome}
          moreActive={moreActive}
          isDark={isDark}
        />
      )}

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
          <Route path="/settings" element={<Settings />} />
          <Route path="/player/:playerId" element={<PlayerPage />} />
          <Route path="/team/:teamId" element={<TeamPage />} />
        </Routes>
      </Suspense>

      {useBottomChrome && <BottomNavBar moreActive={moreActive} isDark={isDark} />}
      <PwaUpdateToast />
    </div>
  );
}

export default App;
