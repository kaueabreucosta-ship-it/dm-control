import { NextResponse } from "next/server";
import { createSessionValue, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "../../../lib/auth";

export async function POST(req) {
  const { username, password } = await req.json();

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    return NextResponse.json(
      { error: "ADMIN_USERNAME ou ADMIN_PASSWORD não configurados no servidor." },
      { status: 500 }
    );
  }

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const session = await createSessionValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
