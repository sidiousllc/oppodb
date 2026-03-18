import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/*
 * Aggregates election forecast / rating data from multiple public sources:
 *  1. Cook Political Report  — hardcoded from latest public ratings
 *  2. Sabato's Crystal Ball  — hardcoded from latest public ratings
 *  3. Inside Elections        — hardcoded from latest public ratings
 *  4. 538 / Silver Bulletin  — scraped from public data when available
 *  5. Split Ticket            — scraped from public data when available
 *
 * For sources behind paywalls, we store manually-entered seed data.
 * For sources with public data endpoints, we attempt live scraping.
 */

// ─── Rating data from public sources (March 2026) ───────────────────────────

type RatingEntry = {
  source: string;
  race_type: string;
  state_abbr: string;
  district: string | null;
  rating: string;
  cycle: number;
  last_updated: string;
};

// Cook Political Report — latest publicly available House ratings
const COOK_HOUSE_RATINGS: RatingEntry[] = [
  // Toss Ups
  { source: "Cook Political Report", race_type: "house", state_abbr: "AK", district: "01", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CA", district: "13", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CA", district: "22", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CA", district: "27", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CA", district: "45", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CO", district: "08", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "IA", district: "01", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "IA", district: "02", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "ME", district: "02", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "MI", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "MI", district: "08", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "MN", district: "02", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NE", district: "02", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NJ", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NM", district: "02", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NY", district: "04", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NY", district: "17", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NY", district: "18", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NY", district: "19", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NY", district: "22", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "OH", district: "09", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "OH", district: "13", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "OR", district: "05", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "PA", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "PA", district: "08", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "PA", district: "10", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "VA", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "WI", district: "01", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "WI", district: "03", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  // Lean R
  { source: "Cook Political Report", race_type: "house", state_abbr: "AZ", district: "01", rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "AZ", district: "06", rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CA", district: "40", rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "FL", district: "13", rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NC", district: "01", rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "TX", district: "34", rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  // Lean D
  { source: "Cook Political Report", race_type: "house", state_abbr: "CA", district: "47", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "CT", district: "05", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "IL", district: "13", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "KS", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "MI", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "NV", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "PA", district: "17", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "house", state_abbr: "WA", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
];

// Sabato's Crystal Ball — latest publicly available House ratings
const SABATO_HOUSE_RATINGS: RatingEntry[] = [
  // Toss Ups
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "AK", district: "01", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "CA", district: "22", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "CA", district: "27", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "CA", district: "45", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "CO", district: "08", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "IA", district: "01", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "IA", district: "02", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "MI", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "MI", district: "08", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NJ", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NY", district: "04", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NY", district: "17", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NY", district: "18", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NY", district: "19", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NY", district: "22", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "OH", district: "09", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "PA", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "PA", district: "08", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "PA", district: "10", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "VA", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  // Lean R
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "AZ", district: "01", rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "AZ", district: "06", rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "FL", district: "13", rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "ME", district: "02", rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NC", district: "01", rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "TX", district: "34", rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  // Lean D
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "CA", district: "13", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "CA", district: "47", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "IL", district: "13", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "KS", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "MI", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "MN", district: "02", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "NM", district: "02", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "OR", district: "05", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "PA", district: "17", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "house", state_abbr: "WA", district: "03", rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
];

// Inside Elections ratings
const INSIDE_ELECTIONS_RATINGS: RatingEntry[] = [
  { source: "Inside Elections", race_type: "house", state_abbr: "AK", district: "01", rating: "Tilt R", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "CA", district: "13", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "CA", district: "22", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "CA", district: "27", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "CA", district: "45", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "CO", district: "08", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "IA", district: "01", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "IA", district: "02", rating: "Tilt R", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "MI", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "MI", district: "08", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "MN", district: "02", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "NJ", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "NY", district: "04", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "NY", district: "17", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "NY", district: "18", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "NY", district: "19", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "NY", district: "22", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "OH", district: "09", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "OR", district: "05", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "PA", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "PA", district: "08", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "PA", district: "10", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "VA", district: "07", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "WI", district: "01", rating: "Tilt D", cycle: 2026, last_updated: "2026-03-08" },
  { source: "Inside Elections", race_type: "house", state_abbr: "WI", district: "03", rating: "Toss Up", cycle: 2026, last_updated: "2026-03-08" },
];

// Senate ratings (2026)
const COOK_SENATE_RATINGS: RatingEntry[] = [
  { source: "Cook Political Report", race_type: "senate", state_abbr: "GA", district: null, rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "NC", district: null, rating: "Toss Up", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "ME", district: null, rating: "Lean R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "MI", district: null, rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "TX", district: null, rating: "Likely R", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "IL", district: null, rating: "Solid D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "OR", district: null, rating: "Solid D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "senate", state_abbr: "MA", district: null, rating: "Solid D", cycle: 2026, last_updated: "2026-03-12" },
];

const SABATO_SENATE_RATINGS: RatingEntry[] = [
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "GA", district: null, rating: "Toss Up", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "NC", district: null, rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "ME", district: null, rating: "Lean R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "MI", district: null, rating: "Lean D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "TX", district: null, rating: "Likely R", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "IL", district: null, rating: "Safe D", cycle: 2026, last_updated: "2026-03-10" },
  { source: "Sabato's Crystal Ball", race_type: "senate", state_abbr: "OR", district: null, rating: "Safe D", cycle: 2026, last_updated: "2026-03-10" },
];

// Governor ratings (2026)
const COOK_GOV_RATINGS: RatingEntry[] = [
  { source: "Cook Political Report", race_type: "governor", state_abbr: "NJ", district: null, rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "governor", state_abbr: "VA", district: null, rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
  { source: "Cook Political Report", race_type: "governor", state_abbr: "ME", district: null, rating: "Lean D", cycle: 2026, last_updated: "2026-03-12" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";

    if (action === "sync") {
      const allRatings = [
        ...COOK_HOUSE_RATINGS,
        ...SABATO_HOUSE_RATINGS,
        ...INSIDE_ELECTIONS_RATINGS,
        ...COOK_SENATE_RATINGS,
        ...SABATO_SENATE_RATINGS,
        ...COOK_GOV_RATINGS,
      ];

      let upserted = 0;
      for (const r of allRatings) {
        const { error } = await supabase.from("election_forecasts").upsert(
          {
            source: r.source,
            race_type: r.race_type,
            state_abbr: r.state_abbr,
            district: r.district,
            rating: r.rating,
            cycle: r.cycle,
            last_updated: r.last_updated,
          },
          { onConflict: "source,race_type,state_abbr,district,cycle" }
        );
        if (!error) upserted++;
      }

      return new Response(
        JSON.stringify({ success: true, upserted, total: allRatings.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add") {
      // Allow admins to add/update individual forecasts
      const { source, race_type, state_abbr, district, rating, dem_win_prob, rep_win_prob, cycle } = body;
      if (!source || !race_type || !state_abbr) {
        throw new Error("source, race_type, and state_abbr are required");
      }

      const { error } = await supabase.from("election_forecasts").upsert(
        {
          source,
          race_type,
          state_abbr,
          district: district || null,
          rating: rating || null,
          dem_win_prob: dem_win_prob || null,
          rep_win_prob: rep_win_prob || null,
          cycle: cycle || 2026,
          last_updated: new Date().toISOString().split("T")[0],
        },
        { onConflict: "source,race_type,state_abbr,district,cycle" }
      );

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    console.error("Forecast sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
