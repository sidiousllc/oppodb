import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, RefreshCw, Hammer } from "lucide-react";
import { toast } from "sonner";

interface Run { id: number; status: string; conclusion: string | null; created_at: string; html_url: string; name: string; }

export function AndroidBuildPanel() {
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildType, setBuildType] = useState<"debug" | "release">("debug");
  const [outputFormat, setOutputFormat] = useState<"apk" | "aab">("apk");
  const [notConfigured, setNotConfigured] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dispatch-android-build", {
        body: { action: "latest" },
      });
      if (error) throw error;
      if ((data as any)?.error === "github_not_configured") { setNotConfigured(true); return; }
      setNotConfigured(false);
      setRuns((data as any)?.runs ?? []);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const dispatch = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("dispatch-android-build", {
        body: { action: "dispatch", build_type: buildType, output_format: outputFormat },
      });
      if (error) throw error;
      if ((data as any)?.error === "github_not_configured") {
        setNotConfigured(true);
        toast.error("GitHub auto-build not configured yet");
        return;
      }
      toast.success("Android build started — check status in 3–5 minutes");
      setTimeout(refresh, 4000);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start build");
    } finally { setBusy(false); }
  };

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 my-3">
      <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1">
        <Hammer className="h-3.5 w-3.5" /> Auto-Build Android App
      </h3>

      {notConfigured ? (
        <div className="win98-sunken bg-[#fff8e1] border border-yellow-400 p-2 text-[10px] space-y-1">
          <p className="font-bold">⚠ GitHub auto-build is not configured yet.</p>
          <p>To enable one-click APK builds, an admin must add two project secrets:</p>
          <ul className="list-disc pl-4">
            <li><code>GITHUB_TOKEN</code> — a personal access token with <code>workflow</code> scope</li>
            <li><code>GITHUB_REPO</code> — the repository in <code>owner/repo</code> form (e.g. <code>Sidius/oppodb</code>)</li>
          </ul>
          <p>Until then, builds can be triggered manually from the GitHub Actions page below.</p>
          <a
            href="https://github.com/Sidius/oppodb/actions/workflows/build-android.yml"
            target="_blank" rel="noreferrer"
            className="win98-button text-[10px] px-2 py-1 inline-flex items-center gap-1 mt-1"
          >
            <ExternalLink className="h-3 w-3" /> Open GitHub Actions
          </a>
        </div>
      ) : (
        <>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">
            Builds the Android wrapper APK from the latest <code>main</code> branch via GitHub Actions.
            Once complete, the APK appears as a downloadable artifact in the run.
          </p>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            <label className="text-[10px] flex items-center gap-1">
              Type:
              <select
                value={buildType} onChange={(e) => setBuildType(e.target.value as any)}
                className="win98-sunken bg-white text-[10px] px-1 py-0.5"
              >
                <option value="debug">Debug</option>
                <option value="release">Release (signed)</option>
              </select>
            </label>
            <label className="text-[10px] flex items-center gap-1">
              Format:
              <select
                value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}
                className="win98-sunken bg-white text-[10px] px-1 py-0.5"
              >
                <option value="apk">APK</option>
                <option value="aab">AAB (Play Store)</option>
              </select>
            </label>
            <button
              onClick={dispatch}
              disabled={busy}
              className="win98-button text-[10px] px-2 py-1 flex items-center gap-1 font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hammer className="h-3 w-3" />}
              {busy ? "Starting…" : "Build Now"}
            </button>
            <button onClick={refresh} className="win98-button text-[10px] px-2 py-1 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> {loading ? "…" : "Refresh"}
            </button>
          </div>

          <div>
            <div className="text-[10px] font-bold mb-1">Recent builds</div>
            {!runs ? (
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Loading…</div>
            ) : runs.length === 0 ? (
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">No build runs yet.</div>
            ) : (
              <div className="space-y-1">
                {runs.map((r) => {
                  const ok = r.conclusion === "success";
                  const failed = r.conclusion === "failure" || r.conclusion === "cancelled";
                  return (
                    <a
                      key={r.id} href={r.html_url} target="_blank" rel="noreferrer"
                      className="win98-sunken bg-white p-1.5 flex items-center justify-between text-[10px] hover:bg-[hsl(var(--win98-light))]"
                    >
                      <div>
                        <div className="font-bold">{r.name || `Run #${r.id}`}</div>
                        <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                          {new Date(r.created_at).toLocaleString()} · {r.status}
                          {r.conclusion && ` · ${r.conclusion}`}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold ${ok ? "text-green-700" : failed ? "text-red-700" : ""}`}>
                        {ok ? "✓ APK ready" : failed ? "✗ failed" : "⏳ running"}
                        <ExternalLink className="h-2.5 w-2.5 inline ml-1" />
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
