// Cloudflare Worker API for Stoney Leaderboard
// Routes:
//  POST /submit  { initData, score }  -> upsert best score for Telegram user
//  GET  /top?limit=20                 -> [{ id, username, photo_url, score }]

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = env.ALLOW_ORIGIN || "*";
    const baseHeaders = {
      "Access-Control-Allow-Origin": cors,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
    if (req.method === "OPTIONS") return new Response("", { headers: baseHeaders });

    try {
      if (url.pathname === "/top" && req.method === "GET") {
        const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "20", 10)));
        const { results } = await env.DB
          .prepare(`SELECT id, username, photo_url, best_score AS score
                    FROM scores
                    ORDER BY best_score DESC, updated_at DESC
                    LIMIT ?1`)
          .bind(limit)
          .all();
        return json(results || [], baseHeaders);
      }

      if (url.pathname === "/submit" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { initData, score } = body || {};
        if (!Number.isFinite(score)) return bad("invalid score", baseHeaders);
        const user = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (!user) return bad("invalid telegram initData", baseHeaders);

        const id = String(user.id);
        const username =
          user.username ||
          [user.first_name, user.last_name].filter(Boolean).join(" ") ||
          "Player";
        const photo_url = user.photo_url || "";
        const now = Date.now();

        await env.DB.prepare(
          `INSERT INTO scores (id, username, photo_url, best_score, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(id) DO UPDATE SET
             username=excluded.username,
             photo_url=excluded.photo_url,
             best_score=CASE
               WHEN excluded.best_score > scores.best_score THEN excluded.best_score
               ELSE scores.best_score END,
             updated_at=?5`
        ).bind(id, username, photo_url, score|0, now).run();

        return json({ ok: true }, baseHeaders);
      }

      return new Response("Not found", { status: 404, headers: baseHeaders });
    } catch (e) {
      return new Response(e.message || "Server error", {
        status: 500,
        headers: baseHeaders,
      });
    }
  },
};

function json(data, headers) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...headers },
  });
}
function bad(msg, headers) {
  return new Response(msg, { status: 400, headers });
}

// --- Telegram WebApp initData verification ---
async function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  const pairs = [];
  for (const [k, v] of params) pairs.push(`${k}=${v}`);
  pairs.sort();
  const data_check_string = pairs.join("\n");

  const secretHex = await hmacSha256Hex("WebAppData", botToken);
  const checkHex  = await hmacSha256Hex(data_check_string, hexToBytes(secretHex));
  if (checkHex !== hash) return null;

  const userStr = params.get("user");
  try { return JSON.parse(userStr); } catch { return null; }
}

// HMAC utils
async function hmacSha256Hex(message, key) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? enc.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bytesToHex(new Uint8Array(sig));
}
function bytesToHex(arr){ return [...arr].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function hexToBytes(hex){ const a=new Uint8Array(hex.length/2); for(let i=0;i<a.length;i++) a[i]=parseInt(hex.substr(i*2,2),16); return a; }
