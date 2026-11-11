import type { Env } from "./types";

export type ScenarioOutcome = "FAVORABLE" | "NEUTRAL" | "CRITICAL_RISK";
export interface ScenarioNode {
  id: string;
  condition: string;
  probability: number;
  impactVector: string;
  flowDelta: number;
  outcomeState: ScenarioOutcome;
  children?: ScenarioNode[];
}
export interface MaxSimRun {
  id: string;
  gameId: string;
  sport: string;
  baselineWinProb: number;
  createdAt: string;
}
interface StoredNode {
  id: string;
  parentNodeId: string | null;
  condition: string;
  probability: number;
  impactVector: string;
  flowDelta: number;
  outcomeState: ScenarioOutcome;
  depth: number;
}

/** Validate and reconstruct one bounded, already-fetched adjacency list. */
export function buildScenarioTree(rows: StoredNode[]): ScenarioNode | null {
  if (!rows.length) return null;
  if (rows.length > 500) throw new Error("Scenario tree exceeds the node limit");
  const nodes = new Map<string, ScenarioNode>();
  const metadata = new Map<string, StoredNode>();
  const roots: ScenarioNode[] = [];
  for (const row of rows) {
    if (!row.id || nodes.has(row.id) || !Number.isInteger(row.depth) || row.depth < 0 || row.depth > 16 ||
      !Number.isFinite(row.probability) || row.probability < 0 || row.probability > 100 ||
      !Number.isFinite(row.flowDelta) || row.flowDelta < -100 || row.flowDelta > 100 ||
      !["FAVORABLE", "NEUTRAL", "CRITICAL_RISK"].includes(row.outcomeState))
      throw new Error("Stored scenario node is invalid");
    const node: ScenarioNode = {
      id: row.id,
      condition: row.condition,
      probability: row.probability,
      impactVector: row.impactVector,
      flowDelta: row.flowDelta,
      outcomeState: row.outcomeState,
    };
    nodes.set(row.id, node);
    metadata.set(row.id, row);
    if (row.parentNodeId === null) {
      if (row.depth !== 0) throw new Error("Scenario root depth is invalid");
      roots.push(node);
    }
  }
  if (roots.length !== 1) throw new Error("Scenario run must have exactly one root node");
  for (const row of rows) {
    if (row.parentNodeId === null) continue;
    const parent = nodes.get(row.parentNodeId);
    const parentRow = metadata.get(row.parentNodeId);
    if (!parent || !parentRow || row.depth !== parentRow.depth + 1)
      throw new Error("Scenario node has a missing or invalid parent");
    (parent.children ??= []).push(nodes.get(row.id)!);
  }
  return roots[0];
}

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

/** Staff-gated route; request authorization is enforced by protectPortal before dispatch. */
export async function maxSimApi(request: Request, env: Env): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/max-sim\/games\/([^/]+)\/latest$/);
  if (!match) return null;
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  let gameId: string;
  try { gameId = decodeURIComponent(match[1]); } catch { return json({ error: "Invalid game ID" }, 400); }
  if (!gameId.trim() || gameId.length > 120 || /[\u0000-\u001f]/.test(gameId))
    return json({ error: "Invalid game ID" }, 400);

  const run = await env.DB.prepare(
    `SELECT id,game_id AS gameId,sport,baseline_win_prob AS baselineWinProb,created_at AS createdAt
     FROM max_sim_runs WHERE game_id=? AND status='COMPLETED'
     ORDER BY created_at DESC,id DESC LIMIT 1`,
  ).bind(gameId).first<MaxSimRun>();
  if (!run) return json({ run: null, rootNode: null });

  const result = await env.DB.prepare(
    `SELECT id,parent_node_id AS parentNodeId,condition,probability,
      impact_vector AS impactVector,flow_delta AS flowDelta,
      outcome_state AS outcomeState,depth
     FROM max_sim_nodes WHERE sim_run_id=? ORDER BY depth ASC,id ASC LIMIT 501`,
  ).bind(run.id).all<StoredNode>();
  if (result.results.length > 500)
    return json({ error: "Scenario tree exceeds the supported size" }, 500);
  try {
    return json({ run, rootNode: buildScenarioTree(result.results) });
  } catch {
    return json({ error: "Stored scenario tree is invalid" }, 500);
  }
}
