import { Suspense } from "react";
import { isPlatformId } from "../../lib/platforms";
import LeaderboardBoard from "../leaderboard-board";
import { SiteFooter, SiteHeader } from "../site-shell";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const params = await searchParams;
  const platform = isPlatformId(params.platform) ? params.platform : "packdraw";

  return (
    <main className="site-root leaderboard-page">
      <SiteHeader active="leaderboard" platform={platform} />
      <Suspense fallback={null}><LeaderboardBoard /></Suspense>
      <SiteFooter />
    </main>
  );
}