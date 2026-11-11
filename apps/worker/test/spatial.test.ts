import { describe, expect, it } from "vitest";
import { parseSpatialFrame, spatialSocketUrl } from "../../pages/src/spatial/protocol";

describe("Spatial HUD protocol", () => {
  it("routes secure HUD sockets to the configured Worker origin without query credentials", () => {
    expect(spatialSocketUrl("https://beemax.example.workers.dev", "https://portal.example/hud")).toBe("wss://beemax.example.workers.dev/api/space/ws");
  });
  it("uses the page origin only when no Worker API base was configured", () => {
    expect(spatialSocketUrl("", "https://portal.example/hud")).toBe("wss://portal.example/api/space/ws");
  });
  it("accepts only the existing ready, peer and leave frame contracts", () => {
    expect(parseSpatialFrame('{"type":"ready"}')).toEqual({ type: "ready" });
    expect(parseSpatialFrame('{"type":"peer","id":"peer-1","x":0.25,"y":0.75,"mode":"Active"}')).toEqual({ type: "peer", id: "peer-1", x: 0.25, y: 0.75, mode: "Active" });
    expect(parseSpatialFrame('{"type":"leave","id":"peer-1"}')).toEqual({ type: "leave", id: "peer-1" });
    expect(parseSpatialFrame('{"type":"peer","id":"x","x":3,"y":0,"mode":"Active"}')).toBeNull();
    expect(parseSpatialFrame("not json")).toBeNull();
  });
});
