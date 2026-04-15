import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, ExternalLink, FileText } from "lucide-react";
import { IGReportDetailWindow } from "./IGReportDetailWindow";

interface IGReportsPanelProps {
  onBack: () => void;
}

const AGENCIES = [
  "", "agriculture", "commerce", "defense", "education", "energy",
  "epa", "gao", "hhs", "homeland", "hud", "interior", "justice",
  "labor", "nasa", "nrc", "opm", "sba", "sec", "ssa", "state",
  "transportation", "treasury", "usps", "va",
];

export function IGReportsPanel({ onBack }: IGReportsPanelProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyFilter, setAgencyFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase
        .from("ig_reports")
        .select("*")
        .order("published_on", { ascending: false })
        .limit(200);
      if (agencyFilter) q = q.eq("inspector", agencyFilter);
      if (searchQ.length >= 2) q = q.or(`title.ilike.%${searchQ}%,summary.ilike.%${searchQ}%,agency_name.ilike.%${searchQ}%`);
      const { data: rows } = await q;
      setData(rows || []);
      setLoading(false);
    }
    load();
  }, [agencyFilter, searchQ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <FileText className="h-4 w-4" />
        <span className="text-sm font-bold">IG Reports</span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Oversight.garden</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="win98-sunken bg-white px-2 py-1 flex items-center gap-1 flex-1 min-w-[150px]">
          <Search className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search reports..."
            className="bg-transparent text-[11px] outline-none flex-1"
          />
        </div>
        <select
          value={agencyFilter}
          onChange={e => setAgencyFilter(e.target.value)}
          className="win98-sunken bg-white text-[11px] px-2 py-1"
        >
          <option value="">All Agencies</option>
          {AGENCIES.filter(Boolean).map(a => (
            <option key={a} value={a}>{a.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-[11px] py-8 text-[hsl(var(--muted-foreground))]">Loading IG reports...</div>
      ) : data.length === 0 ? (
        <div className="text-center text-[11px] py-8 text-[hsl(var(--muted-foreground))]">No reports found. Try syncing data first.</div>
      ) : (
        <div className="space-y-2 max-h-[65vh] overflow-y-auto">
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{data.length} reports</div>
          {data.map((r, i) => (
            <div key={r.id || i} className="candidate-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold">{r.title}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span className="font-semibold">{r.agency_name}</span>
                    {r.type && <span> • {r.type}</span>}
                    {r.published_on && <span> • {new Date(r.published_on).toLocaleDateString()}</span>}
                    {r.year && <span> • {r.year}</span>}
                  </div>
                  {r.summary && (
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1 line-clamp-3">{r.summary}</div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1">
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" className="win98-button text-[9px] px-1.5 py-0.5 flex items-center gap-0.5">
                      <FileText className="h-2.5 w-2.5" /> PDF
                    </a>
                  )}
                  {(r.landing_url || r.url) && (
                    <a href={r.landing_url || r.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 flex items-center gap-0.5">
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
