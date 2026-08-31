import assert from "node:assert/strict";
import test from "node:test";
import { monthlyPeriods } from "../lib/leaderboard-periods.ts";
import { fetchLeaderboard, leaderboardRefreshMs } from "../app/leaderboard-request.ts";

const at = (date) => Date.parse(`${date}T00:00:00Z`);

test("the first run stays live through September 30 with no invented history", () => {
  for (const day of ["2026-08-31", "2026-09-01", "2026-09-30"]) {
    const periods = monthlyPeriods("2026-08-31", at(day));
    assert.deepEqual(periods.current, { id: "2026-08-31", from: at("2026-08-31"), to: at("2026-10-01") });
    assert.deepEqual(periods.completed, []);
  }
});

test("rollover exposes completed periods newest first without gaps or overlaps", () => {
  const periods = monthlyPeriods("2026-08-31", at("2026-12-01"));
  assert.equal(periods.current.id, "2026-12-01");
  assert.deepEqual(periods.completed.map((period) => period.id), ["2026-11-01", "2026-10-01", "2026-08-31"]);
  let nextStart = periods.current.from;
  for (const period of periods.completed) {
    assert.equal(period.to, nextStart);
    nextStart = period.from;
  }
});

test("period boundaries handle year changes, leap years, and invalid settings", () => {
  const leap = monthlyPeriods("2027-12-31", at("2028-02-01"));
  assert.equal(leap.current.to, at("2028-03-01"));
  assert.equal((leap.current.to - leap.current.from) / 86400000, 29);
  assert.equal(monthlyPeriods("2026-02-30", at("2026-09-01")).current.id, "2026-08-31");
  assert.equal(monthlyPeriods("2026-08-15", at("2026-09-15")).completed[0].to, at("2026-09-15"));
});

test("shared read-only requests coalesce, cache recent reads, and back off errors", async (t) => {
  let now = at("2026-08-31");
  let calls = 0;
  let fail = false;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls += 1;
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    assert.ok(url.startsWith("/api/leaderboard"));
    return new Response(JSON.stringify(fail ? { error: "Rate limited" } : { players: [] }), { status: fail ? 429 : 200 });
  });

  await Promise.all([fetchLeaderboard(), fetchLeaderboard()]);
  assert.equal(calls, 1);
  await fetchLeaderboard();
  assert.equal(calls, 1);
  now += leaderboardRefreshMs;
  await fetchLeaderboard();
  assert.equal(calls, 2);

  await fetchLeaderboard("2026-08-31");
  assert.equal(calls, 3);
  await fetchLeaderboard("2026-08-31");
  assert.equal(calls, 3);

  fail = true;
  now += leaderboardRefreshMs;
  await assert.rejects(fetchLeaderboard(), /Rate limited/);
  await assert.rejects(fetchLeaderboard(), /Rate limited/);
  assert.equal(calls, 4);
});
