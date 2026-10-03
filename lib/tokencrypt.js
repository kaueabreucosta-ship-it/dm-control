// Criptografia dos tokens OAuth2 guardados no banco (AES-256-GCM).
// Se o banco vazar, os tokens sozinhos não servem: falta a TOKEN_ENC_KEY (que fica só na Vercel).
// IMPORTANTE: use o MESMO valor de TOKEN_ENC_KEY aqui e no site Crimson Beams X.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey() {
  const secret = process.env.TOKEN_ENC_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("TOKEN_ENC_KEY não configurado (mínimo 16 caracteres).");
  }
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), enc.encode(String(plain)));
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(ct).toString("base64url")}`;
}

export async function decryptToken(value) {
  const [v, ivB, ctB] = String(value || "").split(".");
  if (v !== "v1" || !ivB || !ctB) throw new Error("Token em formato inválido.");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(ivB, "base64url") },
    await getKey(),
    Buffer.from(ctB, "base64url")
  );
  return dec.decode(pt);
}
