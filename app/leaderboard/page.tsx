"use client";

import { useEffect, useMemo, useState } from "react";
import { CaseBattleLogo, ShuffleLogo, SiteFooter, SiteHeader } from "../site-shell";

type Player = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  points: number;
  winnings: string;
  movement: "up" | "down" | "same";
};

type LeaderboardResponse = {
  players?: Player[];
  error?: string;
};

function movementSymbol(value: Player["movement"]) {
  return value === "up" ? "↑" : value === "down" ? "↓" : "—";
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function currencyValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "rising" | "top5">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLeaderboard() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/leaderboard", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as LeaderboardResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Leaderboard data is unavailable.");
        }

        setPlayers(Array.isArray(data.players) ? data.players : []);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPlayers([]);
          setError(loadError instanceof Error ? loadError.message : "Leaderboard data is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => controller.abort();
  }, []);

  const podiumOrder = useMemo(() => {
    const topThree = players.slice(0, 3);
    return [topThree[1], topThree[0], topThree[2]].filter((player): player is Player => Boolean(player));
  }, [players]);

  const risingCount = useMemo(() => players.filter((player) => player.movement === "up").length, [players]);
  const prizePool = useMemo(() => players.reduce((total, player) => total + currencyValue(player.winnings), 0), [players]);
  const topScore = players[0]?.points ?? 0;

  const filteredPlayers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch = !term || `${player.name} ${player.handle}`.toLowerCase().includes(term);
      const matchesView = view === "all" || (view === "rising" && player.movement === "up") || (view === "top5" && player.rank <= 5);
      return matchesSearch && matchesView;
    });
  }, [players, query, view]);

  return (
    <main className="site-root leaderboard-page">
      <SiteHeader active="leaderboard" />

      <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
        <div className="leaderboard-floaters" aria-hidden="true">
          <img className="leaderboard-floater leaderboard-floater-vs" src="/floating/ref-vs-badge.png" alt="" />
          <img className="leaderboard-floater leaderboard-floater-scatter" src="/floating/ref-scatter-machine.png" alt="" />
        </div>
        <div className="leaderboard-hero-copy">
          <h1 id="leaderboard-title"><span>THE</span><strong>RANK</strong><em>INGS.</em></h1>
        </div>
        <div className="season-ticket" aria-label="Current season information">
          <span className="ticket-hole ticket-hole-one" /><span className="ticket-hole ticket-hole-two" />
          <CaseBattleLogo className="casebattle-logo-ticket" />
          <div><span>SEASON 01</span><span>LIVE NOW</span></div>
          <b>04D : 18H</b>
        </div>
      </section>

      <div className="leaderboard-stats" aria-label="Leaderboard statistics">
        <div><span>PLAYERS</span><strong>{formatCompactNumber(players.length)}</strong></div>
        <div><span>TOP SCORE</span><strong>{formatCompactNumber(topScore)}</strong></div>
        <div><span>PRIZE POOL</span><strong>{formatCurrency(prizePool)}</strong></div>
        <div className="stats-live"><i /> <span>{isLoading ? "UPDATING" : error ? "OFFLINE" : "LIVE"}</span></div>
      </div>

      <div className="battle-mode-strip" aria-label="Leaderboard modes">
        <a className="battle-mode active" href="https://casebattle.com/" target="_blank" rel="noreferrer"><span>01</span><div><CaseBattleLogo className="mode-casebattle-logo" /></div><b>LIVE ↗</b></a>
        <a className="battle-mode locked" href="https://shuffle.com/" target="_blank" rel="noreferrer"><span>02</span><div><ShuffleLogo className="mode-shuffle-logo" /></div><b>SOON</b></a>
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
              <div className="podium-player"><strong>{player.name}</strong></div>
              <div className="podium-score"><span>POINTS</span><strong>{player.points.toLocaleString()}</strong></div>
            </article>
          )) : <div className="no-results">{isLoading ? "LOADING LIVE DATA..." : error ? error.toUpperCase() : "NO LIVE PLAYERS YET."}</div>}
        </div>
      </section>

      <section className="rankings-section" aria-labelledby="rankings-title">
        <div className="rankings-topbar">
          <div><h2 id="rankings-title">ALL <em>PLAYERS.</em></h2></div>
          <label className="funky-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" aria-label="Find a player" placeholder="FIND PLAYER..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="ranking-filters" aria-label="Filter rankings">
          <button type="button" className={view === "all" ? "active" : ""} onClick={() => setView("all")} aria-pressed={view === "all"}>All <span>{players.length}</span></button>
          <button type="button" className={view === "rising" ? "active" : ""} onClick={() => setView("rising")} aria-pressed={view === "rising"}>Rising <span>{risingCount}</span></button>
          <button type="button" className={view === "top5" ? "active" : ""} onClick={() => setView("top5")} aria-pressed={view === "top5"}>Top 5 <span>{Math.min(players.length, 5)}</span></button>
        </div>

        <div className="rank-list-header" aria-hidden="true">
          <span>PLAYER</span><span>POINTS</span><span>PRIZE</span>
        </div>
        <ol className="rank-list" aria-label="Case Battles player rankings">
          {filteredPlayers.map((player) => (
            <li className={`rank-row ${player.rank <= 3 ? "rank-row-top" : ""}`} key={`${player.rank}-${player.handle}-${player.name}`}>
              <div className="rank-identity">
                <span className="rank-number">{String(player.rank).padStart(2, "0")}</span>
                <span className={`rank-move move-${player.movement}`}>{movementSymbol(player.movement)}</span>
                <span className="rank-avatar">{player.initials}</span>
                <span className="rank-name"><strong>{player.name}</strong></span>
              </div>
              <span className="rank-stat points-stat"><small>Points</small>{player.points.toLocaleString()}</span>
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
