import { NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/db";
import { isAdminRequest } from "../../../../lib/requireAdmin";

// DELETE: desbane
export async function DELETE(req, { params }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const id = String(params.discordId || "");
  if (!/^\d{5,25}$/.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const db = getSupabase();
  const { error } = await db.from("banned_users").delete().eq("discord_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
