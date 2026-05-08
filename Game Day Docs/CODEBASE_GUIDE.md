# Codebase Guide

## Repository shape

The provided repository is not a normal source tree. It is a single compiled bundle plus the documentation added in this review.

## File-by-file guide

### [gd.min.js](C:/Users/danny/Desktop/Fun/gd.min.js/gd.min.js)

Purpose:

- Primary production bundle for the `Gameday` app
- Contains React UI, styling, routing, state management, API clients, websocket logic, media helpers, static resource registries, and bootstrap logic

Important confirmed areas inside the bundle:

- UMD export: publishes `Gameday`
- React 18 rendering: uses `createRoot` and `hydrateRoot`
- App container: `GamedayAppContainer`
- Routing: multiple path patterns based on `gamepk`, `view`, `tab`, `detail`, and optional team/date segments
- Resource registries: include asset templates and endpoint templates
- Storage wrapper: localStorage namespace prefix `ds::`
- Websocket/live feed logic: StatsAPI push subscription plus patch handling
- Global styles: Proxima Nova font-face declarations from `www.mlbstatic.com`

Known missing companion files referenced by the bundle:

- `gd.min.js.LICENSE.txt`
- `gd.min.js.map`
- additional emitted assets/chunks resolved via webpack public path

### [README.md](C:/Users/danny/Desktop/Fun/gd.min.js/README.md)

Entry-level developer overview for the bundle, runtime assumptions, and practical deployment notes.

### [ARCHITECTURE.md](C:/Users/danny/Desktop/Fun/gd.min.js/ARCHITECTURE.md)

System-level interaction map and data-flow summary.

### [API.md](C:/Users/danny/Desktop/Fun/gd.min.js/API.md)

Visible network/API surface extracted from the bundle.

### [MLBSTATIC_RESOURCES.md](C:/Users/danny/Desktop/Fun/gd.min.js/MLBSTATIC_RESOURCES.md)

Dedicated report of every discovered `mlbstatic.com` resource pattern and how it is used.

### [DEVELOPER_NOTES.md](C:/Users/danny/Desktop/Fun/gd.min.js/DEVELOPER_NOTES.md)

Risks, gaps, and practical next steps.

## Purpose of each folder

Only one folder was provided:

- `C:\Users\danny\Desktop\Fun\gd.min.js`
  - Acts as a flat build-output directory containing the main bundle and now the generated docs

## Main entry points

Visible entry concepts in the bundle:

- UMD export: `Gameday`
- Main React container: `GamedayAppContainer`
- Render bootstrap helper that accepts `mount`, `hydrate`, and `initState`
- Default mount selector: `#gameday-index-component__root`

## Shared utilities and subsystems

Confirmed utility areas embedded in the bundle:

- Resource/URL template registries
- Route-to-view synchronization
- Theme and dark-mode utilities
- Local storage cache wrapper with expiry handling
- Websocket client and patch-application logic
- Media/ad/tracking helpers
- Error boundaries and fallback rendering

## Reusable components visible by name

Examples of named components/styles present in the bundle:

- `GamedayAppContainer`
- `InsightsFeed`
- `InsightsFeedHeader`
- `PitchChallenge`
- `Live feed`
- `Strikezone`
- `Play Detail`
- `Media Menu`
- `Lineup`
- `Summary`
- `Preview`
- `Field Vision`
- `WhereToWatch`
- `MiniScoreboard`
- `PlayerMatchupLayer`

These names are reliable for orientation, but source-level file boundaries are not recoverable from the minified artifact alone.

## Where to make common changes

If you regain source:

- Routing/view behavior
  - Search for route patterns containing `:gamepk`, `:view`, `:tab`, `:detail`
- API endpoint changes
  - Search for `pathTemplate:` and `env_dev` / `env_qa` / `env_beta` / `env_prod`
- Websocket behavior
  - Search for `api/v1/game/push/subscribe` and `new WebSocket`
- Media/player behavior
  - Search for `unified-player/embed`, `mlbtvUrl`, `feedapi`, `Conviva`
- Static imagery and logos
  - Search for resource keys such as `teamLogo`, `mugshot`, `playerHeader`, `stadiumBottom`, `promoImageUrl`
- Query-param flags
  - Search for `URLSearchParams(location.search)`

If you only have this bundle:

- Safe maintenance is limited to external hosting, integration, caching, and surrounding documentation.

## Which parts reference `mlbstatic.com`

Confirmed `mlbstatic` references exist in:

- Static asset registries for:
  - `headerLogo`
  - `challengingTeamLogoUrl`
  - `teamLogo`
  - `teamLogoDark`
  - `teamLogoGeneric`
  - `teamLogoDarkGeneric`
  - `teamLogoLarge`
  - `teamLogoLargeGeneric`
  - `playerActionShot`
  - `mugshot*`
  - `playerHeader*`
  - stadium, batter, field, wrap, promotion, ABS, and jingle templates under `prod-gameday.mlbstatic.com`
- Global font-face declarations for Proxima Nova
- Conviva tracking/video SDK URL configuration

See [MLBSTATIC_RESOURCES.md](C:/Users/danny/Desktop/Fun/gd.min.js/MLBSTATIC_RESOURCES.md) for the full list.
