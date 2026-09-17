import assert from "node:assert/strict";
import test from "node:test";

test("kingz leaderboard API is bounded, read-only, ranked, and secret-safe", async (t) => {
  process.env.KINGZ_API_KEY = "test-only-kingz-key";
  process.env.KINGZ_PERIOD_START = "2026-08-31";
  process.env.KINGZ_LEADERBOARD_URL = "https://leaderboard.kingz.win/v1/external/affiliates";
  process.env.KINGZ_PRIZES = "2250,1000,500,100,100,50";
  t.mock.method(Date, "now", () => Date.parse("2026-11-01T00:00:00Z"));
  let calls = 0;
  let wrongWindow = false;
  let lastUrl;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    calls += 1;
    const upstream = new Request(input, options);
    lastUrl = new URL(upstream.url);
    assert.equal(lastUrl.origin, "https://leaderboard.kingz.win");
    assert.equal(upstream.method, "GET");
    assert.equal(upstream.body, null);
    assert.equal(lastUrl.searchParams.get("key"), "test-only-kingz-key");
    return new Response(JSON.stringify({
      start_at: wrongWindow ? "2026-07-01" : "2026-08-31",
      end_at: "2026-09-30",
      cache_updated_at: "2026-11-01 00:00:00",
      leaderboard: {
        title: "Dirtygamblers - Kingz",
        start_date: "2026-09-17T00:00:00.000Z",
        end_date: "2026-10-17T00:00:00.000Z",
        type: "wagering",
        status: "active",
      },
      affiliates: [
        { username: "KingSecond", userId: "2", wager_amount: 50 },
        { username: "KingFirst", userId: "1", wager_amount: 100 },
        ...Array.from({ length: 10 }, (_, index) => ({
          username: `KingPlayer${index + 3}`,
          userId: String(index + 3),
          wager_amount: 49 - index,
        })),
      ],
    }), { headers: { "content-type": "application/json" } });
  });

  const { default: worker } = await import("../dist/server/index.js");
  const request = (path) => worker.fetch(new Request(`http://localhost${path}`), {}, { waitUntil() {}, passThroughOnException() {} });

  const response = await request("/api/leaderboard?platform=kingz&period=2026-08-31");
  assert.equal(response.status, 200, JSON.stringify({ body: await response.clone().text(), calls, url: lastUrl?.href }));
  assert.equal(lastUrl.searchParams.get("start_at"), "2026-08-31");
  assert.equal(lastUrl.searchParams.get("end_at"), "2026-09-30");

  const data = await response.json();
  assert.equal(data.platform, "kingz");
  assert.equal(data.name, "Kingz");
  assert.equal(data.players[0].name, "KingFirst");
  assert.equal(data.players[0].winnings, "$2,250");
  assert.equal(data.players[0].points, 100);
  assert.equal(data.players.length, 12);
  assert.deepEqual(data.players.map((player) => player.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(data.players.some((player) => player.name === "KingPlayer12"), true);
  assert.equal(data.totalPlayers, 12);
  assert.equal(data.totalWagered, 595);
  assert.equal(data.prizePool, 4000);
  assert.deepEqual(data.prizes, [2250, 1000, 500, 100, 100, 50]);
  assert.equal(data.sourceWindow.to, Date.parse("2026-10-01T00:00:00Z"));
  assert.equal(JSON.stringify(data).includes("test-only-kingz-key"), false);

  const unknownPlatform = await request("/api/leaderboard?platform=nope");
  assert.equal(unknownPlatform.status, 400);
  assert.equal(calls, 1);

  const invalid = await request("/api/leaderboard?platform=kingz&period=2026-11-01");
  assert.equal(invalid.status, 404);
  assert.equal(calls, 1);
  const beforeLaunch = await request("/api/leaderboard?platform=kingz&period=2026-07-01");
  assert.equal(beforeLaunch.status, 404);
  assert.equal(calls, 1);

  wrongWindow = true;
  const unbounded = await request("/api/leaderboard?platform=kingz&period=2026-08-31");
  assert.equal(unbounded.status, 502);
  assert.deepEqual((await unbounded.json()).players, []);

  wrongWindow = false;
  const live = await request("/api/leaderboard?platform=kingz");
  assert.equal(live.status, 200);
  assert.equal(lastUrl.searchParams.get("start_at"), "2026-11-01");
  assert.equal(lastUrl.searchParams.get("end_at"), "2026-11-30");
  assert.deepEqual((await live.json()).completedPeriods.map((period) => period.id), ["2026-10-01", "2026-08-31"]);
});