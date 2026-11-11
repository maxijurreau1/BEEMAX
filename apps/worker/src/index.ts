import { Hono, type MiddlewareHandler } from 'hono'

type Bindings = {
  DB: D1Database;
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
    return c.json({ error: 'Rate limit exceeded. Please try again later.' },  429)
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

export { MicrokernelProcessActor } from './kernel'
export { ProductFactoryActor } from './factory'
export { InstantSpaceDurableObject } from './InstantSpaceDurableObject'
export default app
