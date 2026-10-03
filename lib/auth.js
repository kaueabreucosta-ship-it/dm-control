// Sessão de admin simples: um cookie assinado com SESSION_SECRET.
// Usa a Web Crypto API (funciona tanto no middleware quanto nas rotas de API).

const COOKIE_NAME = "dm_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias em segundos

async function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurado no ambiente.");
  }
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Compara segredos em tempo constante (hash dos dois lados => também esconde o tamanho)
export async function secretsMatch(a, b) {
  const enc = new TextEncoder();
  const ha = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(a ?? ""))));
  const hb = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(b ?? ""))));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function createSessionValue() {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${expires}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

export async function verifySessionValue(value) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [role, expires, sigHex] = parts;
  if (role !== "admin") return false;

  const payload = `${role}.${expires}`;
  const key = await getKey();
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expectedHex = toHex(expectedSig);

  if (!(await secretsMatch(expectedHex, sigHex))) return false;
  if (!Number.isFinite(Number(expires)) || Date.now() > Number(expires)) return false;
  return true;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE;
