import { useEffect, useState } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface CheckEntry {
  name: string;
  entry: string;
  parse: "ok" | "fail" | "skipped" | "blocked";
  parse_location?: { file: string; line: number; column: number };
  parse_error?: string;
  types: "ok" | "fail" | "skipped" | "blocked";
  types_location?: { file: string; line: number; column: number };
  types_error?: string;
}

interface Report {
  generated_at: string;
  totals: {
    total: number;
    passed: number;
    parse_failures: number;
    type_failures: number;
    skipped: number;
  };
  checks: CheckEntry[];
}

type Tab = "all" | "parse" | "types" | "ok";

const STATUS_COLORS = {
  ok: "bg-[hsl(120_60%_35%)] text-white",
  fail: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
  blocked: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  skipped: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

function Pill({ status }: { status: CheckEntry["parse"] }) {
  return (
    <span className={`px-1.5 py-[1px] text-[9px] font-bold uppercase ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

function DeployChecklistContent() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { isAdmin } = useIsAdmin();

  const load = async () => {
    setLoading(true);
    try {
      // Cache-bust so a freshly generated report shows up immediately.
      const res = await fetch(`/predeploy-report.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`No report found (HTTP ${res.status}). Run \`node scripts/check-edge-functions.mjs\` to generate one.`);
      const data = (await res.json()) as Report;
      setReport(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = (() => {
    if (!report) return [];
    if (tab === "parse") return report.checks.filter(c => c.parse === "fail");
    if (tab === "types") return report.checks.filter(c => c.types === "fail");
    if (tab === "ok") return report.checks.filter(c => c.parse === "ok" && c.types === "ok");
    return report.checks;
  })();

  if (!isAdmin) {
    return (
      <div className="p-3 text-[11px] text-[hsl(var(--destructive))] flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl">🛡️</span>
        <p className="font-bold">Admin Access Required</p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center">
          Only admins can view the Deploy Checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 text-[11px] space-y-2 bg-[hsl(var(--win98-face))] h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 win98-sunken px-2 py-1">
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-bold">Deploy Checklist</span>
          {report && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              {new Date(report.generated_at).toLocaleString()}
            </span>
          )}
        </div>
        <button onClick={load} disabled={loading} className="win98-button text-[10px] px-2 py-[1px]">
          {loading ? "…" : "Reload"}
        </button>
      </div>

      {/* Summary tiles */}
      {report && (
        <div className="grid grid-cols-4 gap-1 text-center">
          <button onClick={() => setTab("all")}
            className={`win98-sunken py-1 px-1 ${tab === "all" ? "bg-[hsl(var(--win98-light))]" : "bg-[hsl(var(--win98-face))]"}`}>
            <div className="text-[9px] uppercase text-[hsl(var(--muted-foreground))]">Total</div>
            <div className="font-bold">{report.totals.total}</div>
          </button>
          <button onClick={() => setTab("ok")}
            className={`win98-sunken py-1 px-1 ${tab === "ok" ? "bg-[hsl(var(--win98-light))]" : "bg-[hsl(var(--win98-face))]"}`}>
            <div className="text-[9px] uppercase text-[hsl(120_60%_35%)]">Pass</div>
            <div className="font-bold">{report.totals.passed}</div>
          </button>
          <button onClick={() => setTab("parse")}
            className={`win98-sunken py-1 px-1 ${tab === "parse" ? "bg-[hsl(var(--win98-light))]" : "bg-[hsl(var(--win98-face))]"}`}>
            <div className="text-[9px] uppercase text-[hsl(var(--destructive))]">Parse ✗</div>
            <div className="font-bold">{report.totals.parse_failures}</div>
          </button>
          <button onClick={() => setTab("types")}
            className={`win98-sunken py-1 px-1 ${tab === "types" ? "bg-[hsl(var(--win98-light))]" : "bg-[hsl(var(--win98-face))]"}`}>
            <div className="text-[9px] uppercase text-[hsl(45_90%_40%)]">Types ⚠</div>
            <div className="font-bold">{report.totals.type_failures}</div>
          </button>
        </div>
      )}

      {/* Action guidance */}
      {report && (report.totals.parse_failures > 0 || report.totals.type_failures > 0) && (
        <div className="win98-sunken px-2 py-1 text-[10px] space-y-[2px]">
          {report.totals.parse_failures > 0 && (
            <div className="text-[hsl(var(--destructive))] font-bold">
              ① Fix {report.totals.parse_failures} parse error(s) first — bundling is blocked.
            </div>
          )}
          {report.totals.type_failures > 0 && (
            <div className="text-[hsl(45_90%_40%)] font-bold">
              ② Then fix {report.totals.type_failures} type error(s) — bundle may pass but is unsafe.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="win98-sunken bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] px-2 py-1 text-[10px]">
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto win98-sunken bg-[hsl(var(--win98-light))]">
        {!report && !error && (
          <div className="p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
            {loading ? "Loading report…" : "No report available."}
          </div>
        )}
        {report && filtered.length === 0 && (
          <div className="p-3 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
            Nothing to show in this tab.
          </div>
        )}
        <ul className="divide-y divide-[hsl(var(--win98-shadow))]">
          {filtered.map((c) => {
            const isOpen = expanded === c.name;
            const hasError = c.parse === "fail" || c.types === "fail";
            const loc = c.parse_location ?? c.types_location;
            const errText = c.parse_error ?? c.types_error;
            return (
              <li key={c.name}>
                <button
                  className="w-full text-left px-2 py-1 flex items-center justify-between gap-2 hover:bg-[hsl(var(--win98-face))]"
                  onClick={() => setExpanded(isOpen ? null : c.name)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{c.name}</div>
                    {loc && (
                      <div className="font-mono text-[9px] text-[hsl(var(--muted-foreground))] truncate">
                        {loc.file}:{loc.line}:{loc.column}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Pill status={c.parse} />
                    <Pill status={c.types} />
                  </div>
                </button>
                {isOpen && hasError && errText && (
                  <pre className="px-2 py-1 text-[9px] font-mono whitespace-pre-wrap bg-[hsl(var(--win98-face))] text-[hsl(var(--destructive))] border-t border-[hsl(var(--win98-shadow))]">
                    {errText.slice(0, 1500)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Statusbar */}
      <div className="win98-sunken px-2 py-[2px] text-[9px] text-[hsl(var(--muted-foreground))] flex justify-between">
        <span>Source: /predeploy-report.json</span>
        <span>Run: node scripts/check-edge-functions.mjs</span>
      </div>
    </div>
  );
}

export function DeployChecklistWindow() {
  return (
    <div className="flex flex-col h-full">
      <DeployChecklistContent />
    </div>
  );
}
