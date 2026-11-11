// Public/customer flows use a separate entry point; fixtures stay in isolated test D1.
import marketplaceWorker from "../src/marketplace-worker";
import { sha256 } from "../src/access";
import { randomToken } from "../src/customer-auth";
import { validatePackage, validatePublication } from "../../../icvs/releases";
const marketOrigin = "https://max.test";
async function market(
  path: string,
  init: RequestInit = {},
  extra: Partial<Env> = {},
) {
  const headers = new Headers(init.headers);
  if (init.method === "POST") headers.set("Origin", marketOrigin);
  return marketplaceWorker.fetch(
    new Request(`${marketOrigin}${path}`, { ...init, headers }),
    { ...bindings, MARKETPLACE_ORIGIN: marketOrigin, ...extra },
  );
}
async function customerFixture() {
  const id = crypto.randomUUID(),
    token = randomToken();
  await bindings.DB.batch([
    bindings.DB.prepare(
      "INSERT INTO customer_accounts(id,identity_subject,name) VALUES (?,?,'Test Customer')",
    ).bind(id, id),
    bindings.DB.prepare("INSERT INTO customer_sessions VALUES (?,?,?)").bind(
      await sha256(token),
      id,
      Date.now() + 60000,
    ),
  ]);
  return { id, headers: { Cookie: `max_session=${token}` } };
}
async function releaseFixture(price = 0) {
  await bindings.DB.batch([
    bindings.DB.prepare(
      "INSERT INTO marketplace_creators(id,slug,name,bio) VALUES ('creator','creator','Test Creator','Public biography')",
    ),
    bindings.DB.prepare(
      "INSERT INTO marketplace_releases(id,product_id,slug,title,summary,type,creator_id,price_minor,currency,artifact,digest,download_ref) VALUES ('release','one','public-game','Public game','A public game description','app','creator',?, 'USD', 'https://test.invalid/artifact', 'a'.repeat(64), 'private-download-reference')",
    ).bind(price),
  ]);
}

describe("Ecosystem access boundaries", () => {
  it("denies anonymous and customer access to every operational surface", async () => {
    for (const path of [
      "/",
      "/api/dashboard",
      "/api/products",
      "/api/portfolio",
      "/api/approvals",
      "/api/analytics",
      "/api/forecasts",
      "/api/recommendations",
      "/api/revenue",
      "/api/publishing",
      "/api/departments",
      "/api/runtime",
      "/api/system-health",
      "/api/telemetry",
      "/api/processes",
      "/api/factory",
      "/api/decisions",
      "/api/kernel/ipc",
    ])
      expect(
        (await SELF.fetch(`https://portal.test${path}`)).status,
        path,
      ).toBe(401);
    const customer = await customerFixture();
    expect(
      (
        await SELF.fetch("https://portal.test/api/products", {
          headers: customer.headers,
        })
      ).status,
    ).toBe(401);
  });
  it("allows named operators to read operations while denying governor decisions", async () => {
    const extra = {
      STAFF_CREDENTIALS: JSON.stringify([
        {
          id: "operator-test",
          role: "Operator",
          tokenSha256: await sha256("operator-key"),
        },
      ]),
    };
    const read = new Request("https://portal.test/api/session", {
      headers: { Authorization: "Bearer operator-key" },
    });
    expect(
      await (
        await worker.fetch(
          read,
          { ...bindings, ...extra },
          createExecutionContext(),
        )
      ).json(),
    ).toEqual({ id: "operator-test", role: "Operator" });
    const mutation = new Request(
      "https://portal.test/api/approvals/001/approve",
      { method: "POST", headers: { Authorization: "Bearer operator-key" } },
    );
    expect(
      (
        await worker.fetch(
          mutation,
          { ...bindings, ...extra },
          createExecutionContext(),
        )
      ).status,
    ).toBe(403);
    expect(
      await bindings.DB.prepare(
        "SELECT status FROM approvals WHERE id='001'",
      ).first("status"),
    ).toBe("pending");
  });
  it("publishes only allowlisted catalog fields and denies private paths on public API", async () => {
    await releaseFixture();
    const result = (await (await market("/api/products")).json()) as {
      items: Record<string, unknown>[];
    };
    expect(result.items).toHaveLength(1);
    expect(Object.keys(result.items[0]).sort()).toEqual(
      [
        "id",
        "slug",
        "title",
        "summary",
        "type",
        "priceMinor",
        "currency",
        "publishedAt",
        "creatorName",
        "creatorSlug",
      ].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private-download|private.test|productId|score|workflow/,
    );
    for (const path of [
      "/api/dashboard",
      "/api/telemetry",
      "/api/kernel/ipc",
      "/api/revenue",
      "/api/factory",
    ])
      expect((await market(path)).status).toBe(404);
    expect((await market("/api/products?limit=1000")).status).toBe(400);
    expect(await (await market("/api/apps")).json()).toMatchObject({
      items: [],
    });
    await bindings.DB.prepare(
      "UPDATE marketplace_releases SET withdrawn_at=CURRENT_TIMESTAMP",
    ).run();
    expect((await market("/api/products/public-game")).status).toBe(404);
    expect(await (await market("/api/games")).json()).toMatchObject({
      items: [],
    });
  });
  it("supports the public sports catalog route", async () => {
    expect(await (await market("/api/sports")).json()).toMatchObject({
      items: [],
    });
  });
  it("blocks cross-origin mutations and malformed request bodies", async () => {
    expect(
      (
        await marketplaceWorker.fetch(
          new Request(`${marketOrigin}/api/auth/start`, {
            method: "POST",
            headers: { Origin: "https://evil.test" },
          }),
          { ...bindings, MARKETPLACE_ORIGIN: marketOrigin },
        )
      ).status,
    ).toBe(403);
    const user = await customerFixture();
    expect(
      (
        await market("/api/account", {
          method: "POST",
          headers: user.headers,
          body: "invalid",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await market("/api/account", {
          method: "POST",
          headers: user.headers,
          body: JSON.stringify({ name: "x".repeat(20000) }),
        })
      ).status,
    ).toBe(400);
  });
});

describe("Marketplace customer ownership and commerce", () => {
  it("verifies login state once and creates a customer-only session", async () => {
    let state = "";
    const identity = {
      fetch: async (url: string, init: RequestInit) => {
        const input = JSON.parse(init.body as string);
        if (url.endsWith("/start")) {
          state = input.state;
          return Response.json({
            url: `https://identity.test/login?state=${state}`,
          });
        }
        return Response.json({
          subject: "verified-subject",
          name: "Verified Customer",
        });
      },
    } as unknown as Fetcher;
    await market(
      "/api/auth/start",
      { method: "POST" },
      { CUSTOMER_IDENTITY: identity },
    );
    const wrong = await market(
      "/api/auth/complete",
      {
        method: "POST",
        headers: { Cookie: `max_login=${state}` },
        body: JSON.stringify({ state: "bad", code: "valid" }),
      },
      { CUSTOMER_IDENTITY: identity },
    );
    expect(wrong.status).toBe(400);
    const init = {
      method: "POST",
      headers: { Cookie: `max_login=${state}` },
      body: JSON.stringify({ state, code: "valid" }),
    };
    const completed = await market("/api/auth/complete", init, {
      CUSTOMER_IDENTITY: identity,
    });
    expect(completed.status).toBe(200);
    const cookie = completed.headers
      .get("Set-Cookie")!
      .match(/max_session=([a-f0-9]{64})/)![0];
    expect(
      await (
        await market("/api/account", { headers: { Cookie: cookie } })
      ).json(),
    ).toMatchObject({ name: "Verified Customer" });
    expect(
      (
        await market("/api/auth/complete", init, {
          CUSTOMER_IDENTITY: identity,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await SELF.fetch("https://portal.test/api/session", {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
    await market("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(
      (await market("/api/account", { headers: { Cookie: cookie } })).status,
    ).toBe(401);
  });
  it("deduplicates free acquisitions, scopes libraries, and verifies downloads and reviews", async () => {
    await releaseFixture();
    const user = await customerFixture(),
      stranger = await customerFixture();
    expect(
      (
        await market("/api/downloads", {
          method: "POST",
          body: JSON.stringify({ releaseId: "release" }),
        })
      ).status,
    ).toBe(401);
    const buy = () =>
      market("/api/orders", {
        method: "POST",
        headers: user.headers,
        body: JSON.stringify({ releaseId: "release" }),
      });
    const results = await Promise.all([buy(), buy()]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await bindings.DB.prepare(
        "SELECT COUNT(*) AS n FROM marketplace_orders",
      ).first("n"),
    ).toBe(1);
    expect(
      await (await market("/api/library", { headers: user.headers })).json(),
    ).toHaveLength(1);
    expect(
      await (
        await market("/api/library", { headers: stranger.headers })
      ).json(),
    ).toEqual([]);
    expect(
      (
        await market("/api/downloads", {
          method: "POST",
          headers: stranger.headers,
          body: JSON.stringify({ releaseId: "release" }),
        })
      ).status,
    ).toBe(403);
    const downloads = {
      fetch: async (_url: string, init: RequestInit) => {
        expect(JSON.parse(init.body as string)).toMatchObject({
          customerId: user.id,
          reference: "private-download-reference",
          expiresIn: 300,
        });
        return Response.json({ url: "https://downloads.test/signed-grant" });
      },
    } as unknown as Fetcher;
    expect(
      await (
        await market(
          "/api/downloads",
          {
            method: "POST",
            headers: user.headers,
            body: JSON.stringify({ releaseId: "release" }),
          },
          { DOWNLOADS: downloads },
        )
      ).json(),
    ).toEqual({ url: "https://downloads.test/signed-grant" });
    expect(
      (
        await market("/api/reviews", {
          method: "POST",
          headers: user.headers,
          body: JSON.stringify({
            releaseId: "release",
            rating: 6,
            body: "Great product",
          }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await market("/api/reviews", {
          method: "POST",
          headers: user.headers,
          body: JSON.stringify({
            releaseId: "release",
            rating: 5,
            body: "Great product",
          }),
        })
      ).status,
    ).toBe(200);
    expect(
      await (await market("/api/products/public-game")).json(),
    ).toMatchObject({ reviews: [{ rating: 5, body: "Great product" }] });
    await market("/api/library/release", {
      method: "POST",
      headers: user.headers,
      body: JSON.stringify({ hidden: true }),
    });
    expect(
      await (await market("/api/library", { headers: user.headers })).json(),
    ).toEqual([]);
    expect(
      await (
        await market("/api/library?hidden=true", { headers: user.headers })
      ).json(),
    ).toHaveLength(1);
  });
  it("accepts only correlated provider payment evidence and revokes refunded download access", async () => {
    await releaseFixture(1999);
    const user = await customerFixture(),
      stranger = await customerFixture();
    let orderId = "",
      status = "paid",
      amount = 1998;
    const payments = {
      fetch: async (url: string, init?: RequestInit) => {
        if (url.endsWith("/checkout")) {
          const b = JSON.parse(init!.body as string);
          expect(b.amount).toBe(1999);
          orderId = b.orderId;
          return Response.json({
            id: "provider-order",
            url: "https://pay.test/checkout",
          });
        }
        return Response.json({ orderId, amount, currency: "USD", status });
      },
    } as unknown as Fetcher;
    const order = await market(
      "/api/orders",
      {
        method: "POST",
        headers: user.headers,
        body: JSON.stringify({ releaseId: "release", priceMinor: 1 }),
      },
      { PAYMENTS: payments },
    );
    expect(order.status).toBe(200);
    expect(
      (
        await market(
          `/api/orders/${orderId}`,
          { headers: stranger.headers },
          { PAYMENTS: payments },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await market(
          `/api/orders/${orderId}`,
          { headers: user.headers },
          { PAYMENTS: payments },
        )
      ).status,
    ).toBe(503);
    expect(
      await (await market("/api/library", { headers: user.headers })).json(),
    ).toEqual([]);
    amount = 1999;
    expect(
      await (
        await market(
          `/api/orders/${orderId}`,
          { headers: user.headers },
          { PAYMENTS: payments },
        )
      ).json(),
    ).toMatchObject({ status: "paid" });
    await market(
      `/api/orders/${orderId}`,
      { headers: user.headers },
      { PAYMENTS: payments },
    );
    expect(
      await bindings.DB.prepare(
        "SELECT COUNT(*) AS n FROM customer_library",
      ).first("n"),
    ).toBe(1);
    status = "refunded";
    await market(
      `/api/orders/${orderId}`,
      { headers: user.headers },
      { PAYMENTS: payments },
    );
    expect(
      (
        await market(
          "/api/downloads",
          {
            method: "POST",
            headers: user.headers,
            body: JSON.stringify({ releaseId: "release" }),
          },
          { PAYMENTS: payments },
        )
      ).status,
    ).toBe(403);
    expect(
      await (await market("/api/library", { headers: user.headers })).json(),
    ).toEqual([]);
    expect(await (await get("/api/revenue")).json()).toMatchObject({
      currencies: [{ currency: "USD", paidMinor: 0, refundedMinor: 1999 }],
    });
  });
});
