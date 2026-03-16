import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

interface PollRow {
  id: string;
  source: string;
  poll_type: string;
  candidate_or_topic: string;
  date_conducted: string;
  approve_pct: number | null;
  disapprove_pct: number | null;
  margin: number | null;
  sample_size: number | null;
  sample_type: string | null;
  raw_data: any;
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return null;
  const positive = margin > 0;
  const Icon = positive ? TrendingUp : margin < 0 ? TrendingDown : Minus;
  const label = positive ? `+${margin}` : String(margin);
  const color = positive ? "hsl(150, 55%, 45%)" : margin < 0 ? "hsl(0, 65%, 50%)" : "hsl(var(--muted-foreground))";
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold" style={{ backgroundColor: `${color}15`, color }}>
      <Icon className="h-2.5 w-2.5" />{label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatFullDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface CandidatePollingPanelProps {
  candidateName: string;
  candidateSlug: string;
}

export function CandidatePollingPanel({ candidateName, candidateSlug }: CandidatePollingPanelProps) {
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch polls matching candidate name or slug in raw_data
      const { data } = await supabase
        .from("polling_data")
        .select("id, source, poll_type, candidate_or_topic, date_conducted, approve_pct, disapprove_pct, margin, sample_size, sample_type, raw_data")
        .or(`candidate_or_topic.eq.${candidateName},candidate_or_topic.ilike.%${candidateName.split(" ").pop()}%`)
        .order("date_conducted", { ascending: false });

      // Further filter by candidate_slug in raw_data if present
      const filtered = (data ?? []).filter((p: any) => {
        const rd = p.raw_data as any;
        if (rd?.candidate_slug === candidateSlug) return true;
        if (p.candidate_or_topic === candidateName) return true;
        return false;
      });
      setPolls(filtered);
      setLoading(false);
    }
    load();
  }, [candidateName, candidateSlug]);

  const favPolls = useMemo(() => polls.filter(p => p.poll_type === "favorability"), [polls]);

  if (loading) {
    return (
      <div className="candidate-card mb-3 animate-pulse">
        <div className="h-4 w-40 bg-[hsl(var(--win98-light))] rounded mb-3" />
        <div className="h-12 bg-[hsl(var(--win98-light))] rounded" />
      </div>
    );
  }

  if (polls.length === 0) return null;

  const latest = favPolls[0];

  return (
    <div className="candidate-card mb-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4" />
        <h2 className="text-sm font-bold">📊 Polling Data</h2>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-auto">{polls.length} polls</span>
      </div>

      {/* Latest favorability */}
      {latest && (
        <div className="win98-sunken p-2 rounded mb-2">
          <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] mb-1">FAVORABILITY (LATEST)</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{latest.approve_pct}%</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">fav /</span>
            <span className="text-lg font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>{latest.disapprove_pct}%</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">unfav</span>
            <MarginBadge margin={latest.margin} />
          </div>
          <div className="flex h-[6px] w-full overflow-hidden win98-sunken">
            <div style={{ width: `${latest.approve_pct}%`, background: "hsl(150, 55%, 45%)" }} />
            <div style={{ width: `${100 - (latest.approve_pct || 0) - (latest.disapprove_pct || 0)}%`, background: "hsl(var(--win98-light))" }} />
            <div style={{ width: `${latest.disapprove_pct}%`, background: "hsl(0, 65%, 50%)" }} />
          </div>
          <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
            {latest.source} · {formatFullDate(latest.date_conducted)} · n={latest.sample_size?.toLocaleString()} {latest.sample_type}
          </p>
        </div>
      )}

      {/* Historical trend */}
      {favPolls.length > 1 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-1"
          >
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            FAVORABILITY HISTORY ({favPolls.length} polls)
          </button>
          {showHistory && (
            <div className="space-y-1">
              {favPolls.map(p => {
                const rd = p.raw_data as any;
                const cycle = rd?.cycle || "";
                return (
                  <div key={p.id} className="flex items-center gap-2 text-[10px]">
                    <span className="w-16 text-[hsl(var(--muted-foreground))] shrink-0">{formatDate(p.date_conducted)}</span>
                    {cycle && <span className="text-[9px] w-8 shrink-0 opacity-60">{cycle}</span>}
                    <div className="flex-1 flex h-[5px] overflow-hidden win98-sunken">
                      <div style={{ width: `${p.approve_pct}%`, background: "hsl(150, 55%, 45%)" }} />
                      <div style={{ width: `${100 - (p.approve_pct || 0) - (p.disapprove_pct || 0)}%`, background: "hsl(var(--win98-light))" }} />
                      <div style={{ width: `${p.disapprove_pct}%`, background: "hsl(0, 65%, 50%)" }} />
                    </div>
                    <span className="w-14 text-right shrink-0">
                      <span style={{ color: "hsl(150, 55%, 45%)" }}>{p.approve_pct}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">/</span>
                      <span style={{ color: "hsl(0, 65%, 50%)" }}>{p.disapprove_pct}</span>
                    </span>
                    <MarginBadge margin={p.margin} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2 pt-1 border-t border-[hsl(var(--border))]">
        Sources: Civiqs, Emerson College. Favorability among registered/likely voters.
      </p>
    </div>
  );
}
