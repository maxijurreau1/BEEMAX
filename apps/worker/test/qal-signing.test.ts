import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import { createQalSignedRequest } from "../src/qal-signing.js";

const PKCS8_ED25519_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
  0x04, 0x22, 0x04, 0x20,
]);

function pkcs8(seed: Uint8Array): ArrayBuffer {
  const der = new Uint8Array(PKCS8_ED25519_PREFIX.length + seed.length);
  der.set(PKCS8_ED25519_PREFIX);
  der.set(seed, PKCS8_ED25519_PREFIX.length);
  return der.buffer;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("QAL request signing", () => {
  it("creates a signature accepted by the repository's versioned QAL contract", async () => {
    const seed = ed25519.utils.randomPrivateKey();
    const { url, init } = await createQalSignedRequest({
      url: "https://portal.test/api/manifold/hud?view=compact",
      method: "post",
      identity: " Test.Identity ",
      privateKeyPkcs8: pkcs8(seed),
      body: { enabled: true },
    });
    const headers = new Headers(init.headers);
    const requestId = headers.get("X-QAL-Request-Id")!;
    const timestamp = headers.get("X-QAL-Timestamp")!;
    const identity = headers.get("X-QAL-Identity")!;
    const bodyBytes = new Uint8Array(init.body as ArrayBuffer);
    const bodyHash = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bodyBytes)));
    const canonical = [
      "BEEMAX-SOVEREIGN-V1",
      "POST",
      "/api/manifold/hud",
      timestamp,
      identity,
      requestId,
      bodyHash,
    ].join("\n");

    expect(url).toBe("https://portal.test/api/manifold/hud?view=compact");
    expect(identity).toBe("test.identity");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(
      ed25519.verify(
        Uint8Array.from(headers.get("X-QAL-Signature")!.match(/../g)!, (byte) => Number.parseInt(byte, 16)),
        new TextEncoder().encode(canonical),
        ed25519.getPublicKey(seed),
      ),
    ).toBe(true);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
