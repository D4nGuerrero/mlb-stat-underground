# Gameday Bundle Documentation

## Project name

`Gameday` (inferred from the UMD export `exports.Gameday` / `e.Gameday` and component names such as `GamedayAppContainer`)

## What this project does

This repository currently contains a single production browser bundle, [gd.min.js](C:/Users/danny/Desktop/Fun/gd.min.js/gd.min.js), that implements MLB/MiLB Gameday-style game viewing. The bundle renders live and pregame game views, fetches schedule and feed data, opens websocket subscriptions for live updates, embeds media players, and loads many static MLB-hosted visual assets.

Important limitation: the original source tree, package manifests, tests, and emitted companion assets are not included. All documentation below is based on the shipped bundle only.

## Key features

- React 18 client rendering with `createRoot` / `hydrateRoot`
- Redux-style state management with visible slices for `views`, `loading`, `loggedIn`, `userinfo`, `config`, `lockview`, `connectionError`, and `datasources`
- Route-driven game navigation with path variants such as `/:gamepk/:view/:tab/:detail`
- Live game feed fetching from StatsAPI-style endpoints
- Websocket subscriptions for live push updates
- Media/video integration, including unified player embeds and MLB.TV / audio links
- Dynamic static asset loading for team logos, player headshots, stadium art, promotions, fonts, jingles, and challenge graphics
- Runtime feature flags driven by query params and config

## Tech stack

Confirmed from bundle contents:

- JavaScript browser bundle built with webpack or a similar chunking bundler
- React
- React DOM 18
- Styled Components
- Redux-style store and reducers
- React Router-style route matching
- Fetch / XHR network access
- WebSocket live updates
- Browser storage via `localStorage` and `sessionStorage`

Inferred from bundle structure:

- Server-side rendering hydration is supported when `hydrate` is enabled
- Lazy-loaded chunks and emitted font/assets are expected alongside this file at deploy time

## Installation steps

Because only a built artifact is present, there is no install step such as `npm install` visible in the provided codebase.

For inspection or integration:

1. Serve the directory from a web server.
2. Ensure all companion webpack assets that the bundle expects are available in the same deployed asset root.
3. Provide a mount node matching the bundle’s default selector: `#gameday-index-component__root`.
4. Provide runtime config compatible with the bundle’s expected bootstrap shape.

## Environment variables

No concrete environment variables were discovered in the provided artifact.

What the bundle does use instead:

- A config field named `env`, defaulting to `prod`
- A config field named `stitchEnv`
- URL query parameters for runtime overrides

Visible query-string overrides include:

- `tfs`
- `appOverride`
- `enableFieldVision`
- `enableFieldVisionOD`
- `forceFV`
- `forceAbsVideos`
- `forceAbsGraphic`
- `forceAbsInProgress`
- `enableDarkMode`
- `forceWS`
- `noDelayWS`
- `forceDFV`
- `stitch_env`
- `enablePOTG`
- `forceNewCore`

## Run locally

Minimal inferred browser-only setup:

```html
<!doctype html>
<html>
  <body>
    <div id="gameday-index-component__root"></div>
    <script src="./gd.min.js"></script>
  </body>
</html>
```

Notes:

- This bundle is not directly runnable in Node.js. Requiring it in Node fails with `Automatic publicPath is not supported in this browser`.
- Some functionality likely depends on additional emitted chunks, fonts, and asset files that are not present in this directory.
- Runtime config is expected to exist; the bundle contains a default mount selector and game/config bootstrap logic, but the complete external contract is not included in readable source form.

## Build / deploy

No build scripts or source configuration were provided.

Confirmed deployment behavior:

- The bundle is intended for browser deployment.
- It references webpack public-path assets and a source map comment: `//# sourceMappingURL=gd.min.js.map`.
- It also references `gd.min.js.LICENSE.txt`.

Practical deploy requirement:

- Deploy `gd.min.js` with its companion chunk files, fonts, and other emitted assets from the original build output. Without them, lazy-loaded or font-backed features may fail.

## Folder structure overview

Current repository structure:

```text
.
├── gd.min.js
├── README.md
├── ARCHITECTURE.md
├── CODEBASE_GUIDE.md
├── API.md
├── MLBSTATIC_RESOURCES.md
└── DEVELOPER_NOTES.md
```

This is a bundle-first artifact, not a full source repository.

## Example usage

Example route patterns discovered in the bundle:

```text
/:gamepk
/:gamepk/:view
/:gamepk/:view/:tab
/:gamepk/:view/:tab/:detail
/:teams/:year/:month/:day/:gamepk/:view/:tab/:detail
```

Example runtime concerns:

- `language` defaults to `en`
- `locale` defaults to `en-US`
- `gamePk`, `timecode`, `detail`, and view/tab values are route-driven
- the app may hydrate or render fresh depending on runtime options

## Troubleshooting

- `Automatic publicPath is not supported in this browser`
  - The bundle expects a real browser environment and webpack public-path resolution.
- Missing fonts, logos, or lazy-loaded UI
  - Companion emitted assets are likely missing from the provided directory.
- Live updates do not arrive
  - Check websocket access to `wss://ws.statsapi.mlb.com/` or QA equivalents, plus game-state gating and auth token state.
- Media or promo features do not render
  - Several features depend on external MLB-hosted assets and services, including `mlbstatic.com`, `img.mlbstatic.com`, StatsAPI, BDFED, and MLB video endpoints.
- Source-level debugging is difficult
  - The minified file references a source map, but the `.map` file was not included.

## Future improvements

- Recover or add the original source tree and build metadata
- Commit package manifests and deployment instructions
- Add automated tests around routing, live feed updates, and media fallbacks
- Introduce a local asset/cache strategy for critical third-party static resources
- Replace opaque runtime bootstrap with explicit typed config
- Document public embedding API if this bundle is intended for reuse

## Summary of external MLB/media resources used

Confirmed major external dependencies:

- `statsapi.mlb.com` and `qa-statsapi.mlb.com` for schedules, live feeds, standings, uniforms, and people stats
- `ws.statsapi.mlb.com` / `ws.qa-statsapi.mlb.com` for websocket subscriptions
- `bdfed.stitch.mlbinfra.com` and related BDFED hosts for content/config payloads
- `www.mlb.com`, `qa-gcp.mlb.com`, `beta-gcp.mlb.com`, `www.milb.com`, and `*.milb.com` for media/player/deep links
- `prod-gameday.mlbstatic.com`, `beta-gameday.mlbstatic.com`, `qa-gameday.mlbstatic.com`, `www.mlbstatic.com`, `img.mlbstatic.com`, and environment-specific `*.mlbstatic.com` hosts for static assets

`mlbstatic.com` asset usage includes:

- Team logos
- League header logos
- Player headshots and action shots
- Default player imagery
- Stadium backgrounds and infield renders
- Batter silhouettes / uniforms
- Field SVGs and dirt-cloud graphics
- Promotions, scout art, wrap fallback art, ABS challenge assets
- Jingle GIFs
- Proxima Nova font files
- Conviva analytics/video SDK scripts

See [MLBSTATIC_RESOURCES.md](C:/Users/danny/Desktop/Fun/gd.min.js/MLBSTATIC_RESOURCES.md) for the detailed inventory.
