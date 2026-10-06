"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao entrar.");
        setLoading(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Não consegui conectar ao servidor.");
      setLoading(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #070707;
          --panel: #101010;
          --line: #2e1065;
          --red: #8b5cf6;
          --grey: #a89bb8;
          --white: #f5f5f5;
          --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(ellipse 70% 50% at 20% -10%, #160b2d 0%, transparent 55%),
            var(--bg);
          color: var(--white);
          font-family: var(--sans);
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 380,
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 28,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <img src="/logo.png" alt="Eclipse Beaming" style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(139,92,246,.45)", boxShadow: "0 0 24px rgba(139,92,246,.25)" }} />
            <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--grey)", marginBottom: 4 }}>
              PAINEL RESTRITO
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Eclipse Beaming</h1>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 12, color: "var(--grey)", marginBottom: 6 }}>
            Usuário
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={inputStyle}
          />

          <label style={{ display: "block", fontSize: 12, color: "var(--grey)", margin: "16px 0 6px" }}>
            Senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={inputStyle}
          />

          {error && (
            <div style={{ color: "#c084fc", fontSize: 13, marginTop: 14 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 22,
              padding: 14,
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 15,
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              background: loading ? "#2e1065" : "linear-gradient(180deg, #c084fc, #8b5cf6)",
              boxShadow: loading ? "none" : "0 0 24px rgba(139,92,246,0.4)",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #2e1065",
  background: "#0a0a0a",
  color: "#f5f5f5",
  fontSize: 14,
  outline: "none",
};
