import type { Env } from "../mesh/durableObject";

export async function handleStorefrontRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/storefront/api/artworks") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id, title, medium, dimensions, price_cents, currency, status, edition_number, total_editions FROM artworks ORDER BY created_at DESC LIMIT 50"
      ).all();
      return Response.json({ protocol: "DAT-JURREAUISM-v1", artworks: results });
    } catch {
      return Response.json({
        protocol: "DAT-JURREAUISM-v1",
        note: "Run D1 schema migration to populate live catalog",
        artworks: [],
      });
    }
  }

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MAXJ // Sovereign Art Gallery & DAT Marketplace</title>
  <style>
    body { background: #0b0d10; color: #e6edf3; font-family: system-ui, sans-serif; padding: 32px; max-width: 960px; margin: 0 auto; }
    a { color: #38bdf8; text-decoration: none; margin-right: 16px; }
    .card { background: #13171d; border: 1px solid #232a35; border-radius: 10px; padding: 20px; margin-top: 20px; }
  </style>
</head>
<body>
  <nav><a href="/">← Governors HUD</a> <a href="/showroom">Games & App Showroom →</a></nav>
  <h1 style="margin-top:20px;">MAXJ // Sovereign Art Gallery & DAT Marketplace</h1>
  <p style="color:#8b949e; margin-top:6px;">JURREAUISM Aesthetic Doctrine · Multi-Sig Escrow & SHA-256 Provenance Ledger</p>
  <div class="card">
    <h3>API Endpoints Active</h3>
    <ul>
      <li><code>GET /storefront/api/artworks</code> — Master Artwork Catalog & 1-of-N Edition Slots</li>
    </ul>
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
