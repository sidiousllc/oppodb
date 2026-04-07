import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrendingUp, TrendingDown, RefreshCw, DollarSign, ShoppingCart,
  XCircle, Loader2,
} from "lucide-react";

interface Position {
  market_ticker?: string;
  ticker?: string;
  title?: string;
  yes_price?: number;
  no_price?: number;
  position?: number;
  quantity?: number;
  market_id?: string;
  contractName?: string;
  [key: string]: unknown;
}

interface Order {
  order_id?: string;
  id?: string;
  ticker?: string;
  side?: string;
  type?: string;
  price?: number;
  quantity?: number;
  status?: string;
  [key: string]: unknown;
}

const PLATFORM_LABELS: Record<string, string> = {
  kalshi: "Kalshi",
  polymarket: "Polymarket",
  predictit: "PredictIt",
};

export function MarketTradingPanel() {
  const { user } = useAuth();
  const [platform, setPlatform] = useState("kalshi");
  const [credentials, setCredentials] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"portfolio" | "orders" | "trade">("portfolio");
  const [error, setError] = useState<string | null>(null);

  // Order form
  const [orderTicker, setOrderTicker] = useState("");
  const [orderSide, setOrderSide] = useState<"yes" | "no">("yes");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderQty, setOrderQty] = useState("1");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  const callApi = async (action: string, opts: { method?: string; body?: any; extra?: string } = {}) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error("Not authenticated");
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trading?action=${action}&platform=${platform}${opts.extra || ""}`,
      {
        method: opts.method || "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      }
    );
    return resp.json();
  };

  const fetchCredentials = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trading?action=list-credentials`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );
    const data = await resp.json();
    setCredentials((data.credentials || []).map((c: any) => c.platform));
  };

  useEffect(() => { fetchCredentials(); }, [user]);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callApi("portfolio");
      if (data.error) throw new Error(data.error);
      setPositions(data.positions || []);
      setBalance(data.balance || null);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callApi("orders");
      if (data.error) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const placeOrder = async () => {
    setOrderSubmitting(true);
    setOrderResult(null);
    try {
      let body: any;
      if (platform === "kalshi") {
        body = {
          ticker: orderTicker,
          action: "buy",
          side: orderSide,
          type: "limit",
          count: parseInt(orderQty),
          yes_price: orderSide === "yes" ? parseInt(orderPrice) : undefined,
          no_price: orderSide === "no" ? parseInt(orderPrice) : undefined,
        };
      } else {
        body = {
          tokenID: orderTicker,
          side: orderSide === "yes" ? "BUY" : "SELL",
          price: parseFloat(orderPrice),
          size: parseInt(orderQty),
        };
      }
      const data = await callApi("place-order", { method: "POST", body });
      if (data.error) throw new Error(data.error + (data.details ? `: ${JSON.stringify(data.details)}` : ""));
      setOrderResult("Order placed successfully!");
    } catch (err: any) {
      setOrderResult(`Error: ${err.message}`);
    }
    setOrderSubmitting(false);
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await callApi("cancel-order", { method: "POST", extra: `&order_id=${orderId}`, body: {} });
      fetchOrders();
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (credentials.includes(platform)) {
      if (tab === "portfolio") fetchPortfolio();
      else if (tab === "orders") fetchOrders();
    }
  }, [platform, tab]);

  if (!credentials.length) {
    return (
      <div style={{ border: "2px inset #fff", background: "#c0c0c0", padding: 16, textAlign: "center" }}>
        <DollarSign size={24} style={{ margin: "0 auto 8px" }} />
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>No Trading Accounts Connected</div>
        <div style={{ fontSize: 12, color: "#666" }}>
          Add your API keys in Profile → Prediction Market API Keys to start trading.
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: "2px inset #fff", background: "#c0c0c0" }}>
      {/* Platform tabs */}
      <div style={{ display: "flex", borderBottom: "2px inset #fff" }}>
        {credentials.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            style={{
              padding: "6px 16px", cursor: "pointer",
              background: platform === p ? "#c0c0c0" : "#a0a0a0",
              border: platform === p ? "2px outset #fff" : "1px solid #808080",
              borderBottom: platform === p ? "none" : undefined,
              fontWeight: platform === p ? "bold" : "normal",
            }}
          >
            {PLATFORM_LABELS[p] || p}
          </button>
        ))}
      </div>

      {/* Action tabs */}
      <div style={{ display: "flex", gap: 4, padding: "8px 8px 0" }}>
        {(["portfolio", "orders", "trade"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "4px 12px", cursor: "pointer",
              background: tab === t ? "#fff" : "#c0c0c0",
              border: "2px outset #fff",
              fontWeight: tab === t ? "bold" : "normal",
              textTransform: "capitalize",
            }}
          >
            {t === "portfolio" && <TrendingUp size={12} style={{ marginRight: 4 }} />}
            {t === "orders" && <ShoppingCart size={12} style={{ marginRight: 4 }} />}
            {t === "trade" && <DollarSign size={12} style={{ marginRight: 4 }} />}
            {t}
          </button>
        ))}
        <button
          onClick={() => tab === "portfolio" ? fetchPortfolio() : fetchOrders()}
          style={{ marginLeft: "auto", background: "#c0c0c0", border: "2px outset #fff", padding: "4px 8px", cursor: "pointer" }}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div style={{ padding: 8 }}>
        {error && (
          <div style={{ background: "#ffcccc", border: "1px solid #ff0000", padding: 6, marginBottom: 8, fontSize: 12 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Loader2 size={20} className="animate-spin" style={{ margin: "0 auto" }} />
            <div style={{ fontSize: 12, marginTop: 4 }}>Loading...</div>
          </div>
        )}

        {/* Portfolio */}
        {tab === "portfolio" && !loading && (
          <div>
            {balance && (
              <div style={{ border: "2px outset #fff", padding: 8, marginBottom: 8, display: "flex", gap: 16 }}>
                <span style={{ fontWeight: "bold" }}>Balance:</span>
                {typeof balance.balance !== "undefined" && <span>${(balance.balance / 100).toFixed(2)}</span>}
                {typeof balance.payout !== "undefined" && <span>Payout: ${(balance.payout / 100).toFixed(2)}</span>}
              </div>
            )}
            {positions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 16, color: "#666", fontSize: 12 }}>No positions found</div>
            ) : (
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#000080", color: "#fff" }}>
                      <th style={{ padding: 4, textAlign: "left" }}>Market</th>
                      <th style={{ padding: 4, textAlign: "right" }}>Qty</th>
                      <th style={{ padding: 4, textAlign: "right" }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #808080" }}>
                        <td style={{ padding: 4 }}>{pos.market_ticker || pos.ticker || pos.title || pos.contractName || "—"}</td>
                        <td style={{ padding: 4, textAlign: "right" }}>{pos.quantity || pos.position || "—"}</td>
                        <td style={{ padding: 4, textAlign: "right" }}>
                          {pos.yes_price != null ? `${(pos.yes_price * 100).toFixed(0)}¢` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Orders */}
        {tab === "orders" && !loading && (
          <div>
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 16, color: "#666", fontSize: 12 }}>No open orders</div>
            ) : (
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#000080", color: "#fff" }}>
                      <th style={{ padding: 4, textAlign: "left" }}>Market</th>
                      <th style={{ padding: 4 }}>Side</th>
                      <th style={{ padding: 4, textAlign: "right" }}>Price</th>
                      <th style={{ padding: 4, textAlign: "right" }}>Qty</th>
                      <th style={{ padding: 4 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #808080" }}>
                        <td style={{ padding: 4 }}>{o.ticker || o.id || "—"}</td>
                        <td style={{ padding: 4, textAlign: "center" }}>
                          {o.side === "yes" ? (
                            <span style={{ color: "#008000" }}>YES</span>
                          ) : (
                            <span style={{ color: "#cc0000" }}>NO</span>
                          )}
                        </td>
                        <td style={{ padding: 4, textAlign: "right" }}>{o.price ?? "—"}</td>
                        <td style={{ padding: 4, textAlign: "right" }}>{o.quantity ?? "—"}</td>
                        <td style={{ padding: 4 }}>
                          <button
                            onClick={() => cancelOrder(o.order_id || o.id || "")}
                            style={{ background: "#c0c0c0", border: "1px outset #fff", padding: "1px 6px", cursor: "pointer" }}
                          >
                            <XCircle size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Trade form */}
        {tab === "trade" && (
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>
                {platform === "kalshi" ? "Ticker" : "Token ID / Contract ID"}
              </label>
              <input
                value={orderTicker}
                onChange={(e) => setOrderTicker(e.target.value)}
                placeholder={platform === "kalshi" ? "e.g. PRES-2026-DEM" : "Token or contract ID"}
                style={{ width: "100%", padding: "4px 6px", border: "2px inset #fff", fontFamily: "monospace", fontSize: 12 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Side</label>
                <div style={{ display: "flex" }}>
                  <button
                    onClick={() => setOrderSide("yes")}
                    style={{
                      flex: 1, padding: "4px 8px", cursor: "pointer",
                      background: orderSide === "yes" ? "#008000" : "#c0c0c0",
                      color: orderSide === "yes" ? "#fff" : "#000",
                      border: "2px outset #fff",
                    }}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setOrderSide("no")}
                    style={{
                      flex: 1, padding: "4px 8px", cursor: "pointer",
                      background: orderSide === "no" ? "#cc0000" : "#c0c0c0",
                      color: orderSide === "no" ? "#fff" : "#000",
                      border: "2px outset #fff",
                    }}
                  >
                    NO
                  </button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>
                  Price {platform === "kalshi" ? "(cents)" : "($)"}
                </label>
                <input
                  type="number"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  placeholder={platform === "kalshi" ? "50" : "0.50"}
                  style={{ width: "100%", padding: "4px 6px", border: "2px inset #fff", fontSize: 12 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Quantity</label>
                <input
                  type="number"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  min="1"
                  style={{ width: "100%", padding: "4px 6px", border: "2px inset #fff", fontSize: 12 }}
                />
              </div>
            </div>
            <button
              disabled={orderSubmitting || !orderTicker || !orderPrice}
              onClick={placeOrder}
              style={{
                width: "100%", padding: "6px 16px", cursor: "pointer",
                background: "#000080", color: "#fff", border: "2px outset #fff",
                fontWeight: "bold", fontSize: 14,
                opacity: orderSubmitting || !orderTicker || !orderPrice ? 0.5 : 1,
              }}
            >
              {orderSubmitting ? "Placing Order..." : "Place Order"}
            </button>
            {orderResult && (
              <div style={{
                marginTop: 8, padding: 6, fontSize: 12,
                background: orderResult.startsWith("Error") ? "#ffcccc" : "#ccffcc",
                border: "1px solid",
                borderColor: orderResult.startsWith("Error") ? "#ff0000" : "#00aa00",
              }}>
                {orderResult}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
