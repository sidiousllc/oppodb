import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface Trade {
  id: string;
  platform: string;
  market_id: string | null;
  market_title: string | null;
  side: string;
  price: number | null;
  quantity: number | null;
  total_cost: number | null;
  status: string;
  created_at: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  kalshi: "Kalshi",
  polymarket: "Polymarket",
  predictit: "PredictIt",
};

function sideColor(side: string) {
  const s = side.toLowerCase();
  if (s.includes("buy") || s.includes("yes")) return "text-green-500";
  if (s.includes("sell") || s.includes("no")) return "text-red-500";
  return "text-muted-foreground";
}

function sideIcon(side: string) {
  const s = side.toLowerCase();
  if (s.includes("buy") || s.includes("yes")) return <TrendingUp className="h-3.5 w-3.5" />;
  return <TrendingDown className="h-3.5 w-3.5" />;
}

export function TradeHistoryPanel() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"my" | "public">("public");

  async function loadTrades() {
    setLoading(true);
    try {
      if (mode === "my") {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setTrades([]); setLoading(false); return; }
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/market-trading?action=trade-history`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const data = await resp.json();
        setTrades(data.trades || []);
      } else {
        // Public feed — read directly from table (RLS allows authenticated SELECT)
        const { data } = await supabase
          .from("trade_history")
          .select("id, platform, market_id, market_title, side, price, quantity, total_cost, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        setTrades((data as Trade[]) || []);
      }
    } catch {
      setTrades([]);
    }
    setLoading(false);
  }

  useEffect(() => { loadTrades(); }, [mode]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Trade History
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setMode("public")}
              className={`text-[10px] px-2.5 py-1 font-medium transition-colors ${mode === "public" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              All Trades
            </button>
            <button
              onClick={() => setMode("my")}
              className={`text-[10px] px-2.5 py-1 font-medium transition-colors ${mode === "my" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              My Trades
            </button>
          </div>
          <button onClick={loadTrades} className="p-1 rounded hover:bg-muted transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {mode === "my" ? "No trades yet. Place an order to get started." : "No trades recorded yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Time</th>
                <th className="text-left py-2 px-2 font-medium">Platform</th>
                <th className="text-left py-2 px-2 font-medium">Market</th>
                <th className="text-left py-2 px-2 font-medium">Side</th>
                <th className="text-right py-2 px-2 font-medium">Price</th>
                <th className="text-right py-2 px-2 font-medium">Qty</th>
                <th className="text-right py-2 px-2 font-medium">Total</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    {new Date(t.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 px-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground">
                      {PLATFORM_LABELS[t.platform] || t.platform}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-foreground max-w-[200px] truncate" title={t.market_title || t.market_id || ""}>
                    {t.market_title || t.market_id || "—"}
                  </td>
                  <td className={`py-2 px-2 font-medium ${sideColor(t.side)}`}>
                    <span className="flex items-center gap-1">
                      {sideIcon(t.side)}
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-foreground">
                    {t.price != null ? `$${t.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2 px-2 text-right text-foreground">
                    {t.quantity ?? "—"}
                  </td>
                  <td className="py-2 px-2 text-right text-foreground font-medium">
                    {t.total_cost != null ? `$${t.total_cost.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      t.status === "filled" ? "bg-green-500/10 text-green-500" :
                      t.status === "cancelled" ? "bg-red-500/10 text-red-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
