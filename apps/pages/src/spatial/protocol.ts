export interface SpatialCursor {
  id: string;
  x: number;
  y: number;
  mode: string;
}

export type SpatialFrame =
  | { type: "ready" }
  | ({ type: "peer" } & SpatialCursor)
  | { type: "leave"; id: string };

/** Build the WebSocket endpoint from the configured Worker API origin. */
export function spatialSocketUrl(apiBase: string, pageUrl: string): string {
  const base = apiBase.trim() ? new URL(apiBase) : new URL(pageUrl);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/api/space/ws";
  base.search = "";
  base.hash = "";
  return base.toString();
}

/** Parse only frames supported by the current Durable Object protocol. */
export function parseSpatialFrame(raw: string): SpatialFrame | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const frame = value as Record<string, unknown>;
  if (frame.type === "ready") return { type: "ready" };
  if (frame.type === "leave" && typeof frame.id === "string")
    return { type: "leave", id: frame.id };
  if (
    frame.type === "peer" &&
    typeof frame.id === "string" &&
    typeof frame.x === "number" && Number.isFinite(frame.x) && frame.x >= 0 && frame.x <= 1 &&
    typeof frame.y === "number" && Number.isFinite(frame.y) && frame.y >= 0 && frame.y <= 1 &&
    typeof frame.mode === "string"
  )
    return { type: "peer", id: frame.id, x: frame.x, y: frame.y, mode: frame.mode };
  return null;
}
