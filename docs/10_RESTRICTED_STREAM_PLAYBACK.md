# Restricted Stream playback for Portal HUD

Portal HUD staff can request short-lived playback authorization for a configured Cloudflare Stream video. The Stream API token remains a Worker secret and is never sent to Pages. The signed playback URL itself is a bearer credential and can be shared until its five-minute expiry; do not log it or expose it outside the authenticated HUD.

## Configure the `beemax` Worker

In Workers & Pages → `beemax` → Settings → Variables and Secrets, set these production variables:

- `CF_STREAM_ACCOUNT_ID`: Cloudflare account ID.
- `CF_STREAM_VIDEO_UID`: UID of the existing Stream video or live input.
- `CF_STREAM_CUSTOMER_CODE`: `customer-<CODE>` host code from that Stream playback configuration; enter only the `<CODE>` portion.
- `CF_STREAM_API_TOKEN`: add as a Worker **secret**, scoped to the minimum Stream permission needed to create signed playback tokens. Never set this on Pages or commit it.

The authenticated endpoint is `GET /api/stream/token`. It issues a five-minute signed token for the configured video and returns HLS and hosted-player URLs with `Cache-Control: no-store`. Until all four settings exist, it responds `503`. The HUD refreshes playback authorization before it expires. It uses native HLS where available and the hosted player iframe otherwise.

Set Portal Pages production `VITE_API_URL` to `https://beemax.maxgamesfactoryv3-1.workers.dev` and redeploy Pages. Do not configure this playback on the public Marketplace Worker.

This endpoint signs playback access for an already provisioned video/live input. It does not create live inputs, ingest an OBS feed, or provide a telemetry data stream. A signed playback URL is a short-lived bearer URL: staff authentication gates issuance, but a recipient could replay a URL until it expires. Apply Stream allowed-origin restrictions as an additional control where appropriate.

## Verify

- Anonymous requests to `/api/stream/token` return `401`; an authenticated staff request returns `503` until configured.
- After configuration, verify token expiry, playback, HLS and hosted-player behavior, autoplay restrictions, refresh, network failure, and sign-out.
- Confirm audit records capture access outcomes, and no secret or signed playback URL is written to application logs.
