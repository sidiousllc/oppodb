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
  {
    type: "function",
    function: {
      name: "deep_research",
      description: "Perform deep research on a political topic, candidate, policy issue, or electoral question. Use when the user asks for thorough analysis, deep dives, comprehensive research, or detailed breakdowns. This uses extended reasoning for more thorough responses.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The research topic or question to investigate deeply" },
          context: { type: "string", description: "Additional context like state, district, timeframe, etc." },
        },
        required: ["topic"],
        additionalProperties: false,
      },
    },
  },
];

// Helper: send an SSE event
function sseEvent(data: string): Uint8Array {
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

// Helper: send a progress message as a fake SSE delta
function progressEvent(text: string): Uint8Array {
  const chunk = {
    choices: [{ delta: { content: text }, index: 0 }],
  };
  return sseEvent(JSON.stringify(chunk));
}

// Helper: collect full response from a streaming SSE body
async function collectStreamResponse(body: ReadableStream<Uint8Array>): Promise<{ content: string; toolCalls: any[] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  const toolCalls: Record<number, { id: string; function: { name: string; arguments: string } }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = { id: tc.id || "", function: { name: "", arguments: "" } };
            }
            if (tc.id) toolCalls[tc.index].id = tc.id;
            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      } catch {
        // partial JSON, skip
      }
    }
  }

  return { content, toolCalls: Object.values(toolCalls) };
}

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
- Generate issue-specific subpages for candidates (e.g. Healthcare, Abortion, Economy, Immigration, etc.)
- Deep research on any political topic using extended reasoning
- Answer questions about candidates and political research

${canEdit ? "This user has EDITOR permissions and can create/edit/delete profiles." : "This user has READ-ONLY access. They can search and view profiles but cannot create or edit them. If they request edits, politely explain they need admin or moderator access."}

When creating or editing profiles, always use the available tools. When asked to create a profile, use the create_candidate_profile tool. When asked to edit, first search for the profile, then use edit_candidate_profile with the complete updated content.

When asked to generate subpages or issue pages for a candidate, first search for the candidate to get their slug, then use generate_issue_subpages.

For complex research questions, analysis requests, deep dives, or anything requiring thorough investigation, use the deep_research tool. This gives you extended thinking time for better analysis.

After creating a new candidate profile, proactively suggest generating issue subpages for that candidate.

Format responses with clear headers and bullet points. Be direct, factual, and analytically rigorous.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const aiPayload: any = {
      model: "google/gemini-3-flash-preview",
      messages: aiMessages,
      stream: true,
    };

    if (canEdit) {
      aiPayload.tools = PROFILE_TOOLS;
      aiPayload.tool_choice = "auto";
    }

    // First call - always streaming now
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

    // Peek at the stream to detect tool calls vs plain content
    // We need to consume the stream to check for tool_calls
    const { content: firstContent, toolCalls } = await collectStreamResponse(response.body!);

    // If no tool calls, we already have the content - send it as SSE
    if (toolCalls.length === 0) {
      const stream = new ReadableStream({
        start(controller) {
          // Send the already-collected content as SSE chunks (split into reasonable pieces for smooth rendering)
          const chunkSize = 20;
          for (let i = 0; i < firstContent.length; i += chunkSize) {
            const piece = firstContent.slice(i, i + chunkSize);
            controller.enqueue(progressEvent(piece));
          }
          controller.enqueue(sseEvent("[DONE]"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // --- Tool call path: send progress updates while executing ---
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Run tool execution in the background
    (async () => {
      try {
        await writer.write(progressEvent("🔍 *Analyzing your request...*\n\n"));

        const toolCallMessages: any[] = [];
        const assistantMessage: any = {
          role: "assistant",
          content: firstContent || null,
          tool_calls: toolCalls.map((tc, i) => ({
            id: tc.id || `call_${i}`,
            type: "function",
            function: tc.function,
          })),
        };

        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let args: any;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          let toolResult = "";

          const WRITE_TOOLS = ["create_candidate_profile", "edit_candidate_profile", "discover_candidates", "generate_issue_subpages"];
          if (WRITE_TOOLS.includes(fnName) && !canEdit) {
            toolResult = JSON.stringify({ success: false, error: "Permission denied. Only admin or moderator accounts can create or modify content." });
            toolCallMessages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
            continue;
          }

          // Send progress for each tool
          if (fnName === "search_candidates") {
            await writer.write(progressEvent(`🔎 Searching for "${args.query}"...\n`));
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
            await writer.write(progressEvent(`📝 Creating profile for **${args.candidate_name}**... This may take a moment.\n`));
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
            await writer.write(progressEvent(`✏️ Updating profile **${args.slug}**...\n`));
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
            await writer.write(progressEvent(`🗺️ Discovering candidates at **${args.level}** level${args.state ? ` in ${args.state}` : ""}...\n`));
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
            const issueList = args.issues ? args.issues.join(", ") : "all default issues";
            await writer.write(progressEvent(`📚 Generating issue research pages (${issueList}) for **${args.slug}**... This will take a minute.\n`));
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

          if (fnName === "deep_research") {
            await writer.write(progressEvent(`🧠 Starting deep research on **${args.topic}**... Using extended reasoning.\n\n`));

            // Gather relevant data from the database for context
            const contextParts: string[] = [];

            // Search candidate profiles for relevant info
            const topicWords = args.topic.split(/\s+/).slice(0, 3).join("%");
            const { data: relatedProfiles } = await supabaseAdmin
              .from("candidate_profiles")
              .select("name, slug, content")
              .or(`name.ilike.%${topicWords}%,content.ilike.%${topicWords}%`)
              .eq("is_subpage", false)
              .limit(5);

            if (relatedProfiles?.length) {
              contextParts.push("## Related Candidate Profiles\n" + relatedProfiles.map((p: any) =>
                `### ${p.name}\n${p.content.substring(0, 1000)}`
              ).join("\n\n"));
            }

            // Search polling data
            const { data: relatedPolling } = await supabaseAdmin
              .from("polling_data")
              .select("*")
              .or(`candidate_or_topic.ilike.%${topicWords}%,question.ilike.%${topicWords}%`)
              .order("date_conducted", { ascending: false })
              .limit(10);

            if (relatedPolling?.length) {
              contextParts.push("## Related Polling Data\n" + relatedPolling.map((p: any) =>
                `- ${p.source}: ${p.candidate_or_topic} — ${p.approve_pct ? `Approve: ${p.approve_pct}%` : ""} ${p.favor_pct ? `Favor: ${p.favor_pct}%` : ""} (${p.date_conducted})`
              ).join("\n"));
            }

            // Search election forecasts
            const { data: forecasts } = await supabaseAdmin
              .from("election_forecasts")
              .select("*")
              .or(`state_abbr.ilike.%${topicWords}%,district.ilike.%${topicWords}%`)
              .limit(10);

            if (forecasts?.length) {
              contextParts.push("## Election Forecasts\n" + forecasts.map((f: any) =>
                `- ${f.source}: ${f.state_abbr}${f.district ? `-${f.district}` : ""} ${f.race_type} — Rating: ${f.rating || "N/A"}, Dem win: ${f.dem_win_prob || "N/A"}%`
              ).join("\n"));
            }

            await writer.write(progressEvent(`📊 Gathered ${contextParts.length} data sources. Analyzing...\n\n`));

            // Deep research call with reasoning enabled
            const deepPrompt = `Perform a thorough, deep-dive analysis on the following topic. Use all available data provided below.

## Research Topic
${args.topic}

${args.context ? `## Additional Context\n${args.context}\n` : ""}

## Available Database Context
${contextParts.length > 0 ? contextParts.join("\n\n") : "No directly matching data found in the database."}

## Instructions
- Provide comprehensive, analytically rigorous analysis
- Include relevant data points and statistics from the provided context
- Identify key trends, vulnerabilities, and strategic implications
- Structure your response with clear headers and subsections
- Be thorough but concise — prioritize actionable insights`;

            const deepResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: deepPrompt },
                ],
                stream: true,
                reasoning: { effort: "high" },
              }),
            });

            if (deepResponse.ok && deepResponse.body) {
              // Stream the deep research response directly to the client
              const deepReader = deepResponse.body.getReader();
              const deepDecoder = new TextDecoder();
              let deepBuf = "";

              // Clear the progress messages by sending a separator
              await writer.write(progressEvent("\n---\n\n"));

              while (true) {
                const { done: dDone, value: dValue } = await deepReader.read();
                if (dDone) break;
                deepBuf += deepDecoder.decode(dValue, { stream: true });

                let dIdx: number;
                while ((dIdx = deepBuf.indexOf("\n")) !== -1) {
                  let dLine = deepBuf.slice(0, dIdx);
                  deepBuf = deepBuf.slice(dIdx + 1);
                  if (dLine.endsWith("\r")) dLine = dLine.slice(0, -1);
                  if (!dLine.startsWith("data: ")) continue;
                  const dJson = dLine.slice(6).trim();
                  if (dJson === "[DONE]") continue;
                  try {
                    const dParsed = JSON.parse(dJson);
                    const dContent = dParsed.choices?.[0]?.delta?.content;
                    if (dContent) {
                      await writer.write(progressEvent(dContent));
                    }
                  } catch {
                    // partial
                  }
                }
              }

              toolResult = JSON.stringify({ success: true, message: "Deep research completed and streamed to user." });
            } else {
              toolResult = JSON.stringify({ success: false, error: "Deep research request failed" });
            }
          }

          toolCallMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        // Check if deep_research already streamed its response
        const hadDeepResearch = assistantMessage.tool_calls.some((tc: any) => tc.function.name === "deep_research");
        if (hadDeepResearch) {
          await writer.write(sseEvent("[DONE]"));
          await writer.close();
          return;
        }

        // Clear progress and send final summary
        await writer.write(progressEvent("\n"));

        // Second AI call with tool results - streaming
        const followupResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              ...aiMessages,
              assistantMessage,
              ...toolCallMessages,
            ],
            stream: true,
          }),
        });

        if (followupResponse.ok && followupResponse.body) {
          const fReader = followupResponse.body.getReader();
          const fDecoder = new TextDecoder();
          let fBuf = "";

          while (true) {
            const { done: fDone, value: fValue } = await fReader.read();
            if (fDone) break;
            fBuf += fDecoder.decode(fValue, { stream: true });

            let fIdx: number;
            while ((fIdx = fBuf.indexOf("\n")) !== -1) {
              const fLine = fBuf.slice(0, fIdx);
              fBuf = fBuf.slice(fIdx + 1);
              // Pass through SSE lines directly
              if (fLine.startsWith("data: ")) {
                await writer.write(sseEvent(fLine.slice(6)));
              }
            }
          }
        } else {
          const toolSummary = toolCallMessages.map((t: any) => t.content).join("\n");
          await writer.write(progressEvent(`Action completed. Results:\n${toolSummary}`));
        }

        await writer.write(sseEvent("[DONE]"));
        await writer.close();
      } catch (e) {
        console.error("Tool execution error:", e);
        await writer.write(progressEvent("\n\n⚠️ An error occurred during processing. Please try again."));
        await writer.write(sseEvent("[DONE]"));
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
