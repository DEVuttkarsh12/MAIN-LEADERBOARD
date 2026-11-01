import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { exportPackDrawPeriod } from "../lib/packdraw-export.ts";

const token = "a".repeat(64);
const now = Date.parse("2026-11-01T10:00:00Z");
const request = (value = token, method = "POST") => new Request("https://preview.example/api/packdraw-export", {
  method, ...(method === "POST" ? { body: new URLSearchParams({ token: value }) } : {}),
});
const options = {
  environment: "preview", apiKey: "server-only-test-key",
  tokenHash: createHash("sha256").update(token).digest("hex"),
  expiresAt: now + 60_000, now: () => now,
  fetchImpl: async () => { throw new Error("Unexpected upstream request"); },
};

test("export rejects production, expired access and invalid passwords before reading data", async () => {
  for (const environment of [undefined, "production", "development"]) {
    assert.equal((await exportPackDrawPeriod(request(), { ...options, environment })).status, 404);
  }
  assert.equal((await exportPackDrawPeriod(request(), { ...options, expiresAt: now })).status, 404);
  assert.equal((await exportPackDrawPeriod(request(""), options)).status, 401);
  assert.equal((await exportPackDrawPeriod(request("b".repeat(64)), options)).status, 401);
  assert.equal((await exportPackDrawPeriod(request(token, "GET"), options)).status, 200);
  assert.equal((await exportPackDrawPeriod(request(token, "DELETE"), options)).status, 405);
  assert.equal((await exportPackDrawPeriod(request(), { ...options, apiKey: undefined })).status, 503);
});

test("export retrieves all 18 records for the exact completed period without exposing the key", async () => {
  const rows = Array.from({ length: 18 }, (_, i) => ({ username: `Player${i + 1}`, userId: `id${i + 1}`, wagerAmount: 100 - i }));
  const response = await exportPackDrawPeriod(request(), {
    ...options,
    urlTemplate: "https://packdraw.com/api/v1/affiliates/leaderboard?apiKey=API_KEY",
    fetchImpl: async (url, init) => {
      assert.equal(url.origin, "https://packdraw.com");
      assert.equal(url.searchParams.get("apiKey"), options.apiKey);
      assert.equal(url.searchParams.get("after"), "10-1-2026");
      assert.equal(url.searchParams.get("before"), "11-1-2026");
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.equal(init.redirect, "error");
      return Response.json({ after: "2026-10-01T00:00:00Z", before: "2026-11-01T00:00:00Z", asOf: "2026-11-01T09:00:00Z", apiKey: options.apiKey, leaderboard: rows });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(response.headers.get("content-disposition"), /attachment/);
  const text = await response.text();
  assert.ok(!text.includes(options.apiKey));
  assert.deepEqual(JSON.parse(text).leaderboard, rows);
});

test("export fails closed on wrong periods, duplicate IDs and unexpected upstream origins", async () => {
  assert.equal((await exportPackDrawPeriod(request(), { ...options, urlTemplate: "https://example.com/" })).status, 503);
  const fetchImpl = async () => Response.json({ after: "2026-10-01T00:00:00Z", before: null, leaderboard: [] });
  assert.equal((await exportPackDrawPeriod(request(), { ...options, fetchImpl })).status, 502);
  const duplicate = async () => Response.json({ after: "2026-10-01T00:00:00Z", before: "2026-11-01T00:00:00Z", leaderboard: [{ userId: "same", wagerAmount: 1 }, { userId: "same", wagerAmount: 2 }] });
  assert.equal((await exportPackDrawPeriod(request(), { ...options, fetchImpl: duplicate })).status, 502);
});
