import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, Building2, Search, ExternalLink } from "lucide-react";

interface FederalSpendingPanelProps {
  onBack: () => void;
}

export function FederalSpendingPanel({ onBack }: FederalSpendingPanelProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "contract" | "grant">("all");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase
        .from("federal_spending")
        .select("*")
        .order("award_amount", { ascending: false })
        .limit(200);
      if (stateFilter) q = q.eq("recipient_state", stateFilter.toUpperCase());
      if (typeFilter !== "all") q = q.eq("award_type", typeFilter);
      if (searchQ.length >= 2) q = q.or(`recipient_name.ilike.%${searchQ}%,awarding_agency.ilike.%${searchQ}%,description.ilike.%${searchQ}%`);
      const { data: rows } = await q;
      setData(rows || []);
      setLoading(false);
    }
    load();
  }, [stateFilter, typeFilter, searchQ]);

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "N/A";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <DollarSign className="h-4 w-4" />
        <span className="text-sm font-bold">Federal Spending</span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">USASpending.gov</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="win98-sunken bg-white px-2 py-1 flex items-center gap-1 flex-1 min-w-[150px]">
          <Search className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search recipients, agencies..."
            className="bg-transparent text-[11px] outline-none flex-1"
          />
        </div>
        <input
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          placeholder="State (e.g. MN)"
          className="win98-sunken bg-white text-[11px] px-2 py-1 w-20"
          maxLength={2}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as any)}
          className="win98-sunken bg-white text-[11px] px-2 py-1"
        >
          <option value="all">All Types</option>
          <option value="contract">Contracts</option>
          <option value="grant">Grants</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-[11px] py-8 text-[hsl(var(--muted-foreground))]">Loading federal spending data...</div>
      ) : data.length === 0 ? (
        <div className="text-center text-[11px] py-8 text-[hsl(var(--muted-foreground))]">No records found. Try syncing data first.</div>
      ) : (
        <div className="space-y-2 max-h-[65vh] overflow-y-auto">
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{data.length} records</div>
          {data.map((r, i) => (
            <div key={r.id || i} className="candidate-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold truncate">{r.recipient_name}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {r.awarding_agency && <span>{r.awarding_agency} • </span>}
                    <span className={r.award_type === "grant" ? "text-green-700" : "text-blue-700"}>
                      {r.award_type === "grant" ? "Grant" : "Contract"}
                    </span>
                    {r.recipient_state && <span> • {r.recipient_state}</span>}
                    {r.place_of_performance_district && <span> CD-{r.place_of_performance_district}</span>}
                    {r.fiscal_year && <span> • FY{r.fiscal_year}</span>}
                  </div>
                  {r.description && (
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">{r.description}</div>
                  )}
                  {r.naics_description && (
                    <div className="text-[9px] mt-0.5">NAICS: {r.naics_description}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-bold">{fmt(r.award_amount)}</div>
                  {r.total_obligation != null && r.total_obligation !== r.award_amount && (
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))]">Obligated: {fmt(r.total_obligation)}</div>
                  )}
                  {r.source_url && (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 flex items-center gap-0.5 justify-end mt-1">
                      <ExternalLink className="h-2.5 w-2.5" /> View
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
