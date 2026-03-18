import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 100000;

const PROFILE_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_candidate_profile",
      description: "Create a new candidate profile. Use when the user asks to create, add, or generate a new candidate research profile.",
      parameters: {
        type: "object",
        properties: {
          candidate_name: { type: "string", description: "Full name of the candidate" },
          office: { type: "string", description: "Office sought or held (e.g. US House, US Senate, Governor, State Senate)" },
          state: { type: "string", description: "State abbreviation (e.g. MN, CA)" },
          district: { type: "string", description: "District number if applicable" },
          party: { type: "string", description: "Political party", enum: ["Republican", "Democrat", "Independent", "Other"] },
        },
        required: ["candidate_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_candidate_profile",
      description: "Edit or update an existing candidate profile's content. Use when the user asks to modify, update, add information to, or fix a profile.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The candidate's slug identifier" },
          new_content: { type: "string", description: "The complete updated markdown content for the profile" },
          edit_description: { type: "string", description: "Brief description of what was changed" },
        },
        required: ["slug", "new_content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_candidates",
      description: "Search existing candidate profiles in the database. Use to find profiles before editing or to check if a candidate already exists.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term - candidate name or keyword" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "discover_candidates",
      description: "Discover candidates from election data who don't have profiles yet. Use when the user wants to find new candidates to profile.",
      parameters: {
        type: "object",
        properties: {
          level: { type: "string", description: "Government level to search", enum: ["federal", "state", "all"] },
          state: { type: "string", description: "Optional state filter (abbreviation)" },
        },
        required: ["level"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_issue_subpages",
      description: "Generate issue-specific research subpages for an existing candidate profile. Creates detailed sub-reports on topics like Healthcare, Abortion, Economy, Immigration, etc. Use when the user asks to create subpages, issue pages, or deep-dive research pages for a candidate.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The candidate's slug identifier (from search results)" },
          issues: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of specific issues to generate. If omitted, generates all default issues: Healthcare, Economy & Tariffs, Abortion & Reproductive Rights, Social Security & Medicare, Immigration, Gun Policy, Climate & Energy, Education, Campaign Finance & Ethics, January 6th & Democracy",
          },
        },
        required: ["slug"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check roles for edit capabilities
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const canEdit = userRoles.includes("admin") || userRoles.includes("moderator");

    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Invalid request: messages must be an array of 1-20 items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== "object") {
        return new Response(JSON.stringify({ error: "Invalid message format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["user", "assistant", "system", "tool"].includes(msg.role)) {
        return new Response(JSON.stringify({ error: "Invalid message role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content === "string" && msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: "Message content too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a political research assistant with expertise in opposition research. You help users research, create, edit, and manage candidate profiles.

Your capabilities:
- Search existing candidate profiles
- Create new candidate profiles (auto-generated using AI + available data)
- Edit and update existing profiles with new information
- Discover candidates from election data who need profiles
- Answer questions about candidates and political research

${canEdit ? "This user has EDITOR permissions and can create/edit/delete profiles." : "This user has READ-ONLY access. They can search and view profiles but cannot create or edit them. If they request edits, politely explain they need admin or moderator access."}

When creating or editing profiles, always use the available tools. When asked to create a profile, use the create_candidate_profile tool. When asked to edit, first search for the profile, then use edit_candidate_profile with the complete updated content.

Format responses with clear headers and bullet points. Be direct, factual, and analytically rigorous.`;

    // First AI call with tools
    const aiPayload: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: false, // Non-streaming for tool calls
    };

    if (canEdit) {
      aiPayload.tools = PROFILE_TOOLS;
      aiPayload.tool_choice = "auto";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiPayload),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const choice = aiResult.choices?.[0];

    // Check if the AI wants to call tools
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      const toolResults: any[] = [];
      const toolCallMessages: any[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        let toolResult = "";

        if (fnName === "search_candidates") {
          const { data: profiles } = await supabaseAdmin
            .from("candidate_profiles")
            .select("slug, name, content, is_subpage, parent_slug, updated_at")
            .or(`name.ilike.%${args.query}%,slug.ilike.%${args.query}%,content.ilike.%${args.query}%`)
            .eq("is_subpage", false)
            .limit(10);

          if (profiles && profiles.length > 0) {
            toolResult = JSON.stringify(profiles.map((p: any) => ({
              name: p.name,
              slug: p.slug,
              updated_at: p.updated_at,
              content_preview: p.content.substring(0, 500) + "...",
            })));
          } else {
            toolResult = JSON.stringify({ message: "No profiles found matching the query." });
          }
        }

        if (fnName === "create_candidate_profile") {
          // Call the candidate-scraper function internally
          const scraperUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/candidate-scraper`;
          const scraperResp = await fetch(scraperUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              action: "scrape",
              candidate_name: args.candidate_name,
              office: args.office,
              state: args.state,
              district: args.district,
              party: args.party,
            }),
          });
          const scraperData = await scraperResp.json();
          
          if (scraperData.success) {
            toolResult = JSON.stringify({
              success: true,
              message: `Profile created for ${args.candidate_name}`,
              slug: scraperData.profile?.slug,
              content_preview: scraperData.content?.substring(0, 300) + "...",
            });
          } else {
            toolResult = JSON.stringify({ success: false, error: scraperData.error });
          }
        }

        if (fnName === "edit_candidate_profile") {
          // Get current profile to preserve name
          const { data: current } = await supabaseAdmin
            .from("candidate_profiles")
            .select("name")
            .eq("slug", args.slug)
            .single();

          if (!current) {
            toolResult = JSON.stringify({ success: false, error: "Profile not found" });
          } else {
            const { error } = await supabaseAdmin
              .from("candidate_profiles")
              .update({
                content: args.new_content,
                updated_at: new Date().toISOString(),
              })
              .eq("slug", args.slug);

            if (error) {
              toolResult = JSON.stringify({ success: false, error: error.message });
            } else {
              toolResult = JSON.stringify({
                success: true,
                message: `Profile for ${current.name} updated successfully`,
                edit: args.edit_description || "Content updated",
              });
            }
          }
        }

        if (fnName === "discover_candidates") {
          const scraperUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/candidate-scraper`;
          const discoverResp = await fetch(scraperUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              action: "batch_discover",
              level: args.level,
              state: args.state,
            }),
          });
          const discoverData = await discoverResp.json();
          toolResult = JSON.stringify(discoverData);
        }

        if (fnName === "generate_issue_subpages") {
          const scraperUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/candidate-scraper`;
          const subpageResp = await fetch(scraperUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              action: "generate_subpages",
              slug: args.slug,
              issues: args.issues,
            }),
          });
          const subpageData = await subpageResp.json();
          toolResult = JSON.stringify(subpageData);
        }

        toolCallMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Second AI call with tool results - this time streaming
      const followupResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            ...toolCallMessages,
          ],
          stream: true,
        }),
      });

      if (!followupResponse.ok) {
        const t = await followupResponse.text();
        console.error("Followup AI error:", followupResponse.status, t);
        // Fall back to non-streaming result
        const toolSummary = toolCallMessages.map((t: any) => t.content).join("\n");
        return new Response(JSON.stringify({
          choices: [{ message: { role: "assistant", content: `Action completed. Results:\n${toolSummary}` } }],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(followupResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls - re-do as streaming for better UX
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("Stream error:", streamResponse.status, t);
      // Return the non-streaming result
      return new Response(JSON.stringify(aiResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
