import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WIKI_REPO_OWNER = "pdennis";
const WIKI_REPO_NAME = "oppodb.wiki";
const BRANCH = "master";

// Map between DB slugs and wiki file names
const SLUG_TO_FILE: Record<string, string> = {
  "overview": "01-Overview.md",
  "candidate-profiles": "02-Candidate-Profiles.md",
  "district-intelligence": "03-District-Intelligence.md",
  "polling-data": "04-Polling-Data.md",
  "campaign-finance": "05-Campaign-Finance.md",
  "state-legislative-districts": "06-State-Legislative-Districts.md",
  "additional-features": "07-Additional-Features.md",
  "authentication-and-user-management": "08-Authentication-and-User-Management.md",
  "api-access": "09-API-Access.md",
  "ui-design-system": "10-UI-Design-System.md",
  "data-sync-and-sources": "11-Data-Sync-and-Sources.md",
  "cook-ratings-and-forecasting": "12-Cook-Ratings-and-Forecasting.md",
  "admin-panel": "13-Admin-Panel.md",
  "research-tools": "14-Research-Tools.md",
  "android-app": "15-Android-App.md",
  "prediction-market-trading": "16-Prediction-Market-Trading.md",
  "leghub": "17-LegHub.md",
  "oppodb-search": "18-OppoDB-Search.md",
  "oppohub": "19-OppoHub.md",
  "messaginghub": "20-MessagingHub.md",
  "home": "Home.md",
};

function fileToSlug(filename: string): string {
  // "01-Overview.md" -> "overview"
  return filename
    .replace(/\.md$/, "")
    .replace(/^\d+-/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fileToTitle(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/^\d+-/, "")
    .replace(/-/g, " ");
}

function fileSortOrder(filename: string): number {
  const match = filename.match(/^(\d+)-/);
  return match ? parseInt(match[1]) : 99;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Auth
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

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check admin/mod role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const direction = body.direction || "pull"; // "pull" from GitHub, "push" to GitHub

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (!githubToken) {
      return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const githubHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "lovable-wiki-sync",
      Authorization: `token ${githubToken}`,
    };

    if (direction === "pull") {
      // Pull wiki pages from GitHub into database
      const treeRes = await fetch(
        `https://api.github.com/repos/${WIKI_REPO_OWNER}/${WIKI_REPO_NAME}/git/trees/${BRANCH}?recursive=1`,
        { headers: githubHeaders }
      );
      if (!treeRes.ok) {
        const errText = await treeRes.text();
        throw new Error(`GitHub tree fetch failed (${treeRes.status}): ${errText}`);
      }
      const treeData = await treeRes.json();

      const mdFiles = treeData.tree.filter(
        (f: any) => f.type === "blob" && f.path.endsWith(".md") && !f.path.includes("/")
      );

      let imported = 0;
      const errors: string[] = [];

      for (const file of mdFiles) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${WIKI_REPO_OWNER}/${WIKI_REPO_NAME}/${BRANCH}/${file.path}`;
          const res = await fetch(rawUrl, { headers: { "User-Agent": "lovable-wiki-sync", Authorization: `token ${githubToken}` } });
          if (!res.ok) { errors.push(`Failed to fetch ${file.path}: ${res.status}`); continue; }
          const content = await res.text();
          const slug = fileToSlug(file.path);
          const title = fileToTitle(file.path);
          const sortOrder = fileSortOrder(file.path);

          const { error } = await supabase
            .from("wiki_pages")
            .upsert({
              slug,
              title,
              content,
              sort_order: sortOrder,
              published: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: "slug" });

          if (error) errors.push(`Upsert ${slug}: ${error.message}`);
          else imported++;
        } catch (e: any) { errors.push(`${file.path}: ${e.message}`); }
      }

      return new Response(JSON.stringify({ status: "pulled", imported, total: mdFiles.length, errors: errors.length ? errors : undefined }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (direction === "push") {
      // Push wiki_pages from DB to GitHub wiki repo
      const { data: pages, error: fetchErr } = await supabase
        .from("wiki_pages")
        .select("*")
        .eq("published", true)
        .order("sort_order");

      if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`);
      if (!pages || pages.length === 0) {
        return new Response(JSON.stringify({ status: "nothing to push", pushed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let pushed = 0;
      const errors: string[] = [];

      for (const page of pages) {
        try {
          const filename = SLUG_TO_FILE[page.slug] || `${page.slug}.md`;
          const path = filename;

          // Get current file SHA (needed for update)
          let sha: string | undefined;
          const getRes = await fetch(
            `https://api.github.com/repos/${WIKI_REPO_OWNER}/${WIKI_REPO_NAME}/contents/${path}?ref=${BRANCH}`,
            { headers: githubHeaders }
          );
          if (getRes.ok) {
            const existing = await getRes.json();
            sha = existing.sha;
          }

          // Create or update file
          const putBody: Record<string, unknown> = {
            message: `Update ${page.title} via admin panel`,
            content: btoa(unescape(encodeURIComponent(page.content))),
            branch: BRANCH,
          };
          if (sha) putBody.sha = sha;

          const putRes = await fetch(
            `https://api.github.com/repos/${WIKI_REPO_OWNER}/${WIKI_REPO_NAME}/contents/${path}`,
            {
              method: "PUT",
              headers: { ...githubHeaders, "Content-Type": "application/json" },
              body: JSON.stringify(putBody),
            }
          );

          if (!putRes.ok) {
            const errBody = await putRes.text();
            errors.push(`Push ${path} failed (${putRes.status}): ${errBody}`);
          } else {
            pushed++;
          }
        } catch (e: any) { errors.push(`${page.slug}: ${e.message}`); }
      }

      return new Response(JSON.stringify({ status: "pushed", pushed, total: pages.length, errors: errors.length ? errors : undefined }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid direction. Use 'pull' or 'push'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("Wiki sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
