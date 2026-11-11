# Public Marketplace storefront deployment

This deploys the separate customer-facing storefront in `apps/marketplace` and its public API Worker. It does not replace the Portal OS1 Pages project or its private Worker.

## Cloudflare setup without a custom domain

This setup uses the Pages hostname `https://max-games.pages.dev` and the Marketplace Worker `workers.dev` hostname. It does not require a Cloudflare zone. The Marketplace frontend reads the API base from the Pages build variable `VITE_API_BASE`.

1. In Cloudflare Pages, create or open the **`max-games`** project connected to this repository. Configure:
   - Root directory: `/` (repository root)
   - Build command: `npm ci && npm run build:marketplace`
   - Build output directory: `apps/marketplace/dist`
   - Node.js version: `22.12` or later
   - Production build variable: `VITE_API_BASE=https://market-place.maxgamesfactoryv3-1.workers.dev`
2. Deploy the Marketplace API Worker from the repository root with `npx wrangler deploy --config wrangler.marketplace.toml`. This config intentionally has no `routes` entry, so it deploys to `workers.dev` without requiring a zone. It allows requests from `https://max-games.pages.dev` via `MARKETPLACE_ORIGIN`.
3. The expected Marketplace Worker URL for the selected Cloudflare account is `https://market-place.maxgamesfactoryv3-1.workers.dev`. Confirm the URL shown after deployment matches, then rebuild/redeploy Pages after setting the exact `VITE_API_BASE` value; Vite variables are embedded at build time.
4. Confirm that the Worker and Pages project use Cloudflare account `cfbebee3f0343be6fb2ed557bd4da8a1` and that the configured D1 database is the intended production database. The marketplace shares D1 with the Portal Worker; do not create a replacement database or run demo seed data remotely.

The `pages.dev` + `workers.dev` arrangement is suitable for testing the public catalog/API. Customer sign-in relies on browser cookies across the Pages and Worker hostnames; browser third-party-cookie restrictions may prevent sign-in from working reliably. Production customer sessions, checkout, and downloads should use a custom domain with a same-origin API route and the trusted adapters described below.

## Validate and deploy

Run checks before release:

```sh
npm ci
npm run typecheck
npm test
npm run build:marketplace
npx wrangler deploy --dry-run --config wrangler.marketplace.toml
```

Then deploy the API and storefront:

```sh
npx wrangler deploy --config wrangler.marketplace.toml
npm run deploy:marketplace:pages
```

Or configure the Pages project to build from Git on each push and deploy the Worker explicitly after reviewing changes. The Pages project build command is intentionally storefront-only; the root `npm run build` also builds the Portal Pages app.

## Production readiness limits

The public catalog can display verified releases already projected into the marketplace tables. Empty catalog data is expected until a real release is published; no production seed or invented listings are included. Customer sign-in, paid checkout, and downloads will remain unavailable until trusted identity, payment, and download bindings are configured. Do not put credentials in Pages build variables or browser code. Complete the documented moderation, rate-limiting, payment-provider and artifact-delivery operational checks before enabling unrestricted public commerce.
