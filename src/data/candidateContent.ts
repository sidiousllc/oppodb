import { initCandidates } from "./candidates";

// All candidate data pre-fetched from the Research Books MCP
const candidateData = [
  { name: "Andy Ogles", slug: "andy-ogles", content: `Andy Ogles fabricated his resume — claiming to be an economist after earning a C in his only economics course — and is now the subject of an active FBI criminal investigation after reporting a $320,000 campaign loan that was actually $20,000, triggering a unanimous 6-0 ethics referral for a full House investigation. Before Congress, he led the Americans for Prosperity campaign that killed Medicaid expansion for over 300,000 Tennesseans. He raised nearly $25,000 using a photo of his stillborn baby for a children's burial garden that was never built — and has never accounted for the money.

In Congress, his first bill sought to repeal the $35 insulin cap for seniors, he publicly declared he wants to "be the guy that kills" the ACA, and he called Medicaid recipients "losers in their mama's basement" the morning he voted for a bill that Nashville's mayor estimated would strip 62,000 of his own constituents of medical coverage.` },
  
  { name: "Anna Paulina Luna", slug: "anna-paulina-luna", content: `Anna Paulina Luna is the Republican U.S. Representative for Florida's 13th Congressional District. Known for her strong alignment with MAGA and the House Freedom Caucus.

**Key Vulnerabilities:**
- Support for Policies Driving Up Costs through Trump-era trade war and tariff policies
- Votes for Medicaid & Social Security Cuts risking health coverage for 34,000 district residents
- Extremism, Partisan Performance, and Divisive Rhetoric
- House Freedom Caucus alignment threatening government shutdowns
- Anti-Abortion Record including celebrating Roe v. Wade's overturning` },

  { name: "Ashley Hinson", slug: "ashley-hinson", content: `Ashley Hinson is a Republican U.S. Representative from Iowa's 2nd Congressional District. A former broadcast journalist.

**Key Vulnerabilities:**
- Tariffs, Trade Policy, and Agricultural Interests: support for Trump-style tariffs hurting Iowa's agricultural economy
- Out of Touch With Cost Of Living Challenges: votes against minimum wage and worker protections
- Health Care: opposed capping insulin prices and negotiating Medicare drug prices
- Voted for bill estimated to kick 17 million Americans off health insurance` },

  { name: "Buddy Carter", slug: "buddy-carter", content: `Buddy Carter is a pharmacist worth an estimated $28-33 million whose own pharmacy distributed nearly 3 million opioid pills in Chatham County while his primary opioid supplier McKesson gave him $55,000 in campaign contributions. He accepted over $500,000 from the pharmaceutical industry while voting against $35 insulin caps — calling it a "socialist plan" — and voting for $625 billion in Medicaid cuts that could leave 750,000 Georgians uninsured.

He voted against every major job-creating law of the past decade — the Infrastructure Law, the CHIPS Act, and the Inflation Reduction Act — then took credit for the $7.6 billion Hyundai Metaplant those laws brought to his district.` },

  { name: "Carlos De La Cruz", slug: "carlos-de-la-cruz", content: `Carlos De La Cruz thought he could win the TX-35 election on family ties alone. He was eager to be "Trump's wingman" if elected to Congress. He has touted endorsements from President Donald Trump and Speaker Mike Johnson, even though their policies have caused pain for many Texans.

**Key Issues:**
- Backed Trump and Johnson's agenda of cutting health care for 17 million Americans
- Supported bill triggering major cuts to Medicare
- Supported tariffs raising prices and damaging Texas' economy
- Backed largest cut to SNAP in history` },

  { name: "Chuck Edwards", slug: "chuck-edwards", content: `Chuck Edwards is the Republican U.S. Representative for North Carolina. He voted for devastating health care cuts and defended Trump's tariffs that hurt North Carolina families and businesses.

**Key Vulnerabilities:**
- Voted for bill kicking 17 million Americans off health insurance
- Voted for massive Medicare cuts
- Defended tariffs hurting NC economy
- Supported DOGE cuts affecting services` },

  { name: "Dan Sullivan", slug: "dan-sullivan", content: `Dan Sullivan voted for the "One Big Beautiful Bill" that resulted in over 37,000 Alaskans losing health coverage. He claimed Alaska was in "good shape" regarding Medicaid funding, calling it a "big win" for rural hospitals. However, CMS capped usage of the $50 billion Rural Health Transformation Fund at 15%.

He voted for legislation that reduced funding for public broadcasting by $1.1 billion, endangering life-saving Native Alaskan radio stations. He supported tariffs that endangered the Alaskan economy and voted to cut food assistance programs.` },

  { name: "Derek Dooley", slug: "derek-dooley", content: `Derek Dooley is a nepo baby who couldn't win as a football coach for Georgia's arch-rival Tennessee. He was eager to strip away Georgians' health care and cheered Trump as he decimated Georgia's economy.

He mocked the ACA's enhanced premium subsidies and opposed their extension. An estimated 460,000 Georgians could lose their health insurance without the subsidies. He supported Trump's 'Big Beautiful Bill' and praised Trump's tariffs while dismissing Georgians' economic pain.` },

  { name: "Derrick Van Orden", slug: "derrick-van-orden", content: `Derrick Van Orden has been a headache for the district. He backed ripping health care from thousands of Wisconsinites, defended Trump's tariffs as they rattled farm country, cheered on cuts and chaos that slowed Social Security. He can't control his temper—from the Prairie du Chien library blow-up to berating teen Senate pages.

He promised no "single nickel reduction" in benefits, then voted for a bill kicking 17 million Americans off health insurance. He was the deciding vote to protect Trump's tariffs that were crushing Wisconsin farmers.` },

  { name: "Eli Crane", slug: "eli-crane", content: `Eli Crane is out-of-touch with his constituents because he doesn't live in the district he represents. He voted to cut critical health insurance programs and raise costs for Arizonans. He backed legislation that threatened the Medicaid benefits of more than 41,000 Arizonans in his district.

He repeatedly praised Trump's DOGE despite the risk it posed to constituents' Social Security benefits. He supported Trump's tariffs that were hurting small businesses and raising grocery prices. He even admitted he isn't a good congressman.` },

  { name: "Gabe Evans", slug: "gabe-evans", content: `Perpetual liar Gabe Evans ran on public safety and making life more affordable, then voted to cut services and raise costs on Coloradans. He voted to kick more than 29,000 Coloradans off their health insurance, for massive cuts to Medicare, and to make it harder for his neighbors to buy food.

He cast the deciding vote to protect Trump's tariffs. He cast the deciding vote to protect accused pedophiles named in the Epstein files. Then he stood by while Trump laid off Coloradans and gutted the Social Security agency.` },

  { name: "Jack Ciattarelli", slug: "jack-ciattarelli", content: `Jack Ciattarelli is the Republican candidate for Governor of New Jersey.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: supported 20-week abortion ban, opposed Planned Parenthood funding
- Called to Repeal and Replace the ACA, described Medicaid cuts as a "grand experiment"
- Wanted to Slash Pension Benefits
- Planned to Defund Public Schools
- Was Paid to Downplay Opioid Risks through Galen Publishing ($12.2M)` },

  { name: "Jason Miyares", slug: "jason-miyares", content: `Jason Miyares is the Virginia Attorney General running for Governor.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: supported anti-abortion pregnancy centers, overturning Roe v. Wade
- Threat to Democracy: supported legislation disenfranchising voters
- Supported Defunding Public Schools
- Anti-Equality Agenda: voted against banning conversion therapy
- Opposed Medicaid Expansion covering 400,000 Virginians` },

  { name: "Jeff Hurd", slug: "jeff-hurd", content: `Jeff Hurd is the Republican U.S. Representative for Colorado's 3rd Congressional District. He positions himself as a "mainstream" conservative but faces significant vulnerabilities.

**Key Vulnerabilities:**
- Tensions between establishment support and MAGA base
- Voted for House budget resolutions cutting Medicaid by hundreds of billions
- Supported tariffs threatening Colorado's agricultural sector
- Ambiguous stance on Trump created party loyalty questions` },

  { name: "Jeffrey Van Drew", slug: "jeff-van-drew", content: `Jeff Van Drew's policies have harmed everyday people:
- Backed tariffs that raise prices for families
- Backed Social Security cuts and a higher retirement age
- Backed abortion restrictions eliminating access for millions
- Cast a deciding vote to cut Medicaid and push millions off coverage
- Voted against Medicare drug reforms that lower costs for seniors
- Cast a deciding vote blocking immediate release of the Epstein files
- Took credit for earmarks in spending bills he voted against` },

  { name: "Jen Kiggans", slug: "jen-kiggans", content: `Jen Kiggans is the biggest threat to her constituents' well-being. She voted to kick Virginians off health coverage by supporting the Big Ugly Bill, breaking her numerous earlier promises. She called the bill a "win" despite a major hospital at risk of closing.

She sided with Big Pharma over Virginia seniors, opposed the Inflation Reduction Act. She told Virginians who lost their job due to DOGE cuts to "go out and get" another job. She ran away when asked why she refused to protect veterans from predatory payday lenders.` },

  { name: "John Cornyn", slug: "john-cornyn", content: `John Cornyn is the senior U.S. Senator from Texas.

**Key Vulnerabilities:**
- Voted to benefit large corporations with Trump Tax Cuts
- Bad for women and sought to restrict abortion rights
- Repeatedly failed to protect Social Security benefits
- Opposed Medicaid expansions and backed conservative reforms
- Backed Medicare cuts and privatization
- Key player in GOP's frenzy to repeal the ACA
- DC insider and creature of the swamp` },

  { name: "John King", slug: "john-king", content: `John King is a Republican candidate in Georgia.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: defended Texas' Heartbeat Law
- Blocked Access to Affordable Health Care through Georgia Access program
- Backed DOGE efforts at Georgians' expense
- Supported Trump's economy-wrecking tariffs
- Ran a notorious metro Atlanta speed trap
- Fear mongered and spread dangerous conspiracy theories` },

  { name: "John Lujan", slug: "john-lujan", content: `John Lujan has long pretended to be a moderate Republican but pledged to support Trump's agenda. That agenda has included ripping health care from 17 million Americans, making the largest cut to SNAP in history, and imposing tariffs that raised costs on Texans.

He supported school vouchers at the expense of public schools. He's an anti-choice extremist who supported Texas' near-total abortion ban. He even said if he had a daughter who was raped, he would tell her to carry the baby to term.` },

  { name: "Joni Ernst", slug: "joni-ernst", content: `Joni Ernst is the U.S. Senator from Iowa.

**Key Vulnerabilities:**
- Opposed Affordable Healthcare: voted 20+ times to repeal the ACA
- Anti-Abortion Extremist: supported 6-week ban, personhood amendment
- Supported DOGE and gutting of government services
- All in for Trump's tariffs despite previously opposing them
- Had romantic relationships with officials that lobbied her committee
- Supported privatizing Social Security` },

  { name: "Juan Ciscomani", slug: "juan-ciscomani", content: `Ciscomani pretended to be an independent voice for Arizona, but he was just another far-right Republican. He repeatedly promised to protect Arizonans' health care then voted to cut them. Nearly 32,000 Arizonans could lose health coverage.

He defended Trump's tariffs despite knowing they were hurting Arizona families. He voted six times to protect the tariffs, including casting the deciding vote. He defended DOGE as it attacked Social Security and federal workers.` },

  { name: "Ken Calvert", slug: "ken-calvert", content: `It's been 30 years, and all Calvert has delivered for Southern Californians is health care cuts, higher costs, and threats to their benefits, all while lining his own pockets.

He broke his promise and voted to take health coverage from Southern Californians. He voted for massive Medicare cuts then lied to constituents about it. He defended Trump's tariffs and made suspicious stock trades worth millions.` },

  { name: "Mariannette Miller-Meeks", slug: "mariannette-miller-meeks", content: `Miller-Meeks is wrong for IA-01. She voted to kick thousands of Iowans off their health insurance, to make it harder to afford groceries, and defended tariffs that crush Iowa farmers.

As a former doctor, she betrayed her patients by voting for devastating health care cuts. She was in the pocket of Big Pharma, accepting donations from insulin manufacturers while voting against insulin price caps. She faced a residency complaint about where she actually lives and votes.` },

  { name: "María Salazar", slug: "maria-salazar", content: `María Elvira Salazar is the Republican U.S. Representative for Florida's 27th Congressional District.

**Key Vulnerabilities:**
- Economic Trust and hypocrisy: voted against bipartisan initiatives then took credit
- Mixed messaging on health care
- Anti-Abortion Record despite diverse district
- Campaign finance scrutiny and personal financial troubles
- Inconsistent record on LGBTQ rights` },

  { name: "Mike Collins", slug: "mike-collins", content: `Mike Collins is a nepo baby Internet troll who wants to cut Medicaid, privatize Medicare, and raise the Social Security retirement age. He voted for a bill kicking 17 million Americans off health insurance. More than 500,000 Georgians could lose coverage.

He mocked the ACA's enhanced premium subsidies. He praised Trump's trade wars and told Americans to "trust the process." He claimed "blue collar people" do not "participate in the stock market."` },

  { name: "Mike Lawler", slug: "mike-lawler", content: `Mike Lawler sells a moderate brand, but he is a far-right gaslighter when it matters. He backed the largest Medicaid cut in history to fund tax cuts for billionaires after repeatedly promising the opposite.

He defended Trump's tariffs even while admitting they'd hurt New Yorkers. He cheered a plan that hollowed out Social Security service. He came up short on tax relief for New Yorkers and demonstrated poor judgement.` },

  { name: "Mike Rogers", slug: "mike-rogers", content: `Florida resident Mike Rogers has championed policies that have hurt Michigan families, small businesses and farmers.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: opposed Prop 3, supported Dobbs, tried to restrict IVF
- Bad for Michigan Seniors: voted to turn Medicare into a voucher program
- In the pocket of Big Pharma
- Supported bad trade deals harming Michigan's economy
- Used position to line his and his wife's pockets` },

  { name: "Nick Begich", slug: "nick-begich", content: `Nick Begich is the Republican representative serving Alaska.

**Key Vulnerabilities:**
- Questions about loyalty and authenticity from Democratic family legacy
- Controversies surrounding business practices and offshore employment
- Ties to conspiratorial publishing (Earthpulse Press)
- Social Security and health care voting record
- Reliance on personal wealth for campaigns` },

  { name: "Nick LaLota", slug: "nick-lalota", content: `Nick LaLota is a Republican Congressman representing New York's 1st District.

**Key Vulnerabilities:**
- Residency: does not live in NY-1, repeatedly criticized for it
- Ties to Trump and extreme partisanship despite marketing as independent
- Mixed record on policing and local government
- Voted in near lockstep with Republican majority (95%+ of the time)` },

  { name: "Pat Harrigan", slug: "pat-harrigan", content: `Pat Harrigan is a North Carolina Republican.

**Key Vulnerabilities:**
- Anti-Abortion Extremist
- Voted for the Big Ugly Bill hurting North Carolina
- Defended January 6 rioters
- Supported DOGE cuts harming NC
- Supported Trump's destructive tariffs
- District-hopped and lied about residency
- Endorsed by "Black Nazi" Mark Robinson` },

  { name: "Rich McCormick", slug: "rich-mccormick", content: `Rich McCormick is a Georgia Republican.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: defended Georgia's Heartbeat Law
- Supported gutting Social Security, said Republicans have to "deny" it
- Opposed access to affordable health care including for seniors
- Backed DOGE efforts at Georgians' expense
- Supported Trump's economy-wrecking tariffs
- Compared angry town hall attendees to January 6th insurrectionists` },

  { name: "Rob Bresnahan", slug: "rob-bresnahan", content: `Rob Bresnahan sold a blue-collar brand but governs like another rich guy who profits from the swamp. He repeatedly promised to protect benefits then voted to kick thousands of Pennsylvanians off health coverage.

He was the deciding vote to protect Trump's tariffs. He played games on DOGE while Social Security backlogs grew. He broke his own pledge to ban congressional stock trading and bought a secret helicopter.` },

  { name: "Ryan Mackenzie", slug: "ryan-mackenzie", content: `Mackenzie is a MAGA-aligned partisan posing as a pragmatist. He backed ripping health coverage from thousands of Pennsylvanians, opposed making prescription drugs cheaper for Lehigh Valley seniors.

He was the deciding vote to protect Trump's tariffs. He got caught lying to women in his own community. More than 26,000 Pennsylvanians in his district could lose health coverage.` },

  { name: "Ryan Zinke", slug: "ryan-zinke", content: `Zinke talks like a Montana independent, but he votes like a big city swamp creature. He backed bills that kick thousands of Montanans off their health coverage, sided with tariffs that raise costs and hurt Montana farmers.

He already left one DC job in scandal. He twice cosponsored legislation to repeal the Inflation Reduction Act. He was the deciding vote to protect Trump's tariffs. An estimated 27,000 Montanans could lose health coverage.` },

  { name: "Scott Perry", slug: "scott-perry", content: `Scott Perry is out of step with Harrisburg–York–Cumberland. He spent his clout trying to overturn an election, pushing a national abortion ban, voting against infrastructure and veterans' care.

He voted for devastating health care cuts — more than 23,000 Pennsylvanians could lose coverage. He sided with Big Pharma over Pennsylvanians. He was the deciding vote to protect Trump's tariffs. He trafficked in antisemitic conspiracy theories.` },

  { name: "Susan Collins", slug: "susan-collins", content: `Susan Collins has proven unwilling to stand up to Trump in a state that has repeatedly rejected him.

**Key Vulnerabilities:**
- Bad for Mainers' health care: repeatedly voted against ACA tax credit extensions
- Directly curtailed abortion rights by confirming Supreme Court justices
- Accepted thousands from insurance conglomerates while Mainers face skyrocketing premiums
- More than 50,000 Mainers facing doubled, tripled, or quadrupled premiums` },

  { name: "Thom Tillis", slug: "thom-tillis", content: `Thom Tillis is the U.S. Senator from North Carolina.

**Key Vulnerabilities:**
- Had no spine and was a flip-flopper on multiple issues
- Anti-Abortion Extremist: supported personhood amendment
- Bad for affordable healthcare: voted 20 times to repeal ACA
- Supported tax cuts for the rich
- Supported Trump's tariffs
- Bad for workers: opposed unions, minimum wage
- Weak on defending Social Security` },

  { name: "Tom Barrett", slug: "tom-barrett", content: `Tom Barrett's record is out of step with Michiganders. He voted to take health care away from thousands of Michiganders while pretending to care about cuts. He signed a performative letter urging no Medicaid cuts, then voted for them.

He sided with Big Pharma over patients. He defended DOGE as it destabilized Social Security and NIH research funding. His campaign misled Black voters on when to vote.` },

  { name: "Tom Kean, Jr.", slug: "tom-kean", content: `Multimillionaire Tom Kean, Jr. is a flip-flopper who will say and do anything to get elected. He voted to take Medicaid benefits and food assistance away from constituents. He backed Trump's unpopular tariffs.

He swore to put his stocks in a blind trust then violated the STOCK Act. He was silent when DOGE threatened thousands of constituents' jobs. More than 20,000 New Jerseyans could lose health coverage.` },

  { name: "Winsome Earle-Sears", slug: "winsome-earle-sears", content: `Winsome Earle-Sears is a Virginia gubernatorial candidate.

**Key Vulnerabilities:**
- Supported firing federal workers and embraced DOGE
- Supports defunding public schools
- Anti-LGBTQ bigot: opposed same-sex marriage
- Blamed mass shootings on abortion
- Opposed red flag laws
- Mischaracterized Brown v. Board of Education` },

  { name: "Young Kim", slug: "young-kim", content: `Young Kim is a California Republican.

**Key Vulnerabilities:**
- Voted to protect Trump's tariffs damaging to Californians
- Voted for the largest Medicaid cut in history, betraying 74,000 people in her district that rely on Medicaid and CHIP` },

  { name: "Zach Nunn", slug: "zach-nunn", content: `Nunn isn't working for IA-03. He backed taking health care from thousands of Iowans, defended Trump tariffs that hit Iowa pocketbooks and farms.

He voted for devastating Medicaid cuts after claiming he was "fully committed" to protecting Medicaid. He spent $12,000 of taxpayer money on slick ads promoting the bill. He chose Big Pharma over cheaper prescription drugs for Iowa seniors. He was the deciding vote to protect Trump's tariffs.` },
];

export function loadCandidateData() {
  initCandidates(candidateData);
}
