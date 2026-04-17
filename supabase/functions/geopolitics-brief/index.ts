import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";
const STALE_AFTER_DAYS = 30;

interface AllianceEntry {
  name: string;
  type: string;
  status: string;
  notes?: string;
}
interface ConflictEntry {
  party: string;
  type: string;
  status: string;
  since?: string;
  notes?: string;
}
interface BriefShape {
  summary: string;
  alliances_blocs: AllianceEntry[];
  key_allies: string[];
  rivalries_conflicts: ConflictEntry[];
  sanctions_imposed: string[];
  sanctions_received: string[];
  military: {
    spending_usd_billions?: number | null;
    spending_pct_gdp?: number | null;
    active_personnel?: number | null;
    nuclear_status?: string;
    foreign_bases_hosted?: string[];
    foreign_bases_abroad?: string[];
    sipri_arms_export_rank?: number | null;
    notes?: string;
  };
  trade: {
    top_export_partners: { country: string; share_pct?: number | null }[];
    top_import_partners: { country: string; share_pct?: number | null }[];
    top_exports: string[];
    top_imports: string[];
    free_trade_agreements: string[];
    notes?: string;
  };
  geopolitical_posture: string;
  sources: { title: string; url: string }[];
}

const TOOL = {
  type: "function",
  function: {
    name: "emit_geopolitical_brief",
    description: "Return a structured geopolitical brief for a country.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-4 sentence overview of geopolitical posture" },
        alliances_blocs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "e.g. NATO, EU, BRICS, ASEAN, AU, Commonwealth, OAS" },
              type: { type: "string", description: "military, economic, political, regional" },
              status: { type: "string", description: "member, observer, partner, applicant, suspended" },
              notes: { type: "string" },
            },
            required: ["name", "type", "status"],
          },
        },
        key_allies: {
          type: "array",
          items: { type: "string" },
          description: "Country names of closest strategic allies",
        },
        rivalries_conflicts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              party: { type: "string", description: "Adversary country or non-state actor" },
              type: { type: "string", description: "active war, frozen conflict, border dispute, diplomatic, cyber, economic" },
              status: { type: "string", description: "active, frozen, dormant, resolved" },
              since: { type: "string" },
              notes: { type: "string" },
            },
            required: ["party", "type", "status"],
          },
        },
        sanctions_imposed: { type: "array", items: { type: "string" }, description: "Targets of this country's sanctions" },
        sanctions_received: { type: "array", items: { type: "string" }, description: "Sources of sanctions against this country" },
        military: {
          type: "object",
          properties: {
            spending_usd_billions: { type: "number" },
            spending_pct_gdp: { type: "number" },
            active_personnel: { type: "number" },
            nuclear_status: { type: "string", description: "nuclear-armed, non-nuclear, hosts nuclear weapons, suspected program" },
            foreign_bases_hosted: { type: "array", items: { type: "string" } },
            foreign_bases_abroad: { type: "array", items: { type: "string" } },
            sipri_arms_export_rank: { type: "number" },
            notes: { type: "string" },
          },
        },
        trade: {
          type: "object",
          properties: {
            top_export_partners: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  country: { type: "string" },
                  share_pct: { type: "number" },
                },
                required: ["country"],
              },
            },
            top_import_partners: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  country: { type: "string" },
                  share_pct: { type: "number" },
                },
                required: ["country"],
              },
            },
            top_exports: { type: "array", items: { type: "string" } },
            top_imports: { type: "array", items: { type: "string" } },
            free_trade_agreements: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
        },
        geopolitical_posture: {
          type: "string",
          description: "Aligned bloc / non-aligned / contested. 1-2 sentences.",
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
            },
            required: ["title", "url"],
          },
          description: "Authoritative sources: CIA World Factbook, SIPRI, Wikipedia, World Bank, IISS Military Balance, ACLED, Council on Foreign Relations, IMF, WTO, government MFA pages, etc. Provide as many as possible.",
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
        "trade",
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
      return new Response(
        JSON.stringify({ error: "country_code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Look up existing profile + cached brief
    const { data: existing } = await supabase
      .from("international_profiles")
      .select("country_code, country_name, continent, region, geopolitics, geopolitics_generated_at")
      .eq("country_code", countryCode)
      .maybeSingle();

    if (!force && existing?.geopolitics && Object.keys(existing.geopolitics).length > 0 && !isStale(existing.geopolitics_generated_at)) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          country_code: countryCode,
          geopolitics: existing.geopolitics,
          generated_at: existing.geopolitics_generated_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch live country context from REST Countries (free, no key)
    let countryName = existing?.country_name || countryCode;
    let liveContext = "";
    try {
      const rcRes = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=name,capital,region,subregion,population,area,borders,currencies,languages,unMember,independent`);
      if (rcRes.ok) {
        const rc = await rcRes.json();
        countryName = rc.name?.common || countryName;
        liveContext = `Live REST Countries facts: capital=${rc.capital?.[0] || "?"}, region=${rc.region || "?"}, subregion=${rc.subregion || "?"}, population=${rc.population || "?"}, land borders=${(rc.borders || []).join(",") || "none"}, UN member=${rc.unMember}, independent=${rc.independent}.`;
      }
    } catch (e) {
      console.warn("REST Countries lookup failed:", e);
    }

    // 3. Call Lovable AI with structured tool to produce the brief
    const systemPrompt = `You are a senior geopolitical analyst. Produce an accurate, current, deeply-sourced geopolitical brief on the requested country. Use facts as of late 2024. Include as many distinct authoritative sources as possible (aim for 8-15): CIA World Factbook, SIPRI, IISS Military Balance, Wikipedia, World Bank, IMF, WTO, ACLED, Council on Foreign Relations, the country's own MFA/MoD, NATO/EU/AU/ASEAN official sites, Reuters/AP/BBC country pages. Be specific with alliance memberships, named conflicts/disputes, named trade partners with share percentages where known, and named sanctions programs (e.g., "OFAC SDN list", "EU restrictive measures against Russia", "UN Security Council 1737"). Never invent sources — only list real, well-known ones with plausible URLs.`;

    const userPrompt = `Country: ${countryName} (ISO ${countryCode}).
${liveContext}

Produce the structured geopolitical brief by calling the emit_geopolitical_brief tool. Cover allies & blocs, rivalries & conflicts, military posture, and trade in depth. Provide 8+ sources.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
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
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${aiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(aiData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not return a structured brief" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let brief: BriefShape;
    try {
      brief = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse brief JSON:", e);
      return new Response(
        JSON.stringify({ error: "AI returned malformed brief" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Persist
    const generatedAt = new Date().toISOString();
    if (existing) {
      await supabase
        .from("international_profiles")
        .update({
          geopolitics: brief,
          geopolitics_generated_at: generatedAt,
          geopolitics_model: MODEL,
          updated_at: generatedAt,
        })
        .eq("country_code", countryCode);
    } else {
      await supabase
        .from("international_profiles")
        .insert({
          country_code: countryCode,
          country_name: countryName,
          continent: "Unknown",
          geopolitics: brief,
          geopolitics_generated_at: generatedAt,
          geopolitics_model: MODEL,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        country_code: countryCode,
        geopolitics: brief,
        generated_at: generatedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("geopolitics-brief error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
