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

// ============================================================
// EXPANSION HANDLERS
// ============================================================

async function gravatar(query: string) {
  const email = query.trim().toLowerCase();
  const buf = new TextEncoder().encode(email);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const r = await fetch(`https://api.gravatar.com/v3/profiles/${hash}`, { headers: { Accept: "application/json" } });
  if (r.status === 404) return { results: [{ title: email, snippet: "No public Gravatar profile found." }] };
  if (!r.ok) throw new Error(`Gravatar ${r.status}`);
  const d = await r.json();
  return { results: [{
    title: d.display_name || email,
    subtitle: [d.job_title, d.company, d.location].filter(Boolean).join(" · ") || "Gravatar profile",
    snippet: `${d.description || ""}\n\nVerified: ${(d.verified_accounts || []).map((a: any) => a.service_label).join(", ") || "—"}\nLinks: ${(d.links || []).map((l: any) => l.url).join(", ") || "—"}`,
    source_url: d.profile_url,
  }] };
}

async function github_user(query: string) {
  const u = encodeURIComponent(query.replace(/^@/, ""));
  const [pr, rr, or] = await Promise.all([
    fetch(`https://api.github.com/users/${u}`, { headers: { Accept: "application/vnd.github+json" } }),
    fetch(`https://api.github.com/users/${u}/repos?per_page=10&sort=updated`, { headers: { Accept: "application/vnd.github+json" } }),
    fetch(`https://api.github.com/users/${u}/orgs`, { headers: { Accept: "application/vnd.github+json" } }),
  ]);
  if (pr.status === 404) return { results: [{ title: query, snippet: "GitHub user not found" }] };
  if (!pr.ok) throw new Error(`GitHub ${pr.status}`);
  const p = await pr.json();
  const repos = rr.ok ? await rr.json() : [];
  const orgs = or.ok ? await or.json() : [];
  return { results: [{
    title: `${p.name || p.login} (@${p.login})`,
    subtitle: `${p.public_repos} repos · ${p.followers} followers · joined ${p.created_at?.slice(0, 10)}`,
    snippet: `${p.bio || ""}\nCompany: ${p.company || "—"} · Location: ${p.location || "—"} · Email: ${p.email || "—"}\nOrgs: ${orgs.map((o: any) => o.login).join(", ") || "—"}\n\nTop repos:\n${repos.slice(0, 8).map((r: any) => `• ${r.name} (★${r.stargazers_count}) ${r.description ?? ""}`).join("\n")}`,
    source_url: p.html_url,
  }] };
}

async function reddit_user(query: string) {
  const u = encodeURIComponent(query.replace(/^\/?u\//, ""));
  const [ar, cr] = await Promise.all([
    fetch(`https://www.reddit.com/user/${u}/about.json`, { headers: { "user-agent": "ORO-OSINT/1.0" } }),
    fetch(`https://www.reddit.com/user/${u}.json?limit=15`, { headers: { "user-agent": "ORO-OSINT/1.0" } }),
  ]);
  if (ar.status === 404) return { results: [{ title: query, snippet: "Reddit user not found" }] };
  if (!ar.ok) throw new Error(`Reddit ${ar.status}`);
  const about = (await ar.json()).data;
  const acts = cr.ok ? ((await cr.json()).data?.children ?? []) : [];
  const created = new Date(about.created_utc * 1000).toISOString().slice(0, 10);
  return { results: [{
    title: `u/${about.name}`,
    subtitle: `${about.total_karma?.toLocaleString()} karma · joined ${created}${about.is_gold ? " · Premium" : ""}${about.verified ? " · ✓verified" : ""}`,
    snippet: `Comment karma: ${about.comment_karma?.toLocaleString()} · Post karma: ${about.link_karma?.toLocaleString()}\n\nRecent activity:\n${acts.slice(0, 10).map((a: any) => `• r/${a.data.subreddit} — ${(a.data.title || a.data.body || "").slice(0, 100)}`).join("\n")}`,
    source_url: `https://www.reddit.com/user/${u}`,
  }] };
}

async function ip_geo(query: string) {
  const ip = encodeURIComponent(query.trim());
  const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`);
  if (!r.ok) throw new Error(`ip-api ${r.status}`);
  const d = await r.json();
  if (d.status !== "success") return { results: [{ title: query, snippet: d.message || "Lookup failed" }] };
  return { results: [{
    title: `${d.query} — ${d.city}, ${d.regionName}, ${d.countryCode}`,
    subtitle: `${d.isp} · ${d.as}`,
    snippet: `Org: ${d.org || "—"}\nReverse DNS: ${d.reverse || "—"}\nLat/Lon: ${d.lat}, ${d.lon} · TZ: ${d.timezone}\nFlags: ${[d.mobile && "mobile", d.proxy && "proxy/VPN", d.hosting && "datacenter"].filter(Boolean).join(", ") || "none"}`,
    source_url: `https://ipinfo.io/${d.query}`,
  }] };
}

async function opensanctions(query: string) {
  const r = await fetch(`https://api.opensanctions.org/search/default?q=${encodeURIComponent(query)}&limit=20`);
  if (!r.ok) throw new Error(`OpenSanctions ${r.status}`);
  const d = await r.json();
  return { results: (d?.results ?? []).map((e: any) => ({
    title: e.caption || e.id,
    subtitle: `${e.schema} · datasets: ${(e.datasets || []).slice(0, 3).join(", ")}`,
    snippet: `Topics: ${(e.properties?.topics || []).join(", ") || "—"}\nCountries: ${(e.properties?.country || []).join(", ") || "—"}\nFirst seen: ${e.first_seen ?? "—"} · Last seen: ${e.last_seen ?? "—"}`,
    source_url: `https://www.opensanctions.org/entities/${e.id}/`,
  })) };
}

async function usaspending(query: string) {
  const r = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { recipient_search_text: [query], award_type_codes: ["A", "B", "C", "D"], time_period: [{ start_date: "2008-10-01", end_date: new Date().toISOString().slice(0, 10) }] },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Award Type", "Period of Performance Start Date", "Period of Performance Current End Date", "Description"],
      page: 1, limit: 20, sort: "Award Amount", order: "desc",
    }),
  });
  if (!r.ok) throw new Error(`USAspending ${r.status}`);
  const d = await r.json();
  return { results: (d?.results ?? []).map((a: any) => ({
    title: `$${(a["Award Amount"] || 0).toLocaleString()} — ${a["Recipient Name"]}`,
    subtitle: `${a["Awarding Agency"]} · ${a["Award Type"]} · ${a["Period of Performance Start Date"]} → ${a["Period of Performance Current End Date"]}`,
    snippet: (a.Description || "").slice(0, 400),
    source_url: `https://www.usaspending.gov/award/${encodeURIComponent(a["Award ID"] || a.generated_internal_id || "")}`,
  })) };
}

async function irs_990(query: string) {
  const r = await fetch(`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error(`ProPublica ${r.status}`);
  const d = await r.json();
  return { results: (d?.organizations ?? []).slice(0, 20).map((o: any) => ({
    title: o.name,
    subtitle: `EIN ${o.ein} · ${o.city}, ${o.state} · NTEE ${o.ntee_code ?? "—"}`,
    snippet: `Sub-section: ${o.subseccd ?? "—"}\nRuling year: ${o.ruling_date ?? "—"}\nClassification: ${o.classification_codes ?? "—"}`,
    source_url: `https://projects.propublica.org/nonprofits/organizations/${o.ein}`,
  })) };
}

async function crtsh(query: string) {
  const domain = query.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const r = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`);
  if (!r.ok) throw new Error(`crt.sh ${r.status}`);
  const rows = await r.json();
  const subs = new Set<string>();
  for (const row of rows) {
    for (const n of String(row.name_value || "").split("\n")) {
      const s = n.trim().toLowerCase();
      if (s && !s.includes("*")) subs.add(s);
    }
  }
  const list = Array.from(subs).sort();
  return { results: [{
    title: `${domain} — ${list.length} unique subdomains`,
    subtitle: `Sourced from ${rows.length} certificate transparency log entries`,
    snippet: list.slice(0, 100).map((s) => `• ${s}`).join("\n"),
    source_url: `https://crt.sh/?q=%25.${encodeURIComponent(domain)}`,
  }] };
}

async function urlscan(query: string) {
  const q = encodeURIComponent(`domain:${query.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`);
  const r = await fetch(`https://urlscan.io/api/v1/search/?q=${q}&size=20`);
  if (!r.ok) throw new Error(`URLScan ${r.status}`);
  const d = await r.json();
  return { results: (d?.results ?? []).map((s: any) => ({
    title: s.page?.url || s.task?.url,
    subtitle: `${s.page?.country ?? "—"} · ${s.page?.server ?? ""} · scanned ${s.task?.time?.slice(0, 10)}`,
    snippet: `IP: ${s.page?.ip ?? "—"} · ASN: ${s.page?.asn ?? "—"} · ${s.page?.asnname ?? ""}\nTitle: ${s.page?.title ?? "—"}`,
    source_url: s.result,
  })) };
}

async function virustotal(query: string, key: string | null) {
  if (!key) throw new Error("VirusTotal API key required");
  const q = query.trim();
  let path: string;
  if (/^[A-Fa-f0-9]{32}$|^[A-Fa-f0-9]{40}$|^[A-Fa-f0-9]{64}$/.test(q)) path = `files/${q}`;
  else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(q)) path = `ip_addresses/${q}`;
  else if (q.startsWith("http")) {
    const id = btoa(q).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    path = `urls/${id}`;
  } else path = `domains/${q.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
  const r = await fetch(`https://www.virustotal.com/api/v3/${path}`, { headers: { "x-apikey": key } });
  if (r.status === 404) return { results: [{ title: q, snippet: "Not found in VirusTotal" }] };
  if (!r.ok) throw new Error(`VirusTotal ${r.status}`);
  const d = (await r.json())?.data;
  const stats = d?.attributes?.last_analysis_stats || {};
  return { results: [{
    title: `${q} — VT report`,
    subtitle: `Detections: ${stats.malicious ?? 0} malicious · ${stats.suspicious ?? 0} suspicious · ${stats.harmless ?? 0} clean`,
    snippet: `Reputation: ${d?.attributes?.reputation ?? "—"}\nLast analysis: ${d?.attributes?.last_analysis_date ? new Date(d.attributes.last_analysis_date * 1000).toISOString() : "—"}`,
    source_url: `https://www.virustotal.com/gui/search/${encodeURIComponent(q)}`,
  }] };
}

async function abuseipdb(query: string, key: string | null) {
  if (!key) throw new Error("AbuseIPDB API key required");
  const r = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(query)}&maxAgeInDays=90&verbose=true`, { headers: { Key: key, Accept: "application/json" } });
  if (!r.ok) throw new Error(`AbuseIPDB ${r.status}`);
  const d = (await r.json())?.data;
  if (!d) return { results: [{ title: query, snippet: "No data" }] };
  return { results: [{
    title: `${d.ipAddress} — abuse score ${d.abuseConfidenceScore}/100`,
    subtitle: `${d.countryCode} · ${d.isp} · ${d.usageType}`,
    snippet: `Reports: ${d.totalReports} from ${d.numDistinctUsers} users · last reported: ${d.lastReportedAt ?? "—"}\nDomain: ${d.domain ?? "—"} · Tor: ${d.isTor} · Whitelisted: ${d.isWhitelisted}`,
    source_url: `https://www.abuseipdb.com/check/${encodeURIComponent(d.ipAddress)}`,
  }] };
}

async function wayback_cdx(query: string) {
  const domain = query.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*&output=json&fl=original&collapse=urlkey&limit=200`);
  if (!r.ok) throw new Error(`Wayback CDX ${r.status}`);
  const rows = await r.json();
  const urls = (rows as string[][]).slice(1).map(([u]) => u);
  return { results: [{
    title: `${domain} — ${urls.length} unique captured URLs`,
    subtitle: "Sourced from Wayback Machine CDX index",
    snippet: urls.slice(0, 150).map((u) => `• ${u}`).join("\n"),
    source_url: `https://web.archive.org/web/*/${encodeURIComponent(domain)}/*`,
  }] };
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
  // Expansion batch
  gravatar: (q) => gravatar(q),
  github_user: (q) => github_user(q),
  reddit_user: (q) => reddit_user(q),
  ip_geo: (q) => ip_geo(q),
  opensanctions: (q) => opensanctions(q),
  usaspending: (q) => usaspending(q),
  irs_990: (q) => irs_990(q),
  crtsh: (q) => crtsh(q),
  urlscan: (q) => urlscan(q),
  virustotal: (q, k) => virustotal(q, k),
  abuseipdb: (q, k) => abuseipdb(q, k),
  wayback_cdx: (q) => wayback_cdx(q),
};

const KEY_SERVICE: Record<string, string> = {
  email_breach: "hibp",
  phone_lookup: "numverify",
  opencorporates: "opencorporates",
  sam_exclusion: "sam_gov",
  whois_dns: "securitytrails",
  virustotal: "virustotal",
  abuseipdb: "abuseipdb",
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
