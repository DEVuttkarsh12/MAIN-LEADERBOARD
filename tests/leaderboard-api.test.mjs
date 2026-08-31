import assert from "node:assert/strict";
import test from "node:test";

function packDrawTimestamp(value) {
  const [month, day, year] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

test("historical API requests are bounded, validated, and read-only", async (t) => {
  process.env.PACKDRAW_API_KEY = "test-only-key";
  process.env.PACKDRAW_PERIOD_START = "2026-08-31";
  process.env.PACKDRAW_LEADERBOARD_URL = "https://packdraw.com/api/v1/affiliates/leaderboard?apiKey=API_KEY";
  process.env.PACKDRAW_PRIZES = "500,250,150,50,25,25";
  t.mock.method(Date, "now", () => Date.parse("2026-11-01T00:00:00Z"));
  let calls = 0;
  let wrongWindow = false;
  let lastUrl;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    calls += 1;
    const upstream = new Request(input, options);
    lastUrl = new URL(upstream.url);
    assert.equal(lastUrl.origin, "https://packdraw.com");
    assert.equal(upstream.method, "GET");
    assert.equal(upstream.body, null);
    const after = packDrawTimestamp(lastUrl.searchParams.get("after"));
    const before = lastUrl.searchParams.get("before");
    return new Response(JSON.stringify({
      after,
      before: wrongWindow || !before ? null : packDrawTimestamp(before),
      asOf: "2026-11-01T00:00:00Z",
      leaderboard: [{ username: "TestSecond", userId: "2", wagerAmount: 50 }, { username: "TestFirst", userId: "1", wagerAmount: 100 }],
    }), { headers: { "content-type": "application/json" } });
  });

  const { default: worker } = await import("../dist/server/index.js");
  const request = (path) => worker.fetch(new Request(`http://localhost${path}`), {}, { waitUntil() {}, passThroughOnException() {} });
  const response = await request("/api/leaderboard?period=2026-08-31");
  assert.equal(response.status, 200, JSON.stringify({ body: await response.clone().text(), calls, after: lastUrl?.searchParams.get("after"), before: lastUrl?.searchParams.get("before") }));
  const data = await response.json();
  assert.equal(lastUrl.searchParams.get("after"), "8-31-2026");
  assert.equal(lastUrl.searchParams.get("before"), "10-1-2026");
  assert.equal(data.players[0].name, "TestFirst");
  assert.equal(data.players[0].winnings, "$500");
  assert.equal(data.sourceWindow.to, Date.parse("2026-10-01T00:00:00Z"));
  assert.equal(JSON.stringify(data).includes("test-only-key"), false);

  const invalid = await request("/api/leaderboard?period=2026-11-01");
  assert.equal(invalid.status, 404);
  assert.equal(calls, 1);
  const beforeLaunch = await request("/api/leaderboard?period=2026-07-01");
  assert.equal(beforeLaunch.status, 404);
  assert.equal(calls, 1);

  wrongWindow = true;
  const unbounded = await request("/api/leaderboard?period=2026-08-31");
  assert.equal(unbounded.status, 502);
  assert.deepEqual((await unbounded.json()).players, []);

  const live = await request("/api/leaderboard");
  assert.equal(live.status, 200);
  assert.equal(lastUrl.searchParams.get("after"), "11-1-2026");
  assert.equal(lastUrl.searchParams.has("before"), false);
  assert.deepEqual((await live.json()).completedPeriods.map((period) => period.id), ["2026-10-01", "2026-08-31"]);
});
