import { NextResponse } from "next/server";
import { monthlyPeriods } from "../../../lib/leaderboard-periods";

type RawRecord = Record<string, unknown>;

export type LeaderboardPlayer = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  points: number;
  winnings: string;
  movement: "up" | "down" | "same";
};

type PackDrawEntry = {
  image?: unknown;
  isActive?: unknown;
  userId?: unknown;
  username?: unknown;
  wagerAmount?: unknown;
};

const PACKDRAW_LEADERBOARD_URL = process.env.PACKDRAW_LEADERBOARD_URL;
const PACKDRAW_API_KEY = process.env.PACKDRAW_API_KEY?.trim();
const PACKDRAW_PERIOD_START = process.env.PACKDRAW_PERIOD_START?.trim();
const DEFAULT_LEADERBOARD_URL = "https://packdraw.com/api/v1/affiliates/leaderboard?apiKey=API_KEY";
const FALLBACK_PRIZES = [500, 250, 150, 50, 25, 25];
const PACKDRAW_PRIZES = parsePrizeList(process.env.PACKDRAW_PRIZES);
const UPSTREAM_TIMEOUT_MS = 10_000;
const CLIENT_REFRESH_SECONDS = 5 * 60;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Leaderboard-Refresh-Seconds": String(CLIENT_REFRESH_SECONDS),
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function parsePrizeList(value: string | undefined): number[] {
  const prizes = value
    ?.split(/[\s,]+/)
    .map((amount) => Number(amount.trim()))
    .filter((amount) => Number.isFinite(amount) && amount >= 0);

  return prizes && prizes.length > 0 ? prizes : FALLBACK_PRIZES;
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const numericText = value.replace(/[$,\s]/g, "").match(/-?\d+(?:\.\d+)?/)?.[0];
  if (!numericText) {
    return undefined;
  }

  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function initialsFor(name: string): string {
  const letters = name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("");

  return (letters || name.slice(0, 2)).slice(0, 2).toUpperCase();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}


function formatPackDrawDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

function leaderboardUrl(periodStart: number, periodEnd?: number): string | undefined {
  const template = PACKDRAW_LEADERBOARD_URL || DEFAULT_LEADERBOARD_URL;

  if (!PACKDRAW_API_KEY) {
    return undefined;
  }

  const url = new URL(template.replace("API_KEY", encodeURIComponent(PACKDRAW_API_KEY)));
  url.searchParams.set("apiKey", PACKDRAW_API_KEY);
  url.searchParams.set("after", formatPackDrawDate(periodStart));
  if (periodEnd !== undefined) {
    url.searchParams.set("before", formatPackDrawDate(periodEnd));
  } else {
    url.searchParams.delete("before");
  }
  return url.toString();
}

function readEntries(payload: unknown): PackDrawEntry[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const leaderboard = payload.leaderboard;
  if (Array.isArray(leaderboard)) {
    return leaderboard.filter(isRecord);
  }

  return [];
}

function normalizePlayer(entry: PackDrawEntry, index: number): LeaderboardPlayer | undefined {
  const name = toText(entry.username) || toText(entry.userId);
  const points = toNumber(entry.wagerAmount);

  if (!name || points === undefined) {
    return undefined;
  }

  const rank = index + 1;

  return {
    rank,
    name,
    handle: toText(entry.userId) || name,
    initials: initialsFor(name),
    points,
    winnings: formatCurrency(PACKDRAW_PRIZES[rank - 1] ?? 0),
    movement: "same",
  };
}

function readTimestamp(payload: RawRecord, key: "after" | "before" | "asOf"): number | undefined {
  const value = toText(payload[key]);
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function leaderboardResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

export async function GET(request: Request) {
  const periods = monthlyPeriods(PACKDRAW_PERIOD_START);
  const requestedPeriod = new URL(request.url).searchParams.get("period");
  const isHistorical = requestedPeriod !== null;
  const period = isHistorical
    ? periods.completed.find((entry) => entry.id === requestedPeriod)
    : periods.current;

  if (!period) {
    return leaderboardResponse({ players: [], error: "That completed leaderboard is not available." }, 404);
  }

  const url = leaderboardUrl(period.from, isHistorical ? period.to : undefined);

  if (!url) {
    return leaderboardResponse({ players: [], error: "Pack Draw API key is not configured." }, 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    const payload = await response.json() as unknown;

    if (!response.ok) {
      return leaderboardResponse({ players: [], error: `Pack Draw API returned ${response.status}.` }, response.status);
    }

    // Do not show an unbounded response as a completed monthly leaderboard.
    if (isHistorical && (!isRecord(payload)
      || readTimestamp(payload, "after") !== period.from
      || readTimestamp(payload, "before") !== period.to)) {
      return leaderboardResponse({ players: [], error: "Pack Draw could not verify this leaderboard period." }, 502);
    }

    const players = readEntries(payload)
      .map(normalizePlayer)
      .filter((player): player is LeaderboardPlayer => Boolean(player))
      .sort((left, right) => right.points - left.points)
      .map((player, index) => ({
        ...player,
        rank: index + 1,
        winnings: formatCurrency(PACKDRAW_PRIZES[index] ?? 0),
      }));

    const sourceWindow = isRecord(payload)
      ? {
          from: period.from,
          to: period.to,
          updatedAt: readTimestamp(payload, "asOf") ?? Date.now(),
        }
      : { from: period.from, to: period.to, updatedAt: Date.now() };

    return leaderboardResponse({
      players,
      sourceWindow,
      prizePool: PACKDRAW_PRIZES.reduce((total, prize) => total + prize, 0),
      prizes: PACKDRAW_PRIZES,
      completedPeriods: periods.completed,
    });
  } catch {
    return leaderboardResponse({ players: [], error: "Pack Draw leaderboard data is unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
