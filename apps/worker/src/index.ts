import { captureIntelligence } from "./universe-api";
import { reconcileCompensation } from "./execution";
import { protectPortal, auditAccess } from "./access";
import kernel from "./kernel";
import { routeApi } from "./routes/api";
import { bemaxApi, compatibilityApi } from "./bemax";
import { createEdgeRuntime } from "./runtime";
import type { Env } from "./types";
export { ProductFactoryActor } from "./factory";
export { MicrokernelProcessActor } from "./kernel";
export { InstantSpaceDurableObject } from "./InstantSpaceDurableObject";

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(captureIntelligence(env));
    ctx.waitUntil(reconcileCompensation(env));
    ctx.waitUntil((async () => {
      if (!env.FACTORY_ACTOR) return;
      const ideas = await env.DB.prepare(
        `SELECT p.id FROM products p WHERE (p.stage IN ('Idea','Discovery','Validation') OR
        (p.stage='Build' AND EXISTS (SELECT 1 FROM factory_runs r WHERE r.product_id=p.id AND r.status IN ('running','blocked'))))
        AND length(trim(p.description)) >= 20 AND length(trim(p.name)) >= 2
        AND NOT EXISTS (SELECT 1 FROM workflow_events e WHERE e.product_id=p.id)
        ORDER BY p.updated_at,p.id LIMIT 50`,
      ).all<{ id: string }>();
      await Promise.all(ideas.results.map(async ({ id }) => {
        const response = await env.FACTORY_ACTOR!.get(env.FACTORY_ACTOR!.idFromName(id))
          .fetch("https://factory.internal/run", { method: "POST", body: JSON.stringify({ productId: id }) });
        if (!response.ok) throw new Error(`ICVS reconciliation failed: ${response.status}`);
      }));
    })());
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim());
    const originIsAllowed = Boolean(origin && (origin === requestUrl.origin || allowed.includes(origin)));
    const headers = new Headers({ Vary: "Origin", "Cache-Control": "no-store" });
    if (origin && originIsAllowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (origin && !originIsAllowed)
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (path === "/api/space/ws") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers });
      if (!env.INSTANT_SPACE) return Response.json({ error: "Spatial sync unavailable" }, { status: 503, headers });
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return new Response("Expected Upgrade: websocket", { status: 426, headers });
      const objectId = env.INSTANT_SPACE.idFromName("portal-os1-spatial-space");
      return env.INSTANT_SPACE.get(objectId).fetch(request);
    }
import { Hono, type MiddlewareHandler } from 'hono'

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  GOVERNOR_API_TOKEN?: string;
  QAL_SECRET?: string;
  CF_CONNECTING_IP?: string;
}

type AppEnv = { Bindings: Bindings }

const app = new Hono<AppEnv>()

// Keep a small per-isolate sliding window without depending on an unmigrated D1 table.
const rateLimitRequests = new Map<string, number[]>()
const publicRateLimiter: MiddlewareHandler<AppEnv> = async (c, next) => {
  const clientIp = c.req.header('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  const windowStart = now - 60_000
  const recentRequests = (rateLimitRequests.get(clientIp) ?? []).filter(
    (timestamp) => timestamp >= windowStart,
  )

  if (recentRequests.length >= 30) {
    rateLimitRequests.set(clientIp, recentRequests)
    return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429)
  }

  recentRequests.push(now)
  rateLimitRequests.set(clientIp, recentRequests)
  await next()
}

function equalSecret(candidate: string, secret: string): boolean {
  const encoder = new TextEncoder()
  const candidateBytes = encoder.encode(candidate)
  const secretBytes = encoder.encode(secret)
  let difference = candidateBytes.length ^ secretBytes.length
  const length = Math.max(candidateBytes.length, secretBytes.length)

  for (let index = 0; index < length; index += 1) {
    difference |=
      (candidateBytes[index] ?? 0) ^ (secretBytes[index] ?? 0)
  }
  return difference === 0
}

// ==========================================
// QAL AUTHENTICATION MIDDLEWARE (Private)
// ==========================================
const qalAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const secret = c.env.QAL_SECRET
  const authorization = c.req.header('Authorization')
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i)

  // Fail closed when the secret is not configured or the bearer token is invalid.
  if (!secret || !match || !equalSecret(match[1], secret)) {
    return c.json({ error: 'Unauthorized: Invalid or missing QAL credentials' }, 401)
  }
  await next()
}

// ==========================================
// PUBLIC CATALOG ENDPOINT (Sanitized & Rate-Limited)
// ==========================================
app.get('/api/catalog', publicRateLimiter, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, category, price_minor, vector_metadata, created_at
       FROM catalog_items ORDER BY created_at DESC`,
    ).all()

    return c.json({ success: true, assets: results })
  } catch {
    return c.json({ success: false, error: 'Failed to fetch public catalog' }, 500)
  }
})

app.get('/api/marketplace/items', publicRateLimiter, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM marketplace_items').all()
    return c.json(results)
  } catch {
    return c.json({ error: 'Failed to fetch marketplace items' }, 500)
  }
})

// ==========================================
// PROTECTED NODE TELEMETRY ENDPOINT (QAL Required)
// ==========================================
app.get('/api/node/telemetry', qalAuthMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT user_id, vector_type, composite_score, metadata, created_at
       FROM subconscious_telemetry_log ORDER BY created_at DESC`,
    ).all()

    return c.json({ success: true, restricted_telemetry: results })
  } catch {
    return c.json({ success: false, error: 'Failed to fetch node telemetry' }, 500)
  }
})

// ==========================================
// PROTECTED ASSET MINTING ENDPOINT (QAL Required)
// ==========================================
app.post('/api/catalog/mint', qalAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json<{
      title?: unknown;
      category?: unknown;
      price_minor?: unknown;
      vector_metadata?: unknown;
    }>()

    if (
      typeof body.title !== 'string' || !body.title.trim() ||
      typeof body.category !== 'string' || !body.category.trim() ||
      !Number.isSafeInteger(body.price_minor) ||
      (body.price_minor as number) < 0 ||
      (body.vector_metadata !== undefined && typeof body.vector_metadata !== 'string')
    ) {
      return c.json({ success: false, error: 'Invalid catalog item fields' }, 400)
    }

    // The Worker hosts the built Pages app and leaves existing API and simulation routes intact.
    // Cloudflare's SPA asset handling serves index.html for client-side routes such as /hud.
    if (!path.startsWith("/api/") && !path.startsWith("/sim/") && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    try {
      const access = await protectPortal(request, env);
      if (access instanceof Response) {
        ctx.waitUntil(auditAccess(env, request, null, access.status));
        headers.forEach((value, key) => access.headers.set(key, value));
        return access;
      }

      // Simulation mutation and replay export stay behind the existing Portal access control.
      if (path === "/sim/tick" && request.method === "POST") {
        const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
        if (declaredLength > 65_536) return Response.json({ success: false, error: "Payload too large" }, { status: 413, headers });
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body))
          return Response.json({ success: false, error: "Expected a JSON object state" }, { status: 400, headers });
        const tick = createEdgeRuntime(env).simulation.executeTick(body as Record<string, unknown>);
        ctx.waitUntil(auditAccess(env, request, access, 200));
        return Response.json({ success: true, tick }, { headers });
      }
      if (path === "/sim/provenance" && request.method === "GET") {
        return Response.json({ provenance: createEdgeRuntime(env).simulation.getReplayProvenance() }, { headers });
      }

      const compat = path.startsWith("/api/bemax") || path.startsWith("/api/providers") || path.startsWith("/api/governor") || path.startsWith("/api/uss")
        ? await compatibilityApi(request, env) : null;
      const upstream = path === "/api/session" ? Response.json(access)
        : compat ?? (path.startsWith("/api/bemax")
          ? (await bemaxApi(request, env)) ?? (await routeApi(request, env))
          : !path.startsWith("/api/") || path.startsWith("/api/kernel/")
            ? await kernel.fetch(request, env, ctx) : await routeApi(request, env));
      if (request.method !== "GET") ctx.waitUntil(auditAccess(env, request, access, upstream.status));
      const response = new Response(upstream.body, upstream);
      response.headers.delete("Access-Control-Allow-Origin");
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[portal-os1] worker request failure", {
        method: request.method, url: request.url, bindingNames: Object.keys(env ?? {}),
        message: err.message, stack: err.stack ?? "",
        sql: typeof (error as any)?.cause === "object" && "sql" in ((error as any).cause ?? {}) ? String((error as any).cause.sql) : undefined,
      });
      return Response.json({ error: "Portal data is unavailable" }, { status: 500, headers });
    const item = {
      id: crypto.randomUUID(),
      title: body.title.trim(),
      category: body.category.trim(),
      price_minor: body.price_minor as number,
      vector_metadata: body.vector_metadata ?? null,
      created_at: Math.floor(Date.now() / 1000),
    }

    await c.env.DB.prepare(
      `INSERT INTO catalog_items (id, title, category, price_minor, vector_metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      item.id,
      item.title,
      item.category,
      item.price_minor,
      item.vector_metadata,
      item.created_at,
    ).run()

    return c.json({ success: true, message: 'Catalog item created.', item }, 201)
  } catch {
    return c.json({ success: false, error: 'Internal server error during catalog item creation' }, 500)
  }
})

// Catch unmatched API requests before the asset fallback.
app.all('/api', (c) => c.json({ error: 'API route not found' }, 404))
app.all('/api/*', (c) => c.json({ error: 'API route not found' }, 404))

// Serve the built frontend for page routes and static assets.
app.all('*', async (c) => c.env.ASSETS.fetch(c.req.raw))

export { MicrokernelProcessActor } from './kernel'
export { ProductFactoryActor } from './factory'
export { InstantSpaceDurableObject } from './InstantSpaceDurableObject'
export default app
