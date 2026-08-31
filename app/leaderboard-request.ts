"use client";

import type { LeaderboardPeriod } from "../lib/leaderboard-periods";

export type Player = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  points: number;
  winnings: string;
  movement: "up" | "down" | "same";
};

export type SourceWindow = {
  from?: number;
  to?: number;
  updatedAt?: number;
};

export type LeaderboardResponse = {
  players?: Player[];
  sourceWindow?: SourceWindow;
  prizePool?: number;
  prizes?: number[];
  error?: string;
  completedPeriods?: LeaderboardPeriod[];
};

export const leaderboardRefreshMs = 5 * 60 * 1000;

type CachedResult = { expiresAt: number; data?: LeaderboardResponse; error?: Error };
const cache = new Map<string, CachedResult>();
const pending = new Map<string, Promise<LeaderboardResponse>>();

// Reuse a recent read when moving between Home and Leaderboard.
export async function fetchLeaderboard(period?: string): Promise<LeaderboardResponse> {
  const url = period ? `/api/leaderboard?period=${encodeURIComponent(period)}` : "/api/leaderboard";
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.error) throw cached.error;
    return cached.data!;
  }
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const requestedAt = Date.now();
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
      const data = await response.json() as LeaderboardResponse;
      if (!response.ok) throw new Error(data.error ?? "Pack Draw leaderboard data is unavailable.");
      cache.set(url, { data, expiresAt: requestedAt + leaderboardRefreshMs });
      return data;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Pack Draw leaderboard data is unavailable.");
      cache.set(url, { error, expiresAt: requestedAt + leaderboardRefreshMs });
      throw error;
    } finally {
      clearTimeout(timeout);
      pending.delete(url);
      if (cache.size > 24) cache.delete(cache.keys().next().value!);
    }
  })();
  pending.set(url, request);
  return request;
}
