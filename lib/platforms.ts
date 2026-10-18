export type PlatformId = "packdraw";

export type LeaderboardPlatform = {
  id: PlatformId;
  label: string;
  shortLabel: string;
  websiteUrl: string;
  apiKeyEnv: string;
  urlEnv: string;
  prizesEnv: string;
  periodStartEnv: string;
  defaultPeriodStart: string;
  defaultUrl: string;
  defaultPrizes: number[];
  maxPlayers: number;
};

export const PACKDRAW: LeaderboardPlatform = {
  id: "packdraw",
  label: "Pack Draw",
  shortLabel: "PackDraw",
  websiteUrl: "https://packdraw.com/",
  apiKeyEnv: "PACKDRAW_API_KEY",
  urlEnv: "PACKDRAW_LEADERBOARD_URL",
  prizesEnv: "PACKDRAW_PRIZES",
  periodStartEnv: "PACKDRAW_PERIOD_START",
  defaultPeriodStart: "2026-08-31",
  defaultUrl: "https://packdraw.com/api/v1/affiliates/leaderboard?apiKey=API_KEY",
  defaultPrizes: [2000, 950, 500, 200, 150, 75, 75, 50],
  maxPlayers: 10,
};

export const PLATFORM_BY_ID: Record<PlatformId, LeaderboardPlatform> = {
  packdraw: PACKDRAW,
};

export function resolvePlatformId(value: string | null | undefined): PlatformId | undefined {
  return typeof value === "string" && Object.hasOwn(PLATFORM_BY_ID, value)
    ? (value as PlatformId)
    : undefined;
}

export function prizePoolFor(platform: LeaderboardPlatform): number {
  return platform.defaultPrizes.reduce((total, prize) => total + prize, 0);
}