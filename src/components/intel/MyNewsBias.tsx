// "My News Bias" dashboard: shows the user's reading distribution by source bias over time.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface BiasRow { source_name: string; bias: string; read_at: string }

export function MyNewsBias() {
  const [rows, setRows] = useState<BiasRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRows([]); setLoading(false); return; }
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data } = await supabase
      .from("user_bias_history").select("source_name,bias,read_at")
      .eq("user_id", user.id).gte("read_at", since).order("read_at", { ascending: false }).limit(500);
    setRows((data as BiasRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const reset = async () => {
    if (!confirm("Clear your reading history?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_bias_history").delete().eq("user_id", user.id);
    toast.success("History cleared");
    load();
  };

  const counts = rows.reduce((acc, r) => {
    const b = r.bias;
    if (b === "left" || b === "lean-left") acc.L++;
    else if (b === "center") acc.C++;
    else if (b === "right" || b === "lean-right") acc.R++;
    else acc.U++;
    return acc;
  }, { L: 0, C: 0, R: 0, U: 0 });
  const total = counts.L + counts.C + counts.R + counts.U;
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;

  const sourceTally = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.source_name] = (acc[r.source_name] || 0) + 1;
    return acc;
  }, {});
  const topSources = Object.entries(sourceTally).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="border border-[#808080] bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#000080]">📊 My Reading Bias (Last 30 Days)</div>
          <button onClick={reset} className="text-[10px] text-gray-500 hover:text-red-600 flex items-center gap-1">
            <Trash2 size={10} /> Clear
          </button>
        </div>
        {loading ? (
          <div className="text-xs text-gray-500">Loading...</div>
        ) : total === 0 ? (
          <div className="text-xs text-gray-500">No reading history yet. Open articles in the Feed tab to start tracking.</div>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-sm border border-[#c0c0c0]">
              {pct(counts.L) > 0 && <div style={{ width: `${pct(counts.L)}%`, background: "#3b82f6" }} title={`Left ${pct(counts.L).toFixed(1)}%`} />}
              {pct(counts.C) > 0 && <div style={{ width: `${pct(counts.C)}%`, background: "#9333ea" }} title={`Center ${pct(counts.C).toFixed(1)}%`} />}
              {pct(counts.R) > 0 && <div style={{ width: `${pct(counts.R)}%`, background: "#dc2626" }} title={`Right ${pct(counts.R).toFixed(1)}%`} />}
              {pct(counts.U) > 0 && <div style={{ width: `${pct(counts.U)}%`, background: "#9ca3af" }} title={`Unrated ${pct(counts.U).toFixed(1)}%`} />}
            </div>
            <div className="text-[10px] text-gray-600 flex flex-wrap gap-2">
              <span><span className="text-blue-600 font-bold">{counts.L}</span> Left ({pct(counts.L).toFixed(1)}%)</span>
              <span><span className="text-purple-600 font-bold">{counts.C}</span> Center ({pct(counts.C).toFixed(1)}%)</span>
              <span><span className="text-red-600 font-bold">{counts.R}</span> Right ({pct(counts.R).toFixed(1)}%)</span>
              <span><span className="text-gray-500 font-bold">{counts.U}</span> Unrated</span>
              <span className="ml-auto text-gray-400">{total} articles</span>
            </div>
          </>
        )}
      </div>

      {topSources.length > 0 && (
        <div className="border border-[#808080] bg-white p-3 space-y-1">
          <div className="text-xs font-bold text-[#000080]">Top Sources Read</div>
          <div className="space-y-1">
            {topSources.map(([src, n]) => (
              <div key={src} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-700 truncate flex-1">{src}</span>
                <span className="text-gray-500 ml-2">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
