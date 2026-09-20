"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { monthlyPeriods, type LeaderboardPeriod } from "../lib/leaderboard-periods";
import { PLATFORMS, PLATFORM_BY_ID, isPlatformId, prizePoolFor, type LeaderboardPlatform, type PlatformId } from "../lib/platforms";
import { fetchLeaderboard, leaderboardRefreshMs, type Player, type SourceWindow, type LeaderboardResponse } from "./leaderboard-request";
import { useEffect, useMemo, useState } from "react";
import { KingzLogo, PackDrawLogo } from "./site-shell";

function configuredSourceWindow(platform: LeaderboardPlatform): SourceWindow {
  const current = monthlyPeriods(platform.defaultPeriodStart).current;
  return { from: current.from, to: current.to };
}

function movementSymbol(value: Player["movement"]) {
  return value === "up" ? "^" : value === "down" ? "v" : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatDate(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return "Live";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function validSourceWindow(sourceWindow: SourceWindow | undefined, platform: LeaderboardPlatform): SourceWindow {
  if (
    sourceWindow &&
    Number.isFinite(sourceWindow.from) &&
    Number.isFinite(sourceWindow.to) &&
    Number(sourceWindow.to) > Number(sourceWindow.from)
  ) {
    return sourceWindow;
  }

  return configuredSourceWindow(platform);
}

function formatDateRange(sourceWindow: SourceWindow, platform: LeaderboardPlatform) {
  const validWindow = validSourceWindow(sourceWindow, platform);
  return `${formatDate(validWindow.from)} - ${formatDate(Number(validWindow.to) - 1)}`;
}

function formatUpdatedAt(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return "Checking";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function periodCountdown(now: Date, sourceWindow: SourceWindow, platform: LeaderboardPlatform) {
  const validWindow = validSourceWindow(sourceWindow, platform);
  const remainingMs = Math.max(0, Number(validWindow.to) - now.getTime());
  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  return `${String(days).padStart(2, "0")}D : ${String(hours).padStart(2, "0")}H`;
}

function maskedPlayerName(name: string) {
  const characters = Array.from(name.trim());
  const visibleCharacters = characters.filter((character) => /[a-z0-9]/i.test(character)).length;

  if (visibleCharacters <= 1) {
    return name.trim();
  }

  const visibleLimit = Math.min(3, visibleCharacters - 1);
  let revealed = 0;

  return characters
    .map((character) => {
      if (!/[a-z0-9]/i.test(character)) {
        return character;
      }

      revealed += 1;
      return revealed <= visibleLimit ? character : "*";
    })
    .join("");
}

function PlatformLogo({ platform, className = "" }: { platform: LeaderboardPlatform; className?: string }) {
  return platform.id === "packdraw"
    ? <PackDrawLogo className={className} />
    : <KingzLogo className={className} />;
}

export default function LeaderboardBoard({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const urlPlatform = isPlatformId(searchParams.get("platform")) ? searchParams.get("platform") : "packdraw";

  return <LeaderboardBoardContent key={urlPlatform} embedded={embedded} initialPlatform={urlPlatform as PlatformId} />;
}

function LeaderboardBoardContent({ embedded = false, initialPlatform }: { embedded?: boolean; initialPlatform: PlatformId }) {
  const Title = embedded ? "h2" : "h1";
  const router = useRouter();
  const platformId: PlatformId = initialPlatform;
  const platform = PLATFORM_BY_ID[platformId];
  const [completedPeriods, setCompletedPeriods] = useState<LeaderboardPeriod[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "top6">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<SourceWindow>(() => configuredSourceWindow(platform));
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined);
  const [prizePool, setPrizePool] = useState(() => prizePoolFor(platform));
  const [totalWagered, setTotalWagered] = useState(0);
  const [countdown, setCountdown] = useState("--D : --H");

  useEffect(() => {
    let isActive = true;


    async function loadLeaderboard(showLoading = true) {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchLeaderboard(platformId);

        if (isActive) {
          const loadedPlayers = Array.isArray(data.players) ? data.players : [];
          setPlayers(loadedPlayers);
          setTotalWagered(typeof data.totalWagered === "number"
            ? data.totalWagered
            : loadedPlayers.reduce((total, player) => total + player.points, 0));
          setSourceWindow(configuredSourceWindow(platform));
          setUpdatedAt(data.sourceWindow?.updatedAt);
          setCompletedPeriods(data.completedPeriods ?? []);
          setPrizePool(typeof data.prizePool === "number" ? data.prizePool : prizePoolFor(platform));
        }
      } catch (loadError) {
        if (isActive) {
          setPlayers([]);
          setTotalWagered(0);
          setError(loadError instanceof Error ? loadError.message : `${platform.label} leaderboard data is unavailable.`);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadLeaderboard(false);
      }
    }, leaderboardRefreshMs);

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadLeaderboard(false);
      }
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      isActive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [platformId, platform]);

  useEffect(() => {
    function refreshCountdown() {
      setCountdown(periodCountdown(new Date(), sourceWindow, platform));
    }

    refreshCountdown();
    const timer = window.setInterval(refreshCountdown, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [sourceWindow, platform]);

  function selectPlatform(nextPlatform: PlatformId) {
    if (nextPlatform === platformId) {
      return;
    }

    const url = new URL(window.location.href);
    if (nextPlatform === "packdraw") {
      url.searchParams.delete("platform");
    } else {
      url.searchParams.set("platform", nextPlatform);
    }
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }

  const podiumOrder = useMemo(() => {
    const topThree = players.slice(0, 3);
    return [topThree[1], topThree[0], topThree[2]].filter((player): player is Player => Boolean(player));
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch = !term || `${player.name} ${player.handle}`.toLowerCase().includes(term);
      const matchesView = view === "all" || (view === "top6" && player.rank <= 6);
      return matchesSearch && matchesView;
    });
  }, [players, query, view]);

  return (
    <div id="live-leaderboard" className={embedded ? "leaderboard-content leaderboard-embedded" : "leaderboard-content"}>

      <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
        {!embedded && <div className="leaderboard-floaters" aria-hidden="true">
          <Image className="leaderboard-floater leaderboard-floater-car" src="/floating/leaderboard-sports-car.png" alt="" width={1885} height={628} unoptimized />
          <Image className="leaderboard-floater leaderboard-floater-watch" src="/floating/leaderboard-watch.png" alt="" width={749} height={1000} unoptimized />
          <Image className="leaderboard-floater leaderboard-floater-diamond" src="/floating/leaderboard-diamond.png" alt="" width={1233} height={1233} unoptimized />
          <Image className="leaderboard-floater leaderboard-floater-gold" src="/floating/leaderboard-gold-bars.png" alt="" width={512} height={326} unoptimized />
        </div>}
        <div className="leaderboard-hero-copy">
          <PlatformLogo platform={platform} className="packdraw-logo-hero" />
          <Title id="leaderboard-title" className="leaderboard-title">LEADERBOARD</Title>
          <p className="leaderboard-period">{formatDateRange(sourceWindow, platform)}</p>
          <div className="leaderboard-summary">
            <div className="leaderboard-prize"><span>MONTHLY PRIZE POOL</span><strong>{formatCurrency(prizePool)}</strong></div>
            <div className="leaderboard-countdown"><span>TIME REMAINING</span><strong>{countdown}</strong></div>
          </div>
          <p className="leaderboard-updated">{isLoading ? "Updating rankings..." : error ? "Rankings unavailable" : `Updated ${formatUpdatedAt(updatedAt)} UTC`}</p>
          {embedded && <Link className="leaderboard-full-link" href="/leaderboard">Full leaderboard <b aria-hidden="true">-&gt;</b></Link>}
        </div>
      </section>

      <div className="platform-strip" aria-label="Leaderboard platform">
        {PLATFORMS.map((entry) => {
          const active = entry.id === platformId;
          return (
            <button key={entry.id} type="button" className={`platform-tile ${active ? "active" : ""}`} onClick={() => selectPlatform(entry.id)} aria-pressed={active}>
              <div>
                <PlatformLogo platform={entry} className="mode-platform-logo" />
                <strong>{entry.label}</strong>
              </div>
              <b>{active ? "LIVE" : "VIEW"}</b>
            </button>
          );
        })}
      </div>

      <div className="leaderboard-stats" aria-label="Leaderboard statistics">
        <div><span>TOP</span><strong>{platform.maxPlayers}</strong></div>
        <div><span>TOTAL WAGERED</span><strong>{formatCompactCurrency(totalWagered)}</strong></div>
        <div><span>PRIZE POOL</span><strong>{formatCurrency(prizePool)}</strong></div>
        <div className="stats-live"><i /> <span>{isLoading ? "UPDATING" : error ? "OFFLINE" : "LIVE"}</span></div>
      </div>

      {podiumOrder.length > 0 && <section className="podium-section" aria-labelledby="podium-title">
        <div className="podium-heading">
          <div><h2 id="podium-title">TOP <em>THREE.</em></h2></div>
        </div>
        <div className="podium-grid">
          {podiumOrder.length > 0 ? podiumOrder.map((player) => (
            <article className={`podium-card podium-rank-${player.rank}`} key={player.rank}>
              <span className="podium-number">#{player.rank}</span>
              <span className="podium-avatar">{player.initials}</span>
              <div className="podium-player"><strong>{maskedPlayerName(player.name)}</strong></div>
              <div className="podium-score"><span>WAGERED</span><strong>{formatCurrency(player.points)}</strong></div>
            </article>
          )) : <div className="no-results">{isLoading ? "LOADING LIVE DATA..." : error ? error.toUpperCase() : "NO LIVE PLAYERS YET."}</div>}
        </div>
      </section>}

      <section className="rankings-section" aria-labelledby="rankings-title">
        <div className="rankings-topbar">
          <div><h2 id="rankings-title">ALL <em>PLAYERS.</em></h2></div>
          <label className="funky-search">
            <span aria-hidden="true">?</span>
            <input type="search" aria-label="Find a player" placeholder="FIND PLAYER..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="ranking-filters" aria-label="Filter rankings">
          <button type="button" className={view === "all" ? "active" : ""} onClick={() => setView("all")} aria-pressed={view === "all"}>All <span>{players.length}</span></button>
          <button type="button" className={view === "top6" ? "active" : ""} onClick={() => setView("top6")} aria-pressed={view === "top6"}>Top 6 <span>{Math.min(players.length, 6)}</span></button>
        </div>

        <PlayerRows players={filteredPlayers} label="player rankings" emptyMessage={isLoading ? "LOADING LIVE DATA..." : error ? error : query ? "NO MATCHING PLAYERS." : "NO PLAYERS THIS PERIOD YET."} />
      </section>

      <PreviousLeaderboards periods={completedPeriods} platform={platform} loading={isLoading} error={error} />
    </div>
  );
}

function PlayerRows({ players, label, emptyMessage }: { players: Player[]; label: string; emptyMessage: string }) {
  return (
    <>
        <div className="rank-list-header" aria-hidden="true">
          <span>RANKS</span><span>USER</span><span>AMOUNT</span><span>PRIZE</span>
        </div>
        <ol className="rank-list" aria-label={label}>
          {players.map((player) => (
            <li className={`rank-row ${player.rank <= 3 ? "rank-row-top" : ""}`} key={`${player.rank}-${player.handle}-${player.name}`}>
              <span className="rank-number">{player.rank === 1 ? "1st" : player.rank === 2 ? "2nd" : player.rank === 3 ? "3rd" : `${player.rank}th`}</span>
              <div className="rank-identity">
                <span className={`rank-move move-${player.movement}`}>{movementSymbol(player.movement)}</span>
                <span className="rank-avatar">{player.initials}</span>
                <span className="rank-name"><strong>{maskedPlayerName(player.name)}</strong></span>
              </div>
              <span className="rank-stat points-stat"><small>Wagered</small>{formatCurrency(player.points)}</span>
              <span className="rank-stat winning-stat"><small>Prize</small>{player.winnings}</span>
            </li>
          ))}
        </ol>
        {players.length === 0 && <div className="no-results">{emptyMessage}</div>}
    </>
  );
}

function PreviousLeaderboards({ periods, platform, loading, error }: { periods: LeaderboardPeriod[]; platform: LeaderboardPlatform; loading: boolean; error: string | null }) {
  const [selected, setSelected] = useState("");
  const period = periods.find((entry) => entry.id === selected) ?? periods[0];

  return (
    <section className="leaderboard-history" aria-labelledby="history-title">
      <div className="history-inner">
        <div className="history-heading">
          <span className="section-code">PAST MONTHS</span>
          <h2 id="history-title">PREVIOUS <em>LEADERBOARDS.</em></h2>
        </div>
        {period ? (
          <>
            <label className="history-picker">Completed period
              <select value={period.id} onChange={(event) => setSelected(event.target.value)}>
                {periods.map((entry) => <option key={entry.id} value={entry.id}>{formatDateRange(entry, platform)}</option>)}
              </select>
            </label>
            <HistoricalResults key={`${platform.id}-${period.id}`} period={period} platformId={platform.id} label={platform.label} />
          </>
        ) : (
          <div className="history-empty" role="status">
            <strong>{loading ? "Checking previous leaderboards..." : error ? "Previous leaderboards are unavailable." : "No completed leaderboards yet."}</strong>
            {!loading && !error && <p>The first results will appear here when the current monthly run ends.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function HistoricalResults({ period, platformId, label }: { period: LeaderboardPeriod; platformId: PlatformId; label: string }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLeaderboard(platformId, period.id).then((result) => {
      if (active) setData(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Previous leaderboard is unavailable.");
    });
    return () => { active = false; };
  }, [platformId, period.id]);

  return (
    <div className="history-results" aria-busy={!data && !error}>
      <p className="history-period">{label} &middot; {formatDateRange(period, PLATFORM_BY_ID[platformId])} &middot; Completed</p>
      <PlayerRows players={data?.players ?? []} label="Previous player rankings" emptyMessage={error ?? (data ? "NO PLAYERS IN THIS PERIOD." : "LOADING PREVIOUS RESULTS...")} />
    </div>
  );
}
