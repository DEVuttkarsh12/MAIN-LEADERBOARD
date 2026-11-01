import { exportPackDrawPeriod } from "../../../lib/packdraw-export";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Temporary, preview-only export. The password stays outside source control.
const TOKEN_HASH = "164a3cf9fdebf35d684da918fefd9dfec1733a53e9d53a91d195adad1d1df4f9";
const EXPIRES_AT = 1793612864087;

function handle(request: Request) {
  return exportPackDrawPeriod(request, {
    environment: process.env.VERCEL_ENV,
    apiKey: process.env.PACKDRAW_API_KEY,
    urlTemplate: process.env.PACKDRAW_LEADERBOARD_URL,
    tokenHash: TOKEN_HASH,
    expiresAt: EXPIRES_AT,
  });
}

export const GET = handle;
export const POST = handle;
