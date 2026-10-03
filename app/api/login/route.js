import { NextResponse } from "next/server";
import {
  createSessionValue,
  secretsMatch,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "../../../lib/auth";

// Freio contra tentativa de adivinhar a senha (por IP; vale por instância do servidor).
const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 8;
const falhas = new Map();

function ipDe(req) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
}
function bloqueado(ip) {
  const e = falhas.get(ip);
  if (!e) return false;
  if (Date.now() - e.inicio > JANELA_MS) {
    falhas.delete(ip);
    return false;
  }
  return e.n >= MAX_FALHAS;
}
function registrarFalha(ip) {
  const agora = Date.now();
  const e = falhas.get(ip);
  if (!e || agora - e.inicio > JANELA_MS) falhas.set(ip, { inicio: agora, n: 1 });
  else e.n += 1;
  if (falhas.size > 2000) {
    for (const [k, v] of falhas) if (agora - v.inicio > JANELA_MS) falhas.delete(k);
  }
}

export async function POST(req) {
  const ip = ipDe(req);
  if (bloqueado(ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 15 minutos." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    return NextResponse.json(
      { error: "ADMIN_USERNAME ou ADMIN_PASSWORD não configurados no servidor." },
      { status: 500 }
    );
  }

  // Confere os dois sempre (não revela qual estava errado nem por tempo de resposta)
  const okUser = await secretsMatch(username, validUser);
  const okPass = await secretsMatch(password, validPass);
  if (!okUser || !okPass) {
    registrarFalha(ip);
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const session = await createSessionValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
