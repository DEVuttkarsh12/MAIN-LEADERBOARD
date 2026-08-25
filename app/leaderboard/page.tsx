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
  season?: SeasonWindow;
  error?: string;
};

type SeasonWindow = {
  from: number;
  to: number;
};

const fallbackSeasonWindow = {
  from: new Date("2026-08-25T00:00:00.000Z").getTime(),
  to: new Date("2026-09-07T23:59:59.999Z").getTime(),
};
const leaderboardRefreshMs = 5 * 60 * 1000;
const fixedPrizePool = 750;

function movementSymbol(value: Player["movement"]) {
  return value === "up" ? "↑" : value === "down" ? "↓" : "—";
}

function formatDateRange(season: SeasonWindow) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(season.from))} - ${formatter.format(new Date(season.to - 1))}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function validSeasonWindow(season?: SeasonWindow): SeasonWindow {
  if (
    season &&
    Number.isFinite(season.from) &&
    Number.isFinite(season.to) &&
    season.to > season.from
  ) {
    return season;
  }

  return fallbackSeasonWindow;
}

function seasonCountdown(now: Date, season: SeasonWindow) {
  const nowTime = now.getTime();
  const countdownTarget = nowTime < season.from ? season.from : season.to;
  const remainingMs = Math.max(0, countdownTarget - nowTime);
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
  const [view, setView] = useState<"all" | "top5">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("--D : --H");
  const [season, setSeason] = useState<SeasonWindow>(fallbackSeasonWindow);
  const [isPreviousOpen, setIsPreviousOpen] = useState(false);
  const [previousPlayers, setPreviousPlayers] = useState<Player[]>([]);
  const [previousSeason, setPreviousSeason] = useState<SeasonWindow>({
    from: fallbackSeasonWindow.from - 14 * 24 * 60 * 60 * 1000,
    to: fallbackSeasonWindow.from,
  });
  const [isPreviousLoading, setIsPreviousLoading] = useState(false);
  const [previousError, setPreviousError] = useState<string | null>(null);

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
          throw new Error(data.error ?? "Leaderboard data is unavailable.");
        }

        if (isActive && !controller.signal.aborted) {
          setPlayers(Array.isArray(data.players) ? data.players : []);
          setSeason(validSeasonWindow(data.season));
        }
      } catch (loadError) {
        if (isActive && !controller.signal.aborted) {
          setPlayers([]);
          setError(loadError instanceof Error ? loadError.message : "Leaderboard data is unavailable.");
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
      setCountdown(seasonCountdown(new Date(), season));
    }

    refreshCountdown();
    const timer = window.setInterval(refreshCountdown, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [season]);

  useEffect(() => {
    if (!isPreviousOpen || previousPlayers.length > 0 || previousError) {
      return;
    }

    const controller = new AbortController();

    async function loadPreviousLeaderboard() {
      setIsPreviousLoading(true);
      setPreviousError(null);

      try {
        const response = await fetch("/api/leaderboard?period=previous", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as LeaderboardResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Previous leaderboard data is unavailable.");
        }

        if (!controller.signal.aborted) {
          setPreviousPlayers(Array.isArray(data.players) ? data.players : []);
          setPreviousSeason(validSeasonWindow(data.season));
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPreviousPlayers([]);
          setPreviousError(loadError instanceof Error ? loadError.message : "Previous leaderboard data is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviousLoading(false);
        }
      }
    }

    void loadPreviousLeaderboard();

    return () => controller.abort();
  }, [isPreviousOpen, previousError, previousPlayers.length]);

  useEffect(() => {
    if (!isPreviousOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPreviousOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPreviousOpen]);

  const podiumOrder = useMemo(() => {
    const topThree = players.slice(0, 3);
    return [topThree[1], topThree[0], topThree[2]].filter((player): player is Player => Boolean(player));
  }, [players]);

  const totalWagered = useMemo(() => players.reduce((sum, player) => sum + player.points, 0), [players]);

  const filteredPlayers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch = !term || `${player.name} ${player.handle}`.toLowerCase().includes(term);
      const matchesView = view === "all" || (view === "top5" && player.rank <= 5);
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
          <b>{countdown}</b>
        </div>
      </section>

      <div className="leaderboard-stats" aria-label="Leaderboard statistics">
        <div><span>PLAYERS</span><strong>{formatCompactNumber(players.length)}</strong></div>
        <div><span>TOTAL WAGERED</span><strong>{formatCompactCurrency(totalWagered)}</strong></div>
        <div><span>PRIZE POOL</span><strong>{formatCurrency(fixedPrizePool)}</strong></div>
        <div className="stats-live"><i /> <span>{isLoading ? "UPDATING" : error ? "OFFLINE" : "LIVE"}</span></div>
      </div>

      <div className="battle-mode-strip" aria-label="Leaderboard modes">
        <a className="battle-mode active" href="https://casebattle.a" target="_blank" rel="noreferrer"><span>01</span><div><CaseBattleLogo className="mode-casebattle-logo" /></div><b>LIVE ↗</b></a>
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
              <div className="podium-player"><strong>{maskedPlayerName(player.name)}</strong></div>
              <div className="podium-score"><span>DOLLARS</span><strong>{formatCurrency(player.points)}</strong></div>
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
          <button type="button" className={view === "top5" ? "active" : ""} onClick={() => setView("top5")} aria-pressed={view === "top5"}>Top 5 <span>{Math.min(players.length, 5)}</span></button>
          <button
            type="button"
            className="previous-leaderboard-trigger"
            onClick={() => {
              setPreviousError(null);
              setIsPreviousOpen(true);
            }}
          >
            Last Season <span>↗</span>
          </button>
        </div>

        <div className="rank-list-header" aria-hidden="true">
          <span>PLAYER</span><span>DOLLARS</span><span>PRIZE</span>
        </div>
        <ol className="rank-list" aria-label="Case Battles player rankings">
          {filteredPlayers.map((player) => (
            <li className={`rank-row ${player.rank <= 3 ? "rank-row-top" : ""}`} key={`${player.rank}-${player.handle}-${player.name}`}>
              <div className="rank-identity">
                <span className="rank-number">{String(player.rank).padStart(2, "0")}</span>
                <span className={`rank-move move-${player.movement}`}>{movementSymbol(player.movement)}</span>
                <span className="rank-avatar">{player.initials}</span>
                <span className="rank-name"><strong>{maskedPlayerName(player.name)}</strong></span>
              </div>
              <span className="rank-stat points-stat"><small>Dollars</small>{formatCurrency(player.points)}</span>
              <span className="rank-stat winning-stat"><small>Prize</small>{player.winnings}</span>
            </li>
          ))}
        </ol>
        {filteredPlayers.length === 0 && <div className="no-results">{isLoading ? "LOADING LIVE DATA..." : error ? error.toUpperCase() : "NO PLAYER FOUND."}</div>}
      </section>

      {isPreviousOpen && (
        <div className="previous-leaderboard-backdrop" role="presentation" onMouseDown={() => setIsPreviousOpen(false)}>
          <section className="previous-leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="previous-leaderboard-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="previous-modal-close" aria-label="Close previous leaderboard" onClick={() => setIsPreviousOpen(false)}>X</button>
            <div className="previous-modal-header">
              <div>
                <span className="previous-kicker">ARCHIVED 14 DAY RUN</span>
                <h2 id="previous-leaderboard-title">LAST <em>SEASON.</em></h2>
              </div>
              <strong>{formatDateRange(previousSeason)}</strong>
            </div>

            <div className="previous-rank-list-header" aria-hidden="true">
              <span>PLAYER</span><span>DOLLARS</span><span>PRIZE</span>
            </div>
            <ol className="rank-list previous-rank-list" aria-label="Previous 14 day leaderboard rankings">
              {previousPlayers.map((player) => (
                <li className={`rank-row ${player.rank <= 3 ? "rank-row-top" : ""}`} key={`previous-${player.rank}-${player.handle}-${player.name}`}>
                  <div className="rank-identity">
                    <span className="rank-number">{String(player.rank).padStart(2, "0")}</span>
                    <span className={`rank-move move-${player.movement}`}>{movementSymbol(player.movement)}</span>
                    <span className="rank-avatar">{player.initials}</span>
                    <span className="rank-name"><strong>{maskedPlayerName(player.name)}</strong></span>
                  </div>
                  <span className="rank-stat points-stat"><small>Dollars</small>{formatCurrency(player.points)}</span>
                  <span className="rank-stat winning-stat"><small>Prize</small>{player.winnings}</span>
                </li>
              ))}
            </ol>
            {previousPlayers.length === 0 && <div className="no-results previous-no-results">{isPreviousLoading ? "LOADING LAST SEASON..." : previousError ? previousError.toUpperCase() : "NO ARCHIVED PLAYERS YET."}</div>}
          </section>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
