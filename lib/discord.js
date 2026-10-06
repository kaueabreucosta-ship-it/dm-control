// Chamadas diretas à API do Discord (com o token do bot), sem depender do processo do bot estar no ar.
const API = "https://discord.com/api/v10";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseInvite(input) {
  const s = String(input || "").trim();
  const m = s.match(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})/i);
  if (m) return m[1];
  return /^[A-Za-z0-9-]{2,32}$/.test(s) ? s : null;
}

function botHeaders() {
  const token = (process.env.DISCORD_BOT_TOKEN || "").trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

// Descobre qual servidor é dono do convite
export async function resolveInvite(code) {
  const res = await fetch(`${API}/invites/${encodeURIComponent(code)}?with_counts=true`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const d = await res.json().catch(() => null);
  if (!d?.guild?.id) return null;
  return {
    guildId: d.guild.id,
    guildName: d.guild.name,
    memberCount: d.approximate_member_count ?? null,
  };
}

// O bot precisa estar no servidor de destino (com permissão de "Criar convite")
export async function botIsInGuild(guildId) {
  const res = await fetch(`${API}/guilds/${guildId}`, {
    headers: botHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

// Renova o token de uma pessoa. revoked=true quando ela cancelou a autorização.
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || "",
      client_secret: process.env.DISCORD_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { ok: false, revoked: res.status === 400 };
  const d = await res.json();
  return {
    ok: true,
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_in: Number(d.expires_in) || 604800,
  };
}

// Adiciona a pessoa ao servidor usando a autorização dela (scope guilds.join)
export async function addToGuild(guildId, userId, accessToken) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const res = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
      method: "PUT",
      headers: botHeaders(),
      body: JSON.stringify({ access_token: accessToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 201) return { status: "joined" };
    if (res.status === 204) return { status: "already" };
    if (res.status === 429) {
      const d = await res.json().catch(() => ({}));
      const seg = Number(d.retry_after) || Number(res.headers.get("retry-after")) || 2;
      if (seg > 8) return { status: "ratelimited", retryAfter: Math.ceil(seg) };
      await sleep(seg * 1000 + 250);
      continue;
    }
    const d = await res.json().catch(() => ({}));
    return { status: "error", http: res.status, code: d.code, message: d.message };
  }
  return { status: "ratelimited", retryAfter: 5 };
}
