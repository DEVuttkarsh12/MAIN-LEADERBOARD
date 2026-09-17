import Link from "next/link";
import Image from "next/image";
import type { PlatformId } from "../lib/platforms";

type HeaderProps = {
  active: "home" | "leaderboard";
  platform?: PlatformId;
};

type PlatformLogoProps = {
  className?: string;
};

export function PackDrawLogo({ className = "" }: PlatformLogoProps) {
  return (
    <span className={`packdraw-logo ${className}`.trim()} role="img" aria-label="Pack Draw">
      <Image src="/brands/packdraw-logo.jpg" alt="" width={400} height={400} unoptimized />
      <span>Pack<b>Draw</b></span>
    </span>
  );
}

export function KingzLogo({ className = "" }: PlatformLogoProps) {
  return (
    <span className={`packdraw-logo kingz-logo ${className}`.trim()} role="img" aria-label="Kingz">
      <span className="kingz-logo-mark" aria-hidden="true">K</span>
      <span>King<b>z</b></span>
    </span>
  );
}

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="DirtyGamblers home">
      <span className="brand-mark" aria-hidden="true"><Image src="/dirtygamblers-logo.jpeg" alt="" width={1254} height={1254} priority unoptimized /></span>
      <span className="brand-name">Dirty<span>Gamblers</span></span>
    </Link>
  );
}

export function SiteHeader({ active, platform }: HeaderProps) {
  const activePlatform = active === "leaderboard" ? platform : undefined;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="primary-nav" aria-label="Primary navigation">
            <Link className={active === "home" ? "nav-item active" : "nav-item"} href="/">Home</Link>
            <Link className={activePlatform === "packdraw" ? "nav-item nav-platform active" : "nav-item nav-platform"} href="/leaderboard"><PackDrawLogo className="nav-platform-logo" /></Link>
            <Link className={activePlatform === "kingz" ? "nav-item nav-platform active" : "nav-item nav-platform"} href="/leaderboard?platform=kingz"><KingzLogo className="nav-platform-logo" /></Link>
          </nav>
          <Link className="header-action" href="/leaderboard" aria-label="Leaderboard"><span>Leaderboard</span><b aria-hidden="true">-&gt;</b></Link>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link className={active === "home" ? "mobile-nav-item active" : "mobile-nav-item"} href="/"><b>H</b><span>Home</span></Link>
        <Link className={activePlatform === "packdraw" ? "mobile-nav-item active" : "mobile-nav-item"} href="/leaderboard"><b className="mobile-platform-icon"><Image src="/brands/packdraw-logo.jpg" alt="" width={400} height={400} unoptimized /></b><span>Pack Draw</span></Link>
        <Link className={activePlatform === "kingz" ? "mobile-nav-item active" : "mobile-nav-item"} href="/leaderboard?platform=kingz"><b className="mobile-platform-icon mobile-kingz-icon">K</b><span>Kingz</span></Link>
      </nav>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand"><Brand /></div>
        <div className="footer-nav">
          <span>Pages</span>
          <Link href="/">Home</Link>
          <Link href="/leaderboard">Pack Draw</Link>
          <Link href="/leaderboard?platform=kingz">Kingz</Link>
        </div>
        <div className="footer-socials">
          <span>Socials</span>
          <a href="https://discord.gg/2cZ4HqfZdH" target="_blank" rel="noreferrer">Discord -&gt;</a>
          <a href="https://kick.com/dirtygamblerslive" target="_blank" rel="noreferrer">Kick -&gt;</a>
          <a href="https://x.com/Dirtygamblers" target="_blank" rel="noreferrer">X / Twitter -&gt;</a>
          <a href="https://www.instagram.com/dirtygamblers" target="_blank" rel="noreferrer">Instagram -&gt;</a>
        </div>
      </div>
      <div className="footer-bottom"><span>(c) 2026 DIRTYGAMBLERS</span></div>
    </footer>
  );
}