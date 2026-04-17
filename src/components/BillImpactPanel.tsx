import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

interface Analysis {
  summary: string;
  fiscal_impact: string | null;
  political_impact: string | null;
  winners: { group: string; reason: string }[];
  losers: { group: string; reason: string }[];
  affected_groups: { group: string; impact: string }[];
}

interface Bill {
  bill_id: string;
  title: string;
  short_title: string | null;
  policy_area: string | null;
  latest_action_date: string | null;
}

interface Props {
  /** Optional district id (e.g. "TX-21") for district-scoped analysis */
  districtId?: string;
  /** Optional state abbr for state-scoped analysis */
  stateAbbr?: string;
}

export function BillImpactPanel({ districtId, stateAbbr }: Props) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const scope = districtId ? "district" : stateAbbr ? "state" : "national";
  const scopeRef = districtId ?? stateAbbr ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("congress_bills")
      .select("bill_id, title, short_title, policy_area, latest_action_date")
      .order("latest_action_date", { ascending: false, nullsFirst: false })
      .limit(15)
      .then(({ data }) => {
        if (cancelled) return;
        setBills((data ?? []) as Bill[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function analyze(billId: string) {
    setSelected(billId);
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("bill-impact", {
        body: { bill_id: billId, scope, scope_ref: scopeRef },
      });
      if (error) throw error;
      setAnalysis(data.analysis);
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          AI Bill Impact Analysis ({scope})
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading recent bills…
        </div>
      ) : bills.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bills available. Run congress sync.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {bills.map((b) => (
              <button
                key={b.bill_id}
                onClick={() => analyze(b.bill_id)}
                className={`w-full text-left p-2 rounded text-xs hover:bg-muted/50 transition-colors border ${
                  selected === b.bill_id ? "border-primary bg-muted/30" : "border-transparent"
                }`}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.short_title || b.title}</div>
                    {b.policy_area && (
                      <div className="text-[10px] text-muted-foreground">{b.policy_area}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="border-l border-border pl-4 min-h-[200px]">
            {analyzing ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing impact…
              </div>
            ) : analysis ? (
              <div className="space-y-3 text-xs">
                <p className="text-foreground">{analysis.summary}</p>
                {analysis.fiscal_impact && (
                  <div>
                    <div className="font-bold text-[10px] uppercase text-muted-foreground">Fiscal</div>
                    <p>{analysis.fiscal_impact}</p>
                  </div>
                )}
                {analysis.political_impact && (
                  <div>
                    <div className="font-bold text-[10px] uppercase text-muted-foreground">Political</div>
                    <p>{analysis.political_impact}</p>
                  </div>
                )}
                {analysis.winners?.length > 0 && (
                  <div>
                    <div className="font-bold text-[10px] uppercase text-green-700">Winners</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {analysis.winners.map((w, i) => (
                        <li key={i}><span className="font-medium">{w.group}:</span> {w.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.losers?.length > 0 && (
                  <div>
                    <div className="font-bold text-[10px] uppercase text-red-700">Losers</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {analysis.losers.map((l, i) => (
                        <li key={i}><span className="font-medium">{l.group}:</span> {l.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a bill to generate AI impact analysis for this {scope}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
