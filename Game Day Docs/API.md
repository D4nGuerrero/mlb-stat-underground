# API Surface

This file documents network surfaces that are directly visible in the provided bundle. It is not a guarantee that every endpoint is still active; it is a record of what the code references.

## Endpoint categories

| Category | Example |
| --- | --- |
| Live game feed | `api/v1.1/game/{gamePk}/feed/live{differ}?language={language}{timecode}{pushUpdate}` |
| Websocket subscription | `api/v1/game/push/subscribe/gameday/{gamePk}` |
| Schedule | `api/v1/schedule` |
| Standings | `api/v1/standings?...` |
| People / player stats | `api/v1/people?...` |
| Uniforms | `api/v1/uniforms/game?gamePks={gamePk}` |
| Insights | `api/v1/insights/{gamePk}/{timecode}` |
| GraphQL | `graphql/?operationName=getGamesByGamePks&{query}&variables={variables}` |
| BDFED content | `bdfed/gameday-content/?locale={locale:en}&gamePk={gamePk}` |

## Confirmed endpoints

### StatsAPI / feed endpoints

- `api/v1.1/game/{gamePk}/feed/live?language={language}&hydrate=ruleSettings&fields=gameData,ruleSettings`
- `api/v1.1/game/{gamePk}/feed/live{differ}?language={language}{timecode}{pushUpdate}`
- `api/v1.1/game/{gid}/feed/live{differ}?language={site}{timecode}{pushUpdateId}`
- `api/v1/game/{gid}/content?language={site}`
- `api/v1/insights/{gamePk}/{timecode}`
- `api/v1/schedule`
- `api/v1/schedule?gamePk={gamePk}&language={language}&hydrate=story,xrefId,lineups,broadcasts(all),probablePitcher(note),game(content(media(epg)),tickets)&useLatestGames=true&fields=...`
- `api/v1/standings?leagueId={leagueIds}&season={season}&date={gameDate}&hydrate=division`
- `api/v1/uniforms/game?gamePks={gamePk}`
- `api/v1/people/{batterId}?hydrate=stats(group=batting,type=vsPlayerTotal,opposingPlayerId={pitcherId},season={season})`
- `api/v1/people?personIds={playerId}&season={season}&hydrate=stats(group=hitting,type=season,season={season},gameType={gameType})`

### Websocket endpoints

- `api/v1/game/push/subscribe/gameday/{gamePk}`
- `api/v1/game/push/subscribe/gameday/{gid}`
- `api/v1/game/push/subscribe/{gamePk}`
- `api/v1/game/push/subscribe/{gid}`

### BDFED / stitched content endpoints

- `bdfed/contentful/dictionary/mlb-gameday/{site}-JP`
- `bdfed/gameday-content/?locale={locale:en}&gamePk={gamePk}`
- `bdfed/gameday-content/?locale={locale:en}&gamePk={gamePk}&stitch_env=qa`
- `bdfed/gameday-team-comparison?homeId={homeId}&awayId={awayId}&gameType={gameType}&endDate={gameDate}`
- `bdfed/gameday/{locale:en-US}?gamePk={gamePk}&config=true&appContext={appContext}&stitch_env={stitchEnv}`
- `bdfed/matchup/{gamePk}?statList={statList}`
- `bdfed/playMetrics/{gamePk}?keyMoments={keyMoments}&scoringPlays={scoringPlays}&homeRuns={homeRuns}&strikeouts={strikeouts}&hardHits={hardHits}&highLeverage={highLeverage}&leadChange={leadChange}&winProb={winProb}&absChallenge={absChallenge}`
- `bdfed/spotlight-game/{locale:en-US}?gamePk={gamePk}`
- `bdfed/transform-mlb-postseason-mini-scoreboard`

### GraphQL endpoints

- `graphql/?operationName=getGamesByGamePks&{query}&variables={variables}`
- `graphql/?query={query}&variables={variables}`

### Story/content endpoints

- `{locale}/stories?tags.slug=gamepk-{gamePk}&$limit={limit:5}&$sort=contentDate:{sort:desc}`
- `{site}-us/stories?tags.slug=gamepk-{gid}&$limit={limit:10}&$sort=contentDate:{sort:desc}`

## Request / response examples

Examples below are reconstructed from visible templates and are marked as inferred.

### Live feed request

```http
GET https://statsapi.mlb.com/api/v1.1/game/123456/feed/live?language=en&timecode=20240401_190000
```

Inferred response shape:

```json
{
  "gameData": {},
  "liveData": {},
  "metaData": {}
}
```

### Schedule request

```http
GET https://statsapi.mlb.com/api/v1/schedule?gamePk=123456&language=en&hydrate=story,xrefId,lineups,broadcasts(all),probablePitcher(note),game(content(media(epg)),tickets)&useLatestGames=true
```

### Websocket subscription

```text
wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/gameday/123456
```

When an access token exists, the bundle can open the socket with websocket subprotocols:

```text
["gameday", "<access-token>"]
```

## Auth requirements

Visible auth behavior:

- Some requests use `Authorization: Bearer {accessToken}` headers
- Websocket connections may include the access token as a subprotocol
- User/login state is stored in `userinfo`, and access-token changes trigger an `ACCESS_TOKEN_CHANGE` pub/sub event

## Error handling

Confirmed patterns:

- Error boundaries wrap many React surfaces
- Websocket client tracks close/error states and reconnection attempts
- Local storage wrapper handles quota/cleanup failures by clearing namespace entries and retrying
- Some network promise chains swallow errors and return `{}` or `null`, so silent degradation is possible

## Rate limits

No explicit rate limits were visible in the provided code.

Visible cache/expiry hints:

- schedule endpoints often expire after `300`
- live feed endpoint visible with expiry `9`
- some websocket/default configs show timeout/expires around `30`

These are cache/timeout values, not confirmed provider rate limits.

## Endpoints that return or proxy `mlbstatic.com` asset URLs

No explicit proxy endpoint was found that rewrites `mlbstatic.com` assets through this bundle’s own backend.

What does occur:

- The bundle directly composes `mlbstatic.com` and `img.mlbstatic.com` asset URLs client-side.
- Some API payloads may carry MLB content IDs or related metadata that the client then turns into media/player/image URLs.

See [MLBSTATIC_RESOURCES.md](C:/Users/danny/Desktop/Fun/gd.min.js/MLBSTATIC_RESOURCES.md) for the client-side asset generation patterns.
