import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/requireAdmin";
import { secretsMatch } from "../../../lib/auth";

const WEBHOOK_REGEX = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

// GET: lista os membros (precisa estar logado como admin)
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const db = getSupabase();
  const { data, error } = await db
    .from("members")
    .select("id, discord_id, username, webhook_url, refresh_token, excluded, verified_at")
    .order("verified_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // A URL do webhook é um segredo: o navegador só precisa saber SE existe
  const members = (data || []).map(({ webhook_url, refresh_token, ...m }) => ({
    ...m,
    has_webhook: !!webhook_url,
    has_token: !!refresh_token,
  }));
  return NextResponse.json({ members });
}

// POST: o BOT chama isso quando alguém se verifica (usa segredo compartilhado, não login)
export async function POST(req) {
  const secret = req.headers.get("x-bot-secret");
  if (!secret || !process.env.BOT_SHARED_SECRET || !(await secretsMatch(secret, process.env.BOT_SHARED_SECRET))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const discord_id = String(body.discord_id || "").trim();
  const username = String(body.username || "").slice(0, 100);
  const webhook_url = body.webhook_url ? String(body.webhook_url).trim() : "";
  if (!/^\d{5,25}$/.test(discord_id) || !username) {
    return NextResponse.json(
      { error: "discord_id (numérico) e username são obrigatórios." },
      { status: 400 }
    );
  }
  if (webhook_url && !WEBHOOK_REGEX.test(webhook_url)) {
    return NextResponse.json({ error: "URL de webhook inválida." }, { status: 400 });
  }

  const db = getSupabase();

  const { data: banido } = await db
    .from("banned_users")
    .select("discord_id")
    .eq("discord_id", discord_id)
    .maybeSingle();
  if (banido) {
    return NextResponse.json({ error: "Usuário banido." }, { status: 403 });
  }

  if (webhook_url) {
    const { error } = await db
      .from("members")
      .upsert({ discord_id, username, webhook_url }, { onConflict: "discord_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: existing } = await db
    .from("members")
    .select("id")
    .eq("discord_id", discord_id)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("members").update({ username }).eq("discord_id", discord_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("members").insert({ discord_id, username });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
