import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase() {
  if (!client) {
    const rawUrl = (process.env.SUPABASE_URL || "").trim();
    const key = (process.env.SUPABASE_KEY || "").trim();
    if (!rawUrl || !key) {
      throw new Error("SUPABASE_URL ou SUPABASE_KEY não configurados.");
    }

    let url;
    try {
      const parsed = new URL(rawUrl);
      url = `${parsed.protocol}//${parsed.host}`;
    } catch {
      throw new Error("SUPABASE_URL inválida.");
    }

    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
