import Link from "next/link";
import Image from "next/image";

type HeaderProps = {
  active: "home" | "leaderboard";
};

type PlatformLogoProps = {
  className?: string;
};

export function ShuffleLogo({ className = "" }: PlatformLogoProps) {
  return <Image className={`shuffle-logo ${className}`.trim()} src="/brands/shuffle-logo.svg" alt="Shuffle" width={147} height={24} unoptimized />;
}

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
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className={active === "home" ? "nav-item active" : "nav-item"} href="/">Home</Link>
          <Link className={active === "leaderboard" ? "nav-item nav-platform active" : "nav-item nav-platform"} href="/leaderboard"><PackDrawLogo className="nav-platform-logo" /></Link>
          <span className="nav-item nav-platform nav-locked"><ShuffleLogo className="nav-shuffle-logo" /><b>Soon</b></span>
        </nav>
        <Link className="header-action" href="/leaderboard"><span>Leaderboard</span><b aria-hidden="true">-&gt;</b></Link>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link className={active === "home" ? "mobile-nav-item active" : "mobile-nav-item"} href="/"><b>H</b><span>Home</span></Link>
        <Link className={active === "leaderboard" ? "mobile-nav-item active" : "mobile-nav-item"} href="/leaderboard"><b className="mobile-platform-icon"><Image src="/brands/packdraw-logo.jpg" alt="" width={400} height={400} unoptimized /></b><span>Pack Draw</span></Link>
        <span className="mobile-nav-item mobile-nav-locked"><b className="mobile-platform-icon shuffle-mobile-icon"><Image src="/brands/shuffle-logo.svg" alt="" width={147} height={24} unoptimized /></b><span>Shuffle - Soon</span></span>
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
          <Link href="/leaderboard">Pack Draw</Link>
          <span className="disabled-link">Shuffle - Soon</span>
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
