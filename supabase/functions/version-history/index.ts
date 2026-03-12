import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPO_OWNER = "pdennis";
const REPO_NAME = "research-books";

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "lovable-version-sync",
      Authorization: `Bearer ${githubToken}`,
    };

    // Parse request body for optional filters
    let targetPaths: string[] | null = null;
    try {
      const body = await req.json();
      if (body.paths && Array.isArray(body.paths)) {
        targetPaths = body.paths;
      }
    } catch {
      // No body or invalid JSON — process all files
    }

    // Get all candidate_profiles github_paths
    const { data: profiles, error: profileErr } = await supabase
      .from("candidate_profiles")
      .select("github_path");

    if (profileErr) throw new Error(`DB error: ${profileErr.message}`);

    let paths = (profiles || []).map((p: { github_path: string }) => p.github_path);
    if (targetPaths && targetPaths.length > 0) {
      const targetSet = new Set(targetPaths);
      paths = paths.filter((p: string) => targetSet.has(p));
    }

    // Check which paths already have versions stored
    const { data: existingVersions } = await supabase
      .from("candidate_versions")
      .select("github_path, commit_sha");

    const existingSet = new Set(
      (existingVersions || []).map((v: { github_path: string; commit_sha: string }) =>
        `${v.github_path}::${v.commit_sha}`
      )
    );

    let processed = 0;
    let newVersions = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 5; // Conservative to stay within rate limits

    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const batch = paths.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (filePath: string) => {
          // Get commits for this file (last 30)
          const commitsRes = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${encodeURIComponent(filePath)}&per_page=30`,
            { headers: ghHeaders }
          );

          if (!commitsRes.ok) {
            const errBody = await commitsRes.text();
            console.error(`Commits API error for ${filePath}: ${commitsRes.status} ${errBody}`);
            throw new Error(`Commits API ${commitsRes.status} for ${filePath}`);
          }

          const commits = await commitsRes.json();
          const rows: Array<{
            github_path: string;
            commit_sha: string;
            commit_date: string;
            commit_message: string;
            author: string;
            content: string;
          }> = [];

          for (const commit of commits) {
            const sha = commit.sha;
            const key = `${filePath}::${sha}`;

            if (existingSet.has(key)) continue; // Already stored

            // Fetch file content at this commit
            const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${sha}/${filePath}`;
            const contentRes = await fetch(rawUrl);

            if (!contentRes.ok) {
              // File may not exist at this commit (renamed/moved)
              continue;
            }

            const rawContent = await contentRes.text();
            const content = stripFrontmatter(rawContent);

            rows.push({
              github_path: filePath,
              commit_sha: sha,
              commit_date: commit.commit.author.date,
              commit_message: commit.commit.message.slice(0, 500),
              author: commit.commit.author.name || commit.commit.author.email || "unknown",
              content,
            });

            existingSet.add(key);
          }

          return rows;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.length > 0) {
          const { error } = await supabase
            .from("candidate_versions")
            .upsert(result.value, { onConflict: "github_path,commit_sha" });

          if (error) {
            errors.push(`Upsert error: ${error.message}`);
          } else {
            newVersions += result.value.length;
          }
        } else if (result.status === "rejected") {
          errors.push(result.reason?.message || "Unknown error");
        }
        processed++;
      }

      // Rate limit pause between batches
      if (i + BATCH_SIZE < paths.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return new Response(
      JSON.stringify({
        status: "complete",
        totalFiles: paths.length,
        processed,
        newVersions,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Version sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
