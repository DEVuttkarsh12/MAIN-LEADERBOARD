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
const DEFAULT_PERIOD_START = "2026-08-31";
const FALLBACK_PRIZES = [500, 250, 150, 50, 25, 25];
const PACKDRAW_PRIZES = parsePrizeList(process.env.PACKDRAW_PRIZES);

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

function parseDateOnly(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return timestamp;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function firstDayOfUtcMonthAfter(start: number, monthsToAdd: number): number {
  const date = new Date(start);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthsToAdd, 1);
}

function firstDayOfNextUtcMonth(start: number): number {
  return firstDayOfUtcMonthAfter(start, 1);
}

function addUtcMonthsClamped(start: number, monthsToAdd: number): number {
  const date = new Date(start);
  const targetMonth = date.getUTCMonth() + monthsToAdd;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const targetDay = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, normalizedMonth));

  return Date.UTC(targetYear, normalizedMonth, targetDay);
}

function isLastDayOfUtcMonth(timestamp: number): boolean {
  const date = new Date(timestamp);
  return date.getUTCDate() === daysInUtcMonth(date.getUTCFullYear(), date.getUTCMonth());
}

function configuredPeriodStart(): number {
  return parseDateOnly(PACKDRAW_PERIOD_START) ?? parseDateOnly(DEFAULT_PERIOD_START) ?? Date.UTC(2026, 7, 31);
}

function currentMonthlyPeriod(now = Date.now()) {
  const configuredStart = configuredPeriodStart();
  const usesMonthEndStart = isLastDayOfUtcMonth(configuredStart);
  let from = configuredStart;
  let to = usesMonthEndStart
    ? firstDayOfUtcMonthAfter(configuredStart, 2)
    : addUtcMonthsClamped(configuredStart, 1);

  while (now >= to) {
    from = to;
    to = usesMonthEndStart ? firstDayOfNextUtcMonth(from) : addUtcMonthsClamped(from, 1);
  }

  return { from, to };
}

function formatPackDrawDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

function leaderboardUrl(periodStart: number): string | undefined {
  const template = PACKDRAW_LEADERBOARD_URL || DEFAULT_LEADERBOARD_URL;

  if (!PACKDRAW_API_KEY) {
    return undefined;
  }

  const url = new URL(template.replace("API_KEY", encodeURIComponent(PACKDRAW_API_KEY)));
  if (template.includes("API_KEY")) {
    url.searchParams.set("after", formatPackDrawDate(periodStart));
    return url.toString();
  }

  url.searchParams.set("apiKey", PACKDRAW_API_KEY);
  url.searchParams.set("after", formatPackDrawDate(periodStart));
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

export async function GET() {
  const period = currentMonthlyPeriod();
  const url = leaderboardUrl(period.from);

  if (!url) {
    return NextResponse.json(
      { players: [], error: "Pack Draw API key is not configured." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    const payload = await response.json() as unknown;

    if (!response.ok) {
      return NextResponse.json(
        { players: [], error: `Pack Draw API returned ${response.status}.` },
        { status: response.status },
      );
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
          updatedAt: readTimestamp(payload, "asOf"),
        }
      : { from: period.from, to: period.to };

    return NextResponse.json({
      players,
      sourceWindow,
      prizePool: PACKDRAW_PRIZES.reduce((total, prize) => total + prize, 0),
      prizes: PACKDRAW_PRIZES,
    });
  } catch {
    return NextResponse.json(
      { players: [], error: "Pack Draw leaderboard data is unavailable." },
      { status: 502 },
    );
  }
}
