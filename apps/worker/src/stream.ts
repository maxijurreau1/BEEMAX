import type { Env } from "./types.js";

const json = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

/** Creates a short-lived Stream playback URL; the Stream API secret stays in Worker secrets. */
export async function streamTokenApi(env: Env): Promise<Response> {
  const accountId = env.CF_STREAM_ACCOUNT_ID?.trim();
  const videoUid = env.CF_STREAM_VIDEO_UID?.trim();
  const customerCode = env.CF_STREAM_CUSTOMER_CODE?.trim();
  const apiToken = env.CF_STREAM_API_TOKEN;
  if (!accountId || !videoUid || !customerCode || !apiToken)
    return json({ error: "Secure stream playback is not configured" }, 503);
  if (
    !/^[a-zA-Z0-9_-]{1,120}$/.test(accountId) ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(videoUid) ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(customerCode)
  )
    return json({ error: "Secure stream configuration is invalid" }, 503);

  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(videoUid)}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exp: expiresAt }),
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    return json(
      { error: "Secure stream authorization is temporarily unavailable" },
      502,
    );
  }
  if (!response.ok)
    return json(
      { error: "Secure stream authorization is temporarily unavailable" },
      502,
    );

  let payload: { success?: unknown; result?: { token?: unknown } };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return json(
      { error: "Invalid response from stream authorization service" },
      502,
    );
  }
  const playbackToken = payload.success === true ? payload.result?.token : undefined;
  if (
    typeof playbackToken !== "string" ||
    playbackToken.length < 20 ||
    playbackToken.length > 8192
  )
    return json(
      { error: "Invalid response from stream authorization service" },
      502,
    );

  const encoded = encodeURIComponent(playbackToken);
  const playbackBase = `https://customer-${customerCode}.cloudflarestream.com/${encoded}`;
  return json(
    {
      playbackUrl: `${playbackBase}/manifest/video.m3u8`,
      playerUrl: `${playbackBase}/iframe?autoplay=true&muted=true&controls=true`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    },
    200,
  );
}
