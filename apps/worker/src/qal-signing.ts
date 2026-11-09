const MAX_SIGNED_BODY_BYTES = 16_384;
const IDENTITY_PATTERN = /^[a-z0-9._:-]{1,64}$/;

export interface SignRequestOptions {
  url: string;
  method: string;
  identity: string;
  privateKeyPkcs8: ArrayBuffer;
  body?: unknown;
}

/**
 * Creates a request matching the Worker's verifySovereignRequest contract.
 * The signed UTF-8 payload is:
 * BEEMAX-SOVEREIGN-V1\nMETHOD\npathname\ntimestamp\nidentity\nrequestId\nsha256(body)-hex
 */
export async function createQalSignedRequest(options: SignRequestOptions): Promise<{
  url: string;
  init: RequestInit;
}> {
  const { url, method, privateKeyPkcs8, body } = options;
  const parsedUrl = new URL(url);
  const upperMethod = method.toUpperCase();
  const identity = options.identity.trim().toLowerCase();
  if (!IDENTITY_PATTERN.test(identity) || identity === "anonymous") {
    throw new TypeError("A valid sovereign identity is required");
  }
  if (!upperMethod || /[\r\n]/.test(upperMethod)) {
    throw new TypeError("A valid HTTP method is required");
  }

  let bodyBytes = new Uint8Array();
  if (body !== undefined && body !== null) {
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    if (bodyString === undefined) throw new TypeError("Request body cannot be serialized");
    bodyBytes = new TextEncoder().encode(bodyString);
  }
  if (bodyBytes.byteLength > MAX_SIGNED_BODY_BYTES) {
    throw new TypeError("Signed request body exceeds the 16384-byte limit");
  }
  if ((upperMethod === "GET" || upperMethod === "HEAD") && bodyBytes.byteLength > 0) {
    throw new TypeError(`${upperMethod} requests cannot include a body`);
  }

  const timestamp = Date.now().toString();
  const requestId = crypto.randomUUID();
  const bodyHash = bytesToHex(await crypto.subtle.digest("SHA-256", bodyBytes));
  const canonicalPayload = [
    "BEEMAX-SOVEREIGN-V1",
    upperMethod,
    parsedUrl.pathname,
    timestamp,
    identity,
    requestId,
    bodyHash,
  ].join("\n");

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyPkcs8,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(canonicalPayload),
  );

  const headers: Record<string, string> = {
    "X-QAL-Identity": identity,
    "X-QAL-Timestamp": timestamp,
    "X-QAL-Request-Id": requestId,
    "X-QAL-Signature": bytesToHex(signature),
  };
  if (bodyBytes.byteLength > 0 && typeof body !== "string") {
    headers["Content-Type"] = "application/json";
  }

  return {
    url,
    init: {
      method: upperMethod,
      headers,
      body: bodyBytes.byteLength > 0 ? bodyBytes : undefined,
    },
  };
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer, bytes instanceof ArrayBuffer ? 0 : bytes.byteOffset, bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
