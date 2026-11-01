type ExportOptions = {
  environment: string | undefined;
  apiKey: string | undefined;
  urlTemplate?: string;
  tokenHash: string;
  expiresAt: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

const FROM = "2026-10-01T00:00:00.000Z";
const TO = "2026-11-01T00:00:00.000Z";
const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function reply(message: string, status: number) {
  return new Response(message, { status, headers: HEADERS });
}

export async function exportPackDrawPeriod(request: Request, options: ExportOptions): Promise<Response> {
  if (options.environment !== "preview" || (options.now ?? Date.now)() >= options.expiresAt) {
    return reply("Not found", 404);
  }

  if (request.method === "GET") {
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pack Draw export</title>
      <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080809;color:#f4f4ef;font:16px Arial,sans-serif}main{max-width:400px;padding:32px}h1{font-size:28px}p{color:#b8bbc3;line-height:1.5}label{display:block;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit}input{border:1px solid #666;background:#171719;color:white}button{margin-top:16px;border:0;background:#ffd900;color:#080809;font-weight:bold;cursor:pointer}input:focus-visible,button:focus-visible{outline:2px solid #ffd900;outline-offset:4px}</style>
      <main><h1>Pack Draw export</h1><p>October 1–31, 2026 (UTC)</p><form method="post"><label for="token">Export password</label><input id="token" name="token" type="password" required autocomplete="off"><button type="submit">Download player data</button></form></main></html>`, {
      headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
    });
  }

  if (request.method !== "POST") return reply("Method not allowed", 405);
  const body = await request.text();
  if (body.length > 2048) return reply("Request too large", 413);
  const token = new URLSearchParams(body).get("token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return reply("Invalid export password", 401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== options.tokenHash) return reply("Invalid export password", 401);
  if (!options.apiKey) return reply("Pack Draw connection is unavailable", 503);

  try {
    const url = new URL(options.urlTemplate ?? "https://packdraw.com/api/v1/affiliates/leaderboard");
    if (url.origin !== "https://packdraw.com" || url.pathname !== "/api/v1/affiliates/leaderboard") {
      return reply("Pack Draw connection is unavailable", 503);
    }
    url.searchParams.set("apiKey", options.apiKey);
    url.searchParams.set("after", "10-1-2026");
    url.searchParams.set("before", "11-1-2026");
    const upstream = await (options.fetchImpl ?? fetch)(url, {
      method: "GET", cache: "no-store", redirect: "error",
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return reply("Pack Draw data is unavailable", 502);
    const data = await upstream.json();
    if (Date.parse(data.after) !== Date.parse(FROM) || Date.parse(data.before) !== Date.parse(TO) || !Array.isArray(data.leaderboard)) {
      return reply("Pack Draw did not confirm the requested period", 502);
    }
    const ids = new Set<string>();
    for (const row of data.leaderboard) {
      if (!row || typeof row !== "object" || typeof row.userId !== "string" || !row.userId ||
          !Number.isFinite(Number(row.wagerAmount)) || Number(row.wagerAmount) < 0 || ids.has(row.userId)) {
        return reply("Pack Draw returned invalid player records", 502);
      }
      ids.add(row.userId);
    }
    const source = {
      after: data.after, before: data.before, asOf: data.asOf,
      leaderboard: data.leaderboard.map((row: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => !/api.?key|token|password|authorization/i.test(key)))),
    };
    return Response.json(source, {
      headers: { ...HEADERS, "Content-Disposition": 'attachment; filename="Pack_Draw_2026-10-01_to_2026-10-31.json"' },
    });
  } catch {
    return reply("Pack Draw data is unavailable", 502);
  }
}
