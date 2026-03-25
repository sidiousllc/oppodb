import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://db.oppodb.com",
  "https://oppodb.com",
  "https://ordb.lovable.app",
  "https://id-preview--4f0f9990-c3c0-4e04-9ceb-2c41704d227e.lovable.app",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

const REPO_OWNER = "pdennis";
const REPO_NAME = "research-books";
const MAX_PATHS_PER_CALL = 10;

// Simple in-memory rate limiter (per-user, per cold-start)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

function buildValidatedUrl(baseUrl: string, filePath: string): string {
  try {
    if (filePath.includes("/../") || /\/%2e%2e\//i.test(filePath)) {
      throw new Error("Invalid path");
    }
    const url = new URL(baseUrl);
    if (!/^[A-Za-z0-9_.\/-]+$/.test(filePath)) {
      throw new Error("Invalid parameter");
    }
    url.pathname = url.pathname + filePath;
    return url.href;
  } catch {
    throw new Error("Invalid URL");
  }
}

function buildValidatedGitHubApiUrl(baseUrl: string, filePath: string, perPage: string): string {
  try {
    if (filePath.includes("/../") || /\/%2e%2e\//i.test(filePath)) {
      throw new Error("Invalid path");
    }
    const url = new URL(baseUrl);
    if (!/^[A-Za-z0-9_.\/-]+$/.test(filePath)) {
      throw new Error("Invalid parameter");
    }
    url.searchParams.set('path', filePath);
    url.searchParams.set('per_page', perPage);
    return url.href;
  } catch {
    throw new Error("Invalid URL");
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
      console.error("Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authorization: require admin role ---
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!roleCheck) {
      console.warn(`[version-history] Forbidden: user=${user.id} lacks admin role`);
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Rate limiting ---
    if (isRateLimited(user.id)) {
      console.warn(`[version-history] Rate limited: user=${user.id}`);
      return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // --- Input validation: require explicit paths ---
    let targetPaths: string[] | null = null;
    try {
      const body = await req.json();
      if (body.paths && Array.isArray(body.paths)) {
        targetPaths = body.paths
          .filter((p: unknown): p is string => typeof p === "string" && p.length > 0)
          .slice(0, MAX_PATHS_PER_CALL);
      }
    } catch {
      // Invalid JSON
    }

    if (!targetPaths || targetPaths.length === 0) {
      return new Response(
        JSON.stringify({ error: "Request body must include 'paths' array with 1-10 file paths" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each path format
    for (const p of targetPaths) {
      if (!/^[A-Za-z0-9_.\/-]+\.md$/.test(p) || p.includes("..")) {
        return new Response(
          JSON.stringify({ error: `Invalid path: ${p}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[version-history] START user=${user.id} paths=${targetPaths.length}`);

    const githubToken = Deno.env.get("GITHUB_TOKEN")?.trim();
    const ghHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "lovable-version-sync",
    };
    if (githubToken && (githubToken.startsWith("ghp_") || githubToken.startsWith("github_pat_") || githubToken.startsWith("gho_"))) {
      ghHeaders.Authorization = `Bearer ${githubToken}`;
    }

    // Get candidate_profiles github_paths and intersect with requested paths
    const { data: profiles, error: profileErr } = await supabase
      .from("candidate_profiles")
      .select("github_path");

    if (profileErr) throw new Error(`DB error: ${profileErr.message}`);

    const validPaths = new Set((profiles || []).map((p: { github_path: string }) => p.github_path));
    const paths = targetPaths.filter((p) => validPaths.has(p));

    if (paths.length === 0) {
      return new Response(
        JSON.stringify({ status: "complete", totalFiles: 0, processed: 0, newVersions: 0, message: "No matching candidate profiles found for provided paths" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check existing versions
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
    const BATCH_SIZE = 5;

    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const batch = paths.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (filePath: string) => {
          const commitsRes = await fetch(
            buildValidatedGitHubApiUrl(
              `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits`,
              filePath,
              '30'
            ),
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
            if (existingSet.has(key)) continue;

            const rawUrl = buildValidatedUrl(
              `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${sha}/`,
              filePath
            );
            const contentRes = await fetch(rawUrl);
            if (!contentRes.ok) {
              await contentRes.text();
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

      if (i + BATCH_SIZE < paths.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log(`[version-history] COMPLETE user=${user.id} processed=${processed} newVersions=${newVersions} errors=${errors.length}`);

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
    console.error("[version-history] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
