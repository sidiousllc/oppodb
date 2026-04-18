import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Senate LDA (Lobbying Disclosure Act) sync — paginates through ALL filings for the
// requested year (or all years if year=all). No artificial cap.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year") ?? String(new Date().getFullYear());
    const years: string[] =
      yearParam === "all"
        ? Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i)) // last 12 years
        : [yearParam];

    // Hard cap to keep one invocation safe; cron loops will catch up the rest.
    const maxPages = parseInt(url.searchParams.get("max_pages") ?? "200");
    const pageSize = 100; // LDA API hard maximum

    let upserted = 0;
    let totalSeen = 0;
    const perYear: Record<string, { pages: number; upserted: number; total: number }> = {};

    for (const year of years) {
      let next: string | null =
        `https://lda.senate.gov/api/v1/filings/?filing_year=${year}&page_size=${pageSize}`;
      let pages = 0;
      let yUp = 0;
      let yTotal = 0;

      while (next && pages < maxPages) {
        // Rate-limit-aware fetch with exponential backoff (LDA throttles aggressively)
        let resp: Response | null = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          resp = await fetch(next, {
            headers: { Accept: "application/json", "User-Agent": "ORO-OppoDB/1.0" },
          });
          if (resp.status !== 429 && resp.status !== 503) break;
          const retryAfter = Number(resp.headers.get("Retry-After")) || 0;
          const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1000 * 2 ** attempt);
          console.warn(`LDA ${year} p${pages + 1} ${resp.status} → wait ${wait}ms (attempt ${attempt + 1})`);
          await new Promise((r) => setTimeout(r, wait));
        }
        if (!resp || !resp.ok) {
          console.error(`LDA ${year} page ${pages + 1} → ${resp?.status ?? "no-response"} (giving up year)`);
          break;
        }
        // Gentle pacing between successful requests to stay under LDA limit
        await new Promise((r) => setTimeout(r, 350));
        const data: { results?: any[]; next?: string | null } = await resp.json();
        const filings = data.results ?? [];
        yTotal += filings.length;

        if (filings.length) {
          const rows = filings.map((f: any) => ({
            filing_uuid: f.filing_uuid,
            registrant_name: f.registrant?.name ?? "Unknown",
            client_name: f.client?.name,
            filing_year: f.filing_year,
            filing_period: f.filing_period_display ?? f.filing_period,
            amount: f.income ? Number(f.income) : f.expenses ? Number(f.expenses) : null,
            issues:
              f.lobbying_activities?.map((a: any) => a.general_issue_code_display).filter(Boolean) ??
              [],
            lobbyists:
              f.lobbying_activities
                ?.flatMap((a: any) => a.lobbyists ?? [])
                .map((l: any) =>
                  `${l.lobbyist?.first_name ?? ""} ${l.lobbyist?.last_name ?? ""}`.trim(),
                )
                .filter(Boolean) ?? [],
            govt_entities:
              f.lobbying_activities
                ?.flatMap((a: any) => a.government_entities ?? [])
                .map((g: any) => g.name)
                .filter(Boolean) ?? [],
            filing_date: f.dt_posted?.split("T")[0],
            source_url: f.url,
            raw_data: f,
          }));
          // Upsert in chunks of 100 (Supabase row limit guard)
          for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            const { error, count } = await supabase
              .from("lobbying_disclosures")
              .upsert(chunk, { onConflict: "filing_uuid", count: "exact" });
            if (error) console.error(`Upsert err ${year}:`, error.message);
            else yUp += count ?? chunk.length;
          }
        }

        next = data.next ?? null;
        pages++;
      }

      perYear[year] = { pages, upserted: yUp, total: yTotal };
      upserted += yUp;
      totalSeen += yTotal;
      console.log(`LDA ${year}: ${pages} pages, ${yTotal} filings, ${yUp} upserted`);
    }

    return new Response(
      JSON.stringify({ success: true, upserted, total: totalSeen, years: perYear }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("lobbying-sync error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
