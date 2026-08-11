import { NextResponse } from "next/server";

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

const CASEBATTLE_LEADERBOARD_URL = process.env.CASEBATTLE_LEADERBOARD_URL;

const arrayKeys = ["data", "leaderboard", "players", "results", "items", "entries"];
const nameKeys = ["username", "userName", "displayName", "nickname", "name", "playerName", "player"];
const handleKeys = ["handle", "slug", "userId", "userid", "id"];
const rankKeys = ["rank", "position", "place"];
const pointsKeys = ["points", "score", "total", "value", "amount", "wagered", "wager", "tickets"];
const movementKeys = ["movement", "trend", "change", "rankChange", "positionChange"];
const maxLeaderboardPlayers = 5;
const leaderboardPrize = 1000;

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of arrayKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (isRecord(value)) {
      const nested = extractEntries(value);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function readValue(record: RawRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  for (const nestedKey of ["user", "player", "profile"]) {
    const nested = record[nestedKey];
    if (!isRecord(nested)) {
      continue;
    }

    for (const key of keys) {
      const value = nested[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
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

  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
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

function leaderboardPrizeLabel(): string {
  return formatCurrency(leaderboardPrize);
}

function toMovement(value: unknown): LeaderboardPlayer["movement"] {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? "up" : value < 0 ? "down" : "same";
  }

  if (typeof value !== "string") {
    return "same";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("up") || normalized.includes("rise") || normalized.includes("+")) {
    return "up";
  }
  if (normalized.includes("down") || normalized.includes("fall") || normalized.includes("-")) {
    return "down";
  }

  return "same";
}

function normalizePlayer(entry: unknown, index: number): LeaderboardPlayer | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const rawName = toText(readValue(entry, nameKeys));
  const rawHandle = toText(readValue(entry, handleKeys));
  const name = rawName ?? rawHandle ?? `Player ${index + 1}`;
  const rank = Math.max(1, Math.trunc(toNumber(readValue(entry, rankKeys)) ?? index + 1));
  const points = toNumber(readValue(entry, pointsKeys)) ?? 0;
  const handle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`) : `#${rank}`;

  return {
    rank,
    name,
    handle,
    initials: initialsFor(name),
    points,
    winnings: "$0",
    movement: toMovement(readValue(entry, movementKeys)),
  };
}

export async function GET() {
  if (!CASEBATTLE_LEADERBOARD_URL) {
    return NextResponse.json(
      { players: [], error: "Leaderboard API URL is not configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(CASEBATTLE_LEADERBOARD_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { players: [], error: "Leaderboard data is unavailable." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload: unknown = await response.json();
    const players = extractEntries(payload)
      .map(normalizePlayer)
      .filter((player): player is LeaderboardPlayer => Boolean(player))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, maxLeaderboardPlayers)
      .map((player, index) => {
        const rank = index + 1;
        return { ...player, rank, winnings: leaderboardPrizeLabel() };
      });

    return NextResponse.json(
      { players, sourceUpdatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { players: [], error: "Leaderboard data is unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
