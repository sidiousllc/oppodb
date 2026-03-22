// Cook Political Report 2026 House Race Ratings
// Source: https://www.cookpolitical.com/ratings/house-race-ratings
// Last updated: March 12, 2026

export type CookRating =
  | "Solid D"
  | "Likely D"
  | "Lean D"
  | "Toss Up"
  | "Lean R"
  | "Likely R"
  | "Solid R";

export const COOK_RATING_COLORS: Record<CookRating, string> = {
  "Solid D":  "210 100% 35%",   // deep blue
  "Likely D": "210 80% 50%",    // medium blue
  "Lean D":   "210 60% 62%",    // light blue
  "Toss Up":  "45 90% 50%",     // gold/yellow
  "Lean R":   "0 60% 62%",      // light red
  "Likely R": "0 75% 50%",      // medium red
  "Solid R":  "0 85% 38%",      // deep red
};

export const COOK_RATING_ORDER: CookRating[] = [
  "Solid D",
  "Likely D",
  "Lean D",
  "Toss Up",
  "Lean R",
  "Likely R",
  "Solid R",
];

/**
 * Complete mapping of all 435 House districts to their Cook Political Report rating.
 * Based on March 12, 2026 ratings.
 */
export const cookRatings: Record<string, CookRating> = {
  // ===== Solid Democrat (189) =====
  "AL-02": "Solid D", "AL-07": "Solid D",
  "AZ-03": "Solid D", "AZ-04": "Solid D", "AZ-07": "Solid D",
  "CA-01": "Solid D", "CA-02": "Solid D", "CA-03": "Solid D", "CA-04": "Solid D",
  "CA-06": "Solid D", "CA-07": "Solid D", "CA-08": "Solid D", "CA-09": "Solid D",
  "CA-10": "Solid D", "CA-11": "Solid D", "CA-12": "Solid D", "CA-14": "Solid D",
  "CA-15": "Solid D", "CA-16": "Solid D", "CA-17": "Solid D", "CA-18": "Solid D",
  "CA-19": "Solid D", "CA-24": "Solid D", "CA-25": "Solid D", "CA-26": "Solid D",
  "CA-27": "Solid D", "CA-28": "Solid D", "CA-29": "Solid D", "CA-30": "Solid D",
  "CA-31": "Solid D", "CA-32": "Solid D", "CA-33": "Solid D", "CA-34": "Solid D",
  "CA-35": "Solid D", "CA-36": "Solid D", "CA-37": "Solid D", "CA-38": "Solid D",
  "CA-39": "Solid D", "CA-41": "Solid D", "CA-42": "Solid D", "CA-43": "Solid D",
  "CA-44": "Solid D", "CA-46": "Solid D", "CA-47": "Solid D", "CA-49": "Solid D",
  "CA-50": "Solid D", "CA-51": "Solid D", "CA-52": "Solid D",
  "CO-01": "Solid D", "CO-02": "Solid D", "CO-06": "Solid D", "CO-07": "Solid D",
  "CT-01": "Solid D", "CT-02": "Solid D", "CT-03": "Solid D", "CT-04": "Solid D", "CT-05": "Solid D",
  "DE-AL": "Solid D",
  "FL-09": "Solid D", "FL-10": "Solid D", "FL-14": "Solid D", "FL-20": "Solid D",
  "FL-22": "Solid D", "FL-24": "Solid D", "FL-25": "Solid D",
  "GA-02": "Solid D", "GA-04": "Solid D", "GA-05": "Solid D", "GA-06": "Solid D", "GA-13": "Solid D",
  "HI-01": "Solid D", "HI-02": "Solid D",
  "IL-01": "Solid D", "IL-02": "Solid D", "IL-03": "Solid D", "IL-04": "Solid D",
  "IL-05": "Solid D", "IL-06": "Solid D", "IL-07": "Solid D", "IL-08": "Solid D",
  "IL-09": "Solid D", "IL-10": "Solid D", "IL-11": "Solid D", "IL-13": "Solid D",
  "IL-14": "Solid D", "IL-17": "Solid D",
  "IN-07": "Solid D",
  "KS-03": "Solid D",
  "KY-03": "Solid D",
  "LA-02": "Solid D", "LA-06": "Solid D",
  "MA-01": "Solid D", "MA-02": "Solid D", "MA-03": "Solid D", "MA-04": "Solid D",
  "MA-05": "Solid D", "MA-06": "Solid D", "MA-07": "Solid D", "MA-08": "Solid D", "MA-09": "Solid D",
  "MD-02": "Solid D", "MD-03": "Solid D", "MD-04": "Solid D", "MD-05": "Solid D",
  "MD-06": "Solid D", "MD-07": "Solid D", "MD-08": "Solid D",
  "ME-01": "Solid D",
  "MI-03": "Solid D", "MI-06": "Solid D", "MI-11": "Solid D", "MI-12": "Solid D", "MI-13": "Solid D",
  "MN-03": "Solid D", "MN-04": "Solid D", "MN-05": "Solid D",
  "MO-01": "Solid D", "MO-05": "Solid D",
  "MS-02": "Solid D",
  "NC-02": "Solid D", "NC-04": "Solid D", "NC-12": "Solid D",
  "NJ-01": "Solid D", "NJ-03": "Solid D", "NJ-05": "Solid D", "NJ-06": "Solid D",
  "NJ-08": "Solid D", "NJ-10": "Solid D", "NJ-11": "Solid D", "NJ-12": "Solid D",
  "NM-01": "Solid D", "NM-03": "Solid D",
  "NY-05": "Solid D", "NY-06": "Solid D", "NY-07": "Solid D", "NY-08": "Solid D",
  "NY-09": "Solid D", "NY-10": "Solid D", "NY-12": "Solid D", "NY-13": "Solid D",
  "NY-14": "Solid D", "NY-15": "Solid D", "NY-16": "Solid D", "NY-18": "Solid D",
  "NY-20": "Solid D", "NY-22": "Solid D", "NY-25": "Solid D", "NY-26": "Solid D",
  "OH-03": "Solid D", "OH-11": "Solid D",
  "OR-01": "Solid D", "OR-03": "Solid D", "OR-04": "Solid D", "OR-06": "Solid D",
  "PA-02": "Solid D", "PA-03": "Solid D", "PA-04": "Solid D", "PA-05": "Solid D",
  "PA-06": "Solid D", "PA-12": "Solid D", "PA-17": "Solid D",
  "RI-01": "Solid D", "RI-02": "Solid D",
  "SC-06": "Solid D",
  "TN-09": "Solid D",
  "TX-07": "Solid D", "TX-16": "Solid D", "TX-18": "Solid D", "TX-20": "Solid D",
  "TX-29": "Solid D", "TX-30": "Solid D", "TX-33": "Solid D", "TX-37": "Solid D",
  "UT-01": "Solid D",
  "VA-03": "Solid D", "VA-04": "Solid D", "VA-08": "Solid D", "VA-10": "Solid D", "VA-11": "Solid D",
  "VT-AL": "Solid D",
  "WA-01": "Solid D", "WA-02": "Solid D", "WA-06": "Solid D", "WA-07": "Solid D",
  "WA-08": "Solid D", "WA-09": "Solid D", "WA-10": "Solid D",
  "WI-02": "Solid D", "WI-04": "Solid D",

  // ===== Likely Democrat (8) =====
  "CA-21": "Likely D",
  "IN-01": "Likely D",
  "MN-02": "Likely D",
  "NH-01": "Likely D", "NH-02": "Likely D",
  "NV-01": "Likely D", "NV-04": "Likely D",
  "OR-05": "Likely D",

  // ===== Lean Democrat (15) =====
  "CA-13": "Lean D", "CA-45": "Lean D", "CA-48": "Lean D",
  "FL-23": "Lean D",
  "MI-08": "Lean D",
  "NE-02": "Lean D",
  "NJ-09": "Lean D",
  "NM-02": "Lean D",
  "NV-03": "Lean D",
  "NY-03": "Lean D", "NY-04": "Lean D", "NY-19": "Lean D",
  "OH-13": "Lean D",
  "TX-28": "Lean D",
  "VA-07": "Lean D",

  // ===== Toss Up (17) =====
  "AZ-01": "Toss Up", "AZ-06": "Toss Up",
  "CA-22": "Toss Up",
  "CO-08": "Toss Up",
  "IA-01": "Toss Up", "IA-03": "Toss Up",
  "MI-07": "Toss Up",
  "NJ-07": "Toss Up",
  "NY-17": "Toss Up",
  "OH-01": "Toss Up", "OH-09": "Toss Up",
  "PA-07": "Toss Up", "PA-10": "Toss Up",
  "TX-34": "Toss Up",
  "VA-02": "Toss Up",
  "WA-03": "Toss Up",
  "WI-03": "Toss Up",

  // ===== Lean Republican (4) =====
  "MI-10": "Lean R",
  "NC-01": "Lean R",
  "PA-08": "Lean R",
  "VA-01": "Lean R",

  // ===== Likely Republican (17) =====
  "AK-AL": "Likely R",
  "AZ-02": "Likely R",
  "CO-03": "Likely R", "CO-05": "Likely R",
  "FL-07": "Likely R", "FL-13": "Likely R",
  "IA-02": "Likely R",
  "ME-02": "Likely R",
  "MI-04": "Likely R",
  "MT-01": "Likely R",
  "NC-11": "Likely R",
  "PA-01": "Likely R",
  "TN-05": "Likely R",
  "TX-15": "Likely R", "TX-23": "Likely R", "TX-35": "Likely R",
  "WI-01": "Likely R",

  // ===== Solid Republican (185) =====
  "AL-01": "Solid R", "AL-03": "Solid R", "AL-04": "Solid R", "AL-05": "Solid R", "AL-06": "Solid R",
  "AR-01": "Solid R", "AR-02": "Solid R", "AR-03": "Solid R", "AR-04": "Solid R",
  "AZ-05": "Solid R", "AZ-08": "Solid R", "AZ-09": "Solid R",
  "CA-05": "Solid R", "CA-20": "Solid R", "CA-23": "Solid R", "CA-40": "Solid R",
  "CO-04": "Solid R",
  "FL-01": "Solid R", "FL-02": "Solid R", "FL-03": "Solid R", "FL-04": "Solid R",
  "FL-05": "Solid R", "FL-06": "Solid R", "FL-08": "Solid R", "FL-11": "Solid R",
  "FL-12": "Solid R", "FL-15": "Solid R", "FL-16": "Solid R", "FL-17": "Solid R",
  "FL-18": "Solid R", "FL-19": "Solid R", "FL-21": "Solid R", "FL-26": "Solid R",
  "FL-27": "Solid R", "FL-28": "Solid R",
  "GA-01": "Solid R", "GA-03": "Solid R", "GA-07": "Solid R", "GA-08": "Solid R",
  "GA-09": "Solid R", "GA-10": "Solid R", "GA-11": "Solid R", "GA-12": "Solid R", "GA-14": "Solid R",
  "IA-04": "Solid R",
  "ID-01": "Solid R", "ID-02": "Solid R",
  "IL-12": "Solid R", "IL-15": "Solid R", "IL-16": "Solid R",
  "IN-02": "Solid R", "IN-03": "Solid R", "IN-04": "Solid R", "IN-05": "Solid R",
  "IN-06": "Solid R", "IN-08": "Solid R", "IN-09": "Solid R",
  "KS-01": "Solid R", "KS-02": "Solid R", "KS-04": "Solid R",
  "KY-01": "Solid R", "KY-02": "Solid R", "KY-04": "Solid R", "KY-05": "Solid R", "KY-06": "Solid R",
  "LA-01": "Solid R", "LA-03": "Solid R", "LA-04": "Solid R", "LA-05": "Solid R",
  "MD-01": "Solid R",
  "MI-01": "Solid R", "MI-02": "Solid R", "MI-05": "Solid R", "MI-09": "Solid R",
  "MN-01": "Solid R", "MN-06": "Solid R", "MN-07": "Solid R", "MN-08": "Solid R",
  "MO-02": "Solid R", "MO-03": "Solid R", "MO-04": "Solid R", "MO-06": "Solid R",
  "MO-07": "Solid R", "MO-08": "Solid R",
  "MS-01": "Solid R", "MS-03": "Solid R", "MS-04": "Solid R",
  "MT-02": "Solid R",
  "NC-03": "Solid R", "NC-05": "Solid R", "NC-06": "Solid R", "NC-07": "Solid R",
  "NC-08": "Solid R", "NC-09": "Solid R", "NC-10": "Solid R", "NC-13": "Solid R", "NC-14": "Solid R",
  "ND-AL": "Solid R",
  "NE-01": "Solid R", "NE-03": "Solid R",
  "NJ-02": "Solid R", "NJ-04": "Solid R",
  "NV-02": "Solid R",
  "NY-01": "Solid R", "NY-02": "Solid R", "NY-11": "Solid R", "NY-21": "Solid R",
  "NY-23": "Solid R", "NY-24": "Solid R",
  "OH-02": "Solid R", "OH-04": "Solid R", "OH-05": "Solid R", "OH-06": "Solid R",
  "OH-07": "Solid R", "OH-08": "Solid R", "OH-10": "Solid R", "OH-12": "Solid R",
  "OH-14": "Solid R", "OH-15": "Solid R",
  "OK-01": "Solid R", "OK-02": "Solid R", "OK-03": "Solid R", "OK-04": "Solid R", "OK-05": "Solid R",
  "OR-02": "Solid R",
  "PA-09": "Solid R", "PA-11": "Solid R", "PA-13": "Solid R", "PA-14": "Solid R",
  "PA-15": "Solid R", "PA-16": "Solid R",
  "SC-01": "Solid R", "SC-02": "Solid R", "SC-03": "Solid R", "SC-04": "Solid R",
  "SC-05": "Solid R", "SC-07": "Solid R",
  "SD-AL": "Solid R",
  "TN-01": "Solid R", "TN-02": "Solid R", "TN-03": "Solid R", "TN-04": "Solid R",
  "TN-06": "Solid R", "TN-07": "Solid R", "TN-08": "Solid R",
  "TX-01": "Solid R", "TX-02": "Solid R", "TX-03": "Solid R", "TX-04": "Solid R",
  "TX-05": "Solid R", "TX-06": "Solid R", "TX-08": "Solid R", "TX-09": "Solid R",
  "TX-10": "Solid R", "TX-11": "Solid R", "TX-12": "Solid R", "TX-13": "Solid R",
  "TX-14": "Solid R", "TX-17": "Solid R", "TX-19": "Solid R", "TX-21": "Solid R",
  "TX-22": "Solid R", "TX-24": "Solid R", "TX-25": "Solid R", "TX-26": "Solid R",
  "TX-27": "Solid R", "TX-31": "Solid R", "TX-32": "Solid R", "TX-36": "Solid R", "TX-38": "Solid R",
  "UT-02": "Solid R", "UT-03": "Solid R", "UT-04": "Solid R",
  "VA-05": "Solid R", "VA-06": "Solid R", "VA-09": "Solid R",
  "WA-04": "Solid R", "WA-05": "Solid R",
  "WI-05": "Solid R", "WI-06": "Solid R", "WI-07": "Solid R", "WI-08": "Solid R",
  "WV-01": "Solid R", "WV-02": "Solid R",
  "WY-AL": "Solid R",
};

/** Get the Cook rating for a district, or null if not found */
export function getCookRating(districtId: string): CookRating | null {
  return cookRatings[districtId] ?? null;
}

/** Get the HSL color string for a Cook rating */
export function getCookRatingColor(rating: CookRating): string {
  return COOK_RATING_COLORS[rating];
}

/** Get a CSS-ready background color for a Cook rating */
export function getCookRatingBg(rating: CookRating): string {
  return `hsl(${COOK_RATING_COLORS[rating]} / 0.15)`;
}

/** Get a CSS-ready text color for a Cook rating */
export function getCookRatingText(rating: CookRating): string {
  return `hsl(${COOK_RATING_COLORS[rating]})`;
}
