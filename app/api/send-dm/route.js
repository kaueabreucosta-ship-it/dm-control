import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/requireAdmin";

export async function POST(req) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  const botApiUrlRaw = process.env.BOT_API_URL;
  const botSecret = process.env.BOT_SHARED_SECRET;
  if (!botApiUrlRaw || !botSecret) {
    return NextResponse.json(
      { error: "BOT_API_URL ou BOT_SHARED_SECRET não configurados." },
      { status: 500 }
    );
  }

  let botApiUrl;
  try {
    const parsed = new URL(botApiUrlRaw.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocolo inválido');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    botApiUrl = parsed.toString().replace(/\/$/, '');
  } catch {
    return NextResponse.json(
      { error: "BOT_API_URL inválido. Use apenas a URL base do Zoe Bot, por exemplo https://zoe-bot-cbmm.onrender.com" },
      { status: 500 }
    );
  }

  const db = getSupabase();
  const { data: allTargets, error } = await db
    .from("members")
    .select("discord_id, webhook_url")
    .eq("excluded", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: bannedRows } = await db.from("banned_users").select("discord_id");
  const bannedIds = new Set((bannedRows || []).map((b) => b.discord_id));
  const targets = (allTargets || []).filter((t) => !bannedIds.has(t.discord_id));
  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: "Nenhum membro para enviar." }, { status: 400 });
  }

  try {
    const botRes = await fetch(`${botApiUrl}/send-dm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bot-secret": botSecret,
      },
      body: JSON.stringify({ message, targets }),
    });

    const data = await botRes.json().catch(() => ({}));

    if (!botRes.ok) {
      return NextResponse.json(
        { error: data.error || "O bot recusou o envio." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, sent: targets.length, botResponse: data });
  } catch {
    return NextResponse.json(
      { error: "Não consegui falar com o bot. Ele está online?" },
      { status: 502 }
    );
  }
}
