import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";
const STALE_AFTER_DAYS = 30;

const TOOL = {
  type: "function",
  function: {
    name: "emit_geopolitical_brief",
    description: "Return a deeply-sourced structured geopolitical, economic, and market brief for a country.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "3-5 sentence overview of geopolitical posture and current standing" },
        alliances_blocs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "e.g. NATO, EU, BRICS, ASEAN, AU, Commonwealth, OAS, SCO, GCC, OPEC, Mercosur, OECD" },
              type: { type: "string", description: "military, economic, political, regional, intelligence" },
              status: { type: "string", description: "member, observer, partner, applicant, suspended, dialogue partner" },
              joined: { type: "string", description: "Year joined" },
              notes: { type: "string" },
            },
            required: ["name", "type", "status"],
          },
        },
        key_allies: { type: "array", items: { type: "string" }, description: "8-15 closest strategic allies with brief context" },
        rivalries_conflicts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              party: { type: "string" },
              type: { type: "string", description: "active war, frozen conflict, border dispute, diplomatic, cyber, economic, proxy" },
              status: { type: "string", description: "active, frozen, dormant, resolved, escalating" },
              since: { type: "string" },
              notes: { type: "string" },
            },
            required: ["party", "type", "status"],
          },
        },
        sanctions_imposed: { type: "array", items: { type: "string" } },
        sanctions_received: { type: "array", items: { type: "string" } },
        intelligence_agencies: {
          type: "array",
          items: { type: "string" },
          description: "Major intelligence/security services (CIA, MI6, Mossad, FSB, MSS, etc.)",
        },
        military: {
          type: "object",
          properties: {
            spending_usd_billions: { type: "number" },
            spending_pct_gdp: { type: "number" },
            active_personnel: { type: "number" },
            reserve_personnel: { type: "number" },
            paramilitary: { type: "number" },
            nuclear_status: { type: "string" },
            nuclear_warheads: { type: "number" },
            foreign_bases_hosted: { type: "array", items: { type: "string" } },
            foreign_bases_abroad: { type: "array", items: { type: "string" } },
            sipri_arms_export_rank: { type: "number" },
            sipri_arms_import_rank: { type: "number" },
            global_firepower_rank: { type: "number" },
            notes: { type: "string" },
          },
        },
        economy: {
          type: "object",
          properties: {
            gdp_nominal_usd_billions: { type: "number" },
            gdp_ppp_usd_billions: { type: "number" },
            gdp_growth_pct: { type: "number" },
            inflation_pct: { type: "number" },
            unemployment_pct: { type: "number" },
            public_debt_pct_gdp: { type: "number" },
            fx_reserves_usd_billions: { type: "number" },
            sovereign_credit_rating_sp: { type: "string" },
            sovereign_credit_rating_moodys: { type: "string" },
            sovereign_credit_rating_fitch: { type: "string" },
            currency_code: { type: "string" },
            currency_regime: { type: "string", description: "floating, pegged, managed, dollarized, etc." },
            central_bank: { type: "string" },
            policy_rate_pct: { type: "number" },
            notes: { type: "string" },
          },
        },
        stock_markets: {
          type: "array",
          description: "Major stock exchanges in this country with their flagship indices and notes on size, sectors, and recent performance.",
          items: {
            type: "object",
            properties: {
              exchange_name: { type: "string", description: "e.g. New York Stock Exchange, Nasdaq, London Stock Exchange, Tokyo Stock Exchange, Shanghai Stock Exchange" },
              ticker_or_mic: { type: "string", description: "MIC code or common ticker (XNYS, XNAS, XLON, XTKS, XSHG)" },
              flagship_index: { type: "string", description: "S&P 500, FTSE 100, Nikkei 225, SSE Composite, etc." },
              listed_companies: { type: "number" },
              market_cap_usd_billions: { type: "number" },
              top_listed_companies: { type: "array", items: { type: "string" } },
              regulator: { type: "string", description: "SEC, FCA, JFSA, CSRC, etc." },
              notes: { type: "string", description: "Sector concentration, recent trend, foreign ownership rules" },
            },
            required: ["exchange_name"],
          },
        },
        sovereign_wealth_funds: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              aum_usd_billions: { type: "number" },
              notes: { type: "string" },
            },
            required: ["name"],
          },
        },
        trade: {
          type: "object",
          properties: {
            total_exports_usd_billions: { type: "number" },
            total_imports_usd_billions: { type: "number" },
            trade_balance_usd_billions: { type: "number" },
            top_export_partners: { type: "array", items: { type: "object", properties: { country: { type: "string" }, share_pct: { type: "number" } }, required: ["country"] } },
            top_import_partners: { type: "array", items: { type: "object", properties: { country: { type: "string" }, share_pct: { type: "number" } }, required: ["country"] } },
            top_exports: { type: "array", items: { type: "string" } },
            top_imports: { type: "array", items: { type: "string" } },
            free_trade_agreements: { type: "array", items: { type: "string" } },
            wto_member: { type: "boolean" },
            notes: { type: "string" },
          },
        },
        energy_resources: {
          type: "object",
          properties: {
            oil_production_bpd: { type: "number", description: "Barrels per day" },
            oil_reserves_billion_bbl: { type: "number" },
            natural_gas_reserves_tcm: { type: "number", description: "Trillion cubic meters" },
            energy_mix: { type: "string", description: "Dominant fuels: coal, gas, nuclear, renewables, etc." },
            opec_member: { type: "boolean" },
            critical_minerals: { type: "array", items: { type: "string" }, description: "Lithium, rare earths, cobalt, uranium, etc." },
            notes: { type: "string" },
          },
        },
        soft_power: {
          type: "object",
          properties: {
            global_soft_power_rank: { type: "number" },
            press_freedom_rank: { type: "number" },
            corruption_perception_rank: { type: "number" },
            democracy_index_score: { type: "number" },
            unhdi_rank: { type: "number", description: "UN Human Development Index rank" },
            notes: { type: "string" },
          },
        },
        geopolitical_posture: { type: "string", description: "Aligned bloc / non-aligned / contested. 2-3 sentences." },
        sources: {
          type: "array",
          description: "Aim for 15-25 distinct authoritative sources with real URLs.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              category: { type: "string", description: "encyclopedia, government, intl_org, think_tank, market_data, news, ngo" },
            },
            required: ["title", "url"],
          },
        },
      },
      required: [
        "summary",
        "alliances_blocs",
        "key_allies",
        "rivalries_conflicts",
        "sanctions_imposed",
        "sanctions_received",
        "military",
        "economy",
        "stock_markets",
        "trade",
        "energy_resources",
        "soft_power",
        "geopolitical_posture",
        "sources",
      ],
    },
  },
};

function isStale(generatedAt: string | null): boolean {
  if (!generatedAt) return true;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

async function safeFetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ORO-Geopolitics/1.0 (lovable.app)" } });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

async function safeFetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ORO-Geopolitics/1.0 (lovable.app)" } });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch (_) { return null; }
}

async function gatherLiveContext(countryCode: string, countryName: string): Promise<string> {
  const lines: string[] = [];

  // 1. REST Countries
  const rc = await safeFetchJson(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=name,capital,region,subregion,population,area,borders,currencies,languages,unMember,independent,demonyms,timezones,car`);
  if (rc) {
    lines.push(`REST Countries: capital=${rc.capital?.[0] ?? "?"}, region=${rc.region}, subregion=${rc.subregion}, population=${rc.population}, area_km2=${rc.area}, borders=${(rc.borders || []).join(",") || "none"}, languages=${Object.values(rc.languages || {}).join(",")}, currencies=${Object.keys(rc.currencies || {}).join(",")}, UN=${rc.unMember}, independent=${rc.independent}.`);
  }

  // 2. Wikipedia summary
  const wikiTitle = encodeURIComponent(countryName.replace(/\s+/g, "_"));
  const wiki = await safeFetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`);
  if (wiki?.extract) {
    lines.push(`Wikipedia summary: ${String(wiki.extract).slice(0, 800)}`);
  }

  // 3. World Bank quick indicators (GDP, population, inflation)
  const wbIndicators: Array<[string, string]> = [
    ["NY.GDP.MKTP.CD", "GDP_USD"],
    ["NY.GDP.MKTP.KD.ZG", "GDP_growth_pct"],
    ["FP.CPI.TOTL.ZG", "Inflation_pct"],
    ["SL.UEM.TOTL.ZS", "Unemployment_pct"],
    ["GC.DOD.TOTL.GD.ZS", "Public_debt_pct_GDP"],
    ["MS.MIL.XPND.GD.ZS", "Mil_spend_pct_GDP"],
    ["MS.MIL.TOTL.P1", "Active_military_personnel"],
  ];
  const wbResults = await Promise.all(wbIndicators.map(async ([code, label]) => {
    const j = await safeFetchJson(`https://api.worldbank.org/v2/country/${countryCode}/indicator/${code}?format=json&date=2018:2024&per_page=10`);
    const entry = j?.[1]?.find((d: any) => d?.value != null);
    return entry ? `${label}=${entry.value} (${entry.date})` : null;
  }));
  const wbLine = wbResults.filter(Boolean).join("; ");
  if (wbLine) lines.push(`World Bank: ${wbLine}.`);

  // 4. Wikidata Q-id + a few useful claims (head of state via P35, currency P38, member of P463)
  const wd = await safeFetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${wikiTitle}&props=claims|labels&languages=en&format=json&origin=*`);
  if (wd?.entities) {
    const ent: any = Object.values(wd.entities)[0];
    const memberships = (ent?.claims?.P463 || []).length;
    const allies = (ent?.claims?.P530 || []).length; // diplomatic relations
    if (memberships || allies) lines.push(`Wikidata: ${memberships} organization memberships listed, ${allies} diplomatic relations claimed.`);
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const countryCode: string | undefined = body.country_code?.toUpperCase();
    const force: boolean = body.force === true;

    if (!countryCode) {
      return new Response(JSON.stringify({ error: "country_code is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("international_profiles")
      .select("country_code, country_name, continent, region, geopolitics, geopolitics_generated_at")
      .eq("country_code", countryCode)
      .maybeSingle();

    if (!force && existing?.geopolitics && Object.keys(existing.geopolitics).length > 0 && !isStale(existing.geopolitics_generated_at)) {
      return new Response(JSON.stringify({
        success: true, cached: true, country_code: countryCode,
        geopolitics: existing.geopolitics, generated_at: existing.geopolitics_generated_at,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let countryName = existing?.country_name || countryCode;
    // Try to refine country name via REST Countries before gathering context
    const rcQuick = await safeFetchJson(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=name`);
    if (rcQuick?.name?.common) countryName = rcQuick.name.common;

    const liveContext = await gatherLiveContext(countryCode, countryName);

    const systemPrompt = `You are a senior geopolitical and financial analyst. Produce an accurate, current, deeply-sourced brief on the requested country covering geopolitics, military, macroeconomy, stock markets, trade, energy, and soft power. Use facts as of late 2024 / early 2025.

CITATION RULES:
- Aim for 15-25 distinct authoritative sources with REAL URLs only — never fabricate.
- Strongly prefer: Wikipedia (en.wikipedia.org), CIA World Factbook (cia.gov/the-world-factbook), SIPRI (sipri.org), IISS Military Balance (iiss.org), World Bank (data.worldbank.org), IMF (imf.org), WTO (wto.org), OECD (oecd.org), UN Comtrade (comtrade.un.org), ACLED (acleddata.com), Council on Foreign Relations (cfr.org), Reuters/AP/BBC country pages, the country's official MFA/MoD/central bank, Trading Economics, Statista country pages, World Federation of Exchanges (world-exchanges.org), Bloomberg/Reuters market profiles, NATO/EU/AU/ASEAN/BRICS official pages, Transparency International (transparency.org), Reporters Without Borders (rsf.org), EIU Democracy Index, UNDP HDI, S&P/Moody's/Fitch sovereign rating pages.
- For stock markets, cite the exchange's own site (e.g., nyse.com, nasdaq.com, londonstockexchange.com, jpx.co.jp, sse.com.cn, bseindia.com, b3.com.br, jse.co.za).
- For each section be specific: name alliances with status & year joined, name conflicts/disputes & dates, name trade partners with share %, name flagship indices & approximate market cap.
- If a country has no domestic stock exchange, set stock_markets to an empty array and note this in trade.notes or economy.notes.

Output ONLY by calling the emit_geopolitical_brief tool.`;

    const userPrompt = `Country: ${countryName} (ISO ${countryCode}).

LIVE CONTEXT (verified facts pulled just now from open APIs — use as ground truth, don't contradict):
${liveContext || "(no live context available — rely on training data)"}

Produce the structured geopolitical & financial brief by calling emit_geopolitical_brief. Cover all required fields with depth. Provide 15+ real sources.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_geopolitical_brief" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error: ${aiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(aiData).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return a structured brief" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let brief: any;
    try {
      brief = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse brief JSON:", e);
      return new Response(JSON.stringify({ error: "AI returned malformed brief" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const generatedAt = new Date().toISOString();
    if (existing) {
      await supabase.from("international_profiles").update({
        geopolitics: brief, geopolitics_generated_at: generatedAt, geopolitics_model: MODEL, updated_at: generatedAt,
      }).eq("country_code", countryCode);
    } else {
      await supabase.from("international_profiles").insert({
        country_code: countryCode, country_name: countryName, continent: "Unknown",
        geopolitics: brief, geopolitics_generated_at: generatedAt, geopolitics_model: MODEL,
      });
    }

    return new Response(JSON.stringify({
      success: true, cached: false, country_code: countryCode,
      geopolitics: brief, generated_at: generatedAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("geopolitics-brief error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
