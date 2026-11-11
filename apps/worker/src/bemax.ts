import { readUniverse } from "./universe-api.js";
import { staffIdentity } from "./access.js";
import { providers as listProviders } from "./providers.js";
import type { Env } from "./types.js";
import { substrateApi } from "./substrate-api.js";

export { bemaxApi } from "./bemax/index.js";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

/**
 * Preserve the compatibility endpoints used by older Portal clients while
 * delegating current BEMAX and USS behavior to their authoritative handlers.
 */
export async function compatibilityApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isCompatibilityPath =
    path.startsWith("/api/bemax") ||
    path.startsWith("/api/providers") ||
    path.startsWith("/api/governor") ||
    path.startsWith("/api/uss");
  if (!isCompatibilityPath) return null;

  const identity = await staffIdentity(request, env);
  if (!identity) return json({ error: "Staff sign-in required" }, 401);

  if (path.startsWith("/api/uss"))
    return (await substrateApi(request, env)) ?? json({ error: "USS route not found" }, 404);

  if (path === "/api/bemax/risks") {
    const alias = new URL(request.url);
    alias.pathname = "/api/bemax/risk";
    return (await (await import("./bemax/index.js")).bemaxApi(
      new Request(alias, request),
      env,
    )) ?? json({ error: "BEMAX route not found" }, 404);
  }

  if (path.startsWith("/api/bemax")) return null;

  if (path === "/api/providers/health" && request.method === "GET") {
    const providers = await listProviders(env);
    return json({
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        status: provider.status,
        healthStatus: provider.healthStatus,
        models: provider.models,
        capabilities: provider.capabilities,
        spentUsd: provider.spentUsd,
        reason: provider.reason,
      })),
    });
  }

  if (path === "/api/providers/models" && request.method === "GET") {
    const providers = await listProviders(env);
    return json({
      models: providers.flatMap((provider) =>
        provider.models.map((model) => ({
          providerId: provider.id,
          provider: provider.name,
          model,
          capabilities: provider.capabilities,
        })),
      ),
    });
  }

  if (path.startsWith("/api/providers"))
    return json({ error: "Provider route not found" }, 404);

  if (path.startsWith("/api/governor")) {
    if (identity.role !== "Governor")
      return json({ error: "Governor permission required" }, 403);
    if (request.method !== "GET")
      return json({ error: "Method not allowed" }, 405);

    const universe = await readUniverse(env);
    const riskProducts = universe.products.filter(
      (product) => Number(product.risk ?? 0) > 0 || product.status === "Attention",
    );
    const opportunities = universe.products
      .filter((product) => Boolean(product.promotionCandidate))
      .map((product) => ({
        id: product.id,
        name: product.name,
        score: product.score,
      }));
    const approvals = async () =>
      env.DB.prepare(
        `SELECT a.id, a.product_id AS productId, p.name AS project, a.action, a.status
         FROM approvals a JOIN products p ON p.id=a.product_id
         ORDER BY a.created_at DESC LIMIT 100`,
      ).all<{
        id: string;
        productId: string;
        project: string;
        action: string;
        status: string;
      }>();

    if (path === "/api/governor/approvals")
      return json({ approvals: (await approvals()).results });
    if (path === "/api/governor/risks")
      return json({
        risks: riskProducts.map((product) => ({
          id: product.id,
          name: product.name,
          risk: Number(product.risk ?? 0),
          severity: Number(product.risk ?? 0) > 50 ? "high" : "medium",
          source: product.status,
          confidence: Number(product.score ?? 0) > 0 ? "medium" : "low",
        })),
      });
    if (path === "/api/governor/summary")
      return json({
        criticalIssues: riskProducts.map((product) => ({
          id: product.id,
          name: product.name,
          risk: Number(product.risk ?? 0),
          stage: product.stage,
          status: product.status,
        })),
        approvals: (await approvals()).results,
        risks: riskProducts.map((product) => ({
          id: product.id,
          name: product.name,
          risk: Number(product.risk ?? 0),
        })),
        opportunities,
        recommendations: [],
      });
    return json({ error: "Governor route not found" }, 404);
  }
  return null;
}
