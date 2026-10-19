import Link from "next/link";
import Image from "next/image";
import { GAMBA_LEADERBOARD_URL } from "../lib/gamba";

type HeaderProps = {
  active: "home" | "leaderboard" | "gamba";
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

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="DirtyGamblers home">
      <span className="brand-mark" aria-hidden="true"><Image src="/dirtygamblers-logo.jpeg" alt="" width={1254} height={1254} priority unoptimized /></span>
      <span className="brand-name">Dirty<span>Gamblers</span></span>
    </Link>
  );
}

export function SiteHeader({ active }: HeaderProps) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="primary-nav" aria-label="Primary navigation">
            <Link className={active === "home" ? "nav-item active" : "nav-item"} href="/" aria-current={active === "home" ? "page" : undefined}>Home</Link>
            <Link className={active === "leaderboard" ? "nav-item nav-platform active" : "nav-item nav-platform"} href="/leaderboard" aria-current={active === "leaderboard" ? "page" : undefined}><PackDrawLogo className="nav-platform-logo" /></Link>
            <Link className={active === "gamba" ? "nav-item active" : "nav-item"} href="/gamba" aria-current={active === "gamba" ? "page" : undefined}>Gamba</Link>
          </nav>
          {active === "gamba" ? (
            <a className="header-action" href={GAMBA_LEADERBOARD_URL} target="_blank" rel="noopener noreferrer" aria-label="View Gamba leaderboard"><span>Leaderboard</span><b aria-hidden="true">↗</b></a>
          ) : (
            <Link className="header-action" href="/leaderboard" aria-label="Leaderboard"><span>Leaderboard</span><b aria-hidden="true">-&gt;</b></Link>
          )}
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link className={active === "home" ? "mobile-nav-item active" : "mobile-nav-item"} href="/" aria-current={active === "home" ? "page" : undefined}><b aria-hidden="true">H</b><span>Home</span></Link>
        <Link className={active === "leaderboard" ? "mobile-nav-item active" : "mobile-nav-item"} href="/leaderboard" aria-current={active === "leaderboard" ? "page" : undefined}><b className="mobile-platform-icon"><Image src="/brands/packdraw-logo.jpg" alt="" width={400} height={400} unoptimized /></b><span>Pack Draw</span></Link>
        <Link className={active === "gamba" ? "mobile-nav-item active" : "mobile-nav-item"} href="/gamba" aria-current={active === "gamba" ? "page" : undefined}><b aria-hidden="true">G</b><span>Gamba</span></Link>
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
          <Link href="/gamba">Gamba</Link>
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
