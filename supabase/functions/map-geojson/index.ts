const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MapSource = "esri" | "census";

const SOURCE_URLS: Record<MapSource, string[]> = {
  esri: [
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_119th_Congressional_Districts/FeatureServer/0/query?where=1%3D1&outFields=STATE_ABBR%2CCDFIPS%2CDISTRICTID%2CNAME%2CCD119FP%2CCD118FP%2CSTATE%2CSTUSAB&f=geojson&outSR=4326&returnGeometry=true&maxAllowableOffset=0.01&resultRecordCount=500",
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_118th_Congressional_Districts/FeatureServer/0/query?where=1%3D1&outFields=STATE_ABBR%2CCDFIPS%2CDISTRICTID%2CNAME%2CCD119FP%2CCD118FP%2CSTATE%2CSTUSAB&f=geojson&outSR=4326&returnGeometry=true&maxAllowableOffset=0.01&resultRecordCount=500",
  ],
  census: [
    "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2024/Legislative/MapServer/0/query?where=1%3D1&outFields=STATE%2CSTATEFP%2CCD118FP%2CCD119FP%2CGEOID%2CBASENAME%2CSTUSAB&f=geojson&outSR=4326&returnGeometry=true&maxAllowableOffset=0.01&resultRecordCount=500",
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query?where=1%3D1&outFields=STATE%2CSTATEFP%2CCD118FP%2CCD119FP%2CGEOID%2CBASENAME%2CSTUSAB&f=geojson&outSR=4326&returnGeometry=true&maxAllowableOffset=0.01&resultRecordCount=500",
  ],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const source = body?.source as MapSource | undefined;

    if (!source || !(source in SOURCE_URLS)) {
      return json({ error: "source must be 'esri' or 'census'" }, 400);
    }

    const attempts: Array<{ url: string; status?: number; error?: string }> = [];

    for (const url of SOURCE_URLS[source]) {
      try {
        const response = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Lovable Map Loader/1.0",
          },
          signal: AbortSignal.timeout(15000),
        });

        attempts.push({ url, status: response.status });
        if (!response.ok) continue;

        const data = await response.json();
        if (data?.error || !Array.isArray(data?.features) || data.features.length === 0) {
          continue;
        }

        return json({
          ...data,
          meta: {
            proxied: true,
            source,
            upstream: url,
          },
        });
      } catch (error) {
        attempts.push({
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json({ error: `All ${source} map sources failed`, attempts }, 502);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
