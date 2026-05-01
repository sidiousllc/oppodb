import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getErrorMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { country_code } = await req.json().catch(() => ({ country_code: null }));

    if (!country_code) {
      return new Response(
        JSON.stringify({ error: "country_code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = country_code.toUpperCase();
    console.log(`Syncing international data for ${code}`);

    // Fetch from World Bank API (free, no key needed)
    const indicators = [
      { id: "SP.POP.TOTL", field: "population" },
      { id: "SP.POP.TOTL.MA.ZS", field: "median_age" }, // not exact, placeholder
      { id: "NY.GDP.MKTP.CD", field: "gdp" },
      { id: "NY.GDP.PCAP.CD", field: "gdp_per_capita" },
      { id: "SL.UEM.TOTL.ZS", field: "unemployment_rate" },
      { id: "SI.POV.NAHC", field: "poverty_rate" },
      { id: "FP.CPI.TOTL.ZG", field: "inflation_rate" },
    ];

    const profile: Record<string, any> = {
      country_code: code,
      updated_at: new Date().toISOString(),
    };

    // Fetch World Bank indicators in parallel
    const wbResults = await Promise.allSettled(
      indicators.map(async (ind) => {
        const url = `https://api.worldbank.org/v2/country/${code}/indicator/${ind.id}?format=json&date=2020:2024&per_page=5`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data[1] || data[1].length === 0) return null;
        // Get the most recent non-null value
        const entry = data[1].find((d: any) => d.value != null);
        if (entry) {
          return { field: ind.field, value: entry.value };
        }
        return null;
      })
    );

    for (const result of wbResults) {
      if (result.status === "fulfilled" && result.value) {
        profile[result.value.field] = result.value.value;
      }
    }

    // Fetch country info from REST Countries API
    try {
      const rcRes = await fetch(`https://restcountries.com/v3.1/alpha/${code}?fields=name,capital,currencies,languages,area,flag,government,region,subregion`);
      if (rcRes.ok) {
        const rc = await rcRes.json();
        profile.country_name = rc.name?.common || code;
        profile.capital = rc.capital?.[0] || null;
        profile.area_sq_km = rc.area || null;
        if (rc.currencies) {
          const curr = Object.values(rc.currencies)[0] as any;
          profile.currency = curr?.name ? `${curr.name} (${curr.symbol || ""})` : null;
        }
        if (rc.languages) {
          profile.official_languages = Object.values(rc.languages);
        }
        // Continent mapping
        if (rc.region) {
          profile.continent = rc.region === "Americas"
            ? (rc.subregion?.includes("South") ? "South America" : "North America")
            : rc.region;
          profile.region = rc.subregion || rc.region;
        }
      }
    } catch (e) {
      console.error("REST Countries error:", e);
    }

    // Ensure NOT NULL continent always has a value
    if (!profile.continent) profile.continent = "Unknown";

    // Upsert profile
    const { error: profileError } = await supabase
      .from("international_profiles")
      .upsert(profile, { onConflict: "country_code" });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        country_code: code,
        fields_updated: Object.keys(profile).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("International sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
