"use client";

import Image from "next/image";
import Link from "next/link";
import type { LeaderboardPeriod } from "../lib/leaderboard-periods";
import { fetchLeaderboard, leaderboardRefreshMs, type Player, type SourceWindow, type LeaderboardResponse } from "./leaderboard-request";
import { useEffect, useMemo, useState } from "react";
import { PackDrawLogo } from "./site-shell";

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

export default function LeaderboardBoard({ embedded = false }: { embedded?: boolean }) {
  const Title = embedded ? "h2" : "h1";
  const [completedPeriods, setCompletedPeriods] = useState<LeaderboardPeriod[]>([]);
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


    async function loadLeaderboard(showLoading = true) {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchLeaderboard();

        if (isActive) {
          setPlayers(Array.isArray(data.players) ? data.players : []);
          setSourceWindow(validSourceWindow(data.sourceWindow));
          setCompletedPeriods(data.completedPeriods ?? []);
          setPrizePool(typeof data.prizePool === "number" ? data.prizePool : fallbackPrizePool);
        }
      } catch (loadError) {
        if (isActive) {
          setPlayers([]);
          setError(loadError instanceof Error ? loadError.message : "Pack Draw leaderboard data is unavailable.");
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
    <div id="live-leaderboard" className={embedded ? "leaderboard-content leaderboard-embedded" : "leaderboard-content"}>

      <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
        <div className="leaderboard-floaters" aria-hidden="true">
          <Image className="leaderboard-floater leaderboard-floater-vs" src="/floating/ref-vs-badge.png" alt="" width={1254} height={1254} unoptimized />
          <Image className="leaderboard-floater leaderboard-floater-scatter" src="/floating/ref-scatter-machine.png" alt="" width={1254} height={1254} unoptimized />
        </div>
        <div className="leaderboard-hero-copy">
          <PackDrawLogo className="packdraw-logo-hero" />
          <Title id="leaderboard-title" className="leaderboard-title">LEADERBOARD</Title>
          <p className="leaderboard-period">{formatDateRange(sourceWindow)}</p>
          <div className="leaderboard-summary">
            <div className="leaderboard-prize"><span>MONTHLY PRIZE POOL</span><strong>{formatCurrency(prizePool)}</strong></div>
            <div className="leaderboard-countdown"><span>TIME REMAINING</span><strong>{countdown}</strong></div>
          </div>
          <p className="leaderboard-updated">{isLoading ? "Updating rankings..." : error ? "Rankings unavailable" : `Updated ${formatUpdatedAt(sourceWindow.updatedAt)} UTC`}</p>
          {embedded && <Link className="leaderboard-full-link" href="/leaderboard">Full leaderboard <b aria-hidden="true">-&gt;</b></Link>}
        </div>
      </section>

      <div className="platform-strip" aria-label="Leaderboard platform">
        <a className="platform-tile active" href="https://packdraw.com/" target="_blank" rel="noreferrer">
          <div><PackDrawLogo className="mode-packdraw-logo" /></div>
          <b>LIVE</b>
        </a>
      </div>

      <div className="leaderboard-stats" aria-label="Leaderboard statistics">
        <div><span>PLAYERS</span><strong>{formatCompactNumber(players.length)}</strong></div>
        <div><span>TOTAL WAGERED</span><strong>{formatCompactCurrency(totalWagered)}</strong></div>
        <div><span>PRIZE POOL</span><strong>{formatCurrency(prizePool)}</strong></div>
        <div className="stats-live"><i /> <span>{isLoading ? "UPDATING" : error ? "OFFLINE" : "LIVE"}</span></div>
      </div>

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

        <PlayerRows players={filteredPlayers} label="Pack Draw player rankings" emptyMessage={isLoading ? "LOADING LIVE DATA..." : error ? error : query ? "NO MATCHING PLAYERS." : "NO PLAYERS THIS PERIOD YET."} />
      </section>

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

      <PreviousLeaderboards periods={completedPeriods} loading={isLoading} error={error} />
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

function PreviousLeaderboards({ periods, loading, error }: { periods: LeaderboardPeriod[]; loading: boolean; error: string | null }) {
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
                {periods.map((entry) => <option key={entry.id} value={entry.id}>{formatDateRange(entry)}</option>)}
              </select>
            </label>
            <HistoricalResults key={period.id} period={period} />
          </>
        ) : (
          <div className="history-empty" role="status">
            <strong>{loading ? "Checking previous leaderboards..." : error ? "Previous leaderboards are unavailable." : "No completed Pack Draw leaderboards yet."}</strong>
            {!loading && !error && <p>The first results will appear here when the current monthly run ends.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function HistoricalResults({ period }: { period: LeaderboardPeriod }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLeaderboard(period.id).then((result) => {
      if (active) setData(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Previous leaderboard is unavailable.");
    });
    return () => { active = false; };
  }, [period.id]);

  return (
    <div className="history-results" aria-busy={!data && !error}>
      <p className="history-period">Pack Draw &middot; {formatDateRange(period)} &middot; Completed</p>
      <PlayerRows players={data?.players ?? []} label="Previous Pack Draw player rankings" emptyMessage={error ?? (data ? "NO PLAYERS IN THIS PERIOD." : "LOADING PREVIOUS RESULTS...")} />
    </div>
  );
}
