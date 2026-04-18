/**
 * Unified OSINT search edge function — backs every "edge" tool in
 * src/data/osintTools.ts. Each handler returns `{ results: [...] }` where
 * each result row uses the conventional fields read by ResultRow in
 * OSINTToolPanel: title/name, subtitle/location/date, snippet/description,
 * source_url/url, and any tool-specific extras (platforms[], etc.).
 *
 * API keys (when required) are read from public.user_integrations and
 * decrypted via the same AES-256-GCM scheme as credential-vault.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- AES-256-GCM decrypt (mirror of credential-vault) ---
async function getKey(): Promise<CryptoKey> {
  const hex = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");
  if (!hex || hex.length !== 64) throw new Error("INTEGRATION_ENCRYPTION_KEY misconfigured");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
}
async function decrypt(enc: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

async function userKey(svc: any, userId: string, service: string): Promise<string | null> {
  const { data } = await svc.from("user_integrations").select("api_key").eq("user_id", userId).eq("service", service).eq("is_active", true).maybeSingle();
  if (!data?.api_key) return null;
  try { return await decrypt(data.api_key); } catch { return null; }
}

// ============================================================
// HANDLERS
// ============================================================

async function username_search(query: string) {
  // WhatsMyName public registry (no key)
  const reg = await fetch("https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json").then((r) => r.json()).catch(() => null);
  if (!reg?.sites) return { results: [{ title: query, subtitle: "registry unavailable", snippet: "Could not load WhatsMyName registry; showing direct profile guesses for top sites.", platforms: ["github", "twitter", "reddit", "instagram", "tiktok", "youtube", "twitch"], source_url: `https://github.com/${encodeURIComponent(query)}` }] };
  const sites = reg.sites.filter((s: any) => s.cat !== "porn").slice(0, 80);
  const checks = await Promise.all(sites.map(async (s: any) => {
    const url = s.uri_check.replace("{account}", encodeURIComponent(query));
    try {
      const r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(4000) });
      if (r.status === (s.e_code ?? 200)) {
        const text = await r.text().catch(() => "");
        if (s.e_string && !text.includes(s.e_string)) return null;
        if (s.m_string && text.includes(s.m_string)) return null;
        return { name: s.name, url };
      }
    } catch { /* swallow */ }
    return null;
  }));
  const found = checks.filter(Boolean) as { name: string; url: string }[];
  return {
    results: [{
      title: `${query} — found on ${found.length} platforms`,
      subtitle: `Checked ${sites.length} sites · ${found.length} hits`,
      platforms: found.map((f) => f.name),
      snippet: found.slice(0, 30).map((f) => `• ${f.name}: ${f.url}`).join("\n"),
      source_url: `https://whatsmyname.app/?q=${encodeURIComponent(query)}`,
    }],
  };
}

async function email_breach(query: string, key: string | null) {
  if (!key) throw new Error("HIBP API key required");
  const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(query)}?truncateResponse=false`, {
    headers: { "hibp-api-key": key, "user-agent": "ORO-OSINT" },
  });
  if (r.status === 404) return { results: [{ title: query, snippet: "No breaches found 🎉", subtitle: "0 known breaches" }] };
  if (!r.ok) throw new Error(`HIBP ${r.status}`);
  const breaches = await r.json();
  return {
    results: breaches.map((b: any) => ({
      title: b.Title,
      subtitle: `${b.BreachDate} · ${b.PwnCount?.toLocaleString()} accounts`,
      snippet: `${b.Description?.replace(/<[^>]+>/g, "")}\n\nData exposed: ${(b.DataClasses ?? []).join(", ")}`,
      source_url: `https://haveibeenpwned.com/PwnedWebsites#${b.Name}`,
    })),
  };
}

async function phone_lookup(query: string, key: string | null) {
  if (!key) throw new Error("NumVerify API key required");
  const num = query.replace(/[^\d+]/g, "");
  const r = await fetch(`https://apilayer.net/api/validate?access_key=${key}&number=${encodeURIComponent(num)}`);
  const d = await r.json();
  if (!d.valid) return { results: [{ title: query, snippet: "Invalid phone number" }] };
  return { results: [{ title: `${d.international_format} (${d.line_type})`, subtitle: `${d.carrier || "Unknown carrier"} · ${d.country_name} · ${d.location || ""}`, snippet: `Country code: +${d.country_code}\nLine type: ${d.line_type}` }] };
}

async function social_archive(query: string) {
  // Wayback Machine CDX
  const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(query)}&limit=20&output=json&fl=timestamp,original`).catch(() => null);
  if (!r?.ok) return { results: [{ title: query, snippet: "Wayback Machine unavailable" }] };
  const rows = await r.json();
  const snapshots = (rows as string[][]).slice(1).map(([ts, orig]) => ({
    title: `Snapshot ${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
    subtitle: orig,
    source_url: `https://web.archive.org/web/${ts}/${orig}`,
  }));
  return { results: snapshots.length ? snapshots : [{ title: query, snippet: "No archived snapshots found" }] };
}

async function sec_edgar(query: string) {
  const r = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${query}"`)}&dateRange=custom&startdt=2000-01-01&forms=`, {
    headers: { "user-agent": "ORO Research research@example.com" },
  });
  if (!r.ok) throw new Error(`SEC EDGAR ${r.status}`);
  const d = await r.json();
  const hits = (d?.hits?.hits ?? []).slice(0, 20);
  return {
    results: hits.map((h: any) => ({
      title: h._source?.display_names?.[0] ?? h._source?.form ?? "(filing)",
      subtitle: `${h._source?.form} · ${h._source?.file_date} · CIK ${h._source?.ciks?.[0] ?? "—"}`,
      snippet: h._source?.adsh ? `Accession: ${h._source.adsh}` : "",
      source_url: h._source?.adsh ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${h._source.ciks?.[0]}&type=${h._source.form}` : undefined,
    })),
  };
}

async function opencorporates(query: string, key: string | null) {
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&per_page=20${key ? `&api_token=${key}` : ""}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`OpenCorporates ${r.status}`);
  const d = await r.json();
  return {
    results: (d?.results?.companies ?? []).map((c: any) => ({
      title: c.company.name,
      subtitle: `${c.company.jurisdiction_code?.toUpperCase()} · ${c.company.company_type ?? ""} · ${c.company.current_status ?? ""}`,
      snippet: `Reg #: ${c.company.company_number}\nIncorporated: ${c.company.incorporation_date ?? "—"}\nAddress: ${c.company.registered_address_in_full ?? "—"}`,
      source_url: `https://opencorporates.com${c.company.opencorporates_url ?? ""}`,
    })),
  };
}

async function bankruptcy(query: string) {
  const r = await fetch(`https://www.courtlistener.com/api/rest/v3/search/?type=r&q=${encodeURIComponent(query)}&court=__all_bankruptcy__`);
  if (!r.ok) throw new Error(`CourtListener ${r.status}`);
  const d = await r.json();
  return {
    results: (d?.results ?? []).slice(0, 20).map((c: any) => ({
      title: c.caseName,
      subtitle: `${c.court} · ${c.dateFiled ?? ""} · ${c.docketNumber ?? ""}`,
      snippet: c.description ?? c.suitNature ?? "",
      source_url: `https://www.courtlistener.com${c.absolute_url ?? ""}`,
    })),
  };
}

async function sam_exclusion(query: string, key: string | null) {
  if (!key) throw new Error("SAM.gov API key required");
  const r = await fetch(`https://api.sam.gov/entity-information/v3/exclusions?api_key=${key}&exclusionName=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error(`SAM.gov ${r.status}`);
  const d = await r.json();
  return {
    results: (d?.excludedEntity ?? []).slice(0, 20).map((e: any) => ({
      title: e.exclusionDetails?.exclusionName ?? "(entity)",
      subtitle: `${e.exclusionDetails?.classificationType ?? ""} · ${e.exclusionDetails?.exclusionType ?? ""}`,
      snippet: `Agency: ${e.exclusionDetails?.excludingAgencyName}\nActive: ${e.exclusionDetails?.activeDate} → ${e.exclusionDetails?.terminationDate ?? "indefinite"}`,
    })),
  };
}

async function fda_enforcement(query: string) {
  const r = await fetch(`https://api.fda.gov/drug/enforcement.json?search=${encodeURIComponent(`recalling_firm:"${query}"`)}&limit=20`);
  if (!r.ok) return { results: [{ title: query, snippet: "No FDA enforcement actions found" }] };
  const d = await r.json();
  return {
    results: (d?.results ?? []).map((e: any) => ({
      title: e.product_description?.slice(0, 100) ?? "(recall)",
      subtitle: `${e.classification} · ${e.recall_initiation_date} · ${e.status}`,
      snippet: `Reason: ${e.reason_for_recall}\nFirm: ${e.recalling_firm}`,
    })),
  };
}

async function faa_aircraft(query: string) {
  const n = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return { results: [{ title: `N-Number: ${n}`, subtitle: "Open FAA registry to view ownership", snippet: "Click to open FAA Aircraft Registry inquiry for this tail number.", source_url: `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(n)}` }] };
}

async function wayback(query: string) {
  return social_archive(query);
}

async function whois_dns(query: string, key: string | null) {
  const domain = query.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const recs = ["A", "AAAA", "MX", "TXT", "NS"];
  const dns = await Promise.all(recs.map(async (t) => {
    try {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${t}`, { headers: { accept: "application/dns-json" } });
      const d = await r.json();
      return { type: t, answers: (d?.Answer ?? []).map((a: any) => a.data).join(", ") };
    } catch { return { type: t, answers: "—" }; }
  }));
  const dnsBlock = dns.map((r) => `${r.type}: ${r.answers || "—"}`).join("\n");
  let extra = "";
  if (key) {
    try {
      const r = await fetch(`https://api.securitytrails.com/v1/domain/${encodeURIComponent(domain)}/whois`, { headers: { APIKEY: key } });
      if (r.ok) {
        const w = await r.json();
        extra = `\n\nWHOIS: ${w?.registrarName ?? "—"} · created ${w?.createdDate ?? "—"} · expires ${w?.expiresDate ?? "—"}`;
      }
    } catch { /* swallow */ }
  }
  return { results: [{ title: domain, subtitle: "DNS + WHOIS intelligence", snippet: dnsBlock + extra, source_url: `https://whois.domaintools.com/${encodeURIComponent(domain)}` }] };
}

const HANDLERS: Record<string, (q: string, key: string | null) => Promise<any>> = {
  username_search: (q) => username_search(q),
  email_breach: (q, k) => email_breach(q, k),
  phone_lookup: (q, k) => phone_lookup(q, k),
  social_archive: (q) => social_archive(q),
  sec_edgar: (q) => sec_edgar(q),
  opencorporates: (q, k) => opencorporates(q, k),
  bankruptcy: (q) => bankruptcy(q),
  sam_exclusion: (q, k) => sam_exclusion(q, k),
  fda_enforcement: (q) => fda_enforcement(q),
  faa_aircraft: (q) => faa_aircraft(q),
  wayback: (q) => wayback(q),
  whois_dns: (q, k) => whois_dns(q, k),
};

const KEY_SERVICE: Record<string, string> = {
  email_breach: "hibp",
  phone_lookup: "numverify",
  opencorporates: "opencorporates",
  sam_exclusion: "sam_gov",
  whois_dns: "securitytrails",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action, query } = await req.json();
    if (!action || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "action and query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (query.length > 500) {
      return new Response(JSON.stringify({ error: "query too long (max 500)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const handler = HANDLERS[action];
    if (!handler) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let key: string | null = null;
    const svcName = KEY_SERVICE[action];
    if (svcName) {
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      key = await userKey(service, user.id, svcName);
    }

    const out = await handler(query, key);
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("osint-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
