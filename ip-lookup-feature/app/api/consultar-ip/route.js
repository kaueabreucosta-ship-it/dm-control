import { NextResponse } from "next/server";
import net from "node:net";
import { cookies } from "next/headers";
import { verifySessionValue, SESSION_COOKIE_NAME } from "../../../lib/auth";

// Cache simples em memória por instância do servidor.
// Em Vercel/serverless ele é reaproveitado enquanto a instância estiver quente.
const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = globalThis.__ipLookupCache || new Map();
globalThis.__ipLookupCache = cache;

// Timeout máximo de cada chamada externa.
const FETCH_TIMEOUT = 8000;

// User-Agent identificando a aplicação, exigido pelo uso responsável do Nominatim.
const NOMINATIM_USER_AGENT = "DM-Control-IP-Lookup/1.0 (admin panel)";

function isPrivateIPv4(ip) {
  const [a, b] = ip.split(".").map(Number);

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");

  // Loopback e endereço não especificado.
  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped IPv6.
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    if (net.isIP(mapped) === 4) return isPrivateIPv4(mapped);
  }

  // fc00::/7 (ULA) e fe80::/10 (link-local).
  const first = parseInt(normalized.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}

function isPrivateIP(ip) {
  if (net.isIP(ip) === 4) return isPrivateIPv4(ip);
  if (net.isIP(ip) === 6) return isPrivateIPv6(ip);
  return false;
}

function cleanIP(value) {
  return String(value || "").trim().replace(/^\[|\]$/g, "");
}

function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return null;
  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

// Faz uma chamada HTTP com timeout independente.
// Uma fonte que falhar não impede as outras.
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Executa as consultas em paralelo quando não há dependência entre elas.
async function lookupGeo(ip) {
  const fields =
    "status,message,continent,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query";

  try {
    const primary = await fetchJson(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`
    );

    if (primary?.status === "success") {
      return { data: primary, source: "ip-api" };
    }
  } catch {
    // Fallback abaixo.
  }

  try {
    const fallback = await fetchJson(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    );

    if (fallback && !fallback.error) {
      return {
        data: {
          status: "success",
          country: fallback.country_name ?? null,
          countryCode: fallback.country_code ?? null,
          regionName: fallback.region ?? null,
          city: fallback.city ?? null,
          zip: fallback.postal ?? null,
          lat: fallback.latitude ?? null,
          lon: fallback.longitude ?? null,
          timezone: fallback.timezone ?? null,
          isp: fallback.org ?? null,
          org: fallback.org ?? null,
          as: fallback.asn ?? null,
          asname: fallback.org ?? null,
          mobile: fallback.mobile ?? null,
          proxy: fallback.proxy ?? null,
          hosting: null,
          query: fallback.ip ?? ip,
        },
        source: "ipapi.co",
      };
    }
  } catch {
    // Ambas falharam.
  }

  return { data: null, source: null };
}

async function lookupCep(cep) {
  if (!cep) return { data: null, source: null };

  const digits = String(cep).replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return { data: null, source: null };

  try {
    const brasil = await fetchJson(
      `https://brasilapi.com.br/api/cep/v1/${digits}`
    );

    if (brasil) {
      return {
        data: {
          street: brasil.street ?? null,
          neighborhood: brasil.neighborhood ?? null,
          city: brasil.city ?? null,
          state: brasil.state ?? null,
        },
        source: "BrasilAPI",
      };
    }
  } catch {
    // Fallback abaixo.
  }

  try {
    const via = await fetchJson(
      `https://viacep.com.br/ws/${digits}/json/`
    );

    if (via && !via.erro) {
      return {
        data: {
          street: via.logradouro ?? null,
          neighborhood: via.bairro ?? null,
          city: via.localidade ?? null,
          state: via.uf ?? null,
        },
        source: "ViaCEP",
      };
    }
  } catch {
    // Ambas falharam.
  }

  return { data: null, source: null };
}

async function reverseGeocode(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return { data: null, source: null };
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    addressdetails: "1",
  });

  try {
    const data = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
          Accept: "application/json",
        },
      }
    );

    return {
      data: {
        road: data?.address?.road ?? null,
        house_number: data?.address?.house_number ?? null,
      },
      source: "Nominatim",
    };
  } catch {
    return { data: null, source: null };
  }
}

function consolidate(ip, geo, cep, reverse) {
  const g = geo.data || {};
  const c = cep.data || {};
  const r = reverse.data || {};

  const locationSource = geo.source || null;
  const cepSource = cep.source || null;
  const reverseSource = reverse.source || null;

  let enderecoSource = null;
  if (cepSource && reverseSource) enderecoSource = `${cepSource} + ${reverseSource}`;
  else if (cepSource) enderecoSource = cepSource;
  else if (reverseSource) enderecoSource = reverseSource;

  return {
    ip,
    localizacao: {
      pais: g.country ?? null,
      codigo_pais: g.countryCode ?? null,
      bandeira: flagEmoji(g.countryCode),
      estado: g.regionName ?? null,
      cidade: g.city ?? null,
      cep: g.zip ?? null,
      _fonte: locationSource,
    },
    endereco: {
      rua_cep: c.street ?? null,
      bairro: c.neighborhood ?? null,
      rua_geo: r.road ?? null,
      numero: r.house_number ?? null,
      numero_encontrado: Boolean(r.house_number),
      _fonte: enderecoSource,
    },
    rede: {
      isp: g.isp ?? null,
      organizacao: g.org ?? null,
      asn: g.as ?? null,
      asn_nome: g.asname ?? null,
      proxy: g.proxy === true,
      hosting: g.hosting === true,
      mobile: g.mobile === true,
    },
    coordenadas: {
      lat: Number.isFinite(Number(g.lat)) ? Number(g.lat) : null,
      lon: Number.isFinite(Number(g.lon)) ? Number(g.lon) : null,
    },
    timezone: g.timezone ?? null,
  };
}

export async function POST(request) {
  // O endpoint fica restrito ao painel administrativo.
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!(await verifySessionValue(session))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const ip = cleanIP(body?.ip);

  // Validação também no backend; nunca confiar apenas no frontend.
  if (!ip || !net.isIP(ip)) {
    return NextResponse.json(
      { error: "Informe um endereço IPv4 ou IPv6 válido." },
      { status: 400 }
    );
  }

  if (isPrivateIP(ip)) {
    return NextResponse.json(
      { error: "Este é um IP privado, não há dados públicos." },
      { status: 400 }
    );
  }

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }
  cache.delete(ip);

  // Primeiro obtemos a geolocalização. CEP e Nominatim dependem dela.
  const geo = await lookupGeo(ip);

  if (!geo.data) {
    return NextResponse.json(
      { error: "Não foi possível obter dados públicos de geolocalização para este IP." },
      { status: 502 }
    );
  }

  // CEP e reverse geocoding podem falhar independentemente.
  const [cep, reverse] = await Promise.all([
    lookupCep(geo.data.zip),
    reverseGeocode(geo.data.lat, geo.data.lon),
  ]);

  const result = consolidate(ip, geo, cep, reverse);

  cache.set(ip, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return NextResponse.json(result);
}
