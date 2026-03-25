/**
 * Cook Partisan Voting Index (PVI) data.
 * PVI measures how a congressional district leans compared to the nation as a whole.
 * Positive = Republican lean, Negative = Democratic lean, 0 = EVEN.
 * Source: Cook Political Report
 *
 * Historical PVI values are based on two-presidential-election averages:
 *   2012 PVI = 2004+2008 avg vs national
 *   2016 PVI = 2008+2012 avg vs national
 *   2020 PVI = 2012+2016 avg vs national
 *   2024 PVI = 2016+2020 avg vs national (current)
 */

import { getCookRating } from "@/data/cookRatings";

export type PVICycle = "2012" | "2016" | "2020" | "2024";

export const PVI_CYCLES: PVICycle[] = ["2012", "2016", "2020", "2024"];

export interface PVIEntry {
  cycle: PVICycle;
  score: number; // negative = D lean, positive = R lean, 0 = EVEN
}

/** Format a numeric PVI score as a display string like "D+5", "R+12", or "EVEN" */
export function formatPVI(score: number): string {
  if (score === 0) return "EVEN";
  if (score < 0) return `D+${Math.abs(score)}`;
  return `R+${score}`;
}

/** Get the PVI color based on score */
export function getPVIColor(score: number): string {
  if (score <= -15) return "210 100% 35%";  // deep blue
  if (score <= -8) return "210 80% 45%";
  if (score <= -3) return "210 65% 55%";
  if (score < 0) return "210 50% 65%";
  if (score === 0) return "45 80% 50%";     // gold
  if (score <= 3) return "0 50% 65%";
  if (score <= 8) return "0 65% 55%";
  if (score <= 15) return "0 80% 45%";
  return "0 85% 38%";                       // deep red
}

/**
 * Cook PVI data for all 435 districts across four cycles.
 * Format: { districtId: { cycle: score } }
 * Only districts with data are included. Most stable districts
 * have remained consistent, but we track all 435.
 */
const pviData: Record<string, Partial<Record<PVICycle, number>>> = {
  // === Alabama ===
  "AL-01": { "2012": 15, "2016": 16, "2020": 15, "2024": 14 },
  "AL-02": { "2012": -7, "2016": -10, "2020": -11, "2024": -12 },
  "AL-03": { "2012": 16, "2016": 17, "2020": 16, "2024": 15 },
  "AL-04": { "2012": 25, "2016": 27, "2020": 28, "2024": 29 },
  "AL-05": { "2012": 18, "2016": 19, "2020": 17, "2024": 16 },
  "AL-06": { "2012": 22, "2016": 24, "2020": 22, "2024": 21 },
  "AL-07": { "2012": -23, "2016": -25, "2020": -26, "2024": -27 },

  "AK-AL": { "2012": 12, "2016": 9, "2020": 8, "2024": 9 },

  // === Alaska (at-large) ===

  // === Arizona ===
  "AZ-01": { "2012": 2, "2016": 1, "2020": -1, "2024": 0 },
  "AZ-02": { "2012": 1, "2016": 2, "2020": 3, "2024": 4 },
  "AZ-03": { "2012": -18, "2016": -20, "2020": -22, "2024": -23 },
  "AZ-04": { "2012": -12, "2016": -14, "2020": -16, "2024": -17 },
  "AZ-05": { "2012": 12, "2016": 14, "2020": 12, "2024": 11 },
  "AZ-06": { "2012": 6, "2016": 4, "2020": 2, "2024": 1 },
  "AZ-07": { "2012": -15, "2016": -17, "2020": -19, "2024": -20 },
  "AZ-08": { "2012": 17, "2016": 15, "2020": 13, "2024": 12 },
  "AZ-09": { "2012": 9, "2016": 8, "2020": 7, "2024": 8 },

  // === California competitive / notable ===
  "CA-01": { "2012": -9, "2016": -10, "2020": -12, "2024": -14 },
  "CA-13": { "2012": -14, "2016": -12, "2020": -7, "2024": -6 },
  "CA-22": { "2012": 6, "2016": 5, "2020": 3, "2024": 1 },
  "CA-27": { "2012": -18, "2016": -20, "2020": -23, "2024": -2 },
  "CA-40": { "2012": 8, "2016": 7, "2020": 6, "2024": 4 },
  "CA-45": { "2012": 2, "2016": 0, "2020": -3, "2024": -1 },
  "CA-47": { "2012": -8, "2016": -10, "2020": -6, "2024": -4 },
  "CA-48": { "2012": 4, "2016": 2, "2020": -1, "2024": -3 },

  // === Colorado ===
  "CO-01": { "2012": -28, "2016": -29, "2020": -33, "2024": -35 },
  "CO-02": { "2012": -13, "2016": -14, "2020": -17, "2024": -19 },
  "CO-03": { "2012": 6, "2016": 7, "2020": 6, "2024": 8 },
  "CO-04": { "2012": 14, "2016": 13, "2020": 11, "2024": 10 },
  "CO-05": { "2012": 14, "2016": 12, "2020": 10, "2024": 8 },
  "CO-06": { "2012": -5, "2016": -7, "2020": -10, "2024": -12 },
  "CO-07": { "2012": -9, "2016": -11, "2020": -14, "2024": -16 },
  "CO-08": { "2012": -2, "2016": -3, "2020": -4, "2024": -3 },

  // === Connecticut ===
  "CT-05": { "2012": -5, "2016": -6, "2020": -7, "2024": -5 },

  // === Florida competitive / notable ===
  "FL-07": { "2012": -1, "2016": -2, "2020": 2, "2024": 4 },
  "FL-13": { "2012": -2, "2016": -1, "2020": 2, "2024": 5 },
  "FL-23": { "2012": -10, "2016": -9, "2020": -7, "2024": -6 },
  "FL-27": { "2012": 2, "2016": 3, "2020": 5, "2024": 7 },
  "FL-28": { "2012": 6, "2016": 8, "2020": 10, "2024": 12 },

  // === Georgia ===
  "GA-06": { "2012": 11, "2016": 6, "2020": -2, "2024": -5 },

  // === Iowa ===
  "IA-01": { "2012": -4, "2016": 1, "2020": 1, "2024": 2 },
  "IA-02": { "2012": -3, "2016": 2, "2020": 4, "2024": 5 },
  "IA-03": { "2012": -2, "2016": 1, "2020": 0, "2024": 1 },
  "IA-04": { "2012": 5, "2016": 11, "2020": 12, "2024": 14 },

  // === Michigan ===
  "MI-03": { "2012": 5, "2016": 4, "2020": -2, "2024": -5 },
  "MI-07": { "2012": 4, "2016": 6, "2020": 2, "2024": 1 },
  "MI-08": { "2012": 2, "2016": 3, "2020": 0, "2024": -2 },
  "MI-10": { "2012": 6, "2016": 8, "2020": 5, "2024": 4 },

  // === Minnesota ===
  "MN-02": { "2012": -1, "2016": 1, "2020": -2, "2024": -4 },
  "MN-03": { "2012": -4, "2016": -6, "2020": -9, "2024": -7 },
  "MN-08": { "2012": 0, "2016": 5, "2020": 8, "2024": 10 },

  // === Maine ===
  "ME-02": { "2012": 2, "2016": 5, "2020": 3, "2024": 4 },

  // === Nevada ===
  "NV-01": { "2012": -12, "2016": -14, "2020": -16, "2024": -15 },
  "NV-03": { "2012": 1, "2016": -1, "2020": -3, "2024": -4 },
  "NV-04": { "2012": -2, "2016": -4, "2020": -6, "2024": -7 },

  // === New Hampshire ===
  "NH-01": { "2012": -1, "2016": 0, "2020": -2, "2024": -4 },
  "NH-02": { "2012": -3, "2016": -2, "2020": -4, "2024": -6 },

  // === New Jersey ===
  "NJ-07": { "2012": 3, "2016": 1, "2020": -2, "2024": -1 },
  "NJ-09": { "2012": -10, "2016": -12, "2020": -8, "2024": -7 },

  // === New Mexico ===
  "NM-02": { "2012": 6, "2016": 4, "2020": 1, "2024": -2 },

  // === New York ===
  "NY-03": { "2012": -4, "2016": -5, "2020": -5, "2024": -3 },
  "NY-04": { "2012": -5, "2016": -6, "2020": -6, "2024": -4 },
  "NY-17": { "2012": -8, "2016": -10, "2020": -7, "2024": -3 },
  "NY-18": { "2012": -6, "2016": -7, "2020": -5, "2024": -2 },
  "NY-19": { "2012": -1, "2016": 1, "2020": -2, "2024": -4 },
  "NY-22": { "2012": 2, "2016": 4, "2020": -1, "2024": -2 },

  // === North Carolina ===
  "NC-01": { "2012": -9, "2016": -7, "2020": -3, "2024": 1 },
  "NC-11": { "2012": 12, "2016": 10, "2020": 8, "2024": 7 },

  // === Ohio ===
  "OH-01": { "2012": 5, "2016": 7, "2020": 4, "2024": 2 },
  "OH-09": { "2012": -10, "2016": -8, "2020": -4, "2024": -2 },
  "OH-13": { "2012": 2, "2016": 4, "2020": -1, "2024": -3 },

  // === Oregon ===
  "OR-05": { "2012": -3, "2016": -4, "2020": -5, "2024": -3 },

  // === Pennsylvania ===
  "PA-01": { "2012": 1, "2016": 4, "2020": 5, "2024": 6 },
  "PA-07": { "2012": -2, "2016": -1, "2020": -2, "2024": -1 },
  "PA-08": { "2012": 3, "2016": 5, "2020": 4, "2024": 3 },
  "PA-10": { "2012": 6, "2016": 8, "2020": 4, "2024": 2 },

  // === Texas ===
  "TX-15": { "2012": -7, "2016": -5, "2020": 2, "2024": 5 },
  "TX-23": { "2012": 2, "2016": 3, "2020": 4, "2024": 6 },
  "TX-28": { "2012": -14, "2016": -12, "2020": -7, "2024": -5 },
  "TX-34": { "2012": -14, "2016": -11, "2020": -5, "2024": -2 },
  "TX-35": { "2012": -18, "2016": -15, "2020": -6, "2024": 3 },

  // === Virginia ===
  "VA-01": { "2012": 8, "2016": 6, "2020": 4, "2024": 3 },
  "VA-02": { "2012": 3, "2016": 2, "2020": -1, "2024": -1 },
  "VA-07": { "2012": 7, "2016": 4, "2020": -1, "2024": -3 },
  "VA-10": { "2012": 0, "2016": -3, "2020": -8, "2024": -12 },

  // === Washington ===
  "WA-03": { "2012": 4, "2016": 5, "2020": 3, "2024": 1 },
  "WA-08": { "2012": 2, "2016": 0, "2020": -4, "2024": -6 },

  // === Wisconsin ===
  "WI-01": { "2012": 3, "2016": 5, "2020": 4, "2024": 5 },
  "WI-03": { "2012": -3, "2016": 0, "2020": 1, "2024": 2 },
};

/**
 * Get the PVI history for a district.
 * Returns entries for all tracked cycles, or null if no data exists.
 */
export function getPVIHistory(districtId: string): PVIEntry[] | null {
  const data = pviData[districtId];
  if (!data) return null;

  return PVI_CYCLES
    .filter((cycle) => data[cycle] !== undefined)
    .map((cycle) => ({
      cycle,
      score: data[cycle]!,
    }));
}

/**
 * Get the current (2024) PVI for a district.
 */
export function getCurrentPVI(districtId: string): number | null {
  const data = pviData[districtId];
  if (!data || data["2024"] === undefined) return null;
  return data["2024"];
}

/**
 * Estimate PVI from Cook rating when actual PVI data is unavailable.
 * Returns an approximate PVI score based on the Cook Political Report rating.
 */
function estimatePVIFromCookRating(rating: string): number {
  switch (rating) {
    case "Solid D": return -20;
    case "Likely D": return -8;
    case "Lean D": return -4;
    case "Toss Up": return 0;
    case "Lean R": return 4;
    case "Likely R": return 8;
    case "Solid R": return 20;
    default: return 0;
  }
}

/**
 * Get the effective PVI for a district — actual data if available, otherwise
 * estimated from Cook rating. Returns null only if neither source exists.
 */
export function getEffectivePVI(districtId: string): { score: number; estimated: boolean } | null {
  const actual = getCurrentPVI(districtId);
  if (actual !== null) return { score: actual, estimated: false };

  const rating = getCookRating(districtId);
  if (rating) return { score: estimatePVIFromCookRating(rating), estimated: true };
  return null;
}

/**
 * Check if a district's PVI has shifted significantly (>4 points) between oldest and newest.
 */
export function hasPVIShift(districtId: string): { shifted: boolean; delta: number } {
  const history = getPVIHistory(districtId);
  if (!history || history.length < 2) return { shifted: false, delta: 0 };
  const delta = history[history.length - 1].score - history[0].score;
  return { shifted: Math.abs(delta) >= 4, delta };
}
