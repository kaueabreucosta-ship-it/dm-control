import { NextResponse } from "next/server";
import { getSupabase } from "../../../../../lib/db";
import { encryptToken } from "../../../../../lib/tokencrypt";

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  function voltar(status) {
    const res = NextResponse.redirect(`${origin}/verificar?status=${status}`);
    res.cookies.delete("dm_oauth_state");
    return res;
  }

  if (!code) return voltar("erro");

  // Confere o "state" (anti-CSRF)
  const state = searchParams.get("state");
  const savedState = req.cookies.get("dm_oauth_state")?.value;
  if (!state || !savedState || state !== savedState) return voltar("erro");

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const botApiUrl = process.env.BOT_API_URL;
  const botSecret = process.env.BOT_SHARED_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !botApiUrl || !botSecret) {
    return voltar("config");
  }

  try {
    // 1. Troca o "code" por um access_token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return voltar("erro");
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token || !tokenData.refresh_token) return voltar("erro");

    // 2. Descobre quem é o usuário
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return voltar("erro");
    const user = await userRes.json();
    if (!/^\d{5,25}$/.test(String(user.id))) return voltar("erro");

    // 2.5 Banido do site? Não deixa verificar.
    const { data: banido, error: banErro } = await getSupabase()
      .from("banned_users")
      .select("discord_id")
      .eq("discord_id", user.id)
      .maybeSingle();
    if (banErro) return voltar("erro"); // se não deu pra checar o ban, não libera
    if (banido) return voltar("banido");

    // 3. Pergunta pro bot se essa pessoa está no servidor
    const membroRes = await fetch(`${botApiUrl}/membro/${user.id}`, {
      headers: { "x-bot-secret": botSecret },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!membroRes.ok) return voltar("erro");
    const membroData = await membroRes.json();

    if (!membroData.isMember) return voltar("nao-membro");

    // 3.5 Salva o membro + a autorização OAuth2 (tokens criptografados).
    // É isso que permite puxar a pessoa pra outro servidor depois, mesmo com o bot fora do ar.
    const { error: saveErr } = await getSupabase()
      .from("members")
      .upsert(
        {
          discord_id: user.id,
          username: String(user.username || "Usuário").slice(0, 100),
          access_token: await encryptToken(tokenData.access_token),
          refresh_token: await encryptToken(tokenData.refresh_token),
          token_expires_at: new Date(
            Date.now() + (Number(tokenData.expires_in) || 604800) * 1000
          ).toISOString(),
        },
        { onConflict: "discord_id" }
      );
    if (saveErr) {
      console.error("[dm-control] erro ao salvar membro:", saveErr.message);
      return voltar("erro");
    }

    // 4. Pede pro bot mandar a DM avisando que a pessoa foi verificada.
    // Se a DM falhar (privacidade fechada), a pessoa continua verificada.
    const verificarRes = await fetch(`${botApiUrl}/verificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": botSecret },
      body: JSON.stringify({ discord_id: user.id, username: user.username }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!verificarRes.ok) return voltar("ok-sem-dm");

    return voltar("ok");
  } catch {
    return voltar("erro");
  }
}
