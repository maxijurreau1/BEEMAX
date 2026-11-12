import type { Env } from "../mesh/durableObject";

export async function handleShowroomRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/showroom/api/catalog") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id, slug, title, category, version, runtime_target, status FROM showroom_apps ORDER BY created_at DESC LIMIT 50"
      ).all();
      return Response.json({ factory: "MAX-GAMES-FACTORY-V3", apps: results });
    } catch {
      return Response.json({
        factory: "MAX-GAMES-FACTORY-V3",
        apps: [
          { slug: "max-chess", title: "MAX Chess (MC-001)", category: "game", status: "active" },
          { slug: "max-quantm-sports", title: "MAX-QUANTM Sports Telemetry", category: "app", status: "active" },
          { slug: "uqct-sim", title: "UQCT Quantum Consciousness Sim", category: "quantum_sim", status: "active" },
        ],
      });
    }
  }

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MAX Games Factory V3.0 & App Showroom</title>
  <style>
    body { background: #0b0d10; color: #e6edf3; font-family: system-ui, sans-serif; padding: 32px; max-width: 960px; margin: 0 auto; }
    a { color: #38bdf8; text-decoration: none; margin-right: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 20px; }
    .card { background: #13171d; border: 1px solid #232a35; border-radius: 10px; padding: 18px; }
  </style>
</head>
<body>
  <nav><a href="/">← Governors HUD</a> <a href="/storefront">Art Gallery & Marketplace →</a></nav>
  <h1 style="margin-top:20px;">MAX Games Factory V3.0 & App Showroom</h1>
  <p style="color:#8b949e; margin-top:6px;">Edge-Native Interactive Engines, Quantum Simulations & Sovereign Applications</p>
  <div class="grid">
    <div class="card"><h3>MAX Chess (MC-001)</h3><p style="color:#8b949e;">Tournament engine & edge runtime.</p></div>
    <div class="card"><h3>MAX-QUANTM Sports</h3><p style="color:#8b949e;">Predictive multi-league sports telemetry.</p></div>
    <div class="card"><h3>UQCT Quantum Sim</h3><p style="color:#8b949e;">Unified Quantum Consciousness modeling.</p></div>
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
