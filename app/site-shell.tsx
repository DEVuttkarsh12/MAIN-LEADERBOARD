import Link from "next/link";

type HeaderProps = {
  active: "home" | "leaderboard";
};

type PlatformLogoProps = {
  className?: string;
};

export function CaseBattleLogo({ className = "" }: PlatformLogoProps) {
  return (
    <span className={`casebattle-logo ${className}`.trim()} role="img" aria-label="CaseBattle">
      <img src="/brands/casebattle-icon.svg" alt="" />
      <span>Case<b>Battle</b></span>
    </span>
  );
}

export function ShuffleLogo({ className = "" }: PlatformLogoProps) {
  return <img className={`shuffle-logo ${className}`.trim()} src="/brands/shuffle-logo.svg" alt="Shuffle" />;
}

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="DirtyGamblers home">
      <span className="brand-mark" aria-hidden="true"><img src="/dirtygamblers-logo.jpeg" alt="" /></span>
      <span className="brand-name">Dirty<span>Gamblers</span></span>
    </Link>
  );
}

export function SiteHeader({ active }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className={active === "home" ? "nav-item active" : "nav-item"} href="/">Home</Link>
          <Link className={active === "leaderboard" ? "nav-item nav-platform active" : "nav-item nav-platform"} href="/leaderboard"><CaseBattleLogo className="nav-platform-logo" /></Link>
          <span className="nav-item nav-platform nav-locked"><ShuffleLogo className="nav-shuffle-logo" /><b>Soon</b></span>
        </nav>
        <Link className="header-action" href="/leaderboard"><span>Leaderboard</span><b aria-hidden="true">↗</b></Link>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link className={active === "home" ? "mobile-nav-item active" : "mobile-nav-item"} href="/"><b>⌂</b><span>Home</span></Link>
        <Link className={active === "leaderboard" ? "mobile-nav-item active" : "mobile-nav-item"} href="/leaderboard"><b className="mobile-platform-icon"><img src="/brands/casebattle-icon.svg" alt="" /></b><span>Case Battles</span></Link>
        <span className="mobile-nav-item mobile-nav-locked"><b className="mobile-platform-icon shuffle-mobile-icon"><img src="/brands/shuffle-logo.svg" alt="" /></b><span>Shuffle · Soon</span></span>
      </nav>
    </header>
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
          <Link href="/leaderboard">Case Battles</Link>
          <span className="disabled-link">Shuffle — Soon</span>
        </div>
        <div className="footer-socials">
          <span>Socials</span>
          <a href="https://discord.gg/2cZ4HqfZdH" target="_blank" rel="noreferrer">Discord ↗</a>
          <a href="https://kick.com/dirtygamblerslive" target="_blank" rel="noreferrer">Kick ↗</a>
          <a href="https://x.com/Dirtygamblers" target="_blank" rel="noreferrer">X / Twitter ↗</a>
          <a href="https://www.instagram.com/dirtygamblers" target="_blank" rel="noreferrer">Instagram ↗</a>
        </div>
      </div>
      <div className="footer-bottom"><span>© 2026 DIRTYGAMBLERS</span></div>
    </footer>
  );
}
