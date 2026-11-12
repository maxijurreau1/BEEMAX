import { CognitiveNodeActor, type Env } from "./mesh/durableObject";
import { renderGovernorsDashboardHTML } from "./governors/dashboard";
import { executeTerminalCommand } from "./terminal/parser";
import { handleStorefrontRequest } from "./storefront/gallery";
import { handleShowroomRequest } from "./storefront/showroom";

export { CognitiveNodeActor };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. PORTAL-OS1 Governors HUD (Root)
    if (path === "/" || path === "/hud") {
      return new Response(renderGovernorsDashboardHTML(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 2. Terminal CLI Command Execution Endpoint
    if (path === "/api/terminal" && request.method === "POST") {
      const body = (await request.json()) as { command?: string };
      const result = await executeTerminalCommand(body.command || "sys:status", env);
      return Response.json(result);
    }

    // 3. Sovereign Art Gallery & DAT Marketplace
    if (path === "/storefront" || path.startsWith("/storefront/")) {
      return handleStorefrontRequest(request, env);
    }

    // 4. MAX Games Factory V3.0 & App Showroom
    if (path === "/showroom" || path.startsWith("/showroom/")) {
      return handleShowroomRequest(request, env);
    }

    // 5. Zero-Copy ICV Cognitive Mesh Actor Routing
    if (path === "/mesh/spawn" || path.startsWith("/mesh/")) {
      const icvName = url.searchParams.get("icv") || "ICV-ROOT-001";
      const id = env.BEEMAX_MESH_STATE.idFromName(icvName);
      const stub = env.BEEMAX_MESH_STATE.get(id);
      const targetAction = path.endsWith("/status") ? "status" : "deploy-icv";

      return stub.fetch(
        new Request(`https://internal/${targetAction}`, {
          method: request.method,
          headers: request.headers,
          body: request.method === "POST" ? request.body : undefined,
        })
      );
    }

    return new Response("BEEMAX-PORTAL-OS1 Unified Edge Runtime — 404 Not Found", {
      status: 404,
    });
  },
};
