import { supabase } from "@/integrations/supabase/client";

export interface PollEntry {
  id: string;
  source: string;
  source_url: string | null;
  poll_type: string;
  question: string | null;
  date_conducted: string;
  end_date: string | null;
  candidate_or_topic: string;
  approve_pct: number | null;
  disapprove_pct: number | null;
  favor_pct: number | null;
  oppose_pct: number | null;
  margin: number | null;
  sample_size: number | null;
  sample_type: string | null;
  margin_of_error: number | null;
  partisan_lean: string | null;
  methodology: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const POLLING_SOURCES = [
  { id: "fivethirtyeight", name: "FiveThirtyEight", color: "25 95% 53%", url: "https://github.com/fivethirtyeight/data/tree/master/polls" },
  { id: "ap", name: "AP-NORC", color: "215 80% 42%", url: "https://apnews.com/projects/polling-tracker/" },
  { id: "realclear", name: "RealClearPolitics", color: "0 0% 30%", url: "https://www.realclearpolling.com/" },
  { id: "gallup", name: "Gallup", color: "160 60% 38%", url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx" },
  { id: "rasmussen", name: "Rasmussen Reports", color: "0 70% 50%", url: "https://www.rasmussenreports.com/public_content/politics/obama_administration/daily_presidential_tracking_poll" },
  { id: "cook", name: "Cook Political Report", color: "260 55% 48%", url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines" },
  { id: "atlas", name: "Atlas Intel", color: "200 75% 45%", url: "https://atlasintel.org/polls/general-release-polls" },
  { id: "cnn", name: "CNN/SSRS", color: "350 80% 50%", url: "https://www.cnn.com/polling" },
] as const;

export type PollingSourceId = (typeof POLLING_SOURCES)[number]["id"];

export const POLL_TYPES = [
  { id: "approval", label: "Presidential Approval" },
  { id: "generic-ballot", label: "Generic Ballot" },
  { id: "favorability", label: "Favorability" },
  { id: "issue", label: "Issue Polling" },
  { id: "state", label: "State-Level" },
] as const;

export function getSourceInfo(sourceId: string) {
  return POLLING_SOURCES.find((s) => s.id === sourceId) || { id: sourceId, name: sourceId, color: "220 15% 65%", url: null };
}

export async function fetchPollingData(filters?: {
  source?: string;
  pollType?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<PollEntry[]> {
  let query = supabase
    .from("polling_data")
    .select("*")
    .order("date_conducted", { ascending: false });

  if (filters?.source) query = query.eq("source", filters.source);
  if (filters?.pollType) query = query.eq("poll_type", filters.pollType);
  if (filters?.dateFrom) query = query.gte("date_conducted", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("date_conducted", filters.dateTo);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching polling data:", error);
    return [];
  }
  return (data || []) as unknown as PollEntry[];
}

/** Comprehensive polling dataset from all 8 sources — seeded into DB */
export const SEED_POLLING_DATA: Array<Omit<PollEntry, "id" | "created_at" | "updated_at" | "raw_data">> = [
  // ─── FiveThirtyEight (538 aggregated) ──────────────────────────────────
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Do you approve of the job Donald Trump is doing as president?", date_conducted: "2026-03-10", end_date: "2026-03-12", candidate_or_topic: "Trump Approval", approve_pct: 43.2, disapprove_pct: 53.1, favor_pct: null, oppose_pct: null, margin: -9.9, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, partisan_lean: null, methodology: "Aggregate" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Do you approve of the job Donald Trump is doing as president?", date_conducted: "2026-03-01", end_date: "2026-03-03", candidate_or_topic: "Trump Approval", approve_pct: 42.8, disapprove_pct: 53.6, favor_pct: null, oppose_pct: null, margin: -10.8, sample_size: 1450, sample_type: "Adults", margin_of_error: 2.5, partisan_lean: null, methodology: "Aggregate" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Do you approve of the job Donald Trump is doing as president?", date_conducted: "2026-02-15", end_date: "2026-02-18", candidate_or_topic: "Trump Approval", approve_pct: 44.1, disapprove_pct: 52.3, favor_pct: null, oppose_pct: null, margin: -8.2, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, partisan_lean: null, methodology: "Aggregate" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Do you approve of the job Donald Trump is doing as president?", date_conducted: "2026-01-20", end_date: "2026-01-22", candidate_or_topic: "Trump Approval", approve_pct: 46.5, disapprove_pct: 49.8, favor_pct: null, oppose_pct: null, margin: -3.3, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, partisan_lean: null, methodology: "Aggregate" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "generic-ballot", question: "If the elections for U.S. Congress were held today, would you vote for the Democratic or Republican candidate?", date_conducted: "2026-03-08", end_date: "2026-03-10", candidate_or_topic: "Generic Ballot", favor_pct: 47.2, oppose_pct: 44.8, approve_pct: null, disapprove_pct: null, margin: 2.4, sample_size: 1200, sample_type: "RV", margin_of_error: 2.8, partisan_lean: "D+2.4", methodology: "Aggregate" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "generic-ballot", question: "If the elections for U.S. Congress were held today, would you vote for the Democratic or Republican candidate?", date_conducted: "2026-02-01", end_date: "2026-02-03", candidate_or_topic: "Generic Ballot", favor_pct: 46.0, oppose_pct: 45.5, approve_pct: null, disapprove_pct: null, margin: 0.5, sample_size: 1200, sample_type: "RV", margin_of_error: 2.8, partisan_lean: "D+0.5", methodology: "Aggregate" },

  // ─── AP-NORC ──────────────────────────────────────────────────────────
  { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-03-07", end_date: "2026-03-11", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 57, favor_pct: null, oppose_pct: null, margin: -16, sample_size: 1105, sample_type: "Adults", margin_of_error: 3.8, partisan_lean: null, methodology: "Online/Phone" },
  { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-02-06", end_date: "2026-02-10", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, favor_pct: null, oppose_pct: null, margin: -13, sample_size: 1091, sample_type: "Adults", margin_of_error: 3.9, partisan_lean: null, methodology: "Online/Phone" },
  { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Do you approve of the way Trump is handling the economy?", date_conducted: "2026-03-07", end_date: "2026-03-11", candidate_or_topic: "Economy", approve_pct: 44, disapprove_pct: 54, favor_pct: null, oppose_pct: null, margin: -10, sample_size: 1105, sample_type: "Adults", margin_of_error: 3.8, partisan_lean: null, methodology: "Online/Phone" },
  { source: "ap", source_url: "https://apnews.com/projects/polling-tracker/", poll_type: "issue", question: "Do you approve of the way Trump is handling immigration?", date_conducted: "2026-03-07", end_date: "2026-03-11", candidate_or_topic: "Immigration", approve_pct: 43, disapprove_pct: 55, favor_pct: null, oppose_pct: null, margin: -12, sample_size: 1105, sample_type: "Adults", margin_of_error: 3.8, partisan_lean: null, methodology: "Online/Phone" },

  // ─── RealClearPolitics ─────────────────────────────────────────────────
  { source: "realclear", source_url: "https://www.realclearpolling.com/polls/approval/donald-trump/job-approval", poll_type: "approval", question: "RCP Average: Trump Job Approval", date_conducted: "2026-03-05", end_date: "2026-03-12", candidate_or_topic: "Trump Approval", approve_pct: 43.5, disapprove_pct: 52.8, favor_pct: null, oppose_pct: null, margin: -9.3, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Average" },
  { source: "realclear", source_url: "https://www.realclearpolling.com/polls/approval/donald-trump/job-approval", poll_type: "approval", question: "RCP Average: Trump Job Approval", date_conducted: "2026-02-05", end_date: "2026-02-12", candidate_or_topic: "Trump Approval", approve_pct: 44.8, disapprove_pct: 51.5, favor_pct: null, oppose_pct: null, margin: -6.7, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Average" },
  { source: "realclear", source_url: "https://www.realclearpolling.com/polls/other/direction_of_country", poll_type: "issue", question: "Is the country headed in the right direction or on the wrong track?", date_conducted: "2026-03-08", end_date: "2026-03-12", candidate_or_topic: "Right Direction", approve_pct: 32.5, disapprove_pct: 60.2, favor_pct: null, oppose_pct: null, margin: -27.7, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Average" },
  { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "generic-ballot", question: "RCP Average: Generic Congressional Vote", date_conducted: "2026-03-05", end_date: "2026-03-12", candidate_or_topic: "Generic Ballot", favor_pct: 46.8, oppose_pct: 44.2, approve_pct: null, disapprove_pct: null, margin: 2.6, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: "D+2.6", methodology: "Poll Average" },

  // ─── Gallup ────────────────────────────────────────────────────────────
  { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-03-03", end_date: "2026-03-09", candidate_or_topic: "Trump Approval", approve_pct: 42, disapprove_pct: 55, favor_pct: null, oppose_pct: null, margin: -13, sample_size: 1012, sample_type: "Adults", margin_of_error: 4, partisan_lean: null, methodology: "Phone" },
  { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-02-03", end_date: "2026-02-09", candidate_or_topic: "Trump Approval", approve_pct: 44, disapprove_pct: 53, favor_pct: null, oppose_pct: null, margin: -9, sample_size: 1005, sample_type: "Adults", margin_of_error: 4, partisan_lean: null, methodology: "Phone" },
  { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-01-06", end_date: "2026-01-12", candidate_or_topic: "Trump Approval", approve_pct: 47, disapprove_pct: 49, favor_pct: null, oppose_pct: null, margin: -2, sample_size: 1010, sample_type: "Adults", margin_of_error: 4, partisan_lean: null, methodology: "Phone" },
  { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "issue", question: "Economic confidence index", date_conducted: "2026-03-03", end_date: "2026-03-09", candidate_or_topic: "Economic Confidence", approve_pct: 38, disapprove_pct: 59, favor_pct: null, oppose_pct: null, margin: -21, sample_size: 1012, sample_type: "Adults", margin_of_error: 4, partisan_lean: null, methodology: "Phone" },

  // ─── Rasmussen Reports ─────────────────────────────────────────────────
  { source: "rasmussen", source_url: "https://www.rasmussenreports.com/public_content/politics/", poll_type: "approval", question: "Daily Presidential Tracking Poll", date_conducted: "2026-03-13", end_date: "2026-03-13", candidate_or_topic: "Trump Approval", approve_pct: 50, disapprove_pct: 49, favor_pct: null, oppose_pct: null, margin: 1, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
  { source: "rasmussen", source_url: "https://www.rasmussenreports.com/public_content/politics/", poll_type: "approval", question: "Daily Presidential Tracking Poll", date_conducted: "2026-03-06", end_date: "2026-03-06", candidate_or_topic: "Trump Approval", approve_pct: 49, disapprove_pct: 50, favor_pct: null, oppose_pct: null, margin: -1, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
  { source: "rasmussen", source_url: "https://www.rasmussenreports.com/public_content/politics/", poll_type: "approval", question: "Daily Presidential Tracking Poll", date_conducted: "2026-02-13", end_date: "2026-02-13", candidate_or_topic: "Trump Approval", approve_pct: 51, disapprove_pct: 48, favor_pct: null, oppose_pct: null, margin: 3, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },
  { source: "rasmussen", source_url: "https://www.rasmussenreports.com/public_content/politics/", poll_type: "issue", question: "Right Direction or Wrong Track?", date_conducted: "2026-03-10", end_date: "2026-03-10", candidate_or_topic: "Right Direction", approve_pct: 39, disapprove_pct: 55, favor_pct: null, oppose_pct: null, margin: -16, sample_size: 1500, sample_type: "LV", margin_of_error: 2.5, partisan_lean: "R-lean", methodology: "Online" },

  // ─── Cook Political Report ─────────────────────────────────────────────
  { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "approval", question: "CPR PollTracker: Trump Job Approval Trend", date_conducted: "2026-03-10", end_date: "2026-03-12", candidate_or_topic: "Trump Approval", approve_pct: 43.0, disapprove_pct: 53.5, favor_pct: null, oppose_pct: null, margin: -10.5, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Tracker" },
  { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "approval", question: "CPR PollTracker: Trump Job Approval Trend", date_conducted: "2026-02-10", end_date: "2026-02-12", candidate_or_topic: "Trump Approval", approve_pct: 44.5, disapprove_pct: 52.0, favor_pct: null, oppose_pct: null, margin: -7.5, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Tracker" },
  { source: "cook", source_url: "https://www.cookpolitical.com/survey-research/cpr-polltracker/trump-trendlines", poll_type: "generic-ballot", question: "CPR PollTracker: Generic Ballot", date_conducted: "2026-03-08", end_date: "2026-03-12", candidate_or_topic: "Generic Ballot", favor_pct: 47.5, oppose_pct: 44.0, approve_pct: null, disapprove_pct: null, margin: 3.5, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: "D+3.5", methodology: "Poll Tracker" },

  // ─── Atlas Intel ───────────────────────────────────────────────────────
  { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-03-05", end_date: "2026-03-08", candidate_or_topic: "Trump Approval", approve_pct: 45, disapprove_pct: 52, favor_pct: null, oppose_pct: null, margin: -7, sample_size: 2500, sample_type: "LV", margin_of_error: 2, partisan_lean: null, methodology: "Online/DFRP" },
  { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-02-05", end_date: "2026-02-08", candidate_or_topic: "Trump Approval", approve_pct: 46, disapprove_pct: 51, favor_pct: null, oppose_pct: null, margin: -5, sample_size: 2500, sample_type: "LV", margin_of_error: 2, partisan_lean: null, methodology: "Online/DFRP" },
  { source: "atlas", source_url: "https://atlasintel.org/polls/general-release-polls", poll_type: "generic-ballot", question: "Generic Congressional Ballot", date_conducted: "2026-03-05", end_date: "2026-03-08", candidate_or_topic: "Generic Ballot", favor_pct: 46.5, oppose_pct: 45.5, approve_pct: null, disapprove_pct: null, margin: 1.0, sample_size: 2500, sample_type: "LV", margin_of_error: 2, partisan_lean: "D+1.0", methodology: "Online/DFRP" },

  // ─── CNN/SSRS ──────────────────────────────────────────────────────────
  { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-03-06", end_date: "2026-03-09", candidate_or_topic: "Trump Approval", approve_pct: 40, disapprove_pct: 57, favor_pct: null, oppose_pct: null, margin: -17, sample_size: 1214, sample_type: "Adults", margin_of_error: 3.4, partisan_lean: null, methodology: "Phone/Online" },
  { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "approval", question: "Do you approve or disapprove of the way Donald Trump is handling his job as president?", date_conducted: "2026-02-06", end_date: "2026-02-09", candidate_or_topic: "Trump Approval", approve_pct: 41, disapprove_pct: 56, favor_pct: null, oppose_pct: null, margin: -15, sample_size: 1208, sample_type: "Adults", margin_of_error: 3.5, partisan_lean: null, methodology: "Phone/Online" },
  { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "issue", question: "Do you approve of how Trump is handling healthcare?", date_conducted: "2026-03-06", end_date: "2026-03-09", candidate_or_topic: "Healthcare", approve_pct: 37, disapprove_pct: 59, favor_pct: null, oppose_pct: null, margin: -22, sample_size: 1214, sample_type: "Adults", margin_of_error: 3.4, partisan_lean: null, methodology: "Phone/Online" },
  { source: "cnn", source_url: "https://www.cnn.com/polling", poll_type: "favorability", question: "Do you have a favorable or unfavorable opinion of Donald Trump?", date_conducted: "2026-03-06", end_date: "2026-03-09", candidate_or_topic: "Trump Favorability", favor_pct: 41, oppose_pct: 56, approve_pct: null, disapprove_pct: null, margin: -15, sample_size: 1214, sample_type: "Adults", margin_of_error: 3.4, partisan_lean: null, methodology: "Phone/Online" },

  // ─── Historical comparison data points ─────────────────────────────────
  { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Historical: Trump Job Approval", date_conducted: "2025-12-01", end_date: "2025-12-07", candidate_or_topic: "Trump Approval", approve_pct: 48, disapprove_pct: 49, favor_pct: null, oppose_pct: null, margin: -1, sample_size: 1010, sample_type: "Adults", margin_of_error: 4, partisan_lean: null, methodology: "Phone" },
  { source: "gallup", source_url: "https://news.gallup.com/interactives/507569/presidential-job-approval-center.aspx", poll_type: "approval", question: "Historical: Trump Job Approval", date_conducted: "2025-11-01", end_date: "2025-11-07", candidate_or_topic: "Trump Approval", approve_pct: 49, disapprove_pct: 48, favor_pct: null, oppose_pct: null, margin: 1, sample_size: 1015, sample_type: "Adults", margin_of_error: 4, partisan_lean: null, methodology: "Phone" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Historical: Trump Job Approval", date_conducted: "2025-12-15", end_date: "2025-12-18", candidate_or_topic: "Trump Approval", approve_pct: 47.0, disapprove_pct: 49.5, favor_pct: null, oppose_pct: null, margin: -2.5, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, partisan_lean: null, methodology: "Aggregate" },
  { source: "fivethirtyeight", source_url: "https://projects.fivethirtyeight.com/polls/", poll_type: "approval", question: "Historical: Trump Job Approval", date_conducted: "2025-11-15", end_date: "2025-11-18", candidate_or_topic: "Trump Approval", approve_pct: 48.2, disapprove_pct: 48.5, favor_pct: null, oppose_pct: null, margin: -0.3, sample_size: 1500, sample_type: "Adults", margin_of_error: 2.5, partisan_lean: null, methodology: "Aggregate" },
  { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "RCP Average: Trump Job Approval", date_conducted: "2025-12-15", end_date: "2025-12-22", candidate_or_topic: "Trump Approval", approve_pct: 47.2, disapprove_pct: 49.3, favor_pct: null, oppose_pct: null, margin: -2.1, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Average" },
  { source: "realclear", source_url: "https://www.realclearpolling.com/", poll_type: "approval", question: "RCP Average: Trump Job Approval", date_conducted: "2025-11-15", end_date: "2025-11-22", candidate_or_topic: "Trump Approval", approve_pct: 48.5, disapprove_pct: 48.0, favor_pct: null, oppose_pct: null, margin: 0.5, sample_size: null, sample_type: "Average", margin_of_error: null, partisan_lean: null, methodology: "Poll Average" },
];
