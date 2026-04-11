import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { getSourceInfo, type PollEntry } from "@/data/pollingData";
import { usePollPicker, PollPickerButton, PollPickerDropdown } from "@/components/PollingSection";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Globe, DollarSign, Compass, Shield, Heart, Users, Leaf, Crosshair, Scale, Landmark, Briefcase, Home, Award, Cpu, Banknote, Vote, Maximize2 } from "lucide-react";

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
  color: string;
  keywords: string[];
}

const TOPIC_GROUPS: TopicGroup[] = [
  { label: "Direction of Country", icon: Compass, color: "260, 55%, 48%", keywords: ["direction of country", "right direction"] },
  { label: "Economy", icon: DollarSign, color: "150, 55%, 45%", keywords: ["economy", "economic confidence", "trump economy handling"] },
  { label: "Cost of Living", icon: Banknote, color: "30, 80%, 48%", keywords: ["cost of living", "inflation concern", "inflation"] },
  { label: "Iran / Foreign Policy", icon: Globe, color: "25, 90%, 50%", keywords: ["trump iran handling", "iran", "foreign policy"] },
  { label: "Ukraine / Foreign Aid", icon: Globe, color: "200, 70%, 48%", keywords: ["ukraine", "foreign aid"] },
  { label: "Immigration", icon: Shield, color: "210, 75%, 50%", keywords: ["immigration"] },
  { label: "Healthcare", icon: Heart, color: "350, 65%, 50%", keywords: ["healthcare"] },
  { label: "Social Security / Medicare", icon: Landmark, color: "280, 55%, 50%", keywords: ["social security", "medicare"] },
  { label: "Education", icon: Award, color: "170, 60%, 42%", keywords: ["education"] },
  { label: "Climate / Environment", icon: Leaf, color: "120, 55%, 40%", keywords: ["climate", "environment"] },
  { label: "Abortion / Reproductive Rights", icon: Scale, color: "320, 60%, 50%", keywords: ["abortion", "reproductive"] },
  { label: "Gun Policy", icon: Crosshair, color: "0, 50%, 45%", keywords: ["gun policy", "gun"] },
  { label: "National Security", icon: Shield, color: "220, 60%, 45%", keywords: ["national security", "defense"] },
  { label: "Crime / Public Safety", icon: Shield, color: "15, 70%, 48%", keywords: ["crime", "public safety"] },
  { label: "Tariffs / Trade", icon: DollarSign, color: "40, 80%, 45%", keywords: ["tariffs", "trade"] },
  { label: "DOGE", icon: Landmark, color: "45, 70%, 48%", keywords: ["doge"] },
  { label: "Jobs / Employment", icon: Briefcase, color: "180, 55%, 42%", keywords: ["jobs", "employment"] },
  { label: "Housing", icon: Home, color: "35, 65%, 45%", keywords: ["housing"] },
  { label: "Government Spending", icon: Landmark, color: "0, 45%, 55%", keywords: ["government spending", "deficit"] },
  { label: "Democracy / Rule of Law", icon: Vote, color: "240, 55%, 50%", keywords: ["democracy", "rule of law"] },
  { label: "Veterans Affairs", icon: Award, color: "160, 50%, 45%", keywords: ["veterans"] },
  { label: "Tech / AI Policy", icon: Cpu, color: "270, 60%, 52%", keywords: ["tech", "ai policy"] },
  { label: "Cabinet / Personnel", icon: Users, color: "45, 70%, 48%", keywords: ["hegseth", "rubio", "secretary"] },
];

function matchGroup(topic: string): TopicGroup | null {
  const lower = topic.toLowerCase();
  return TOPIC_GROUPS.find((g) => g.keywords.some((kw) => lower.includes(kw))) ?? null;
}

// ─── Demographic Breakdown (Real Data) ──────────────────────────────────────

interface DemoSegment { label: string; approve: number; disapprove: number; count: number; }
interface DemoCategory { title: string; segments: DemoSegment[]; }

const DEMO_GROUP_ORDER = ["party", "age", "gender", "race", "education", "region"];
const DEMO_GROUP_LABELS: Record<string, string> = {
  party: "By Party ID",
  age: "By Age Group",
  gender: "By Gender",
  race: "By Race / Ethnicity",
  education: "By Education",
  region: "By Region",
};

function getRealDemographicData(allPolls: PollEntry[], topicKeywords: string[]): DemoCategory[] {
  // Find polls matching topic keywords that have demographic crosstab data
  const matchingPolls = allPolls.filter((p) => {
    const rd = p.raw_data as any;
    if (!rd?.group_type || !rd?.demographic) return false;
    const lower = p.candidate_or_topic.toLowerCase();
    return topicKeywords.some((kw) => lower.includes(kw));
  });

  // Also include approval polls with demographics as fallback
  const approvalDemoPolls = allPolls.filter((p) => {
    const rd = p.raw_data as any;
    return rd?.group_type && rd?.demographic && p.poll_type === "approval";
  });

  const demoPolls = matchingPolls.length > 0 ? matchingPolls : approvalDemoPolls;

  if (demoPolls.length === 0) return [];

  // Aggregate by group_type -> demographic
  const grouped = new Map<string, Map<string, { totalApprove: number; totalDisapprove: number; count: number }>>();
  demoPolls.forEach((p) => {
    const rd = p.raw_data as any;
    const groupType = rd.group_type as string;
    const demographic = rd.demographic as string;
    if (!grouped.has(groupType)) grouped.set(groupType, new Map());
    const group = grouped.get(groupType)!;
    if (!group.has(demographic)) group.set(demographic, { totalApprove: 0, totalDisapprove: 0, count: 0 });
    const entry = group.get(demographic)!;
    entry.totalApprove += p.approve_pct ?? p.favor_pct ?? 0;
    entry.totalDisapprove += p.disapprove_pct ?? p.oppose_pct ?? 0;
    entry.count += 1;
  });

  const categories: DemoCategory[] = [];
  DEMO_GROUP_ORDER.forEach((groupType) => {
    const demos = grouped.get(groupType);
    if (!demos) return;
    const segments: DemoSegment[] = [];
    demos.forEach((val, demo) => {
      segments.push({
        label: demo,
        approve: Math.round(val.totalApprove / val.count),
        disapprove: Math.round(val.totalDisapprove / val.count),
        count: val.count,
      });
    });
    segments.sort((a, b) => (b.approve - b.disapprove) - (a.approve - a.disapprove));
    categories.push({
      title: DEMO_GROUP_LABELS[groupType] || groupType,
      segments,
    });
  });

  return categories;
}

function DemographicBreakdown({ group, label, allPolls, onSelectPoll }: {
  group: TopicGroup;
  label: string;
  allPolls: PollEntry[];
  onSelectPoll?: (poll: PollEntry) => void;
}) {
  const { ref, inView } = useInView();
  const demos = useMemo(() => getRealDemographicData(allPolls, group.keywords), [allPolls, group.keywords]);

  // Count unique sources used
  const sourceCount = useMemo(() => {
    const sources = new Set<string>();
    allPolls.forEach((p) => {
      const rd = p.raw_data as any;
      if (rd?.group_type && rd?.demographic) sources.add(p.source);
    });
    return sources.size;
  }, [allPolls]);

  if (demos.length === 0) return null;

  return (
    <div ref={ref} className="px-3 pb-3">
      <div className="win98-sunken overflow-hidden">
        <div className="px-3 py-2 border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] flex items-center gap-2" style={{ backgroundColor: `hsl(${group.color} / 0.06)` }}>
          <Users className="h-4 w-4" />
          <span className="text-sm font-bold text-foreground">{label} — Demographic Breakdown</span>
          {onSelectPoll && (
            <button
              className="ml-auto win98-button text-[9px] flex items-center gap-1"
              onClick={() => {
                // Open the latest poll with demographic data for this topic
                const demoPoll = allPolls.find((p) => {
                  const rd = p.raw_data as any;
                  return rd?.group_type && p.poll_type === "issue" && group.keywords.some((kw) => p.candidate_or_topic.toLowerCase().includes(kw));
                }) || allPolls.find((p) => {
                  const rd = p.raw_data as any;
                  return rd?.group_type && p.poll_type === "approval";
                });
                if (demoPoll) onSelectPoll(demoPoll);
              }}
            >
              <Maximize2 className="h-3 w-3" />
              Detail
            </button>
          )}
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {demos.map((cat, catIdx) => (
            <div key={cat.title} className="p-4 border-b border-border sm:odd:border-r">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{cat.title}</p>
              <div className="space-y-2.5">
                {cat.segments.map((seg, segIdx) => {
                  const total = seg.approve + seg.disapprove;
                  const appPct = total > 0 ? (seg.approve / total) * 100 : 50;
                  const disPct = total > 0 ? (seg.disapprove / total) * 100 : 50;
                  const delay = catIdx * 120 + segIdx * 60;
                  return (
                    <div key={seg.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{seg.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          <span style={{ color: "hsl(150, 55%, 45%)" }}>{seg.approve}%</span>{" / "}
                          <span style={{ color: "hsl(0, 65%, 50%)" }}>{seg.disapprove}%</span>
                          {seg.count > 1 && <span className="ml-1 text-muted-foreground/60">({seg.count} polls)</span>}
                        </span>
                      </div>
                      <div className="flex h-4 w-full overflow-hidden rounded-md bg-muted">
                        <div className="h-full transition-all duration-700 ease-out" style={{ width: inView ? `${appPct}%` : "0%", backgroundColor: "hsl(150, 55%, 45%)", transitionDelay: `${delay}ms` }} />
                        <div className="h-full transition-all duration-700 ease-out" style={{ width: inView ? `${disPct}%` : "0%", backgroundColor: "hsl(0, 65%, 50%)", transitionDelay: `${delay + 100}ms` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-1.5 border-t border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))]">
          <p className="text-[9px] text-muted-foreground">
            Demographic cross-tabs aggregated from {sourceCount} source{sourceCount !== 1 ? "s" : ""} with crosstab data (AP-NORC, Emerson, Fox News, Quinnipiac, and more).
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface IssuePollingProps {
  polls: PollEntry[];
  onSelectPoll?: (poll: PollEntry) => void;
}

export default function IssuePollingSection({ polls, onSelectPoll }: IssuePollingProps) {
  const { ref, inView } = useInView();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const issueFilter = useCallback((p: PollEntry) => p.poll_type === "issue", []);
  const picker = usePollPicker(polls, issueFilter);

  const issuePolls = useMemo(
    () => picker.filteredPolls.filter((p) => p.poll_type === "issue"),
    [picker.filteredPolls],
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
    map.forEach((v) => v.polls.sort((a, b) => b.date_conducted.localeCompare(a.date_conducted)));
    return map;
  }, [issuePolls]);

  // Summary stats per group
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
    <div ref={ref} className="candidate-card overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Issue Polling Deep Dive
            </h2>
          </div>
          <PollPickerButton showPicker={picker.showPicker} setShowPicker={picker.setShowPicker} isAll={picker.isAll} count={picker.selectedIds.size} />
        </div>
        <p className="text-xs text-muted-foreground">
          {picker.isAll
            ? `Public opinion on key policy areas across ${new Set(issuePolls.map((p) => p.source)).size} sources · ${issuePolls.length} polls tracked`
            : `${picker.selectedIds.size} poll${picker.selectedIds.size !== 1 ? "s" : ""} selected · ${issuePolls.length} matching polls`}
        </p>
        {picker.showPicker && (
          <div className="mt-3">
            <PollPickerDropdown uniquePolls={picker.uniquePolls} selectedIds={picker.selectedIds} isAll={picker.isAll} toggle={picker.toggle} setSelectedIds={picker.setSelectedIds} />
          </div>
        )}
      </div>

      {/* Topic selector pills */}
      <div className="px-3 pt-2 pb-1 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`win98-button text-[10px] ${
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
              className="win98-button text-[10px] flex items-center gap-1.5"
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
      <div className="px-3 py-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(selectedGroup ? summaries.filter((s) => s.label === selectedGroup) : summaries).map(
          ({ label, group, avgApprove, avgDisapprove, margin, latest, polls: gPolls }, idx) => {
            const Icon = group.icon;
            const MarginIcon = margin > 0 ? TrendingUp : margin < 0 ? TrendingDown : Minus;
            return (
              <div
                key={label}
                className="candidate-card p-3 transition-all hover:bg-[hsl(var(--win98-light))] cursor-pointer"
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
                  {onSelectPoll && (
                    <button
                      className="ml-auto p-1 rounded hover:bg-accent transition-colors"
                      title="Open detail view"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (gPolls[0]) onSelectPoll(gPolls[0]);
                      }}
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
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
        <div className="px-3 pb-3">
          <div className="win98-sunken overflow-hidden">
            <div
              className="px-3 py-2 border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))] flex items-center gap-2"
              style={{ backgroundColor: `hsl(${active.group.color} / 0.06)` }}
            >
              <active.group.icon className="h-4 w-4" />
              <span className="text-sm font-bold text-foreground">{active.label} — Source Breakdown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--win98-shadow))] bg-[hsl(var(--win98-face))]">
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
                      <tr
                        key={p.id}
                        className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] transition-colors cursor-pointer"
                        onClick={() => onSelectPoll?.(p)}
                      >
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

      {/* Demographic Breakdown — now using real data */}
      {active && <DemographicBreakdown group={active.group} label={active.label} allPolls={polls} onSelectPoll={onSelectPoll} />}

      <div className="px-3 pb-3 flex items-center gap-4 text-[10px] text-muted-foreground">
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
