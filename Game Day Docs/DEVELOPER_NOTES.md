# Developer Notes

## Known issues found in code

- The repository contains only a compiled bundle, not the original source, package metadata, or tests.
- The bundle references `gd.min.js.LICENSE.txt` and `gd.min.js.map`, but neither file was present in the provided directory.
- Requiring the bundle in Node.js fails with `Automatic publicPath is not supported in this browser`, confirming that it expects a browser runtime and webpack asset resolution.
- The bundle appears to rely on additional emitted chunks/assets that were not included here.

## Bugs or risky patterns

- Many critical resources are hard-coupled to external MLB hosts.
- Some promise chains swallow errors and degrade silently.
- Query-string flags can materially alter behavior, which is useful for QA but easy to misuse in production.
- Runtime bootstrap/config behavior is opaque because only minified output is available.

## Refactor opportunities

- Recover the original source and replace minified-bundle maintenance with source-level development.
- Separate resource configuration, API clients, websocket logic, and UI components into documented modules.
- Replace implicit query-parameter feature gates with typed config and clear environment separation.
- Wrap external asset/script loading with a small compatibility layer and observability.

## Performance concerns

- The bundle is large at roughly 5 MB uncompressed.
- Many fonts are loaded from `www.mlbstatic.com`; this can increase render delay and network cost.
- Third-party media/tracking scripts from `mlbstatic.com` add extra request overhead.
- Browser-only orchestration plus many UI features likely increases initial render cost.

## Missing validation / tests

- No test suite was provided.
- No lint/build scripts were provided.
- No public API contract or typed config schema was provided.
- No source map was available for practical debugging.

## Suggestions for next steps

- Recover the original repository or build output directory with all chunks and metadata.
- Add a thin host application README showing the exact runtime bootstrap contract.
- Verify which query-string overrides are intended for production support versus QA-only behavior.
- Add monitoring around websocket connectivity, asset failures, and fallback rendering.
- Create a local asset manifest or proxy for the most critical `mlbstatic` resources.

## Risks from reliance on third-party MLB static assets

- Branding assets, player photography, and fonts may be legally or contractually restricted.
- CDN path changes can break the application with no local code change.
- Third-party outages will directly affect UI rendering.
- If `img.mlbstatic.com` or `www.mlbstatic.com` become slow, core visual rendering quality degrades quickly.
- Environment-specific `*.mlbstatic.com` script URLs increase the surface area for environment drift and configuration mistakes.
