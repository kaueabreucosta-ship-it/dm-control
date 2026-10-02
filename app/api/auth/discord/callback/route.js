import { NextResponse } from "next/server";
import { getSupabase } from "../../../../../lib/db";

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  function voltar(status) {
    return NextResponse.redirect(`${origin}/verificar?status=${status}`);
  }

  if (!code) return voltar("erro");

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

    // 2. Descobre quem é o usuário
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return voltar("erro");
    const user = await userRes.json();

    // 2.5 Banido do site? Não deixa verificar.
    const { data: banido } = await getSupabase()
      .from("banned_users")
      .select("discord_id")
      .eq("discord_id", user.id)
      .maybeSingle();
    if (banido) return voltar("banido");

    // 3. Pergunta pro bot se essa pessoa está no servidor
    const membroRes = await fetch(`${botApiUrl}/membro/${user.id}`, {
      headers: { "x-bot-secret": botSecret },
    });
    if (!membroRes.ok) return voltar("erro");
    const membroData = await membroRes.json();

    if (!membroData.isMember) return voltar("nao-membro");

    // 4. Pede pro bot iniciar a verificação (manda DM pedindo o webhook)
    const verificarRes = await fetch(`${botApiUrl}/verificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": botSecret },
      body: JSON.stringify({ discord_id: user.id, username: user.username }),
    });
    if (!verificarRes.ok) return voltar("dm-falhou");

    return voltar("ok");
  } catch {
    return voltar("erro");
  }
}
