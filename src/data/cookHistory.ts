import { type CookRating, COOK_RATING_COLORS } from "@/data/cookRatings";

/**
 * Historical Cook Political Report ratings by election cycle.
 * Covers competitive and swing districts across 2018, 2020, 2022, 2024, and 2026.
 * Districts not listed were rated Solid D or Solid R consistently.
 */
export type CookCycle = "2018" | "2020" | "2022" | "2024" | "2026";

export const COOK_CYCLES: CookCycle[] = ["2018", "2020", "2022", "2024", "2026"];

export interface CookHistoryEntry {
  cycle: CookCycle;
  rating: CookRating;
}

/**
 * Historical ratings for districts that have shifted or been competitive.
 * Only districts with meaningful movement are tracked — the rest are inferred as stable.
 * Updated March 2026 to match forecast-sync seed data.
 */
const historicalData: Record<string, Partial<Record<CookCycle, CookRating>>> = {
  // === Alaska ===
  "AK-AL": { "2018": "Solid R", "2020": "Solid R", "2022": "Lean R", "2024": "Likely R", "2026": "Toss Up" },

  // === Arizona battlegrounds ===
  "AZ-01": { "2018": "Toss Up", "2020": "Lean R", "2022": "Lean D", "2024": "Toss Up", "2026": "Lean R" },
  "AZ-02": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "AZ-06": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean R", "2024": "Toss Up", "2026": "Lean R" },

  // === California competitive ===
  "CA-13": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Lean D", "2026": "Toss Up" },
  "CA-22": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "CA-27": { "2018": "Solid D", "2020": "Solid D", "2022": "Solid D", "2024": "Solid D", "2026": "Toss Up" },
  "CA-40": { "2018": "Solid R", "2020": "Solid R", "2022": "Solid R", "2024": "Solid R", "2026": "Lean R" },
  "CA-45": { "2018": "Toss Up", "2020": "Lean D", "2022": "Toss Up", "2024": "Lean D", "2026": "Toss Up" },
  "CA-47": { "2018": "Solid D", "2020": "Solid D", "2022": "Solid D", "2024": "Solid D", "2026": "Lean D" },
  "CA-48": { "2018": "Lean R", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === Colorado ===
  "CO-03": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "CO-08": { "2018": "Lean D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },

  // === Connecticut ===
  "CT-05": { "2018": "Solid D", "2020": "Solid D", "2022": "Solid D", "2024": "Solid D", "2026": "Lean D" },

  // === Florida ===
  "FL-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "FL-13": { "2018": "Toss Up", "2020": "Lean R", "2022": "Lean R", "2024": "Likely R", "2026": "Lean R" },
  "FL-23": { "2018": "Lean D", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === Georgia ===
  "GA-06": { "2018": "Toss Up", "2020": "Lean D", "2022": "Solid D", "2024": "Solid D", "2026": "Solid D" },

  // === Illinois ===
  "IL-13": { "2018": "Solid D", "2020": "Solid D", "2022": "Solid D", "2024": "Solid D", "2026": "Lean D" },

  // === Iowa battlegrounds ===
  "IA-01": { "2018": "Toss Up", "2020": "Toss Up", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "IA-02": { "2018": "Lean D", "2020": "Toss Up", "2022": "Lean R", "2024": "Likely R", "2026": "Toss Up" },
  "IA-03": { "2018": "Toss Up", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Lean R" },

  // === Indiana ===
  "IN-01": { "2018": "Likely D", "2020": "Lean D", "2022": "Solid D", "2024": "Likely D", "2026": "Likely D" },

  // === Kansas ===
  "KS-03": { "2018": "Solid D", "2020": "Solid D", "2022": "Solid D", "2024": "Solid D", "2026": "Lean D" },

  // === Maine ===
  "ME-02": { "2018": "Toss Up", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Toss Up" },

  // === Michigan battlegrounds ===
  "MI-03": { "2018": "Lean R", "2020": "Lean D", "2022": "Solid D", "2024": "Solid D", "2026": "Lean D" },
  "MI-07": { "2018": "Lean R", "2020": "Toss Up", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },
  "MI-08": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Toss Up" },
  "MI-10": { "2018": "Lean R", "2020": "Lean R", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },

  // === Minnesota ===
  "MN-02": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Likely D", "2026": "Toss Up" },

  // === Nebraska ===
  "NE-02": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean R", "2024": "Lean D", "2026": "Toss Up" },

  // === Nevada ===
  "NV-01": { "2018": "Likely D", "2020": "Solid D", "2022": "Likely D", "2024": "Likely D", "2026": "Likely D" },
  "NV-03": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },
  "NV-04": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Likely D", "2026": "Likely D" },

  // === New Hampshire ===
  "NH-01": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Likely D", "2026": "Likely D" },

  // === New Jersey ===
  "NJ-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "NJ-09": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === New Mexico ===
  "NM-02": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean D", "2024": "Lean D", "2026": "Toss Up" },

  // === New York battlegrounds ===
  "NY-03": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean R", "2024": "Lean D", "2026": "Lean D" },
  "NY-04": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Lean D", "2026": "Toss Up" },
  "NY-17": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Toss Up", "2026": "Toss Up" },
  "NY-18": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Solid D", "2026": "Toss Up" },
  "NY-19": { "2018": "Toss Up", "2020": "Lean D", "2022": "Toss Up", "2024": "Lean D", "2026": "Toss Up" },
  "NY-22": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean R", "2024": "Solid D", "2026": "Toss Up" },

  // === North Carolina ===
  "NC-01": { "2018": "Lean D", "2020": "Lean D", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },
  "NC-11": { "2018": "Likely R", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Likely R" },

  // === Ohio battlegrounds ===
  "OH-01": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Toss Up", "2026": "Lean R" },
  "OH-09": { "2018": "Solid D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },
  "OH-13": { "2018": "Lean R", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Toss Up" },

  // === Oregon ===
  "OR-05": { "2018": "Lean D", "2020": "Lean D", "2022": "Toss Up", "2024": "Likely D", "2026": "Toss Up" },

  // === Pennsylvania battlegrounds ===
  "PA-01": { "2018": "Toss Up", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Likely R" },
  "PA-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Toss Up", "2026": "Toss Up" },
  "PA-08": { "2018": "Lean R", "2020": "Lean R", "2022": "Lean R", "2024": "Lean R", "2026": "Toss Up" },
  "PA-10": { "2018": "Lean R", "2020": "Lean R", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },
  "PA-17": { "2018": "Solid D", "2020": "Solid D", "2022": "Solid D", "2024": "Solid D", "2026": "Lean D" },

  // === Texas ===
  "TX-15": { "2018": "Lean D", "2020": "Toss Up", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "TX-23": { "2018": "Toss Up", "2020": "Lean R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "TX-28": { "2018": "Solid D", "2020": "Likely D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },
  "TX-34": { "2018": "Solid D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Lean R" },
  "TX-35": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Likely R", "2026": "Likely R" },

  // === Virginia battlegrounds ===
  "VA-01": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },
  "VA-02": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Toss Up", "2026": "Likely R" },
  "VA-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Toss Up" },

  // === Washington ===
  "WA-03": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Toss Up", "2026": "Lean D" },
  "WA-08": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Solid D", "2026": "Solid D" },

  // === Wisconsin battlegrounds ===
  "WI-01": { "2018": "Lean R", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Toss Up" },
  "WI-03": { "2018": "Lean D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },

  // === Montana ===
  "MT-01": { "2018": "Solid R", "2020": "Solid R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },

  // === Tennessee ===
  "TN-05": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
};

/**
 * Get historical Cook ratings for a district.
 * Returns entries for all tracked cycles, falling back to the current rating
 * for untracked cycles (stable districts).
 */
export function getCookHistory(districtId: string, currentRating: CookRating | null): CookHistoryEntry[] {
  const history = historicalData[districtId];

  if (history) {
    return COOK_CYCLES.map((cycle) => ({
      cycle,
      rating: history[cycle] || currentRating || "Solid R",
    }));
  }

  // No historical data — district has been stable
  if (!currentRating) return [];

  return COOK_CYCLES.map((cycle) => ({
    cycle,
    rating: currentRating,
  }));
}

/**
 * Check if a district has meaningful rating changes across cycles.
 */
export function hasRatingShift(districtId: string): boolean {
  return districtId in historicalData;
}

/**
 * Convert a Cook rating to a numeric score for charting.
 * Scale: -3 (Solid D) to +3 (Solid R), 0 = Toss Up
 */
export function ratingToScore(rating: CookRating): number {
  const map: Record<CookRating, number> = {
    "Solid D": -3,
    "Likely D": -2,
    "Lean D": -1,
    "Toss Up": 0,
    "Lean R": 1,
    "Likely R": 2,
    "Solid R": 3,
  };
  return map[rating];
}
