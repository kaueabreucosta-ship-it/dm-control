import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/requireAdmin";

// GET: lista os banidos
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const db = getSupabase();
  const { data, error } = await db
    .from("banned_users")
    .select("discord_id, username, reason, banned_at")
    .order("banned_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ banned: data });
}

// POST: bane alguém do site (pelo ID do Discord)
export async function POST(req) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const discord_id = String(body.discord_id || "").trim();
  if (!/^\d{5,25}$/.test(discord_id)) {
    return NextResponse.json({ error: "ID do Discord inválido." }, { status: 400 });
  }
  const username = body.username ? String(body.username).slice(0, 100) : null;
  const reason = body.reason ? String(body.reason).slice(0, 300) : null;

  const db = getSupabase();
  const { error } = await db
    .from("banned_users")
    .upsert({ discord_id, username, reason }, { onConflict: "discord_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Banido também sai do envio de DM em massa
  await db.from("members").update({ excluded: true }).eq("discord_id", discord_id);

  return NextResponse.json({ ok: true });
}
