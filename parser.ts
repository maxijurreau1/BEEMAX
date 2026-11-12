import type { Env } from "../mesh/durableObject";

export interface CommandResult {
  namespace: string;
  command: string;
  output: unknown;
  timestamp: string;
}

export async function executeTerminalCommand(raw: string, env: Env): Promise<CommandResult> {
  const trimmed = raw.trim();
  const [namespace, ...rest] = trimmed.split(":");
  const action = rest.join(":") || "status";
  const timestamp = new Date().toISOString();

  switch (namespace) {
    case "sys":
      return {
        namespace: "sys",
        command: action,
        output: {
          kernel: "BEEMAX-MICROKERNEL-v1",
          preTierIndex: env.PRE_TIER_INDEX || "IDX-PRETIER-001",
          protocol: env.PROTOCOL_VERSION || "DAT-JURREAUISM-v1",
          isolateCeiling: "128MB",
          status: "NOMINAL",
        },
        timestamp,
      };

    case "gov":
      return {
        namespace: "gov",
        command: action,
        output: {
          governors: ["dashboard.ts", "simulator.ts", "selfHealing.ts"],
          policySync: "LOCKED_AND_VERIFIED",
          selfHealing: "ARMED",
        },
        timestamp,
      };

    case "agent": {
      const id = env.BEEMAX_MESH_STATE.idFromName("ICV-ROOT-001");
      const stub = env.BEEMAX_MESH_STATE.get(id);
      const res = await stub.fetch("https://internal/status");
      const actorData = await res.json();
      return {
        namespace: "agent",
        command: action,
        output: actorData,
        timestamp,
      };
    }

    case "ont":
      return {
        namespace: "ont",
        command: action,
        output: {
          doctrine: "JURREAUISM",
          economicStandard: "DAT (Done All To That)",
          layers: ["Governors HUD", "Sovereign Art Gallery", "MAX Games & App Showroom"],
        },
        timestamp,
      };

    default:
      return {
        namespace: "unknown",
        command: trimmed,
        output: {
          error: "Unrecognized namespace. Use sys:*, gov:*, agent:*, or ont:*",
        },
        timestamp,
      };
  }
}
