import { NextResponse } from "next/server";
import { getLeaderboard } from "../../../lib/leaderboard-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CLIENT_REFRESH_SECONDS = 5 * 60;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Leaderboard-Refresh-Seconds": String(CLIENT_REFRESH_SECONDS),
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { status, payload } = await getLeaderboard({
    platformId: url.searchParams.get("platform"),
    periodId: url.searchParams.get("period"),
  });

  return NextResponse.json(payload, {
    status,
    headers: RESPONSE_HEADERS,
  });
}