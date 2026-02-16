# Anonymous Analytics

GitPreflight tracks install vs trigger conversion using anonymous events only.

## Privacy guarantees

- We generate a random per-install identifier (`installId`) and store it locally at `~/.config/gitpreflight/install-id`.
- We do **not** send or store user IDs, emails, auth tokens, repo URLs, diffs, or file contents for these events.
- Event payloads only include:
  - `installId` (random ID)
  - event type metadata (`channel` or `mode`)
  - CLI version
  - platform/architecture
  - timestamp

## Endpoints

These endpoints are hosted by the web app and forward events to Convex.

- `POST /api/v1/analytics/install`
  - Body: `{ installId, channel, cliVersion?, platform?, arch? }`
- `POST /api/v1/analytics/trigger`
  - Body: `{ installId, mode, localAgent, status?, cliVersion?, platform?, arch? }`

Public read endpoint (for dashboards/landing pages):

- `GET /api/v1/analytics/summary`
  - Optional query: `?days=30` (1..3650)
  - Returns aggregate counts only: installs, activated installs, triggers, unique triggering installs, conversion rate.

Metric definitions:

- `installs`: installs first seen in the selected window (or all time when `days` is omitted)
- `activatedInstalls`: installs in that set with at least one trigger recorded
- `triggers`: total trigger events in the selected window
- `conversionRate`: `activatedInstalls / installs`

Example:

```bash
curl -fsSL "https://gitpreflight.ai/api/v1/analytics/summary?days=30"
```

## Convex storage

- `anonymousInstalls`: one row per install ID (upserted)
- `anonymousTriggers`: one row per trigger event

## Opt-out

Set either environment variable:

- `GITPREFLIGHT_ANON_TELEMETRY=0`
- `GITPREFLIGHT_DISABLE_ANON_TELEMETRY=1`

## Override analytics host

- `GITPREFLIGHT_TELEMETRY_BASE_URL=https://your-gitpreflight-host`
- Falls back to `GITPREFLIGHT_API_BASE_URL` if set
- Default host: `https://gitpreflight.ai`
