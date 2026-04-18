// AI Generation History viewer. Shows a unified, chronologically-sorted log of
// every AI output produced across the app (talking points, impact analyses,
// OSINT parses, briefings, etc.) with version numbers and a snapshot viewer.
import { useState, useMemo } from "react";
import { useAIGenerationHistory, type AIHistoryRow } from "@/hooks/useAIGenerationHistory";
import { Loader2 } from "lucide-react";

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

export function AIHistoryWindow({ initialFeature, initialSubjectType, initialSubjectRef }: AIHistoryWindowProps) {
  const [feature, setFeature] = useState<string>(initialFeature ?? "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AIHistoryRow | null>(null);

  const { rows, loading, error, reload } = useAIGenerationHistory({
    feature: feature || undefined,
    subject_type: initialSubjectType,
    subject_ref: initialSubjectRef,
    limit: 200,
  });

  const features = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.feature));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      r.feature.toLowerCase().includes(s) ||
      (r.subject_ref ?? "").toLowerCase().includes(s) ||
      (r.subject_type ?? "").toLowerCase().includes(s) ||
      (r.model ?? "").toLowerCase().includes(s) ||
      (r.prompt_summary ?? "").toLowerCase().includes(s)
    );
  }, [rows, search]);

  return (
    <div className="p-2 text-[11px] flex flex-col h-full bg-[hsl(var(--win98-face))]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
        <input
          type="text"
          placeholder="Search subject / model / prompt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="win98-sunken bg-white px-1 py-[1px] text-[11px] flex-1 min-w-[160px]"
        />
        <button onClick={reload} className="win98-button px-2 py-[1px] text-[11px]">Refresh</button>
        <span className="text-[10px] text-muted-foreground">{filtered.length} entries</span>
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
          {error && <div className="p-3 text-red-700">Error: {error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-3 text-muted-foreground italic">
              No AI generations recorded yet for this filter. Generations will appear here automatically the next time an AI tool is run.
            </div>
          )}
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[hsl(var(--win98-face))] text-left">
              <tr>
                <th className="px-1 py-[2px]">When</th>
                <th className="px-1 py-[2px]">Feature</th>
                <th className="px-1 py-[2px]">Subject</th>
                <th className="px-1 py-[2px]">v</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`cursor-pointer ${selected?.id === r.id ? "bg-[hsl(var(--win98-titlebar))] text-white" : "hover:bg-[hsl(var(--win98-light))]"}`}
                >
                  <td className="px-1 py-[2px] whitespace-nowrap">{formatTime(r.created_at)}</td>
                  <td className="px-1 py-[2px]">{FEATURE_LABELS[r.feature] ?? r.feature}</td>
                  <td className="px-1 py-[2px] truncate max-w-[160px]">{r.subject_ref ?? "—"}</td>
                  <td className="px-1 py-[2px]">{r.version}</td>
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
              <div className="font-bold">{FEATURE_LABELS[selected.feature] ?? selected.feature} — v{selected.version}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-[2px] text-[10px]">
                <div><span className="font-bold">Subject:</span> {selected.subject_type ?? "—"} / {selected.subject_ref ?? "—"}</div>
                <div><span className="font-bold">Model:</span> {selected.model ?? "—"}</div>
                <div><span className="font-bold">Source:</span> {selected.trigger_source}</div>
                <div><span className="font-bold">Status:</span> {selected.status}</div>
                <div><span className="font-bold">Created:</span> {formatTime(selected.created_at)}</div>
                <div><span className="font-bold">Duration:</span> {selected.duration_ms != null ? `${selected.duration_ms}ms` : "—"}</div>
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
                <div className="text-red-700">
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
