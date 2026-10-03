"use client";

import { useEffect, useRef, useState } from "react";

export default function DashboardPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [banned, setBanned] = useState([]);
  const [banId, setBanId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banTarget, setBanTarget] = useState(null);
  const [banTargetReason, setBanTargetReason] = useState("");
  const [banOptIp, setBanOptIp] = useState(true);
  const [banOptDevice, setBanOptDevice] = useState(true);
  const [inviteLink, setInviteLink] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  const [pullStats, setPullStats] = useState(null);
  const stopPull = useRef(false);

  useEffect(() => {
    loadMembers();
    loadBanned();
  }, []);

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await fetch("/api/members");
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members);
      } else {
        setStatus(data.error || "Erro ao carregar membros.");
      }
    } catch {
      setStatus("Não consegui carregar os membros.");
    }
    setLoading(false);
  }

  async function toggleExcluded(member) {
    const next = !member.excluded;
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, excluded: next } : m))
    );
    await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excluded: next }),
    });
  }

  async function removeMember(member) {
    if (!confirm(`Remover ${member.username} da lista?`)) return;
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    await fetch(`/api/members/${member.id}`, { method: "DELETE" });
  }

  async function loadBanned() {
    try {
      const res = await fetch("/api/banned");
      const data = await res.json();
      if (res.ok) setBanned(data.banned);
    } catch {}
  }

  async function banUser(discord_id, username, reason, ban_ip, ban_device) {
    const res = await fetch("/api/banned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discord_id, username, reason, ban_ip, ban_device }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || "Erro ao banir.");
      return;
    }
    const partes = ["ID"];
    if (ban_ip) partes.push("IP");
    if (ban_device) partes.push("hardware");
    setStatus(`Banido do site (${partes.join(" + ")}).`);
    await Promise.all([loadBanned(), loadMembers()]);
  }

  // Abre o painel inline com as opções de banimento pro membro clicado.
  function openBanPanel(member) {
    setBanTarget(member);
    setBanTargetReason("");
    setBanOptIp(!!member.ip);
    setBanOptDevice(!!member.device_label);
  }

  async function confirmBanTarget() {
    if (!banTarget) return;
    await banUser(
      banTarget.discord_id,
      banTarget.username,
      banTargetReason.trim(),
      banOptIp && !!banTarget.ip,
      banOptDevice && !!banTarget.device_label
    );
    setBanTarget(null);
  }

  async function banById() {
    const id = banId.trim();
    if (!id) return;
    await banUser(id, null, banReason.trim(), false, false);
    setBanId("");
    setBanReason("");
  }

  async function unban(b) {
    if (!confirm(`Desbanir ${b.username || b.discord_id}?`)) return;
    setBanned((prev) => prev.filter((x) => x.discord_id !== b.discord_id));
    await fetch(`/api/banned/${b.discord_id}`, { method: "DELETE" });
  }

  async function handleSend() {
    if (!message.trim()) {
      setStatus("Escreva uma mensagem antes de enviar.");
      return;
    }
    setSending(true);
    setStatus("Enviando...");
    try {
      const res = await fetch("/api/send-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Erro ao enviar.");
      } else {
        setStatus(`Enfileirado para ${data.sent} pessoa(s). O bot envia aos poucos (~1s por pessoa).`);
        setMessage("");
      }
    } catch {
      setStatus("Não consegui falar com o servidor.");
    }
    setSending(false);
  }

  // Puxa todos os membros com autorização salva para o servidor do link.
  // O servidor processa em lotes; aqui repetimos até acabar (dá pra parar e continuar depois).
  async function handlePull() {
    if (!inviteLink.trim()) {
      setPullStatus("Cole o link de convite do servidor de destino.");
      return;
    }
    setPulling(true);
    setPullStats(null);
    stopPull.current = false;
    setPullStatus("Conferindo o servidor...");

    async function chamar(payload) {
      const res = await fetch("/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao puxar membros.");
      return data;
    }

    try {
      const info = await chamar({ action: "resolve", invite: inviteLink });
      const semAuth = info.total - info.authorized;
      const ok = confirm(
        `Puxar ${info.authorized} membro(s) para "${info.guildName}"?` +
          (semAuth > 0
            ? `\n\n${semAuth} membro(s) não têm autorização salva (verificaram antes) e serão pulados.`
            : "")
      );
      if (!ok) {
        setPullStatus("Cancelado.");
        setPulling(false);
        return;
      }

      const total = { processed: 0, joined: 0, already: 0, failed: 0, noToken: 0, banned: 0, revoked: 0, erros: {}, alvo: info.total, nome: info.guildName };
      let cursor = 0;
      while (!stopPull.current) {
        setPullStatus(`Puxando para "${info.guildName}"...`);
        const r = await chamar({ action: "run", guildId: info.guildId, cursor });
        for (const k of ["processed", "joined", "already", "failed", "noToken", "banned", "revoked"]) total[k] += r[k] || 0;
        for (const [motivo, n] of Object.entries(r.erros || {})) total.erros[motivo] = (total.erros[motivo] || 0) + n;
        cursor = r.nextCursor;
        setPullStats({ ...total });

        if (r.fatal) {
          setPullStatus(r.fatal);
          setPulling(false);
          return;
        }
        if (r.done) {
          setPullStatus(`Concluído! Servidor "${info.guildName}".`);
          setPulling(false);
          return;
        }
        if (r.retryAfter) {
          setPullStatus(`O Discord pediu uma pausa. Continuando em ${r.retryAfter}s...`);
          await new Promise((res) => setTimeout(res, r.retryAfter * 1000 + 500));
        }
      }
      setPullStatus("Parado. Clique em Puxar de novo para continuar (quem já entrou é pulado).");
    } catch (err) {
      setPullStatus(err.message || "Erro ao puxar membros.");
    }
    setPulling(false);
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const bannedIds = new Set(banned.map((b) => b.discord_id));
  const authorizedCount = members.filter((m) => m.has_token).length;
  const activeCount = members.filter((m) => !m.excluded && !bannedIds.has(m.discord_id)).length;

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #070707;
          --panel: #101010;
          --panel-soft: #0c0c0c;
          --line: #241010;
          --red: #e30613;
          --grey: #9a8080;
          --white: #f5f5f5;
          --mono: "JetBrains Mono", "Courier New", monospace;
          --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          background: var(--bg);
          color: var(--white);
          font-family: var(--sans);
        }
      `}</style>

      <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            position: "sticky",
            top: 0,
            background: "rgba(7,7,7,0.85)",
            backdropFilter: "blur(14px)",
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--grey)" }}>
              PAINEL RESTRITO
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>DM Control</h1>
            <a
              href="/consultar-ip"
              style={{
                fontSize: 11,
                padding: "7px 11px",
                borderRadius: 999,
                border: "1px solid #4a1010",
                background: "rgba(227,6,19,0.12)",
                color: "#ff8585",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Consultar IP
            </a>
          </div>
          </div>
          <button onClick={handleLogout} style={logoutBtn}>
            Sair
          </button>
        </header>

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 18px" }}>
          <section
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--grey)", marginBottom: 10 }}>
              Mensagem para {activeCount} membro(s) ativo(s)
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva a mensagem que vai pro privado de todo mundo..."
              rows={4}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "#0a0a0a",
                color: "var(--white)",
                fontSize: 14,
                fontFamily: "var(--sans)",
                resize: "vertical",
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                marginTop: 14,
                padding: "13px 20px",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
                cursor: sending ? "wait" : "pointer",
                background: sending ? "#4a0a0a" : "linear-gradient(180deg, #ff3b3b, #e30613)",
                boxShadow: sending ? "none" : "0 0 20px rgba(227,6,19,0.35)",
              }}
            >
              {sending ? "Enviando..." : "Enviar DM pra todos"}
            </button>
            {status && (
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--grey)" }}>{status}</div>
            )}
          </section>

          <section
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--grey)", marginBottom: 4 }}>
              Puxar membros para outro servidor
            </div>
            <div style={{ fontSize: 12, color: "var(--grey)", marginBottom: 12, lineHeight: 1.5 }}>
              {authorizedCount} de {members.length} membro(s) têm autorização salva. A Zoe precisa
              estar no servidor de destino com a permissão de Criar convite.
            </div>
            <input
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              placeholder="https://discord.gg/seu-servidor"
              disabled={pulling}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "#0a0a0a",
                color: "var(--white)",
                fontSize: 14,
                fontFamily: "var(--sans)",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={handlePull}
                disabled={pulling}
                style={{
                  padding: "13px 20px",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#fff",
                  cursor: pulling ? "wait" : "pointer",
                  background: pulling ? "#4a0a0a" : "linear-gradient(180deg, #ff3b3b, #e30613)",
                  boxShadow: pulling ? "none" : "0 0 20px rgba(227,6,19,0.35)",
                }}
              >
                {pulling ? "Puxando..." : "Puxar membros verificados"}
              </button>
              {pulling && (
                <button
                  onClick={() => (stopPull.current = true)}
                  style={{
                    padding: "13px 18px",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "var(--white)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Parar
                </button>
              )}
            </div>
            {pullStats && (
              <>
                <div style={{ height: 6, borderRadius: 4, background: "#1a0a0a", marginTop: 14, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.round((pullStats.processed / Math.max(1, pullStats.alvo)) * 100))}%`,
                      background: "var(--red)",
                      transition: "width .3s",
                    }}
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--grey)", lineHeight: 1.7 }}>
                  {pullStats.processed}/{pullStats.alvo} processados • {pullStats.joined} entraram •{" "}
                  {pullStats.already} já estavam • {pullStats.failed} falharam • {pullStats.noToken} sem
                  autorização • {pullStats.revoked} revogaram • {pullStats.banned} banidos (pulados)
                  {Object.entries(pullStats.erros).map(([motivo, n]) => (
                    <div key={motivo}>
                      ↳ {n}x {motivo}
                    </div>
                  ))}
                </div>
              </>
            )}
            {pullStatus && (
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--grey)" }}>{pullStatus}</div>
            )}
          </section>

          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Membros verificados</h2>
              <span style={{ fontSize: 12, color: "var(--grey)" }}>{members.length} total</span>
            </div>

            {loading ? (
              <div style={{ color: "var(--grey)", fontSize: 13 }}>Carregando...</div>
            ) : members.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--line)",
                  borderRadius: 14,
                  padding: 28,
                  textAlign: "center",
                  color: "var(--grey)",
                  fontSize: 13.5,
                }}
              >
                Nenhum membro verificado ainda. Assim que alguém passar pela verificação no
                bot, aparece aqui.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      background: "var(--panel-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      opacity: m.excluded ? 0.55 : 1,
                    }}
                  >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.username}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--grey)",
                          fontFamily: "var(--mono)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.discord_id} • {m.has_token ? "autorizado" : "sem autorização"}{m.has_webhook ? " • webhook" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--grey)", fontFamily: "var(--mono)", marginTop: 2 }}>
                        IP: {m.ip || "—"} • Hardware: {m.device_label || "—"}
                        {m.proxy_flag ? (
                          <span style={{ color: "#ffb347" }}> • possível VPN/proxy</span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExcluded(m)}
                      style={{
                        fontSize: 11,
                        padding: "7px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--line)",
                        background: m.excluded ? "transparent" : "rgba(227,6,19,0.12)",
                        color: m.excluded ? "var(--grey)" : "#ff8080",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.excluded ? "Excluído do envio" : "Incluído no envio"}
                    </button>

                    {bannedIds.has(m.discord_id) ? (
                      <span style={{ fontSize: 11, color: "#ff6b6b", padding: "7px 10px" }}>
                        BANIDO
                      </span>
                    ) : (
                      <button
                        onClick={() => openBanPanel(m)}
                        style={{
                          fontSize: 11,
                          padding: "7px 10px",
                          borderRadius: 999,
                          border: "1px solid #4a1010",
                          background: "rgba(227,6,19,0.18)",
                          color: "#ff6b6b",
                          cursor: "pointer",
                        }}
                      >
                        Banir
                      </button>
                    )}

                    <button
                      onClick={() => removeMember(m)}
                      style={{
                        fontSize: 11,
                        padding: "7px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--line)",
                        background: "transparent",
                        color: "var(--grey)",
                        cursor: "pointer",
                      }}
                    >
                      Remover
                    </button>
                  </div>

                  {banTarget?.id === m.id && (
                    <div
                      style={{
                        background: "var(--panel)",
                        border: "1px solid #4a1010",
                        borderRadius: 10,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--grey)" }}>
                        Banir <b style={{ color: "var(--white)" }}>{m.username}</b> por:
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                        <input type="checkbox" checked readOnly /> ID do Discord (sempre)
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12.5,
                          opacity: m.ip ? 1 : 0.4,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={banOptIp}
                          disabled={!m.ip}
                          onChange={(e) => setBanOptIp(e.target.checked)}
                        />
                        IP {m.ip ? `(${m.ip})` : "(sem IP registrado ainda)"}
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12.5,
                          opacity: m.device_label ? 1 : 0.4,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={banOptDevice}
                          disabled={!m.device_label}
                          onChange={(e) => setBanOptDevice(e.target.checked)}
                        />
                        Hardware {m.device_label ? `(${m.device_label})` : "(sem hardware registrado ainda)"}
                      </label>
                      <input
                        value={banTargetReason}
                        onChange={(e) => setBanTargetReason(e.target.value)}
                        placeholder="Motivo (opcional)"
                        style={banInput}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={confirmBanTarget}
                          style={{
                            padding: "8px 14px",
                            border: "none",
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: 12.5,
                            color: "#fff",
                            cursor: "pointer",
                            background: "linear-gradient(180deg, #ff3b3b, #e30613)",
                          }}
                        >
                          Confirmar banimento
                        </button>
                        <button
                          onClick={() => setBanTarget(null)}
                          style={{
                            padding: "8px 14px",
                            border: "1px solid var(--line)",
                            borderRadius: 10,
                            fontSize: 12.5,
                            color: "var(--grey)",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginTop: 32 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Banidos do site</h2>
              <span style={{ fontSize: 12, color: "var(--grey)" }}>{banned.length} total</span>
            </div>

            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <input
                value={banId}
                onChange={(e) => setBanId(e.target.value)}
                placeholder="ID do Discord"
                style={banInput}
              />
              <input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Motivo (opcional)"
                style={{ ...banInput, flex: 2 }}
              />
              <button
                onClick={banById}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#fff",
                  cursor: "pointer",
                  background: "linear-gradient(180deg, #ff3b3b, #e30613)",
                }}
              >
                Banir
              </button>
            </div>

            {banned.length === 0 ? (
              <div style={{ color: "var(--grey)", fontSize: 13 }}>Ninguém banido.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {banned.map((b) => (
                  <div
                    key={b.discord_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "var(--panel-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {b.username || "(sem nome)"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--grey)", fontFamily: "var(--mono)" }}>
                        {b.discord_id}
                        {b.reason ? ` • ${b.reason}` : ""}
                      </div>
                      <div style={{ fontSize: 10.5, marginTop: 3, display: "flex", gap: 6 }}>
                        <span style={badgeStyle}>ID</span>
                        {b.ban_ip && <span style={badgeStyle}>IP</span>}
                        {b.ban_device && <span style={badgeStyle}>Hardware</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => unban(b)}
                      style={{
                        fontSize: 11,
                        padding: "7px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--line)",
                        background: "transparent",
                        color: "var(--grey)",
                        cursor: "pointer",
                      }}
                    >
                      Desbanir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

const logoutBtn = {
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #241010",
  background: "transparent",
  color: "#9a8080",
  cursor: "pointer",
};

const banInput = {
  flex: 1,
  minWidth: 130,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #241010",
  background: "#0a0a0a",
  color: "#f5f5f5",
  fontSize: 13,
  outline: "none",
};

const badgeStyle = {
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid #4a1010",
  background: "rgba(227,6,19,0.15)",
  color: "#ff8080",
  fontFamily: "var(--mono)",
};
