import { BriefService } from "./briefs/index.js";
import { RiskService } from "./risks/index.js";
import { OpportunityService } from "./opportunities/index.js";
import { PortfolioService } from "./portfolio/index.js";
import { RecommendationService } from "./recommendations/index.js";
import { CommandRouter } from "./commands/router.js";
import { MemoryStore } from "./memory/index.js";
import { EvidenceService } from "./evidence/index.js";
import { staffIdentity } from "../access.js";
import { readObject } from "../customer-auth.js";
import type { Env } from "../types.js";

const json = (value: unknown, status = 200) => Response.json(value, { status });

export async function bemaxApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/bemax")) return null;

  const identity = await staffIdentity(request, env);
  if (!identity) {
    return json({ error: "Staff sign-in required" }, 401);
  }

  const briefService = new BriefService(env);
  const riskService = new RiskService(env);
  const opportunityService = new OpportunityService(env);
  const portfolioService = new PortfolioService(env);
  const recommendationService = new RecommendationService(env);
  const commandRouter = new CommandRouter();
  const memoryStore = new MemoryStore();
  const evidenceService = new EvidenceService();

  try {
    if (path === "/api/bemax/summary" && request.method === "GET") {
      const [portfolio, risks, opportunities, recommendations] = await Promise.all([
        portfolioService.getSnapshot(),
        riskService.getRisks(),
        opportunityService.getOpportunities(),
        recommendationService.getRecommendations(),
      ]);

      return json({
        schemaVersion: 1,
        actorId: identity.id,
        role: identity.role,
        generatedAt: new Date().toISOString(),
        portfolio,
        openRisks: risks,
        openOpportunities: opportunities,
        recommendedActions: recommendations,
      });
    }

    if (path === "/api/bemax/daily-brief" && request.method === "GET") {
      const brief = await briefService.getDailyBrief();
      memoryStore.add("brief", { brief, actorId: identity.id });
      return json({ schemaVersion: 1, brief });
    }

    if (path === "/api/bemax/risk" && request.method === "GET") {
      const risks = await riskService.getRisks();
      return json({ schemaVersion: 1, risks, count: risks.length, sampledAt: new Date().toISOString() });
    }

    if (path === "/api/bemax/opportunities" && request.method === "GET") {
      const opportunities = await opportunityService.getOpportunities();
      return json({ schemaVersion: 1, opportunities, count: opportunities.length, sampledAt: new Date().toISOString() });
    }

    if (path === "/api/bemax/portfolio" && request.method === "GET") {
      const portfolio = await portfolioService.getSnapshot();
      return json({ schemaVersion: 1, portfolio, sampledAt: new Date().toISOString() });
    }

    if (path === "/api/bemax/recommendations" && request.method === "GET") {
      const recommendations = await recommendationService.getRecommendations();
      return json({ schemaVersion: 1, recommendations, sampledAt: new Date().toISOString() });
    }

    if (path === "/api/bemax/commands" && request.method === "POST") {
      const body = (await readObject(request).catch(() => ({ command: "daily-brief" }))) as Record<string, unknown>;
      const payload =
        typeof body.payload === "object" && body.payload !== null && !Array.isArray(body.payload)
          ? (body.payload as Record<string, unknown>)
          : {};
      const result = commandRouter.route(String(body.command ?? "daily-brief"), payload);
      memoryStore.add("recommendation", { result, actorId: identity.id });
      return json({ schemaVersion: 1, result }, 202);
    }

    if (path === "/api/bemax/evidence" && request.method === "POST") {
      const body = (await readObject(request).catch(() => ({ entityId: "unknown", source: "portal", metric: "status", value: 0 }))) as Record<string, unknown>;
      const value = typeof body.value === "number" || typeof body.value === "string" ? body.value : 0;
      const item = evidenceService.collect(
        String(body.entityId ?? "unknown"),
        String(body.source ?? "portal"),
        String(body.metric ?? "status"),
        value,
      );
      memoryStore.add("brief", { evidence: item, actorId: identity.id });
      return json({ schemaVersion: 1, evidence: item }, 201);
    }

    if (path === "/api/bemax/memory" && request.method === "GET") {
      return json({ schemaVersion: 1, memory: memoryStore.list() });
    }

    return json({ error: "BEMAX route not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
}

export { BriefService } from "./briefs/index.js";
export { RiskService } from "./risks/index.js";
export { OpportunityService } from "./opportunities/index.js";
export { PortfolioService } from "./portfolio/index.js";
export { RecommendationService } from "./recommendations/index.js";
export { CommandRouter } from "./commands/router.js";
export { MemoryStore } from "./memory/index.js";
export { EvidenceService } from "./evidence/index.js";
