import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/db";
import { isAdminRequest } from "../../../lib/requireAdmin";
import { encryptToken, decryptToken } from "../../../lib/tokencrypt";
import {
  parseInvite,
  resolveInvite,
  botIsInGuild,
  refreshAccessToken,
  addToGuild,
} from "../../../lib/discord";

export const runtime = "nodejs";
export const maxDuration = 60; // cada chamada processa um lote; o painel repete até acabar

const BUDGET_MS = 35_000; // tempo de trabalho por chamada (sobra margem pro limite de 60s)
const PAUSA_MS = 1100; // ~1 pessoa por segundo, respeitando o limite do Discord

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Devolve um access_token válido (renova se estiver perto de vencer ou se forçado)
async function obterAcesso(db, m, forcar) {
  const exp = m.token_expires_at ? new Date(m.token_expires_at).getTime() : 0;
  if (!forcar && exp - Date.now() > 120_000) {
    return { access: await decryptToken(m.access_token) };
  }
  const r = await refreshAccessToken(await decryptToken(m.refresh_token));
  if (!r.ok) {
    if (r.revoked) {
      // a pessoa cancelou a autorização: limpa pra não tentar de novo
      await db
        .from("members")
        .update({ access_token: null, refresh_token: null, token_expires_at: null })
        .eq("id", m.id);
      return { revoked: true };
    }
    return { erro: "falha ao renovar o token (tente de novo)" };
  }
  await db
    .from("members")
    .update({
      access_token: await encryptToken(r.access_token),
      refresh_token: await encryptToken(r.refresh_token),
      token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
    })
    .eq("id", m.id);
  return { access: r.access_token };
}

function motivoDoErro(r) {
  if (r.code === 40007) return "banido do servidor de destino";
  if (r.code === 30001) return "já está em 100 servidores";
  if (r.code === 10013) return "conta não existe mais";
  return `erro ${r.http}${r.code ? ` (${r.code})` : ""}`;
}

export async function POST(req) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const db = getSupabase();

  try {
    // ---------- 1) conferir o servidor de destino ----------
    if (action === "resolve") {
      const code = parseInvite(body.invite);
      if (!code) {
        return NextResponse.json({ error: "Link de convite inválido." }, { status: 400 });
      }
      const info = await resolveInvite(code);
      if (!info) {
        return NextResponse.json({ error: "Convite inválido ou expirado." }, { status: 400 });
      }
      if (!(await botIsInGuild(info.guildId))) {
        return NextResponse.json(
          {
            error: `A Zoe ainda não está em "${info.guildName}". Adicione o bot lá (com permissão de Criar convite) e tente de novo.`,
          },
          { status: 400 }
        );
      }
      const { count: total } = await db.from("members").select("id", { count: "exact", head: true });
      const { count: authorized } = await db
        .from("members")
        .select("id", { count: "exact", head: true })
        .not("refresh_token", "is", null);
      return NextResponse.json({
        guildId: info.guildId,
        guildName: info.guildName,
        memberCount: info.memberCount,
        total: total || 0,
        authorized: authorized || 0,
      });
    }

    // ---------- 2) puxar um lote ----------
    if (action === "run") {
      const guildId = String(body.guildId || "");
      if (!/^\d{5,25}$/.test(guildId)) {
        return NextResponse.json({ error: "Servidor inválido." }, { status: 400 });
      }
      let cursor = Math.max(0, parseInt(body.cursor, 10) || 0);

      const { data: bannedRows, error: banErr } = await db.from("banned_users").select("discord_id");
      if (banErr) {
        return NextResponse.json(
          { error: "Não consegui checar a lista de banidos. Cancelado por segurança." },
          { status: 500 }
        );
      }
      const bannedIds = new Set((bannedRows || []).map((b) => b.discord_id));

      const stats = { processed: 0, joined: 0, already: 0, failed: 0, noToken: 0, banned: 0, revoked: 0 };
      const erros = {};
      const falha = (motivo) => {
        stats.failed++;
        erros[motivo] = (erros[motivo] || 0) + 1;
      };
      let done = false;
      let retryAfter = null;
      let fatal = null;
      const inicio = Date.now();

      outer: while (true) {
        if (Date.now() - inicio > BUDGET_MS) break;
        const { data: rows, error } = await db
          .from("members")
          .select("id, discord_id, access_token, refresh_token, token_expires_at")
          .gt("id", cursor)
          .order("id", { ascending: true })
          .limit(25);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (!rows.length) {
          done = true;
          break;
        }

        for (const m of rows) {
          if (Date.now() - inicio > BUDGET_MS) break outer;

          if (bannedIds.has(m.discord_id)) {
            stats.banned++;
          } else if (!m.access_token || !m.refresh_token) {
            stats.noToken++;
          } else {
            let acesso;
            try {
              acesso = await obterAcesso(db, m, false);
            } catch {
              acesso = { erro: "token ilegível (TOKEN_ENC_KEY diferente?)" };
            }

            if (acesso.revoked) {
              stats.revoked++;
            } else if (acesso.erro) {
              falha(acesso.erro);
            } else {
              let r = await addToGuild(guildId, m.discord_id, acesso.access);

              // token recusado: renova uma vez e tenta de novo
              if (r.status === "error" && (r.http === 401 || r.code === 50025)) {
                const novo = await obterAcesso(db, m, true).catch(() => ({ erro: "falha ao renovar" }));
                if (novo.access) r = await addToGuild(guildId, m.discord_id, novo.access);
                else if (novo.revoked) r = { status: "revoked" };
                else r = { status: "error", http: 401, message: novo.erro };
              }

              if (r.status === "ratelimited") {
                retryAfter = r.retryAfter; // não avança o cursor: tenta de novo depois da espera
                break outer;
              }
              if (r.status === "joined") {
                stats.joined++;
                await sleep(PAUSA_MS);
              } else if (r.status === "already") {
                stats.already++;
                await sleep(250);
              } else if (r.status === "revoked") {
                stats.revoked++;
              } else {
                // erros que valem pro servidor inteiro: para tudo e explica
                if (r.code === 50013 || r.code === 50001 || r.code === 10004) {
                  fatal =
                    r.code === 50013
                      ? "A Zoe não tem permissão de Criar convite no servidor de destino. Dê essa permissão a ela e tente de novo."
                      : "A Zoe não consegue acessar o servidor de destino. Confira se ela está lá.";
                  break outer;
                }
                falha(motivoDoErro(r));
              }
            }
          }
          stats.processed++;
          cursor = m.id;
        }
      }

      return NextResponse.json({
        ok: true,
        ...stats,
        nextCursor: cursor,
        done,
        retryAfter,
        fatal,
        erros,
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    console.error("[pull]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Erro interno." }, { status: 500 });
  }
}
