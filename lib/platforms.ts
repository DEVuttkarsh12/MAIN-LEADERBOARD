export type PlatformId = "packdraw" | "kingz";

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

export const PLATFORMS: LeaderboardPlatform[] = [
  {
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
    defaultPrizes: [500, 250, 150, 50, 25, 25],
    maxPlayers: 10,
  },
  {
    id: "kingz",
    label: "Kingz",
    shortLabel: "Kingz",
    websiteUrl: "https://kingz.win/?utm_source=DIRTYGAMBLERS",
    apiKeyEnv: "KINGZ_API_KEY",
    urlEnv: "KINGZ_LEADERBOARD_URL",
    prizesEnv: "KINGZ_PRIZES",
    periodStartEnv: "KINGZ_PERIOD_START",
    defaultPeriodStart: "2026-09-17",
    defaultUrl: "https://leaderboard.kingz.win/v1/external/affiliates",
    defaultPrizes: [2250, 1000, 500, 100, 100, 50],
    maxPlayers: Infinity,
  },
];

export const PLATFORM_BY_ID = Object.fromEntries(
  PLATFORMS.map((platform) => [platform.id, platform]),
) as Record<PlatformId, LeaderboardPlatform>;

export function isPlatformId(value: string | null | undefined): value is PlatformId {
  return typeof value === "string" && Object.hasOwn(PLATFORM_BY_ID, value);
}

export function prizePoolFor(platform: LeaderboardPlatform): number {
  return platform.defaultPrizes.reduce((total, prize) => total + prize, 0);
}