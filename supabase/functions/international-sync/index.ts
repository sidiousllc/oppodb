import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Map ISO codes to our continent/region taxonomy
const COUNTRY_META: Record<string, { continent: string; region: string }> = {
  US:{continent:"North America",region:"Northern America"},CA:{continent:"North America",region:"Northern America"},
  MX:{continent:"North America",region:"Central America"},GT:{continent:"North America",region:"Central America"},
  HN:{continent:"North America",region:"Central America"},SV:{continent:"North America",region:"Central America"},
  NI:{continent:"North America",region:"Central America"},CR:{continent:"North America",region:"Central America"},
  PA:{continent:"North America",region:"Central America"},BZ:{continent:"North America",region:"Central America"},
  CU:{continent:"North America",region:"Caribbean"},JM:{continent:"North America",region:"Caribbean"},
  HT:{continent:"North America",region:"Caribbean"},DO:{continent:"North America",region:"Caribbean"},
  TT:{continent:"North America",region:"Caribbean"},BS:{continent:"North America",region:"Caribbean"},
  BB:{continent:"North America",region:"Caribbean"},PR:{continent:"North America",region:"Caribbean"},
  BR:{continent:"South America",region:"South America"},AR:{continent:"South America",region:"South America"},
  CO:{continent:"South America",region:"South America"},CL:{continent:"South America",region:"South America"},
  PE:{continent:"South America",region:"South America"},VE:{continent:"South America",region:"South America"},
  EC:{continent:"South America",region:"South America"},BO:{continent:"South America",region:"South America"},
  PY:{continent:"South America",region:"South America"},UY:{continent:"South America",region:"South America"},
  GY:{continent:"South America",region:"South America"},SR:{continent:"South America",region:"South America"},
  GB:{continent:"Europe",region:"Western Europe"},FR:{continent:"Europe",region:"Western Europe"},
  DE:{continent:"Europe",region:"Western Europe"},IT:{continent:"Europe",region:"Southern Europe"},
  ES:{continent:"Europe",region:"Southern Europe"},PT:{continent:"Europe",region:"Southern Europe"},
  NL:{continent:"Europe",region:"Western Europe"},BE:{continent:"Europe",region:"Western Europe"},
  AT:{continent:"Europe",region:"Western Europe"},CH:{continent:"Europe",region:"Western Europe"},
  SE:{continent:"Europe",region:"Northern Europe"},NO:{continent:"Europe",region:"Northern Europe"},
  DK:{continent:"Europe",region:"Northern Europe"},FI:{continent:"Europe",region:"Northern Europe"},
  IE:{continent:"Europe",region:"Northern Europe"},PL:{continent:"Europe",region:"Eastern Europe"},
  CZ:{continent:"Europe",region:"Eastern Europe"},RO:{continent:"Europe",region:"Eastern Europe"},
  HU:{continent:"Europe",region:"Eastern Europe"},GR:{continent:"Europe",region:"Southern Europe"},
  BG:{continent:"Europe",region:"Eastern Europe"},HR:{continent:"Europe",region:"Southern Europe"},
  SK:{continent:"Europe",region:"Eastern Europe"},SI:{continent:"Europe",region:"Southern Europe"},
  LT:{continent:"Europe",region:"Northern Europe"},LV:{continent:"Europe",region:"Northern Europe"},
  EE:{continent:"Europe",region:"Northern Europe"},CY:{continent:"Europe",region:"Southern Europe"},
  LU:{continent:"Europe",region:"Western Europe"},MT:{continent:"Europe",region:"Southern Europe"},
  UA:{continent:"Europe",region:"Eastern Europe"},RS:{continent:"Europe",region:"Southern Europe"},
  BA:{continent:"Europe",region:"Southern Europe"},ME:{continent:"Europe",region:"Southern Europe"},
  MK:{continent:"Europe",region:"Southern Europe"},AL:{continent:"Europe",region:"Southern Europe"},
  MD:{continent:"Europe",region:"Eastern Europe"},IS:{continent:"Europe",region:"Northern Europe"},
  TR:{continent:"Europe",region:"Southern Europe"},RU:{continent:"Europe",region:"Eastern Europe"},
  BY:{continent:"Europe",region:"Eastern Europe"},GE:{continent:"Europe",region:"Eastern Europe"},
  CN:{continent:"Asia",region:"East Asia"},JP:{continent:"Asia",region:"East Asia"},
  KR:{continent:"Asia",region:"East Asia"},KP:{continent:"Asia",region:"East Asia"},
  IN:{continent:"Asia",region:"South Asia"},PK:{continent:"Asia",region:"South Asia"},
  BD:{continent:"Asia",region:"South Asia"},LK:{continent:"Asia",region:"South Asia"},
  NP:{continent:"Asia",region:"South Asia"},ID:{continent:"Asia",region:"Southeast Asia"},
  TH:{continent:"Asia",region:"Southeast Asia"},VN:{continent:"Asia",region:"Southeast Asia"},
  PH:{continent:"Asia",region:"Southeast Asia"},MY:{continent:"Asia",region:"Southeast Asia"},
  SG:{continent:"Asia",region:"Southeast Asia"},MM:{continent:"Asia",region:"Southeast Asia"},
  KH:{continent:"Asia",region:"Southeast Asia"},LA:{continent:"Asia",region:"Southeast Asia"},
  TW:{continent:"Asia",region:"East Asia"},MN:{continent:"Asia",region:"East Asia"},
  SA:{continent:"Asia",region:"Middle East"},AE:{continent:"Asia",region:"Middle East"},
  IL:{continent:"Asia",region:"Middle East"},IR:{continent:"Asia",region:"Middle East"},
  IQ:{continent:"Asia",region:"Middle East"},AF:{continent:"Asia",region:"Central Asia"},
  KZ:{continent:"Asia",region:"Central Asia"},UZ:{continent:"Asia",region:"Central Asia"},
  QA:{continent:"Asia",region:"Middle East"},KW:{continent:"Asia",region:"Middle East"},
  OM:{continent:"Asia",region:"Middle East"},BH:{continent:"Asia",region:"Middle East"},
  JO:{continent:"Asia",region:"Middle East"},LB:{continent:"Asia",region:"Middle East"},
  SY:{continent:"Asia",region:"Middle East"},YE:{continent:"Asia",region:"Middle East"},
  ZA:{continent:"Africa",region:"Southern Africa"},NG:{continent:"Africa",region:"West Africa"},
  EG:{continent:"Africa",region:"North Africa"},KE:{continent:"Africa",region:"East Africa"},
  ET:{continent:"Africa",region:"East Africa"},GH:{continent:"Africa",region:"West Africa"},
  TZ:{continent:"Africa",region:"East Africa"},DZ:{continent:"Africa",region:"North Africa"},
  MA:{continent:"Africa",region:"North Africa"},TN:{continent:"Africa",region:"North Africa"},
  SN:{continent:"Africa",region:"West Africa"},CI:{continent:"Africa",region:"West Africa"},
  CM:{continent:"Africa",region:"Central Africa"},UG:{continent:"Africa",region:"East Africa"},
  RW:{continent:"Africa",region:"East Africa"},CD:{continent:"Africa",region:"Central Africa"},
  AO:{continent:"Africa",region:"Southern Africa"},MZ:{continent:"Africa",region:"Southern Africa"},
  LY:{continent:"Africa",region:"North Africa"},SD:{continent:"Africa",region:"North Africa"},
  AU:{continent:"Oceania",region:"Oceania"},NZ:{continent:"Oceania",region:"Oceania"},
  FJ:{continent:"Oceania",region:"Oceania"},PG:{continent:"Oceania",region:"Oceania"},
};

const ALL_CODES = Object.keys(COUNTRY_META);

async function syncOneCountry(
  supabase: any,
  code: string,
): Promise<{ code: string; ok: boolean; error?: string }> {
  try {
    const meta = COUNTRY_META[code];
    if (!meta) return { code, ok: false, error: "unknown code" };

    const profile: Record<string, any> = {
      country_code: code,
      continent: meta.continent,
      region: meta.region,
      updated_at: new Date().toISOString(),
      tags: [
        `continent:${meta.continent}`,
        `region:${meta.region}`,
        `country:${code}`,
      ],
    };

    // World Bank indicators
    const indicators = [
      { id: "SP.POP.TOTL", field: "population" },
      { id: "SP.POP.65UP.TO.ZS", field: "median_age" }, // % 65+ as proxy
      { id: "NY.GDP.MKTP.CD", field: "gdp" },
      { id: "NY.GDP.PCAP.CD", field: "gdp_per_capita" },
      { id: "SL.UEM.TOTL.ZS", field: "unemployment_rate" },
      { id: "SI.POV.NAHC", field: "poverty_rate" },
      { id: "FP.CPI.TOTL.ZG", field: "inflation_rate" },
    ];

    const wbResults = await Promise.allSettled(
      indicators.map(async (ind) => {
        const url = `https://api.worldbank.org/v2/country/${code}/indicator/${ind.id}?format=json&date=2018:2024&per_page=7`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.[1]?.length) return null;
        const entry = data[1].find((d: any) => d.value != null);
        return entry ? { field: ind.field, value: entry.value } : null;
      })
    );

    for (const result of wbResults) {
      if (result.status === "fulfilled" && result.value) {
        profile[result.value.field] = result.value.value;
      }
    }

    // REST Countries API - comprehensive fields
    try {
      const rcRes = await fetch(
        `https://restcountries.com/v3.1/alpha/${code}?fields=name,capital,currencies,languages,area,region,subregion,demonyms,population,gini,borders,timezones,continents,flags,coatOfArms,maps`
      );
      if (rcRes.ok) {
        const rc = await rcRes.json();
        profile.country_name = rc.name?.common || code;
        profile.capital = rc.capital?.[0] || null;
        profile.area_sq_km = rc.area || null;
        // Prefer WB population but fallback to RC
        if (!profile.population && rc.population) {
          profile.population = rc.population;
        }
        if (rc.currencies) {
          const curr = Object.values(rc.currencies)[0] as any;
          profile.currency = curr?.name
            ? `${curr.name} (${curr.symbol || ""})`
            : null;
        }
        if (rc.languages) {
          profile.official_languages = Object.values(rc.languages);
        }
      }
    } catch (e) {
      console.error(`REST Countries error for ${code}:`, e);
    }

    // Ensure country_name is set
    if (!profile.country_name) {
      profile.country_name = code;
    }

    const { error } = await supabase
      .from("international_profiles")
      .upsert(profile, { onConflict: "country_code" });

    if (error) {
      console.error(`Upsert error for ${code}:`, error);
      return { code, ok: false, error: error.message };
    }

    return { code, ok: true };
  } catch (e: any) {
    return { code, ok: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { country_code, batch, codes } = body;

    // Batch mode: sync a list of codes or all
    if (batch === true || batch === "all" || (Array.isArray(codes) && codes.length > 0)) {
      const toSync = Array.isArray(codes) ? codes.map((c: string) => c.toUpperCase()).filter((c: string) => COUNTRY_META[c]) : ALL_CODES;
      console.log(`Batch syncing ${toSync.length} countries...`);

      // Process in chunks of 5 to avoid rate limits
      const chunkSize = 5;
      const results: { code: string; ok: boolean; error?: string }[] = [];

      for (let i = 0; i < toSync.length; i += chunkSize) {
        const chunk = toSync.slice(i, i + chunkSize);
        const chunkResults = await Promise.allSettled(
          chunk.map((c: string) => syncOneCountry(supabase, c))
        );
        for (const r of chunkResults) {
          if (r.status === "fulfilled") results.push(r.value);
          else results.push({ code: "?", ok: false, error: String(r.reason) });
        }
        if (i + chunkSize < toSync.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      return new Response(
        JSON.stringify({
          success: true,
          total: toSync.length,
          succeeded,
          failed: failed.length,
          errors: failed.slice(0, 20),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single country mode
    if (!country_code) {
      return new Response(
        JSON.stringify({ error: "country_code or batch=true is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await syncOneCountry(supabase, country_code.toUpperCase());

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("International sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
