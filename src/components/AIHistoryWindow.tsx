// AI Generation History viewer. Shows a unified, chronologically-sorted log of
// every AI output produced across the app (talking points, impact analyses,
// OSINT parses, briefings, etc.) with version numbers and a snapshot viewer.
//
// Scope:
//   • Regular users only see their own AI generations.
//   • Admins get a "Mine / All users" toggle to inspect every user's history.
import { useState, useMemo } from "react";
import { useAIGenerationHistory, type AIHistoryRow } from "@/hooks/useAIGenerationHistory";
import { Loader2, Copy, Check, Download, Shield } from "lucide-react";
import { toast } from "sonner";

interface AIHistoryWindowProps {
  /** Optional initial feature filter (e.g. "messaging_talking_points") */
  initialFeature?: string;
  /** Optional subject scope filter */
  initialSubjectType?: string;
  initialSubjectRef?: string;
}

const FEATURE_LABELS: Record<string, string> = {
  messaging_talking_points: "Messaging — Talking Points",
  messaging_audience_analysis: "Messaging — Audience",
  messaging_impact: "Messaging — Impact",
  subject_talking_points: "Subject — Talking Points",
  subject_audience_analysis: "Subject — Audience",
  subject_impact_analysis: "Subject — Impact",
  bill_impact: "Bill Impact",
  vulnerability_score: "Vulnerability Score",
  geopolitics_brief: "Geopolitics Brief",
  osint_scrape_parse: "OSINT Scrape/Parse",
  candidate_scraper: "Candidate Scraper",
  research_chat: "Research Chat",
  intel_briefing: "Intel Briefing",
  auto_docs: "Auto Docs",
  scenario_simulator: "Scenario Simulator",
  talking_points: "Talking Points",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const RANGE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "All time", hours: null },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7 days", hours: 24 * 7 },
  { label: "Last 30 days", hours: 24 * 30 },
];

export function AIHistoryWindow({ initialFeature, initialSubjectType, initialSubjectRef }: AIHistoryWindowProps) {
  const [feature, setFeature] = useState<string>(initialFeature ?? "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AIHistoryRow | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [rangeHours, setRangeHours] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { rows, loading, error, reload, isAdmin, effectiveScope } = useAIGenerationHistory({
    feature: feature || undefined,
    subject_type: initialSubjectType,
    subject_ref: initialSubjectRef,
    limit: 200,
    scope,
  });

  const features = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.feature));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (rangeHours != null) {
      const cutoff = Date.now() - rangeHours * 3600 * 1000;
      out = out.filter(r => new Date(r.created_at).getTime() >= cutoff);
    }
    if (statusFilter) out = out.filter(r => r.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      out = out.filter(r =>
        r.feature.toLowerCase().includes(s) ||
        (r.subject_ref ?? "").toLowerCase().includes(s) ||
        (r.subject_type ?? "").toLowerCase().includes(s) ||
        (r.model ?? "").toLowerCase().includes(s) ||
        (r.prompt_summary ?? "").toLowerCase().includes(s)
      );
    }
    return out;
  }, [rows, search, rangeHours, statusFilter]);

  const copyJson = () => {
    if (!selected) return;
    navigator.clipboard.writeText(JSON.stringify(selected.output, null, 2));
    setCopied(true);
    toast.success("Output snapshot copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const exportCsv = () => {
    const header = ["created_at","feature","subject_type","subject_ref","model","version","status","duration_ms","triggered_by"];
    const lines = [header.join(",")];
    filtered.forEach(r => {
      lines.push([
        r.created_at, r.feature,
        r.subject_type ?? "", r.subject_ref ?? "",
        r.model ?? "", r.version, r.status,
        r.duration_ms ?? "", r.triggered_by ?? "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ai-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  };

  return (
    <div className="p-2 text-[11px] flex flex-col h-full bg-[hsl(var(--win98-face))]">
      {/* Toolbar row 1 — scope + filters */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {isAdmin && (
          <div className="flex items-center gap-1 win98-sunken bg-white px-1 py-[1px]">
            <Shield className="h-3 w-3 text-primary" />
            <button
              onClick={() => setScope("mine")}
              className={`px-2 py-[1px] text-[11px] ${scope === "mine" ? "bg-[hsl(var(--win98-titlebar))] text-white" : ""}`}
            >Mine</button>
            <button
              onClick={() => setScope("all")}
              className={`px-2 py-[1px] text-[11px] ${scope === "all" ? "bg-[hsl(var(--win98-titlebar))] text-white" : ""}`}
            >All users</button>
          </div>
        )}
        <select
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          className="win98-sunken bg-white px-1 py-[1px] text-[11px]"
        >
          <option value="">All AI features</option>
          {features.map(f => (
            <option key={f} value={f}>{FEATURE_LABELS[f] ?? f}</option>
          ))}
        </select>
        <select
          value={String(rangeHours ?? "")}
          onChange={(e) => setRangeHours(e.target.value === "" ? null : Number(e.target.value))}
          className="win98-sunken bg-white px-1 py-[1px] text-[11px]"
        >
          {RANGE_OPTIONS.map(o => (
            <option key={o.label} value={o.hours ?? ""}>{o.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="win98-sunken bg-white px-1 py-[1px] text-[11px]"
        >
          <option value="">All statuses</option>
          <option value="success">success</option>
          <option value="error">error</option>
          <option value="partial">partial</option>
        </select>
        <button onClick={reload} className="win98-button px-2 py-[1px] text-[11px]">Refresh</button>
        <button onClick={exportCsv} className="win98-button px-2 py-[1px] text-[11px] flex items-center gap-1">
          <Download className="h-3 w-3" /> CSV
        </button>
      </div>

      {/* Toolbar row 2 — search */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <input
          type="text"
          placeholder="Search subject / model / prompt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="win98-sunken bg-white px-1 py-[1px] text-[11px] flex-1 min-w-[160px]"
        />
        <span className="text-[10px] text-muted-foreground">
          {filtered.length} of {rows.length} · {effectiveScope === "all" ? "all users" : "your history"}
        </span>
      </div>

      {/* Body: split list / detail */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 min-h-0">
        {/* List */}
        <div className="win98-sunken bg-white overflow-auto">
          {loading && (
            <div className="p-3 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
            </div>
          )}
          {error && <div className="p-3 text-destructive">Error: {error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-3 text-muted-foreground italic">
              {scope === "mine"
                ? "You haven't run any AI tools yet (with this filter). Try generating talking points, impact analyses, or briefings — they'll appear here automatically."
                : "No AI generations match this filter."}
            </div>
          )}
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[hsl(var(--win98-face))] text-left">
              <tr>
                <th className="px-1 py-[2px]">When</th>
                <th className="px-1 py-[2px]">Feature</th>
                <th className="px-1 py-[2px]">Subject</th>
                <th className="px-1 py-[2px]">v</th>
                <th className="px-1 py-[2px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`cursor-pointer ${selected?.id === r.id ? "bg-[hsl(var(--win98-titlebar))] text-white" : "hover:bg-[hsl(var(--win98-light))]"}`}
                  title={formatTime(r.created_at)}
                >
                  <td className="px-1 py-[2px] whitespace-nowrap">{relativeTime(r.created_at)}</td>
                  <td className="px-1 py-[2px]">{FEATURE_LABELS[r.feature] ?? r.feature}</td>
                  <td className="px-1 py-[2px] truncate max-w-[160px]">{r.subject_ref ?? "—"}</td>
                  <td className="px-1 py-[2px]">{r.version}</td>
                  <td className="px-1 py-[2px]">
                    <span className={r.status === "error" ? "text-destructive" : r.status === "partial" ? "text-amber-600" : ""}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div className="win98-sunken bg-white overflow-auto p-2">
          {!selected ? (
            <div className="text-muted-foreground italic">Select an entry to view its snapshot.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{FEATURE_LABELS[selected.feature] ?? selected.feature} — v{selected.version}</div>
                <button
                  onClick={copyJson}
                  className="win98-button px-2 py-[1px] text-[10px] flex items-center gap-1"
                  title="Copy output JSON"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-[2px] text-[10px]">
                <div><span className="font-bold">Subject:</span> {selected.subject_type ?? "—"} / {selected.subject_ref ?? "—"}</div>
                <div><span className="font-bold">Model:</span> {selected.model ?? "—"}</div>
                <div><span className="font-bold">Source:</span> {selected.trigger_source}</div>
                <div><span className="font-bold">Status:</span> {selected.status}</div>
                <div><span className="font-bold">Created:</span> {formatTime(selected.created_at)}</div>
                <div><span className="font-bold">Duration:</span> {selected.duration_ms != null ? `${selected.duration_ms}ms` : "—"}</div>
                {effectiveScope === "all" && (
                  <div className="col-span-2"><span className="font-bold">Triggered by:</span> {selected.triggered_by ?? "—"}</div>
                )}
              </div>
              {selected.prompt_summary && (
                <div>
                  <div className="font-bold">Prompt summary</div>
                  <div className="whitespace-pre-wrap text-[10px] bg-[hsl(var(--win98-face))] p-1">{selected.prompt_summary}</div>
                </div>
              )}
              <div>
                <div className="font-bold">Output snapshot</div>
                <pre className="text-[10px] bg-[hsl(var(--win98-face))] p-1 overflow-auto whitespace-pre-wrap">{JSON.stringify(selected.output, null, 2)}</pre>
              </div>
              {selected.error_message && (
                <div className="text-destructive">
                  <div className="font-bold">Error</div>
                  <div className="text-[10px]">{selected.error_message}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
