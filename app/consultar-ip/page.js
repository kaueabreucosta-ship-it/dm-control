"use client";

import { useState } from "react";

// Validação visual antes do envio. O backend repete a validação.
function isValidIP(value) {
  const ip = value.trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":") && ip.split(":").length <= 8;
}

function isPrivateIP(value) {
  const ip = value.trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
  }
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  const first = parseInt(normalized.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}

function valueOrDash(value) {
  return value !== null && value !== undefined && String(value).trim() !== "" ? value : "—";
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: { background: "#1b1010", color: "#cdbaba" },
    red: { background: "#3a0b0b", color: "#ff8b8b" },
    yellow: { background: "#352707", color: "#ffd76a" },
    blue: { background: "#071e35", color: "#75bfff" },
    grey: { background: "#1b1b1b", color: "#929292" },
  };
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, ...tones[tone] }}>{children}</span>;
}

function Card({ title, children }) {
  return <section style={{ background: "#101010", border: "1px solid #2a1010", borderRadius: 16, padding: 20, boxShadow: "0 12px 35px rgba(0,0,0,.25)" }}><h2 style={{ margin: "0 0 16px", fontSize: 15 }}>{title}</h2>{children}</section>;
}

function Field({ label, value }) {
  return <div><div style={{ fontSize: 10, color: "#9a8080", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div><div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>{valueOrDash(value)}</div></div>;
}

export default function ConsultarIPPage() {
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function consultar() {
    const value = ip.trim();
    setError("");
    setResult(null);
    if (!value) return setError("Digite um endereço IP.");
    if (!isValidIP(value)) return setError("Digite um IPv4 ou IPv6 válido.");
    if (isPrivateIP(value)) return setError("Este é um IP privado, não há dados públicos.");

    setLoading(true);
    try {
      const response = await fetch("/api/consultar-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar este IP.");
      setResult(data);
    } catch (err) {
      setError(err.message || "Erro ao consultar o IP.");
    } finally {
      setLoading(false);
    }
  }

  const coords = result?.coordenadas?.lat != null && result?.coordenadas?.lon != null ? `${result.coordenadas.lat},${result.coordenadas.lon}` : null;

  return (
    <main style={{ minHeight: "100vh", background: "#070707", color: "#f5f5f5", fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: "28px 18px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <a href="/dashboard" style={{ color: "#9a8080", fontSize: 12, textDecoration: "none" }}>← Voltar ao painel</a>
          <div style={{ marginTop: 16, fontSize: 10, letterSpacing: 2, color: "#9a8080" }}>PAINEL RESTRITO</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 26 }}>Consultar IP</h1>
          <p style={{ margin: 0, color: "#9a8080", fontSize: 13, lineHeight: 1.6 }}>Consulta dados públicos de geolocalização e rede, cruzando as fontes configuradas.</p>
        </div>

        <section style={{ background: "#101010", border: "1px solid #2a1010", borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={ip} onChange={(e) => setIp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && consultar()} disabled={loading} placeholder="Ex: 45.170.80.112" inputMode="url" style={{ flex: "1 1 280px", minWidth: 0, padding: "14px 15px", borderRadius: 11, border: "1px solid #2a1010", background: "#0a0a0a", color: "#f5f5f5", outline: "none", fontSize: 14 }} />
            <button onClick={consultar} disabled={loading} style={{ padding: "14px 20px", border: 0, borderRadius: 11, color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer", background: loading ? "#4a0a0a" : "linear-gradient(180deg,#ff3b3b,#e30613)" }}>{loading ? "Consultando..." : "Consultar"}</button>
          </div>
          {loading && <div style={{ marginTop: 14, color: "#9a8080", fontSize: 13 }}><span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid #4a2020", borderTopColor: "#ff3b3b", borderRadius: "50%", animation: "spin .8s linear infinite", verticalAlign: "-2px", marginRight: 8 }} />Consultando as fontes...</div>}
          {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#260909", border: "1px solid #571313", color: "#ff8585", fontSize: 13 }}>{error}</div>}
        </section>

        {result && <div style={{ display: "grid", gap: 14 }}>
          <Card title="Localização"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16 }}><Field label="País" value={result.localizacao.bandeira ? `${result.localizacao.bandeira} ${valueOrDash(result.localizacao.pais)}` : result.localizacao.pais} /><Field label="Estado" value={result.localizacao.estado} /><Field label="Cidade" value={result.localizacao.cidade} /><Field label="CEP aproximado" value={result.localizacao.cep} /></div><div style={{ marginTop: 15 }}><Badge>{result.localizacao._fonte || "Fonte não disponível"}</Badge></div></Card>
          <Card title="Endereço detalhado"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}><Field label="Rua via CEP" value={result.endereco.rua_cep} /><Field label="Bairro" value={result.endereco.bairro} /><Field label="Rua via geocodificação" value={result.endereco.rua_geo} /><Field label="Número" value={result.endereco.numero} /></div>{!result.endereco.numero_encontrado && <div style={{ marginTop: 15 }}><Badge tone="grey">Número não disponível</Badge></div>}<div style={{ marginTop: 15 }}><Badge>{result.endereco._fonte || "Fonte não disponível"}</Badge></div></Card>
          <Card title="Rede"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}><Field label="ISP" value={result.rede.isp} /><Field label="Organização" value={result.rede.organizacao} /><Field label="ASN" value={result.rede.asn} /><Field label="Nome ASN" value={result.rede.asn_nome} /></div><div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 16 }}>{result.rede.proxy && <Badge tone="red">Proxy</Badge>}{result.rede.hosting && <Badge tone="yellow">Hosting</Badge>}{result.rede.mobile && <Badge tone="blue">Mobile</Badge>}{!result.rede.proxy && !result.rede.hosting && !result.rede.mobile && <Badge tone="grey">Nenhuma flag disponível</Badge>}</div></Card>
          <Card title="Mapa">{coords ? <><div style={{ fontFamily: '"JetBrains Mono","Courier New",monospace', fontSize: 13 }}>{coords}</div><a href={`https://www.google.com/maps?q=${encodeURIComponent(coords)}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 13, color: "#ff7777", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Ver no mapa →</a></> : <Badge tone="grey">Coordenadas não disponíveis</Badge>}</Card>
          <div style={{ color: "#806f6f", fontSize: 11.5, lineHeight: 1.6, padding: "4px 2px" }}>O IP normalmente aponta apenas para uma região aproximada. O CEP pode indicar uma área ou rua, e o Nominatim só informa número quando esse dado realmente existe na base consultada. Quando não existe, o sistema mostra “Número não disponível” e não inventa um endereço.</div>
        </div>}
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
