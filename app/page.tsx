import Link from "next/link";
import Image from "next/image";
import { PackDrawLogo, SiteFooter, SiteHeader } from "./site-shell";

export default function Home() {
  return (
    <main className="site-root home-page">
      <SiteHeader active="home" />

      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="scribble scribble-one" aria-hidden="true">DG</div>
        <div className="scribble scribble-two" aria-hidden="true">TOP</div>
        <div className="floating-game-elements" aria-hidden="true">
          <Image className="floating-piece floating-vs" src="/floating/ref-vs-badge.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="floating-piece floating-x10" src="/floating/ref-x10-star.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="floating-piece floating-cat" src="/floating/ref-cat-mascot.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="floating-piece floating-scatter" src="/floating/ref-scatter-machine.png" alt="" width={1254} height={1254} unoptimized />
        </div>

        <div className="home-hero-copy">
          <h1 id="home-title">
            <span className="word-outline">Play</span>
            <span>dirty.</span>
            <span className="word-yellow">Rank</span>
            <span className="word-tilt">clean.</span>
          </h1>
          <p>Pack Draw is live. Score. Climb. Stay ready.</p>
          <div className="hero-cta-row">
            <Link className="slash-button slash-button-yellow" href="/leaderboard">
              View rankings <b aria-hidden="true">-&gt;</b>
            </Link>
          </div>
        </div>

        <div className="leaderboard-poster-wrap" aria-hidden="true">
          <div className="poster-shadow" />
          <div className="leaderboard-poster">
            <div className="poster-top"><span className="live-sticker">Live!</span></div>
            <div className="poster-copy">
              <PackDrawLogo className="packdraw-logo-poster" />
              <strong className="poster-outline">LEADERBOARD</strong>
            </div>
            <div className="poster-bottom"><span>PACK DRAW</span><span className="poster-arrow">-&gt;</span></div>
            <span className="poster-star poster-star-one">+</span>
            <span className="poster-star poster-star-two">+</span>
          </div>
          <div className="side-sticker">NO BORING PLAYS</div>
        </div>
      </section>

      <div className="chaos-tape" aria-hidden="true">
        <div className="chaos-tape-track">
          <span>PACK DRAW</span><i>+</i><span>TAKE THE TABLE</span><i>+</i><span>DIRTYGAMBLERS</span><i>+</i>
          <span>PACK DRAW</span><i>+</i><span>TAKE THE TABLE</span><i>+</i><span>DIRTYGAMBLERS</span><i>+</i>
        </div>
      </div>

      <section className="leaderboard-callout" aria-labelledby="callout-title">
        <div className="callout-noise" aria-hidden="true" />
        <h2 id="callout-title">PACK DRAW<br /><em>TABLE.</em></h2>
        <Link className="slash-button slash-button-black" href="/leaderboard">View rankings <b>-&gt;</b></Link>
      </section>

      <section className="home-socials" aria-labelledby="social-title">
        <div className="social-heading">
          <div><h2 id="social-title">JOIN THE<br /><em>NOISE.</em></h2></div>
        </div>
        <div className="social-tickets">
          <a className="social-ticket ticket-discord" href="https://discord.gg/2cZ4HqfZdH" target="_blank" rel="noreferrer" aria-label="Join DirtyGamblers on Discord">
            <b className="social-ticket-icon">D</b><div><strong>DISCORD</strong></div><span className="social-ticket-action">JOIN -&gt;</span>
          </a>
          <a className="social-ticket ticket-kick" href="https://kick.com/dirtygamblerslive" target="_blank" rel="noreferrer" aria-label="Watch DirtyGamblers on Kick">
            <b className="social-ticket-icon">K</b><div><strong>KICK</strong></div><span className="social-ticket-action">WATCH -&gt;</span>
          </a>
          <a className="social-ticket ticket-x" href="https://x.com/Dirtygamblers" target="_blank" rel="noreferrer" aria-label="Follow DirtyGamblers on X">
            <b className="social-ticket-icon">X</b><div><strong>X / TWITTER</strong></div><span className="social-ticket-action">FOLLOW -&gt;</span>
          </a>
          <a className="social-ticket ticket-instagram" href="https://www.instagram.com/dirtygamblers" target="_blank" rel="noreferrer" aria-label="Follow DirtyGamblers on Instagram">
            <b className="social-ticket-icon">IG</b><div><strong>INSTAGRAM</strong></div><span className="social-ticket-action">FOLLOW -&gt;</span>
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
