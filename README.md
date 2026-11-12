# BEEMAX & PORTAL-OS1 Unified Edge Repository

**Pre-Tier Index:** `IDX-PRETIER-001`  
**Protocol Doctrine:** `JURREAUISM / DAT ("Done All To That")`  
**Target Runtime:** Cloudflare Workers, SQLite-Backed Durable Objects & Cloudflare D1

## Overview
This unified repository merges all three architectural layers into a single zero-collision Cloudflare Worker deployment:
1. **Layer 1 — Unified Configuration (`wrangler.toml`)**: Binds SQLite-backed Durable Objects (`CognitiveNodeActor`) and a unified Cloudflare D1 database (`DB`).
2. **Layer 2 — Merged D1 SQL Schema (`src/database/schema.sql`)**: Combines microkernel audit indices (`IDX-PRETIER-001`) with the Sovereign Art Catalog (`artworks`, `artwork_editions`), Multi-Sig Escrow (`marketplace_orders`, `escrow_signatures`), and SHA-256 Provenance Certificates (`provenance_certificates`).
3. **Layer 3 — Unified Edge Entry Router (`src/index.ts`)**: Serves the conversational **Governors Dashboard & Terminal HUD** at `/`, the **Sovereign Art Gallery & DAT Marketplace** at `/storefront/*`, the **MAX Games Factory & App Showroom** at `/showroom/*`, and the **Zero-Copy ICV Mesh** at `/mesh/*`.

## Quick Deployment (Bypasses GitHub UI Build Glitches)
```bash
npm install
npx wrangler login
npx wrangler d1 create beemax-db # Copy database_id into wrangler.toml
npm run db:migrate:remote
npm run deploy
```
