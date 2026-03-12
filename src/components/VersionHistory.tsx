import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, ChevronDown, ChevronUp, Loader2, RefreshCw, GitCommit } from "lucide-react";

interface Version {
  id: string;
  github_path: string;
  commit_sha: string;
  commit_date: string;
  commit_message: string;
  author: string;
  content: string;
}

interface VersionHistoryProps {
  githubPath: string;
  currentContent: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function computeSimpleDiff(oldText: string, newText: string): { added: number; removed: number } {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let added = 0;
  let removed = 0;
  for (const line of newLines) {
    if (!oldSet.has(line)) added++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) removed++;
  }
  return { added, removed };
}

export function VersionHistory({ githubPath, currentContent }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    supabase
      .from("candidate_versions")
      .select("*")
      .eq("github_path", githubPath)
      .order("commit_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Version fetch error:", error);
        setVersions((data as unknown as Version[]) || []);
        setLoading(false);
      });
  }, [githubPath, expanded]);

  async function handleSync() {
    setSyncing(true);
    try {
      await supabase.functions.invoke("version-history", {
        body: { paths: [githubPath] },
      });
      // Reload versions
      const { data } = await supabase
        .from("candidate_versions")
        .select("*")
        .eq("github_path", githubPath)
        .order("commit_date", { ascending: false });
      setVersions((data as unknown as Version[]) || []);
    } catch (e) {
      console.error("Version sync error:", e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-sm font-semibold text-foreground">
            Version History
          </span>
          {versions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({versions.length} versions)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-foreground">
              Commit history from GitHub
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Pulling…" : "Pull History"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading version history…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No version history available. Click "Pull History" to fetch commits from GitHub.
            </p>
          ) : (
            <div className="space-y-1">
              {versions.map((v, i) => {
                const prevVersion = versions[i + 1];
                const diff = prevVersion
                  ? computeSimpleDiff(prevVersion.content, v.content)
                  : null;
                const isSelected = selectedVersion?.commit_sha === v.commit_sha;
                const isLatest = i === 0;

                return (
                  <div key={v.commit_sha}>
                    <button
                      onClick={() => setSelectedVersion(isSelected ? null : v)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/5 border border-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <GitCommit className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium truncate">
                            {v.commit_message || "No message"}
                          </span>
                          {isLatest && (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {v.author} · {formatDate(v.commit_date)}
                          </span>
                          <code className="text-[10px] text-muted-foreground/60 font-mono">
                            {v.commit_sha.slice(0, 7)}
                          </code>
                          {diff && (
                            <span className="text-[10px]">
                              {diff.added > 0 && (
                                <span className="text-accent">+{diff.added}</span>
                              )}
                              {diff.added > 0 && diff.removed > 0 && " "}
                              {diff.removed > 0 && (
                                <span className="text-destructive">-{diff.removed}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {isSelected && (
                      <div className="mt-2 mb-3 ml-7 mr-3 rounded-lg bg-muted/30 border border-border p-4 max-h-96 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Content at this version
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {v.content.length.toLocaleString()} chars
                          </span>
                        </div>
                        <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
                          {v.content.slice(0, 3000)}
                          {v.content.length > 3000 && "\n\n… (truncated)"}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
