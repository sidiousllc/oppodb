// Maps candidate slugs to their congressional district IDs
// Senate/Governor candidates map to state-level (no specific district)
export const candidateDistrictMap: Record<string, { district_id: string | null; type: "house" | "senate" | "governor" | "state" }> = {
  // House members
  "andy-ogles": { district_id: "TN-05", type: "house" },
  "anna-paulina-luna": { district_id: "FL-13", type: "house" },
  "ashley-hinson": { district_id: "IA-02", type: "house" },
  "buddy-carter": { district_id: "GA-01", type: "house" },
  "carlos-de-la-cruz": { district_id: "TX-35", type: "state" },
  "chuck-edwards": { district_id: "NC-11", type: "house" },
  "derrick-van-orden": { district_id: "WI-03", type: "house" },
  "eli-crane": { district_id: "AZ-02", type: "house" },
  "gabe-evans": { district_id: "CO-08", type: "house" },
  "jeff-hurd": { district_id: "CO-03", type: "house" },
  "jeff-van-drew": { district_id: "NJ-02", type: "house" },
  "jen-kiggans": { district_id: "VA-02", type: "house" },
  "juan-ciscomani": { district_id: "AZ-06", type: "house" },
  "ken-calvert": { district_id: "CA-41", type: "house" },
  "mariannette-miller-meeks": { district_id: "IA-01", type: "house" },
  "maria-salazar": { district_id: "FL-27", type: "house" },
  "mike-collins": { district_id: "GA-10", type: "house" },
  "mike-lawler": { district_id: "NY-17", type: "house" },
  "nick-begich": { district_id: "AK-01", type: "house" },
  "nick-lalota": { district_id: "NY-01", type: "house" },
  "pat-harrigan": { district_id: "NC-14", type: "house" },
  "rich-mccormick": { district_id: "GA-06", type: "house" },
  "rob-bresnahan": { district_id: "PA-08", type: "house" },
  "ryan-mackenzie": { district_id: "PA-07", type: "house" },
  "ryan-zinke": { district_id: "MT-01", type: "house" },
  "scott-perry": { district_id: "PA-10", type: "house" },
  "tom-barrett": { district_id: "MI-07", type: "house" },
  "tom-kean": { district_id: "NJ-07", type: "house" },
  "young-kim": { district_id: "CA-40", type: "house" },
  "zach-nunn": { district_id: "IA-03", type: "house" },
  "abe-hamadeh": { district_id: "AZ-08", type: "house" },
  "addison-mcdowell": { district_id: "NC-07", type: "house" },
  "andy-harris": { district_id: "MD-01", type: "house" },
  "brad-knott": { district_id: "NC-13", type: "house" },
  "dan-meuser": { district_id: "PA-09", type: "house" },
  "daniel-webster": { district_id: "FL-11", type: "house" },
  "darrell-issa": { district_id: "CA-48", type: "house" },
  "french-hill": { district_id: "AR-02", type: "house" },
  "glenn-grothman": { district_id: "WI-06", type: "house" },
  "jay-obernolte": { district_id: "CA-23", type: "house" },
  "lauren-boebert": { district_id: "CO-04", type: "house" },
  "neal-dunn": { district_id: "FL-02", type: "house" },
  "richard-hudson": { district_id: "NC-09", type: "house" },
  "stephanie-bice": { district_id: "OK-05", type: "house" },
  "tim-moore": { district_id: "NC-03", type: "house" },
  "tom-mcclintock": { district_id: "CA-05", type: "house" },
  "tony-wied": { district_id: "WI-08", type: "house" },
  "victoria-spartz": { district_id: "IN-05", type: "house" },
  "virginia-foxx": { district_id: "NC-05", type: "house" },
  "aaron-bean": { district_id: "FL-04", type: "house" },
  // Senate
  "dan-sullivan": { district_id: null, type: "senate" },
  "john-cornyn": { district_id: null, type: "senate" },
  "joni-ernst": { district_id: null, type: "senate" },
  "susan-collins": { district_id: null, type: "senate" },
  "thom-tillis": { district_id: null, type: "senate" },
  "mike-rogers": { district_id: null, type: "senate" },
  // Governor
  "jack-ciattarelli": { district_id: null, type: "governor" },
  "jason-miyares": { district_id: null, type: "governor" },
  "winsome-earle-sears": { district_id: null, type: "governor" },
  "derek-dooley": { district_id: null, type: "governor" },
  "john-king": { district_id: null, type: "governor" },
  // State
  "john-lujan": { district_id: null, type: "state" },
};

/** Get all candidates that represent a given district */
export function getCandidatesForDistrict(districtId: string): string[] {
  return Object.entries(candidateDistrictMap)
    .filter(([, info]) => info.district_id === districtId)
    .map(([slug]) => slug);
}

/** Get all candidates for a given state (senate/governor/state-level + house in that state) */
export function getCandidatesForState(stateAbbrev: string): string[] {
  const stateDistrictPrefix = `${stateAbbrev}-`;
  return Object.entries(candidateDistrictMap)
    .filter(([, info]) => {
      if (info.district_id?.startsWith(stateDistrictPrefix)) return true;
      return false;
    })
    .map(([slug]) => slug);
}

/** Get the district_id for a candidate slug */
export function getDistrictForCandidate(slug: string): string | null {
  return candidateDistrictMap[slug]?.district_id ?? null;
}
