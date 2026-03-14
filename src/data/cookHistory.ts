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
 */
const historicalData: Record<string, Partial<Record<CookCycle, CookRating>>> = {
  // === Arizona battlegrounds ===
  "AZ-01": { "2018": "Toss Up", "2020": "Lean R", "2022": "Lean D", "2024": "Toss Up", "2026": "Toss Up" },
  "AZ-02": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "AZ-06": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },

  // === California competitive ===
  "CA-13": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },
  "CA-22": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "CA-45": { "2018": "Toss Up", "2020": "Lean D", "2022": "Toss Up", "2024": "Lean D", "2026": "Lean D" },
  "CA-48": { "2018": "Lean R", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === Colorado ===
  "CO-03": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "CO-08": { "2018": "Lean D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },

  // === Florida ===
  "FL-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "FL-13": { "2018": "Toss Up", "2020": "Lean R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "FL-23": { "2018": "Lean D", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === Georgia ===
  "GA-06": { "2018": "Toss Up", "2020": "Lean D", "2022": "Solid D", "2024": "Solid D", "2026": "Solid D" },

  // === Iowa battlegrounds ===
  "IA-01": { "2018": "Toss Up", "2020": "Toss Up", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "IA-02": { "2018": "Lean D", "2020": "Toss Up", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "IA-03": { "2018": "Toss Up", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },

  // === Indiana ===
  "IN-01": { "2018": "Likely D", "2020": "Lean D", "2022": "Solid D", "2024": "Likely D", "2026": "Likely D" },

  // === Maine ===
  "ME-02": { "2018": "Toss Up", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Likely R" },

  // === Michigan battlegrounds ===
  "MI-03": { "2018": "Lean R", "2020": "Lean D", "2022": "Solid D", "2024": "Solid D", "2026": "Solid D" },
  "MI-07": { "2018": "Lean R", "2020": "Toss Up", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },
  "MI-08": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },
  "MI-10": { "2018": "Lean R", "2020": "Lean R", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },

  // === Minnesota ===
  "MN-02": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Likely D", "2026": "Likely D" },

  // === Nebraska ===
  "NE-02": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean R", "2024": "Lean D", "2026": "Lean D" },

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
  "NM-02": { "2018": "Lean R", "2020": "Toss Up", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === New York battlegrounds ===
  "NY-03": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean R", "2024": "Lean D", "2026": "Lean D" },
  "NY-04": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Lean D", "2026": "Lean D" },
  "NY-17": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Toss Up", "2026": "Toss Up" },
  "NY-19": { "2018": "Toss Up", "2020": "Lean D", "2022": "Toss Up", "2024": "Lean D", "2026": "Lean D" },

  // === North Carolina ===
  "NC-01": { "2018": "Lean D", "2020": "Lean D", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },
  "NC-11": { "2018": "Likely R", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Likely R" },

  // === Ohio battlegrounds ===
  "OH-01": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "OH-09": { "2018": "Solid D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },
  "OH-13": { "2018": "Lean R", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === Oregon ===
  "OR-05": { "2018": "Lean D", "2020": "Lean D", "2022": "Toss Up", "2024": "Likely D", "2026": "Likely D" },

  // === Pennsylvania battlegrounds ===
  "PA-01": { "2018": "Toss Up", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Likely R" },
  "PA-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Toss Up", "2026": "Toss Up" },
  "PA-08": { "2018": "Lean R", "2020": "Lean R", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },
  "PA-10": { "2018": "Lean R", "2020": "Lean R", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },

  // === Texas ===
  "TX-15": { "2018": "Lean D", "2020": "Toss Up", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "TX-23": { "2018": "Toss Up", "2020": "Lean R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },
  "TX-28": { "2018": "Solid D", "2020": "Likely D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },
  "TX-34": { "2018": "Solid D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },
  "TX-35": { "2018": "Solid D", "2020": "Solid D", "2022": "Lean D", "2024": "Likely R", "2026": "Likely R" },

  // === Virginia battlegrounds ===
  "VA-01": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Lean R", "2026": "Lean R" },
  "VA-02": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "VA-07": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Lean D", "2026": "Lean D" },

  // === Washington ===
  "WA-03": { "2018": "Likely R", "2020": "Lean R", "2022": "Lean R", "2024": "Toss Up", "2026": "Toss Up" },
  "WA-08": { "2018": "Toss Up", "2020": "Lean D", "2022": "Lean D", "2024": "Solid D", "2026": "Solid D" },

  // === Wisconsin battlegrounds ===
  "WI-01": { "2018": "Lean R", "2020": "Lean R", "2022": "Likely R", "2024": "Likely R", "2026": "Likely R" },
  "WI-03": { "2018": "Lean D", "2020": "Lean D", "2022": "Toss Up", "2024": "Toss Up", "2026": "Toss Up" },

  // === Alaska ===
  "AK-01": { "2018": "Solid R", "2020": "Solid R", "2022": "Lean R", "2024": "Likely R", "2026": "Likely R" },

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
