import { supabase } from "@/integrations/supabase/client";

export interface DistrictProfile {
  id: string;
  district_id: string;
  state: string;
  population: number | null;
  median_age: number | null;
  median_income: number | null;
  education_bachelor_pct: number | null;
  top_issues: string[];
  voting_patterns: Record<string, unknown>;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function fetchAllDistricts(): Promise<DistrictProfile[]> {
  const { data, error } = await supabase
    .from("district_profiles")
    .select("*")
    .order("district_id");

  if (error) {
    console.error("Error fetching districts:", error);
    return [];
  }
  return (data || []) as unknown as DistrictProfile[];
}

export async function fetchDistrictById(
  districtId: string
): Promise<DistrictProfile | null> {
  const { data, error } = await supabase
    .from("district_profiles")
    .select("*")
    .eq("district_id", districtId.toUpperCase())
    .single();

  if (error) {
    console.error("Error fetching district:", error);
    return null;
  }
  return data as unknown as DistrictProfile;
}

export function searchDistricts(
  districts: DistrictProfile[],
  query: string
): DistrictProfile[] {
  if (!query.trim()) return districts;
  const q = query.toLowerCase();
  return districts.filter(
    (d) =>
      d.district_id.toLowerCase().includes(q) ||
      d.state.toLowerCase().includes(q) ||
      d.top_issues.some((i) => i.toLowerCase().includes(q))
  );
}
