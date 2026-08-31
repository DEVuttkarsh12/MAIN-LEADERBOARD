"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PackDrawLogo, ShuffleLogo, SiteFooter, SiteHeader } from "../site-shell";

type Player = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  points: number;
  winnings: string;
  movement: "up" | "down" | "same";
};

type SourceWindow = {
  from?: number;
  to?: number;
  updatedAt?: number;
};

type LeaderboardResponse = {
  players?: Player[];
  sourceWindow?: SourceWindow;
  prizePool?: number;
  prizes?: number[];
  error?: string;
};

const leaderboardRefreshMs = 5 * 60 * 1000;
const fallbackPrizePool = 1000;
const fallbackSourceWindow = {
  from: new Date("2026-08-31T00:00:00.000Z").getTime(),
  to: new Date("2026-10-01T00:00:00.000Z").getTime(),
};

function movementSymbol(value: Player["movement"]) {
  return value === "up" ? "^" : value === "down" ? "v" : "-";
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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

function validSourceWindow(sourceWindow?: SourceWindow): SourceWindow {
  if (
    sourceWindow &&
    Number.isFinite(sourceWindow.from) &&
    Number.isFinite(sourceWindow.to) &&
    Number(sourceWindow.to) > Number(sourceWindow.from)
  ) {
    return sourceWindow;
  }

  return fallbackSourceWindow;
}

function formatDateRange(sourceWindow: SourceWindow) {
  const validWindow = validSourceWindow(sourceWindow);
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

function periodCountdown(now: Date, sourceWindow: SourceWindow) {
  const validWindow = validSourceWindow(sourceWindow);
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

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "top6">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<SourceWindow>(fallbackSourceWindow);
  const [prizePool, setPrizePool] = useState(fallbackPrizePool);
  const [countdown, setCountdown] = useState("--D : --H");

  useEffect(() => {
    let isActive = true;
    let activeController: AbortController | null = null;

    async function loadLeaderboard(showLoading = true) {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await fetch("/api/leaderboard", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as LeaderboardResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Pack Draw leaderboard data is unavailable.");
        }

        if (isActive && !controller.signal.aborted) {
          setPlayers(Array.isArray(data.players) ? data.players : []);
          setSourceWindow(validSourceWindow(data.sourceWindow));
          setPrizePool(typeof data.prizePool === "number" ? data.prizePool : fallbackPrizePool);
        }
      } catch (loadError) {
        if (isActive && !controller.signal.aborted) {
          setPlayers([]);
          setError(loadError instanceof Error ? loadError.message : "Pack Draw leaderboard data is unavailable.");
        }
      } finally {
        if (activeController === controller) {
          activeController = null;
        }

        if (isActive && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();
    const timer = window.setInterval(() => {
      void loadLeaderboard(false);
    }, leaderboardRefreshMs);

    return () => {
      isActive = false;
      window.clearInterval(timer);
      activeController?.abort();
    };
  }, []);

  useEffect(() => {
    function refreshCountdown() {
      setCountdown(periodCountdown(new Date(), sourceWindow));
    }

    refreshCountdown();
    const timer = window.setInterval(refreshCountdown, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [sourceWindow]);

  const podiumOrder = useMemo(() => {
    const topThree = players.slice(0, 3);
    return [topThree[1], topThree[0], topThree[2]].filter((player): player is Player => Boolean(player));
  }, [players]);

  const totalWagered = useMemo(() => players.reduce((sum, player) => sum + player.points, 0), [players]);

  const filteredPlayers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch = !term || `${player.name} ${player.handle}`.toLowerCase().includes(term);
      const matchesView = view === "all" || (view === "top6" && player.rank <= 6);
      return matchesSearch && matchesView;
    });
  }, [players, query, view]);

  return (
    <main className="site-root leaderboard-page">
      <SiteHeader active="leaderboard" />

      <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
        <div className="leaderboard-floaters" aria-hidden="true">
          <Image className="leaderboard-floater leaderboard-floater-vs" src="/floating/ref-vs-badge.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="leaderboard-floater leaderboard-floater-scatter" src="/floating/ref-scatter-machine.png" alt="" width={1254} height={1254} unoptimized />
        </div>
        <div className="leaderboard-hero-copy">
          <h1 id="leaderboard-title"><span>PACK</span><strong>DRAW</strong><em>RANKS.</em></h1>
          <p>Live wager rankings for DirtyGamblers players on Pack Draw. Monthly run: {formatDateRange(sourceWindow)}.</p>
        </div>
        <div className="season-ticket" aria-label="Current leaderboard information">
          <span className="ticket-hole ticket-hole-one" /><span className="ticket-hole ticket-hole-two" />
          <PackDrawLogo className="packdraw-logo-ticket" />
          <div><span>MONTHLY RUN</span><span>ENDS {formatDate(Number(sourceWindow.to) - 1).toUpperCase()}</span></div>
          <b>{countdown}</b>
          <span className="ticket-updated">AS OF {formatUpdatedAt(sourceWindow.updatedAt).toUpperCase()}</span>
        </div>
      </section>

      <div className="leaderboard-stats" aria-label="Leaderboard statistics">
        <div><span>PLAYERS</span><strong>{formatCompactNumber(players.length)}</strong></div>
        <div><span>TOTAL WAGERED</span><strong>{formatCompactCurrency(totalWagered)}</strong></div>
        <div><span>PRIZE POOL</span><strong>{formatCurrency(prizePool)}</strong></div>
        <div className="stats-live"><i /> <span>{isLoading ? "UPDATING" : error ? "OFFLINE" : "LIVE"}</span></div>
      </div>

      <div className="platform-strip" aria-label="Leaderboard modes">
        <a className="platform-tile active" href="https://packdraw.com/" target="_blank" rel="noreferrer">
          <span>01</span>
          <div><PackDrawLogo className="mode-packdraw-logo" /></div>
          <b>LIVE</b>
        </a>
        <a className="platform-tile locked" href="https://shuffle.com/" target="_blank" rel="noreferrer">
          <span>02</span>
          <div><ShuffleLogo className="mode-shuffle-logo" /></div>
          <b>SOON</b>
        </a>
      </div>

      <section className="podium-section" aria-labelledby="podium-title">
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
      </section>

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

        <div className="rank-list-header" aria-hidden="true">
          <span>PLAYER</span><span>WAGERED</span><span>PRIZE</span>
        </div>
        <ol className="rank-list" aria-label="Pack Draw player rankings">
          {filteredPlayers.map((player) => (
            <li className={`rank-row ${player.rank <= 3 ? "rank-row-top" : ""}`} key={`${player.rank}-${player.handle}-${player.name}`}>
              <div className="rank-identity">
                <span className="rank-number">{String(player.rank).padStart(2, "0")}</span>
                <span className={`rank-move move-${player.movement}`}>{movementSymbol(player.movement)}</span>
                <span className="rank-avatar">{player.initials}</span>
                <span className="rank-name"><strong>{maskedPlayerName(player.name)}</strong></span>
              </div>
              <span className="rank-stat points-stat"><small>Wagered</small>{formatCurrency(player.points)}</span>
              <span className="rank-stat winning-stat"><small>Prize</small>{player.winnings}</span>
            </li>
          ))}
        </ol>
        {filteredPlayers.length === 0 && <div className="no-results">{isLoading ? "LOADING LIVE DATA..." : error ? error.toUpperCase() : "NO PLAYER FOUND."}</div>}
      </section>

      <SiteFooter />
    </main>
  );
}
