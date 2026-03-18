import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin or moderator role
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const canEdit = userRoles.includes("admin") || userRoles.includes("moderator");
    
    if (!canEdit) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // --- CREATE or UPDATE a candidate profile ---
    if (action === "upsert") {
      const { name, slug, content, is_subpage, parent_slug, subpage_title } = body;
      if (!name || !slug || !content) {
        return new Response(JSON.stringify({ error: "name, slug, and content are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const github_path = `candidates/${slug}.md`;
      const { data, error } = await supabaseAdmin
        .from("candidate_profiles")
        .upsert({
          name,
          slug,
          content,
          github_path,
          is_subpage: is_subpage || false,
          parent_slug: parent_slug || null,
          subpage_title: subpage_title || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "slug" })
        .select()
        .single();

      if (error) {
        console.error("Upsert error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, profile: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DELETE a candidate profile ---
    if (action === "delete") {
      const { slug } = body;
      if (!slug) {
        return new Response(JSON.stringify({ error: "slug is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete subpages too
      await supabaseAdmin.from("candidate_profiles").delete().eq("parent_slug", slug);
      const { error } = await supabaseAdmin.from("candidate_profiles").delete().eq("slug", slug);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- SCRAPE: Auto-generate a candidate profile using AI ---
    if (action === "scrape") {
      const { candidate_name, office, state, district, party } = body;
      if (!candidate_name) {
        return new Response(JSON.stringify({ error: "candidate_name is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      // Gather existing data from congress_members if available
      let congressData = "";
      const { data: members } = await supabaseAdmin
        .from("congress_members")
        .select("*")
        .or(`name.ilike.%${candidate_name}%,last_name.ilike.%${candidate_name.split(" ").pop()}%`)
        .limit(3);

      if (members && members.length > 0) {
        congressData = `\n\nCONGRESS.GOV DATA:\n${JSON.stringify(members[0], null, 2)}`;
      }

      // Check campaign finance
      let financeData = "";
      const { data: finance } = await supabaseAdmin
        .from("campaign_finance")
        .select("*")
        .ilike("candidate_name", `%${candidate_name}%`)
        .limit(1);

      if (finance && finance.length > 0) {
        financeData = `\n\nCAMPAIGN FINANCE DATA:\n${JSON.stringify(finance[0], null, 2)}`;
      }

      // Check election results
      let electionData = "";
      const { data: elections } = await supabaseAdmin
        .from("congressional_election_results")
        .select("*")
        .ilike("candidate_name", `%${candidate_name}%`)
        .order("election_year", { ascending: false })
        .limit(5);

      if (elections && elections.length > 0) {
        electionData = `\n\nELECTION HISTORY:\n${JSON.stringify(elections, null, 2)}`;
      }

      const scrapePrompt = `Generate a comprehensive opposition research profile for ${candidate_name}.
Office: ${office || "Unknown"}
State: ${state || "Unknown"}
District: ${district || "N/A"}
Party: ${party || "Republican"}

Available database records:${congressData}${financeData}${electionData}

Create a detailed markdown profile covering:
1. **Background & Biography** - Career history, education, personal background
2. **Political Record** - Voting record highlights, key positions, committee assignments
3. **Key Vulnerabilities** - Opposition research angles, controversies, flip-flops
4. **Campaign Finance** - Funding sources, notable donors, PAC connections
5. **Issue Positions** - Stances on healthcare, economy, immigration, abortion, guns, climate
6. **Electoral History** - Past race results, margins, district trends
7. **Messaging Opportunities** - Potential attack lines and contrast points

Use the provided data where available. For information not in the database, use your knowledge of this candidate. Be thorough and factual. Format as clean markdown with headers and bullet points.

Start the profile with:
# ${candidate_name}
**Office:** [office]
**State:** [state]
**Party:** [party]
**Status:** [incumbent/challenger/open seat]`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: "You are an expert political researcher specializing in opposition research. Generate detailed, factual candidate profiles using available data and your knowledge. Be thorough and include specific details, dates, and sources where possible."
            },
            { role: "user", content: scrapePrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI scrape error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "Failed to generate profile" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const generatedContent = aiData.choices?.[0]?.message?.content || "";

      if (!generatedContent) {
        return new Response(JSON.stringify({ error: "AI returned empty content" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate slug from name
      const slug = candidate_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const github_path = `candidates/${slug}.md`;

      // Save to database
      const { data: saved, error: saveError } = await supabaseAdmin
        .from("candidate_profiles")
        .upsert({
          name: candidate_name,
          slug,
          content: generatedContent,
          github_path,
          is_subpage: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "slug" })
        .select()
        .single();

      if (saveError) {
        console.error("Save error:", saveError);
        return new Response(JSON.stringify({ error: saveError.message, content: generatedContent }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, profile: saved, content: generatedContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- BATCH SCRAPE: Discover and generate profiles for multiple candidates ---
    if (action === "batch_discover") {
      const { level, state: targetState } = body;
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      // Get existing profile slugs to avoid duplicates
      const { data: existing } = await supabaseAdmin
        .from("candidate_profiles")
        .select("slug, name")
        .eq("is_subpage", false);
      
      const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase()));

      // Discover candidates from congress_members table
      let discovered: { name: string; office: string; state: string; party: string; district?: string }[] = [];

      if (level === "federal" || level === "all") {
        const query = supabaseAdmin.from("congress_members").select("name, state, party, district, chamber");
        if (targetState) query.eq("state", targetState);
        const { data: members } = await query.limit(100);

        if (members) {
          for (const m of members) {
            if (!existingNames.has(m.name.toLowerCase())) {
              discovered.push({
                name: m.name,
                office: m.chamber === "senate" ? "US Senate" : "US House",
                state: m.state || "",
                party: m.party || "Republican",
                district: m.district || undefined,
              });
            }
          }
        }
      }

      // Discover from election results
      if (level === "state" || level === "all") {
        const query = supabaseAdmin
          .from("state_leg_election_results")
          .select("candidate_name, state_abbr, chamber, district_number, party")
          .eq("is_winner", true)
          .order("election_year", { ascending: false });
        if (targetState) query.eq("state_abbr", targetState);
        const { data: stateResults } = await query.limit(100);

        if (stateResults) {
          const seen = new Set<string>();
          for (const r of stateResults) {
            const key = r.candidate_name.toLowerCase();
            if (!existingNames.has(key) && !seen.has(key)) {
              seen.add(key);
              discovered.push({
                name: r.candidate_name,
                office: `State ${r.chamber === "upper" ? "Senate" : "House"}`,
                state: r.state_abbr,
                party: r.party || "Republican",
                district: r.district_number,
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        discovered: discovered.slice(0, 50),
        total: discovered.length,
        existing_count: existingNames.size,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Scraper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
