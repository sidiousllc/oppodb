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

const CACHE_KEY = "deployChecklist.lastReport";
const CACHE_TS_KEY = "deployChecklist.lastFetchedAt";

function loadCachedReport(): { report: Report | null; cachedAt: string | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (!raw) return { report: null, cachedAt: ts };
    return { report: JSON.parse(raw) as Report, cachedAt: ts };
  } catch {
    return { report: null, cachedAt: null };
  }
}

function DeployChecklistContent() {
  const initialCache = loadCachedReport();
  const [report, setReport] = useState<Report | null>(initialCache.report);
  const [cachedAt, setCachedAt] = useState<string | null>(initialCache.cachedAt);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [runLog, setRunLog] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [devEndpointAvailable, setDevEndpointAvailable] = useState<boolean | null>(null);

  const { isAdmin } = useIsAdmin();

  const probeDevEndpoint = async () => {
    try {
      const probe = await fetch("/__predeploy", { method: "HEAD" });
      const ok = probe.status === 405 || probe.headers.get("x-predeploy") === "1";
      setDevEndpointAvailable(ok);
      return ok;
    } catch {
      setDevEndpointAvailable(false);
      return false;
    }
  };

  const load = async () => {
    setLoading(true);
    // Try, in order: served public asset, explicit /public path, root-level file.
    const candidates = [
      `/predeploy-report.json?t=${Date.now()}`,
      `/public/predeploy-report.json?t=${Date.now()}`,
      `/../predeploy-report.json?t=${Date.now()}`,
      `/predeploy-report.root.json?t=${Date.now()}`,
    ];
    let lastErr: string | null = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) { lastErr = `HTTP ${res.status} for ${url}`; continue; }
        const text = await res.text();
        const trimmed = text.trimStart();
        if (trimmed.startsWith("<")) { lastErr = `HTML returned for ${url} (file not found)`; continue; }
        let data: Report;
        try {
          data = JSON.parse(text) as Report;
        } catch {
          lastErr = `Invalid JSON at ${url}`;
          continue;
        }
        setReport(data);
        setError(null);
        setLoading(false);
        const ts = new Date().toISOString();
        setCachedAt(ts);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(CACHE_TS_KEY, ts);
        } catch { /* quota / disabled */ }
        return;
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }
    setError(
      `No predeploy report found (tried ${candidates.length} locations). ` +
      `Run \`node scripts/check-edge-functions.mjs\` to generate public/predeploy-report.json.` +
      (lastErr ? ` Last error: ${lastErr}` : "")
    );
    // Keep showing cached report (do not clear it) so the user can still see the last good run.
    setLoading(false);
  };

  const [autoRun, setAutoRun] = useState<boolean>(() => {
    try { return localStorage.getItem("deployChecklist.autoRun") === "1"; } catch { return false; }
  });

  const toggleAutoRun = (next: boolean) => {
    setAutoRun(next);
    try { localStorage.setItem("deployChecklist.autoRun", next ? "1" : "0"); } catch { /* ignore */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
      const isDevEndpoint = await probeDevEndpoint();
      if (cancelled || !autoRun) return;
      if (isDevEndpoint && !cancelled) await generate();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setGenerating(true);
    setRunLog(null);
    setError(null);
    try {
      const res = await fetch("/__predeploy", { method: "POST" });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        throw new Error(
          "Generation endpoint not available. This only works in local `npm run dev` (Vite dev server). In production builds, run `node scripts/check-edge-functions.mjs` from a terminal."
        );
      }
      const data = await res.json() as { ok: boolean; exit_code: number; output: string; error?: string };
      setRunLog(data.output || data.error || "(no output)");
      // Reload the static report regardless — script writes it on every run.
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGenerating(false);
    }
  };

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
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate" title={cachedAt ? `Cached at ${new Date(cachedAt).toLocaleString()}` : undefined}>
              {new Date(report.generated_at).toLocaleString()}
              {error && cachedAt && (
                <span className="ml-1 text-[hsl(45_90%_40%)]">(cached {new Date(cachedAt).toLocaleTimeString()})</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1 text-[10px] cursor-pointer select-none" title="When this window opens, automatically run the predeploy script (local dev only).">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => toggleAutoRun(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-run on open
          </label>
          <button
            onClick={generate}
            disabled={generating || loading}
            className="win98-button text-[10px] px-2 py-[1px]"
            title="Runs `node scripts/check-edge-functions.mjs` (dev server only)"
          >
            {generating ? "Running…" : "Generate"}
          </button>
          <button onClick={load} disabled={loading || generating} className="win98-button text-[10px] px-2 py-[1px]">
            {loading ? "…" : "Reload"}
          </button>
        </div>
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

      {/* Quick error locations — first 5 of each kind, click to copy */}
      {report && (report.totals.parse_failures > 0 || report.totals.type_failures > 0) && (() => {
        const parseLocs = report.checks
          .filter(c => c.parse === "fail" && c.parse_location)
          .slice(0, 5)
          .map(c => ({ name: c.name, kind: "parse" as const, loc: c.parse_location! }));
        const typeLocs = report.checks
          .filter(c => c.types === "fail" && c.types_location)
          .slice(0, 5)
          .map(c => ({ name: c.name, kind: "types" as const, loc: c.types_location! }));
        const all = [...parseLocs, ...typeLocs];
        if (all.length === 0) return null;
        const allText = all.map(e => `${e.loc.file}:${e.loc.line}:${e.loc.column}`).join("\n");
        const copy = (text: string) => {
          try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
        };
        return (
          <div className="win98-sunken px-2 py-1 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold">First error locations</span>
              <button
                onClick={() => copy(allText)}
                className="win98-button text-[9px] px-1.5 py-[1px]"
                title="Copy all locations to clipboard"
              >
                Copy all
              </button>
            </div>
            <ul className="space-y-[1px]">
              {all.map((e, i) => {
                const locStr = `${e.loc.file}:${e.loc.line}:${e.loc.column}`;
                const colorClass = e.kind === "parse"
                  ? "text-[hsl(var(--destructive))]"
                  : "text-[hsl(45_90%_40%)]";
                return (
                  <li key={`${e.kind}-${i}`} className="flex items-center gap-1">
                    <span className={`text-[8px] uppercase font-bold w-9 shrink-0 ${colorClass}`}>
                      {e.kind === "parse" ? "PARSE" : "TYPE"}
                    </span>
                    <button
                      onClick={() => { copy(locStr); setExpanded(e.name); }}
                      className="font-mono text-[9px] truncate text-left hover:underline flex-1"
                      title={`Click to copy & jump to ${e.name}`}
                    >
                      {locStr}
                    </button>
                    <span className="text-[8px] text-[hsl(var(--muted-foreground))] truncate max-w-[40%]">
                      {e.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {error && (
        <div className="win98-sunken bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] px-2 py-1 text-[10px]">
          {error}
        </div>
      )}

      {/* Manual run instructions — shown when the dev endpoint is missing (production / preview). */}
      {devEndpointAvailable === false && (() => {
        const commands: { label: string; cmd: string }[] = [
          { label: "Check Node (>= 18)", cmd: "node --version" },
          { label: "Check Deno (>= 1.40)", cmd: "deno --version" },
          { label: "Install deps (first run only)", cmd: "npm install" },
          { label: "Run predeploy checks", cmd: "node scripts/check-edge-functions.mjs" },
          { label: "Mirror to public/ for the web UI", cmd: "cp predeploy-report.json public/predeploy-report.json" },
        ];
        const allCmds = commands.map(c => c.cmd).join(" && \\\n  ");
        const copy = (text: string) => {
          try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
        };
        return (
          <div className="win98-sunken px-2 py-1 text-[10px] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">Manual run (dev endpoint unavailable)</span>
              <button
                onClick={() => copy(allCmds)}
                className="win98-button text-[9px] px-1.5 py-[1px]"
                title="Copy all commands as a single chained shell line"
              >
                Copy all
              </button>
            </div>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
              The in-browser <span className="font-mono">/__predeploy</span> endpoint only exists under <span className="font-mono">npm run dev</span>. Run these in a terminal at the repo root:
            </p>
            <ul className="space-y-[2px]">
              {commands.map((c) => (
                <li key={c.cmd} className="flex items-center gap-1">
                  <span className="text-[8px] uppercase font-bold w-24 shrink-0 text-[hsl(var(--muted-foreground))] truncate" title={c.label}>
                    {c.label}
                  </span>
                  <button
                    onClick={() => copy(c.cmd)}
                    className="font-mono text-[9px] truncate text-left hover:underline flex-1 bg-[hsl(var(--win98-light))] px-1 py-[1px] border border-[hsl(var(--win98-shadow))]"
                    title="Click to copy"
                  >
                    {c.cmd}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
              After it finishes, click <span className="font-bold">Reload</span> above to refresh this window.
            </p>
          </div>
        );
      })()}


      {runLog && (
        <details className="win98-sunken px-2 py-1 text-[10px]" open>
          <summary className="cursor-pointer font-bold">Run log</summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[9px]">
            {runLog}
          </pre>
        </details>
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
