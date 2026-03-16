import { useMemo, useState, useRef, useEffect } from "react";
import { getSourceInfo, type PollEntry } from "@/data/pollingData";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Globe, DollarSign, Compass, Shield, Heart, Users } from "lucide-react";

// ─── useInView ──────────────────────────────────────────────────────────────

function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold: 0.15, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ─── Topic config ───────────────────────────────────────────────────────────

interface TopicGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // HSL values
  keywords: string[];
}

const TOPIC_GROUPS: TopicGroup[] = [
  {
    label: "Direction of Country",
    icon: Compass,
    color: "260, 55%, 48%",
    keywords: ["direction of country", "right direction"],
  },
  {
    label: "Economy",
    icon: DollarSign,
    color: "150, 55%, 45%",
    keywords: ["economy", "economic confidence", "trump economy handling"],
  },
  {
    label: "Iran / Foreign Policy",
    icon: Globe,
    color: "25, 90%, 50%",
    keywords: ["trump iran handling", "iran"],
  },
  {
    label: "Immigration",
    icon: Shield,
    color: "210, 75%, 50%",
    keywords: ["immigration"],
  },
  {
    label: "Healthcare",
    icon: Heart,
    color: "350, 65%, 50%",
    keywords: ["healthcare"],
  },
  {
    label: "Cabinet / Personnel",
    icon: Users,
    color: "45, 70%, 48%",
    keywords: ["hegseth", "rubio", "secretary"],
  },
];

function matchGroup(topic: string): TopicGroup | null {
  const lower = topic.toLowerCase();
  return TOPIC_GROUPS.find((g) => g.keywords.some((kw) => lower.includes(kw))) ?? null;
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface IssuePollingProps {
  polls: PollEntry[];
}

export default function IssuePollingSection({ polls }: IssuePollingProps) {
  const { ref, inView } = useInView();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const issuePolls = useMemo(
    () => polls.filter((p) => p.poll_type === "issue"),
    [polls],
  );

  // Group polls by topic group
  const grouped = useMemo(() => {
    const map = new Map<string, { group: TopicGroup; polls: PollEntry[] }>();
    issuePolls.forEach((p) => {
      const g = matchGroup(p.candidate_or_topic);
      if (!g) return;
      if (!map.has(g.label)) map.set(g.label, { group: g, polls: [] });
      map.get(g.label)!.polls.push(p);
    });
    // Sort each group's polls by date desc
    map.forEach((v) => v.polls.sort((a, b) => b.date_conducted.localeCompare(a.date_conducted)));
    return map;
  }, [issuePolls]);

  // Summary stats per group (average across latest per source)
  const summaries = useMemo(() => {
    return Array.from(grouped.entries()).map(([label, { group, polls: gPolls }]) => {
      const bySource = new Map<string, PollEntry>();
      gPolls.forEach((p) => {
        const ex = bySource.get(p.source);
        if (!ex || p.date_conducted > ex.date_conducted) bySource.set(p.source, p);
      });
      const latest = Array.from(bySource.values());
      const avgApprove = latest.reduce((s, p) => s + (p.approve_pct ?? p.favor_pct ?? 0), 0) / latest.length;
      const avgDisapprove = latest.reduce((s, p) => s + (p.disapprove_pct ?? p.oppose_pct ?? 0), 0) / latest.length;
      return { label, group, polls: gPolls, latest, avgApprove, avgDisapprove, margin: avgApprove - avgDisapprove };
    }).sort((a, b) => a.margin - b.margin);
  }, [grouped]);

  if (issuePolls.length === 0) return null;

  const active = selectedGroup ? summaries.find((s) => s.label === selectedGroup) : null;

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-muted/40 to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">
            Issue Polling Deep Dive
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Public opinion on key policy areas across {new Set(issuePolls.map((p) => p.source)).size} sources
          · {issuePolls.length} polls tracked
        </p>
      </div>

      {/* Topic selector pills */}
      <div className="px-5 pt-4 pb-2 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
            selectedGroup === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
          }`}
        >
          All Issues
        </button>
        {summaries.map(({ label, group }) => {
          const Icon = group.icon;
          const isActive = selectedGroup === label;
          return (
            <button
              key={label}
              onClick={() => setSelectedGroup(isActive ? null : label)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold border transition-all flex items-center gap-1.5"
              style={{
                backgroundColor: isActive ? `hsl(${group.color} / 0.15)` : undefined,
                borderColor: isActive ? `hsl(${group.color} / 0.4)` : undefined,
                color: isActive ? `hsl(${group.color})` : undefined,
              }}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Summary cards grid */}
      <div className="px-5 py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(selectedGroup ? summaries.filter((s) => s.label === selectedGroup) : summaries).map(
          ({ label, group, avgApprove, avgDisapprove, margin, latest }, idx) => {
            const Icon = group.icon;
            const MarginIcon = margin > 0 ? TrendingUp : margin < 0 ? TrendingDown : Minus;
            return (
              <div
                key={label}
                className="rounded-lg border border-border bg-background p-4 transition-all hover:shadow-md cursor-pointer"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(16px)",
                  transitionDelay: `${idx * 80}ms`,
                  transitionDuration: "600ms",
                  borderLeftWidth: 3,
                  borderLeftColor: `hsl(${group.color})`,
                }}
                onClick={() => setSelectedGroup(selectedGroup === label ? null : label)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="rounded-md p-1.5"
                    style={{ backgroundColor: `hsl(${group.color} / 0.12)` }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-foreground">{label}</span>
                </div>

                {/* Horizontal bar */}
                <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted mb-2">
                  <div
                    className="flex items-center justify-end pr-1.5 transition-all duration-700"
                    style={{
                      width: inView ? `${(avgApprove / (avgApprove + avgDisapprove || 1)) * 100}%` : "0%",
                      backgroundColor: "hsl(150, 55%, 45%)",
                      transitionDelay: `${idx * 80 + 200}ms`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white">{Math.round(avgApprove)}%</span>
                  </div>
                  <div
                    className="flex items-center pl-1.5 transition-all duration-700"
                    style={{
                      width: inView ? `${(avgDisapprove / (avgApprove + avgDisapprove || 1)) * 100}%` : "0%",
                      backgroundColor: "hsl(0, 65%, 50%)",
                      transitionDelay: `${idx * 80 + 300}ms`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white">{Math.round(avgDisapprove)}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{latest.length} source{latest.length !== 1 ? "s" : ""}</span>
                  <span
                    className="inline-flex items-center gap-1 font-bold"
                    style={{ color: margin > 0 ? "hsl(150, 55%, 45%)" : "hsl(0, 65%, 50%)" }}
                  >
                    <MarginIcon className="h-3 w-3" />
                    {margin > 0 ? "+" : ""}{margin.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* Detailed source breakdown */}
      {active && (
        <div className="px-5 pb-5">
          <div className="rounded-lg border border-border overflow-hidden">
            <div
              className="px-4 py-2.5 border-b border-border flex items-center gap-2"
              style={{ backgroundColor: `hsl(${active.group.color} / 0.06)` }}
            >
              <active.group.icon className="h-4 w-4" style={{ color: `hsl(${active.group.color})` }} />
              <span className="text-sm font-bold text-foreground">{active.label} — Source Breakdown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topic</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(150, 55%, 45%)" }}>Approve</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(0, 65%, 50%)" }}>Disapprove</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sample</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {active.polls.map((p) => {
                    const src = getSourceInfo(p.source);
                    const m = p.margin;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${src.color})` }} />
                            <span className="font-medium text-foreground">{src.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">{p.candidate_or_topic}</td>
                        <td className="py-2 px-3 text-center font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>
                          {p.approve_pct ?? p.favor_pct ?? "—"}%
                        </td>
                        <td className="py-2 px-3 text-center font-bold" style={{ color: "hsl(0, 65%, 50%)" }}>
                          {p.disapprove_pct ?? p.oppose_pct ?? "—"}%
                        </td>
                        <td className="py-2 px-3 text-center">
                          {m !== null ? (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold"
                              style={{
                                backgroundColor: m > 0 ? "hsl(150, 55%, 45%, 0.12)" : "hsl(0, 65%, 50%, 0.12)",
                                color: m > 0 ? "hsl(150, 55%, 45%)" : "hsl(0, 65%, 50%)",
                              }}
                            >
                              {m > 0 ? "+" : ""}{m}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                          {p.sample_size ? `n=${p.sample_size.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                          {new Date(p.date_conducted + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-5 pb-4 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(150, 55%, 45%)" }} /> Approve / Favor
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-6 rounded-sm" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /> Disapprove / Oppose
        </span>
        <span className="ml-auto">Averages based on latest poll per source</span>
      </div>
    </div>
  );
}
