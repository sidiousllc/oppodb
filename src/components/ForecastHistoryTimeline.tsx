import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowRight } from "lucide-react";

interface HistoryEntry {
  id: string;
  source: string;
  old_rating: string | null;
  new_rating: string | null;
  changed_at: string;
}

const RATING_COLORS: Record<string, string> = {
  "Solid D":  "hsl(210, 100%, 35%)",
  "Safe D":   "hsl(210, 100%, 35%)",
  "Likely D": "hsl(210, 80%, 50%)",
  "Lean D":   "hsl(210, 60%, 62%)",
  "Tilt D":   "hsl(210, 45%, 70%)",
  "Toss Up":  "hsl(45, 90%, 50%)",
  "Tilt R":   "hsl(0, 45%, 70%)",
  "Lean R":   "hsl(0, 60%, 62%)",
  "Likely R": "hsl(0, 75%, 50%)",
  "Solid R":  "hsl(0, 85%, 38%)",
  "Safe R":   "hsl(0, 85%, 38%)",
};

function miniRatingBadge(rating: string | null) {
  if (!rating) return <span className="text-[8px] text-muted-foreground italic">none</span>;
  const color = RATING_COLORS[rating] || "hsl(var(--muted-foreground))";
  return (
    <span
      className="inline-block px-1 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap"
      style={{ backgroundColor: color }}
    >
      {rating}
    </span>
  );
}

function shortSource(s: string) {
  return s
    .replace("Cook Political Report", "Cook")
    .replace("Sabato's Crystal Ball", "Sabato")
    .replace("Inside Elections", "IE");
}

interface ForecastHistoryTimelineProps {
  raceType: string;
  stateAbbr: string;
  district: string | null;
  cycle?: number;
}

export function ForecastHistoryTimeline({ raceType, stateAbbr, district, cycle = 2026 }: ForecastHistoryTimelineProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("election_forecast_history")
        .select("*")
        .eq("race_type", raceType)
        .eq("state_abbr", stateAbbr)
        .eq("cycle", cycle)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (district) {
        query = query.eq("district", district);
      } else {
        query = query.is("district", null);
      }

      const { data } = await query;
      setHistory((data || []) as HistoryEntry[]);
      setLoading(false);
    };
    load();
  }, [raceType, stateAbbr, district, cycle]);

  if (loading) {
    return <div className="text-[9px] text-muted-foreground py-2 px-3">Loading history…</div>;
  }

  // Filter out initial inserts (old_rating === null) that aren't interesting
  const shifts = history.filter(h => h.old_rating !== null);

  if (shifts.length === 0) {
    return (
      <div className="text-[9px] text-muted-foreground py-2 px-3 flex items-center gap-1">
        <Clock className="h-3 w-3" /> No rating shifts recorded yet
      </div>
    );
  }

  return (
    <div className="py-2 px-3">
      <div className="flex items-center gap-1 mb-1.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Rating Shifts</span>
      </div>
      <div className="space-y-1">
        {shifts.map((h) => (
          <div key={h.id} className="flex items-center gap-1.5 text-[9px]">
            <span className="text-muted-foreground w-16 shrink-0">
              {new Date(h.changed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="font-medium text-foreground w-12 shrink-0">{shortSource(h.source)}</span>
            {miniRatingBadge(h.old_rating)}
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
            {miniRatingBadge(h.new_rating)}
          </div>
        ))}
      </div>
    </div>
  );
}
