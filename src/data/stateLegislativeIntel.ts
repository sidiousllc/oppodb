import { supabase } from "@/integrations/supabase/client";

export interface StateLegislativeProfile {
  id: string;
  district_id: string;
  chamber: "house" | "senate";
  state: string;
  state_abbr: string;
  district_number: string;
  population: number | null;
  median_age: number | null;
  median_income: number | null;
  education_bachelor_pct: number | null;
  poverty_rate: number | null;
  unemployment_rate: number | null;
  white_pct: number | null;
  black_pct: number | null;
  hispanic_pct: number | null;
  asian_pct: number | null;
  owner_occupied_pct: number | null;
  median_home_value: number | null;
  median_rent: number | null;
  veteran_pct: number | null;
  foreign_born_pct: number | null;
  uninsured_pct: number | null;
  total_households: number | null;
  avg_household_size: number | null;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ChamberFilter = "all" | "house" | "senate";

export async function fetchStateLegislativeDistricts(
  stateAbbr?: string,
  chamber?: ChamberFilter,
): Promise<StateLegislativeProfile[]> {
  let query = supabase
    .from("state_legislative_profiles")
    .select("*")
    .order("district_id");

  if (stateAbbr) {
    query = query.eq("state_abbr", stateAbbr.toUpperCase());
  }

  if (chamber && chamber !== "all") {
    query = query.eq("chamber", chamber);
  }

  // Fetch in pages to avoid 1000-row limit
  const allData: StateLegislativeProfile[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching state legislative districts:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allData.push(...(data as unknown as StateLegislativeProfile[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

export async function fetchStateLegislativeById(
  districtId: string,
  chamber: string,
): Promise<StateLegislativeProfile | null> {
  const { data, error } = await supabase
    .from("state_legislative_profiles")
    .select("*")
    .eq("district_id", districtId.toUpperCase())
    .eq("chamber", chamber)
    .single();

  if (error) {
    console.error("Error fetching state legislative district:", error);
    return null;
  }
  return data as unknown as StateLegislativeProfile;
}

export function searchStateLegislative(
  districts: StateLegislativeProfile[],
  query: string,
): StateLegislativeProfile[] {
  if (!query.trim()) return districts;
  const q = query.toLowerCase();
  return districts.filter(
    (d) =>
      d.district_id.toLowerCase().includes(q) ||
      d.state.toLowerCase().includes(q) ||
      d.state_abbr.toLowerCase().includes(q) ||
      d.district_number.toLowerCase().includes(q),
  );
}

export async function syncStateLegislativeData(
  stateAbbr?: string,
  chamber?: string,
): Promise<{ success: boolean; upserted?: number; error?: string }> {
  const params: Record<string, string> = {};
  if (stateAbbr) params.state = stateAbbr;
  if (chamber) params.chamber = chamber;

  const queryString = new URLSearchParams(params).toString();
  const functionUrl = queryString
    ? `state-legislative-sync?${queryString}`
    : "state-legislative-sync";

  const { data, error } = await supabase.functions.invoke(functionUrl);
  if (error) {
    console.error("State legislative sync error:", error);
    return { success: false, error: error.message };
  }
  return data as { success: boolean; upserted?: number; error?: string };
}

// State name lookup
export const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

export const ALL_STATE_ABBRS = Object.keys(STATE_NAMES).sort();
