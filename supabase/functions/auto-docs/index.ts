import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Feature registry — maps wiki slugs to their source components/files
const FEATURE_REGISTRY: Record<string, { title: string; sourcePatterns: string[]; sortOrder: number }> = {
  "01-Overview": {
    title: "Overview",
    sourcePatterns: ["src/App.tsx", "src/pages/Index.tsx", "src/contexts/ThemeContext.tsx"],
    sortOrder: 1,
  },
  "02-Candidate-Profiles": {
    title: "Candidate Profiles",
    sourcePatterns: ["src/components/CandidateCard.tsx", "src/components/CandidateDetail.tsx", "src/components/CandidateEditor.tsx"],
    sortOrder: 2,
  },
  "03-District-Intelligence": {
    title: "District Intelligence",
    sourcePatterns: ["src/components/DistrictMap.tsx", "src/components/DistrictDetail.tsx", "src/components/DistrictBoundaryMap.tsx"],
    sortOrder: 3,
  },
  "04-Polling-Data": {
    title: "Polling Data",
    sourcePatterns: ["src/components/PollingSection.tsx", "src/components/PollDetailWindow.tsx", "src/components/IssuePollingSection.tsx"],
    sortOrder: 4,
  },
  "05-Campaign-Finance": {
    title: "Campaign Finance",
    sourcePatterns: ["src/components/CampaignFinancePanel.tsx", "src/components/AreaFinancePanel.tsx", "src/components/FollowTheMoneyPanel.tsx"],
    sortOrder: 5,
  },
  "06-State-Legislative-Districts": {
    title: "State Legislative Districts",
    sourcePatterns: ["src/components/StateLegislativeSection.tsx", "src/components/StateLegOverviewMap.tsx", "src/components/StateLegBoundaryMap.tsx"],
    sortOrder: 6,
  },
  "07-Additional-Features": {
    title: "Additional Features",
    sourcePatterns: ["src/components/ResearchToolsDashboard.tsx", "src/components/CourtRecordsSearch.tsx"],
    sortOrder: 7,
  },
  "08-Authentication-and-User-Management": {
    title: "Authentication & User Management",
    sourcePatterns: ["src/pages/AuthPage.tsx", "src/contexts/AuthContext.tsx", "src/hooks/useIsAdmin.ts"],
    sortOrder: 8,
  },
  "09-API-Access": {
    title: "API Access",
    sourcePatterns: ["src/pages/ApiPage.tsx", "src/components/ApiAnalytics.tsx"],
    sortOrder: 9,
  },
  "10-UI-Design-System": {
    title: "UI Design System",
    sourcePatterns: ["src/themes.css", "src/index.css", "src/contexts/ThemeContext.tsx", "src/components/Win98Desktop.tsx"],
    sortOrder: 10,
  },
  "11-Data-Sync-and-Sources": {
    title: "Data Sync & Sources",
    sourcePatterns: ["src/components/SyncResultsPanel.tsx", "supabase/functions/wiki-sync/index.ts", "supabase/functions/sync-github/index.ts"],
    sortOrder: 11,
  },
  "12-Cook-Ratings-and-Forecasting": {
    title: "Cook Ratings & Forecasting",
    sourcePatterns: ["src/components/CookPVIChart.tsx", "src/components/CookRatingHistory.tsx", "src/components/ForecastComparisonPanel.tsx"],
    sortOrder: 12,
  },
  "13-Admin-Panel": {
    title: "Admin Panel",
    sourcePatterns: ["src/pages/AdminPanel.tsx"],
    sortOrder: 13,
  },
  "14-Research-Tools": {
    title: "Research Tools",
    sourcePatterns: ["src/components/ResearchToolsDashboard.tsx", "src/components/ChatPanel.tsx"],
    sortOrder: 14,
  },
  "15-Android-App": {
    title: "Android App",
    sourcePatterns: ["capacitor.config.ts"],
    sortOrder: 15,
  },
  "16-Prediction-Market-Trading": {
    title: "Prediction Market Trading",
    sourcePatterns: ["src/components/PredictionMarketsPanel.tsx", "src/components/MarketTradingPanel.tsx", "src/components/MarketDetailWindow.tsx"],
    sortOrder: 16,
  },
  "17-LegHub": {
    title: "LegHub",
    sourcePatterns: ["src/components/LegHub.tsx", "src/components/FederalBillsTab.tsx"],
    sortOrder: 17,
  },
  "18-OppoDB-Search": {
    title: "OppoDB Search",
    sourcePatterns: ["src/components/MasterSearch.tsx"],
    sortOrder: 18,
  },
  "19-OppoHub": {
    title: "OppoHub",
    sourcePatterns: ["src/components/OppoHub.tsx"],
    sortOrder: 19,
  },
  "20-MessagingHub": {
    title: "MessagingHub",
    sourcePatterns: ["src/components/MessagingHub.tsx"],
    sortOrder: 20,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const slugsToUpdate = body.slugs as string[] | undefined;
    const triggerMethod = body.trigger_method || "manual";

    // Step 1: Get current wiki content from DB
    const { data: existingPages } = await supabase
      .from("wiki_pages")
      .select("slug, title, content, sort_order, published");

    const existingMap = new Map<string, { title: string; content: string; sort_order: number; published: boolean }>();
    (existingPages || []).forEach((p: any) => existingMap.set(p.slug, p));

    // Step 2: Get current component list from GitHub to detect changes
    let componentFiles: string[] = [];
    if (githubToken) {
      try {
        const treeRes = await fetch(
          "https://api.github.com/repos/thecityfoundation/oppodb/git/trees/main?recursive=1",
          { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" } }
        );
        if (treeRes.ok) {
          const tree = await treeRes.json();
          componentFiles = (tree.tree || [])
            .filter((f: any) => f.type === "blob" && (f.path.startsWith("src/") || f.path.startsWith("supabase/")))
            .map((f: any) => f.path);
        }
      } catch {
        // Fall back to registry-only mode
      }
    }

    // Step 3: Detect which pages need updating
    const pagesToUpdate: { slug: string; title: string; sortOrder: number; sourceFiles: string[]; existingContent: string }[] = [];

    for (const [slug, meta] of Object.entries(FEATURE_REGISTRY)) {
      if (slugsToUpdate && !slugsToUpdate.includes(slug)) continue;

      const relevantFiles = componentFiles.length > 0
        ? meta.sourcePatterns.filter(p => componentFiles.includes(p))
        : meta.sourcePatterns;

      const existing = existingMap.get(slug);

      // Detect new/changed files by checking if source files exist that the wiki doesn't mention
      const needsUpdate = !existing ||
        relevantFiles.some(f => !existing.content.includes(f.split("/").pop()!.replace(".tsx", "").replace(".ts", "")));

      if (needsUpdate) {
        pagesToUpdate.push({
          slug,
          title: meta.title,
          sortOrder: meta.sortOrder,
          sourceFiles: relevantFiles,
          existingContent: existing?.content || "",
        });
      }
    }

    // Also detect NEW components not in registry
    const registeredPatterns = Object.values(FEATURE_REGISTRY).flatMap(m => m.sourcePatterns);
    const newComponents = componentFiles.filter(
      f => f.startsWith("src/components/") && f.endsWith(".tsx") && !registeredPatterns.includes(f)
    );

    if (pagesToUpdate.length === 0 && newComponents.length === 0) {
      return new Response(JSON.stringify({
        updated: 0,
        message: "Documentation is already up to date",
        newComponents: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Use AI to generate/update documentation
    const results: { slug: string; status: string }[] = [];

    if (lovableKey && pagesToUpdate.length > 0) {
      // Batch pages into a single AI call for efficiency
      const prompt = buildDocUpdatePrompt(pagesToUpdate, newComponents);

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a technical documentation writer for a political research platform called OppoDB. Write clear, detailed Markdown documentation with proper headings, code examples, and technical details. Each section should cover: overview, key components, data sources, database tables used, and user-facing features. Use ## for main headings and ### for sub-headings.`,
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "update_wiki_pages",
                description: "Update multiple wiki documentation pages",
                parameters: {
                  type: "object",
                  properties: {
                    pages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          slug: { type: "string" },
                          title: { type: "string" },
                          content: { type: "string", description: "Full Markdown content for the wiki page" },
                        },
                        required: ["slug", "title", "content"],
                      },
                    },
                  },
                  required: ["pages"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "update_wiki_pages" } },
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI error:", aiRes.status, errText);

        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiRes.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fall back to template-based updates
        for (const page of pagesToUpdate) {
          await upsertPage(supabase, page.slug, page.title, page.existingContent || generateFallbackContent(page), page.sortOrder);
          results.push({ slug: page.slug, status: "fallback" });
        }
      } else {
        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const page of parsed.pages || []) {
            const meta = FEATURE_REGISTRY[page.slug];
            await upsertPage(supabase, page.slug, page.title, page.content, meta?.sortOrder ?? 99);
            results.push({ slug: page.slug, status: "ai-updated" });
          }
        }
      }
    } else {
      // No AI key — use template fallback
      for (const page of pagesToUpdate) {
        await upsertPage(supabase, page.slug, page.title, generateFallbackContent(page), page.sortOrder);
        results.push({ slug: page.slug, status: "template" });
      }
    }

    return new Response(JSON.stringify({
      updated: results.length,
      results,
      newComponents: newComponents.map(f => f.replace("src/components/", "").replace(".tsx", "")),
      message: `Updated ${results.length} documentation page(s)`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-docs error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertPage(
  supabase: any,
  slug: string,
  title: string,
  content: string,
  sortOrder: number,
  triggeredBy?: string,
  triggerMethod = "manual",
) {
  const { data: existing } = await supabase
    .from("wiki_pages")
    .select("id, content")
    .eq("slug", slug)
    .maybeSingle();

  const oldContent = existing?.content || "";
  const changeType = existing ? "updated" : "created";

  // Only log if content actually changed
  if (oldContent !== content) {
    await supabase.from("wiki_changelog").insert({
      slug,
      title,
      old_content: oldContent,
      new_content: content,
      change_type: changeType,
      triggered_by: triggeredBy || null,
      trigger_method: triggerMethod,
    });
  }

  if (existing) {
    await supabase
      .from("wiki_pages")
      .update({ content, title, updated_at: new Date().toISOString() })
      .eq("slug", slug);
  } else {
    await supabase
      .from("wiki_pages")
      .insert({ slug, title, content, sort_order: sortOrder, published: true });
  }
}

function buildDocUpdatePrompt(
  pages: { slug: string; title: string; sourceFiles: string[]; existingContent: string }[],
  newComponents: string[]
): string {
  let prompt = `Update the following wiki documentation pages for the OppoDB political research platform.\n\n`;

  for (const page of pages) {
    prompt += `## Page: ${page.slug} (${page.title})\n`;
    prompt += `Source files: ${page.sourceFiles.join(", ")}\n`;
    if (page.existingContent) {
      prompt += `Current content (update/expand this):\n\`\`\`\n${page.existingContent.slice(0, 2000)}\n\`\`\`\n\n`;
    } else {
      prompt += `This is a NEW page — generate comprehensive documentation.\n\n`;
    }
  }

  if (newComponents.length > 0) {
    prompt += `\n## New Components Detected (not yet documented)\n`;
    prompt += newComponents.join(", ") + "\n";
    prompt += `Mention these in the relevant pages if applicable.\n`;
  }

  prompt += `\nReturn each page with its slug, title, and full Markdown content. Include technical details, component names, database tables, and user-facing features.`;

  return prompt;
}

function generateFallbackContent(page: { slug: string; title: string; sourceFiles: string[]; existingContent: string }): string {
  if (page.existingContent) return page.existingContent;

  return `# ${page.title}

## Overview

This section documents the ${page.title} feature of the OppoDB platform.

## Key Components

${page.sourceFiles.map(f => `- \`${f}\``).join("\n")}

## Features

Documentation for this section is being generated. Check back soon for detailed technical information.

---
*Auto-generated documentation page*
`;
}
