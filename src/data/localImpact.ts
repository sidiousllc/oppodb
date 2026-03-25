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

  { state: "Arkansas", slug: "arkansas", summary: "150,000 families lost USDA food program; $54M EV charger funding frozen; 4 SSA offices closed; affordable housing cuts", content: `**Agriculture:** Trump Administration cancelled USDA program that provided produce from local farmers to over 150,000 Arkansas families. Tariffs had potential to put Arkansas farmers out of business — 1 in 3 farms at risk.
**Energy:** The Trump administration froze $54 million in funding for electric-vehicle chargers in Arkansas.
**Social Security:** The Trump administration closed four Social Security Administration offices in Arkansas.
**Veterans:** Staff fired at the Central Arkansas Veterans Healthcare System and the Veterans Health Care System of the Ozarks.
**Housing:** Trump Administration cut funding for an Arkansas organization that helps unhoused people get out of poverty, losing 40% of its budget from HUD.
**Health Care:** 30 of Arkansas's 47 rural hospitals are at risk of closing. Medicaid work requirements already stripped 18,000 Arkansans of coverage.` },

  { state: "California", slug: "california", summary: "USDA cancelled programs serving 500+ local farmers; 60 Dept of Education employees fired; Weather/Forest Service cuts amid deadly fire season", content: `**Agriculture:** USDA cancelled program that allowed California food banks to purchase produce from over 500 local farmers; 330 truckloads of food suspended.
**Education:** ~60 employees fired at Dept of Education's Office for Civil Rights in San Francisco; $148 million in teacher training grants terminated.
**Public Safety:** Weather Service and Forest Service employees fired despite deadly 2024 wildfire season.
**Housing:** Tens of millions in affordable housing funding threatened; cuts to permanent housing projects affecting thousands of homeless residents.
**Health:** Medi-Cal cuts could affect 48% of residents in some districts; $30 billion/year in federal Medi-Cal funding at risk.` },

  { state: "Colorado", slug: "colorado", summary: "$13M in local food program funding cancelled; $570M in health/climate funding withheld; veteran housing worker fired", content: `**Agriculture:** $13 million cancelled for Colorado schools and food banks to purchase produce from local farmers; largest food bank lost $2 million.
**Environment:** $570 million in federal funding for health and climate projects withheld even after federal courts ordered its release.
**Veterans:** Two Colorado veterans fired from VA, including one helping homeless veterans get housing.
**Housing:** Budget cuts in OBBB forced Colorado to cut $105 million from Prop 123 affordable housing program.` },

  { state: "Connecticut", slug: "connecticut", summary: "$10M in food funding cut; $6M+ frozen for farmers; FAA worker fired; food banks forced to cut hours", content: `**Agriculture:** Trump administration cut $10 million in funding for Connecticut food banks and schools to buy produce from local farmers. Froze over $6 million in funding for small businesses and farmers. Bridgeport food bank forced to cut employee hours.
**Agriculture:** Trump administration froze disaster-relief funds for farmers affected by 2023-2024 natural disasters.
**Transportation:** FAA workers fired in Connecticut, including one air traffic controller.
**Economy:** Federal employee layoffs impacting state services across Connecticut.
**Health Care:** Community health center funding disrupted by federal freezes.` },

  { state: "Delaware", slug: "delaware", summary: "$900K fair housing grant cancelled; 19 truckloads of food ($1.1M) lost; dozens of federal employees fired; 3 DHS offices closed", content: `**Housing:** Trump administration cancelled $900,000 grant to Delaware nonprofit that protects against housing discrimination.
**Agriculture:** Trump administration's termination of USDA program cost the Food Bank of Delaware 19 truckloads of food worth more than $1 million.
**Economy:** Dozens of federal employees fired and three DHS offices closed in Delaware.
**Education:** Federal funding cuts threatened Delaware's education programs and services.` },

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

  { state: "Hawaii", slug: "hawaii", summary: "$46M in climate-friendly farm funding cut; economy heading into recession; tsunami warning scientist fired; Maui wildfire recovery frozen", content: `**Agriculture:** Trump administration cut $46 million for climate-friendly agricultural initiatives in Hawaii. Canceled two federal programs that helped feed schoolchildren in a state already struggling with food insecurity.
**Economy:** Trump administration's cuts sending Hawaii into recession according to University of Hawaii researchers. State losing millions in food grants; Interior Department firings hit researchers protecting farm land.
**Education:** Almost half of Department of Education laid off, threatening school districts where federal government provides about 11% of public school funding.
**Public Safety:** Fired a scientist at the Weather Service's Tsunami Warning Center. Froze funding for program employing 131 people in wildfire cleanup and recovery from 2023 Maui wildfires.` },

  { state: "Idaho", slug: "idaho", summary: "USDA employees fired hurting farmers; Forest Service firings threatening wildfire prevention; dozens of park employees laid off; veterans fired", content: `**Agriculture:** Employees fired at USDA's Natural Resources Conservation Service in Idaho, leaving farmers without critical research and support for increasing crop yields, mitigating fire risk, and improving water and soil quality.
**Economy:** Employees fired responsible for facilitating lumber sales, ensuring ESA compliance, and giving tours at the Minidoka National Historic Site (WWII Japanese-American incarceration camp).
**Public Safety:** Dozens of National Park employees fired in Idaho. Campsites and trails can't be maintained and may close. Many fired employees were certified in firefighting or helped with evacuations during 2024 Idaho wildfires.
**Veterans:** VA employees and veterans fired across Idaho, including a combat-disabled veteran.` },

  { state: "Illinois", slug: "illinois", summary: "HUD cuts threaten affordable housing; $220K farmer grant frozen; 40+ Chicago Dept of Ed employees fired; CDC/WHO withdrawal impacts", content: `**Housing:** Trump administration cut funding for programs to fight housing discrimination and fired HUD employees investigating fair housing claims.
**Agriculture:** Cut funding for schools, food banks and local farmers across Illinois. One family farm that lost its chicken flock to bird flu had its $220,000 grant frozen.
**Economy:** Froze funding for small businesses; USAID-funded University of Illinois program forced to lay off 30 employees; $2 billion in federal aid frozen.
**Education:** Over 40 employees fired at Chicago Department of Education office, many working on federal student aid.
**Public Health:** Illinois Dept of Public Health Director warned WHO withdrawal would harm state public health. Scientists fired working on food quality, crop blights, and clean air/water.
**Veterans:** VA employees and veterans fired across Illinois. Chicago-area VA program helping veterans access healthcare and housing shut down.` },

  { state: "Indiana", slug: "indiana", summary: "$26M frozen for farmers; scientist monitoring tobacco risks fired; NOAA cuts threaten severe weather warnings; fair housing nonprofit cut", content: `**Agriculture:** Trump administration froze $26 million in funding for Indiana farmers. Cut funding for schools, food banks and local farmers from Fort Wayne to Evansville. DeMotte farmer lost 20% of income from USDA program termination.
**Housing:** Cut funding to Indianapolis nonprofit that helped prevent discriminatory housing practices. 80% of FHCCI's $1 million annual budget came from federal dollars.
**Environment:** Fired National Park employees and slashed funding for conservation and forestry programs.
**Public Health:** Laid off Indianapolis scientist who monitored risk of tobacco products for adults and children.
**Public Safety:** NOAA staff cuts could make it harder to warn residents about severe weather according to Indiana Emergency Management.
**Health Care:** Nearly 1.8 million Hoosiers covered by Medicaid or CHIP at risk, with 12 hospital closures threatened.` },

  { state: "Iowa", slug: "iowa", summary: "250,000 meals/year at risk from food bank funding cuts; 5 VA employees fired; farmers facing uncertainty as growing season begins", content: `**Agriculture:** 250,000+ meals per year at risk from food bank funding cuts; Cedar Rapids farmer said it's "the worst timing" as crops already planted; Tipton farmer called cuts "asinine, unnecessary, mean-spirited."
**Veterans:** Five employees fired at Central Iowa VA System.
**Housing:** Government shutdown delayed HUD communications, threatening $8 million in homelessness program funding.
**Economy:** Farm economy rattled by tariffs devastating Iowa's dairy and soybean industries.` },

  { state: "Kansas", slug: "kansas", summary: "Farmer's $600K rural energy contract frozen; 40 employees fired at Haskell Indian Nations University; Housing First programs threatened", content: `**Agriculture:** Trump administration cancelled and froze funding for agriculture projects, including one farmer's contract for $600,000 for rural energy development. Programs encouraging local food banks to buy produce in-state were cut.
**Education:** 40 employees fired at the Haskell Indian Nations University.
**Veterans:** VA medical facility in Topeka faced layoffs.
**Housing:** Trump's executive order ending Housing First programs threatened to increase homelessness in Kansas, where 2,600+ people experience homelessness.
**Economy:** Dismantling USAID hurt Kansas businesses and farms. Kansas Democrat said cuts are "hurting our economy, national security and hardworking Kansans."` },

  { state: "Kentucky", slug: "kentucky", summary: "150,000 households losing heating/cooling aid; bourbon pulled from Canadian shelves; Daniel Boone Forest employees fired; LIHEAP staff terminated", content: `**Agriculture:** Trump administration froze funding for Kentucky farmers, leaving them with unsustainable debt.
**Economy:** Several Canadian provinces pulled Kentucky bourbon off shelves in response to Trump's tariffs.
**Environment:** Fired employees testing for "forever chemicals" in Kentucky and dozens more at Daniel Boone National Forest, including those responsible for wildfire suppression.
**Housing:** HUD cuts could slow construction of homes for 2022 flood victims in eastern Kentucky.
**Energy:** All LIHEAP staff terminated, putting program helping 150,000 Kentucky households pay heating/cooling bills in jeopardy.
**Health Care:** Coal country health care at severe risk from Medicaid cuts.` },

  { state: "Louisiana", slug: "louisiana", summary: "$22M frozen for LSU crop research; Calcasieu schools lost local produce funding; flood insurance threatened by shutdown", content: `**Agriculture:** Trump administration froze $22 million in USAID funding for LSU's research to make crops more available to those at risk of hunger. Calcasieu Parish Schools lost funding to buy produce from local farmers. Louisiana farmers reported losing millions.
**Disaster Relief:** Trump's government shutdown threatened to temporarily suspend flood insurance for 458,000 Louisiana home and business owners.
**Energy:** Trump administration froze funding for Louisiana energy programs.
**Economy:** Federal worker layoffs across Louisiana impacting state services.` },

  { state: "Maine", slug: "maine", summary: "USDA grants paused to University of Maine; $45,000 blocked from reaching a farmer; 6 Portsmouth Naval Shipyard employees fired", content: `**Agriculture:** $45,000 check blocked from reaching a West Gardiner farmer who already installed a solar array; USDA grants paused to University of Maine worth ~$30 million.
**Defense:** Six employees fired at Portsmouth Naval Shipyard on the Maine-New Hampshire border.
**Veterans:** Employees including veterans fired from VA in Maine.
**Food:** South Portland food bank warned of "significantly higher" costs after USDA program cuts.` },

  { state: "Maryland", slug: "maryland", summary: "800+ federal employees fired; $280M predicted state loss; 15% cut at federal water quality lab; Assateague Beach left without lifeguards", content: `**Economy:** Trump administration fired at least 800 federal employees in Maryland, where up to 29,000 jobs were at risk. State predicted cuts could mean a loss of $280 million.
**Education:** Terminated a program at the University of Maryland that helped principals from poor schools improve performance.
**Environment:** Fired 15% of employees at a federal lab working on water quality and oyster harvesting.
**Agriculture:** Woodsboro farmer called bipartisan farm-to-school program a "win-win" before Trump ended it.
**Public Safety:** Assateague Island National Seashore left without lifeguards due to federal cuts. Mayor called it "playing with fire."` },

  { state: "Massachusetts", slug: "massachusetts", summary: "$12M school produce program cut serving 90 districts/58 farmers; all Boston Dept of Ed workers fired; water science center gutted", content: `**Agriculture:** Trump administration cut $12 million program helping 90 Massachusetts school districts buy produce from 58 local farmers.
**Economy:** Tariffs on Canada increased energy and homebuilding costs in Massachusetts.
**Education:** All employees at U.S. Department of Education's regional office in Boston were fired.
**Environment:** Largest USGS New England Water Science Center office said it would be "almost impossible" to continue its mission after layoffs.
**Housing:** Massachusetts Fair Housing Center forced to stop taking new clients after "devastating" funding cuts — lost over half its budget.
**Veterans:** VA staff fired including veterans; appointments cancelled.` },

  { state: "Michigan", slug: "michigan", summary: "Food banks losing local farmer partnerships; only Bureau of Indian Affairs office closed; 15% cut at NOAA's Ann Arbor office", content: `**Agriculture:** Funding cut for food banks and their partnerships with local farmers from Grand Rapids to Marquette.
**Economy:** Michigan's only Bureau of Indian Affairs office closed, affecting 12 federally recognized tribes.
**Public Safety:** NOAA's Ann Arbor office cut by 15%; $30 million blocked for state police and environmental agencies, including $27 million in disaster preparedness grants.
**Veterans:** VA employees fired; Detroit VA union leader said surgeries delayed and wait lists skyrocketing; physical rehab appointments cancelled.` },

  { state: "Minnesota", slug: "minnesota", summary: "$425K fair housing grant cancelled; cereal disease lab scientists fired; food banks cut across Twin Cities to Duluth; Air Force veteran laid off from SBA", content: `**Agriculture:** Funding cut for schools, food banks and local farmers from Twin Cities to Duluth to Luverne County. At least 3 employees fired from Cereal Disease Lab in St. Paul doing "irreplaceable" work preventing crop failures.
**Housing:** Trump administration cut $425,000 grant funding legal help for people facing housing discrimination or sexual harassment from landlords.
**Veterans:** VA employees and veterans laid off across Minnesota. Air Force veteran who became deputy director of SBA in Minnesota was suddenly laid off.
**Economy:** Federal employee layoffs impacting state services across Minnesota.` },

  { state: "Mississippi", slug: "mississippi", summary: "$6M farmer-to-food-bank program terminated; food bank shelves empty; 3 SSA offices closed; cotton farmers hurt by tariffs", content: `**Agriculture:** Trump administration terminated $6 million program to help Mississippi food banks purchase produce from local farmers. Mississippi Food Network CEO showed empty shelves. Mississippi ranks dead last for food insecurity — over 600,000 people go hungry.
**Social Security:** Three Social Security Administration offices closed in Mississippi.
**Agriculture:** Trump's tariffs harmed cotton farmers by increasing machinery and fertilizer costs.
**Economy:** Federal spending cuts impacting organizations statewide.` },

  { state: "Missouri", slug: "missouri", summary: "$2.2M Springfield food bank funding cut; 1,000 IRS layoffs in Kansas City; $6M teacher training grant ended; soybean research shut down", content: `**Agriculture:** Cut $2.2 million in funding for Springfield food bank to buy from local farmers. Kansas City area farmers lost big profits. University of Missouri soybean research project shut down.
**Economy:** Planned layoff of roughly 1,000 IRS employees in Kansas City, risking regional downturn.
**Education:** Cut $6 million grant for St. Louis teacher training program serving 60-80 substitute teachers.
**Agriculture:** Staffing cuts undermined flood-prone area farmer assistance programs.` },

  { state: "Montana", slug: "montana", summary: "$425,000 fair housing grant terminated; $200,000 food bank grant cancelled; archaeologist fired during cancer treatment", content: `**Housing:** $425,000 grant terminated for nonprofit helping tenants resolve housing discrimination.
**Agriculture:** $200,000 grant cancelled to food bank that purchased produce from local farmers.
**Education:** $6 million grant cancelled for University of Montana civics program.
**Health Care:** Archaeologist fired during cancer treatment, leaving her without health insurance facing $180,000 in medical fees.
**Public Safety:** National parks employees fired who were critical to preventing wildfires.
**Veterans:** Employees fired from Montana VA system.` },

  { state: "Nebraska", slug: "nebraska", summary: "196 school districts lost local produce program; affordable housing projects at risk; emergency management disrupted; veterans homes threatened", content: `**Agriculture:** Trump administration cut program helping 196 Nebraska school districts purchase local produce for school lunch. Fired researchers at Meat Animal Research Center.
**Housing:** Federal funding freeze put affordable housing construction projects at risk. Kearney nonprofit providing housing for people in crisis asked if it should pause projects.
**Education:** Almost half of Education Department fired, leaving Nebraska schools worried about reimbursement timing.
**Public Safety:** Funding freeze disrupted Nebraska Emergency Management Agency and Nebraska Crime Commission.
**Veterans:** Funding freeze threatened veterans homes that rely on federal funding.` },

  { state: "Nevada", slug: "nevada", summary: "$156M solar/affordable housing funding frozen; $6M food program cancelled; national park scientists fired; 20 VA employees fired", content: `**Housing:** Trump administration froze $156 million for community solar projects and affordable housing in Nevada, affecting 20,000+ low-income households and 1,000 jobs.
**Agriculture:** Cancelled $6 million program for Nevada food banks and schools to buy from local farmers. Food Bank of Northern Nevada forced to cut million pounds of fresh food distribution.
**Environment:** Fired national parks employees and scientists ensuring Southern Nevada has safe drinking water.
**Veterans:** Fired around 20 VA employees in Nevada, including those who sterilized operating rooms.
**Education:** Federal education cuts threatening Nevada school districts.` },

  { state: "New Hampshire", slug: "new-hampshire", summary: "$1M food bank funding cut; Portsmouth Naval Shipyard workers 'terrorized'; nearly 100 IRS employees fired; veteran fired from IRS", content: `**Agriculture:** Trump administration cut $1 million in funding for New Hampshire food bank to buy produce from local farmers.
**Defense:** Workers at Portsmouth Naval Shipyard "terrorized" by firing threats. Six employees fired at the shipyard.
**Economy:** Nearly 100 IRS employees fired in New Hampshire.
**Veterans:** A New Hampshire veteran working for the IRS was fired.` },

  { state: "New Jersey", slug: "new-jersey", summary: "$26M in local food funding cut; 17,000 workers laid off by end of February; 15 FAA employees fired", content: `**Agriculture:** $26 million cut that allowed school districts and food banks to buy from 46 local producers.
**Economy:** Nearly 17,000 workers laid off by end of February vs. 1,000 at same point in 2024.
**Education:** Staff fired at Dept of Education's OCR, leading to "a dramatic drop" in discrimination investigations.
**Health Care:** 1.8 million NJ residents on Medicaid threatened by budget resolution cuts.
**Public Safety:** NOAA employees fired, threatening hurricane preparedness; 15 FAA employees fired in NJ.` },

  { state: "New Mexico", slug: "new-mexico", summary: "$2.8M food bank funding cut; 35 USDA employees fired; 210+ federal employees laid off; quarter of SIPI staff fired; USDA offices closed", content: `**Agriculture:** Cut $2.8 million for New Mexico food banks and schools to buy from local farmers. Froze $26.8 million in grants for farmers and tribes improving soil and water conservation. Fired 35 USDA employees. Closed USDA and Farm Service Agency offices in Clovis, Roswell, Gallup, and Raton.
**Education:** Fired roughly a quarter of staff at Southwestern Indian Polytechnic Institute.
**Environment:** Fired biologist responsible for protecting animal life after oil spills.
**Economy:** At least 210 New Mexico federal employees fired in mass layoffs.` },

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

  { state: "North Dakota", slug: "north-dakota", summary: "Fargo food bank lost $1M funding round; crop prices driven down by tariffs; disaster relief delayed by shutdown; veterans homes funding threatened", content: `**Agriculture:** Fargo food bank told third $1 million funding round would not come. Trump's tariffs drove down crop prices, leaving farmers in danger of operating at a loss — average farm borrowing 12-20x more than in the 1980s.
**Disaster Relief:** Government shutdown delayed disaster aid for communities damaged by June 2025 storms including tornadoes, hail, and heavy wind.
**Economy:** Federal worker layoffs impacting state services.
**Veterans:** Veterans homes and services threatened by funding cuts.` },

  { state: "Ohio", slug: "ohio", summary: "Cincinnati fair housing funding cut; IRS employees fired; 'forever chemicals' engineers laid off; HHS employee helping mothers with PPD fired", content: `**Agriculture:** Cut funding for food banks and school districts to buy from local farmers.
**Economy:** At least 20 IRS employees fired in Ohio; refund checks may be delayed.
**Education:** Almost half of Department of Education laid off; Ohio Teachers Union warns agency can't fulfill duties.
**Environment:** Laid off two Cincinnati engineers treating "forever chemicals" in Ohio and Kentucky waters.
**Health Care:** Fired HHS employee helping mothers with post-partum depression.
**Housing:** Cut funding to Cincinnati nonprofit preventing housing discrimination. Columbus forced to consider new tax for homeless services after federal threats.
**Public Safety:** Cut retention bonuses for federal prison guards, exacerbating staffing shortages.
**Veterans:** Fired VA employees who helped provide food and mental health services to veterans.` },

  { state: "Oklahoma", slug: "oklahoma", summary: "$24M school/food bank funding cancelled; Tinker Air Force Base in 'havoc'; 40 Bureau of Indian Education workers fired; Weather Service cuts", content: `**Agriculture:** Cancelled $24 million in funding for Oklahoma schools and food banks to buy from local farmers. Regional Food Bank already seeing supply at half of previous year.
**Defense:** Cuts caused "havoc" at Tinker Air Force Base due to uncertainty about civilian layoffs.
**Education:** 40 Bureau of Indian Education workers fired in Oklahoma.
**Environment:** Fired employees at National Weather Service office in Oklahoma.
**Public Safety:** Laid off employees at FAA training facility in Oklahoma.` },

  { state: "Oregon", slug: "oregon", summary: "Hundreds of Forest Service workers fired; $76M park tourism threatened; 6 Eugene IRS agents reviewing millionaires fired; health center laid off 11%", content: `**Economy:** Hundreds of National Forest Service workers fired threatening $76 million national park tourism industry. Six Eugene-area IRS agents reviewing multi-millionaires laid off.
**Environment:** 25 employees fired at Ochoco National Forest, hurting firefighting and timber sales.
**Health Care:** Funding freeze forced Oregon health center to lay off 11% of staff.
**Agriculture:** Josephine County food bank facing 20% reduction in food supplies from USDA cuts.
**Public Safety:** Cut retention bonuses for federal prison guards, exacerbating staffing shortages.
**Veterans:** VA staff fired, threatening access to critical veteran services.` },

  { state: "Pennsylvania", slug: "pennsylvania", summary: "$35M+ in food program funding eliminated; $150M solar program frozen; Dept of Ed civil rights office closing", content: `**Agriculture:** $35 million+ eliminated for schools and food banks to buy from local farmers, impacting Central PA, Greater Pittsburgh, Erie, and Bucks County.
**Economy:** Harrisburg USDA office closed; 45+ contracts cancelled with local businesses; hundreds of IRS employees and 60+ federal employees in Pittsburgh fired.
**Education:** $343 million+ in annual federal education funds at risk; Dept of Ed's OCR in Philadelphia closing.
**Housing:** $150 million solar program frozen; $180 million weatherization grant restricted.
**Social Security:** Funding terminated for research helping disabled individuals navigate benefits.
**Transportation:** $40 million Riverside Drive revitalization in Allentown stalled.
**Veterans:** Workers fired at Pittsburgh and Erie VA centers.` },

  { state: "Rhode Island", slug: "rhode-island", summary: "$3M USDA program cut; Providence farm nonprofit laid off 8 employees; defense funding disrupted; energy cost reduction funds frozen", content: `**Agriculture:** Cut $3 million USDA program helping Rhode Island farmers sell fresh produce. Providence agricultural nonprofit forced to lay off 8 of 48 employees, affecting 90 farms and fishing businesses.
**Defense:** Funding freeze interrupted defense and manufacturing industries.
**Energy:** Froze funds for program to reduce energy costs for Rhode Island residents.
**Health Care:** Froze funds that provided maternity medical devices to needy mothers.` },

  { state: "South Carolina", slug: "south-carolina", summary: "$14.5M school/food bank funding cut; farmer reimbursements frozen; 20 Hurricane Hunters fired; 16 VA employees fired in Charleston", content: `**Agriculture:** Cut $14.5 million for South Carolina schools and food banks to buy from local farmers, affecting 213,000+ schoolchildren. Froze farmer reimbursements that were already counting on the funds.
**Education:** Ended $5 million grant to train and hire local teachers.
**Public Safety:** Fired 20 Hurricane Hunters in South Carolina, threatening hurricane data collection.
**Veterans:** Fired 16 employees at VA clinic in Charleston.
**Agriculture:** Trump's tariffs lowered soybean prices, threatening farm profits.` },

  { state: "South Dakota", slug: "south-dakota", summary: "65+ USDA employees fired; soybean prices down $250M statewide; Badlands park ranger/EMT laid off; farmer equipment grants frozen", content: `**Agriculture:** Fired at least 65 USDA employees in South Dakota. Froze funding that helped farmers upgrade equipment. Tariff wars decreased soybean prices — $1 drop equates to $250 million lost income for SD farmers.
**Economy:** Cut food bank/school funding and closed multiple government offices in the state.
**Environment:** Laid off park ranger at Badlands National Park — one of three EMTs at the park.
**Agriculture:** Farmers hoped administration would unfreeze grants for soil quality improvement programs.` },

  { state: "Tennessee", slug: "tennessee", summary: "$20M school/food bank program terminated; mine reforestation suspended; Nashville SSA office closed; rural housing grant threatened", content: `**Agriculture:** Terminated $20 million program for Tennessee schools and food banks to buy from local farmers. Suspended soil conservation teaching program for farmers. Ended programs purchasing trees from local farmers.
**Economy:** Closed IRS office threatening tax assistance meetings.
**Environment:** Suspended Tennessee mine reforestation program.
**Social Security:** Closed Social Security Administration office in Nashville.
**Housing:** Trump threatened to cancel HOME Investment Partnerships Program that rural Tennesseans rely on for affordable housing.
**Veterans:** Fired VA employees in Tennessee Valley.` },

  { state: "Texas", slug: "texas", summary: "$9.2M cut from North Texas Food Bank; 650+ caregivers laid off at border facilities; 3 SSA offices closed", content: `**Agriculture:** $9.2 million cut from North Texas Food Bank for purchasing from local farmers; cattle ranchers and farmers hurt by tariffs; farmer education program cut in Panhandle.
**Economy:** San Antonio company forced to lay off 650+ caregivers at border facilities.
**Health Care:** Austin program helping 5,000 people enroll in healthcare annually lost funding.
**Public Health:** Concern about measles outbreak amid CDC layoffs.
**Public Safety:** NOAA employees laid off; meteorologists warned of reduced forecast accuracy.
**Social Security:** Three SSA offices closed in Texas.
**Veterans:** VA employees laid off across Texas; disabled veteran fired from IRS.` },

  { state: "Utah", slug: "utah", summary: "Alfalfa pest control scientist fired; Hill Air Force Base childcare at risk; disabled veteran fired from VA; IRS forced to rehire laid-off workers", content: `**Agriculture:** Laid off federal scientist in Logan responsible for protecting alfalfa farmers from pests while protecting pollinating bees.
**Education:** Cut funding for program improving post-graduation outcomes for students with disabilities. Utah Humanities said cuts would "decimate" services to public.
**Military:** Layoffs put service members' childcare at risk at Hill Air Force Base.
**Veterans:** Fired a disabled veteran who worked for VA in Utah.
**Economy:** IRS in Ogden forced to rehire employees who took deferred resignation, causing "morale breaker" for remaining staff.` },

  { state: "Vermont", slug: "vermont", summary: "12 truckloads of food cancelled; $1.7M school/food bank funding terminated; fair housing project lost 80% of budget; farmer grants interrupted", content: `**Agriculture:** 12 truckloads of food cancelled for Vermont food banks — 15-20% of federal food supply. Terminated $1.7 million for schools and food banks to buy from local farmers. Interrupted grants and loans for rural municipalities.
**Housing:** Vermont Fair Housing Project lost about 80% of its budget from federal cuts, instantly affecting anti-discrimination services.
**Economy:** Federal worker layoffs impacting community services.` },

  { state: "Virginia", slug: "virginia", summary: "Highest federal employee concentration hit hard; 50% of community health centers cut off; 630,000 Medicaid recipients at risk", content: `**Agriculture:** Funding cut for food banks and local farmers from Madison County to Danville.
**Economy:** Virginia has one of the highest federal employee populations; experts predict 10% federal worker cut would trigger state-wide recession.
**Education:** Multiple Richmond programs lost funding; further cuts threaten at-risk kids.
**Health Care:** 50% of community health centers cut off from federal grants during February freeze; several Richmond-area centers closed.
**Medicare/Medicaid:** Virginia's Medicaid expansion trigger law means 630,000 recipients could lose coverage if federal funding decreases.
**Veterans:** Virginia has third highest veteran population; VA centers in Richmond, Fredericksburg, and Salem face staffing shortages.` },

  { state: "Washington", slug: "washington", summary: "Seattle HUD office targeted for closure; hops scientists fired; Hanford nuclear cleanup workers laid off; $1.7B Bridger-Teton tourism threatened", content: `**Housing:** Trump administration fired HUD employees at Seattle office, with plans to close it entirely and lay off all 100+ workers. Froze emergency food and shelter program funding for 18,000 people in Columbia Basin.
**Agriculture:** Fired multiple Washington-based scientists studying hops, warning their layoffs will hurt farmers and breweries.
**Energy:** Froze funding to help farmers and small businesses reduce energy bills. Laid off employees responsible for state electricity.
**Environment:** Fired at least a dozen employees cleaning up "the most contaminated site in the Western Hemisphere." Fired employees protecting Olympic National Park from invasive species.
**Health Care:** NIH funding cuts threatened cancer research and 12,000 jobs that NIH funding supports in Washington.
**Veterans:** Fired multiple veterans and VA employees in Washington state.` },

  { state: "West Virginia", slug: "west-virginia", summary: "Farmer: 'They're trying to bankrupt me'; $10K in charity savings burned through; 80 federal employees fired in Parkersburg; 10 VA employees fired", content: `**Agriculture:** West Virginia farmer lost USDA contract and told his father: "They're trying to bankrupt me." Farmers lost over $2 million in funding that helped schools purchase local food.
**Economy:** 80 federal employees in Parkersburg fired; mayor warned cuts would hurt already depressed local economy.
**Food:** WV charity forced to burn through $10,000 in savings — a third of reserves — to keep feeding 600 meals/week after federal food aid cuts.
**Veterans:** 10 employees fired at Louis A. Johnson VA Medical Center in Clarksburg.
**Health Care:** Rural health care at severe risk from Medicaid and federal funding cuts.` },

  { state: "Wisconsin", slug: "wisconsin", summary: "$17M in food bank funding cancelled; Apostle Islands layoffs threaten $44M tourism economy; 90% cut to health insurance enrollment", content: `**Agriculture:** $17 million cancelled for food banks and schools to buy from local farmers; 5 truckloads worth $615,000 cancelled from Milwaukee food bank.
**Economy:** Apostle Islands National Lakeshore layoffs threaten 600+ jobs relying on $44 million tourism.
**Education:** Funding threatened for Wisconsin libraries and museums.
**Health Care:** 90% cut to program helping Wisconsinites register for health insurance; addiction treatment center may never open.
**Veterans:** Several veterans working for the federal government fired.` },

  { state: "Wyoming", slug: "wyoming", summary: "$500K food bank grant eliminated; fired USDA worker warned cuts hurt farmers; Bridger-Teton layoffs threaten $1.7B tourism; Casper urban forestry grant cancelled", content: `**Agriculture:** Cut $500,000 from Food Bank of Wyoming to purchase from local farmers. Fired USDA employees who supported farmers facing drought, hail, and high winds. Cuts delayed response to livestock diseases.
**Economy:** Laid off employees at Bridger-Teton National Forest, threatening the $1.7 billion tourism industry.
**Environment:** Cancelled grant that would have improved water and air quality, mitigated heat islands, and increased property values in Casper.
**Veterans:** Fired a veteran who worked at a VA mental health center in Cheyenne.` },
];

// Merge DB records into the in-memory array (call once at startup)
export function mergeLocalImpactFromDB(dbRecords: Array<{ state: string; slug: string; summary: string; content: string }>) {
  const existing = new Set(localImpactReports.map(r => r.slug));
  for (const r of dbRecords) {
    if (existing.has(r.slug)) {
      const idx = localImpactReports.findIndex(li => li.slug === r.slug);
      if (idx >= 0) {
        localImpactReports[idx] = { state: r.state, slug: r.slug, summary: r.summary, content: r.content };
      }
    } else {
      localImpactReports.push({ state: r.state, slug: r.slug, summary: r.summary, content: r.content });
    }
  }
  localImpactReports.sort((a, b) => a.state.localeCompare(b.state));
}

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
