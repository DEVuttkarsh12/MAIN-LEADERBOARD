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
const nextPageKeys = ["next", "nextUrl", "nextURL", "next_page_url", "nextPageUrl"];
const nextPageContainers = ["links", "pagination", "paging", "pageInfo", "meta"];
const maxLeaderboardPages = 20;
const prizesByRank: Record<number, number> = {
  1: 500,
  2: 250,
  3: 100,
  4: 50,
  5: 25,
};

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKnownPlayerField(record: RawRecord): boolean {
  return (
    toText(readValue(record, nameKeys)) !== undefined ||
    toText(readValue(record, handleKeys)) !== undefined ||
    toNumber(readValue(record, rankKeys)) !== undefined ||
    toNumber(readValue(record, pointsKeys)) !== undefined
  );
}

function recordValuesAsEntries(record: RawRecord): unknown[] {
  const values = Object.values(record);
  if (values.length === 0 || !values.every(isRecord)) {
    return [];
  }

  return values.some(hasKnownPlayerField) ? values : [];
}

function extractEntries(payload: unknown, visited = new Set<unknown>()): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (visited.has(payload)) {
    return [];
  }
  visited.add(payload);

  for (const key of arrayKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }

    if (isRecord(value)) {
      const mappedEntries = recordValuesAsEntries(value);
      if (mappedEntries.length > 0) {
        return mappedEntries;
      }

      const nested = extractEntries(value, visited);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  const mappedEntries = recordValuesAsEntries(payload);
  if (mappedEntries.length > 0) {
    return mappedEntries;
  }

  if (hasKnownPlayerField(payload)) {
    return [payload];
  }

  for (const value of Object.values(payload)) {
    const nested = extractEntries(value, visited);
    if (nested.length > 0) {
      return nested;
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

function prizeForRank(rank: number): string {
  return formatCurrency(prizesByRank[rank] ?? 0);
}

function textValue(value: unknown): string | undefined {
  const text = toText(value);
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
    return undefined;
  }

  return text;
}

function toAbsoluteUrl(value: unknown, baseUrl: string): string | undefined {
  const text = textValue(value);
  if (!text) {
    return undefined;
  }

  try {
    return new URL(text, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function nextPageUrl(payload: unknown, currentUrl: string): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  for (const key of nextPageKeys) {
    const url = toAbsoluteUrl(payload[key], currentUrl);
    if (url) {
      return url;
    }
  }

  for (const containerKey of nextPageContainers) {
    const container = payload[containerKey];
    if (!isRecord(container)) {
      continue;
    }

    for (const key of nextPageKeys) {
      const url = toAbsoluteUrl(container[key], currentUrl);
      if (url) {
        return url;
      }
    }
  }

  return undefined;
}

async function fetchLeaderboardPayloads(url: string): Promise<unknown[]> {
  const payloads: unknown[] = [];
  const visitedUrls = new Set<string>();
  let currentUrl: string | undefined = url;

  while (currentUrl && !visitedUrls.has(currentUrl) && payloads.length < maxLeaderboardPages) {
    visitedUrls.add(currentUrl);

    const response = await fetch(currentUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Leaderboard data is unavailable.");
    }

    const payload: unknown = await response.json();
    payloads.push(payload);
    currentUrl = nextPageUrl(payload, currentUrl);
  }

  return payloads;
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
    const payloads = await fetchLeaderboardPayloads(CASEBATTLE_LEADERBOARD_URL);
    const players = payloads
      .flatMap((payload) => extractEntries(payload))
      .map(normalizePlayer)
      .filter((player): player is LeaderboardPlayer => Boolean(player))
      .sort((a, b) => a.rank - b.rank)
      .map((player, index) => {
        const rank = index + 1;
        return { ...player, rank, winnings: prizeForRank(rank) };
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
