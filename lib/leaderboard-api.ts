import type { LeaderboardPlatform, PlatformId } from "./platforms";
import { PLATFORM_BY_ID } from "./platforms";
import { monthlyPeriods, type LeaderboardPeriod } from "./leaderboard-periods";

export type LeaderboardPlayer = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  points: number;
  winnings: string;
  movement: "up" | "down" | "same";
};

export type LeaderboardSourceWindow = {
  from: number;
  to: number;
  updatedAt: number;
};

export type LeaderboardApiPayload = Record<string, unknown>;

export type LeaderboardApiResult = {
  status: number;
  payload: LeaderboardApiPayload;
};

type RawRecord = Record<string, unknown>;

type NormalizedPlayer = Omit<LeaderboardPlayer, "rank" | "winnings">;

const UPSTREAM_TIMEOUT_MS = 10_000;

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

function pickText(record: RawRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toText(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function pickNumber(record: RawRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value !== undefined) {
      return value;
    }
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

function formatPackDrawDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

function formatDayDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function readTimestamp(record: RawRecord, key: string): number | undefined {
  const value = toText(record[key]);
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function resolvePlatform(id: string | null): LeaderboardPlatform | undefined {
  if (id === null || id === "") {
    return PLATFORM_BY_ID.packdraw;
  }
  return Object.hasOwn(PLATFORM_BY_ID, id) ? PLATFORM_BY_ID[id as PlatformId] : undefined;
}

export function readApiKey(platform: LeaderboardPlatform): string | undefined {
  return process.env[platform.apiKeyEnv]?.trim() || undefined;
}

function readPeriodStart(platform: LeaderboardPlatform): string {
  return process.env[platform.periodStartEnv]?.trim() || platform.defaultPeriodStart;
}

function readPrizeList(platform: LeaderboardPlatform): number[] {
  const prizes = process.env[platform.prizesEnv]
    ?.split(/[\s,]+/)
    .map((amount) => Number(amount.trim()))
    .filter((amount) => Number.isFinite(amount) && amount >= 0);

  return prizes && prizes.length > 0 ? prizes : platform.defaultPrizes;
}

function buildSourceUrl(
  platform: LeaderboardPlatform,
  apiKey: string,
  period: LeaderboardPeriod,
  isHistorical: boolean,
): string | undefined {
  const template = process.env[platform.urlEnv]?.trim() || platform.defaultUrl;

  if (platform.id === "packdraw") {
    const url = new URL(template.replace("API_KEY", encodeURIComponent(apiKey)));
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("after", formatPackDrawDate(period.from));
    if (isHistorical) {
      url.searchParams.set("before", formatPackDrawDate(period.to));
    } else {
      url.searchParams.delete("before");
    }
    return url.toString();
  }

  const url = new URL(template);
  url.searchParams.set("start_at", formatDayDate(period.from));
  url.searchParams.set("end_at", formatDayDate(period.to - 1));
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function readPackDrawEntries(payload: unknown): RawRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload) && Array.isArray(payload.leaderboard)) {
    return payload.leaderboard.filter(isRecord);
  }

  return [];
}

function readKingzEntries(payload: unknown): RawRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ["affiliates", "players", "data", "results", "entries", "leaderboard"]) {
    if (Array.isArray(payload[key])) {
      return payload[key].filter(isRecord);
    }
  }

  return [];
}

function normalizePackDrawPlayer(entry: RawRecord): NormalizedPlayer | undefined {
  const name = toText(entry.username) || toText(entry.userId);
  const points = toNumber(entry.wagerAmount);

  if (!name || points === undefined) {
    return undefined;
  }

  return {
    name,
    handle: toText(entry.userId) || name,
    initials: initialsFor(name),
    points,
    movement: "same",
  };
}

function normalizeKingzPlayer(entry: RawRecord): NormalizedPlayer | undefined {
  const name =
    pickText(entry, [
      "username",
      "user_name",
      "player",
      "player_name",
      "display_name",
      "nickname",
      "name",
      "handle",
    ]) ||
    pickText(entry, ["user_id", "userId", "player_id", "playerId", "id", "uid"]);

  const points = pickNumber(entry, [
    "wagered_amount",
    "wager_amount",
    "wagerAmount",
    "total_wager",
    "totalWagered",
    "total_wagered",
    "wagered",
    "turnover",
    "volume",
    "stake",
    "amount",
    "points",
    "wager",
    "score",
  ]);

  if (!name || points === undefined) {
    return undefined;
  }

  return {
    name,
    handle: pickText(entry, ["user_id", "userId", "player_id", "playerId", "id", "uid"]) || name,
    initials: initialsFor(name),
    points,
    movement: "same",
  };
}

function normalizeHistoricalEntries(
  platform: LeaderboardPlatform,
  payload: unknown,
): NormalizedPlayer[] {
  if (platform.id === "kingz") {
    return readKingzEntries(payload)
      .map(normalizeKingzPlayer)
      .filter((player): player is NormalizedPlayer => Boolean(player));
  }

  return readPackDrawEntries(payload)
    .map(normalizePackDrawPlayer)
    .filter((player): player is NormalizedPlayer => Boolean(player));
}

function verifyHistoricalWindow(
  platform: LeaderboardPlatform,
  payload: unknown,
  period: LeaderboardPeriod,
): boolean {
  if (platform.id === "packdraw") {
    return (
      isRecord(payload) &&
      readTimestamp(payload, "after") === period.from &&
      readTimestamp(payload, "before") === period.to
    );
  }

  // The Kingz feed does not always echo the requested window. When the keys are
  // present, require them to match the bounded monthly period exactly.
  if (isRecord(payload)) {
    const start = readTimestamp(payload, "start_at");
    const end = readTimestamp(payload, "end_at");
    if (start !== undefined || end !== undefined) {
      return start === period.from && end === period.to - 24 * 60 * 60 * 1000;
    }
  }

  return true;
}

function sourceUpdatedAt(platform: LeaderboardPlatform, payload: unknown): number {
  if (isRecord(payload)) {
    const keys = platform.id === "kingz"
      ? ["asOf", "as_of", "updated_at", "generated_at", "cache_updated_at"]
      : ["asOf"];
    for (const key of keys) {
      const timestamp = readTimestamp(payload, key);
      if (timestamp !== undefined) {
        return timestamp;
      }
    }
  }

  return Date.now();
}

function buildLeaderboardPayload(
  platform: LeaderboardPlatform,
  payload: unknown,
  period: LeaderboardPeriod,
  completedPeriods: LeaderboardPeriod[],
): LeaderboardApiResult {
  const prizes = readPrizeList(platform);
  const rankedPlayers = normalizeHistoricalEntries(platform, payload).sort(
    (left, right) => right.points - left.points,
  );

  const totalWagered = rankedPlayers.reduce((total, player) => total + player.points, 0);
  const players = rankedPlayers.slice(0, platform.maxPlayers).map((player, index) => ({
    ...player,
    rank: index + 1,
    winnings: formatCurrency(prizes[index] ?? 0),
  }));

  return {
    status: 200,
    payload: {
      platform: platform.id,
      name: platform.label,
      players,
      totalPlayers: rankedPlayers.length,
      totalWagered,
      sourceWindow: {
        from: period.from,
        to: period.to,
        updatedAt: sourceUpdatedAt(platform, payload),
      },
      prizePool: prizes.reduce((total, prize) => total + prize, 0),
      prizes,
      completedPeriods,
    },
  };
}

export async function getLeaderboard(options: {
  platformId: string | null;
  periodId: string | null;
}): Promise<LeaderboardApiResult> {
  const platform = resolvePlatform(options.platformId);
  if (!platform) {
    return {
      status: 400,
      payload: { players: [], error: "That leaderboard platform is not available." },
    };
  }

  const periods = monthlyPeriods(readPeriodStart(platform));
  const isHistorical = options.periodId !== null;
  const period = isHistorical
    ? periods.completed.find((entry) => entry.id === options.periodId)
    : periods.current;

  if (!period) {
    return {
      status: 404,
      payload: { players: [], error: "That completed leaderboard is not available." },
    };
  }

  const apiKey = readApiKey(platform);
  let url: string | undefined;
  try {
    url = buildSourceUrl(platform, apiKey ?? "", period, isHistorical);
  } catch {
    url = undefined;
  }

  if (!apiKey || !url) {
    return {
      status: 500,
      payload: { players: [], error: `${platform.label} API key is not configured.` },
    };
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
      return {
        status: response.status,
        payload: { players: [], error: `${platform.label} API returned ${response.status}.` },
      };
    }

    if (isHistorical && !verifyHistoricalWindow(platform, payload, period)) {
      return {
        status: 502,
        payload: { players: [], error: `${platform.label} could not verify this leaderboard period.` },
      };
    }

    return buildLeaderboardPayload(platform, payload, period, periods.completed);
  } catch {
    return {
      status: 502,
      payload: { players: [], error: `${platform.label} leaderboard data is unavailable.` },
    };
  } finally {
    clearTimeout(timeout);
  }
}