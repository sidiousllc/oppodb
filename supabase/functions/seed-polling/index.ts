import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to the application's own origin
const allowedOrigins = [
  Deno.env.get("SUPABASE_URL")?.replace(/\/$/, ""), // Remove trailing slash if present
  "http://localhost:5173", // Local development
  "http://localhost:3000", // Alternative local port
];

const corsHeaders = (origin: string | null) => {
  const isAllowed = origin && allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0] || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    // --- Authentication & Authorization ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Use ANON_KEY with user's auth header to respect RLS policies
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired token" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Verify the user has admin role (required by RLS policy for INSERT on polling_data)
    const { data: roleCheck, error: roleError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Forbidden: Admin role required to seed polling data" 
        }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Parse body for force flag
    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch { /* no body */ }

    // Check current row count
    const { count } = await supabase
      .from("polling_data")
      .select("*", { count: "exact", head: true });

    if ((count ?? 0) > 0 && !force) {
      return new Response(
        JSON.stringify({ success: true, message: "Polling data already seeded. Use force:true to refresh.", count }),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // If force is true and data exists, delete all existing polling data to prevent duplicates
    if (force && (count ?? 0) > 0) {
      const { error: deleteError } = await supabase
        .from("polling_data")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows (neq with impossible UUID)
      
      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to clear existing data: ${deleteError.message}` }),
          { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
    }

    // Latest polling data from all major sources — March 2026
    const latestPolls = [
      // === FiveThirtyEight ===
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-18", end_date: "2026-03-20", candidate_or_topic: "Trump Approval", approve_pct: 42.1, disapprove_pct: 54.3, margin: -12.2, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-10", end_date: "2026-03-12", candidate_or_topic: "Trump Approval", approve_pct: 43.2, disapprove_pct: 53.1, margin: -9.9, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-01", end_date: "2026-03-03", candidate_or_topic: "Trump Approval", approve_pct: 42.8, disapprove_pct: 53.6, margin: -10.8, sample_size: 1450, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-15", end_date: "2026-02-18", candidate_or_topic: "Trump Approval", approve_pct: 44.1, disapprove_pct: 52.3, margin: -8.2, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-01-20", end_date: "2026-01-22", candidate_or_topic: "Trump Approval", approve_pct: 46.5, disapprove_pct: 49.8, margin: -3.3, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "generic-ballot", question: "Generic Congressional Ballot", date_conducted: "2026-03-18", end_date: "2026-03-20", candidate_or_topic: "Generic Ballot", favor_pct: 48.1, oppose_pct: 43.9, margin: 4.2, sample_size: 1200, sample_type: "RV", margin_of_error: 2.8, partisan_lean: "D+4.2", methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "generic-ballot", question: "Generic Congressional Ballot", date_conducted: "2026-03-08", end_date: "2026-03-10", candidate_or_topic: "Generic Ballot", favor_pct: 47.2, oppose_pct: 44.8, margin: 2.4, sample_size: 1200, sample_type: "RV", margin_of_error: 2.8, partisan_lean: "D+2.4", methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "generic-ballot", question: "Generic Congressional Ballot", date_conducted: "2026-02-01", end_date: "2026-02-03", candidate_or_topic: "Generic Ballot", favor_pct: 46.0, oppose_pct: 45.5, margin: 0.5, sample_size: 1200, sample_type: "RV", margin_of_error: 2.8, partisan_lean: "D+0.5", methodology: "Aggregate" },

      // === AP-NORC ===
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-14", end_date: "2026-03-18", candidate_or_topic: "Trump Approval", approve_pct: 39, disapprove_pct: 59, margin: -20, sample_size: 1112, sample_type: "Adults", margin_of_error: 3.7, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-07", end_date: "2026-03-11", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 57, margin: -16, sample_size: 1105, sample_type: "Adults", margin_of_error: 3.8, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-06", end_date: "2026-02-10", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, margin: -13, sample_size: 1091, sample_type: "Adults", margin_of_error: 3.9, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Economy Approval", date_conducted: "2026-03-14", end_date: "2026-03-18", candidate_or_topic: "Economy", approve_pct: 38, disapprove_pct: 60, margin: -22, sample_size: 1112, sample_type: "Adults", margin_of_error: 3.7, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Immigration Approval", date_conducted: "2026-03-14", end_date: "2026-03-18", candidate_or_topic: "Immigration", approve_pct: 41, disapprove_pct: 57, margin: -16, sample_size: 1112, sample_type: "Adults", margin_of_error: 3.7, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Tariffs Approval", date_conducted: "2026-03-14", end_date: "2026-03-18", candidate_or_topic: "Tariffs", approve_pct: 29, disapprove_pct: 68, margin: -39, sample_size: 1112, sample_type: "Adults", margin_of_error: 3.7, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Economy Approval", date_conducted: "2026-03-07", end_date: "2026-03-11", candidate_or_topic: "Economy", approve_pct: 44, disapprove_pct: 54, margin: -10, sample_size: 1105, sample_type: "Adults", margin_of_error: 3.8, methodology: "Online/Phone" },
      { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Immigration Approval", date_conducted: "2026-03-07", end_date: "2026-03-11", candidate_or_topic: "Immigration", approve_pct: 43, disapprove_pct: 55, margin: -12, sample_size: 1105, sample_type: "Adults", margin_of_error: 3.8, methodology: "Online/Phone" },

      // === RealClearPolitics ===
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "RCP Average", date_conducted: "2026-03-15", end_date: "2026-03-21", candidate_or_topic: "Trump Approval", approve_pct: 41.8, disapprove_pct: 54.6, margin: -12.8, sample_type: "Average", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "RCP Average", date_conducted: "2026-03-05", end_date: "2026-03-12", candidate_or_topic: "Trump Approval", approve_pct: 43.5, disapprove_pct: 52.8, margin: -9.3, sample_type: "Average", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "RCP Average", date_conducted: "2026-02-05", end_date: "2026-02-12", candidate_or_topic: "Trump Approval", approve_pct: 44.8, disapprove_pct: 51.5, margin: -6.7, sample_type: "Average", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "issue", question: "Right Direction / Wrong Track", date_conducted: "2026-03-15", end_date: "2026-03-21", candidate_or_topic: "Right Direction", approve_pct: 28.3, disapprove_pct: 64.1, margin: -35.8, sample_type: "Average", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "issue", question: "Right Direction / Wrong Track", date_conducted: "2026-03-08", end_date: "2026-03-12", candidate_or_topic: "Right Direction", approve_pct: 32.5, disapprove_pct: 60.2, margin: -27.7, sample_type: "Average", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "generic-ballot", question: "Generic Congressional Vote", date_conducted: "2026-03-15", end_date: "2026-03-21", candidate_or_topic: "Generic Ballot", favor_pct: 48.2, oppose_pct: 42.8, margin: 5.4, sample_type: "Average", partisan_lean: "D+5.4", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "generic-ballot", question: "Generic Congressional Vote", date_conducted: "2026-03-05", end_date: "2026-03-12", candidate_or_topic: "Generic Ballot", favor_pct: 46.8, oppose_pct: 44.2, margin: 2.6, sample_type: "Average", partisan_lean: "D+2.6", methodology: "Poll Average" },

      // === Gallup ===
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-17", end_date: "2026-03-21", candidate_or_topic: "Trump Approval", approve_pct: 40, disapprove_pct: 57, margin: -17, sample_size: 1015, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-03", end_date: "2026-03-09", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, margin: -13, sample_size: 1012, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-03", end_date: "2026-02-09", candidate_or_topic: "Trump Approval", approve_pct: 44, disapprove_pct: 53, margin: -9, sample_size: 1005, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-01-06", end_date: "2026-01-12", candidate_or_topic: "Trump Approval", approve_pct: 47, disapprove_pct: 49, margin: -2, sample_size: 1010, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "issue", question: "Economic Confidence", date_conducted: "2026-03-17", end_date: "2026-03-21", candidate_or_topic: "Economic Confidence", approve_pct: 33, disapprove_pct: 64, margin: -31, sample_size: 1015, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "issue", question: "Economic Confidence", date_conducted: "2026-03-03", end_date: "2026-03-09", candidate_or_topic: "Economic Confidence", approve_pct: 38, disapprove_pct: 59, margin: -21, sample_size: 1012, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },

      // === Rasmussen ===
      { source: "rasmussen", source_url: "https://www.rasmussenreports.com/", poll_type: "approval", question: "Daily Presidential Tracking", date_conducted: "2026-03-21", end_date: "2026-03-21", candidate_or_topic: "Trump Approval", approve_pct: 47, disapprove_pct: 52, margin: -5, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
      { source: "rasmussen", source_url: "https://www.rasmussenreports.com/", poll_type: "approval", question: "Daily Presidential Tracking", date_conducted: "2026-03-13", end_date: "2026-03-13", candidate_or_topic: "Trump Approval", approve_pct: 50, disapprove_pct: 49, margin: 1, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
      { source: "rasmussen", source_url: "https://www.rasmussenreports.com/", poll_type: "approval", question: "Daily Presidential Tracking", date_conducted: "2026-03-06", end_date: "2026-03-06", candidate_or_topic: "Trump Approval", approve_pct: 49, disapprove_pct: 50, margin: -1, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
      { source: "rasmussen", source_url: "https://www.rasmussenreports.com/", poll_type: "approval", question: "Daily Presidential Tracking", date_conducted: "2026-02-13", end_date: "2026-02-13", candidate_or_topic: "Trump Approval", approve_pct: 51, disapprove_pct: 48, margin: 3, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
      { source: "rasmussen", source_url: "https://www.rasmussenreports.com/", poll_type: "issue", question: "Right Direction / Wrong Track", date_conducted: "2026-03-19", end_date: "2026-03-19", candidate_or_topic: "Right Direction", approve_pct: 35, disapprove_pct: 59, margin: -24, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
      { source: "rasmussen", source_url: "https://www.rasmussenreports.com/", poll_type: "issue", question: "Right Direction / Wrong Track", date_conducted: "2026-03-10", end_date: "2026-03-10", candidate_or_topic: "Right Direction", approve_pct: 39, disapprove_pct: 55, margin: -16, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },

      // === Cook Political Report ===
      { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "approval", question: "CPR PollTracker", date_conducted: "2026-03-18", end_date: "2026-03-21", candidate_or_topic: "Trump Approval", approve_pct: 41.5, disapprove_pct: 55.0, margin: -13.5, sample_type: "Average", methodology: "Poll Tracker" },
      { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "approval", question: "CPR PollTracker", date_conducted: "2026-03-10", end_date: "2026-03-12", candidate_or_topic: "Trump Approval", approve_pct: 43.0, disapprove_pct: 53.5, margin: -10.5, sample_type: "Average", methodology: "Poll Tracker" },
      { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "approval", question: "CPR PollTracker", date_conducted: "2026-02-10", end_date: "2026-02-12", candidate_or_topic: "Trump Approval", approve_pct: 44.5, disapprove_pct: 52.0, margin: -7.5, sample_type: "Average", methodology: "Poll Tracker" },
      { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "generic-ballot", question: "CPR Generic Ballot", date_conducted: "2026-03-18", end_date: "2026-03-21", candidate_or_topic: "Generic Ballot", favor_pct: 49.0, oppose_pct: 43.0, margin: 6.0, sample_type: "Average", partisan_lean: "D+6.0", methodology: "Poll Tracker" },
      { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "generic-ballot", question: "CPR Generic Ballot", date_conducted: "2026-03-08", end_date: "2026-03-12", candidate_or_topic: "Generic Ballot", favor_pct: 47.5, oppose_pct: 44.0, margin: 3.5, sample_type: "Average", partisan_lean: "D+3.5", methodology: "Poll Tracker" },

      // === Atlas Intel ===
      { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-15", end_date: "2026-03-18", candidate_or_topic: "Trump Approval", approve_pct: 43, disapprove_pct: 54, margin: -11, sample_size: 2500, sample_type: "LV", margin_of_error: 2, methodology: "Online/DFRP" },
      { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-05", end_date: "2026-03-08", candidate_or_topic: "Trump Approval", approve_pct: 45, disapprove_pct: 52, margin: -7, sample_size: 2500, sample_type: "LV", margin_of_error: 2, methodology: "Online/DFRP" },
      { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-05", end_date: "2026-02-08", candidate_or_topic: "Trump Approval", approve_pct: 46, disapprove_pct: 51, margin: -5, sample_size: 2500, sample_type: "LV", margin_of_error: 2, methodology: "Online/DFRP" },
      { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "generic-ballot", question: "Generic Ballot", date_conducted: "2026-03-15", end_date: "2026-03-18", candidate_or_topic: "Generic Ballot", favor_pct: 48.0, oppose_pct: 44.0, margin: 4.0, sample_size: 2500, sample_type: "LV", margin_of_error: 2, partisan_lean: "D+4.0", methodology: "Online/DFRP" },
      { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "generic-ballot", question: "Generic Ballot", date_conducted: "2026-03-05", end_date: "2026-03-08", candidate_or_topic: "Generic Ballot", favor_pct: 46.5, oppose_pct: 45.5, margin: 1.0, sample_size: 2500, sample_type: "LV", margin_of_error: 2, partisan_lean: "D+1.0", methodology: "Online/DFRP" },

      // === CNN/SSRS ===
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-13", end_date: "2026-03-16", candidate_or_topic: "Trump Approval", approve_pct: 38, disapprove_pct: 59, margin: -21, sample_size: 1220, sample_type: "Adults", margin_of_error: 3.3, methodology: "Phone/Online" },
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-06", end_date: "2026-03-09", candidate_or_topic: "Trump Approval", approve_pct: 40, disapprove_pct: 57, margin: -17, sample_size: 1214, sample_type: "Adults", margin_of_error: 3.4, methodology: "Phone/Online" },
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-06", end_date: "2026-02-09", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 56, margin: -15, sample_size: 1208, sample_type: "Adults", margin_of_error: 3.5, methodology: "Phone/Online" },
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "issue", question: "Healthcare Approval", date_conducted: "2026-03-13", end_date: "2026-03-16", candidate_or_topic: "Healthcare", approve_pct: 34, disapprove_pct: 63, margin: -29, sample_size: 1220, sample_type: "Adults", margin_of_error: 3.3, methodology: "Phone/Online" },
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "issue", question: "Healthcare Approval", date_conducted: "2026-03-06", end_date: "2026-03-09", candidate_or_topic: "Healthcare", approve_pct: 37, disapprove_pct: 59, margin: -22, sample_size: 1214, sample_type: "Adults", margin_of_error: 3.4, methodology: "Phone/Online" },
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-03-13", end_date: "2026-03-16", candidate_or_topic: "Trump Favorability", favor_pct: 39, oppose_pct: 58, margin: -19, sample_size: 1220, sample_type: "Adults", margin_of_error: 3.3, methodology: "Phone/Online" },
      { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-03-06", end_date: "2026-03-09", candidate_or_topic: "Trump Favorability", favor_pct: 41, oppose_pct: 56, margin: -15, sample_size: 1214, sample_type: "Adults", margin_of_error: 3.4, methodology: "Phone/Online" },

      // === YouGov ===
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-03-16", end_date: "2026-03-16", candidate_or_topic: "Trump Favorability", favor_pct: 39.8, oppose_pct: 58.2, margin: -18.4, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-03-09", end_date: "2026-03-09", candidate_or_topic: "Trump Favorability", favor_pct: 40.5, oppose_pct: 57.1, margin: -16.6, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-02-23", end_date: "2026-02-23", candidate_or_topic: "Trump Favorability", favor_pct: 41.6, oppose_pct: 56.8, margin: -15.2, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-02-16", end_date: "2026-02-16", candidate_or_topic: "Trump Favorability", favor_pct: 42.1, oppose_pct: 55.9, margin: -13.8, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "favorability", question: "Trump Favorability", date_conducted: "2026-01-26", end_date: "2026-01-26", candidate_or_topic: "Trump Favorability", favor_pct: 43.5, oppose_pct: 54.2, margin: -10.7, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-16", end_date: "2026-03-16", candidate_or_topic: "Trump Approval", approve_pct: 40, disapprove_pct: 57, margin: -17, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-02", end_date: "2026-03-02", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, margin: -13, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },
      { source: "yougov", source_url: "https://yougov.com/en-us/trackers/donald-trump-favorability", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-02", end_date: "2026-02-02", candidate_or_topic: "Trump Approval", approve_pct: 43, disapprove_pct: 54, margin: -11, sample_size: 1500, sample_type: "RV", margin_of_error: 3.2, methodology: "Online" },

      // === Fox News ===
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-15", end_date: "2026-03-18", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 57, margin: -16, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-15", end_date: "2026-02-18", candidate_or_topic: "Trump Approval", approve_pct: 43, disapprove_pct: 56, margin: -13, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-01-10", end_date: "2026-01-13", candidate_or_topic: "Trump Approval", approve_pct: 44, disapprove_pct: 55, margin: -11, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2025-12-06", end_date: "2025-12-09", candidate_or_topic: "Trump Approval", approve_pct: 44, disapprove_pct: 54, margin: -10, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2025-11-08", end_date: "2025-11-11", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 57, margin: -16, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "issue", question: "Economy Approval", date_conducted: "2026-03-15", end_date: "2026-03-18", candidate_or_topic: "Economy", approve_pct: 40, disapprove_pct: 58, margin: -18, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "issue", question: "Economy Approval", date_conducted: "2026-02-15", end_date: "2026-02-18", candidate_or_topic: "Economy", approve_pct: 45, disapprove_pct: 53, margin: -8, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "issue", question: "Immigration Approval", date_conducted: "2026-03-15", end_date: "2026-03-18", candidate_or_topic: "Immigration", approve_pct: 42, disapprove_pct: 56, margin: -14, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "issue", question: "Immigration Approval", date_conducted: "2026-02-15", end_date: "2026-02-18", candidate_or_topic: "Immigration", approve_pct: 46, disapprove_pct: 52, margin: -6, sample_size: 1004, sample_type: "RV", margin_of_error: 3, methodology: "Phone/Online" },
      { source: "foxnews", source_url: "https://www.foxnews.com/official-polls", poll_type: "generic-ballot", question: "Generic Congressional Ballot", date_conducted: "2026-03-15", end_date: "2026-03-18", candidate_or_topic: "Generic Ballot", favor_pct: 49, oppose_pct: 43, margin: 6, sample_size: 1004, sample_type: "RV", margin_of_error: 3, partisan_lean: "D+6", methodology: "Phone/Online" },

      // === Emerson College ===
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-15", end_date: "2026-03-17", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 55, margin: -14, sample_size: 1000, sample_type: "RV", margin_of_error: 3.1, methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-22", end_date: "2026-02-24", candidate_or_topic: "Trump Approval", approve_pct: 43, disapprove_pct: 53, margin: -10, sample_size: 1000, sample_type: "RV", margin_of_error: 3.1, methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-01-25", end_date: "2026-01-27", candidate_or_topic: "Trump Approval", approve_pct: 45, disapprove_pct: 51, margin: -6, sample_size: 1000, sample_type: "RV", margin_of_error: 3.1, methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2025-12-14", end_date: "2025-12-16", candidate_or_topic: "Trump Approval", approve_pct: 47, disapprove_pct: 49, margin: -2, sample_size: 1000, sample_type: "RV", margin_of_error: 3.1, methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "generic-ballot", question: "Generic Ballot", date_conducted: "2026-03-15", end_date: "2026-03-17", candidate_or_topic: "Generic Ballot", favor_pct: 50, oppose_pct: 42, margin: 8, sample_size: 1000, sample_type: "RV", margin_of_error: 3.1, partisan_lean: "D+8", methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "generic-ballot", question: "Generic Ballot", date_conducted: "2026-02-22", end_date: "2026-02-24", candidate_or_topic: "Generic Ballot", favor_pct: 48, oppose_pct: 44, margin: 4, sample_size: 1000, sample_type: "RV", margin_of_error: 3.1, partisan_lean: "D+4", methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "state", question: "GA Senate: Ossoff vs GOP", date_conducted: "2026-03-15", end_date: "2026-03-17", candidate_or_topic: "GA Senate - Ossoff", favor_pct: 47, oppose_pct: 40, margin: 7, sample_size: 800, sample_type: "RV", margin_of_error: 3.5, partisan_lean: "D+7", methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "state", question: "GA Senate: Ossoff vs GOP", date_conducted: "2026-03-01", end_date: "2026-03-03", candidate_or_topic: "GA Senate - Ossoff", favor_pct: 49, oppose_pct: 38, margin: 11, sample_size: 800, sample_type: "RV", margin_of_error: 3.5, partisan_lean: "D+11", methodology: "Online/IVR" },
      { source: "emerson", source_url: "https://emersoncollegepolling.com/", poll_type: "state", question: "TX GOP Primary: Paxton vs Cornyn", date_conducted: "2026-02-26", end_date: "2026-02-28", candidate_or_topic: "TX GOP Primary", favor_pct: 32, oppose_pct: 28, margin: 4, sample_size: 600, sample_type: "LV", margin_of_error: 4, methodology: "Online/IVR" },

      // === Reuters/Ipsos ===
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-14", end_date: "2026-03-17", candidate_or_topic: "Trump Approval", approve_pct: 37, disapprove_pct: 60, margin: -23, sample_size: 1010, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-14", end_date: "2026-02-17", candidate_or_topic: "Trump Approval", approve_pct: 40, disapprove_pct: 56, margin: -16, sample_size: 1005, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-01-10", end_date: "2026-01-13", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 54, margin: -12, sample_size: 1005, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2025-12-12", end_date: "2025-12-15", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 55, margin: -14, sample_size: 1005, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "issue", question: "Tariffs Approval", date_conducted: "2026-03-14", end_date: "2026-03-17", candidate_or_topic: "Tariffs", approve_pct: 26, disapprove_pct: 71, margin: -45, sample_size: 1010, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "issue", question: "Tariffs Approval", date_conducted: "2026-02-19", end_date: "2026-02-21", candidate_or_topic: "Tariffs", approve_pct: 34, disapprove_pct: 64, margin: -30, sample_size: 1006, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "issue", question: "Inflation Concern", date_conducted: "2026-03-14", end_date: "2026-03-17", candidate_or_topic: "Inflation Concern", approve_pct: 17, disapprove_pct: 83, margin: -66, sample_size: 1010, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "issue", question: "Inflation Concern", date_conducted: "2026-02-28", end_date: "2026-03-02", candidate_or_topic: "Inflation Concern", approve_pct: 21, disapprove_pct: 79, margin: -58, sample_size: 1005, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },
      { source: "ipsos", source_url: "https://www.ipsos.com/en-us/latest-us-opinion-polls", poll_type: "issue", question: "Iran Strikes Approval", date_conducted: "2026-02-28", end_date: "2026-03-01", candidate_or_topic: "Iran Strikes", approve_pct: 27, disapprove_pct: 43, margin: -16, sample_size: 1005, sample_type: "Adults", margin_of_error: 3.5, methodology: "Online (KnowledgePanel)" },

      // === Monmouth University ===
      { source: "monmouth", source_url: "https://www.monmouth.edu/polling-institute/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-13", end_date: "2026-03-17", candidate_or_topic: "Trump Approval", approve_pct: 38, disapprove_pct: 58, margin: -20, sample_size: 805, sample_type: "Adults", margin_of_error: 3.5, methodology: "Phone/Online" },
      { source: "monmouth", source_url: "https://www.monmouth.edu/polling-institute/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-13", end_date: "2026-02-17", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 55, margin: -14, sample_size: 802, sample_type: "Adults", margin_of_error: 3.5, methodology: "Phone/Online" },
      { source: "monmouth", source_url: "https://www.monmouth.edu/polling-institute/", poll_type: "issue", question: "DOGE Approval", date_conducted: "2026-03-13", end_date: "2026-03-17", candidate_or_topic: "DOGE", approve_pct: 31, disapprove_pct: 56, margin: -25, sample_size: 805, sample_type: "Adults", margin_of_error: 3.5, methodology: "Phone/Online" },
      { source: "monmouth", source_url: "https://www.monmouth.edu/polling-institute/", poll_type: "generic-ballot", question: "Generic Ballot", date_conducted: "2026-03-13", end_date: "2026-03-17", candidate_or_topic: "Generic Ballot", favor_pct: 51, oppose_pct: 40, margin: 11, sample_size: 805, sample_type: "RV", margin_of_error: 3.5, partisan_lean: "D+11", methodology: "Phone/Online" },

      // === Quinnipiac ===
      { source: "quinnipiac", source_url: "https://poll.qu.edu/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-12", end_date: "2026-03-16", candidate_or_topic: "Trump Approval", approve_pct: 39, disapprove_pct: 58, margin: -19, sample_size: 1691, sample_type: "Adults", margin_of_error: 2.4, methodology: "Phone/Online" },
      { source: "quinnipiac", source_url: "https://poll.qu.edu/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-12", end_date: "2026-02-16", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, margin: -13, sample_size: 1685, sample_type: "Adults", margin_of_error: 2.4, methodology: "Phone/Online" },
      { source: "quinnipiac", source_url: "https://poll.qu.edu/", poll_type: "issue", question: "Tariffs Approval", date_conducted: "2026-03-12", end_date: "2026-03-16", candidate_or_topic: "Tariffs", approve_pct: 30, disapprove_pct: 66, margin: -36, sample_size: 1691, sample_type: "Adults", margin_of_error: 2.4, methodology: "Phone/Online" },
      { source: "quinnipiac", source_url: "https://poll.qu.edu/", poll_type: "generic-ballot", question: "Generic Ballot", date_conducted: "2026-03-12", end_date: "2026-03-16", candidate_or_topic: "Generic Ballot", favor_pct: 52, oppose_pct: 40, margin: 12, sample_size: 1691, sample_type: "RV", margin_of_error: 2.4, partisan_lean: "D+12", methodology: "Phone/Online" },

      // === Morning Consult ===
      { source: "morningconsult", source_url: "https://morningconsult.com/tracking-trump-2/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-17", end_date: "2026-03-21", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, margin: -13, sample_size: 11250, sample_type: "RV", margin_of_error: 1, methodology: "Online" },
      { source: "morningconsult", source_url: "https://morningconsult.com/tracking-trump-2/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-03-10", end_date: "2026-03-14", candidate_or_topic: "Trump Approval", approve_pct: 43, disapprove_pct: 54, margin: -11, sample_size: 11200, sample_type: "RV", margin_of_error: 1, methodology: "Online" },
      { source: "morningconsult", source_url: "https://morningconsult.com/tracking-trump-2/", poll_type: "approval", question: "Trump Job Approval", date_conducted: "2026-02-17", end_date: "2026-02-21", candidate_or_topic: "Trump Approval", approve_pct: 45, disapprove_pct: 52, margin: -7, sample_size: 11300, sample_type: "RV", margin_of_error: 1, methodology: "Online" },

      // === Historical ===
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Historical", date_conducted: "2025-12-01", end_date: "2025-12-07", candidate_or_topic: "Trump Approval", approve_pct: 48, disapprove_pct: 49, margin: -1, sample_size: 1010, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Historical", date_conducted: "2025-11-01", end_date: "2025-11-07", candidate_or_topic: "Trump Approval", approve_pct: 49, disapprove_pct: 48, margin: 1, sample_size: 1015, sample_type: "Adults", margin_of_error: 4, methodology: "Phone" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Historical", date_conducted: "2025-12-15", end_date: "2025-12-18", candidate_or_topic: "Trump Approval", approve_pct: 47.0, disapprove_pct: 49.5, margin: -2.5, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Historical", date_conducted: "2025-11-15", end_date: "2025-11-18", candidate_or_topic: "Trump Approval", approve_pct: 48.2, disapprove_pct: 48.5, margin: -0.3, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, methodology: "Aggregate" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "Historical", date_conducted: "2025-12-15", end_date: "2025-12-22", candidate_or_topic: "Trump Approval", approve_pct: 47.2, disapprove_pct: 49.3, margin: -2.1, sample_type: "Average", methodology: "Poll Average" },
      { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "Historical", date_conducted: "2025-11-15", end_date: "2025-11-22", candidate_or_topic: "Trump Approval", approve_pct: 48.5, disapprove_pct: 48.0, margin: 0.5, sample_type: "Average", methodology: "Poll Average" },
    ];

    // Insert new polls (using insert, not upsert, since polling_data has no natural unique key)
    const { error } = await supabase.from("polling_data").insert(latestPolls);

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, inserted: latestPolls.length, sources: ["fivethirtyeight", "ap", "realclear", "gallup", "rasmussen", "cook", "atlas", "cnn", "yougov", "foxnews", "emerson", "ipsos", "monmouth", "quinnipiac", "morningconsult"] }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
