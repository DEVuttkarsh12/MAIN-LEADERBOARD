import LeaderboardBoard from "../leaderboard-board";
import { SiteFooter, SiteHeader } from "../site-shell";

export default function LeaderboardPage() {
  return (
    <main className="site-root leaderboard-page">
      <SiteHeader active="leaderboard" />
      <LeaderboardBoard />
      <SiteFooter />
    </main>
  );
}
