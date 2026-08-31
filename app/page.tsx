import Link from "next/link";
import Image from "next/image";
import { PackDrawLogo, ShuffleLogo, SiteFooter, SiteHeader } from "./site-shell";

export default function Home() {
  return (
    <main className="site-root home-page">
      <SiteHeader active="home" />

      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="floating-game-elements" aria-hidden="true">
          <Image className="floating-piece floating-vs" src="/floating/ref-vs-badge.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="floating-piece floating-x10" src="/floating/ref-x10-star.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="floating-piece floating-cat" src="/floating/ref-cat-mascot.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="floating-piece floating-scatter" src="/floating/ref-scatter-machine.png" alt="" width={1254} height={1254} unoptimized />
        </div>

        <div className="home-hero-copy">
          <Image className="home-brand-art" src="/dirtygamblers-logo.jpeg" alt="" width={1254} height={1254} priority unoptimized />
          <h1 id="home-title">
            <span>DIRTY</span>
            <span className="word-yellow">GAMBLERS</span>
          </h1>
          <p>Your community. Your place on the board.<br />Monthly rewards with DirtyGamblers.</p>
          <div className="hero-cta-row">
            <Link className="slash-button slash-button-yellow" href="/leaderboard">
              View rankings <b aria-hidden="true">-&gt;</b>
            </Link>
          </div>
        </div>
      </section>

      <section className="home-reward-stage" aria-label="Current leaderboard reward">
        <div className="home-reward-inner">
          <div className="home-reward-platform">
            <span className="section-code">THIS MONTH</span>
            <PackDrawLogo className="home-reward-logo" />
          </div>
          <div className="home-reward-amount"><strong>$1,000</strong><h2>MONTHLY PRIZE POOL</h2></div>
          <Link className="reward-link" href="/leaderboard">Explore the leaderboard <b aria-hidden="true">-&gt;</b></Link>
        </div>
      </section>

      <section className="home-platforms" aria-label="Leaderboard platforms">
        <Link className="home-platform-card active" href="/leaderboard">
          <span>01</span>
          <PackDrawLogo className="home-platform-logo" />
          <b>LIVE</b>
        </Link>
        <a className="home-platform-card locked" href="https://shuffle.com/" target="_blank" rel="noreferrer">
          <span>02</span>
          <ShuffleLogo className="home-platform-shuffle" />
          <b>SOON</b>
        </a>
      </section>

      <section className="home-socials" aria-labelledby="social-title">
        <div className="social-heading">
          <div><span className="section-code">THE COMMUNITY</span><h2 id="social-title">JOIN THE <em>TABLE.</em></h2></div>
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
