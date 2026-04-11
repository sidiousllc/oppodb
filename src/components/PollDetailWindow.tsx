import { useState } from "react";
import { Win98Window } from "@/components/Win98Window";
import { getSourceInfo, POLL_TYPES, type PollEntry } from "@/data/pollingData";
import {
  BarChart3, ExternalLink, Clock, Users, Target, FileText,
  TrendingUp, TrendingDown, Minus, Activity, Info, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";

interface DemoEntry { demographic: string; approve: number; disapprove: number; source?: string; date?: string; sampleSize?: number }

interface Props {
  poll: PollEntry;
  allPolls: PollEntry[];
  onClose: () => void;
  onSelectPoll?: (poll: PollEntry) => void;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function probColor(approve: boolean) {
  return approve ? "hsl(150, 55%, 45%)" : "hsl(0, 65%, 50%)";
}

export function PollDetailWindow({ poll, allPolls, onClose, onSelectPoll }: Props) {
  const [demoDetailGroup, setDemoDetailGroup] = useState<string | null>(null);
  const p = poll;
  const src = getSourceInfo(p.source);
  const primaryPct = p.approve_pct ?? p.favor_pct;
  const secondaryPct = p.disapprove_pct ?? p.oppose_pct;
  const isApproval = p.approve_pct != null;
  const primaryLabel = isApproval ? "Approve" : "Favor";
  const secondaryLabel = isApproval ? "Disapprove" : "Oppose";
  const neutral = primaryPct != null && secondaryPct != null
    ? Math.max(0, 100 - primaryPct - secondaryPct) : 0;
  const pollTypeLabel = POLL_TYPES.find(t => t.id === p.poll_type)?.label ?? p.poll_type;

  // Result pie
  const resultPie = [
    primaryPct != null && { name: primaryLabel, value: primaryPct, color: "hsl(150, 55%, 45%)" },
    secondaryPct != null && { name: secondaryLabel, value: secondaryPct, color: "hsl(0, 65%, 50%)" },
    neutral > 0.5 && { name: "Undecided/Other", value: +neutral.toFixed(1), color: "hsl(var(--muted-foreground))" },
  ].filter(Boolean) as { name: string; value: number; color: string }[];

  // Demographic crosstabs: ONLY from this specific poll's own data
  const rawData = (p.raw_data || {}) as Record<string, unknown>;
  const pollDemoGroups = new Map<string, DemoEntry[]>();

  // Check if this poll itself has a group_type (it IS a crosstab row)
  if (rawData.group_type) {
    const group = (rawData.group_type as string);
    const demo = (rawData.demographic as string) || "Unknown";
    pollDemoGroups.set(group, [{
      demographic: demo,
      approve: p.approve_pct ?? p.favor_pct ?? 0,
      disapprove: p.disapprove_pct ?? p.oppose_pct ?? 0,
    }]);
  }

  // Check inline demographics array
  const demographics = rawData.demographics as Array<{
    group_type?: string; demographic?: string; approve_pct?: number; disapprove_pct?: number;
  }> | undefined;
  if (demographics && Array.isArray(demographics)) {
    demographics.forEach(d => {
      const group = d.group_type || "Other";
      if (!pollDemoGroups.has(group)) pollDemoGroups.set(group, []);
      pollDemoGroups.get(group)!.push({
        demographic: d.demographic || "Unknown",
        approve: d.approve_pct ?? 0,
        disapprove: d.disapprove_pct ?? 0,
      });
    });
  }

  // Also find sibling crosstab rows from the same source/topic/date for this poll
  const siblingCrosstabs = allPolls.filter(o => {
    if (o.id === p.id) return false;
    const rd = (o.raw_data || {}) as Record<string, unknown>;
    return rd.group_type &&
      o.source === p.source &&
      o.candidate_or_topic === p.candidate_or_topic &&
      Math.abs(new Date(o.date_conducted).getTime() - new Date(p.date_conducted).getTime()) < 7 * 24 * 60 * 60 * 1000;
  });
  siblingCrosstabs.forEach(o => {
    const rd = (o.raw_data || {}) as Record<string, unknown>;
    const group = (rd.group_type as string) || "Other";
    if (!pollDemoGroups.has(group)) pollDemoGroups.set(group, []);
    pollDemoGroups.get(group)!.push({
      demographic: (rd.demographic as string) || "Unknown",
      approve: o.approve_pct ?? o.favor_pct ?? 0,
      disapprove: o.disapprove_pct ?? o.oppose_pct ?? 0,
    });
  });

  // Full cross-source demographic data (for the detail window)
  const buildFullDemoData = (groupType: string): DemoEntry[] => {
    return allPolls.filter(o => {
      const rd = (o.raw_data || {}) as Record<string, unknown>;
      return rd.group_type === groupType && o.candidate_or_topic === p.candidate_or_topic;
    }).map(o => {
      const rd = (o.raw_data || {}) as Record<string, unknown>;
      return {
        demographic: (rd.demographic as string) || "Unknown",
        approve: o.approve_pct ?? o.favor_pct ?? 0,
        disapprove: o.disapprove_pct ?? o.oppose_pct ?? 0,
        source: o.source,
        date: o.date_conducted,
        sampleSize: o.sample_size ?? undefined,
      };
    }).sort((a, b) => a.demographic.localeCompare(b.demographic));
  };

  // Same-source polls for context
  const sameSrcPolls = allPolls.filter(o =>
    o.id !== p.id &&
    o.source === p.source &&
    o.candidate_or_topic === p.candidate_or_topic
  ).sort((a, b) => b.date_conducted.localeCompare(a.date_conducted)).slice(0, 6);

  // Trend from same-source polls
  const trendData = [...sameSrcPolls, p]
    .sort((a, b) => a.date_conducted.localeCompare(b.date_conducted))
    .map(o => ({
      date: new Date(o.date_conducted + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      approve: o.approve_pct ?? o.favor_pct ?? 0,
      disapprove: o.disapprove_pct ?? o.oppose_pct ?? 0,
      isCurrent: o.id === p.id,
    }));

  // Cross-pollster comparison: same topic, same date range
  const crossPollster = allPolls.filter(o =>
    o.id !== p.id &&
    o.candidate_or_topic === p.candidate_or_topic &&
    Math.abs(new Date(o.date_conducted).getTime() - new Date(p.date_conducted).getTime()) < 30 * 24 * 60 * 60 * 1000
  ).slice(0, 8);

  const crossPollsterData = [
    { source: src.name, approve: primaryPct ?? 0, disapprove: secondaryPct ?? 0, color: `hsl(${src.color})` },
    ...crossPollster.map(o => {
      const s = getSourceInfo(o.source);
      return {
        source: s.name,
        approve: o.approve_pct ?? o.favor_pct ?? 0,
        disapprove: o.disapprove_pct ?? o.oppose_pct ?? 0,
        color: `hsl(${s.color})`,
      };
    }),
  ];

  // Confidence assessment
  const confidence = (() => {
    let score = 0;
    if (p.sample_size && p.sample_size >= 1000) score += 2;
    else if (p.sample_size && p.sample_size >= 500) score += 1;
    if (p.margin_of_error && p.margin_of_error <= 3) score += 2;
    else if (p.margin_of_error && p.margin_of_error <= 4) score += 1;
    if (p.methodology && p.methodology !== "Unknown") score += 1;
    if (p.sample_type === "LV") score += 1;
    else if (p.sample_type === "RV") score += 0.5;
    if (score >= 5) return { label: "High", color: "hsl(150, 55%, 45%)" };
    if (score >= 3) return { label: "Medium", color: "hsl(45, 80%, 50%)" };
    return { label: "Low", color: "hsl(0, 65%, 50%)" };
  })();

  return (
    <Win98Window
      title={`Poll: ${p.candidate_or_topic} — ${src.name}`}
      icon={<BarChart3 className="h-3.5 w-3.5 text-white" />}
      onClose={onClose}
      defaultPosition={{ x: Math.max(40, window.innerWidth / 2 - 360), y: 30 }}
      defaultSize={{ width: 720, height: Math.min(window.innerHeight - 70, 740) }}
      minSize={{ width: 400, height: 300 }}
      statusBar={<span>Poll ID: {p.id.slice(0, 8)}… · {pollTypeLabel}</span>}
    >
      <div className="p-4 space-y-4 text-xs">
        {/* Header */}
        <div>
          <div className="flex items-start gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: `hsl(${src.color})` }} />
            <div>
              <h2 className="font-display text-base font-bold text-foreground leading-tight">{p.candidate_or_topic}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{src.name} · {pollTypeLabel}</p>
            </div>
          </div>
          {p.question && (
            <div className="mt-2 candidate-card p-3 flex gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-foreground italic">"{p.question}"</p>
            </div>
          )}
        </div>

        {/* Result Bar */}
        <div className="candidate-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Result</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-display font-bold" style={{ color: probColor(true) }}>
                {primaryPct ?? "—"}%
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg font-display font-bold" style={{ color: probColor(false) }}>
                {secondaryPct ?? "—"}%
              </span>
            </div>
          </div>
          <div className="h-5 rounded-full bg-muted overflow-hidden flex">
            {primaryPct != null && (
              <div className="h-full flex items-center justify-center transition-all" style={{ width: `${primaryPct}%`, backgroundColor: "hsl(150, 55%, 45%)" }}>
                {primaryPct > 12 && <span className="text-[9px] font-bold text-white">{primaryLabel} {primaryPct}%</span>}
              </div>
            )}
            {neutral > 0.5 && (
              <div className="h-full bg-muted-foreground/20 flex items-center justify-center" style={{ width: `${neutral}%` }}>
                {neutral > 8 && <span className="text-[9px] text-muted-foreground">{neutral.toFixed(0)}%</span>}
              </div>
            )}
            {secondaryPct != null && (
              <div className="h-full flex items-center justify-center transition-all" style={{ width: `${secondaryPct}%`, backgroundColor: "hsl(0, 65%, 50%)" }}>
                {secondaryPct > 12 && <span className="text-[9px] font-bold text-white">{secondaryLabel} {secondaryPct}%</span>}
              </div>
            )}
          </div>
          {p.margin != null && (
            <div className="flex items-center gap-1.5 mt-2">
              {p.margin > 0 ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(150,55%,45%)]" /> :
               p.margin < 0 ? <TrendingDown className="h-3.5 w-3.5 text-[hsl(0,65%,50%)]" /> :
               <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="font-bold" style={{ color: p.margin > 0 ? "hsl(150,55%,45%)" : p.margin < 0 ? "hsl(0,65%,50%)" : undefined }}>
                {p.margin > 0 ? "+" : ""}{p.margin}% net {primaryLabel.toLowerCase()}
              </span>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: Users, label: "Sample Size", value: p.sample_size ? `n=${p.sample_size.toLocaleString()}` : "—" },
            { icon: Target, label: "MoE", value: p.margin_of_error ? `±${p.margin_of_error}%` : "—" },
            { icon: Activity, label: "Methodology", value: p.methodology || "—" },
            { icon: Info, label: "Sample Type", value: p.sample_type || "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="candidate-card p-3 text-center">
              <Icon className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="font-bold text-foreground text-sm">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Details Grid */}
        <div className="candidate-card p-4 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Poll Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Source:</span><span className="font-bold text-foreground">{src.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span className="font-bold text-foreground">{pollTypeLabel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{primaryLabel}:</span><span className="font-bold" style={{ color: probColor(true) }}>{primaryPct ?? "—"}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{secondaryLabel}:</span><span className="font-bold" style={{ color: probColor(false) }}>{secondaryPct ?? "—"}%</span></div>
            {p.partisan_lean && (
              <div className="flex justify-between"><span className="text-muted-foreground">Partisan Lean:</span><span className="font-bold text-foreground">{p.partisan_lean}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence:</span>
              <span className="font-bold" style={{ color: confidence.color }}>{confidence.label}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border mt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Conducted: {fmtDate(p.date_conducted)}{p.end_date && p.end_date !== p.date_conducted ? ` – ${fmtDate(p.end_date)}` : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Updated: {fmtDate(p.updated_at?.split("T")[0] ?? null)}</span>
            </div>
          </div>
        </div>

        {/* Result Pie + Cross-Pollster */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Result Breakdown</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={resultPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                  label={({ name, value }: any) => `${name} ${value}%`}
                  labelLine={false} style={{ fontSize: 10 }}>
                  {resultPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => [`${v}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {crossPollsterData.length > 1 ? (
            <div className="candidate-card p-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Cross-Pollster Comparison</h3>
              <p className="text-[9px] text-muted-foreground mb-1">Same topic, within 30 days</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={crossPollsterData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="source" tick={{ fontSize: 8 }} angle={-20} textAnchor="end" height={40} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    formatter={(v: number, name: string) => [`${v}%`, name]} />
                  <Bar dataKey="approve" name={primaryLabel} fill="hsl(150, 55%, 45%)" radius={[2, 2, 0, 0]} barSize={10} />
                  <Bar dataKey="disapprove" name={secondaryLabel} fill="hsl(0, 65%, 50%)" radius={[2, 2, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="candidate-card p-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Single Source</h3>
              <div className="flex items-center justify-center h-32 text-center text-muted-foreground">
                <div>
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-[10px]">No other pollsters covered this topic in the same period</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Demographic Crosstabs */}
        {demoGroups.size > 0 && (
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Demographic Breakdown — {p.candidate_or_topic}
            </h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              {[...demoGroups.values()].reduce((s, a) => s + a.length, 0)} crosstab data points across {demoGroups.size} categories
            </p>
            <div className="space-y-3">
              {[...demoGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, entries]) => (
                <div key={group}>
                  <p className="text-[10px] font-bold text-foreground mb-1.5 capitalize">{group}</p>
                  <div className="space-y-1">
                    {entries.map((e, i) => (
                      <div key={`${e.demographic}-${i}`} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-32 shrink-0 truncate" title={e.demographic}>{e.demographic}</span>
                        <div className="flex-1 h-3.5 rounded bg-muted overflow-hidden flex">
                          <div className="h-full transition-all" style={{ width: `${e.approve}%`, backgroundColor: "hsl(150, 55%, 45%)" }}>
                            {e.approve > 15 && <span className="text-[7px] text-white font-bold leading-[14px] pl-1">{e.approve}%</span>}
                          </div>
                          <div className="h-full transition-all" style={{ width: `${e.disapprove}%`, backgroundColor: "hsl(0, 65%, 50%)" }}>
                            {e.disapprove > 15 && <span className="text-[7px] text-white font-bold leading-[14px] pl-1">{e.disapprove}%</span>}
                          </div>
                        </div>
                        <span className="text-[9px] font-bold w-20 text-right shrink-0">
                          <span style={{ color: "hsl(150,55%,45%)" }}>{e.approve}%</span>
                          <span className="text-muted-foreground mx-0.5">/</span>
                          <span style={{ color: "hsl(0,65%,50%)" }}>{e.disapprove}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source Trend (same pollster over time) */}
        {trendData.length > 1 && (
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {src.name} Trend — {p.candidate_or_topic}
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                <RechartsTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Bar dataKey="approve" name={primaryLabel} fill="hsl(150, 55%, 45%)" radius={[2, 2, 0, 0]} barSize={12} />
                <Bar dataKey="disapprove" name={secondaryLabel} fill="hsl(0, 65%, 50%)" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Source Link */}
        {p.source_url && (
          <a href={p.source_url} target="_blank" rel="noopener noreferrer"
            className="win98-button text-[10px] flex items-center gap-1.5 w-fit">
            <ExternalLink className="h-3.5 w-3.5" />
            View Original at {src.name}
          </a>
        )}

        {/* Related Polls from same source */}
        {sameSrcPolls.length > 0 && (
          <div className="candidate-card p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Other {src.name} Polls — {p.candidate_or_topic} ({sameSrcPolls.length})
            </h3>
            <div className="space-y-1.5">
              {sameSrcPolls.map(r => {
                const rPrimary = r.approve_pct ?? r.favor_pct;
                const rSecondary = r.disapprove_pct ?? r.oppose_pct;
                return (
                  <div key={r.id}
                    className="flex items-center gap-2 py-1 border-b border-[hsl(var(--win98-light))] last:border-0 cursor-pointer hover:bg-[hsl(var(--win98-light))]"
                    onClick={() => onSelectPoll?.(r)}
                  >
                    <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                      {new Date(r.date_conducted + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 h-2.5 rounded bg-muted overflow-hidden flex">
                      <div className="h-full" style={{ width: `${rPrimary ?? 0}%`, backgroundColor: "hsl(150, 55%, 45%)" }} />
                      <div className="h-full" style={{ width: `${rSecondary ?? 0}%`, backgroundColor: "hsl(0, 65%, 50%)" }} />
                    </div>
                    <span className="text-[9px] font-bold shrink-0">
                      <span style={{ color: "hsl(150,55%,45%)" }}>{rPrimary ?? "—"}%</span>
                      <span className="text-muted-foreground mx-0.5">/</span>
                      <span style={{ color: "hsl(0,65%,50%)" }}>{rSecondary ?? "—"}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Win98Window>
  );
}
