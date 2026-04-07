import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- AES-256-GCM decryption ---
async function getEncryptionKey(): Promise<CryptoKey> {
  const hexKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");
  if (!hexKey || hexKey.length !== 64) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be a 64-char hex string");
  }
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(hexKey.substring(i * 2, i * 2 + 2), 16);
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptValue(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ========== CREDENTIAL MANAGEMENT ==========
    if (action === "save-credentials") {
      const body = await req.json();
      const { platform, api_key, api_secret, passphrase, label } = body;
      if (!platform || !api_key) return json({ error: "platform and api_key required" }, 400);
      if (!["polymarket", "kalshi", "predictit"].includes(platform)) {
        return json({ error: "Invalid platform" }, 400);
      }

      const encKey = await encryptValue(api_key);
      const encSecret = api_secret ? await encryptValue(api_secret) : null;
      const encPass = passphrase ? await encryptValue(passphrase) : null;

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error } = await adminClient.from("user_market_credentials").upsert(
        {
          user_id: userId,
          platform,
          encrypted_key: encKey,
          encrypted_secret: encSecret,
          encrypted_passphrase: encPass,
          label: label || "Default",
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform" }
      );

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, message: `${platform} credentials saved` });
    }

    if (action === "list-credentials") {
      const { data, error } = await supabase
        .from("user_market_credentials")
        .select("id, platform, label, is_active, created_at, updated_at")
        .eq("user_id", userId);

      if (error) return json({ error: error.message }, 500);
      return json({ credentials: data });
    }

    if (action === "delete-credentials") {
      const platform = url.searchParams.get("platform");
      if (!platform) return json({ error: "platform required" }, 400);

      const { error } = await supabase
        .from("user_market_credentials")
        .delete()
        .eq("user_id", userId)
        .eq("platform", platform);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ========== TRADING OPERATIONS ==========
    if (action === "portfolio" || action === "orders" || action === "place-order" || action === "cancel-order") {
      const platform = url.searchParams.get("platform");
      if (!platform) return json({ error: "platform required" }, 400);

      // Fetch & decrypt credentials
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: cred } = await adminClient
        .from("user_market_credentials")
        .select("*")
        .eq("user_id", userId)
        .eq("platform", platform)
        .eq("is_active", true)
        .single();

      if (!cred) return json({ error: `No active ${platform} credentials found` }, 404);

      const apiKey = await decryptValue(cred.encrypted_key);
      const apiSecret = cred.encrypted_secret ? await decryptValue(cred.encrypted_secret) : null;
      const passphrase = cred.encrypted_passphrase ? await decryptValue(cred.encrypted_passphrase) : null;

      // Route to platform-specific handler
      if (platform === "kalshi") {
        return await handleKalshi(action, apiKey, apiSecret, req, url);
      } else if (platform === "polymarket") {
        return await handlePolymarket(action, apiKey, apiSecret, passphrase, req, url);
      } else if (platform === "predictit") {
        return await handlePredictIt(action, apiKey, req, url);
      }
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("market-trading error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

// ========== KALSHI ==========
async function handleKalshi(
  action: string,
  apiKey: string,
  apiSecret: string | null,
  req: Request,
  url: URL
) {
  const baseUrl = "https://api.elections.kalshi.com/trade-api/v2";

  // Login to get token
  const loginResp = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: apiKey, password: apiSecret }),
  });
  const loginData = await loginResp.json();
  if (!loginResp.ok) return json({ error: "Kalshi auth failed", details: loginData }, 401);
  const token = loginData.token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (action === "portfolio") {
    const [posResp, balResp] = await Promise.all([
      fetch(`${baseUrl}/portfolio/positions`, { headers }),
      fetch(`${baseUrl}/portfolio/balance`, { headers }),
    ]);
    const positions = await posResp.json();
    const balance = await balResp.json();
    return json({ positions: positions.market_positions || [], balance });
  }

  if (action === "orders") {
    const resp = await fetch(`${baseUrl}/portfolio/orders`, { headers });
    const data = await resp.json();
    return json({ orders: data.orders || [] });
  }

  if (action === "place-order") {
    const body = await req.json();
    const resp = await fetch(`${baseUrl}/portfolio/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: "Order failed", details: data }, resp.status);

    // Log trade to history
    await logTrade(adminClient, userId, "kalshi", {
      market_id: body.ticker,
      market_title: body.ticker,
      side: `${body.action}_${body.side}`,
      price: body.yes_price ?? body.no_price,
      quantity: body.count,
      total_cost: (body.yes_price ?? body.no_price ?? 0) * (body.count ?? 0),
      order_id: data.order?.order_id,
      status: data.order?.status || "submitted",
      raw_response: data,
    });

    return json({ order: data.order });
  }

  if (action === "cancel-order") {
    const orderId = url.searchParams.get("order_id");
    if (!orderId) return json({ error: "order_id required" }, 400);
    const resp = await fetch(`${baseUrl}/portfolio/orders/${orderId}`, {
      method: "DELETE",
      headers,
    });
    if (!resp.ok) {
      const data = await resp.json();
      return json({ error: "Cancel failed", details: data }, resp.status);
    }
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, 400);
}

// ========== POLYMARKET ==========
async function handlePolymarket(
  action: string,
  apiKey: string,
  _apiSecret: string | null,
  _passphrase: string | null,
  req: Request,
  url: URL
) {
  // Polymarket uses CLOB API
  const baseUrl = "https://clob.polymarket.com";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "POLY_API_KEY": apiKey,
  };

  if (action === "portfolio") {
    // Get open orders as proxy for portfolio
    const resp = await fetch(`${baseUrl}/orders?owner=${apiKey}`, { headers });
    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: "Polymarket portfolio fetch failed", details: text }, resp.status);
    }
    const data = await resp.json();
    return json({ positions: data || [] });
  }

  if (action === "orders") {
    const resp = await fetch(`${baseUrl}/orders?owner=${apiKey}`, { headers });
    const data = await resp.json();
    return json({ orders: data || [] });
  }

  if (action === "place-order") {
    const body = await req.json();
    const resp = await fetch(`${baseUrl}/order`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, owner: apiKey }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: "Order failed", details: data }, resp.status);

    // Log trade to history
    const adminClient2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await logTrade(adminClient2, body._user_id || "", "polymarket", {
      market_id: body.tokenID,
      market_title: body.tokenID,
      side: body.side,
      price: body.price,
      quantity: body.size,
      total_cost: (body.price ?? 0) * (body.size ?? 0),
      order_id: data.orderID || data.id,
      status: "submitted",
      raw_response: data,
    });

    return json({ order: data });
  }

  if (action === "cancel-order") {
    const orderId = url.searchParams.get("order_id");
    if (!orderId) return json({ error: "order_id required" }, 400);
    const resp = await fetch(`${baseUrl}/order/${orderId}`, {
      method: "DELETE",
      headers,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: "Cancel failed", details: text }, resp.status);
    }
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, 400);
}

// ========== PREDICTIT ==========
async function handlePredictIt(
  action: string,
  apiKey: string, // cookie/session token
  req: Request,
  url: URL
) {
  // PredictIt doesn't have a public trading API — use their internal endpoints
  const baseUrl = "https://www.predictit.org/api";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: apiKey,
  };

  if (action === "portfolio") {
    const resp = await fetch(`${baseUrl}/Profile/Shares`, { headers });
    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: "PredictIt portfolio failed", details: text }, resp.status);
    }
    const data = await resp.json();
    return json({ positions: data || [] });
  }

  if (action === "orders") {
    const resp = await fetch(`${baseUrl}/Profile/MyOffers`, { headers });
    const data = await resp.json();
    return json({ orders: data || [] });
  }

  if (action === "place-order") {
    const body = await req.json();
    const resp = await fetch(`${baseUrl}/Trade/SubmitTrade`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: "Order failed", details: data }, resp.status);

    // Log trade to history
    const adminClient3 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await logTrade(adminClient3, body._user_id || "", "predictit", {
      market_id: body.contractId?.toString(),
      market_title: body.contractId?.toString(),
      side: body.tradeType === 1 ? "buy_yes" : body.tradeType === 2 ? "buy_no" : "sell",
      price: body.pricePerShare,
      quantity: body.quantity,
      total_cost: (body.pricePerShare ?? 0) * (body.quantity ?? 0),
      order_id: data.offerId?.toString(),
      status: "submitted",
      raw_response: data,
    });

    return json({ order: data });
  }

  if (action === "cancel-order") {
    const offerId = url.searchParams.get("order_id");
    if (!offerId) return json({ error: "order_id required" }, 400);
    const resp = await fetch(`${baseUrl}/Trade/CancelOffer/${offerId}`, {
      method: "POST",
      headers,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: "Cancel failed", details: text }, resp.status);
    }
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, 400);
}
