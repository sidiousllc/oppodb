import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CourtResult {
  id: string;
  source: "courtlistener" | "judyrecords" | "cached";
  case_name: string;
  case_number?: string | null;
  court?: string | null;
  jurisdiction?: string | null; // "federal" | "state"
  state?: string | null;
  filed_date?: string | null;
  status?: string | null;
  judge?: string | null;
  nature_of_suit?: string | null;
  parties?: any[];
  snippet?: string | null;
  docket_url?: string | null;
  documents?: { name: string; url: string; type?: string }[];
  raw?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let q = url.searchParams.get("q") || "";
    let scope = (url.searchParams.get("scope") || "all").toLowerCase(); // all|federal|state
    let stateFilter = (url.searchParams.get("state") || "").toLowerCase();
    let detailId = url.searchParams.get("id");
    let detailSource = url.searchParams.get("source");

    if (req.method === "POST") {
      try {
        const body = await req.json();
        q = body.q ?? q;
        scope = (body.scope ?? scope).toLowerCase();
        stateFilter = (body.state ?? stateFilter).toLowerCase();
        detailId = body.id ?? detailId;
        detailSource = body.source ?? detailSource;
      } catch (_) { /* ignore */ }
    }

    // ---- DETAIL MODE ----
    if (detailId && detailSource) {
      if (detailSource === "courtlistener") {
        const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "ORO-OppoDB/1.0" };
        const tok = Deno.env.get("COURTLISTENER_TOKEN");
        if (tok) headers.Authorization = `Token ${tok}`;
      const r = await fetch(`https://www.courtlistener.com/api/rest/v4/dockets/${encodeURIComponent(detailId)}/`, { headers });
        if (!r.ok) {
          const isAuth = r.status === 401 || r.status === 403;
          return new Response(
            JSON.stringify({
              error: isAuth ? "COURTLISTENER_AUTH_REQUIRED" : `CourtListener ${r.status}`,
              message: isAuth
                ? "CourtListener requires a valid API token. Set the COURTLISTENER_TOKEN secret to enable federal case detail lookups."
                : `Upstream error ${r.status}`,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const d = await r.json();
        // Try to fetch a few docket entries / documents
        let documents: { name: string; url: string; type?: string }[] = [];
        try {
          const er = await fetch(
            `https://www.courtlistener.com/api/rest/v4/docket-entries/?docket=${encodeURIComponent(detailId)}&page_size=20`,
            { headers }
          );
          if (er.ok) {
            const ed = await er.json();
            for (const entry of ed.results ?? []) {
              const desc = entry.description || `Entry #${entry.entry_number ?? "?"}`;
              const recapDocs = entry.recap_documents || [];
              for (const doc of recapDocs) {
                if (doc.filepath_local || doc.filepath_ia) {
                  documents.push({
                    name: `${desc} ${doc.document_number ? `(Doc ${doc.document_number})` : ""}`.trim(),
                    url: doc.filepath_local
                      ? `https://www.courtlistener.com${doc.filepath_local.startsWith("/") ? "" : "/"}${doc.filepath_local}`
                      : doc.filepath_ia,
                    type: "PDF",
                  });
                } else if (doc.absolute_url) {
                  documents.push({
                    name: desc,
                    url: `https://www.courtlistener.com${doc.absolute_url}`,
                    type: "Page",
                  });
                }
              }
            }
          }
        } catch (_) { /* best effort */ }

        const result: CourtResult = {
          id: String(d.id),
          source: "courtlistener",
          case_name: d.case_name || d.case_name_full || "Untitled",
          case_number: d.docket_number,
          court: d.court_id || d.court,
          jurisdiction: "federal",
          filed_date: d.date_filed,
          nature_of_suit: d.nature_of_suit,
          judge: d.assigned_to_str,
          status: d.date_terminated ? "Terminated" : "Open",
          docket_url: d.absolute_url ? `https://www.courtlistener.com${d.absolute_url}` : null,
          parties: d.parties ?? [],
          documents,
          raw: d,
        };
        return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (detailSource === "cached") {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data, error } = await supabase.from("court_cases").select("*").eq("id", detailId).maybeSingle();
        if (error || !data) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const result: CourtResult = {
          id: data.id,
          source: "cached",
          case_name: data.case_name,
          case_number: data.case_number,
          court: data.court,
          jurisdiction: (data.court || "").toLowerCase().includes("state") ? "state" : "federal",
          filed_date: data.filed_date,
          nature_of_suit: data.nature_of_suit,
          judge: data.judge,
          status: data.status,
          docket_url: data.docket_url,
          parties: Array.isArray(data.parties) ? data.parties : [],
          raw: data.raw_data,
        };
        return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ---- SEARCH MODE ----
    if (!q.trim()) {
      return new Response(JSON.stringify({ error: "Missing q parameter" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: CourtResult[] = [];
    const errors: { source: string; message: string }[] = [];

    // -------- Federal: CourtListener --------
    if (scope === "all" || scope === "federal") {
      try {
        const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "ORO-OppoDB/1.0" };
        const tok = Deno.env.get("COURTLISTENER_TOKEN");
        if (tok) headers.Authorization = `Token ${tok}`;
        const apiUrl = `https://www.courtlistener.com/api/rest/v4/search/?type=r&q=${encodeURIComponent(q)}&order_by=dateFiled+desc`;
        const r = await fetch(apiUrl, { headers });
        if (r.ok) {
          const data = await r.json();
          for (const item of (data.results ?? []).slice(0, 25)) {
            results.push({
              id: String(item.docket_id ?? item.id),
              source: "courtlistener",
              case_name: item.caseName ?? item.case_name ?? "Untitled",
              case_number: item.docketNumber,
              court: item.court ?? item.court_id ?? null,
              jurisdiction: "federal",
              filed_date: item.dateFiled,
              nature_of_suit: item.suitNature,
              judge: item.judge,
              status: item.status,
              parties: Array.isArray(item.party) ? item.party : [],
              snippet: item.snippet || (Array.isArray(item.text) ? item.text[0] : null),
              docket_url: item.absolute_url ? `https://www.courtlistener.com${item.absolute_url}` : null,
              raw: item,
            });
          }
        } else {
          errors.push({ source: "courtlistener", message: `HTTP ${r.status}` });
        }
      } catch (e: any) {
        errors.push({ source: "courtlistener", message: e?.message ?? "fetch failed" });
      }
    }

    // -------- State: JudyRecords (HTML scrape, best-effort) --------
    if (scope === "all" || scope === "state") {
      try {
        const judyUrl = `https://www.judyrecords.com/search?q=${encodeURIComponent(q)}${stateFilter ? `+state%3A${encodeURIComponent(stateFilter)}` : ""}`;
        const r = await fetch(judyUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ORO-OppoDB/1.0)",
            Accept: "text/html",
          },
        });
        if (r.ok) {
          const html = await r.text();
          // Lightweight regex extraction — JudyRecords result cards
          const cardRegex = /<a[^>]+href="(\/case\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          let count = 0;
          while ((match = cardRegex.exec(html)) !== null && count < 25) {
            const href = match[1];
            const inner = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (!inner || inner.length < 4) continue;
            // Try to split: "Case Name • Court • Date"
            const parts = inner.split(/[•\|]/).map((s) => s.trim());
            const caseName = parts[0]?.slice(0, 200) || inner.slice(0, 120);
            const court = parts[1] ?? null;
            const dateMaybe = parts.find((p) => /\d{4}/.test(p)) ?? null;
            const slug = href.replace(/^\/case\//, "").split("/")[0];
            results.push({
              id: `jr-${slug}`,
              source: "judyrecords",
              case_name: caseName,
              court,
              jurisdiction: "state",
              state: stateFilter || null,
              filed_date: dateMaybe,
              snippet: inner.slice(0, 240),
              docket_url: `https://www.judyrecords.com${href}`,
              raw: { href, text: inner },
            });
            count++;
          }
        } else {
          errors.push({ source: "judyrecords", message: `HTTP ${r.status}` });
        }
      } catch (e: any) {
        errors.push({ source: "judyrecords", message: e?.message ?? "fetch failed" });
      }
    }

    // -------- Cached cases (already-synced) --------
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await supabase
        .from("court_cases")
        .select("*")
        .or(`case_name.ilike.%${q.replace(/[%_]/g, "")}%,case_number.ilike.%${q.replace(/[%_]/g, "")}%,judge.ilike.%${q.replace(/[%_]/g, "")}%`)
        .order("filed_date", { ascending: false })
        .limit(15);
      for (const c of data ?? []) {
        results.push({
          id: c.id,
          source: "cached",
          case_name: c.case_name,
          case_number: c.case_number,
          court: c.court,
          jurisdiction: (c.court || "").toLowerCase().includes("state") ? "state" : "federal",
          filed_date: c.filed_date,
          nature_of_suit: c.nature_of_suit,
          judge: c.judge,
          status: c.status,
          parties: Array.isArray(c.parties) ? c.parties : [],
          docket_url: c.docket_url,
          raw: c.raw_data,
        });
      }
    } catch (_) { /* optional */ }

    return new Response(
      JSON.stringify({ success: true, count: results.length, results, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
