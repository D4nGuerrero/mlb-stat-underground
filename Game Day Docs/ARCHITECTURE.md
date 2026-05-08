# Architecture

## High-level system design

The provided codebase is a single browser bundle that packages UI, state management, routing, data access, websocket updates, media integration, and static asset resolution into one deployable artifact.

High-level layers visible in the bundle:

1. Bootstrap and runtime config parsing
2. Router and view-state derivation
3. Redux-style store and reducers
4. Data-source layer for REST, GraphQL, BDFED, and websocket endpoints
5. React component tree for game views and supporting UI
6. Static asset registries for MLB-hosted logos, images, fonts, and promotional art

## How components interact

Confirmed interaction pattern:

- Runtime bootstrap builds a config object containing mount selector, game metadata, ads, tracking, and feature flags.
- A render helper chooses `createRoot` or `hydrateRoot`.
- `GamedayAppContainer` wires store-backed state into the UI and applies theming via Styled Components.
- Route/view handlers update store state such as `gamePk`, `game_view`, `game_tab`, `detail`, `language`, `locale`, and `fieldVisionOn`.
- Data-source models fetch live feed, schedule, story, lineup, standings, and supporting metadata.
- A websocket layer subscribes to push endpoints and applies full or patch updates into cached game models.

## Request / data flow

Observed request flow:

1. Initial bootstrap config is assembled, including game, locale/language, ads, and feature flags.
2. Route params and query params are merged into view/config state.
3. Initial data is fetched from StatsAPI/BDFED/GraphQL-style endpoints.
4. The React tree renders from store state.
5. For eligible games, websocket subscriptions open against `ws.statsapi` endpoints.
6. Push messages are applied as live updates; patch payloads are merged through a patch client.
7. UI components consume resolved API data plus static asset URL templates.

## State management

Visible reducer/state slices include:

- `views`
- `loading`
- `loggedIn`
- `userinfo`
- `config`
- `lockview`
- `connectionError`
- `datasources`
- `router` (required to be mounted under `"router"`)

Observed state inputs include:

- `gamePk`
- `game_view`
- `game_tab`
- `detail`
- `timecode`
- `language`
- `locale`
- `fieldVisionOn`
- login/access-token state

## APIs and services used

Visible service categories:

- StatsAPI live feed and metadata endpoints
- StatsAPI websocket subscription endpoints
- BDFED content/config endpoints
- GraphQL endpoint for games-by-gamePk lookup
- MLB.com / MiLB.com media, player-card, and story links
- MLB unified-player embed URLs
- MLB static asset hosts under `mlbstatic.com`

Representative confirmed endpoints:

- `api/v1.1/game/{gamePk}/feed/live{differ}?language={language}{timecode}{pushUpdate}`
- `api/v1/game/push/subscribe/gameday/{gamePk}`
- `api/v1/schedule`
- `api/v1/standings?...`
- `api/v1/uniforms/game?gamePks={gamePk}`
- `bdfed/gameday-content/?locale={locale:en}&gamePk={gamePk}`
- `graphql/?operationName=getGamesByGamePks&{query}&variables={variables}`

## Database / storage usage

No server-side database is visible from the bundle alone.

Browser-side storage confirmed:

- `localStorage`
  - Used through a namespaced storage wrapper with prefix `ds::`
  - Stores serialized entries with namespace, key, expiry, timestamps, and value
- `sessionStorage`
  - Used for a `sessionID` value in media/ad flows

No `indexedDB` usage was discovered.

## Real-time systems / websockets

Confirmed websocket behavior:

- Websocket endpoints use `wss://ws.statsapi.mlb.com/` and `wss://ws.qa-statsapi.mlb.com/`
- Paths include:
  - `api/v1/game/push/subscribe/gameday/{gid}`
  - `api/v1/game/push/subscribe/{gid}`
- The socket may be opened with a subprotocol array `["gameday", accessToken]` when an access token exists.
- Socket startup is gated by game state and time-window checks.
- Incoming updates may be full payloads or patch diffs.

## Security considerations

Confirmed or strongly supported by code:

- Access tokens are propagated into websocket setup and `Authorization: Bearer {accessToken}` headers for at least some API requests.
- The browser bundle contains many third-party/service endpoints directly, which increases exposure to misconfiguration and host dependence.
- Query-string flags can force behavior such as websocket mode, field vision, dark mode, and feature variants; this is useful for QA but should be reviewed for production hardening.
- The bundle is not appropriate as a secret-bearing runtime; any client-side token or host mapping is inherently visible.

## Scalability considerations

Strengths:

- Websockets reduce polling pressure for live games.
- The bundle uses patch-based live update handling, which is more efficient than repeated full-feed replacement.
- Asset references are CDN-backed and offload image/font/video-script delivery to MLB-hosted infrastructure.

Risks:

- Strong coupling to third-party hosts means outages or host-path changes can break the UI.
- Missing source makes controlled optimization and bundle splitting difficult.
- Browser-only data orchestration can create large client bundles and runtime memory pressure.

## Where `mlbstatic.com` assets enter the system

The bundle uses two main patterns:

1. Static registry templates
   - URL templates are embedded directly in resource maps, for example team logos, player images, stadium renders, promotions, and jingles.
2. Global style injection / script loading
   - Styled Components inject `@font-face` rules for Proxima Nova from `www.mlbstatic.com`.
   - Video tracking config points at environment-specific `*.mlbstatic.com` Conviva SDK scripts.

Consumption modes observed:

- Direct image `src` / background asset templates
- Font-face CSS URLs
- Runtime media/tracking script URLs
- Environment-specific static path composition using:
  - `https://qa-gameday.mlbstatic.com`
  - `https://beta-gameday.mlbstatic.com`
  - `https://prod-gameday.mlbstatic.com`
  - `https://www.mlbstatic.com`
  - `https://img.mlbstatic.com`

Detailed inventory: [MLBSTATIC_RESOURCES.md](C:/Users/danny/Desktop/Fun/gd.min.js/MLBSTATIC_RESOURCES.md)
