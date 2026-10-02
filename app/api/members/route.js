import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/requireAdmin";

// GET: lista os membros (precisa estar logado como admin)
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const db = getSupabase();
  const { data, error } = await db
    .from("members")
    .select("id, discord_id, username, webhook_url, excluded, verified_at")
    .order("verified_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ members: data });
}

// POST: o BOT chama isso quando alguém se verifica (usa segredo compartilhado, não login)
export async function POST(req) {
  const secret = req.headers.get("x-bot-secret");
  if (!secret || secret !== process.env.BOT_SHARED_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { discord_id, username, webhook_url } = await req.json();
  if (!discord_id || !username) {
    return NextResponse.json(
      { error: "discord_id e username são obrigatórios." },
      { status: 400 }
    );
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
