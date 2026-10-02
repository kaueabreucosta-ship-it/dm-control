const MENSAGENS = {
  ok: {
    titulo: "Verificado! ✅",
    texto:
      "Você já está verificado. Veja seu Discord — a Zoe te mandou uma mensagem privada pedindo o link do seu webhook.",
  },
  "nao-membro": {
    titulo: "Você não está no servidor",
    texto: "Entre no servidor do Discord primeiro e depois tente verificar de novo.",
  },
  "dm-falhou": {
    titulo: "Não consegui te mandar DM",
    texto:
      "Abra as configurações de privacidade do Discord e permita mensagens diretas de membros do servidor, depois tente de novo.",
  },
  config: {
    titulo: "Verificação não configurada",
    texto: "O administrador ainda não configurou a verificação neste site.",
  },
  erro: {
    titulo: "Algo deu errado",
    texto: "Não consegui concluir a verificação. Tente novamente.",
  },
};

export default function VerificarPage({ searchParams }) {
  const status = searchParams?.status;
  const info = status ? MENSAGENS[status] : null;

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #070707;
          --panel: #101010;
          --line: #2a1010;
          --red: #e30613;
          --grey: #9a8080;
          --white: #f5f5f5;
          --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(ellipse 70% 50% at 20% -10%, #2a0808 0%, transparent 55%),
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
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: "var(--grey)",
              marginBottom: 10,
            }}
          >
            VERIFICAÇÃO
          </div>

          {info ? (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 10 }}>{info.titulo}</h1>
              <p style={{ fontSize: 14, color: "var(--grey)", lineHeight: 1.6, marginBottom: 20 }}>
                {info.texto}
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 10 }}>Verificar no Discord</h1>
              <p style={{ fontSize: 14, color: "var(--grey)", lineHeight: 1.6, marginBottom: 20 }}>
                Confirme que você está no servidor pra liberar as mensagens e novidades no seu
                privado.
              </p>
            </>
          )}

          <a
            href="/api/auth/discord"
            style={{
              display: "inline-block",
              width: "100%",
              padding: 14,
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 15,
              color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(180deg, #ff3b3b, #e30613)",
              boxShadow: "0 0 24px rgba(227,6,19,0.4)",
            }}
          >
            {info ? "Verificar de novo" : "Verificar com Discord"}
          </a>
        </div>
      </div>
    </>
  );
}
