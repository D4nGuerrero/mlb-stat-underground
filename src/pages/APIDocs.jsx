import { useState, useEffect, useRef } from 'react';

// ─── NAV SECTIONS ──────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',      label: '📘 Overview',               group: null },
  { id: 'base-url',      label: '🌐 Base URL & Versioning',  group: null },
  { id: 'config',        label: '⚙️  Config Endpoints',       group: null },
  { id: 'schedule',      label: 'Schedule',                  group: '🏟️ Game' },
  { id: 'game',          label: 'Game Feed (GUMBO)',          group: '🏟️ Game' },
  { id: 'boxscore',      label: 'Boxscore',                  group: '🏟️ Game' },
  { id: 'linescore',     label: 'Linescore',                 group: '🏟️ Game' },
  { id: 'play-by-play',  label: 'Play-by-Play',              group: '🏟️ Game' },
  { id: 'highlights',    label: 'Highlights',                group: '🏟️ Game' },
  { id: 'game-pace',     label: 'Game Pace',                 group: '🏟️ Game' },
  { id: 'people',        label: 'People / Players',          group: '🧑 People & Teams' },
  { id: 'teams',         label: 'Teams',                     group: '🧑 People & Teams' },
  { id: 'roster',        label: 'Roster',                    group: '🧑 People & Teams' },
  { id: 'venues',        label: 'Venues',                    group: '🧑 People & Teams' },
  { id: 'media',         label: 'Media & Image Assets',      group: '🧑 People & Teams' },
  { id: 'player-stats',  label: 'Player Stats',              group: '📊 Stats' },
  { id: 'team-stats',    label: 'Team Stats',                group: '📊 Stats' },
  { id: 'stat-leaders',  label: 'Stat Leaders',              group: '📊 Stats' },
  { id: 'standings',     label: 'Standings',                 group: '📊 Stats' },
  { id: 'sports',        label: 'Sports & Leagues',          group: '📊 Stats' },
  { id: 'attendance',    label: 'Attendance',                group: '📊 Stats' },
  { id: 'awards',        label: 'Awards',                    group: '📊 Stats' },
  { id: 'transactions',  label: 'Transactions',              group: '📊 Stats' },
  { id: 'draft',         label: 'Draft',                     group: '📊 Stats' },
  { id: 'homerunderby',  label: 'HR Derby',                  group: '📊 Stats' },
  { id: 'highlow',       label: 'High / Low Records',        group: '📊 Stats' },
  { id: 'gumbo-struct',  label: 'GUMBO Structure',           group: '🔬 Data Structures' },
  { id: 'hitdata',       label: 'hitData / pitchData',       group: '🔬 Data Structures' },
  { id: 'hydration',     label: 'Hydration System',          group: '🔬 Data Structures' },
];

// ─── CONFIG ENDPOINTS (all no-param GETs) ─────────────────────────────────
const CONFIG_ENDPOINTS = [
  { path: '/v1/baseballStats',          desc: 'All supported baseball stat keys' },
  { path: '/v1/eventTypes',             desc: 'Play event type codes' },
  { path: '/v1/gameStatus',             desc: 'Game status codes (Final, In Progress…)' },
  { path: '/v1/gameTypes',              desc: 'Game type codes (R=regular, P=postseason…)' },
  { path: '/v1/hitTrajectories',        desc: 'Trajectory codes (ground_ball, fly_ball…)' },
  { path: '/v1/leagueLeaderTypes',      desc: 'Valid leaderCategories for stats/leaders' },
  { path: '/v1/logicalEvents',          desc: 'Logical game event types' },
  { path: '/v1/metrics',                desc: 'Statcast metric definitions' },
  { path: '/v1/pitchCodes',             desc: 'Pitch result codes (B=ball, S=strike…)' },
  { path: '/v1/pitchTypes',             desc: 'Pitch type codes (FF, SL, CH, CU…)' },
  { path: '/v1/playerStatusCodes',      desc: 'Player status (Active, DL, Retired…)' },
  { path: '/v1/positions',              desc: 'All fielding positions with codes' },
  { path: '/v1/reviewReasons',          desc: 'Challenge/review reason codes' },
  { path: '/v1/rosterTypes',            desc: 'Roster type identifiers (25man, 40man…)' },
  { path: '/v1/runnerDetailTypes',      desc: 'Baserunner movement detail types' },
  { path: '/v1/situationCodes',         desc: 'Situation code mappings' },
  { path: '/v1/standingsTypes',         desc: 'Standings type options (regularSeason…)' },
  { path: '/v1/statGroups',             desc: 'Stat group names (hitting, pitching…)' },
  { path: '/v1/statTypes',              desc: 'Stat type names (season, career…)' },
  { path: '/v1/windDirection',          desc: 'Wind direction codes for weather data' },
  { path: '/v1/windSpeed',              desc: 'Wind speed category codes' },
  { path: '/v1/sky',                    desc: 'Sky/weather condition codes' },
  { path: '/v1/awards',                 desc: 'All award definitions' },
  { path: '/v1/jobTypes',               desc: 'Umpire / staff job type codes' },
  { path: '/v1/languages',              desc: 'Supported language codes for responses' },
  { path: '/v1/platforms',              desc: 'Broadcast platform codes' },
];

// ─── PARAM TABLE HELPER ────────────────────────────────────────────────────
const ParamRow = ({ name, type, req, desc }) => (
  <tr className="border-t border-slate-800">
    <td className="py-2 pr-3 align-top">
      <code className="text-emerald-400 text-xs font-mono">{name}</code>
      {req && (
        <span className="ml-1.5 text-[10px] text-red-400 font-semibold">required</span>
      )}
    </td>
    <td className="py-2 pr-3 align-top">
      <span className="text-[11px] text-blue-300 font-mono">{type}</span>
    </td>
    <td className="py-2 align-top text-xs text-slate-400">{desc}</td>
  </tr>
);

// ─── COLLAPSIBLE ENDPOINT CARD ─────────────────────────────────────────────
const EndpointCard = ({ method = 'GET', path, summary, description, params, example, response, notes }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fullUrl = example?.startsWith('http') ? example : `https://statsapi.mlb.com/api${example ?? path}`;

  const copy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const methodColor = {
    GET: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    POST: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    PUT: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  }[method] ?? 'bg-slate-700 text-slate-300';

  return (
    <div className="border border-slate-700 rounded-2xl overflow-hidden mb-3">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-slate-800/40 transition-colors"
      >
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 font-mono ${methodColor}`}>
          {method}
        </span>
        <code className="text-sm text-slate-200 font-mono flex-1 truncate">{path}</code>
        {summary && <span className="text-xs text-slate-500 hidden sm:block truncate max-w-xs">{summary}</span>}
        <span className="text-slate-500 flex-shrink-0 ml-auto text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-slate-800 space-y-4">
          {description && <p className="text-sm text-slate-300">{description}</p>}

          {/* Example URL + copy */}
          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 flex items-start gap-2">
            <code className="text-xs text-blue-300 font-mono flex-1 break-all">{fullUrl}</code>
            <button
              onClick={copy}
              className={`flex-shrink-0 text-[11px] px-3 py-1 rounded-lg font-semibold transition-all ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* Params */}
          {params?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parameters</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[400px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase">
                      <th className="pb-1.5 pr-3 font-medium">Name</th>
                      <th className="pb-1.5 pr-3 font-medium">Type</th>
                      <th className="pb-1.5 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map((p) => (
                      <ParamRow key={p.name} {...p} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Response preview */}
          {response && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Response Shape</div>
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">{response}</pre>
            </div>
          )}
          {notes?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</div>
              <ul className="space-y-1">
                {notes.map((n, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-emerald-500 flex-shrink-0">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SECTION WRAPPER ───────────────────────────────────────────────────────
const Section = ({ id, title, badge, children }) => (
  <section id={id} className="mb-12 scroll-mt-6">
    <div className="flex items-center gap-3 mb-5">
      <h2 className="font-display text-2xl sm:text-3xl tracking-tight">{title}</h2>
      {badge && (
        <span className="text-xs px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono">
          {badge}
        </span>
      )}
    </div>
    {children}
  </section>
);

// ─── FIELD ROW for data structure tables ──────────────────────────────────
const FieldRow = ({ field, type, desc }) => (
  <tr className="border-t border-slate-800">
    <td className="py-2 pr-3 align-top">
      <code className="text-yellow-300 text-xs font-mono">{field}</code>
    </td>
    <td className="py-2 pr-3 align-top">
      <span className="text-blue-300 text-xs font-mono">{type}</span>
    </td>
    <td className="py-2 text-xs text-slate-400 align-top">{desc}</td>
  </tr>
);

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function APIDocs() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const mainRef = useRef(null);

  const scrollToSection = (id) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    const els = document.querySelectorAll('section[id]');
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Group nav items
  const grouped = [];
  let currentGroup = null;
  NAV.forEach((item) => {
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      if (item.group) grouped.push({ type: 'group', label: item.group });
    }
    grouped.push({ type: 'item', ...item });
  });

  const SidebarContent = () => (
    <nav className="space-y-0.5 text-sm">
      {grouped.map((item, i) =>
        item.type === 'group' ? (
          <div key={i} className="text-[10px] text-slate-600 font-bold uppercase tracking-widest pt-4 pb-1 px-3">
            {item.label}
          </div>
        ) : (
          <button
            key={item.id}
            onClick={() => scrollToSection(item.id)}
            className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
              activeSection === item.id
                ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ),
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl fixed top-0 h-full overflow-y-auto z-10 pt-4 pb-8">
        <div className="px-5 pb-4 border-b border-slate-800 mb-2">
          <div className="font-display text-lg tracking-tight">MLB Stats API</div>
          <div className="text-xs text-emerald-400 mt-0.5">v1.0 · No Authentication Required</div>
        </div>
        <div className="px-3 flex-1 overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>

      {/* ── MOBILE DRAWER ───────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 bg-slate-900 border-r border-slate-700 transform transition-transform duration-300 lg:hidden flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-display text-lg tracking-tight">MLB Stats API</div>
            <div className="text-xs text-emerald-400">v1.0 · No Auth Required</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarContent />
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main ref={mainRef} className="flex-1 lg:ml-64 xl:ml-72 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <span className="block w-4 h-0.5 bg-white mb-1" />
            <span className="block w-4 h-0.5 bg-white mb-1" />
            <span className="block w-3 h-0.5 bg-white" />
          </button>
          <div className="text-sm font-medium">MLB Stats API Docs</div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          <Section id="overview" title="MLB Stats API">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                The MLB Stats API is a publicly accessible REST API serving live and historical
                baseball data. It powers mlb.com and most third-party applications. No API key
                or authentication is required.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Base URL', val: 'https://statsapi.mlb.com/api' },
                  { label: 'Live Feed', val: 'https://statsapi.mlb.com/api/v1.1' },
                  { label: 'WebSocket', val: 'wss://ws.statsapi.mlb.com/api' },
                  { label: 'Auth Required', val: 'No' },
                  { label: 'Rate Limit', val: 'Undocumented (be respectful)' },
                  { label: 'Format', val: 'JSON' },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-500 font-medium">{label}</span>
                    <code className="text-emerald-400 font-mono text-xs">{val}</code>
                  </div>
                ))}
              </div>
              <p className="text-slate-400 text-xs">
                Resources with <code className="text-yellow-300">hydrate=</code> parameters support
                embedding related objects in a single request (e.g.,{' '}
                <code className="text-blue-300">hydrate=stats,team,awards</code>), avoiding multiple
                round trips.
              </p>
            </div>
          </Section>

          {/* ── BASE URL & VERSIONING ─────────────────────────────────── */}
          <Section id="base-url" title="Base URL & Versioning">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr className="text-[11px] text-slate-500 uppercase">
                      <th className="px-4 py-2.5 text-left font-medium">Version</th>
                      <th className="px-4 py-2.5 text-left font-medium">Base URL</th>
                      <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      { v: 'v1', url: 'https://statsapi.mlb.com/api/v1', note: 'Most endpoints live here' },
                      { v: 'v1.1', url: 'https://statsapi.mlb.com/api/v1.1', note: 'Live game feed (GUMBO) — recommended for real-time data' },
                      { v: 'WebSocket', url: 'wss://ws.statsapi.mlb.com/api/v1.1', note: 'Push updates for live game feed diffPatch' },
                    ].map(({ v, url, note }) => (
                      <tr key={v} className="text-xs">
                        <td className="px-4 py-3 font-mono text-yellow-300">{v}</td>
                        <td className="px-4 py-3">
                          <code className="text-blue-300 break-all">{url}</code>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* ── CONFIG ENDPOINTS ──────────────────────────────────────── */}
          <Section id="config" title="Configuration Endpoints" badge="No Parameters">
            <p className="text-sm text-slate-400 mb-4">
              These reference/lookup endpoints require no parameters and return static configuration
              data. They're useful for populating dropdowns or validating values before building
              other requests.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONFIG_ENDPOINTS.map(({ path, desc }) => {
                const [copied, setCopied] = useState(false);
                const url = `https://statsapi.mlb.com/api${path}`;
                const copy = () => {
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                };
                return (
                  <div key={path} className="bg-slate-900 border border-slate-700 rounded-2xl p-3 flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <code className="text-emerald-400 text-xs font-mono block truncate">{path}</code>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">{desc}</span>
                    </div>
                    <button
                      onClick={copy}
                      className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all opacity-0 group-hover:opacity-100 ${
                        copied ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── SCHEDULE ──────────────────────────────────────────────── */}
          <Section id="schedule" title="Schedule">
            <p className="text-sm text-slate-400 mb-4">
              Retrieve game schedules by date, team, season, or game type. The response includes
              game PKs required for all other game endpoints.
            </p>
            <EndpointCard
              path="/v1/schedule"
              summary="Get game schedule"
              description="Returns games matching the query. Use gamePk values from this endpoint with all game-specific routes."
              example="https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=04/28/2026&hydrate=team,linescore,decisions,person"
              params={[
                { name: 'sportId', type: 'integer', req: true, desc: 'Sport identifier. Use 1 for MLB.' },
                { name: 'date', type: 'string', desc: 'Single date in MM/DD/YYYY format.' },
                { name: 'startDate', type: 'string', desc: 'Range start in MM/DD/YYYY. Use with endDate.' },
                { name: 'endDate', type: 'string', desc: 'Range end in MM/DD/YYYY.' },
                { name: 'season', type: 'string', desc: 'Four-digit year. Returns full season schedule.' },
                { name: 'teamId', type: 'integer', desc: 'Filter to games involving a specific team.' },
                { name: 'gameType', type: 'string', desc: 'R=regular, P=postseason, S=spring training, A=all-star, D=division series, L=LCS, W=world series.' },
                { name: 'hydrate', type: 'string', desc: 'Embed related data: team, linescore, decisions, venue, weather, person, probablePitcher, stats, broadcasts.' },
              ]}
              response={`{
  "dates": [{
    "date": "2026-04-28",
    "games": [{
      "gamePk": 746954,
      "gameType": "R",
      "status": { "detailedState": "Final" },
      "teams": {
        "home": { "team": { "id": 147, "name": "New York Yankees" }, "score": 5 },
        "away": { "team": { "id": 140, "name": "Texas Rangers" }, "score": 3 }
      },
      "venue": { "id": 3313, "name": "Yankee Stadium" }
    }]
  }]
}`}
            />

            <EndpointCard
              path="/v1/schedule/postseason/series"
              summary="Postseason bracket"
              description="Returns the full postseason series bracket with round-by-round matchups."
              example="https://statsapi.mlb.com/api/v1/schedule/postseason/series?season=2025&sportId=1"
              params={[
                { name: 'season', type: 'string', req: true, desc: 'Season year.' },
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'gameType', type: 'string', desc: 'Postseason round: D, L, or W.' },
              ]}
            />
          </Section>

          {/* ── GAME FEED (GUMBO) ─────────────────────────────────────── */}
          <Section id="game" title="Live Game Feed (GUMBO)">
            <p className="text-sm text-slate-400 mb-4">
              GUMBO (Grand Unified Master Baseball Object) is the real-time play-by-play data
              structure. It returns the full game state including every pitch, hit, and run.
              Use <code className="text-blue-300 font-mono">v1.1</code> for the live feed.
            </p>
            <EndpointCard
              path="/v1.1/game/{gamePk}/feed/live"
              summary="Full GUMBO live feed"
              description="Returns complete game data including all plays, events, pitch data, hit data, weather, and venue info. This is the primary endpoint for detailed game analysis."
              example="https://statsapi.mlb.com/api/v1.1/game/746954/feed/live"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key from /v1/schedule.' },
                { name: 'timecode', type: 'string', desc: 'Filter to game state at a specific time: YYYYMMDD_HHMMSS.' },
                { name: 'fields', type: 'string', desc: 'Comma-separated field filter to trim response size.' },
              ]}
              response={`{
  "gameData": {
    "game": { "pk": 746954, "type": "R", "doubleHeader": "N" },
    "status": { "detailedState": "In Progress", "statusCode": "I" },
    "teams": { "home": {...}, "away": {...} },
    "players": { "ID592450": { "fullName": "Aaron Judge", ... } },
    "venue": { "id": 3313, "name": "Yankee Stadium" },
    "weather": { "condition": "Clear", "temp": "72", "wind": "7 mph, Out To CF" }
  },
  "liveData": {
    "plays": {
      "currentPlay": { ... },
      "allPlays": [ ... ],
      "scoringPlays": [12, 15, 22],
      "playsByInning": [...]
    },
    "linescore": { ... },
    "boxscore": { ... },
    "decisions": { "winner": {...}, "loser": {...}, "save": {...} }
  }
}`}
            />

            <EndpointCard
              path="/v1.1/game/{gamePk}/feed/live/diffPatch"
              summary="Delta updates (push streaming)"
              description="Returns only the changes since a given timecode. Use with the WebSocket URL for efficient real-time updates without re-fetching the full feed."
              example="https://statsapi.mlb.com/api/v1.1/game/746954/feed/live/diffPatch?startTimecode=20260428_200000&endTimecode=20260428_201500"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
                { name: 'startTimecode', type: 'string', req: true, desc: 'Start time YYYYMMDD_HHMMSS.' },
                { name: 'endTimecode', type: 'string', desc: 'End time YYYYMMDD_HHMMSS. Defaults to now.' },
              ]}
            />

            <EndpointCard
              path="/v1.1/game/{gamePk}/feed/live/timestamps"
              summary="All valid timestamps for a game"
              description="Returns every timecode at which the game state changed. Use these to replay a game at any point in time."
              example="https://statsapi.mlb.com/api/v1.1/game/746954/feed/live/timestamps"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
              ]}
            />
          </Section>

          {/* ── BOXSCORE ──────────────────────────────────────────────── */}
          <Section id="boxscore" title="Boxscore">
            <EndpointCard
              path="/v1/game/{gamePk}/boxscore"
              summary="Full game boxscore"
              description="Returns the complete boxscore with batting orders, pitching lines, fielding stats, game notes, and umpires."
              example="https://statsapi.mlb.com/api/v1/game/746954/boxscore"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
                { name: 'fields', type: 'string', desc: 'Comma-separated field filter.' },
              ]}
              response={`{
  "teams": {
    "home": {
      "battingOrder": [592450, 664034, ...],
      "players": {
        "ID592450": {
          "stats": { "batting": { "atBats": 4, "hits": 2, "homeRuns": 1 } },
          "position": { "code": "8", "name": "Center Field" }
        }
      },
      "pitchers": [...],
      "note": "a-Batted for Smith in 7th"
    }
  },
  "officials": [{ "official": {...}, "officialType": "Home Plate" }]
}`}
            />
          </Section>

          {/* ── LINESCORE ─────────────────────────────────────────────── */}
          <Section id="linescore" title="Linescore">
            <EndpointCard
              path="/v1/game/{gamePk}/linescore"
              summary="Inning-by-inning linescore"
              description="Returns runs/hits/errors per inning plus current game state (balls, strikes, outs, inning, runners on base)."
              example="https://statsapi.mlb.com/api/v1/game/746954/linescore"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
                { name: 'timecode', type: 'string', desc: 'Point-in-time snapshot YYYYMMDD_HHMMSS.' },
              ]}
              response={`{
  "currentInning": 7,
  "currentInningOrdinal": "7th",
  "inningState": "Top",
  "balls": 1, "strikes": 2, "outs": 1,
  "innings": [{ "num": 1, "home": { "runs": 2, "hits": 3, "errors": 0 }, "away": {...} }],
  "teams": { "home": { "runs": 5, "hits": 8, "errors": 0 }, "away": {...} },
  "offense": { "batter": {...}, "onFirst": {...}, "onSecond": null }
}`}
            />
          </Section>

          {/* ── PLAY BY PLAY ──────────────────────────────────────────── */}
          <Section id="play-by-play" title="Play-by-Play">
            <EndpointCard
              path="/v1/game/{gamePk}/playByPlay"
              summary="All plays / at-bats"
              description="Returns every at-bat with full event arrays including pitch-by-pitch data, hit data, and baserunner movements."
              example="https://statsapi.mlb.com/api/v1/game/746954/playByPlay"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
                { name: 'timecode', type: 'string', desc: 'Point-in-time snapshot.' },
                { name: 'fields', type: 'string', desc: 'Comma-separated field filter.' },
              ]}
              response={`{
  "allPlays": [{
    "result": { "type": "atBat", "event": "Home Run", "description": "...", "rbi": 1 },
    "about": { "atBatIndex": 0, "halfInning": "top", "inning": 1, "isScoringPlay": true },
    "matchup": {
      "batter": { "id": 592450, "fullName": "Aaron Judge" },
      "pitcher": { "id": 605483, "fullName": "Shane McClanahan" },
      "batSide": { "code": "R" }, "pitchHand": { "code": "L" }
    },
    "playEvents": [
      { "type": "pitch", "pitchData": { "startSpeed": 96.3, ... }, "details": { "type": { "code": "FF" } } },
      { "type": "pitch", "hitData": { "launchSpeed": 114.2, "launchAngle": 27 } }
    ]
  }]
}`}
            />
          </Section>

          {/* ── HIGHLIGHTS ────────────────────────────────────────────── */}
          <Section id="highlights" title="Highlights">
            <EndpointCard
              path="/v1/game/{gamePk}/content"
              summary="Game content (highlights, editorial)"
              description="Returns video highlights, editorial recap, and media links for a completed game."
              example="https://statsapi.mlb.com/api/v1/game/746954/content"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
              ]}
            />
            <EndpointCard
              path="/v1/game/{gamePk}/contextMetrics"
              summary="Win probability & leverage index"
              description="Returns win probability, leverage index, and other contextual metrics per play."
              example="https://statsapi.mlb.com/api/v1/game/746954/contextMetrics"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game primary key.' },
              ]}
            />
          </Section>

          {/* ── GAME PACE ─────────────────────────────────────────────── */}
          <Section id="game-pace" title="Game Pace">
            <p className="text-sm text-slate-400 mb-4">
              Analytics around game duration, pace-of-play metrics, and pitch clock data.
            </p>
            <EndpointCard
              path="/v1/gamePace"
              summary="Pace-of-play statistics"
              description="Returns pace-of-play statistics per team or league — average game time, time per pitch, pitches per game, etc."
              example="https://statsapi.mlb.com/api/v1/gamePace?season=2025&sportId=1&teamIds=147"
              params={[
                { name: 'season', type: 'string', req: true, desc: 'Four-digit year.' },
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'teamIds', type: 'integer', desc: 'Filter to a specific team.' },
                { name: 'leagueId', type: 'integer', desc: '103 = AL, 104 = NL.' },
                { name: 'leagueListId', type: 'string', desc: 'Named league list (e.g., mlb_hist).' },
                { name: 'startDate', type: 'string', desc: 'Filter start date MM/DD/YYYY.' },
                { name: 'endDate', type: 'string', desc: 'Filter end date MM/DD/YYYY.' },
              ]}
            />
          </Section>

          {/* ── PEOPLE / PLAYERS ──────────────────────────────────────── */}
          <Section id="people" title="People / Players">
            <EndpointCard
              path="/v1/people/search"
              summary="Search players by name"
              description="Find a player's personId by name. Returns the closest match(es). Use the id for all other people endpoints."
              example="https://statsapi.mlb.com/api/v1/people/search?names=Aaron%20Judge&sportIds=1"
              params={[
                { name: 'names', type: 'string', req: true, desc: 'Full or partial player name.' },
                { name: 'sportIds', type: 'integer', desc: 'Filter by sport. Use 1 for MLB.' },
                { name: 'active', type: 'boolean', desc: 'true = active players only.' },
              ]}
            />
            <EndpointCard
              path="/v1/people/{personId}"
              summary="Player bio / profile"
              description="Returns full player profile including position, birth date, height/weight, draft year, and MLB debut. Hydrate stats, awards, and more."
              example="https://statsapi.mlb.com/api/v1/people/592450?hydrate=stats(group=[hitting,pitching],type=[season],season=2026),awards,transactions,rosterEntries,education"
              params={[
                { name: 'personId', type: 'integer', req: true, desc: "Player's unique MLB personId." },
                { name: 'hydrate', type: 'string', desc: 'stats, awards, transactions, rosterEntries, education, social, relatives, draft, espnId.' },
                { name: 'fields', type: 'string', desc: 'Comma-separated field filter.' },
              ]}
            />
            <EndpointCard
              path="/v1/people/{personId}/stats"
              summary="Player statistics"
              description="Fetches season, career, or split stats for a player. Combine multiple stat groups in one call."
              example="https://statsapi.mlb.com/api/v1/people/592450/stats?stats=season,career&season=2026&group=hitting,fielding"
              params={[
                { name: 'personId', type: 'integer', req: true, desc: "Player's personId." },
                { name: 'stats', type: 'string', req: true, desc: 'season, career, yearByYear, gameLog, byDateRange, sabermetrics, pitchArsenal, vsTeam, vsTeamTotal, statSplits.' },
                { name: 'group', type: 'string', req: true, desc: 'hitting, pitching, fielding.' },
                { name: 'season', type: 'string', desc: 'Four-digit year (required for season type).' },
                { name: 'gameType', type: 'string', desc: 'R, P, S, or A.' },
                { name: 'startDate', type: 'string', desc: 'Range start MM/DD/YYYY.' },
                { name: 'endDate', type: 'string', desc: 'Range end MM/DD/YYYY.' },
                { name: 'opposingTeamId', type: 'integer', desc: 'Splits vs a specific team.' },
                { name: 'opposingPlayerId', type: 'integer', desc: 'Pitcher vs batter splits.' },
                { name: 'sitCodes', type: 'string', desc: 'Comma-separated situation codes (see statSplits endpoint below for full list).' },
              ]}
            />
            <EndpointCard
              path="/v1/people/{personId}/stats (statSplits)"
              summary="Player situation splits — batting order, vs hand, home/away, day/night"
              description={`Returns per-situation stat splits for a player using stats=statSplits and sitCodes. Batting order codes b1–b9 reveal how many ABs/PA a player accumulated in each lineup spot this season — essential for realistic lineup construction. Use these to answer: "Who actually bats leadoff for this team?"

Key sitCodes:
  b1–b9  → Batting order position (1st through 9th)
  vl     → vs. LHP (vs left-handed pitcher)
  vr     → vs. RHP (vs right-handed pitcher)
  d      → Day games
  n      → Night games
  h      → Home games
  a      → Away games

Example: Ian Kinsler 2012 season — b1 shows 500+ ABs batting leadoff for TEX, while Elvis Andrus had only 23 ABs there — so Kinsler bats first.`}
              example="https://statsapi.mlb.com/api/v1/people/285078/stats?stats=statSplits&sitCodes=b1,b2,b3,b4,b5,b6,b7,b8,b9,vl,vr,d,n,h,a&season=2012&group=hitting"
              params={[
                { name: 'personId', type: 'integer', req: true, desc: "Player's personId." },
                { name: 'stats', type: 'string', req: true, desc: 'Must be statSplits.' },
                { name: 'sitCodes', type: 'string', req: true, desc: 'b1,b2,b3,b4,b5,b6,b7,b8,b9 for batting order slots. vl/vr for vs hand. d/n for day/night. h/a for home/away. Combine freely.' },
                { name: 'season', type: 'string', req: true, desc: 'Season year (e.g. 2026, 2012).' },
                { name: 'group', type: 'string', req: true, desc: 'hitting or pitching.' },
              ]}
              notes={[
                'Each split in the response has split.code matching the sitCode you requested.',
                'stat.atBats (or stat.plateAppearances) tells you volume in that situation.',
                'Assign lineup slots by whichever player has the most ABs in that slot — volume beats pure rate stats.',
                'If two players are within 15% AB volume for a slot, break the tie with vl/vr OPS matching the opposing starter\'s hand.',
                'Players new to a team or call-ups may have 0 ABs in all slots — fall back to sabermetric OPS ordering for them.',
              ]}
            />
            <EndpointCard
              path="/v1/people/{personId}/gameLog"
              summary="Game-by-game log"
              description="Returns per-game stats for a player throughout a season."
              example="https://statsapi.mlb.com/api/v1/people/592450/gameLog?season=2026&group=hitting"
              params={[
                { name: 'personId', type: 'integer', req: true, desc: "Player's personId." },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'group', type: 'string', desc: 'hitting, pitching, or fielding.' },
              ]}
            />
          </Section>

          {/* ── TEAMS ─────────────────────────────────────────────────── */}
          <Section id="teams" title="Teams">
            <EndpointCard
              path="/v1/teams"
              summary="List all teams"
              description="Returns all teams for a given sport. Use sportId=1 for all 30 MLB clubs."
              example="https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026&hydrate=venue,division,league"
              params={[
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'leagueIds', type: 'integer', desc: '103 = AL, 104 = NL.' },
                { name: 'divisionId', type: 'integer', desc: 'Filter by division (200, 201, 202, 203, 204, 205).' },
                { name: 'hydrate', type: 'string', desc: 'venue, division, league, sport, nextSchedule, previousSchedule.' },
              ]}
            />
            <EndpointCard
              path="/v1/teams/{teamId}"
              summary="Team details"
              description="Returns full info for a single team including abbreviation, venue, league, and division."
              example="https://statsapi.mlb.com/api/v1/teams/147?hydrate=venue,social"
              params={[
                { name: 'teamId', type: 'integer', req: true, desc: 'Unique MLB team ID.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'hydrate', type: 'string', desc: 'venue, social, division, league.' },
              ]}
            />
            <EndpointCard
              path="/v1/teams/{teamId}/stats"
              summary="Team statistics"
              description="Returns aggregate season stats for a team."
              example="https://statsapi.mlb.com/api/v1/teams/147/stats?stats=season&season=2026&group=hitting"
              params={[
                { name: 'teamId', type: 'integer', req: true, desc: 'Team ID.' },
                { name: 'stats', type: 'string', req: true, desc: 'season, career, etc.' },
                { name: 'group', type: 'string', req: true, desc: 'hitting, pitching, fielding.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
              ]}
            />
          </Section>

          {/* ── ROSTER ────────────────────────────────────────────────── */}
          <Section id="roster" title="Roster">
            <EndpointCard
              path="/v1/teams/{teamId}/roster"
              summary="Team roster"
              description="Returns current or historical roster for a team. Use rosterType to get different roster types."
              example="https://statsapi.mlb.com/api/v1/teams/147/roster?season=2026&rosterType=active&hydrate=person(stats(group=[hitting],type=[season],season=2026))"
              params={[
                { name: 'teamId', type: 'integer', req: true, desc: 'Team ID.' },
                { name: 'season', type: 'string', desc: 'Season year. Defaults to current.' },
                { name: 'rosterType', type: 'string', desc: 'active (26-man), fullSeason, 40Man, nonRosterInvitees, fullRoster.' },
                { name: 'date', type: 'string', desc: 'Historical snapshot date MM/DD/YYYY.' },
                { name: 'hydrate', type: 'string', desc: 'person, stats.' },
              ]}
            />
          </Section>

          {/* ── VENUES ────────────────────────────────────────────────── */}
          <Section id="venues" title="Venues">
            <EndpointCard
              path="/v1/venues"
              summary="List venues"
              description="Returns information about stadiums/parks including location, surface, capacity, and dimensions."
              example="https://statsapi.mlb.com/api/v1/venues?sportId=1&hydrate=location,fieldInfo,timezone"
              params={[
                { name: 'venueIds', type: 'integer', desc: 'Comma-separated venue IDs.' },
                { name: 'sportId', type: 'integer', desc: 'Filter by sport.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'hydrate', type: 'string', desc: 'location, fieldInfo, timezone, xwsData.' },
              ]}
            />
          </Section>

          {/* ── MEDIA & IMAGE ASSETS ──────────────────────────────────── */}
          <Section id="media" title="Media & Image Assets">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-5 text-sm text-amber-300">
              <strong>⚠️ Unofficial CDN URLs</strong> — These image URLs are not part of the official MLB Stats API
              documentation but are widely used in practice. They are served from MLB's CDN infrastructure
              (<code className="font-mono text-amber-200">mlbstatic.com</code> / <code className="font-mono text-amber-200">mlbstatic.com</code>)
              and work without authentication. URLs may change without notice.
            </div>

            {/* Team logos */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Team Logos</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono">SVG · No Auth</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                  <code className="text-blue-300 text-xs font-mono break-all">
                    https://www.mlbstatic.com/team-logos/{'{teamId}'}.svg
                  </code>
                </div>
                <p className="text-sm text-slate-400">
                  Returns the primary team logo as an SVG. The <code className="text-yellow-300 font-mono">teamId</code> comes
                  from <code className="text-blue-300 font-mono">/v1/teams</code> or any endpoint returning team objects.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="text-[10px] text-slate-600 uppercase">
                        <th className="pb-1.5 pr-3 text-left font-medium">Team</th>
                        <th className="pb-1.5 pr-3 text-left font-medium">teamId</th>
                        <th className="pb-1.5 text-left font-medium">Example URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['New York Yankees', '147', 'https://www.mlbstatic.com/team-logos/147.svg'],
                        ['Los Angeles Dodgers', '119', 'https://www.mlbstatic.com/team-logos/119.svg'],
                        ['Boston Red Sox', '111', 'https://www.mlbstatic.com/team-logos/111.svg'],
                      ].map(([name, id, url]) => (
                        <tr key={id} className="border-t border-slate-800">
                          <td className="py-2 pr-3 text-xs text-slate-300">{name}</td>
                          <td className="py-2 pr-3"><code className="text-yellow-300 text-xs font-mono">{id}</code></td>
                          <td className="py-2"><code className="text-blue-300 text-xs font-mono">{url}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-slate-500">
                  All 30 MLB team IDs: 108 (LAD), 109 (ARI), 110 (BAL), 111 (BOS), 112 (CHC), 113 (CIN), 114 (CLE),
                  115 (COL), 116 (DET), 117 (HOU), 118 (KC), 119 (LAA), 120 (WSH), 121 (NYM), 133 (SAC),
                  134 (PIT), 135 (SD), 136 (SEA), 137 (SF), 138 (STL), 139 (TB), 140 (TEX), 141 (TOR),
                  142 (MIN), 143 (PHI), 144 (ATL), 145 (CWS), 146 (MIA), 147 (NYY), 158 (MIL).
                </div>
              </div>
            </div>

            {/* Player headshots */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Player Headshots</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg font-mono">JPG · Cloudinary CDN</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                  <code className="text-blue-300 text-xs font-mono break-all">
                    https://img.mlbstatic.com/mlb-photos/image/upload/w_120,h_120,c_fill,d_people:generic:action:hero:650/d_people:generic:action:hero:650/v1/people/{'{personId}'}/headshot/67/current
                  </code>
                </div>
                <p className="text-sm text-slate-400">
                  Standard <strong>120×120</strong> headshot for any player. The <code className="text-yellow-300 font-mono">personId</code> is the
                  same ID used in all Stats API people endpoints. Falls back to a generic silhouette if
                  no photo exists (the <code className="text-blue-300 font-mono">d_people:generic...</code> parameter handles this).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="text-[10px] text-slate-600 uppercase">
                        <th className="pb-1.5 pr-3 text-left font-medium">Transform</th>
                        <th className="pb-1.5 text-left font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['w_120,h_120,c_fill', 'Crop to 120×120 square — standard headshot size'],
                        ['w_240,h_240,c_fill', 'Double resolution for high-DPI displays'],
                        ['w_60,h_60,c_fill', 'Compact 60×60 for dense list views'],
                        ['w_320,h_320,c_fill', 'Large display — profile pages'],
                        ['d_people:generic:action:hero:650', 'Fallback to generic silhouette if no photo'],
                        ['/67/current', 'Photo type: 67 = headshot (vs. 68 = action shot)'],
                      ].map(([t, d]) => (
                        <tr key={t} className="border-t border-slate-800">
                          <td className="py-2 pr-3"><code className="text-yellow-300 text-xs font-mono">{t}</code></td>
                          <td className="py-2 text-xs text-slate-400">{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                  <div className="text-xs text-slate-500 mb-1.5">Example — Aaron Judge (personId 592450):</div>
                  <code className="text-blue-300 text-xs font-mono break-all">
                    https://img.mlbstatic.com/mlb-photos/image/upload/w_120,h_120,c_fill,d_people:generic:action:hero:650/d_people:generic:action:hero:650/v1/people/592450/headshot/67/current
                  </code>
                </div>
              </div>
            </div>

            {/* Action photos */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Player Action Photos</span>
                <span className="text-[10px] px-2 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg font-mono">JPG · type 68</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                  <code className="text-blue-300 text-xs font-mono break-all">
                    https://img.mlbstatic.com/mlb-photos/image/upload/w_640,h_360,c_fill,d_people:generic:action:hero:650/v1/people/{'{personId}'}/headshot/68/current
                  </code>
                </div>
                <p className="text-sm text-slate-400">
                  Wide-format action/hero shot. Type <code className="text-yellow-300 font-mono">68</code> returns
                  action photos vs <code className="text-yellow-300 font-mono">67</code> which is the circular headshot.
                  Recommended dimensions: 640×360 (16:9) or 480×270.
                </p>
              </div>
            </div>

            {/* Game highlights / video */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Game Highlight Videos & Thumbnails</span>
                <span className="text-[10px] px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-lg font-mono">via /game/{'{pk}'}/content</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-400">
                  The <code className="text-blue-300 font-mono">/v1/game/{'{gamePk}'}/content</code> endpoint returns video
                  highlight objects. Each highlight contains multiple renditions (qualities) and a thumbnail image.
                </p>
                <pre className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">{`// From /v1/game/{gamePk}/content → highlights.live.items[]
{
  "type": "video",
  "title": "Judge crushes a 456-ft HR",
  "description": "...",
  "duration": "0:34",
  "image": {
    "cuts": [
      { "width": 2208, "height": 1242, "src": "https://img.mlb.com/..." },
      { "width": 1920, "height": 1080, "src": "https://img.mlb.com/..." },
      { "width": 640,  "height": 360,  "src": "https://img.mlb.com/..." }
    ]
  },
  "playbacks": [
    { "name": "mp4Avc",  "url": "https://mediax.mlb.com/AAEAABl5...mp4",  "width": "1920", "height": "1080" },
    { "name": "hlsCloud","url": "https://mediax.mlb.com/AAEAABl5...m3u8" }
  ]
}`}</pre>
                <p className="text-sm text-slate-400">
                  The <code className="text-blue-300 font-mono">playbacks[].url</code> values are direct MP4 or HLS
                  stream URLs. Use <code className="text-yellow-300 font-mono">name === "hlsCloud"</code> for adaptive
                  streaming or <code className="text-yellow-300 font-mono">name === "mp4Avc"</code> for direct playback.
                </p>
              </div>
            </div>

            {/* Broadcast feeds */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Broadcast / Network Logos</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-400">
                  Broadcast network info is available via the <code className="text-yellow-300 font-mono">broadcasts</code> hydration on schedule endpoints.
                  This returns the network name (e.g., "YES", "ESPN", "Fox") but not logo URLs — you'll need to map
                  these to your own assets or a third-party broadcast icon library.
                </p>
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                  <code className="text-blue-300 text-xs font-mono break-all">
                    https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=04/28/2025&hydrate=broadcasts
                  </code>
                </div>
                <pre className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">{`// From schedule → dates[].games[].broadcasts[]
[
  { "id": 1, "name": "YES", "type": "TV", "isNational": false, "homeAway": "home", "language": "en" },
  { "id": 5, "name": "ESPN", "type": "TV", "isNational": true, "homeAway": "both", "language": "en" }
]`}</pre>
              </div>
            </div>

            {/* Venue photos */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Venue / Stadium Images</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-400">
                  There is no official documented URL pattern for stadium photos. MLB.com embeds ballpark images
                  using internal asset IDs not exposed in the Stats API. For stadium imagery, use the
                  <code className="text-blue-300 font-mono mx-1">/v1/venues?hydrate=fieldInfo</code> endpoint for
                  field dimensions and surface data, and source stadium photos from a third-party service
                  (e.g., Wikimedia Commons, Google Places Photos API).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="text-[10px] text-slate-600 uppercase">
                        <th className="pb-1.5 pr-3 text-left font-medium">Field</th>
                        <th className="pb-1.5 pr-3 text-left font-medium">Type</th>
                        <th className="pb-1.5 text-left font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['fieldInfo.capacity', 'integer', 'Seating capacity'],
                        ['fieldInfo.turfType', 'string', '"Grass" or "Artificial Turf"'],
                        ['fieldInfo.roofType', 'string', '"Open", "Dome", "Retractable"'],
                        ['fieldInfo.leftLine', 'integer', 'Left field line distance (feet)'],
                        ['fieldInfo.leftCenter', 'integer', 'Left-center gap distance (feet)'],
                        ['fieldInfo.center', 'integer', 'Center field distance (feet)'],
                        ['fieldInfo.rightCenter', 'integer', 'Right-center gap distance (feet)'],
                        ['fieldInfo.rightLine', 'integer', 'Right field line distance (feet)'],
                        ['location.city', 'string', 'City name'],
                        ['location.state', 'string', 'State / province'],
                        ['location.defaultCoordinates', 'object', 'latitude + longitude for mapping'],
                        ['timeZone', 'object', 'id, offset, tz (IANA timezone name)'],
                      ].map(([f, t, d]) => (
                        <tr key={f} className="border-t border-slate-800">
                          <td className="py-2 pr-3"><code className="text-yellow-300 text-xs font-mono">{f}</code></td>
                          <td className="py-2 pr-3"><code className="text-blue-300 text-xs font-mono">{t}</code></td>
                          <td className="py-2 text-xs text-slate-400">{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Section>

          {/* ── PLAYER STATS ──────────────────────────────────────────── */}
          <Section id="player-stats" title="Player Stats">
            <p className="text-sm text-slate-400 mb-4">
              See <strong>People / Players → /v1/people/{'{personId}'}/stats</strong> for full
              individual player stats. Additional endpoints below cover aggregated and advanced stats.
            </p>
            <EndpointCard
              path="/v1/stats"
              summary="Aggregate stats query"
              description="Flexible endpoint for querying stats across many players or filters at once."
              example="https://statsapi.mlb.com/api/v1/stats?stats=season&season=2026&group=hitting&playerPool=All&limit=50&sortStat=homeRuns&order=desc&sportId=1"
              params={[
                { name: 'stats', type: 'string', req: true, desc: 'season, career, yearByYear, etc.' },
                { name: 'group', type: 'string', req: true, desc: 'hitting, pitching, or fielding.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'playerPool', type: 'string', desc: 'All, Qualified, Rookies.' },
                { name: 'teamId', type: 'integer', desc: 'Filter to one team.' },
                { name: 'leagueId', type: 'integer', desc: 'Filter by league.' },
                { name: 'position', type: 'string', desc: 'Position code (SP, RP, OF, SS…).' },
                { name: 'sortStat', type: 'string', desc: 'Stat key to sort by (e.g., homeRuns, era).' },
                { name: 'order', type: 'string', desc: 'asc or desc.' },
                { name: 'limit', type: 'integer', desc: 'Max results (up to 500).' },
                { name: 'offset', type: 'integer', desc: 'Pagination offset.' },
                { name: 'gameType', type: 'string', desc: 'R=regular, P=postseason.' },
                { name: 'sitCodes', type: 'string', desc: 'Split situation codes.' },
                { name: 'opposingTeamId', type: 'integer', desc: 'Stats vs a specific team.' },
                { name: 'hydrate', type: 'string', desc: 'person, team.' },
              ]}
            />
            <EndpointCard
              path="/v1/stats/metrics"
              summary="Statcast / Savant analytics"
              description="Returns Statcast metrics (exit velocity, launch angle, barrel %, sprint speed, etc.) for players."
              example="https://statsapi.mlb.com/api/v1/stats/metrics?personIds=592450&season=2026&statGroup=hitting"
              params={[
                { name: 'personIds', type: 'integer', desc: 'Player ID(s).' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'statGroup', type: 'string', desc: 'hitting or pitching.' },
                { name: 'startDate', type: 'string', desc: 'Range start.' },
                { name: 'endDate', type: 'string', desc: 'Range end.' },
              ]}
            />
          </Section>

          {/* ── TEAM STATS ────────────────────────────────────────────── */}
          <Section id="team-stats" title="Team Stats">
            <EndpointCard
              path="/v1/teams/{teamId}/stats"
              summary="Team aggregate stats"
              description="Full season hitting, pitching, or fielding totals for a team."
              example="https://statsapi.mlb.com/api/v1/teams/147/stats?stats=season&season=2026&group=pitching"
              params={[
                { name: 'teamId', type: 'integer', req: true, desc: 'Team ID.' },
                { name: 'stats', type: 'string', req: true, desc: 'season, yearByYear, etc.' },
                { name: 'group', type: 'string', req: true, desc: 'hitting, pitching, fielding.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'gameType', type: 'string', desc: 'R, P, S, A.' },
              ]}
            />
          </Section>

          {/* ── STAT LEADERS ──────────────────────────────────────────── */}
          <Section id="stat-leaders" title="Stat Leaders">
            <EndpointCard
              path="/v1/stats/leaders"
              summary="League-wide stat leaders"
              description="Returns the top players for any statistical category. The leaderCategories param maps to values from /v1/leagueLeaderTypes."
              example="https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&statGroup=hitting&leaderGameTypes=R&limit=25&sportId=1&hydrate=person,team"
              params={[
                { name: 'leaderCategories', type: 'string', req: true, desc: 'homeRuns, battingAverage, onBasePlusSlugging, rbi, runs, hits, doubles, triples, stolenBases, sluggingPercentage, earnedRunAverage, wins, strikeouts, saves, whip, inningsPitched.' },
                { name: 'season', type: 'string', req: true, desc: 'Season year.' },
                { name: 'statGroup', type: 'string', req: true, desc: 'hitting or pitching.' },
                { name: 'leaderGameTypes', type: 'string', desc: 'R=regular (default), P=postseason.' },
                { name: 'limit', type: 'integer', desc: 'Number of leaders to return (default 10, max 500).' },
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'teamId', type: 'integer', desc: 'Leaders from a specific team only.' },
                { name: 'leagueId', type: 'integer', desc: '103=AL, 104=NL.' },
                { name: 'position', type: 'string', desc: 'Filter by fielding position.' },
                { name: 'hydrate', type: 'string', desc: 'person, team.' },
              ]}
              response={`{
  "leagueLeaders": [{
    "leaderCategory": "homeRuns",
    "season": "2026",
    "leaders": [{
      "rank": 1,
      "value": "42",
      "person": { "id": 592450, "fullName": "Aaron Judge" },
      "team": { "id": 147, "name": "New York Yankees" }
    }]
  }]
}`}
            />
          </Section>

          {/* ── STANDINGS ─────────────────────────────────────────────── */}
          <Section id="standings" title="Standings">
            <EndpointCard
              path="/v1/standings"
              summary="League / division standings"
              description="Returns standings records for all teams. Includes W/L, PCT, GB, run differential, home/away records, last-ten, and clinch info."
              example="https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team(division,league),streak,records(splitRecords)"
              params={[
                { name: 'leagueId', type: 'integer', req: true, desc: '103 = American League, 104 = National League. Comma-separate for both.' },
                { name: 'season', type: 'string', req: true, desc: 'Season year.' },
                { name: 'standingsTypes', type: 'string', desc: 'regularSeason, springTraining, firstHalf, secondHalf, wildCard, divisionLeaders.' },
                { name: 'date', type: 'string', desc: 'Historical snapshot MM/DD/YYYY.' },
                { name: 'hydrate', type: 'string', desc: 'team(division,league), streak, records(splitRecords), clinched, nextSchedule.' },
                { name: 'fields', type: 'string', desc: 'Field filter.' },
              ]}
              response={`{
  "records": [{
    "standingsType": "regularSeason",
    "league": { "id": 103, "name": "American League" },
    "division": { "id": 201, "name": "American League East" },
    "teamRecords": [{
      "team": { "id": 147, "name": "New York Yankees" },
      "wins": 62, "losses": 38,
      "leagueRecord": { "wins": 62, "losses": 38, "pct": ".620" },
      "gamesBack": "-", "wildCardGamesBack": "-",
      "divisionRank": "1", "leagueRank": "1",
      "divisionChamp": true, "wildCard": false,
      "clinched": false,
      "runDifferential": 84,
      "streak": { "streakCode": "W5", "streakNumber": 5 },
      "records": {
        "splitRecords": [
          { "type": "home", "wins": 33, "losses": 17 },
          { "type": "away", "wins": 29, "losses": 21 },
          { "type": "lastTen", "wins": 7, "losses": 3 }
        ]
      }
    }]
  }]
}`}
            />
          </Section>

          {/* ── SPORTS & LEAGUES ──────────────────────────────────────── */}
          <Section id="sports" title="Sports & Leagues">
            <EndpointCard
              path="/v1/sports"
              summary="All sports"
              description="Returns all sports tracked by the MLB stats system (MLB=1, AAA=11, AA=12, A+=13, A=14, etc.)."
              example="https://statsapi.mlb.com/api/v1/sports"
              params={[]}
            />
            <EndpointCard
              path="/v1/league"
              summary="League info"
              description="Returns league details — name, abbreviation, sport, season schedule dates."
              example="https://statsapi.mlb.com/api/v1/league?leagueIds=103,104&season=2026"
              params={[
                { name: 'leagueIds', type: 'integer', desc: '103=AL, 104=NL, 107=AL East, etc.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'hydrate', type: 'string', desc: 'season, sport.' },
              ]}
            />
            <EndpointCard
              path="/v1/divisions"
              summary="Division info"
              description="Returns all divisions with IDs: AL East=201, AL Central=202, AL West=200, NL East=204, NL Central=205, NL West=203."
              example="https://statsapi.mlb.com/api/v1/divisions?sportId=1"
              params={[
                { name: 'divisionId', type: 'integer', desc: 'Specific division.' },
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
              ]}
            />
          </Section>

          {/* ── ATTENDANCE ────────────────────────────────────────────── */}
          <Section id="attendance" title="Attendance">
            <EndpointCard
              path="/v1/attendance"
              summary="Attendance records"
              description="Returns game attendance data by team, league, or season."
              example="https://statsapi.mlb.com/api/v1/attendance?teamId=147&season=2025&leagueId=103"
              params={[
                { name: 'teamId', type: 'integer', desc: 'Filter to a specific team.' },
                { name: 'leagueId', type: 'integer', desc: '103 or 104.' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'leagueListId', type: 'string', desc: 'mlb_hist for historical league data.' },
                { name: 'date', type: 'string', desc: 'Single date MM/DD/YYYY.' },
                { name: 'gameType', type: 'string', desc: 'R, P, S, A.' },
              ]}
            />
          </Section>

          {/* ── AWARDS ────────────────────────────────────────────────── */}
          <Section id="awards" title="Awards">
            <EndpointCard
              path="/v1/awards/{awardId}/recipients"
              summary="Award recipients"
              description="Returns winners of a specific award across all seasons or for a specified year."
              example="https://statsapi.mlb.com/api/v1/awards/MLBHOF/recipients?sportId=1"
              params={[
                { name: 'awardId', type: 'string', req: true, desc: 'Award identifier from /v1/awards. Examples: MLBHOF, ALMVP, NLMVP, ALCY, NLCY, ALROY, NLROY, ALGG_C, NLGG_C.' },
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'season', type: 'string', desc: 'Filter to a specific year.' },
                { name: 'hydrate', type: 'string', desc: 'person, team.' },
              ]}
            />
          </Section>

          {/* ── TRANSACTIONS ──────────────────────────────────────────── */}
          <Section id="transactions" title="Transactions">
            <EndpointCard
              path="/v1/transactions"
              summary="Player transactions"
              description="Returns trades, signings, DFA, IL placements, and other roster moves."
              example="https://statsapi.mlb.com/api/v1/transactions?teamId=147&startDate=01/01/2026&endDate=04/01/2026"
              params={[
                { name: 'teamId', type: 'integer', desc: 'Filter by team.' },
                { name: 'personId', type: 'integer', desc: 'Filter by player.' },
                { name: 'startDate', type: 'string', desc: 'Range start MM/DD/YYYY.' },
                { name: 'endDate', type: 'string', desc: 'Range end MM/DD/YYYY.' },
                { name: 'date', type: 'string', desc: 'Single date MM/DD/YYYY.' },
                { name: 'limit', type: 'integer', desc: 'Max results.' },
              ]}
            />
          </Section>

          {/* ── DRAFT ─────────────────────────────────────────────────── */}
          <Section id="draft" title="Draft">
            <EndpointCard
              path="/v1/draft/{year}"
              summary="MLB Draft results"
              description="Returns all picks for a given draft year with player details and signing bonuses."
              example="https://statsapi.mlb.com/api/v1/draft/2025?limit=50&hydrate=team,person"
              params={[
                { name: 'year', type: 'integer', req: true, desc: 'Draft year.' },
                { name: 'round', type: 'string', desc: 'Filter to specific round number.' },
                { name: 'teamId', type: 'integer', desc: 'Filter to picks by a specific team.' },
                { name: 'limit', type: 'integer', desc: 'Max results.' },
                { name: 'hydrate', type: 'string', desc: 'team, person, school.' },
              ]}
            />
          </Section>

          {/* ── HR DERBY ──────────────────────────────────────────────── */}
          <Section id="homerunderby" title="Home Run Derby">
            <EndpointCard
              path="/v1/homeRunDerby/{gamePk}"
              summary="HR Derby bracket"
              description="Returns the full Home Run Derby bracket with player details, round results, and HR counts."
              example="https://statsapi.mlb.com/api/v1/homeRunDerby/716463"
              params={[
                { name: 'gamePk', type: 'integer', req: true, desc: 'Game PK for the All-Star HR Derby event.' },
                { name: 'hydrate', type: 'string', desc: 'player, team.' },
              ]}
            />
          </Section>

          {/* ── HIGH / LOW ────────────────────────────────────────────── */}
          <Section id="highlow" title="High / Low Records">
            <EndpointCard
              path="/v1/highLow/{orgType}"
              summary="Franchise / league records"
              description="Returns high and low records (e.g., longest winning streak, most HR in a game) for teams or players."
              example="https://statsapi.mlb.com/api/v1/highLow/team?statType=wins&season=2025&sortStat=wins&teamIds=147"
              params={[
                { name: 'orgType', type: 'string', req: true, desc: 'team or player.' },
                { name: 'statType', type: 'string', desc: 'Stat key (wins, homeRuns, strikeouts, etc.).' },
                { name: 'season', type: 'string', desc: 'Season year.' },
                { name: 'teamIds', type: 'integer', desc: 'Filter by team.' },
                { name: 'sportId', type: 'integer', desc: 'Use 1 for MLB.' },
                { name: 'sortStat', type: 'string', desc: 'Sort key.' },
                { name: 'limit', type: 'integer', desc: 'Max results.' },
              ]}
            />
          </Section>

          {/* ── GUMBO STRUCTURE ───────────────────────────────────────── */}
          <Section id="gumbo-struct" title="GUMBO Data Structure">
            <p className="text-sm text-slate-400 mb-5">
              The GUMBO (Grand Unified Master Baseball Object) response is the most comprehensive
              game data structure. Understanding its shape is essential for building real-time apps.
            </p>

            {/* Top-level shape */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Top-Level Shape
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase">
                      <th className="px-4 py-2 text-left font-medium">Field</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['gameData', 'object', 'Static game metadata: teams, venue, weather, officials, status'],
                      ['liveData', 'object', 'Dynamic live data: plays, linescore, boxscore, decisions'],
                      ['gameData.game', 'object', 'gamePk, type, doubleHeader, tiebreaker, calendarEventID'],
                      ['gameData.status', 'object', 'abstractGameState, detailedState, statusCode, startTimeTBD'],
                      ['gameData.teams', 'object', 'home and away team objects with full roster hydration'],
                      ['gameData.players', 'object', 'Map of "ID{personId}" → full player bio for every participant'],
                      ['gameData.venue', 'object', 'id, name, location, fieldInfo, timezone'],
                      ['gameData.weather', 'object', 'condition, temp (°F), wind (mph + direction)'],
                      ['gameData.probablePitchers', 'object', 'home and away probable starters'],
                      ['liveData.plays', 'object', 'currentPlay, allPlays[], scoringPlays[], playsByInning[]'],
                      ['liveData.linescore', 'object', 'Inning-by-inning R/H/E + current balls/strikes/outs'],
                      ['liveData.boxscore', 'object', 'Full batting orders, pitching lines, umpires, notes'],
                      ['liveData.decisions', 'object', 'winner, loser, save pitchers (populated when Final)'],
                    ].map(([f, t, d]) => (
                      <FieldRow key={f} field={f} type={t} desc={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* allPlays shape */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                liveData.plays.allPlays[] — At-Bat Object
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase">
                      <th className="px-4 py-2 text-left font-medium">Field</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['result.type', 'string', '"atBat" for at-bat events'],
                      ['result.event', 'string', '"Home Run", "Single", "Strikeout", "Walk", etc.'],
                      ['result.eventType', 'string', 'home_run, single, strikeout, walk — machine-readable'],
                      ['result.description', 'string', 'Full human-readable play description'],
                      ['result.rbi', 'integer', 'RBIs credited on this play'],
                      ['result.awayScore / homeScore', 'integer', 'Score after the play'],
                      ['about.atBatIndex', 'integer', 'At-bat number within the game (0-indexed)'],
                      ['about.halfInning', 'string', '"top" or "bottom"'],
                      ['about.inning', 'integer', 'Inning number'],
                      ['about.isScoringPlay', 'boolean', 'True if run(s) scored'],
                      ['about.hasOut', 'boolean', 'True if an out was recorded'],
                      ['matchup.batter', 'object', '{ id, fullName } of the batter'],
                      ['matchup.pitcher', 'object', '{ id, fullName } of the pitcher'],
                      ['matchup.batSide', 'object', '{ code: "R"|"L"|"S" }'],
                      ['matchup.pitchHand', 'object', '{ code: "R"|"L" }'],
                      ['matchup.splits', 'object', 'batter handedness vs pitcher stance splits'],
                      ['pitchIndex[]', 'integer[]', 'Indices of pitch events in playEvents[]'],
                      ['actionIndex[]', 'integer[]', 'Indices of non-pitch action events'],
                      ['playEvents[]', 'object[]', 'Ordered array of every event in the at-bat — see below'],
                    ].map(([f, t, d]) => (
                      <FieldRow key={f} field={f} type={t} desc={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* playEvents shape */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                playEvents[] — Individual Event Object
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase">
                      <th className="px-4 py-2 text-left font-medium">Field</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['type', 'string', '"pitch", "action", "runner", "no_pitch", "stepoff", "pickoff"'],
                      ['index', 'integer', 'Event index within the at-bat'],
                      ['playId', 'string', 'Unique UUID for this event (use for highlight lookups)'],
                      ['isPitch', 'boolean', 'True if this event is a pitch'],
                      ['details.type', 'object', 'Pitch type: { code: "FF", description: "Four-Seam Fastball" }'],
                      ['details.description', 'string', 'Called Strike, Ball, Swinging Strike, In play, out(s), etc.'],
                      ['details.code', 'string', 'Single-char pitch result code: B=ball, S=strike, X=in-play, C=called strike, F=foul'],
                      ['details.isBall', 'boolean', 'True if ball'],
                      ['details.isStrike', 'boolean', 'True if strike'],
                      ['details.isInPlay', 'boolean', 'True if ball put in play'],
                      ['count.balls', 'integer', 'Ball count before this pitch'],
                      ['count.strikes', 'integer', 'Strike count before this pitch'],
                      ['count.outs', 'integer', 'Outs at the time of the pitch'],
                      ['pitchData', 'object', 'Full Statcast pitch data — see hitData / pitchData section'],
                      ['hitData', 'object', 'Statcast batted ball data — see hitData / pitchData section'],
                    ].map(([f, t, d]) => (
                      <FieldRow key={f} field={f} type={t} desc={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* ── HITDATA / PITCHDATA ───────────────────────────────────── */}
          <Section id="hitdata" title="hitData & pitchData (Statcast)">
            <p className="text-sm text-slate-400 mb-5">
              These Statcast sub-objects appear inside <code className="text-blue-300 font-mono">playEvents[]</code> in
              the GUMBO live feed and play-by-play endpoints. <code className="text-yellow-300 font-mono">pitchData</code>{' '}
              is present on every pitch event. <code className="text-yellow-300 font-mono">hitData</code> is
              only present when the ball is put in play (<code className="text-blue-300 font-mono">details.isInPlay === true</code>).
            </p>

            {/* pitchData */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">pitchData</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg font-mono">present on all pitches</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase">
                      <th className="px-4 py-2 text-left font-medium">Field</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['startSpeed', 'number', 'Velocity at release (mph). "Pitch speed" shown on TV.'],
                      ['endSpeed', 'number', 'Velocity as ball crosses plate (mph).'],
                      ['strikeZoneTop', 'number', 'Top of batter\'s strike zone in feet from ground.'],
                      ['strikeZoneBottom', 'number', 'Bottom of batter\'s strike zone in feet from ground.'],
                      ['coordinates.aX / aY / aZ', 'number', 'Acceleration in X/Y/Z (ft/s²).'],
                      ['coordinates.pfxX', 'number', 'Horizontal movement vs gravity-only (inches). Positive = arm side.'],
                      ['coordinates.pfxZ', 'number', 'Vertical movement vs gravity-only (inches). Positive = rise.'],
                      ['coordinates.pX', 'number', 'Horizontal plate position (feet from center). ±~1.0 is edge.'],
                      ['coordinates.pZ', 'number', 'Vertical plate position (feet from ground). ~1.5–3.5 is zone.'],
                      ['coordinates.vX0 / vY0 / vZ0', 'number', 'Initial velocity components at 50 ft from plate (ft/s).'],
                      ['coordinates.x0 / y0 / z0', 'number', 'Release position in feet (x=horizontal, y=depth, z=height).'],
                      ['breaks.breakAngle', 'number', 'Angle in degrees of total break.'],
                      ['breaks.breakLength', 'number', 'Total distance of break (inches).'],
                      ['breaks.breakY', 'number', 'Distance from plate where max break occurs (feet).'],
                      ['breaks.spinRate', 'number', 'Spin rate in RPM (Rapsodo/Hawk-Eye measured).'],
                      ['breaks.spinDirection', 'number', 'Spin axis direction in degrees (0–360). 180 = pure backspin.'],
                      ['zone', 'integer', 'Strike zone location 1–9 (in zone), 11–14 (out of zone corners/edges).'],
                      ['typeConfidence', 'number', 'Confidence score 0–1 for pitch type classification.'],
                      ['plateTime', 'number', 'Time in seconds for ball to travel from release to plate.'],
                      ['extension', 'number', 'Pitcher\'s release extension toward plate (feet). Higher = closer.'],
                    ].map(([f, t, d]) => (
                      <FieldRow key={f} field={f} type={t} desc={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* hitData */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">hitData</span>
                <span className="text-[10px] px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-lg font-mono">present only when ball in play</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-[10px] text-slate-600 uppercase">
                      <th className="px-4 py-2 text-left font-medium">Field</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['launchSpeed', 'number', 'Exit velocity — speed off the bat (mph). 95+ mph = "hard contact".'],
                      ['launchAngle', 'number', 'Launch angle in degrees. -90° = straight down, 0° = level, +90° = straight up. HR optimal range: 25–35°.'],
                      ['totalDistance', 'number', 'Projected total distance if allowed to land unobstructed (feet).'],
                      ['trajectory', 'string', '"ground_ball" (<10°), "line_drive" (10–25°), "fly_ball" (25–50°), "popup" (>50°), "bunt_grounder", "bunt_line_drive", "bunt_popup".'],
                      ['hardness', 'string', '"soft", "medium", or "hard" — subjective contact quality classification.'],
                      ['location', 'string', 'Fielding zone code where ball landed (1–9 mapped to field zones).'],
                      ['coordinates.coordX', 'number', 'X coordinate on field diagram (0–250 pixel space). 125 = center field.'],
                      ['coordinates.coordY', 'number', 'Y coordinate on field diagram (0–250 pixel space). 0 = home plate.'],
                    ].map(([f, t, d]) => (
                      <FieldRow key={f} field={f} type={t} desc={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Zone diagram text */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Strike Zone Grid (zone param)</div>
              <div className="font-mono text-xs text-slate-300 leading-loose">
                <pre className="overflow-x-auto">{`
  Outside (Catcher's view):
  ┌─────────────────────────────┐
  │  11  │  12  │  13  │  14   │  ← Out-of-zone edges
  ├──────┼──────┼──────┼───────┤
  │   1  │   2  │   3  │       │
  ├──────┼──────┼──────┤  13   │  ← In-zone rows (1–9)
  │   4  │   5  │   6  │       │
  ├──────┼──────┼──────┼───────┤
  │   7  │   8  │   9  │       │
  └─────────────────────────────┘
  
  Zones 1–3: high, 4–6: middle, 7–9: low
  Zones 11–14: corners (out of zone but close)
  pX ≈ -0.83 to 0.83 ft = in-zone horizontal
  pZ ≈ strikeZoneBottom to strikeZoneTop = in-zone vertical
`}</pre>
              </div>
            </div>
          </Section>

          {/* ── HYDRATION SYSTEM ──────────────────────────────────────── */}
          <Section id="hydration" title="Hydration System">
            <p className="text-sm text-slate-400 mb-4">
              Most MLB Stats API endpoints support a <code className="text-yellow-300 font-mono">hydrate=</code>{' '}
              parameter that embeds related objects in a single response, avoiding extra round trips.
              Hydrations can be nested and combined.
            </p>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Common Hydrations
              </div>
              <div className="divide-y divide-slate-800">
                {[
                  { endpoint: '/v1/people/{id}', hydrates: 'stats(group=[hitting,pitching],type=[season,career],season=2026)', note: 'Embeds full stat splits into person response' },
                  { endpoint: '/v1/people/{id}', hydrates: 'awards,transactions,rosterEntries,education,social,draft', note: 'Career milestones and personal info' },
                  { endpoint: '/v1/schedule', hydrates: 'team,linescore,decisions,probablePitcher,weather,venue', note: 'Rich schedule with game-day info' },
                  { endpoint: '/v1/teams/{id}/roster', hydrates: 'person(stats(group=[hitting],type=[season],season=2026))', note: 'Roster with season stats per player' },
                  { endpoint: '/v1/standings', hydrates: 'team(division,league),streak,records(splitRecords)', note: 'Full standings with split records' },
                  { endpoint: '/v1/stats/leaders', hydrates: 'person,team', note: 'Embed player bio and team info on each leader' },
                  { endpoint: '/v1/teams', hydrates: 'venue,division,league,sport', note: 'Team directory with venue and org info' },
                  { endpoint: '/v1.1/game/{pk}/feed/live', hydrates: 'N/A', note: 'GUMBO always includes full data — no hydrate needed' },
                ].map(({ endpoint, hydrates, note }) => (
                  <div key={endpoint + hydrates} className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 items-start">
                      <code className="text-emerald-400 text-xs font-mono">{endpoint}</code>
                      <span className="text-slate-600 text-xs">→</span>
                      <code className="text-blue-300 text-xs font-mono break-all">hydrate={hydrates}</code>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{note}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-700 rounded-2xl p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Syntax Rules</div>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Multiple hydrations: <code className="text-blue-300 font-mono">hydrate=team,venue,weather</code></li>
                <li>Nested hydrations: <code className="text-blue-300 font-mono">hydrate=team(division,league)</code></li>
                <li>Param hydrations: <code className="text-blue-300 font-mono">hydrate=stats(group=[hitting],type=[season],season=2026)</code></li>
                <li>Square brackets denote arrays: <code className="text-blue-300 font-mono">group=[hitting,pitching]</code></li>
                <li>Can combine: <code className="text-blue-300 font-mono">hydrate=person,team,stats(group=[hitting],type=[season,career])</code></li>
              </ul>
            </div>
          </Section>

          <div className="text-xs text-slate-600 text-center pb-8">
            Data sourced from the MLB Stats API · statsapi.mlb.com ·{' '}
            <a
              href="https://statsapi.mlb.com/api/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-500 hover:underline"
            >
              Open API
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
