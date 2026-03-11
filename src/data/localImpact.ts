export interface LocalImpactReport {
  state: string;
  slug: string;
  summary: string;
  content: string;
}

export const localImpactReports: LocalImpactReport[] = [
  { state: "Alabama", slug: "alabama", summary: "Farmers lost $16M from USDA cuts; $20M disaster relief frozen for Camp Hill; 4 Social Security offices slated for closure", content: `**Agriculture:** Alabama farmers lost $16 million due to cuts to a USDA program for school districts and food banks.
**Disaster Relief:** The Trump administration froze $20 million in funding to help residents of Camp Hill, Alabama, after devastating hail in 2023.
**Economy:** Three IRS offices in Alabama marked for closure.
**Education:** The sole civil rights investigator handling disability discrimination was laid off; funding cut for after-school science programs at University of Alabama and Auburn.
**Social Security:** Four SSA offices in Alabama slated for closure.
**Housing:** Trump moved to eliminate key low-income housing programs that Alabama residents rely on.` },

  { state: "Alaska", slug: "alaska", summary: "NOAA employees fired including salmon fisheries worker; 30+ Forest Service workers fired; veteran fired losing cancer treatment insurance", content: `**Agriculture:** Multiple NOAA employees in Juneau fired, including a worker managing salmon fisheries critical to a multi-million dollar industry.
**Environment:** At least 30 workers in the U.S. Forest Service in Alaska were fired.
**Veterans:** An Anchorage army veteran fired from the federal government subsequently lost health insurance for his cancer-survivor wife.
**Public Safety:** Firings at Weather Service offices threaten forecasting accuracy for one of America's most weather-vulnerable states.` },

  { state: "Arizona", slug: "arizona", summary: "10 USDA Rural Development employees fired; 500 DES workers laid off; veteran firings across agencies", content: `**Agriculture:** 10 employees fired at USDA's Rural Development Office, which oversees loans for water infrastructure, hospitals, and food programs.
**Economy:** Arizona DES forced to lay off 500 workers due to federal funding shortfalls; IRS layoffs disrupted tax services.
**Energy:** Air-conditioner replacement program frozen over federal funding uncertainty.
**Veterans:** Staff fired from VA and other agencies, including a disabled Phoenix-area veteran at DHS and a Marine Corps veteran helping other veterans avoid foreclosure.` },

  { state: "California", slug: "california", summary: "USDA cancelled programs serving 500+ local farmers; 60 Dept of Education employees fired; Weather/Forest Service cuts amid deadly fire season", content: `**Agriculture:** USDA cancelled program that allowed California food banks to purchase produce from over 500 local farmers; 330 truckloads of food suspended.
**Education:** ~60 employees fired at Dept of Education's Office for Civil Rights in San Francisco; $148 million in teacher training grants terminated.
**Public Safety:** Weather Service and Forest Service employees fired despite deadly 2024 wildfire season.
**Housing:** Tens of millions in affordable housing funding threatened; cuts to permanent housing projects affecting thousands of homeless residents.
**Health:** Medi-Cal cuts could affect 48% of residents in some districts; $30 billion/year in federal Medi-Cal funding at risk.` },

  { state: "Colorado", slug: "colorado", summary: "$13M in local food program funding cancelled; $570M in health/climate funding withheld; veteran housing worker fired", content: `**Agriculture:** $13 million cancelled for Colorado schools and food banks to purchase produce from local farmers; largest food bank lost $2 million.
**Environment:** $570 million in federal funding for health and climate projects withheld even after federal courts ordered its release.
**Veterans:** Two Colorado veterans fired from VA, including one helping homeless veterans get housing.
**Housing:** Budget cuts in OBBB forced Colorado to cut $105 million from Prop 123 affordable housing program.` },

  { state: "Florida", slug: "florida", summary: "Food banks and schools losing partnerships with local farmers; 90% cut to health insurance enrollment program; hurricane hunters fired", content: `**Agriculture:** Funding cut for schools, food banks, and their partnerships with local farmers across Florida.
**Education:** Nearly half of Dept of Education laid off, threatening funding for low-income districts and special needs children.
**Environment:** Employees fired from Everglades restoration projects, endangering a park with ~1 million annual visitors.
**Health Care:** 90% cut to program helping Tampa Bay residents get health insurance.
**Public Safety:** NOAA workers fired, including weather forecasters and at least one hurricane hunter.
**Veterans:** VA employees fired; a former Navy pilot fired from NOAA's hurricane hunters; disabled veteran fired from VA.` },

  { state: "Georgia", slug: "georgia", summary: "600 CDC workers fired in Atlanta; 5 Social Security offices closed; housing vouchers threatened for 18,000 Atlanta residents", content: `**Housing:** Funding freeze put housing vouchers at risk for 18,000 Atlanta residents; HUD worker preventing housing discrimination fired.
**Agriculture:** Funding cut for schools, food banks and local farmers from Savannah to Columbus.
**Economy:** Federal employees fired in Savannah, with more at risk across the state.
**Education:** FAFSA assistance program for first-generation and minority students cancelled in Atlanta.
**Public Health:** 600 CDC workers fired in Atlanta, leaving the agency understaffed.
**Social Security:** Five SSA offices closed in Georgia.
**Veterans:** VA employees and veterans fired across the state.` },

  { state: "Iowa", slug: "iowa", summary: "250,000 meals/year at risk from food bank funding cuts; 5 VA employees fired; farmers facing uncertainty as growing season begins", content: `**Agriculture:** 250,000+ meals per year at risk from food bank funding cuts; Cedar Rapids farmer said it's "the worst timing" as crops already planted; Tipton farmer called cuts "asinine, unnecessary, mean-spirited."
**Veterans:** Five employees fired at Central Iowa VA System.
**Housing:** Government shutdown delayed HUD communications, threatening $8 million in homelessness program funding.
**Economy:** Farm economy rattled by tariffs devastating Iowa's dairy and soybean industries.` },

  { state: "Maine", slug: "maine", summary: "USDA grants paused to University of Maine; $45,000 blocked from reaching a farmer; 6 Portsmouth Naval Shipyard employees fired", content: `**Agriculture:** $45,000 check blocked from reaching a West Gardiner farmer who already installed a solar array; USDA grants paused to University of Maine worth ~$30 million.
**Defense:** Six employees fired at Portsmouth Naval Shipyard on the Maine-New Hampshire border.
**Veterans:** Employees including veterans fired from VA in Maine.
**Food:** South Portland food bank warned of "significantly higher" costs after USDA program cuts.` },

  { state: "Michigan", slug: "michigan", summary: "Food banks losing local farmer partnerships; only Bureau of Indian Affairs office closed; 15% cut at NOAA's Ann Arbor office", content: `**Agriculture:** Funding cut for food banks and their partnerships with local farmers from Grand Rapids to Marquette.
**Economy:** Michigan's only Bureau of Indian Affairs office closed, affecting 12 federally recognized tribes.
**Public Safety:** NOAA's Ann Arbor office cut by 15%; $30 million blocked for state police and environmental agencies, including $27 million in disaster preparedness grants.
**Veterans:** VA employees fired; Detroit VA union leader said surgeries delayed and wait lists skyrocketing; physical rehab appointments cancelled.` },

  { state: "Montana", slug: "montana", summary: "$425,000 fair housing grant terminated; $200,000 food bank grant cancelled; archaeologist fired during cancer treatment", content: `**Housing:** $425,000 grant terminated for nonprofit helping tenants resolve housing discrimination.
**Agriculture:** $200,000 grant cancelled to food bank that purchased produce from local farmers.
**Education:** $6 million grant cancelled for University of Montana civics program.
**Health Care:** Archaeologist fired during cancer treatment, leaving her without health insurance facing $180,000 in medical fees.
**Public Safety:** National parks employees fired who were critical to preventing wildfires.
**Veterans:** Employees fired from Montana VA system.` },

  { state: "New Jersey", slug: "new-jersey", summary: "$26M in local food funding cut; 17,000 workers laid off by end of February; 15 FAA employees fired", content: `**Agriculture:** $26 million cut that allowed school districts and food banks to buy from 46 local producers.
**Economy:** Nearly 17,000 workers laid off by end of February vs. 1,000 at same point in 2024.
**Education:** Staff fired at Dept of Education's OCR, leading to "a dramatic drop" in discrimination investigations.
**Health Care:** 1.8 million NJ residents on Medicaid threatened by budget resolution cuts.
**Public Safety:** NOAA employees fired, threatening hurricane preparedness; 15 FAA employees fired in NJ.` },

  { state: "New York", slug: "new-york", summary: "$51M in local food funding cut; only one HUD manager left in NYC field office for Section 8; 3 SSA offices closed", content: `**Agriculture:** $51 million cut for school districts and food banks to buy from local farmers; 15 truckloads cancelled for Central NY food bank.
**Economy:** Federal worker providing rural loans and grants fired, putting grants at risk.
**Environment:** Staff fired at Albany National Weather Service, reducing "critical" weather balloon flights.
**Health Care:** Federal grant freeze interrupted Alzheimer's research.
**Social Security:** Three SSA offices closed in New York.
**Housing:** Only one management-level employee left at HUD's NYC field office processing Section 8 for nearly a million residents.` },

  { state: "North Carolina", slug: "north-carolina", summary: "$11M+ in food bank grants terminated; Farm Service Agency lease terminated during Helene recovery; 4 SSA offices closed", content: `**Agriculture:** $11 million+ in grants terminated for food banks to buy from local farmers; Farm Service Agency building lease terminated during Hurricane Helene recovery; farmers facing bankruptcy from tariffs.
**Education:** Multi-million dollar grants ended for teacher hiring and bonuses.
**Environment:** $3 million frozen for African-American and Latino communities rebuilding after hurricanes; ~20 Forest Service employees fired helping with Helene recovery.
**Health Care:** Funding cut to program helping North Carolinians enroll in health insurance.
**Public Safety:** Weather Service staff fired, threatening severe weather warnings.
**Social Security:** Four SSA offices closed.
**Veterans:** VA hospital employees fired.` },

  { state: "Pennsylvania", slug: "pennsylvania", summary: "$35M+ in food program funding eliminated; $150M solar program frozen; Dept of Ed civil rights office closing", content: `**Agriculture:** $35 million+ eliminated for schools and food banks to buy from local farmers, impacting Central PA, Greater Pittsburgh, Erie, and Bucks County.
**Economy:** Harrisburg USDA office closed; 45+ contracts cancelled with local businesses; hundreds of IRS employees and 60+ federal employees in Pittsburgh fired.
**Education:** $343 million+ in annual federal education funds at risk; Dept of Ed's OCR in Philadelphia closing.
**Housing:** $150 million solar program frozen; $180 million weatherization grant restricted.
**Social Security:** Funding terminated for research helping disabled individuals navigate benefits.
**Transportation:** $40 million Riverside Drive revitalization in Allentown stalled.
**Veterans:** Workers fired at Pittsburgh and Erie VA centers.` },

  { state: "Texas", slug: "texas", summary: "$9.2M cut from North Texas Food Bank; 650+ caregivers laid off at border facilities; 3 SSA offices closed", content: `**Agriculture:** $9.2 million cut from North Texas Food Bank for purchasing from local farmers; cattle ranchers and farmers hurt by tariffs; farmer education program cut in Panhandle.
**Economy:** San Antonio company forced to lay off 650+ caregivers at border facilities.
**Health Care:** Austin program helping 5,000 people enroll in healthcare annually lost funding.
**Public Health:** Concern about measles outbreak amid CDC layoffs.
**Public Safety:** NOAA employees laid off; meteorologists warned of reduced forecast accuracy.
**Social Security:** Three SSA offices closed in Texas.
**Veterans:** VA employees laid off across Texas; disabled veteran fired from IRS.` },

  { state: "Virginia", slug: "virginia", summary: "Highest federal employee concentration hit hard; 50% of community health centers cut off; 630,000 Medicaid recipients at risk", content: `**Agriculture:** Funding cut for food banks and local farmers from Madison County to Danville.
**Economy:** Virginia has one of the highest federal employee populations; experts predict 10% federal worker cut would trigger state-wide recession.
**Education:** Multiple Richmond programs lost funding; further cuts threaten at-risk kids.
**Health Care:** 50% of community health centers cut off from federal grants during February freeze; several Richmond-area centers closed.
**Medicare/Medicaid:** Virginia's Medicaid expansion trigger law means 630,000 recipients could lose coverage if federal funding decreases.
**Veterans:** Virginia has third highest veteran population; VA centers in Richmond, Fredericksburg, and Salem face staffing shortages.` },

  { state: "Wisconsin", slug: "wisconsin", summary: "$17M in food bank funding cancelled; Apostle Islands layoffs threaten $44M tourism economy; 90% cut to health insurance enrollment", content: `**Agriculture:** $17 million cancelled for food banks and schools to buy from local farmers; 5 truckloads worth $615,000 cancelled from Milwaukee food bank.
**Economy:** Apostle Islands National Lakeshore layoffs threaten 600+ jobs relying on $44 million tourism.
**Education:** Funding threatened for Wisconsin libraries and museums.
**Health Care:** 90% cut to program helping Wisconsinites register for health insurance; addiction treatment center may never open.
**Veterans:** Several veterans working for the federal government fired.` },

  // Remaining states with summary data
  { state: "Arkansas", slug: "arkansas", summary: "30 of 47 rural hospitals at risk of closing; tariffs threatening to close 1 in 3 farms; food insecurity ranked dead last nationally", content: `Arkansas faces severe impacts from Republican policies. The state ranks dead last nationally for food insecurity according to the USDA. 30 of Arkansas's 47 rural hospitals are at risk of closing. Tariffs could close 1 in 3 Arkansas farms. Medicaid work requirements already stripped 18,000 Arkansans of coverage.` },
  { state: "Connecticut", slug: "connecticut", summary: "Federal employee layoffs impacting state services; community health center funding disrupted", content: `Federal employee layoffs and funding freezes have impacted Connecticut's community health centers and social services.` },
  { state: "Delaware", slug: "delaware", summary: "Federal funding cuts affecting small state services; USDA programs cancelled", content: `Delaware faces impacts from cancelled USDA programs and federal funding freezes affecting state services.` },
  { state: "Hawaii", slug: "hawaii", summary: "Federal worker layoffs; NOAA cuts threatening weather forecasting for island state", content: `Hawaii faces impacts from NOAA cuts that threaten weather forecasting critical for the island state, along with federal worker layoffs.` },
  { state: "Idaho", slug: "idaho", summary: "Forest Service and BLM layoffs; agricultural funding cuts", content: `Idaho faces impacts from Forest Service and Bureau of Land Management layoffs, along with agricultural funding cuts.` },
  { state: "Illinois", slug: "illinois", summary: "Federal employee layoffs in Chicago area; food bank funding cuts; ICE operations escalated", content: `Illinois faces impacts from federal employee layoffs in the Chicago area, food bank funding cuts, and escalated ICE deportation operations.` },
  { state: "Indiana", slug: "indiana", summary: "Stellantis plant layoffs from tariffs; 1.8M Hoosiers on Medicaid/CHIP at risk; 12 hospitals threatened with closure", content: `Indiana faces 900 layoffs at Stellantis plants in Kokomo from tariffs. Nearly 1.8 million Hoosiers covered by Medicaid or CHIP are at risk, with 12 hospital closures threatened.` },
  { state: "Kansas", slug: "kansas", summary: "Agricultural funding cuts; federal worker layoffs", content: `Kansas faces impacts from agricultural funding cuts and federal worker layoffs affecting state services.` },
  { state: "Kentucky", slug: "kentucky", summary: "Coal country health care at risk; USDA program cuts; federal employee layoffs", content: `Kentucky faces impacts from health care cuts in coal country, USDA program cancellations, and federal employee layoffs.` },
  { state: "Louisiana", slug: "louisiana", summary: "Hurricane preparedness threatened; food bank funding cuts; federal employee layoffs", content: `Louisiana faces impacts from threats to hurricane preparedness, food bank funding cuts, and federal employee layoffs.` },
  { state: "Maryland", slug: "maryland", summary: "Major federal workforce state facing mass layoffs; NIH funding threatened", content: `Maryland faces major impacts as one of the highest federal employee states. NIH funding and research threatened by cuts and freezes.` },
  { state: "Massachusetts", slug: "massachusetts", summary: "Hospital chain bankruptcy from private equity; research funding frozen", content: `Massachusetts faces impacts from hospital chain bankruptcy linked to private equity and frozen research funding.` },
  { state: "Minnesota", slug: "minnesota", summary: "Federal employee layoffs; USDA program cuts; community health center disruptions", content: `Minnesota faces impacts from federal employee layoffs, USDA program cancellations, and disruptions to community health centers.` },
  { state: "Mississippi", slug: "mississippi", summary: "Rural health care at extreme risk; SNAP cuts in one of poorest states; agricultural funding eliminated", content: `Mississippi faces severe impacts as one of the nation's poorest states, with rural health care at extreme risk and SNAP cuts threatening food security.` },
  { state: "Missouri", slug: "missouri", summary: "Federal employee layoffs; agricultural funding cuts; VA service disruptions", content: `Missouri faces impacts from federal employee layoffs, agricultural funding cuts, and VA service disruptions.` },
  { state: "Nebraska", slug: "nebraska", summary: "Agricultural tariff impacts; federal worker layoffs; rural health care threatened", content: `Nebraska faces impacts from agricultural tariffs, federal worker layoffs, and threats to rural health care access.` },
  { state: "Nevada", slug: "nevada", summary: "Federal land management layoffs; tourism impacts; housing affordability crisis worsened", content: `Nevada faces impacts from federal land management layoffs, tourism impacts, and a worsened housing affordability crisis.` },
  { state: "New Hampshire", slug: "new-hampshire", summary: "Portsmouth Naval Shipyard layoffs; community health center disruptions", content: `New Hampshire faces impacts from Portsmouth Naval Shipyard layoffs and disruptions to community health centers.` },
  { state: "New Mexico", slug: "new-mexico", summary: "National lab and military base impacts; rural health care cuts; USDA program cancellations", content: `New Mexico faces impacts from national lab and military base disruptions, rural health care cuts, and USDA program cancellations.` },
  { state: "North Dakota", slug: "north-dakota", summary: "Agricultural tariff impacts; federal worker layoffs; rural health care threatened", content: `North Dakota faces impacts from agricultural tariffs, federal worker layoffs, and threats to rural health care.` },
  { state: "Ohio", slug: "ohio", summary: "Manufacturing job losses from tariffs; VA service disruptions; federal worker layoffs", content: `Ohio faces impacts from manufacturing job losses linked to tariffs, VA service disruptions, and federal worker layoffs.` },
  { state: "Oklahoma", slug: "oklahoma", summary: "174,000 Oklahomans at risk of losing Medicaid; 131,000 at risk of losing SNAP; 9 rural hospitals already closed", content: `Oklahoma faces severe impacts with 174,000 at risk of losing Medicaid, 131,000 at risk of losing SNAP benefits, and 9 rural hospitals already closed since 2005.` },
  { state: "Oregon", slug: "oregon", summary: "Forest Service layoffs; agricultural funding cuts; infrastructure investments threatened", content: `Oregon faces impacts from Forest Service layoffs, agricultural funding cuts, and threatened infrastructure investments.` },
  { state: "Rhode Island", slug: "rhode-island", summary: "Federal employee layoffs; community health center funding disrupted", content: `Rhode Island faces impacts from federal employee layoffs and disruptions to community health center funding.` },
  { state: "South Carolina", slug: "south-carolina", summary: "Military base impacts; rural health care cuts; agricultural funding eliminated", content: `South Carolina faces impacts from military base disruptions, rural health care cuts, and eliminated agricultural funding.` },
  { state: "South Dakota", slug: "south-dakota", summary: "Agricultural tariff impacts; tribal services disrupted; rural health care threatened", content: `South Dakota faces impacts from agricultural tariffs, disrupted tribal services, and threats to rural health care.` },
  { state: "Tennessee", slug: "tennessee", summary: "300,000+ Tennesseans denied Medicaid expansion; USDA program cuts; federal worker layoffs", content: `Tennessee faces impacts with 300,000+ Tennesseans denied Medicaid expansion, USDA program cancellations, and federal worker layoffs.` },
  { state: "Utah", slug: "utah", summary: "Federal land management layoffs; BLM cuts; national park service impacts", content: `Utah faces impacts from federal land management layoffs, BLM cuts, and national park service impacts.` },
  { state: "Vermont", slug: "vermont", summary: "Community health center disruptions; agricultural funding cuts; federal worker layoffs", content: `Vermont faces impacts from community health center disruptions, agricultural funding cuts, and federal worker layoffs.` },
  { state: "Washington", slug: "washington", summary: "Federal worker layoffs in Seattle area; agricultural tariff impacts; Forest Service cuts", content: `Washington faces impacts from federal worker layoffs in the Seattle area, agricultural tariff impacts, and Forest Service cuts.` },
  { state: "West Virginia", slug: "west-virginia", summary: "Rural health care at severe risk; coal country economic impacts; VA service disruptions", content: `West Virginia faces severe impacts with rural health care at extreme risk, coal country economic impacts, and VA service disruptions.` },
  { state: "Wyoming", slug: "wyoming", summary: "Federal land management impacts; agricultural tariff effects; rural health care threatened", content: `Wyoming faces impacts from federal land management disruptions, agricultural tariff effects, and threats to rural health care.` },
];

export function searchLocalImpact(query: string): LocalImpactReport[] {
  if (!query.trim()) return localImpactReports;
  const q = query.toLowerCase();
  return localImpactReports.filter(r =>
    r.state.toLowerCase().includes(q) ||
    r.summary.toLowerCase().includes(q) ||
    r.content.toLowerCase().includes(q)
  );
}

export function getLocalImpactBySlug(slug: string): LocalImpactReport | undefined {
  return localImpactReports.find(r => r.slug === slug);
}
