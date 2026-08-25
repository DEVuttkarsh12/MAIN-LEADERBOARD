import { NextResponse } from "next/server";

type RawRecord = Record<string, unknown>;

type LeaderboardRequestUrl = {
  label: string;
  url: string;
};

type SafeUrlDetails = {
  host: string;
  pathname: string;
  queryKeys: string[];
};

type FetchPageDiagnostic = SafeUrlDetails & {
  status: number;
  statusText?: string;
  ok: boolean;
  entryCount: number;
  totalCount?: number;
  upstreamUpdatedAt?: string;
  responseHint?: string;
};

type FetchAttemptDiagnostic = {
  label: string;
  playerCount: number;
  pageCount: number;
  pages: FetchPageDiagnostic[];
  error?: string;
};

export type LeaderboardPlayer = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  points: number;
  winnings: string;
  movement: "up" | "down" | "same";
};

class LeaderboardFetchError extends Error {
  pages: FetchPageDiagnostic[];

  constructor(message: string, pages: FetchPageDiagnostic[]) {
    super(message);
    this.name = "LeaderboardFetchError";
    this.pages = pages;
  }
}

const CASEBATTLE_LEADERBOARD_URL = process.env.CASEBATTLE_LEADERBOARD_URL;
const CASEBATTLE_LEADERBOARD_PASSWORD = process.env.CASEBATTLE_LEADERBOARD_PASSWORD?.trim();

const arrayKeys = ["data", "leaderboard", "players", "results", "items", "entries", "rows", "records", "rankings", "scores", "users"];
const nameKeys = ["username", "userName", "user_name", "displayName", "display_name", "nickname", "name", "playerName", "player_name", "player", "user"];
const handleKeys = ["handle", "slug", "userId", "userid", "user_id", "playerId", "player_id", "accountId", "account_id", "uuid", "id"];
const rankKeys = ["rank", "position", "place"];
const pointsKeys = [
  "points",
  "score",
  "total",
  "value",
  "amount",
  "wagered",
  "wager",
  "tickets",
  "totalWagered",
  "total_wagered",
  "wageredAmount",
  "wagered_amount",
  "totalAmountBet",
  "total_amount_bet",
  "amountBet",
  "amount_bet",
  "dollars",
  "usd",
];
const movementKeys = ["movement", "trend", "change", "rankChange", "positionChange"];
const nextPageKeys = ["next", "nextPage", "nextUrl", "nextURL", "next_page", "next_page_url", "nextPageUrl"];
const cursorKeys = ["nextCursor", "next_cursor", "endCursor", "end_cursor", "cursor"];
const hasNextPageKeys = ["hasNextPage", "has_next_page", "hasMore", "has_more"];
const nextPageContainers = ["links", "pagination", "paging", "pageInfo", "meta", "urls"];
const currentPageKeys = ["page", "currentPage", "current_page", "pageNumber", "page_number"];
const offsetKeys = ["offset", "skip"];
const totalPagesKeys = ["totalPages", "total_pages", "lastPage", "last_page", "pageCount", "page_count", "pages"];
const totalCountKeys = ["total", "totalCount", "total_count", "totalItems", "total_items", "count"];
const upstreamUpdatedAtKeys = ["updatedAt", "updated_at", "sourceUpdatedAt", "source_updated_at", "lastUpdated", "last_updated", "timestamp", "generatedAt", "generated_at"];
const leaderboardSeasonStartTime = new Date("2026-08-25T00:00:00.000Z").getTime();
const leaderboardSeasonDurationMs = 14 * 24 * 60 * 60 * 1000;
const maxLeaderboardPages = 20;
const leaderboardPageSize = 50;
const nestedRecordKeys = [
  "user",
  "player",
  "profile",
  "node",
  "entry",
  "participant",
  "account",
  "member",
  "customer",
  "stats",
  "statistics",
  "metrics",
  "totals",
  "summary",
  "wager",
  "wagers",
  "leaderboardEntry",
  "leaderboard_entry",
];
const prizesByRank: Record<number, number> = {
  1: 275,
  2: 200,
  3: 150,
  4: 75,
  5: 50,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKnownPlayerField(record: RawRecord): boolean {
  const hasIdentity = toText(readValue(record, nameKeys)) !== undefined || toText(readValue(record, handleKeys)) !== undefined;
  const hasRankOrPoints = toNumber(readValue(record, rankKeys)) !== undefined || toNumber(readValue(record, pointsKeys)) !== undefined;
  return hasIdentity && hasRankOrPoints;
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

  const entries: unknown[] = [];

  for (const key of arrayKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      entries.push(...value);
      continue;
    }

    if (isRecord(value)) {
      const mappedEntries = recordValuesAsEntries(value);
      if (mappedEntries.length > 0) {
        entries.push(...mappedEntries);
      }

      entries.push(...extractEntries(value, visited));
    }
  }

  const mappedEntries = recordValuesAsEntries(payload);
  if (mappedEntries.length > 0) {
    entries.push(...mappedEntries);
  }

  if (hasKnownPlayerField(payload)) {
    entries.push(payload);
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      entries.push(...value);
      continue;
    }

    entries.push(...extractEntries(value, visited));
  }

  return entries;
}

function readValue(record: RawRecord, keys: string[], depth = 0): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      if (isRecord(value) && depth < 3) {
        const nestedValue = readValue(value, keys, depth + 1);
        if (nestedValue !== undefined) {
          return nestedValue;
        }

        continue;
      }

      return value;
    }
  }

  if (depth >= 3) {
    return undefined;
  }

  for (const nestedKey of nestedRecordKeys) {
    const nested = record[nestedKey];
    if (!isRecord(nested)) {
      continue;
    }

    const value = readValue(nested, keys, depth + 1);
    if (value !== undefined) {
      return value;
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

  const numericText = value.replace(/[$,\s]/g, "").match(/-?\d+(?:\.\d+)?/)?.[0];
  if (!numericText) {
    return undefined;
  }

  const parsed = Number(numericText);
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

function currentSeasonRange() {
  return {
    from: leaderboardSeasonStartTime,
    to: leaderboardSeasonStartTime + leaderboardSeasonDurationMs,
  };
}

function currentSeasonIsoRange() {
  const { from, to } = currentSeasonRange();

  return {
    from: new Date(from).toISOString(),
    to: new Date(to - 1).toISOString(),
  };
}

function textValue(value: unknown): string | undefined {
  const text = toText(value);
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
    return undefined;
  }

  return text;
}

function containerRecords(payload: unknown): RawRecord[] {
  if (!isRecord(payload)) {
    return [];
  }

  return [
    payload,
    ...nextPageContainers.map((key) => payload[key]).filter(isRecord),
  ];
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
  for (const container of containerRecords(payload)) {
    for (const key of nextPageKeys) {
      const url = toAbsoluteUrl(container[key], currentUrl);
      if (url) {
        return url;
      }
    }
  }

  return undefined;
}

function readBooleanFromContainers(payload: unknown, keys: string[]): boolean | undefined {
  for (const container of containerRecords(payload)) {
    const value = readValue(container, keys);
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
  }

  return undefined;
}

function readNumberFromContainers(payload: unknown, keys: string[]): number | undefined {
  for (const container of containerRecords(payload)) {
    const value = toNumber(readValue(container, keys));
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readTextFromContainers(payload: unknown, keys: string[]): string | undefined {
  for (const container of containerRecords(payload)) {
    const value = toText(readValue(container, keys));
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function safeUrlDetails(url: string): SafeUrlDetails {
  const requestUrl = new URL(url);

  return {
    host: requestUrl.host,
    pathname: requestUrl.pathname,
    queryKeys: Array.from(requestUrl.searchParams.keys()).sort(),
  };
}

function normalizeConfiguredUrl(url: string): string {
  const requestUrl = new URL(url.trim());

  for (const [key, value] of Array.from(requestUrl.searchParams.entries())) {
    const trimmedValue = value.trim();
    if (trimmedValue !== value) {
      requestUrl.searchParams.set(key, trimmedValue);
    }
  }

  if (CASEBATTLE_LEADERBOARD_PASSWORD) {
    requestUrl.searchParams.set("password", CASEBATTLE_LEADERBOARD_PASSWORD);
  }

  return requestUrl.toString();
}

function cursorNextPageUrl(payload: unknown, currentUrl: string): string | undefined {
  const hasNextPage = readBooleanFromContainers(payload, hasNextPageKeys);
  if (hasNextPage === false) {
    return undefined;
  }

  const cursor = readTextFromContainers(payload, cursorKeys);
  if (!cursor) {
    return undefined;
  }

  const url = new URL(currentUrl);
  url.searchParams.set("cursor", cursor);
  url.searchParams.set("after", cursor);
  setPageSizeParams(url);

  return url.toString();
}

function pageDiagnostic(url: string, response: Pick<Response, "ok" | "status" | "statusText">, payload?: unknown, responseHint?: string): FetchPageDiagnostic {
  return {
    ...safeUrlDetails(url),
    status: response.status,
    statusText: response.statusText || undefined,
    ok: response.ok,
    entryCount: payload === undefined ? 0 : extractEntries(payload).length,
    totalCount: payload === undefined ? undefined : readNumberFromContainers(payload, totalCountKeys),
    upstreamUpdatedAt: payload === undefined ? undefined : readTextFromContainers(payload, upstreamUpdatedAtKeys),
    responseHint,
  };
}

function setPageSizeParams(url: URL) {
  url.searchParams.set("limit", String(leaderboardPageSize));
  url.searchParams.set("perPage", String(leaderboardPageSize));
  url.searchParams.set("per_page", String(leaderboardPageSize));
  url.searchParams.set("pageSize", String(leaderboardPageSize));
  url.searchParams.set("page_size", String(leaderboardPageSize));
  url.searchParams.set("size", String(leaderboardPageSize));
  url.searchParams.set("take", String(leaderboardPageSize));
}

function setLimitParam(url: string) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("limit", String(leaderboardPageSize));
  return requestUrl.toString();
}

function setSeasonIsoLimitParams(url: string) {
  const requestUrl = new URL(url);
  const { from, to } = currentSeasonIsoRange();

  requestUrl.searchParams.set("from", from);
  requestUrl.searchParams.set("to", to);
  requestUrl.searchParams.set("limit", String(leaderboardPageSize));

  return requestUrl.toString();
}

function setCurrentIsoLimitParams(url: string, from: string) {
  const requestUrl = new URL(url);

  requestUrl.searchParams.set("from", from);
  requestUrl.searchParams.set("to", new Date().toISOString());
  requestUrl.searchParams.set("limit", String(leaderboardPageSize));

  return requestUrl.toString();
}

function setConfiguredFromToNowLimitParams(url: string) {
  const requestUrl = new URL(url);
  const configuredFrom = requestUrl.searchParams.get("from");

  if (!configuredFrom) {
    return setCurrentIsoLimitParams(url, currentSeasonIsoRange().from);
  }

  requestUrl.searchParams.set("to", new Date().toISOString());
  requestUrl.searchParams.set("limit", String(leaderboardPageSize));

  return requestUrl.toString();
}

function leaderboardRequestUrls(url: string): LeaderboardRequestUrl[] {
  const normalizedUrl = normalizeConfiguredUrl(url);
  const requests: LeaderboardRequestUrl[] = [
    { label: "season-iso-limit-only", url: setSeasonIsoLimitParams(normalizedUrl) },
    { label: "configured", url: normalizedUrl },
    { label: "configured-from-to-now-limit-only", url: setConfiguredFromToNowLimitParams(normalizedUrl) },
    { label: "season-iso-to-now-limit-only", url: setCurrentIsoLimitParams(normalizedUrl, currentSeasonIsoRange().from) },
    { label: "limit-only", url: setLimitParam(normalizedUrl) },
  ];
  const seen = new Set<string>();

  return requests.filter((request) => {
    if (seen.has(request.url)) {
      return false;
    }

    seen.add(request.url);
    return true;
  });
}

function pageNumberUrl(currentUrl: string, page: number, offset = (page - 1) * leaderboardPageSize): string {
  const url = new URL(currentUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("offset", String(offset));
  setPageSizeParams(url);
  return url.toString();
}

function currentOffset(payload: unknown, currentUrl: string): number {
  const offsetFromPayload = readNumberFromContainers(payload, offsetKeys);
  if (offsetFromPayload !== undefined) {
    return Math.max(0, Math.trunc(offsetFromPayload));
  }

  const offsetFromUrl = Number(new URL(currentUrl).searchParams.get("offset"));
  return Number.isFinite(offsetFromUrl) && offsetFromUrl > 0 ? Math.trunc(offsetFromUrl) : 0;
}

function currentPageNumber(payload: unknown, currentUrl: string): number {
  const pageFromPayload = readNumberFromContainers(payload, currentPageKeys);
  if (pageFromPayload !== undefined) {
    return Math.max(1, Math.trunc(pageFromPayload));
  }

  const pageFromUrl = Number(new URL(currentUrl).searchParams.get("page"));
  return Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? Math.trunc(pageFromUrl) : 1;
}

function fallbackNextPageUrl(payload: unknown, currentUrl: string, entryCount: number): string | undefined {
  const currentPage = currentPageNumber(payload, currentUrl);
  const offset = currentOffset(payload, currentUrl);
  const totalPages = readNumberFromContainers(payload, totalPagesKeys);
  if (totalPages !== undefined && currentPage < totalPages) {
    return pageNumberUrl(currentUrl, currentPage + 1);
  }

  const totalCount = readNumberFromContainers(payload, totalCountKeys);
  if (totalCount !== undefined && offset + entryCount < totalCount) {
    return pageNumberUrl(currentUrl, currentPage + 1, offset + Math.max(1, entryCount));
  }

  return entryCount >= leaderboardPageSize ? pageNumberUrl(currentUrl, currentPage + 1) : undefined;
}

async function safeResponseHint(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text.trim()) {
      return undefined;
    }

    return text
      .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[redacted]"')
      .replace(/password=([^&\s"]+)/gi, "password=[redacted]")
      .slice(0, 500);
  } catch {
    return undefined;
  }
}

async function fetchLeaderboardPayloads(url: string): Promise<{ payloads: unknown[]; pages: FetchPageDiagnostic[] }> {
  const payloads: unknown[] = [];
  const pages: FetchPageDiagnostic[] = [];
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
      pages.push(pageDiagnostic(currentUrl, response, undefined, await safeResponseHint(response)));
      throw new LeaderboardFetchError(`Leaderboard API returned ${response.status}.`, pages);
    }

    const payload: unknown = await response.json();
    const entryCount = extractEntries(payload).length;
    pages.push(pageDiagnostic(currentUrl, response, payload));
    payloads.push(payload);
    currentUrl = nextPageUrl(payload, currentUrl) ?? cursorNextPageUrl(payload, currentUrl) ?? fallbackNextPageUrl(payload, currentUrl, entryCount);
  }

  return { payloads, pages };
}

function normalizePlayers(payloads: unknown[]) {
  return payloads
    .flatMap((payload) => extractEntries(payload))
    .map(normalizePlayer)
    .filter((player): player is LeaderboardPlayer => Boolean(player))
    .reduce<LeaderboardPlayer[]>((uniquePlayers, player) => {
      const existingIndex = uniquePlayers.findIndex((existingPlayer) => playerKey(existingPlayer) === playerKey(player));
      if (existingIndex === -1) {
        uniquePlayers.push(player);
        return uniquePlayers;
      }

      if (player.points > uniquePlayers[existingIndex].points) {
        uniquePlayers[existingIndex] = player;
      }

      return uniquePlayers;
    }, [])
    .sort((a, b) => b.points - a.points || a.rank - b.rank)
    .map((player, index) => {
      const rank = index + 1;
      return { ...player, rank, winnings: prizeForRank(rank) };
    });
}

async function fetchBestLeaderboard(url: string) {
  let bestPlayers: LeaderboardPlayer[] = [];
  let selectedLabel = "none";
  const attempts: FetchAttemptDiagnostic[] = [];

  for (const request of leaderboardRequestUrls(url)) {
    try {
      const result = await fetchLeaderboardPayloads(request.url);
      const players = normalizePlayers(result.payloads);
      attempts.push({
        label: request.label,
        playerCount: players.length,
        pageCount: result.pages.length,
        pages: result.pages,
      });

      if (players.length > bestPlayers.length) {
        bestPlayers = players;
        selectedLabel = request.label;
      }
    } catch (error) {
      const pages = error instanceof LeaderboardFetchError ? error.pages : [];
      attempts.push({
        label: request.label,
        playerCount: 0,
        pageCount: pages.length,
        pages,
        error: error instanceof Error ? error.message : "Leaderboard data is unavailable.",
      });
    }
  }

  return { players: bestPlayers, selectedLabel, attempts };
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

function playerKey(player: LeaderboardPlayer): string {
  const normalizedHandle = player.handle.toLowerCase();
  const normalizedName = player.name.toLowerCase();

  return normalizedHandle.startsWith("#") ? `name:${normalizedName}` : `handle:${normalizedHandle}`;
}

export async function GET(request: Request) {
  if (!CASEBATTLE_LEADERBOARD_URL) {
    return NextResponse.json(
      { players: [], error: "Leaderboard API URL is not configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const debug = new URL(request.url).searchParams.get("debug") === "1";
    const fetchedAt = new Date().toISOString();
    const result = await fetchBestLeaderboard(CASEBATTLE_LEADERBOARD_URL);
    const successfulAttempts = result.attempts.filter((attempt) => !attempt.error).length;
    const responseBody = {
      players: result.players,
      season: currentSeasonRange(),
      source: {
        type: "live-api",
        fetchedAt,
        selectedVariant: result.selectedLabel,
        playerCount: result.players.length,
        attemptedVariants: result.attempts.length,
        successfulVariants: successfulAttempts,
      },
      sourceUpdatedAt: fetchedAt,
      ...(debug ? { diagnostics: result.attempts } : {}),
    };

    return NextResponse.json(
      responseBody,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { players: [], error: "Leaderboard data is unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
