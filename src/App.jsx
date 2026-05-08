import { Routes, Route, NavLink } from 'react-router-dom';
import Scores from './pages/Scores';
import GameDay from './pages/GameDay';
import StatsApp from './pages/StatsApp';
import APIDocs from './pages/APIDocs';
import PlayerPage from './pages/PlayerPage';
import StatLeaders from './pages/StatLeaders';
import Standings from './pages/Standings';
import BaseballSimulator from './pages/BaseballSimulator';
import TeamPage from './pages/TeamPage';
import { Home, BarChart3, BookOpen, Trophy, TrendingUp, Cpu } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav id="main-nav" className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-x-2 sm:gap-x-3 flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center">
              <i className="fa-solid fa-baseball text-white text-base sm:text-xl"></i>
            </div>
            <div className="hidden xs:block">
              <div className="font-display text-xl sm:text-2xl tracking-tighter leading-none">
                MLB Live
              </div>
              <div className="text-[10px] text-slate-500">
                Vite + React
              </div>
            </div>
          </div>

          <div className="flex items-center gap-x-1 sm:gap-x-2">
            {[
              { to: '/', icon: <Home size={15} />, label: 'Scores' },
              { to: '/stats', icon: <BarChart3 size={15} />, label: 'Stats' },
              { to: '/leaders', icon: <TrendingUp size={15} />, label: 'Leaders' },
              { to: '/standings', icon: <Trophy size={15} />, label: 'Standings' },
              { to: '/simulator', icon: <Cpu size={15} />, label: 'Simulator' },
              { to: '/docs', icon: <BookOpen size={15} />, label: 'API Docs' },
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

          <div className="hidden sm:flex px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30 text-xs items-center gap-x-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            LIVE DATA
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Scores />} />
        <Route path="/game/:gamePk" element={<GameDay />} />
        <Route path="/stats" element={<StatsApp />} />
        <Route path="/leaders" element={<StatLeaders />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/simulator" element={<BaseballSimulator />} />
        <Route path="/docs" element={<APIDocs />} />
        <Route path="/player/:playerId" element={<PlayerPage />} />
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </div>
  );
}

export default App;
