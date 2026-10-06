import { NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/db";
import { isAdminRequest } from "../../../../lib/requireAdmin";

// PATCH: liga/desliga "excluído do envio de DM"
export async function PATCH(req, { params }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { excluded } = await req.json();
  const db = getSupabase();
  const { error } = await db
    .from("members")
    .update({ excluded: !!excluded })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: remove o membro permanentemente da lista
export async function DELETE(req, { params }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const db = getSupabase();
  const { error } = await db.from("members").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
