import { describe, expect, it, vi, afterEach } from "vitest";
import { streamTokenApi } from "../src/stream";
import type { Env } from "../src/types";

const config = {
  CF_STREAM_ACCOUNT_ID: "account-123",
  CF_STREAM_VIDEO_UID: "video-456",
  CF_STREAM_CUSTOMER_CODE: "customer-code",
  CF_STREAM_API_TOKEN: "private-api-secret",
} as Env;

afterEach(() => vi.unstubAllGlobals());

describe("restricted Cloudflare Stream playback", () => {
  it("fails closed when Stream secrets or video configuration are absent", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await streamTokenApi({ DB: {} as D1Database });
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns only a short-lived signed playback URL and keeps the API secret server-side", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer private-api-secret");
      expect(JSON.parse(String(init?.body)).exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      return Response.json({ success: true, result: { token: "signed-playback-token-long-enough" } });
    });
    vi.stubGlobal("fetch", fetch);
    const response = await streamTokenApi({ ...config, DB: {} as D1Database });
    expect(response.status).toBe(200);
    const body = await response.json() as { playbackUrl: string; playerUrl: string; expiresAt: string };
    expect(body.playbackUrl).toContain("/signed-playback-token-long-enough/manifest/video.m3u8");
    expect(body.playerUrl).toContain("/signed-playback-token-long-enough/iframe");
    expect(body.expiresAt).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("private-api-secret");
  });

  it("does not leak upstream errors or tokens on provider failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret upstream detail", { status: 403 })));
    const response = await streamTokenApi({ ...config, DB: {} as D1Database });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret upstream detail");
  });
});
