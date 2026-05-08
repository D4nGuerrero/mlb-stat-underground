# MLB Static Resources Report

This report covers every `mlbstatic.com` resource host, path, or pattern clearly discoverable in the provided bundle.

## Host inventory

Confirmed hosts:

- `https://qa-gameday.mlbstatic.com`
- `https://beta-gameday.mlbstatic.com`
- `https://prod-gameday.mlbstatic.com`
- `https://www.mlbstatic.com`
- `https://img.mlbstatic.com`
- `https://dev.mlbstatic.com`
- `https://qa.mlbstatic.com`
- `https://beta.mlbstatic.com`

## How these resources enter the system

Observed ingestion modes:

- Direct hardcoded URL templates in resource registries
- Environment-based string composition like `prod-gameday.mlbstatic.com + /responsive-gameday-assets/1.3.0 + path`
- CSS `@font-face` declarations
- Runtime external script URLs for Conviva video analytics modules

## Resource patterns

| Key / pattern | Example URL pattern | Appears to provide | Usage mode |
| --- | --- | --- | --- |
| `headerLogo` | `https://www.mlbstatic.com/team-logos/league-on-{theme}/{id}.svg` | League/header logo | direct image URL |
| `challengingTeamLogoUrl` | `https://www.mlbstatic.com/team-logos/team-cap-on-light/{teamId}.svg` | ABS challenge team logo | direct image URL |
| `teamLogo` | `https://www.mlbstatic.com/team-logos/{team_id}.svg` | team logo | direct image URL |
| `teamLogoDark` | `https://www.mlbstatic.com/team-logos/team-cap-on-dark/{team_id}.svg` | dark-theme team logo | direct image URL |
| `teamLogoGeneric` | `https://www.mlbstatic.com/team-logos/team-cap-on-light/000.svg` | fallback generic team logo | direct image URL |
| `teamLogoDarkGeneric` | `https://www.mlbstatic.com/team-logos/team-cap-on-dark/000.svg` | dark fallback generic team logo | direct image URL |
| `teamLogoLarge` | `https://www.mlbstatic.com/team-logos/{team_id}.svg` | larger team logo reuse | direct image URL |
| `teamLogoLargeGeneric` | `https://www.mlbstatic.com/team-logos/team-cap-on-light/000.svg` | larger generic logo fallback | direct image URL |
| `playerActionShot` | `https://img.mlbstatic.com/mlb-photos/image/upload/{optionsPath}v1/people/{playerId}/action/vertical/current` | player action photo | direct image URL |
| `mugshot` | `https://img.mlbstatic.com/mlb-photos/image/upload/.../people/{pid:default}/headshot/83/current` | MLB headshot | direct image URL |
| `mugshotChyron` | same pattern as `mugshot` | lower-third / chyron headshot | direct image URL |
| `mugshotMlb` | `...w_62.../people/{pid:default}/headshot/83/current` | compact MLB headshot | direct image URL |
| `mugshotMilb` | `.../people/{pid}/headshot/83/milb/current` | MiLB headshot | direct image URL |
| `mugshotPreviewMilb` | same MiLB headshot pattern | preview MiLB headshot | direct image URL |
| `mugshotMilbGeneric` | same MiLB pattern with generic fallback behavior implied by name | MiLB generic headshot path | direct image URL |
| `playerHeader` | `https://img.mlbstatic.com/mlb-photos/image/upload/.../people/{pid}/action/pitching/current` | player hero/header image | direct image URL |
| `playerAltHeader` | `.../people/{pid}/action/pitching/away/current` | alternate player hero image | direct image URL |
| `errorImageSrc` | `https://img.mlbstatic.com/mlb-photos/image/upload/w_128,f_jpg/v1/people/generic/action/vertical/current` | generic fallback image | direct image URL |

## `prod-gameday.mlbstatic.com` responsive asset paths

These are built from:

- base: `https://prod-gameday.mlbstatic.com`
- version path: `/responsive-gameday-assets/1.3.0`

The same path family also appears under QA and beta hosts.

| Key / pattern | Path suffix | What it appears to provide | Usage mode |
| --- | --- | --- | --- |
| `batter` | `/images/batters/immortal/{stand}/{team:GENERIC}-{homeOrAway}.png` | batter silhouette/art | direct image URL |
| `jersey` | `/images/batters/{year}/{stand}/{jerseyCode}.png` | uniform jersey layer | direct image URL |
| `pants` | `/images/batters/{year}/{stand}/{pantsCode}.png` | uniform pants layer | direct image URL |
| `stadiumTop` env paths | `/images/stadiums/{phase}/{id:default}{density}.jpg` | stadium background/top field imagery | direct image URL |
| `stadiumBottom` | `/images/stadiums/infield-full/{id:default}{density}.jpg` and `/images/stadiums/infield/{id:default}{density}.jpg` | lower field / infield imagery | direct image URL |
| `player-of-the-game artwork` | `/images/promotions/player-of-the-game/artwork-{theme}-{language}.svg` | player-of-the-game artwork | direct image URL |
| `absChallenge` | `/images/abs/v1/min` | ABS challenge graphics bundle root | likely asset prefix |
| `scoutInsightsArtwork` | `/images/promotions/scout/{variant}-{theme}.svg` | scout/insight promo art | direct image URL |
| `mugshotDefault` | `/images/players/player-default@2x.png` | default headshot fallback | direct image URL |
| `mugshotMilbDefault` | `/images/players/player-default@2x.png` | MiLB default headshot fallback | direct image URL |
| `playerHeaderDefault` | `/images/players/summary_photo_default.svg` | default player header art | direct image URL |
| `playerHeaderPreviewDefault` | `/images/players/summary_photo_default.svg` | preview header fallback | direct image URL |
| `batter` alternate | `/images/batters/{cut}/{team:GENERIC}-{homeOrAway}-{stand}@2x.png` | alternate batter art | direct image URL |
| `nonRetinaBatter` | `/images/batters/{cut}/{team:GENERIC}-{homeOrAway}-{stand}.png` | non-retina batter art | direct image URL |
| `field` | `/images/fields/{id:generic}.svg` | field SVG | direct image URL |
| `pitchDirtCloud` | `/images/icons/dirt-cloud.png` | pitch/challenge visual effect | direct image URL |
| `wrapFallBackImage` | `/images/wrap/{event}/{season:generic}.jpg` | wrap recap fallback art | direct image URL |
| `wrapFallBackMatchupImage` | `/images/wrap/{event}/matchups/{away_id}_{home_id}.png` | matchup-specific wrap art | direct image URL |
| `jingle` | `/jingles/gif/{jingle}.gif` | jingle animation | direct image URL |
| `promoImageUrl` | `/images/promotions/{id}.png` | promotion art | direct image URL |

## Font assets from `www.mlbstatic.com`

Confirmed CSS font-face URLs:

- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-regular.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-regular.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-regular-italic.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-regular-italic.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-medium.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-medium.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-medium-it.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-medium-it.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-semibold.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-semibold.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-semibold-italic.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-semibold-italic.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-bold.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-bold.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-bold-italic.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-bold-italic.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-extrabold.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-extrabold.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-extrabold-italic.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-extrabold-italic.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-black.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-black.woff`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-black-italic.woff2`
- `https://www.mlbstatic.com/mlb.com/fonts/proxima-nova-black-italic.woff`

Usage mode:

- CSS `@font-face` injected by Styled Components global styles

## Conviva scripts from environment-specific `mlbstatic.com` hosts

These are not images; they are external JavaScript dependencies used for media/tracking.

| Environment key | Script |
| --- | --- |
| `dev` / `qa` / `beta` / `prod` | `video/libs/conviva/jssdk/4.1.2/conviva-core-sdk.debug.js` |
| `dev` / `qa` / `beta` / `prod` | `video/libs/conviva/html5-impl/4.0.5/conviva-html5native-impl.js` |
| `dev` / `qa` / `beta` / `prod` | `video/libs/conviva/ima/4.0.3/conviva-googleima-module.js` |
| `dev` / `qa` / `beta` / `prod` | `video/libs/conviva/dai/4.0.1/conviva-googledai-module.js` |

Hosts used:

- `dev.mlbstatic.com`
- `qa.mlbstatic.com`
- `beta.mlbstatic.com`
- `www.mlbstatic.com`

Usage mode:

- runtime external script URL configuration

## Dynamic IDs and parameters used

Confirmed placeholders include:

- `{theme}`
- `{id}`
- `{teamId}`
- `{team_id}`
- `{playerId}`
- `{pid}`
- `{pid:default}`
- `{optionsPath}`
- `{year}`
- `{stand}`
- `{homeOrAway}`
- `{jerseyCode}`
- `{pantsCode}`
- `{phase}`
- `{density}`
- `{language}`
- `{variant}`
- `{cut}`
- `{event}`
- `{season:generic}`
- `{away_id}`
- `{home_id}`
- `{jingle}`

## Which bundle areas use these resources

Because the code is minified, source filenames are not recoverable. The clearest confirmed usage sites are resource registry objects and global style declarations inside [gd.min.js](C:/Users/danny/Desktop/Fun/gd.min.js/gd.min.js).

Key registry field names include:

- `headerLogo`
- `challengingTeamLogoUrl`
- `playerActionShot`
- `mugshot`
- `mugshotChyron`
- `mugshotMlb`
- `mugshotMilb`
- `mugshotPreviewMilb`
- `mugshotMilbGeneric`
- `playerHeader`
- `playerAltHeader`
- `teamLogo`
- `teamLogoDark`
- `teamLogoGeneric`
- `teamLogoDarkGeneric`
- `teamLogoLarge`
- `teamLogoLargeGeneric`
- `mugshotDefault`
- `playerHeaderDefault`
- `absChallenge`
- `scoutInsightsArtwork`
- `promoImageUrl`
- `wrapFallBackImage`
- `wrapFallBackMatchupImage`

## Licensing / reliability / hotlinking considerations

Risks:

- The bundle is tightly coupled to MLB-hosted static assets and scripts outside this repository.
- If MLB changes asset paths, file names, CDN rules, or access controls, the UI can break without a code change on your side.
- Hotlinking third-party logos, player imagery, and fonts may carry branding or usage constraints outside ordinary open-source assumptions.
- Analytics/tracking script loading from third-party hosts can impact privacy, performance, and availability.

## Recommendations

- Cache critical UI assets you are allowed to mirror, especially logos, generic fallbacks, and fonts.
- Add application-level fallbacks for image and font failures.
- Version-lock and integrity-check third-party script loading where possible.
- Centralize asset URL generation in source if the original codebase becomes available.
- Audit legal/licensing terms before redistributing MLB-hosted imagery or fonts.
- Consider replacing direct hotlinks with your own asset proxy or CDN for resilience.
