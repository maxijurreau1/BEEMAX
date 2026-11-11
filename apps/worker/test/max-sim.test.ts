import { describe, expect, it } from "vitest";
import { buildScenarioTree } from "../src/max-sim";

const node = (id: string, parentNodeId: string | null, depth: number) => ({
  id, parentNodeId, condition: id, probability: 50, impactVector: "unscored",
  flowDelta: 0, outcomeState: "NEUTRAL" as const, depth,
});

describe("MAX SIM scenario tree reconstruction", () => {
  it("reconstructs parents even when query rows are not parent-first", () => {
    const root = buildScenarioTree([
      node("child", "root", 1), node("root", null, 0), node("leaf", "child", 2),
    ]);
    expect(root?.children?.[0].children?.[0].id).toBe("leaf");
  });
  it("returns null for a completed run with no nodes", () => {
    expect(buildScenarioTree([])).toBeNull();
  });
  it("rejects orphans, multiple roots and invalid depths instead of returning partial evidence", () => {
    expect(() => buildScenarioTree([node("root", null, 0), node("orphan", "missing", 1)])).toThrow();
    expect(() => buildScenarioTree([node("a", null, 0), node("b", null, 0)])).toThrow();
    expect(() => buildScenarioTree([node("root", null, 0), node("child", "root", 3)])).toThrow();
  });
});
