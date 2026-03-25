import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json();
    const { service, action, params } = body;

    if (!service || !action) {
      return new Response(JSON.stringify({ error: "service and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's integration credentials using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integration, error: intError } = await serviceClient
      .from("user_integrations")
      .select("api_key, slug, is_active")
      .eq("user_id", userId)
      .eq("service", service)
      .single();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: `No ${service} integration configured. Add your API key in Profile → Integrations.` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integration.is_active) {
      return new Response(
        JSON.stringify({ error: `${service} integration is disabled.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = integration.api_key;
    const slug = integration.slug || "";

    let result: any;

    switch (service) {
      case "nationbuilder":
        result = await proxyNationBuilder(apiKey, slug, action, params || {});
        break;
      case "van":
        result = await proxyVAN(apiKey, action, params || {});
        break;
      case "winred":
        result = await proxyWinRed(apiKey, action, params || {});
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown service: ${service}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Integration proxy error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- NationBuilder ---
async function proxyNationBuilder(apiKey: string, slug: string, action: string, params: any) {
  const base = `https://${slug}.nationbuilder.com/api/v1`;
  const headers = { "Content-Type": "application/json" };

  switch (action) {
    case "search_people": {
      const url = new URL(`${base}/people/search`);
      url.searchParams.set("access_token", apiKey);
      if (params.first_name) url.searchParams.set("first_name", params.first_name);
      if (params.last_name) url.searchParams.set("last_name", params.last_name);
      if (params.email) url.searchParams.set("email", params.email);
      if (params.city) url.searchParams.set("city", params.city);
      if (params.state) url.searchParams.set("state", params.state);
      const resp = await fetch(url.toString(), { headers });
      if (!resp.ok) throw new Error(`NationBuilder API error: ${resp.status}`);
      return await resp.json();
    }
    case "get_person": {
      const url = `${base}/people/${params.id}?access_token=${apiKey}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`NationBuilder API error: ${resp.status}`);
      return await resp.json();
    }
    case "test": {
      const url = `${base}/people?access_token=${apiKey}&limit=1`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`NationBuilder API error: ${resp.status} - check your API key and slug`);
      return { connected: true, message: "NationBuilder connected successfully" };
    }
    default:
      throw new Error(`Unknown NationBuilder action: ${action}`);
  }
}

// --- VAN / EveryAction ---
async function proxyVAN(apiKey: string, action: string, params: any) {
  // VAN uses application key | api key format
  // API key format: applicationName|apiKey
  const base = "https://api.securevan.com/v4";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Basic ${btoa(`${apiKey}`)}`,
  };

  switch (action) {
    case "find_people": {
      const body: any = {};
      if (params.first_name) body.firstName = params.first_name;
      if (params.last_name) body.lastName = params.last_name;
      if (params.phone) body.phoneNumber = params.phone;
      if (params.email) body.email = params.email;
      if (params.zip) body.zipOrPostalCode = params.zip;
      if (params.state) body.stateOrProvince = params.state;
      const resp = await fetch(`${base}/people/find`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`VAN API error: ${resp.status}`);
      return await resp.json();
    }
    case "get_person": {
      const resp = await fetch(`${base}/people/${params.van_id}?$expand=phones,emails,addresses`, { headers });
      if (!resp.ok) throw new Error(`VAN API error: ${resp.status}`);
      return await resp.json();
    }
    case "test": {
      const resp = await fetch(`${base}/people/find`, {
        method: "POST",
        headers,
        body: JSON.stringify({ firstName: "Test", lastName: "Connection" }),
      });
      if (!resp.ok) throw new Error(`VAN API error: ${resp.status} - check your API key`);
      return { connected: true, message: "VAN/EveryAction connected successfully" };
    }
    default:
      throw new Error(`Unknown VAN action: ${action}`);
  }
}

// --- WinRed ---
async function proxyWinRed(apiKey: string, action: string, params: any) {
  const base = "https://api.winred.com/api/v1";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  switch (action) {
    case "search_donors": {
      const url = new URL(`${base}/donors`);
      if (params.email) url.searchParams.set("email", params.email);
      if (params.first_name) url.searchParams.set("first_name", params.first_name);
      if (params.last_name) url.searchParams.set("last_name", params.last_name);
      if (params.state) url.searchParams.set("state", params.state);
      const resp = await fetch(url.toString(), { headers });
      if (!resp.ok) throw new Error(`WinRed API error: ${resp.status}`);
      return await resp.json();
    }
    case "get_donations": {
      const url = new URL(`${base}/donations`);
      if (params.donor_id) url.searchParams.set("donor_id", params.donor_id);
      if (params.start_date) url.searchParams.set("start_date", params.start_date);
      if (params.end_date) url.searchParams.set("end_date", params.end_date);
      const resp = await fetch(url.toString(), { headers });
      if (!resp.ok) throw new Error(`WinRed API error: ${resp.status}`);
      return await resp.json();
    }
    case "test": {
      const resp = await fetch(`${base}/donors?limit=1`, { headers });
      if (!resp.ok) throw new Error(`WinRed API error: ${resp.status} - check your API key`);
      return { connected: true, message: "WinRed connected successfully" };
    }
    default:
      throw new Error(`Unknown WinRed action: ${action}`);
  }
}
