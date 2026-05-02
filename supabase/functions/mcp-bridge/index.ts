// MCP Bridge — authenticated proxy that lets the in-app UI list and invoke MCP tools.
// Two modes:
//   1. Built-in: forwards JSON-RPC to this project's mcp-server using the
//      service role + the caller's user session (verified premium/admin).
//   2. Custom:   forwards to an arbitrary MCP Streamable HTTP endpoint with
//      user-supplied URL + key (never persisted server-side here).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-mcp-server-url, x-mcp-server-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

async function callStreamableHttp(
  url: string,
  headers: Record<string, string>,
  body: JsonRpcRequest,
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const ct = res.headers.get("content-type") ?? "";
  let payload: unknown;
  if (ct.includes("text/event-stream")) {
    // Parse a single SSE message — mcp-lite returns one JSON-RPC response per stream.
    const text = await res.text();
    const dataLine = text
      .split("\n")
      .find((l) => l.startsWith("data:"));
    payload = dataLine ? JSON.parse(dataLine.slice(5).trim()) : { error: "empty stream" };
  } else {
    payload = await res.json().catch(() => ({ error: "invalid json" }));
  }
  return new Response(JSON.stringify(payload), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Authenticate the caller via Supabase JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userRes.user.id;

  // 2. Authorize: premium OR admin role.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r) => r === "admin" || r === "premium")) {
    return new Response(
      JSON.stringify({ error: "Premium or admin role required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 3. Parse body.
  let body: { mode?: "builtin" | "custom"; rpc?: JsonRpcRequest };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const mode = body.mode ?? "builtin";
  const rpc = body.rpc;
  if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return new Response(JSON.stringify({ error: "Missing or invalid rpc payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (mode === "custom") {
    const url = req.headers.get("x-mcp-server-url") ?? "";
    const key = req.headers.get("x-mcp-server-key") ?? "";
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing x-mcp-server-url header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const headers: Record<string, string> = {};
    if (key) {
      headers["X-API-Key"] = key;
      headers["Authorization"] = `Bearer ${key}`;
    }
    try {
      return await callStreamableHttp(url, headers, rpc);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: `Upstream MCP error: ${msg}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Built-in mode: call this project's mcp-server using a service-issued API key.
  // We mint a temporary in-memory key by calling validate_api_key isn't possible —
  // instead we expose tools/list and tools/call via direct McpServer invocation
  // by routing to /functions/v1/mcp-server with a server-side stored key.
  const builtinKey = Deno.env.get("MCP_BRIDGE_BUILTIN_KEY") ?? "";
  if (!builtinKey) {
    return new Response(
      JSON.stringify({
        error:
          "Built-in MCP not configured. Set MCP_BRIDGE_BUILTIN_KEY secret to a valid API key for this project.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const builtinUrl = `${SUPABASE_URL}/functions/v1/mcp-server`;
  try {
    return await callStreamableHttp(
      builtinUrl,
      { "X-API-Key": builtinKey, apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      rpc,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Built-in MCP error: ${msg}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
