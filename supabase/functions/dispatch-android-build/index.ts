// Triggers the GitHub Actions build-android.yml workflow on demand.
// Requires GITHUB_TOKEN secret with `workflow` scope and GITHUB_REPO env (owner/repo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user } } = await authClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghToken = Deno.env.get("GITHUB_TOKEN");
    const repo = Deno.env.get("GITHUB_REPO") ?? "";
    const ref = Deno.env.get("GITHUB_REF") ?? "main";
    const workflowFile = Deno.env.get("GITHUB_WORKFLOW_FILE") ?? "build-android.yml";

    if (!ghToken) {
      return new Response(JSON.stringify({
        error: "github_not_configured",
        message: "Add a GITHUB_TOKEN secret with `workflow` scope and a GITHUB_REPO env (owner/repo) to enable auto-build.",
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!repo || !repo.includes("/")) {
      return new Response(JSON.stringify({
        error: "github_repo_invalid",
        message: `GITHUB_REPO must be set as 'owner/repo'. Current value: '${repo || "(empty)"}'.`,
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ghHeaders = {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ordb-edge-fn",
    } as Record<string, string>;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "dispatch");

    if (action === "dispatch") {
      const buildType = body.build_type === "release" ? "release" : "debug";
      const outputFormat = body.output_format === "aab" ? "aab" : "apk";

      // Pre-flight: verify repo + workflow exist so we can return a clearer error
      const repoCheck = await fetch(`https://api.github.com/repos/${repo}`, { headers: ghHeaders });
      if (repoCheck.status === 404) {
        return new Response(JSON.stringify({
          error: "repo_not_found",
          message: `GitHub repo '${repo}' not found, or the GITHUB_TOKEN does not have access to it. Check owner/name spelling and that the token (PAT) has 'repo' + 'workflow' scopes (or is a fine-grained token granted to this repo).`,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (repoCheck.status === 401) {
        return new Response(JSON.stringify({
          error: "github_unauthorized",
          message: "GITHUB_TOKEN is invalid or expired.",
        }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const wfCheck = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}`,
        { headers: ghHeaders },
      );
      if (wfCheck.status === 404) {
        return new Response(JSON.stringify({
          error: "workflow_not_found",
          message: `Workflow '${workflowFile}' not found on ref '${ref}' in '${repo}'. Make sure '.github/workflows/${workflowFile}' is committed to the '${ref}' branch and the file is valid YAML.`,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const dispatchRes = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
        {
          method: "POST",
          headers: { ...ghHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ ref, inputs: { build_type: buildType, output_format: outputFormat } }),
        },
      );
      if (!dispatchRes.ok) {
        const txt = await dispatchRes.text();
        return new Response(JSON.stringify({
          error: "dispatch_failed",
          status: dispatchRes.status,
          repo, ref, workflow: workflowFile,
          details: txt,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        status: "dispatched",
        actions_url: `https://github.com/${repo}/actions/workflows/${workflowFile}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "latest") {
      const runsRes = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/runs?per_page=5`,
        { headers: ghHeaders },
      );
      const runs = await runsRes.json();
      const recent = (runs.workflow_runs ?? []).slice(0, 5).map((r: any) => ({
        id: r.id, status: r.status, conclusion: r.conclusion,
        created_at: r.created_at, html_url: r.html_url, name: r.display_title ?? r.name,
      }));
      return new Response(JSON.stringify({ runs: recent }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dispatch-android-build error", e);
    return new Response(JSON.stringify({ error: "server_error", message: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
