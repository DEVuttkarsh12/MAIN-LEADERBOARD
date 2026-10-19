import type { Metadata } from "next";
import Image from "next/image";
import { GAMBA_LEADERBOARD_URL } from "../../lib/gamba";
import { SiteFooter, SiteHeader } from "../site-shell";

export const metadata: Metadata = {
  title: "Gamba | DirtyGamblers",
  description: "View the DirtyGamblers Gamba leaderboard.",
};

export default function GambaPage() {
  return (
    <main className="site-root gamba-page">
      <SiteHeader active="gamba" />

      <section className="gamba-hero" aria-labelledby="gamba-title">
        <div className="gamba-panel">
          <div className="gamba-decoration" aria-hidden="true">
            <span className="gamba-watermark">G</span>
            <Image
              className="gamba-diamond"
              src="/floating/leaderboard-diamond.png"
              alt=""
              width={512}
              height={512}
              unoptimized
            />
            <Image
              className="gamba-gold"
              src="/floating/leaderboard-gold-bars.png"
              alt=""
              width={512}
              height={326}
              unoptimized
            />
          </div>

          <div className="gamba-copy">
            <span className="section-code">LEADERBOARD</span>
            <h1 id="gamba-title">Gamba</h1>
            <a
              className="slash-button slash-button-yellow"
              href={GAMBA_LEADERBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              View leaderboard <b aria-hidden="true">↗</b>
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
