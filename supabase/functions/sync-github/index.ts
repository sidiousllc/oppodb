import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPO_OWNER = "pdennis";
const REPO_NAME = "research-books";
const BRANCH = "main";

// Folders/files to skip
const SKIP_DIRS = new Set([
  "public",
  "reprofiles",
  "desantisresearchbook",
  "trumpresearchbook",
  "ohio-senate",
  "northcarolina-senate",
  "iowa-senate",
  "smith",
]);

// Governor race folder patterns
const GOV_PATTERNS = /^(AZ-Gov|GA-Gov|IA-Gov|ME-GOV|MI-GOV|MI-Gov|MN-Gov|NH-Gov|NV-Gov|PA-Gov|WI-GOV)$/i;

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role key for data operations
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get latest commit SHA
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const githubHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "lovable-sync",
    };
    if (githubToken) {
      githubHeaders["Authorization"] = `token ${githubToken}`;
    }

    const commitRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`,
      { headers: githubHeaders }
    );
    if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`);
    const commitData = await commitRes.json();
    const latestSha = commitData.sha;

    // 2. Check if we already synced this commit
    const { data: meta } = await supabase
      .from("sync_metadata")
      .select("last_commit_sha")
      .eq("id", 1)
      .single();

    if (meta?.last_commit_sha === latestSha) {
      return new Response(
        JSON.stringify({ status: "up-to-date", sha: latestSha }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get the full tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`,
      { headers: githubHeaders }
    );
    if (!treeRes.ok) throw new Error(`Failed to get tree: ${treeRes.status}`);
    const treeData = await treeRes.json();

    // 4. Filter to .md files
    const mdFiles = treeData.tree.filter(
      (f: any) => f.type === "blob" && f.path.endsWith(".md")
    );

    // Categorize files
    const mainPages: Array<{ path: string; slug: string }> = [];
    const subPages: Array<{ path: string; parentSlug: string; subSlug: string }> = [];

    for (const f of mdFiles) {
      const parts = f.path.split("/");

      // Top-level .md files = main "How to Win" pages
      if (parts.length === 1) {
        const slug = parts[0].replace(/\.md$/, "").toLowerCase();
        if (!SKIP_DIRS.has(slug) && !slug.startsWith(".")) {
          mainPages.push({ path: f.path, slug });
        }
        continue;
      }

      // Files inside candidate folders = subpages
      if (parts.length === 2) {
        const parentDir = parts[0];
        if (SKIP_DIRS.has(parentDir.toLowerCase()) || parentDir.startsWith(".")) continue;

        const subSlug = parts[1].replace(/\.md$/, "").toLowerCase();
        mainPages.push // Don't add duplicates
        subPages.push({
          path: f.path,
          parentSlug: parentDir.toLowerCase(),
          subSlug,
        });
        continue;
      }

      // Files inside gov race sub-folders (e.g., AZ-Gov/david-schweikert/file.md)
      if (parts.length === 3 && GOV_PATTERNS.test(parts[0])) {
        subPages.push({
          path: f.path,
          parentSlug: parts[1].toLowerCase(),
          subSlug: parts[2].replace(/\.md$/, "").toLowerCase(),
        });
      }
    }

    // 5. Fetch content in batches and upsert
    const BATCH_SIZE = 15;
    let processed = 0;
    const errors: string[] = [];

    // Process main pages
    for (let i = 0; i < mainPages.length; i += BATCH_SIZE) {
      const batch = mainPages.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (page) => {
          const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${page.path}`;
          const fetchHeaders: Record<string, string> = { "User-Agent": "lovable-sync" };
          if (githubToken) fetchHeaders["Authorization"] = `token ${githubToken}`;
          const res = await fetch(rawUrl, { headers: fetchHeaders });
          if (!res.ok) throw new Error(`Failed to fetch ${page.path}: ${res.status}`);
          const raw = await res.text();
          const content = stripFrontmatter(raw);
          const title = extractTitle(content) || slugToName(page.slug);
          const name = title
            .replace(/^How To Win Against\s+/i, "")
            .replace(/^How To Win\s+/i, "")
            .trim();

          return {
            slug: page.slug,
            name: name || slugToName(page.slug),
            content,
            github_path: page.path,
            is_subpage: false,
            parent_slug: null,
            subpage_title: null,
            updated_at: new Date().toISOString(),
          };
        })
      );

      const rows = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value);

      if (rows.length > 0) {
        const { error } = await supabase
          .from("candidate_profiles")
          .upsert(rows, { onConflict: "github_path" });
        if (error) errors.push(`Main upsert error: ${error.message}`);
        processed += rows.length;
      }

      results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .forEach((r) => errors.push(r.reason?.message || "Unknown fetch error"));

      // Small delay to be nice to GitHub
      if (i + BATCH_SIZE < mainPages.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Process subpages
    for (let i = 0; i < subPages.length; i += BATCH_SIZE) {
      const batch = subPages.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (page) => {
          const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${page.path}`;
          const fetchHeaders: Record<string, string> = { "User-Agent": "lovable-sync" };
          if (githubToken) fetchHeaders["Authorization"] = `token ${githubToken}`;
          const res = await fetch(rawUrl, { headers: fetchHeaders });
          if (!res.ok) throw new Error(`Failed to fetch ${page.path}: ${res.status}`);
          const raw = await res.text();
          const content = stripFrontmatter(raw);
          const title = extractTitle(content) || slugToName(page.subSlug);

          return {
            slug: page.subSlug,
            name: title,
            content,
            github_path: page.path,
            is_subpage: true,
            parent_slug: page.parentSlug,
            subpage_title: title,
            updated_at: new Date().toISOString(),
          };
        })
      );

      const rows = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value);

      if (rows.length > 0) {
        const { error } = await supabase
          .from("candidate_profiles")
          .upsert(rows, { onConflict: "github_path" });
        if (error) errors.push(`Sub upsert error: ${error.message}`);
        processed += rows.length;
      }

      results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .forEach((r) => errors.push(r.reason?.message || "Unknown fetch error"));

      if (i + BATCH_SIZE < subPages.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 6. Update sync metadata
    await supabase
      .from("sync_metadata")
      .update({ last_commit_sha: latestSha, last_synced_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        status: "synced",
        sha: latestSha,
        processed,
        mainPages: mainPages.length,
        subPages: subPages.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
