import type { Env } from "./types";

export type StaffRole = "Governor" | "Admin" | "Operator" | "Read Only";
export interface StaffIdentity {
  id: string;
  role: StaffRole;
}
interface AutomationIdentity {
  id: string;
  role: "Automation";
}
const roles: StaffRole[] = ["Governor", "Admin", "Operator", "Read Only"];
const DEV_BYPASS_TOKEN = "dev-bypass";

type StaffCredential = { id: string; role: StaffRole; tokenSha256: string };

function isProduction(env: Env): boolean {
  return [env.ENV, env.ENVIRONMENT].some((value) => value?.toLowerCase() === "production");
}

function isLocalDevelopmentRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

export async function sha256(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseStaffCredentials(value: string | undefined): StaffCredential[] | null {
  if (!value?.trim()) return null;
  try {
    const configured: unknown = JSON.parse(value);
    if (!Array.isArray(configured) || configured.length === 0 || configured.length > 100) return null;
    const result: StaffCredential[] = [];
    for (const entry of configured) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        entry.id.trim().length === 0 ||
        entry.id.length > 120 ||
        typeof entry.role !== "string" ||
        !roles.includes(entry.role as StaffRole) ||
        typeof entry.tokenSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(entry.tokenSha256)
      ) return null;
      result.push({ id: entry.id, role: entry.role as StaffRole, tokenSha256: entry.tokenSha256 });
    }
    return result;
  } catch {
    return null;
  }
}

function hasStaffConfiguration(env: Env): boolean {
  return Boolean(env.GOVERNOR_API_TOKEN?.trim()) || parseStaffCredentials(env.STAFF_CREDENTIALS) !== null;
}

export async function staffIdentity(
  request: Request,
  env: Env,
): Promise<StaffIdentity | null> {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ") || header.length > 4096) return null;
  const token = header.slice(7);
  if (!token.trim()) return null;

  if (
    token === DEV_BYPASS_TOKEN &&
    !isProduction(env) &&
    isLocalDevelopmentRequest(request) &&
    !env.GOVERNOR_API_TOKEN?.trim() &&
    !env.STAFF_CREDENTIALS?.trim()
  ) {
    return { id: "dev-bypass", role: "Governor" };
  }

  const digest = await sha256(token);
  if (
    env.GOVERNOR_API_TOKEN?.trim() &&
    equal(digest, await sha256(env.GOVERNOR_API_TOKEN))
  ) {
    return { id: "governor", role: "Governor" };
  }

  const configured = parseStaffCredentials(env.STAFF_CREDENTIALS);
  if (!configured) return null;
  for (const entry of configured) {
    if (equal(digest, entry.tokenSha256)) {
      return { id: entry.id, role: entry.role };
    }
  }
  return null;
}

export async function protectPortal(
  request: Request,
  env: Env,
): Promise<StaffIdentity | AutomationIdentity | Response> {
  const identity = await staffIdentity(request, env);
  if (identity) {
    const path = new URL(request.url).pathname;
    const governorOnly =
      request.method !== "GET" || ["/api/decisions"].includes(path);
    if (governorOnly && identity.role !== "Governor")
      return Response.json(
        { error: "Governor permission required" },
        { status: 403 },
      );
    return identity;
  }

  if (env.AUTOMATION_CREDENTIALS) {
    let configured: unknown;
    try {
      configured = JSON.parse(env.AUTOMATION_CREDENTIALS);
    } catch {
      configured = [];
    }
    const header = request.headers.get("Authorization") ?? "";
    if (
      Array.isArray(configured) &&
      configured.length <= 100 &&
      header.startsWith("Bearer ") &&
      header.length <= 4096
    ) {
      const token = header.slice(7);
      if (token.trim()) {
        const digest = await sha256(token);
        for (const entry of configured) {
          if (
            entry &&
            typeof entry.id === "string" &&
            entry.id.length > 0 &&
            entry.id.length <= 120 &&
            typeof entry.tokenSha256 === "string" &&
            /^[a-f0-9]{64}$/.test(entry.tokenSha256) &&
            equal(digest, entry.tokenSha256)
          ) {
            const path = new URL(request.url).pathname;
            const scope =
              path === "/api/twin/telemetry"
                ? "telemetry:write"
                : path === "/api/twin/relationships" ||
                    /^\/api\/twin\/relationships\/[^/]+\/retire$/.test(path)
                  ? "relationships:write"
                  : null;
            if (
              request.method === "POST" &&
              scope &&
              Array.isArray(entry.scopes) &&
              entry.scopes.includes(scope)
            )
              return { id: entry.id, role: "Automation" };
            return Response.json(
              { error: "Automation scope does not permit this request" },
              { status: 403 },
            );
          }
        }
      }
    }
  }

  if (isProduction(env) && !hasStaffConfiguration(env))
    return Response.json({ error: "Portal auth is not configured" }, { status: 503 });
  return Response.json({ error: "Staff sign-in required" }, { status: 401 });
}

export async function auditAccess(
  env: Env,
  request: Request,
  identity: StaffIdentity | AutomationIdentity | null,
  status: number,
) {
  await env.DB.prepare(
    "INSERT INTO access_audit(id,actor,action,resource,status) VALUES (?,?,?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      identity?.id ?? "anonymous",
      request.method,
      new URL(request.url).pathname,
      status,
    )
    .run();
}
