import { Hono } from 'hono'

type Bindings = {
  DB: D1Database;
  QAL_SECRET: string;
  CF_CONNECTING_IP?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 1. RATE LIMITING MIDDLEWARE (Public API)
// ==========================================
const publicRateLimiter = async (c: any, next: any) => {
  const clientIp = c.req.header('CF-Connecting-IP') || '127.0.0.1'
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - 60 // 1-minute sliding window

  try {
    await c.env.DB.prepare(
      `DELETE FROM rate_limits WHERE timestamp < ?`
    ).bind(windowStart).run()

    const { results } = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM rate_limits WHERE ip = ? AND timestamp >= ?`
    ).bind(clientIp, windowStart).all()

    const requestCount = (results[0] as any)?.count || 0

    if (requestCount >= 30) {
      return c.json({ error: "Rate limit exceeded. Please try again later." }, 429)
    }

    await c.env.DB.prepare(
      `INSERT INTO rate_limits (ip, timestamp) VALUES (?, ?)`
    ).bind(clientIp, now).run()
  } catch (err) {
    console.error("Rate limiter warning:", err)
  }

  await next()
}

// ==========================================
// 2. QAL AUTHENTICATION MIDDLEWARE (Private)
// ==========================================
const qalAuthMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('X-QAL-Signature') || c.req.header('Authorization')
  const secret = c.env.QAL_SECRET

  if (!authHeader || authHeader !== secret) {
    return c.json({ error: "Unauthorized: Invalid or missing QAL credentials" }, 401)
  }
  await next()
}

// ==========================================
// 3. PUBLIC CATALOG ENDPOINT (Sanitized & Rate-Limited)
// ==========================================
app.get('/api/catalog', publicRateLimiter, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, category, creator, quantum_hash, created_at FROM planetary_assets ORDER BY created_at DESC`
    ).all()

    return c.json({
      success: true,
      assets: results
    })
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch public catalog" }, 500)
  }
})

// ==========================================
// 4. PROTECTED NODE TELEMETRY ENDPOINT (QAL Required)
// ==========================================
app.get('/api/node/telemetry', qalAuthMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT node_id, region, dat_balance, status, last_heartbeat FROM node_telemetry`
    ).all()

    return c.json({
      success: true,
      restricted_telemetry: results
    })
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch node telemetry" }, 500)
  }
})

// ==========================================
// 5. PROTECTED ASSET MINTING ENDPOINT (QAL Required)
// ==========================================
app.post('/api/catalog/mint', qalAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { title, category, creator, quantum_hash } = body

    if (!title || !category || !creator || !quantum_hash) {
      return c.json({ success: false, error: "Missing required asset fields" }, 400)
    }

    await c.env.DB.prepare(
      `INSERT INTO planetary_assets (title, category, creator, quantum_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(title, category, creator, quantum_hash).run()

    return c.json({
      success: true,
      message: "Asset successfully minted to edge D1.",
      asset: { title, category, creator, quantum_hash }
    }, 201)
  } catch (error) {
    return c.json({ success: false, error: "Internal server error during asset minting" }, 500)
  }
})

export default app
