import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, Activity, Clock } from "lucide-react";

interface RequestLog {
  endpoint: string;
  created_at: string;
  status_code: number;
  api_key_id: string;
}

type TimeRange = "24h" | "7d" | "30d";

export function ApiAnalytics() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("7d");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = new Date();
      if (range === "24h") since.setHours(since.getHours() - 24);
      else if (range === "7d") since.setDate(since.getDate() - 7);
      else since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from("api_request_logs" as any)
        .select("endpoint,created_at,status_code,api_key_id")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading API logs:", error);
        setLogs([]);
      } else {
        setLogs((data || []) as unknown as RequestLog[]);
      }
      setLoading(false);
    }
    load();
  }, [range]);

  const stats = useMemo(() => {
    const total = logs.length;
    const endpoints: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byHour: Record<string, number> = {};

    for (const log of logs) {
      endpoints[log.endpoint] = (endpoints[log.endpoint] || 0) + 1;
      const day = log.created_at.substring(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      const hour = log.created_at.substring(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    }

    const topEndpoints = Object.entries(endpoints)
      .sort(([, a], [, b]) => b - a);
    const maxEndpointCount = topEndpoints.length > 0 ? topEndpoints[0][1] : 1;

    // Build time series
    const now = new Date();
    let timeSeries: { label: string; count: number }[] = [];

    if (range === "24h") {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(d.getHours() - i);
        const key = d.toISOString().substring(0, 13);
        const label = d.toLocaleTimeString([], { hour: "2-digit", hour12: true });
        timeSeries.push({ label, count: byHour[key] || 0 });
      }
    } else if (range === "7d") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().substring(0, 10);
        const label = d.toLocaleDateString([], { weekday: "short" });
        timeSeries.push({ label, count: byDay[key] || 0 });
      }
    } else {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().substring(0, 10);
        const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
        timeSeries.push({ label, count: byDay[key] || 0 });
      }
    }

    const maxCount = Math.max(...timeSeries.map((t) => t.count), 1);

    const avgPerDay = range === "24h"
      ? total
      : total / (range === "7d" ? 7 : 30);

    return { total, topEndpoints, maxEndpointCount, timeSeries, maxCount, avgPerDay };
  }, [logs, range]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Usage Analytics</h2>
        </div>
        <div className="flex justify-center py-8">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Usage Analytics</h2>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["24h", "7d", "30d"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Requests</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Avg / Day</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {stats.avgPerDay < 1 ? stats.avgPerDay.toFixed(1) : Math.round(stats.avgPerDay).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Endpoints Used</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.topEndpoints.length}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Requests Over Time</h3>
        <div className="flex items-end gap-[2px] h-32">
          {stats.timeSeries.map((point, i) => {
            const height = stats.maxCount > 0 ? (point.count / stats.maxCount) * 100 : 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors min-h-[2px]"
                  style={{ height: `${Math.max(height, 1.5)}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                  <div className="rounded bg-foreground text-background px-2 py-1 text-[10px] font-medium whitespace-nowrap shadow-lg">
                    {point.count} req — {point.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* X-axis labels — show subset */}
        <div className="flex justify-between mt-1">
          {stats.timeSeries
            .filter((_, i) => {
              const total = stats.timeSeries.length;
              if (total <= 7) return true;
              if (total <= 14) return i % 2 === 0;
              return i % Math.ceil(total / 7) === 0 || i === total - 1;
            })
            .map((point, i) => (
              <span key={i} className="text-[10px] text-muted-foreground">
                {point.label}
              </span>
            ))}
        </div>
      </div>

      {/* Top endpoints */}
      {stats.topEndpoints.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Endpoints</h3>
          <div className="space-y-2">
            {stats.topEndpoints.map(([ep, count]) => (
              <div key={ep} className="flex items-center gap-3">
                <code className="text-xs font-mono text-foreground w-40 shrink-0 truncate">
                  /{ep}
                </code>
                <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all"
                    style={{
                      width: `${(count / stats.maxEndpointCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground w-12 text-right">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="text-center py-6">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No API requests yet. Generate a key and start making calls!
          </p>
        </div>
      )}
    </div>
  );
}
