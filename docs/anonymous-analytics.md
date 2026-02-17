# Anonymous Analytics

GitPreflight tracks install and review usage with anonymous events only.

## Privacy guarantees

- We generate a random per-install identifier (`installId`) and store it locally at `~/.config/gitpreflight/install-id`.
- CLI and installer payloads include only `installId`.
- We do **not** send user IDs, emails, auth tokens, repo URLs, diffs, or file contents in these usage payloads.

## Endpoints

- `POST /api/v1/usage/install`
  - Body: `{ installId }`
- `POST /api/v1/usage/review`
  - Body: `{ installId }`

These are Convex HTTP endpoints. Each endpoint forwards a server-side PostHog capture event:

- `usage/install`
- `usage/review`

## Convex configuration

- `POSTHOG_API_KEY=phc_...` (required)
- `POSTHOG_HOST=https://us.i.posthog.com` (optional, default shown)

## Opt-out

Set either environment variable:

- `GITPREFLIGHT_ANON_TELEMETRY=0`
- `GITPREFLIGHT_DISABLE_ANON_TELEMETRY=1`

## Override usage endpoint host (CLI/installer)

- `GITPREFLIGHT_TELEMETRY_BASE_URL=https://your-gitpreflight-host`
- Falls back to `GITPREFLIGHT_API_BASE_URL` if set
- Default host: `https://gitpreflight.ai`
