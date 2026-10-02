"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadMembers();
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
        setStatus(`Enviado para ${data.sent} pessoa(s).`);
        setMessage("");
      }
    } catch {
      setStatus("Não consegui falar com o servidor.");
    }
    setSending(false);
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const activeCount = members.filter((m) => !m.excluded).length;

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
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>DM Control</h1>
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
                      alignItems: "center",
                      gap: 12,
                      background: "var(--panel-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      opacity: m.excluded ? 0.55 : 1,
                      flexWrap: "wrap",
                    }}
                  >
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
                        {m.discord_id} • {m.webhook_url ? "webhook ok" : "sem webhook"}
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
