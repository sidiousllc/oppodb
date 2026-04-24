import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STATE_ABBR_TO_NAME } from "@/lib/stateAbbreviations";
import {
  ArrowLeft, Loader2, Play, AlertTriangle, CheckCircle2,
  XCircle, ExternalLink, ShieldCheck, Sparkles, PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface FailedSource {
  name: string;
  rssUrl: string;
  error: string | null;
  status: number;
}

interface StateAudit {
  state: string;
  configured: number;
  healthy: number;
  failed: number;
  meetsThreshold: boolean;
  failedSources: FailedSource[];
}

interface AuditResponse {
  minPerState: number;
  generatedAt: string;
  summary: {
    totalConfigured: number;
    totalHealthy: number;
    totalFailed: number;
    statesAudited: number;
    statesBelowThreshold: number;
    statesBelowThresholdList: string[];
  };
  states: StateAudit[];
}

interface TopUpAddition {
  name: string;
  rssUrl: string;
  items: number;
  status: number;
  ms: number;
}

interface TopUpResponse {
  checkedAt: string;
  minPerState: number;
  perStateCap: number;
  targetStates: string[];
  summary: {
    statesEvaluated: number;
    statesImproved: number;
    statesNowMeeting: number;
    statesStillBelow: number;
    candidatesProbed: number;
    totalHealthyAdded: number;
  };
  perState: Array<{
    state: string;
    previousConfigured: number;
    healthyAdded: number;
    newTotal: number;
    meetsThreshold: boolean;
  }>;
  additions: Record<string, TopUpAddition[]>;
  skipped: Record<string, Array<{ name: string; rssUrl: string; error: string | null; status: number }>>;
  note: string;
}

const REQUIRED_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function LocalFeedsAudit() {
  const [minPerState, setMinPerState] = useState(2);
  const [report, setReport] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowCoverageOnly, setLowCoverageOnly] = useState(false);
  const [lowCoverageThreshold, setLowCoverageThreshold] = useState(5);
  const [coverageMetric, setCoverageMetric] = useState<"configured" | "healthy">("configured");

  // Top-up state
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpResult, setTopUpResult] = useState<TopUpResponse | null>(null);
  const [topUpThreshold, setTopUpThreshold] = useState(5);
  const [topUpPerStateCap, setTopUpPerStateCap] = useState(3);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("intel-briefing", {
        body: { action: "audit_local_feeds", minPerState },
      });
      if (err) throw err;
      setReport(data as AuditResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  // Determine missing required states (configured = 0)
  const auditedStates = new Set((report?.states ?? []).map((s) => s.state));
  const missingStates = report
    ? REQUIRED_STATES.filter((abbr) => !auditedStates.has(abbr))
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/local-feeds">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Local Feeds Audit
            </h1>
            <p className="text-sm text-muted-foreground">
              Verifies every state + DC has at least N working local RSS sources and lists missing/failed feeds.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-end gap-3 mb-6 flex-wrap p-4 rounded-lg border border-border bg-card">
          <div>
            <Label htmlFor="min" className="text-xs">Minimum healthy feeds per state</Label>
            <Input
              id="min"
              type="number"
              min={1}
              max={20}
              value={minPerState}
              onChange={(e) => setMinPerState(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-24 mt-1"
            />
          </div>
          <Button onClick={runAudit} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            {loading ? "Auditing…" : "Run audit"}
          </Button>
          {report && (
            <p className="text-xs text-muted-foreground ml-auto">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {!report && !loading && (
          <div className="p-8 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
            Click <strong>Run audit</strong> to probe every configured local RSS source.
            This may take 30–60 seconds.
          </div>
        )}

        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Probing every local feed in parallel…
          </div>
        )}

        {report && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card label="Sources tested" value={report.summary.totalConfigured.toLocaleString()} />
              <Card
                label="Healthy"
                value={report.summary.totalHealthy.toLocaleString()}
                tone="ok"
              />
              <Card
                label="Failed"
                value={report.summary.totalFailed.toLocaleString()}
                tone={report.summary.totalFailed > 0 ? "warn" : "ok"}
              />
              <Card
                label={`Below threshold (<${report.minPerState})`}
                value={String(report.summary.statesBelowThreshold)}
                tone={report.summary.statesBelowThreshold > 0 ? "warn" : "ok"}
              />
            </div>

            {/* Missing required states (no configured sources at all) */}
            {missingStates.length > 0 && (
              <div className="mb-4 p-4 rounded-lg border border-destructive/40 bg-destructive/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-destructive">
                      {missingStates.length} jurisdiction{missingStates.length === 1 ? "" : "s"} have no local sources configured at all
                    </p>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      {missingStates.join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Below threshold callout */}
            {report.summary.statesBelowThresholdList.length > 0 && (
              <div className="mb-4 p-4 rounded-lg border border-destructive/40 bg-destructive/[0.06]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-destructive">
                      {report.summary.statesBelowThresholdList.length} state{report.summary.statesBelowThresholdList.length === 1 ? "" : "s"} below the minimum of {report.minPerState} healthy feed{report.minPerState === 1 ? "" : "s"}
                    </p>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      {report.summary.statesBelowThresholdList.join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Per-state results */}
            {(() => {
              const filteredStates = lowCoverageOnly
                ? report.states.filter((s) =>
                    (coverageMetric === "healthy" ? s.healthy : s.configured) < lowCoverageThreshold,
                  )
                : report.states;
              return (
                <>
                  <div className="flex items-center gap-2 mb-2 flex-wrap text-xs p-2 rounded-md border border-border bg-muted/20">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lowCoverageOnly}
                        onChange={(e) => setLowCoverageOnly(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                      <span className="font-medium">Show only states with fewer than</span>
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={lowCoverageThreshold}
                      onChange={(e) =>
                        setLowCoverageThreshold(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                      }
                      disabled={!lowCoverageOnly}
                      className="h-7 w-16 text-xs px-1.5"
                    />
                    <select
                      value={coverageMetric}
                      onChange={(e) => setCoverageMetric(e.target.value as "configured" | "healthy")}
                      disabled={!lowCoverageOnly}
                      className="h-7 text-xs rounded-md border border-border bg-background px-2 disabled:opacity-50"
                    >
                      <option value="configured">configured sources</option>
                      <option value="healthy">healthy sources</option>
                    </select>
                    <span className="text-muted-foreground ml-auto">
                      {lowCoverageOnly
                        ? `${filteredStates.length} of ${report.states.length} state${report.states.length === 1 ? "" : "s"} match`
                        : `${report.states.length} state${report.states.length === 1 ? "" : "s"} total`}
                    </span>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden mb-6">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">State</th>
                          <th className="px-3 py-2 text-right font-semibold">Configured</th>
                          <th className="px-3 py-2 text-right font-semibold">Healthy</th>
                          <th className="px-3 py-2 text-right font-semibold">Failed</th>
                          <th className="px-3 py-2 text-center font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStates.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                              No states have fewer than {lowCoverageThreshold} {coverageMetric} source{lowCoverageThreshold === 1 ? "" : "s"}.
                            </td>
                          </tr>
                        )}
                        {filteredStates.map((s) => (
                          <tr
                            key={s.state}
                            className={`border-t border-border ${!s.meetsThreshold ? "bg-destructive/5" : ""}`}
                          >
                            <td className="px-3 py-2">
                              <span className="font-mono text-xs text-muted-foreground mr-2">{s.state}</span>
                              <Link
                                to={`/admin/local-feeds/${s.state}`}
                                className="text-primary hover:underline"
                              >
                                {STATE_ABBR_TO_NAME[s.state] ?? s.state}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {s.configured}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.healthy}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${s.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {s.failed}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {s.meetsThreshold ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Pass
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                                  <AlertTriangle className="h-3 w-3" />
                                  Below {report.minPerState}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
            {/* Failed sources detail */}
            {report.summary.totalFailed > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Failed sources ({report.summary.totalFailed})
                </h2>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">State</th>
                        <th className="px-3 py-2 text-left font-semibold">Source</th>
                        <th className="px-3 py-2 text-right font-semibold">Status</th>
                        <th className="px-3 py-2 text-left font-semibold">Error</th>
                        <th className="px-3 py-2 text-right font-semibold">Feed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.states.flatMap((s) =>
                        s.failedSources.map((f) => (
                          <tr key={`${s.state}-${f.rssUrl}`} className="border-t border-border">
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.state}</td>
                            <td className="px-3 py-2">{f.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {f.status > 0 ? (
                                <span className={f.status >= 400 ? "text-destructive" : ""}>{f.status}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-[280px] truncate" title={f.error ?? ""}>
                              {f.error ?? "Unknown error"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <a
                                href={f.rssUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Open
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  label, value, tone,
}: { label: string; value: string; tone?: "ok" | "warn" }) {
  const toneClass =
    tone === "warn"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "ok"
      ? "border-primary/40 bg-primary/5"
      : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
