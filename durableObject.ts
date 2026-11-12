import { DurableObject } from "cloudflare:workers";
import { ZeroCopyMemoryPool } from "../kernel/memory";

export interface Env {
  BEEMAX_MESH_STATE: DurableObjectNamespace;
  DB: D1Database;
  PROTOCOL_VERSION: string;
  PRE_TIER_INDEX: string;
}

export class CognitiveNodeActor extends DurableObject<Env> {
  private pool: ZeroCopyMemoryPool;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.pool = new ZeroCopyMemoryPool(65536);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS icv_checkpoints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          icv_tag TEXT NOT NULL,
          byte_offset INTEGER NOT NULL,
          byte_length INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop();

    if (action === "deploy-icv" && request.method === "POST") {
      const payload = await request.arrayBuffer();
      const icvTag = request.headers.get("x-icv-tag") || "ICV-ROOT-001";
      const { offset, length } = this.pool.allocate(payload);

      this.ctx.storage.sql.exec(
        "INSERT INTO icv_checkpoints (icv_tag, byte_offset, byte_length, created_at) VALUES (?, ?, ?, ?)",
        icvTag,
        offset,
        length,
        new Date().toISOString()
      );

      return Response.json({
        status: "DEPLOYED",
        nodeId: this.ctx.id.toString(),
        icvTag,
        zeroCopyPointer: { offset, length },
        memory: this.pool.stats(),
        timestamp: Date.now(),
      });
    }

    if (action === "status") {
      const rows = this.ctx.storage.sql
        .exec("SELECT COUNT(*) as count FROM icv_checkpoints")
        .one();
      return Response.json({
        status: "ACTIVE",
        nodeId: this.ctx.id.toString(),
        checkpoints: rows?.count ?? 0,
        memory: this.pool.stats(),
      });
    }

    return new Response("CognitiveNodeActor Edge Active", { status: 200 });
  }
}
