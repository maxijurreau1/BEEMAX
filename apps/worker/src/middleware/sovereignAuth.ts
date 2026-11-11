import { ed25519 } from "@noble/curves/ed25519";
import type { Env } from "../types.js";

export interface SovereignAccessResult {
  authorized: boolean;
  tier: string;
  identity: string;
}

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_SIGNED_BODY_BYTES = 16_384;
const IDENTITY_PATTERN = /^[a-z0-9._:-]{1,64}$/;
const HEX_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;
const PUBLIC_KEY_PATTERN = /^(?:[0-9a-fA-F]{2}){32}$/;
const SIGNATURE_PATTERN = /^(?:[0-9a-fA-F]{2}){64}$/;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function bodyWithinLimit(request: Request): Promise<boolean> {
  if (!request.body) return true;
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_SIGNED_BODY_BYTES) return false;
  }

  const reader = request.clone().body?.getReader();
  if (!reader) return true;
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return true;
      length += value.byteLength;
      if (length > MAX_SIGNED_BODY_BYTES) {
        await reader.cancel();
        return false;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Verifies the existing QAL signature contract using the Worker's WebCrypto API.
 * Sign the UTF-8 bytes of `${pathname}:${timestamp}:${identity}`. The existing
 * wire format remains hexadecimal for both the raw 32-byte public key and the
 * 64-byte Ed25519 signature.
 */
export async function verifySovereignAccess(
  request: Request,
  env: Env,
): Promise<SovereignAccessResult> {
  const signatureHex = request.headers.get("X-QAL-Signature") ?? "";
  const timestamp = request.headers.get("X-QAL-Timestamp") ?? "";
  const rawIdentity = request.headers.get("X-QAL-Identity") ?? "";
  const identity = rawIdentity.trim().toLowerCase();

  if (!IDENTITY_PATTERN.test(identity) || identity === "anonymous") {
    return { authorized: false, tier: "invalid_identity", identity: "anonymous" };
  }
  if (!signatureHex || !timestamp) {
    return { authorized: false, tier: "missing_headers", identity };
  }
  if (!/^\d{1,16}$/.test(timestamp)) {
    return { authorized: false, tier: "expired_timestamp", identity };
  }

  const requestTime = Number(timestamp);
  if (!Number.isSafeInteger(requestTime) || Math.abs(Date.now() - requestTime) > MAX_CLOCK_SKEW_MS) {
    return { authorized: false, tier: "expired_timestamp", identity };
  }

  const publicKeyHex = env.SOVEREIGN_PUBLIC_KEY;
  const ledger = env.SOVEREIGN_LEDGER ?? env.DB;
  if (!publicKeyHex?.trim() || !ledger || !PUBLIC_KEY_PATTERN.test(publicKeyHex)) {
    return { authorized: false, tier: "unconfigured_environment", identity };
  }
  if (!SIGNATURE_PATTERN.test(signatureHex)) {
    return { authorized: false, tier: "invalid_signature", identity };
  }
  if (!(await bodyWithinLimit(request))) {
    return { authorized: false, tier: "request_too_large", identity };
  }

  try {
    const payload = `${new URL(request.url).pathname}:${timestamp}:${identity}`;
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const isValid = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      hexToBytes(signatureHex),
      new TextEncoder().encode(payload),
    );
    if (!isValid) return { authorized: false, tier: "invalid_signature", identity };

    const license = await ledger.prepare(
      "SELECT tier, expires_at FROM sovereign_licenses WHERE identity = ? AND status = 'active'",
    ).bind(identity).first<{ tier: string; expires_at: number | null }>();

    if (!license) return { authorized: false, tier: "unlicensed", identity };
    const isLifetime = license.expires_at === null || license.expires_at === 0;
    if (!isLifetime && license.expires_at! <= Date.now()) {
      return { authorized: false, tier: "license_expired", identity };
    }

    // Ed25519 is deterministic, so the canonical signature itself is a stable
    // replay key for this signed path/timestamp/identity tuple. The unique D1
    // key plus atomic INSERT prevents concurrent replays from both succeeding.
    const now = Date.now();
    const replayKey = bytesToHex(hexToBytes(signatureHex));
    await ledger.prepare("DELETE FROM sovereign_nonces WHERE created_at <= ?")
      .bind(now - MAX_CLOCK_SKEW_MS * 2)
      .run();
    const nonce = await ledger.prepare(
      "INSERT INTO sovereign_nonces(req_id, identity, created_at) VALUES (?, ?, ?) ON CONFLICT(req_id) DO NOTHING",
    ).bind(replayKey, identity, now).run();
    if (nonce.meta.changes !== 1) {
      return { authorized: false, tier: "nonce_reused", identity };
    }

    return { authorized: true, tier: license.tier, identity };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sovereignAuth] Verification failure:", message);
    return { authorized: false, tier: "verification_error", identity };
  }
}
